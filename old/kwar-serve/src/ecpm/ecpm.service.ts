/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable spellcheck/spell-checker */
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Ecpm } from './ecpm.entity';
import { In, Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { IDetail, IEcpmReq, IEcpmRes, IEcpmClientRes } from 'src/types/types';
import { lastValueFrom } from 'rxjs';
import { envConfig } from 'src/config/config';
import { CompanyService } from 'src/company/company.service';
import { Company } from 'src/company/company.entity';
import {
  checkPro,
  checkProbability,
  createNewCost,
  formatCurrency,
  generateRandomTransactions,
} from 'src/common/helpers/helpers';
import { FindByGameDto } from './dto/find-game.dto';
import { FindByUserDto } from './dto/find-user.dto';
import { FindEcpmDto } from './dto/find-ecpm.dto';
import { User } from 'src/user/user.entity';
import { GameUser } from 'src/game-user/game-user.entity';
import { RefreshEcpmDto } from './dto/refresh-ecpm.dto';
import { DeleteGameDto } from './dto/delete-game.dto';
import { Game } from 'src/game/game.entity';
import { PushEcpmDto } from './dto/push-ecpm.dto';

@Injectable()
export class EcpmService implements OnModuleInit {
  constructor(
    @InjectRepository(Ecpm)
    private readonly ecpmRepository: Repository<Ecpm>,
    @InjectRepository(Company)
    private readonly comRepository: Repository<Company>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(GameUser)
    private readonly gameUserRepository: Repository<GameUser>,
    @InjectRepository(Game)
    private readonly gameRepository: Repository<Game>,
    private readonly httpService: HttpService,
    private readonly companyService: CompanyService,
  ) {}

  async onModuleInit() {
    Logger.log('EcpmService 清理...');
    await this.clearEcpm();
  }

  async clearEcpm() {
    await this.ecpmRepository.query(`
      DELETE
      FROM ecpm
      WHERE custom_id IN (SELECT custom_id
                          FROM (SELECT custom_id,
                                       ROW_NUMBER() OVER (PARTITION BY open_id, event_time ORDER BY ecpm."createdAt" DESC) as rn
                                FROM ecpm) t
                          WHERE t.rn > 1)
    `);
  }

  // const company = await this.comRepository.findOne({
  //   where: { app_id: envConfig.app_id },
  //   select: ['withdraw_update_dt'],
  // });
  // console.log(`[调试] 查询到的公司信息: ${JSON.stringify(company)}`);
  // console.log(
  //   `[调试] 公司记录的 withdraw_update_dt: ${company?.withdraw_update_dt}`,
  // );

  // if (withdraw_update_dt === company?.withdraw_update_dt) {
  //   console.log(
  //     '[调试] 条件满足: withdraw_update_dt === company?.withdraw_update_dt. 今天已经更新过了。',
  //   );
  //   return '今天已经更新过了';
  // }

  /**
   * 每天凌晨三点通过查找数据库的数据更新用户的 total
   * @returns
   */
  async createWithdraw() {
    console.log('--- [调试] createWithdraw 函数开始执行 ---');
    try {
      const withdraw_update_dt = new Date().toLocaleDateString('en-CA');
      console.log(`[调试] 生成的 withdraw_update_dt: ${withdraw_update_dt}`);

      const endTime = new Date(new Date().setHours(0, 0, 0, 0));
      const startTime = new Date(
        new Date().setHours(0, 0, 0, 0) - 24 * 60 * 60 * 1000,
      );
      console.log(
        `[调试] 计算的时间范围: startTime: ${startTime.toISOString()}, endTime: ${endTime.toISOString()}`,
      );
      const company = await this.comRepository.findOne({
        where: { app_id: envConfig.app_id },
        select: ['withdraw_update_dt'],
      });
      if (withdraw_update_dt === company?.withdraw_update_dt) {
        return '今天已经更新过了';
      }

      console.log('[调试] 今天尚未更新，准备更新公司 withdraw_update_dt...');
      await this.comRepository.update(
        { app_id: envConfig.app_id },
        { withdraw_update_dt },
      );
      console.log('[调试] 公司 withdraw_update_dt 更新成功。');

      const users = await this.userRepository
        .createQueryBuilder('user')
        .where('array_length(user.game_users, 1) > 0')
        .getMany();
      console.log(`[调试] 查询到需要处理的用户数量: ${users.length}`);
      if (users.length === 0) {
        console.log('[调试] 没有需要处理的用户，函数提前结束。');
        return '没有需要处理的用户';
      }

      return await this.ecpmRepository.manager.transaction(
        async (transactionalEntityManager) => {
          console.log('[调试] 开始数据库事务处理...');
          for (const user of users) {
            console.log(`\n--- [调试] 开始处理用户 ID: ${user.id} ---`);
            console.log(
              `[调试] 用户 ${user.id} 的 game_users: ${JSON.stringify(user.game_users)}`,
            );

            // 获取 is_withdraw 为 true 的 game 记录
            const withdrawableGames = await this.gameRepository
              .createQueryBuilder('game')
              .select('game.app_id', 'game_app_id') // 或者，如果你的 Game 实体中定义的字段就是 game_app_id
              .where('game.is_withdraw = :isWithdraw', { isWithdraw: true })
              .getRawMany();
            console.log(
              `[调试] 用户 ${user.id} - 查询到的可提现游戏记录: ${JSON.stringify(withdrawableGames)}`,
            );

            // 基于日志 {"game_app_id":"ks7..."}，这里的修正如下：
            const withdrawableAppIds = withdrawableGames.map(
              (game) => game.game_app_id, // <--- 修正行
            );
            console.log(
              `[调试] 用户 ${user.id} - 提取出的可提现 app_id 列表: ${JSON.stringify(withdrawableAppIds)}`,
            );

            if (withdrawableAppIds.length === 0) {
              console.log(
                `[调试] 用户 ${user.id} - 没有可提现的 app_id，跳过此用户。`,
              );
              continue;
            }

            const queryStartTime = new Date(
              new Date().setHours(0, 0, 0, 0) - 24 * 60 * 60 * 1000,
            );
            const queryEndTime = new Date(new Date().setHours(0, 0, 0, 0));
            console.log(
              `[调试] 用户 ${user.id} - 用于查询 eCPM 的时间范围: startTime: ${queryStartTime.toISOString()}, endTime: ${queryEndTime.toISOString()}`,
            );

            const totalResult = await this.ecpmRepository
              .createQueryBuilder('ecpm')
              .select('SUM(ecpm.cost_client)', 'total')
              .where('ecpm.nick_id IN (:...nickIds)', {
                nickIds: user.game_users,
              })
              .andWhere('ecpm.app_id IN (:...appIds)', {
                appIds: withdrawableAppIds,
              })
              .andWhere(
                'ecpm.event_time >= :startTime AND ecpm.event_time < :endTime',
                {
                  startTime: queryStartTime, // 使用这里定义的 queryStartTime
                  endTime: queryEndTime, // 使用这里定义的 queryEndTime
                },
              )
              .getRawOne();
            console.log(
              `[调试] 用户 ${user.id} - eCPM 查询参数: nickIds: ${JSON.stringify(user.game_users)}, appIds: ${JSON.stringify(withdrawableAppIds)}`,
            );
            console.log(
              `[调试] 用户 ${user.id} - eCPM 查询结果 (totalResult): ${JSON.stringify(totalResult)}`,
            );

            const totalAmount = formatCurrency(Number(totalResult?.total || 0));
            console.log(
              `[调试] 用户 ${user.id} - 格式化后的 totalAmount: ${totalAmount}`,
            );

            if (isNaN(totalAmount)) {
              console.error(
                `[调试] 用户 ${user.id} - totalAmount 无效 (NaN): ${totalResult?.total}. 跳过此用户。`,
              );
              continue;
            }
            const addTotal = Number(totalAmount);
            console.log(
              `[调试] 用户 ${user.id} - 准备增加的金额 (addTotal): ${addTotal}`,
            );
            console.log(
              `[调试] 用户 ${user.id} - 更新前 balance: ${user.balance}, total: ${user.total}`,
            );

            const newBalance = Number(Number(user.balance) + addTotal).toFixed(
              2,
            );
            const newTotal = Number(Number(user.total) + addTotal).toFixed(2);
            console.log(
              `[调试] 用户 ${user.id} - 计算后 newBalance: ${newBalance}, newTotal: ${newTotal}`,
            );

            await transactionalEntityManager
              .createQueryBuilder()
              .update(User)
              .set({
                total: newTotal,
                balance: newBalance,
              })
              .where('id = :userId', { userId: user.id })
              .execute();
            console.log(`[调试] 用户 ${user.id} - 数据库更新成功。`);
          }
          console.log('[调试] 所有用户处理完毕，事务准备提交。');
          return '用户收益全部更新完成';
        },
      );
    } catch (error) {
      console.error('[调试] createWithdraw 函数执行失败:', error);
      // 可以在这里加入更详细的错误堆栈打印
      if (error instanceof Error) {
        console.error('[调试] 错误堆栈:', error.stack);
      }
      throw new Error('用户收益更新失败');
    } finally {
      console.log('--- [调试] createWithdraw 函数执行结束 ---');
    }
  }

  async getNickID(open_id: string): Promise<string> {
    const nick_id = await this.gameUserRepository.findOne({
      where: { open_id },
      select: ['nick_id'],
    });
    if (nick_id) {
      return nick_id.nick_id;
    } else {
      throw new InternalServerErrorException('更新错误');
    }
  }

  async getOpenIDS(nick_ids: string[]): Promise<string[]> {
    const users = await this.gameUserRepository.find({
      where: {
        nick_id: In(nick_ids),
      },
      select: ['nick_id', 'open_id'],
    });

    const nickIdToOpenId = new Map(users.map((u) => [u.nick_id, u.open_id]));

    const missingNickIds = nick_ids.filter((id) => !nickIdToOpenId.has(id));
    if (missingNickIds.length) {
      throw new BadRequestException(
        `以下 nick_id 未找到: ${missingNickIds.join(', ')}`,
      );
    }

    return nick_ids.map((id) => nickIdToOpenId.get(id)!);
  }

  async refreshAll() {
    const users = await this.userRepository.find();
    for (const user of users) {
      await this.refreshEcpm({ username: user.nickname });
    }
  }

  async refreshEcpm(refreshEcpmDto: RefreshEcpmDto) {
    const { username } = refreshEcpmDto;
    const user = await this.userRepository.findOne({
      where: { nickname: username },
      select: ['game_users'],
    });
    if (!user || !user.game_users || user.game_users.length === 0) {
      return '用户没有绑定NickID';
    }
    const date = new Date().toLocaleDateString('en-CA'); // 格式为 YYYY-MM-DD
    for (const nick_id of user.game_users) {
      const game_user = await this.gameUserRepository.findOne({
        where: { nick_id },
        select: ['open_id', 'app_id'],
      });
      if (!game_user || !game_user.app_id || !game_user.open_id) {
        throw new BadRequestException('请先绑定NickID');
      }
      await this.create({
        app_id: game_user.app_id,
        open_id: game_user.open_id,
        data_hour: date,
      });
    }
  }

  async refreshGame(app_id: string) {
    const date = new Date().toLocaleDateString('en-CA'); // 格式为 YYYY-MM-DD
    const game_user = await this.gameUserRepository.find({
      where: { app_id },
      select: ['open_id', 'nick_id'],
    });
    if (!game_user) {
      throw new BadRequestException('该游戏暂无用户');
    }
    for (const item of game_user) {
      await this.create({
        app_id: app_id,
        open_id: item.open_id,
        data_hour: date,
      });
    }
  }

  async isDuplicate(app_id: string): Promise<boolean> {
    const getGameRate = await this.gameRepository.findOne({
      where: { app_id },
      select: ['packet_loss_rate'],
    });

    if (getGameRate) {
      const packet_loss_rate = getGameRate.packet_loss_rate;
      if (checkPro(packet_loss_rate)) {
        return true;
      } else {
        return false;
      }
    } else {
      return false;
    }
  }

  async getGameScale(app_id: string): Promise<number> {
    const game = await this.gameRepository.findOne({
      where: { app_id },
      select: ['scale'],
    });
    if (!game) {
      throw new BadRequestException('更新失败，请重试');
    }
    return game.scale;
  }

  async create(ecpmParam: IEcpmReq): Promise<string> {
    const api_ecpm = await this.getEcpm(ecpmParam);
    const custom = await this.comRepository.findOne({
      where: { app_id: envConfig.app_id },
      select: ['isModule', 'proportion'],
    });
    const newEcpmInstances = await Promise.all(
      api_ecpm.map(async (item) => {
        let cost_client: number = 1;
        let is_duplicate = false;
        if (custom) {
          if (custom.isModule) {
            if (item.cost > (await this.getMaxCost())) {
              if (checkProbability(30)) {
                cost_client = Math.round(
                  ((await this.getGameScale(item.app_id)) * item.cost) / 100,
                );
              } else {
                cost_client = 100;
              }
            } else {
              cost_client = Math.round(
                ((await this.getGameScale(item.app_id)) * item.cost) / 100,
              );
              if (await this.isDuplicate(item.app_id)) {
                cost_client = 0;
                is_duplicate = true;
              }
            }
          } else {
            cost_client = createNewCost(item.cost);
          }
        }
        const event_time = new Date(item.event_time);
        const nick_id = await this.getNickID(item.open_id);
        return this.ecpmRepository.create({
          ...item,
          is_duplicate,
          cost_client,
          event_time,
          nick_id,
          ecpm_id: item.id,
        });
      }),
    );
    try {
      // 插入并在 custom_id 冲突时更新 cost 和 cost_client
      await this.ecpmRepository
        .createQueryBuilder()
        .insert()
        .into(Ecpm)
        .values(newEcpmInstances)
        .onConflict('("open_id", "event_time") DO NOTHING')
        .execute();
      return '插入成功';
    } catch (error) {
      Logger.error(`更新ecpm错误${error}`);
      // 判断是否为外键约束错误
      if (
        error.message &&
        error.message.includes('violates foreign key constraint')
      ) {
        // 返回明确的错误信息，提示关联客户不存在或新增客户失败
        throw new InternalServerErrorException('更新失败请重新进入游戏');
      }
      throw new InternalServerErrorException('更新ecpm错误');
    }
  }

  async getEcpm(ecpmParam: IEcpmReq): Promise<IDetail[]> {
    const endpoint =
      'https://ad.e.kuaishou.com/rest/openapi/gw/dsp/v1/report/ecpm_report';
    const date = new Date().toLocaleDateString('en-CA'); // 格式为 YYYY-MM-DD
    if (ecpmParam.data_hour !== date) {
      Logger.error('只允许更新当天数据');
      return [];
    }
    if (!ecpmParam.open_id) {
      Logger.error('open_id 不能为空');
      return [];
    }
    const pageSize = 500;
    let page = 1;
    let allDetails: IDetail[] = [];
    const token = await this.companyService.getToken();
    const headers = {
      'Content-Type': 'application/json',
      'Access-Token': token,
    };

    try {
      while (true) {
        // 构造当前页请求参数
        const param = {
          ...ecpmParam,
          open_id: [ecpmParam.open_id],
          advertiser_id: envConfig.advertiser_id,
          page,
          page_size: pageSize,
        };

        const response$ = this.httpService.post<IEcpmRes>(endpoint, param, {
          headers,
        });
        const response = await lastValueFrom(response$);
        if (response.data.message !== 'OK') {
          Logger.error(`Ecpm 数据抓取失败：${JSON.stringify(response.data)}`);
          throw new InternalServerErrorException(
            `Ecpm 数据抓取失败：${JSON.stringify(response.data)}`,
          );
        } else {
          // 将本页数据合并到结果数组中
          allDetails = allDetails.concat(response.data.data.details);
          if (response.data.data.details.length !== 500) {
            break;
          }
          page++;
        }
      }
      return allDetails.map((item) => ({ ...item, app_id: ecpmParam.app_id }));
    } catch (error: unknown) {
      // 确保捕获并抛出具体错误信息
      if (error instanceof Error) {
        Logger.error(`Ecpm 数据抓取失败：${error.message}`);
        throw new BadRequestException(
          `Ecpm 数据抓取失败：${JSON.stringify(error.message)}`,
        );
      }
      Logger.error(`Ecpm 数据抓取失败：${JSON.stringify(error)}`);
      throw new BadRequestException('Ecpm 数据抓取失败：未知错误');
    }
  }

  async findByGame(data: FindByGameDto): Promise<IEcpmClientRes> {
    const { app_id, page, page_size, start_time, end_time } = data;

    // 参数校验
    if (page < 1 || page_size < 1) {
      throw new InternalServerErrorException('页码和每页数量必须大于0');
    }
    if (start_time >= end_time) {
      throw new InternalServerErrorException('开始时间必须早于结束时间');
    }

    try {
      const query = this.ecpmRepository
        .createQueryBuilder('ecpm')
        .select([
          'ecpm.custom_id',
          'ecpm.app_id',
          'ecpm.cost',
          'ecpm.cost_client',
          'ecpm.event_time',
          'ecpm.open_id',
        ])
        .where('ecpm.app_id = :app_id', { app_id })
        .andWhere('ecpm.event_time BETWEEN :start_time AND :end_time', {
          start_time,
          end_time,
        })
        .andWhere('ecpm.is_duplicate = :is_duplicate', { is_duplicate: false })
        .orderBy('ecpm.event_time', 'DESC')
        .skip((page - 1) * page_size)
        .take(page_size);

      // 获取分页数据和总数
      const [results, total] = await query.getManyAndCount();

      // 计算总和
      const stats = await this.ecpmRepository
        .createQueryBuilder('ecpm')
        .select([
          'SUM(ecpm.cost) AS total_cost',
          'SUM(ecpm.cost_client) AS total_cost_client',
        ])
        .where('ecpm.app_id = :app_id', { app_id })
        .andWhere('ecpm.event_time BETWEEN :start_time AND :end_time', {
          start_time,
          end_time,
        })
        .getRawOne();

      return {
        data: results,
        total,
        totalCost: Number(stats?.total_cost) || 0,
        totalCostClient: Number(stats?.total_cost_client) || 0,
      };
    } catch (error) {
      throw new BadRequestException(`查询失败: ${error.message}`);
    }
  }

  async findByUser(data: FindByUserDto): Promise<IEcpmClientRes> {
    const { open_id, page, page_size, start_time, end_time } = data;

    // 参数校验
    if (page < 1 || page_size < 1) {
      throw new BadRequestException('页码和每页数量必须大于0');
    }
    if (start_time >= end_time) {
      throw new BadRequestException('开始时间必须早于结束时间');
    }

    try {
      const query = this.ecpmRepository
        .createQueryBuilder('ecpm')
        .select([
          'ecpm.custom_id',
          'ecpm.app_id',
          'ecpm.cost',
          'ecpm.cost_client',
          'ecpm.event_time',
          'ecpm.open_id',
        ])
        .where('ecpm.open_id = :open_id', { open_id })
        .andWhere('ecpm.event_time BETWEEN :start_time AND :end_time', {
          start_time,
          end_time,
        })
        .orderBy('ecpm.event_time', 'DESC')
        .skip((page - 1) * page_size)
        .take(page_size);

      // 获取分页数据和总数
      const [results, total] = await query.getManyAndCount();

      // 计算总和
      const stats = await this.ecpmRepository
        .createQueryBuilder('ecpm')
        .select([
          'SUM(ecpm.cost) AS total_cost',
          'SUM(ecpm.cost_client) AS total_cost_client',
        ])
        .where('ecpm.open_id = :open_id', { open_id })
        .andWhere('ecpm.event_time BETWEEN :start_time AND :end_time', {
          start_time,
          end_time,
        })
        .getRawOne();

      return {
        data: results,
        total,
        totalCost: Number(stats?.total_cost) || 0,
        totalCostClient: Number(stats?.total_cost_client) || 0,
      };
    } catch (error) {
      throw new BadRequestException(`查询失败: ${error.message}`);
    }
  }

  async findEcpm(findEcpm: FindEcpmDto): Promise<{
    ecpms: Ecpm[];
    total: number;
    totalCost: number;
    totalCostClient: number;
  }> {
    const startTime = findEcpm.start_time;
    const endTime = findEcpm.end_time;
    const nickId = findEcpm.nick_id || findEcpm['nick_id'];

    const userIdentity = await this.userRepository.findOne({
      where: { nickname: findEcpm.username },
    });
    let queryCondition = '';
    let params: any[] = [];

    // 如果用户身份为 admin 或 ahaotriple，不添加 nick_id 条件
    if (
      userIdentity?.identity === 'admin' ||
      userIdentity?.identity === 'ahaotriple' ||
      userIdentity?.identity === 'lion' ||
      userIdentity?.identity === 'super'
    ) {
      if (nickId && nickId.trim() !== '' && nickId != findEcpm.username) {
        if (nickId.length === 11) {
          const user = await this.userRepository.findOne({
            where: { nickname: nickId },
            select: ['game_users'],
          });
          if (!user || !user.game_users?.length) {
            throw new InternalServerErrorException(
              `请先绑定NickID${findEcpm.username}`,
            );
          }
          queryCondition = `"nick_id" IN (${user.game_users
            .map((_, i) => `$${i + 1}`)
            .join(', ')})`;
          params = user.game_users;
        } else {
          // 如果 nick_id 不为空，则直接使用
          queryCondition = `"nick_id" = $1`;
          params = [nickId];
        }
      } else {
        queryCondition = '1=1';
      }
    } else {
      if (nickId && nickId.trim() !== '') {
        if (nickId.length === 11) {
          const user = await this.userRepository.findOne({
            where: { nickname: nickId },
            select: ['game_users'],
          });
          if (!user || !user.game_users?.length) {
            throw new InternalServerErrorException(
              `请先绑定NickID${findEcpm.username}`,
            );
          }
          queryCondition = `"nick_id" IN (${user.game_users
            .map((_, i) => `$${i + 1}`)
            .join(', ')})`;
          params = user.game_users;
        } else {
          // 如果 nick_id 不为空，则直接使用
          queryCondition = `"nick_id" = $1`;
          params = [nickId];
        }
      } else {
        // 否则通过 username 查询绑定的 game_users
        const user = await this.userRepository.findOne({
          where: { nickname: findEcpm.username },
          select: ['game_users'],
        });
        if (!user || !user.game_users?.length) {
          throw new InternalServerErrorException(
            `请先绑定NickID${findEcpm.username}`,
          );
        }
        queryCondition = `"nick_id" IN (${user.game_users
          .map((_, i) => `$${i + 1}`)
          .join(', ')})`;
        params = user.game_users;
      }
    }

    // 构造查询条件的参数下标
    const baseIndex = params.length; // admin 情况下为 0，其他情况根据条件确定
    const appIdIndex = baseIndex + 1;
    const startTimeIndex = baseIndex + 2;
    const endTimeIndex = baseIndex + 3;
    const limitIndex = baseIndex + 4;
    const offsetIndex = baseIndex + 5;

    const rawQuery = `
      SELECT "custom_id", "app_id", "cost", "cost_client", "event_time", "open_id", "nick_id"
      FROM "ecpm"
      WHERE ${queryCondition}
        AND "app_id" = $${appIdIndex}
        AND "event_time" >= $${startTimeIndex}
        AND "event_time" <= $${endTimeIndex}
        AND "is_duplicate" = FALSE
        AND "cost_client" > 0
      ORDER BY "event_time" DESC LIMIT $${limitIndex}
      OFFSET $${offsetIndex}
    `;
    params.push(
      findEcpm.app_id,
      startTime,
      endTime,
      findEcpm.page_size,
      (findEcpm.page - 1) * findEcpm.page_size,
    );

    // 查询记录数据
    const ecpmRecords: any = await this.ecpmRepository.manager.query(
      rawQuery,
      params,
    );

    // 构造统计查询参数，此处不需要 LIMIT 和 OFFSET，因此移除最后两个参数
    const statsParams = params.slice(0, -2);
    const statsQuery = `
      SELECT COUNT(*) AS total, SUM("cost") AS "totalCost", SUM("cost_client") AS "totalCostClient"
      FROM "ecpm"
      WHERE ${queryCondition}
        AND "app_id" = $${appIdIndex}
        AND "event_time" >= $${startTimeIndex}
        AND "event_time" <= $${endTimeIndex}
        AND "cost_client" > 0
    `;
    const stats = await this.ecpmRepository.manager.query(
      statsQuery,
      statsParams,
    );

    return {
      ecpms: ecpmRecords,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      total: parseInt(stats[0].total) || 0,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      totalCost: parseInt(stats[0].totalCost) || 0,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      totalCostClient: parseInt(stats[0].totalCostClient) || 0,
    };
  }

  async deleteEcpm(nickname: string) {
    const user = await this.userRepository.findOne({
      where: { nickname },
      select: ['game_users'],
    });
    if (!user) {
      throw new InternalServerErrorException('用户不存在');
    }
    const open_ids = await this.getOpenIDS(user.game_users);
    for (const open_id of open_ids) {
      await this.ecpmRepository.delete({ open_id });
    }
    return '删除成功';
  }

  async deleteAllGame(date: string): Promise<void> {
    const games = await this.gameRepository.find();
    for (const game of games) {
      if (!game.app_id) {
        continue;
      }
      await this.deleteGame({ app_id: game.app_id, date });
    }
  }

  async deleteGame(deleteGameDto: DeleteGameDto): Promise<void> {
    const { app_id, date } = deleteGameDto;
    try {
      await this.ecpmRepository
        .createQueryBuilder()
        .delete()
        .from(Ecpm)
        .where('app_id = :app_id AND DATE(event_time) = :date', {
          app_id,
          date,
        })
        .execute();
    } catch (error) {
      Logger.error(
        `Error deleting data for app_id: ${app_id} on date: ${date}`,
        error,
      );
      throw error;
    }
  }

  async maxCost(max_cost: number) {
    const result = await this.comRepository.update(
      { app_id: envConfig.app_id },
      { max_cost: max_cost },
    );
    if (result.affected === 0) {
      throw new InternalServerErrorException('更新失败');
    }
    Logger.log(`修改完成 max_cost: ${max_cost}`);
    return '更新成功';
  }

  async getMaxCost(): Promise<number> {
    const result = await this.comRepository.findOne({
      where: { app_id: envConfig.app_id },
      select: ['max_cost'],
    });
    if (!result) {
      throw new InternalServerErrorException('获取失败');
    }
    return Number(result.max_cost);
  }

  async pushEcpm(
    pushEcpm: PushEcpmDto,
  ): Promise<{ message: string; count: number }> {
    const { date, min, max, nick_id, app_id } = pushEcpm;
    const game_user = await this.gameUserRepository.findOne({
      where: { nick_id: nick_id },
    });
    if (!game_user) {
      throw new BadRequestException('没有该nick_id');
    }
    const game = await this.gameRepository.findOne({
      where: { app_id: app_id },
    });
    if (!game) {
      throw new BadRequestException('没有该游戏');
    }

    // 返回的是 cost和 event_time cost_client= cost * 0.5
    const new_ecpm = generateRandomTransactions(date, min, max);
    console.log(new_ecpm);

    // 启动数据库事务，将生成的数据存入ecpm表
    return await this.ecpmRepository.manager.transaction(
      async (transactionalEntityManager) => {
        const ecpmInstances = new_ecpm.map((transaction) => {
          const ecpm = new Ecpm();
          ecpm.app_id = app_id;
          ecpm.cost = transaction.amount;
          ecpm.cost_client = Math.round(
            (transaction.amount * game.scale) / 100,
          ); // cost_client = cost * 0.5
          ecpm.event_time = new Date(transaction.time);
          ecpm.open_id = game_user.open_id;
          ecpm.nick_id = nick_id;
          ecpm.is_duplicate = false;
          ecpm.ecpm_id = `push_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          return ecpm;
        });

        try {
          // 批量插入数据
          await transactionalEntityManager
            .createQueryBuilder()
            .insert()
            .into(Ecpm)
            .values(ecpmInstances)
            .onConflict('("open_id", "event_time") DO NOTHING')
            .execute();

          Logger.log(`成功插入 ${ecpmInstances.length} 条ecpm记录`);
          return {
            message: '数据插入成功',
            count: ecpmInstances.length,
            // data: new_ecpm,
          };
        } catch (error) {
          Logger.error(`插入ecpm数据失败: ${error.message}`);
          throw new InternalServerErrorException('插入ecpm数据失败');
        }
      },
    );
  }
}
