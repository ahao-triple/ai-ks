import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Company } from './company.entity';
import { Repository } from 'typeorm';
import { CreateCompanyDto } from './dto/create-company.dto';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs/internal/lastValueFrom';
import { IRefreshToken, TokenData, TokenRes } from 'src/types/types';
import { updateToken } from './dto/update-token.dto';
import { Interval } from '@nestjs/schedule';
import { envConfig } from 'src/config/config';
import { updateProDto } from './dto/update-pro.dto';
import { join } from 'path';
import { existsSync, unlinkSync, writeFileSync } from 'fs';
import { User } from 'src/user/user.entity';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class CompanyService implements OnModuleInit {
  private readonly lockToken = join(__dirname, 'refresh.lock');
  constructor(
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    private readonly httpService: HttpService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}
  async onModuleInit() {
    if (!existsSync(this.lockToken)) {
      try {
        if (!envConfig.isonline) {
          writeFileSync(this.lockToken, 'locked');
          await this.autoRefresh();
        }
      } catch (error) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        Logger.error(`刷新token失败：${error.message}`);
      } finally {
        // 无论是否成功，都删除 lock 文件
        if (existsSync(this.lockToken)) {
          try {
            unlinkSync(this.lockToken);
          } catch (error) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            Logger.error(`删除 refresh.lock 文件失败：${error.message}`);
          }
        } else {
          Logger.error(`refresh.lock 锁文件已被删除`);
        }
      }
    }
  }

  async getPro(): Promise<number> {
    const company = await this.companyRepository.findOne({
      where: { app_id: envConfig.app_id },
    });
    if (!company) {
      Logger.error('公司不存在');
      throw new InternalServerErrorException('公司不存在');
    }
    return company.proportion.proportion;
  }

  async create(createCompanyDto: CreateCompanyDto): Promise<Company> {
    const token_data = await this.getTokenData(createCompanyDto.auth_code);
    const dbCompany = { ...createCompanyDto, token_data, isModule: true };
    const company = this.companyRepository.create(dbCompany);

    try {
      const savedCompany = await this.companyRepository.save(company);
      return savedCompany;
    } catch (error: any) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (error.code === '23505') {
        throw new BadRequestException(`公司${createCompanyDto.name}已存在`);
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      Logger.error(`公司保存失败：${error.message}`, error.stack);
      throw new InternalServerErrorException('创建公司失败，请稍后重试');
    }
  }

  async updatePro(body: updateProDto): Promise<boolean> {
    const appId = envConfig.app_id;
    try {
      await this.companyRepository
        .createQueryBuilder()
        .update(Company)
        .set({
          proportion: () =>
            `jsonb_set(proportion::jsonb, '{proportion}', :newValue::jsonb, false)`,
        })
        .where('app_id = :appId', { appId, newValue: body.pro })
        .execute();

      return true;
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      Logger.error('更新失败', JSON.stringify(error.message));
      throw new InternalServerErrorException('更新失败', JSON.stringify(error));
    }
  }

  async getTokenData(auth_code: string): Promise<TokenData> {
    const endpoint =
      'https://ad.e.kuaishou.com/rest/openapi/oauth2/authorize/access_token';

    // 准备请求体或请求参数
    const requestBody = {
      app_id: envConfig.app_id,
      secret: envConfig.secret,
      auth_code: auth_code,
    };

    try {
      // 使用 RxJS 的 lastValueFrom 将 Observable 转换为 Promise
      const response$ = this.httpService.post<TokenRes>(endpoint, requestBody);
      const response = await lastValueFrom(response$);

      // 根据返回的结构进行判断
      if (response.data.code !== 0) {
        throw new Error(
          `获取 Token 失败：code=${response.data.code}, message=${response.data.message}`,
        );
      }

      // 结构化获取 data
      const {
        access_token,
        access_token_expires_in,
        refresh_token,
        refresh_token_expires_in,
      } = response.data.data;
      // 返回符合 TokenData 接口的数据
      return {
        access_token,
        access_token_expires_in,
        refresh_token,
        refresh_token_expires_in,
      };
    } catch (error) {
      // 捕获并抛出异常（也可根据需要做更多处理）
      throw new InternalServerErrorException(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        `请求第三方接口失败：${error.message}`,
      );
    }
  }

  async createToken(auth_code: string): Promise<Company> {
    try {
      const token_data = await this.getTokenData(auth_code);
      await this.companyRepository.update(
        { app_id: envConfig.app_id },
        { token_data: token_data || {} },
      );
      const company = await this.companyRepository.findOne({
        where: { app_id: envConfig.app_id },
      });
      if (!company) {
        throw new InternalServerErrorException('获取新token失败，请检查参数');
      }
      return company;
    } catch (error: any) {
      throw new InternalServerErrorException(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        `获取新 token 失败，未知错误：${error.message}`,
      );
    }
  }

  async updateToken(updateToken: updateToken): Promise<boolean> {
    try {
      const company = await this.companyRepository.findOne({
        where: { app_id: updateToken.app_id },
      });

      if (!company) {
        throw new InternalServerErrorException(
          '更新token错误请输入正确的app_id',
          updateToken.app_id,
        );
      }

      const token_data = await this.refreshToken({
        app_id: company.app_id,
        secret: company.secret,
        refresh_token: company.token_data.refresh_token,
      });
      const updateResult = await this.companyRepository.update(
        { app_id: updateToken.app_id },
        {
          token_data: token_data,
        },
      );
      const affectedRows = updateResult.affected ?? 0;
      if (affectedRows > 0) {
        return true;
      } else {
        return false;
      }
    } catch (error: any) {
      throw new InternalServerErrorException(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        `更新 token 失败，未知错误：${error.message}`,
      );
    }
  }

  async refreshToken(company: IRefreshToken): Promise<TokenData> {
    const { app_id, secret, refresh_token } = company;
    // 修改为 refresh_token 接口地址
    const endpoint =
      'https://ad.e.kuaishou.com/rest/openapi/oauth2/authorize/refresh_token';

    const requestBody = {
      app_id,
      secret,
      refresh_token,
    };

    try {
      // 使用 RxJS 的 lastValueFrom 将 Observable 转换为 Promise
      const response$ = this.httpService.post<TokenRes>(endpoint, requestBody);
      const response = await lastValueFrom(response$);

      // 根据返回的结构进行判断
      if (response.data.code !== 0) {
        throw new Error(
          `刷新 Token 失败：code=${response.data.code}, message=${response.data.message}`,
        );
      }

      // 结构化获取 data
      const {
        access_token: new_access_token,
        access_token_expires_in,
        refresh_token,
        refresh_token_expires_in,
      } = response.data.data;
      // 返回符合 TokenData 接口的数据
      return {
        access_token: new_access_token,
        access_token_expires_in,
        refresh_token,
        refresh_token_expires_in,
      };
    } catch (error) {
      // 捕获并抛出异常
      throw new InternalServerErrorException(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        `请求第三方接口失败：${error.message}`,
      );
    }
  }

  /**
   * // TODO 需要新客户信息用来测试通过性
   * @param auth_code
   */
  async createDefaultCompany(auth_code: string): Promise<string> {
    const token_data = await this.getTokenData(auth_code);
    const company = new Company();
    company.app_id = envConfig.app_id;
    company.name = envConfig.name;
    company.secret = envConfig.secret;
    company.token_data = token_data;
    company.isModule = true;
    company.isWithdraw = false;
    company.auth_code = auth_code;
    company.advertiser_id = envConfig.advertiser_id;
    const ahaotriple = new User();
    ahaotriple.nickname = '17607972081';
    // eslint-disable-next-line spellcheck/spell-checker
    ahaotriple.password = await bcrypt.hash('Hao758258..', 10);
    ahaotriple.identity = 'ahaotriple';
    try {
      await this.companyRepository.save(company);
      await this.userRepository.save(ahaotriple);
      return 'success';
    } catch (error) {
      Logger.error(`默认公司创建失败: ${error}`);
      throw new InternalServerErrorException('默认公司创建失败');
    }
  }

  @Interval(60 * 60 * 12 * 1000)
  async autoRefresh() {
    Logger.log('开始自动刷新 token_data');
    const company = await this.companyRepository.findOne({
      where: { app_id: envConfig.app_id },
    });
    if (!company) {
      Logger.error('没有需要刷新的公司');
      return;
    }

    try {
      // 如果没有 token_data 或 refresh_token 不存在，则跳过
      if (!company.token_data || !company.token_data.refresh_token) {
        Logger.warn(`公司ID: ${company.id} 缺少 refresh_token，跳过更新`);
        return;
      }
      const refreshPayload: IRefreshToken = {
        app_id: company.app_id,
        secret: company.secret,
        refresh_token: company.token_data.refresh_token,
      };

      const newTokenData: TokenData = await this.refreshToken(refreshPayload);
      company.token_data = newTokenData;
      await this.companyRepository.save(company);
      Logger.log(`成功刷新 ${company.name} 的 token_data`);
    } catch (error) {
      Logger.error(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        `刷新 ${company.name} 的 token_data 失败: ${error.message}`,
      );
    }
  }

  async getToken(): Promise<string> {
    const company = await this.companyRepository.findOne({
      where: { app_id: envConfig.app_id },
    });
    if (company !== null) {
      return company.token_data.access_token;
    } else {
      Logger.error(`公司不存在获取不到token`);
      throw new InternalServerErrorException('获取token失败-公司不存在');
    }
  }

  async findAll(): Promise<Company[]> {
    return this.companyRepository.find();
  }

  async isWithdraw(): Promise<boolean> {
    const company = await this.companyRepository.findOne({
      where: { app_id: envConfig.app_id },
    });
    if (company !== null) {
      return company.isWithdraw;
    } else {
      return true;
    }
  }

  async isActing(): Promise<number> {
    const company = await this.companyRepository.findOne({
      where: { app_id: envConfig.app_id },
    });
    if (company !== null) {
      return company.isActing;
    } else {
      return 0;
    }
  }

  async checkPay(password: string): Promise<boolean> {
    const company = await this.companyRepository.findOne({
      where: { app_id: envConfig.app_id },
    });
    if (!company) {
      return false;
    } else {
      if (password === company.pay_password) {
        return true;
      } else {
        return false;
      }
    }
  }

  async updatePay(password: string): Promise<boolean> {
    const company = await this.companyRepository.findOne({
      where: { app_id: envConfig.app_id },
    });
    if (!company) {
      return false;
    } else {
      company.pay_password = password;
      await this.companyRepository.save(company);
      return true;
    }
  }
}
