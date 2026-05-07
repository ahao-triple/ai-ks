import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/user/user.entity';
import { Repository, QueryRunner } from 'typeorm';
import { WithdrawEntity } from './withdraw.entity';
import { AddWithdrawDto } from './dto/add-withdraw.dto';
import { AlipayService } from 'src/alipay/alipay.serveice';
import { RejectWithdrawDto } from './dto/reject-withdraw.dto';
import { Acting } from 'src/acting/acting.entity';
import { envConfig } from 'src/config/config';
import { Company } from 'src/company/company.entity';

@Injectable()
export class WithdrawService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(WithdrawEntity)
    private readonly withdrawRepository: Repository<WithdrawEntity>,
    @InjectRepository(Acting)
    private readonly actingRepository: Repository<Acting>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    private readonly alipayService: AlipayService,
  ) {}

  /**
   * 根据用户 nickname 获取用户提现信息
   * @param nickname
   * @returns
   */
  async getWithdrawList(nickname: string): Promise<WithdrawEntity[]> {
    const user = await this.userRepository.findOne({ where: { nickname } });
    if (!user) {
      throw new BadRequestException('该用户提现记录不存在');
    }
    const withdrawList = await this.withdrawRepository.find({
      where: { nickname: user.nickname },
    });
    return withdrawList;
  }

  /**
   * 新增提现记录
   * @param addWithdrawDto
   */
  async addWithdraw(addWithdrawDto: AddWithdrawDto) {
    const { nickname, amount, remark } = addWithdrawDto;
    const user = await this.userRepository.findOne({ where: { nickname } });
    if (!user) {
      throw new BadRequestException('该用户不存在');
    }
    if (!user.withdraw_info) {
      Logger.warn(`请先提交提现信息${JSON.stringify(user)}`);
      throw new BadRequestException('请先提交提现信息');
    }
    if (user.balance < amount) {
      throw new BadRequestException('余额不足');
    }

    try {
      const withdraw = new WithdrawEntity();
      withdraw.nickname = nickname;
      withdraw.amount = amount;
      withdraw.remark = remark;
      withdraw.created_at = new Date();
      withdraw.status = WithdrawEntity.STATUS_EMNU.PENDING;
      await this.withdrawRepository.save(withdraw);
      user.frozen = Number(amount) + Number(user.frozen);
      user.balance = Number(user.balance) - Number(amount);
      await this.userRepository.save(user);
      return withdraw;
    } catch (e) {
      Logger.error(`提现失败: ${e}`);
      throw new InternalServerErrorException('提现失败');
    }
  }

  /**
   * 系统内部审核提现需求
   * @param param
   * @returns
   */
  async withdrawal(param: any) {
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log('withdrawal', param);
        resolve('done');
      }, 1000);
    });
  }

  async rollback(id: number) {
    const withdraw = await this.withdrawRepository.findOne({ where: { id } });
    if (!withdraw) {
      throw new BadRequestException('该提现记录不存在');
    }
    const newWithdraw = this.withdrawRepository.create({
      nickname: withdraw.nickname,
      amount: withdraw.amount,
      status: WithdrawEntity.STATUS_EMNU.PENDING,
      created_at: new Date(),
      acting_status: 1,
      fee_status: 1,
      remark:
        (withdraw.remark ?? '') +
        '（由记录 #' +
        withdraw.id +
        ' 回退重新发起）',
    });
    withdraw.status = WithdrawEntity.STATUS_EMNU.REDUNDANCE;
    withdraw.end_at = new Date();
    withdraw.remark = withdraw.remark + '  提现冗余';
    withdraw.acting_status = 1;
    withdraw.fee_status = 1;
    await this.withdrawRepository.save(newWithdraw);
    await this.withdrawRepository.save(withdraw);
    return withdraw;
  }

  async getAllWithdraw(status: number) {
    try {
      const withdrawList = await this.withdrawRepository.find({
        where: { status: status },
      });
      return withdrawList;
    } catch (e) {
      Logger.error(`获取提现记录失败: ${e}`);
      throw new InternalServerErrorException('获取提现记录失败');
    }
  }

  /**
   * 处理手续费打款
   * @param id 提现记录id
   */
  async pay_fee(id: number) {
    try {
      const withdraw = await this.withdrawRepository.findOne({ where: { id } });
      Logger.log(`手续费：${JSON.stringify(withdraw)} `);
      if (!withdraw) {
        throw new BadRequestException('该提现记录不存在');
      }
      if (withdraw.fee_status === 1) {
        Logger.log('该手续费已经支付过了');
        return 'success';
      }
      const user = await this.userRepository.findOne({
        where: { nickname: withdraw.nickname },
      });
      if (!user) {
        throw new BadRequestException('该提现用户不存在');
      }
      const fee_pays = await this.actingRepository.find({
        where: { acting_level: 0 },
      });
      if (!fee_pays) {
        throw new BadRequestException('手续费打款配置不存在');
      }
      for (const [index, fee_pay] of fee_pays.entries()) {
        const fee_amount = Number(
          (Number(withdraw.amount) * Number(fee_pay.scale)) / 100,
        ).toFixed(2);

        await this.alipayService.approveWithdraw({
          id: String(id) + 'fee' + index,
          amount: parseFloat(fee_amount),
          alipay: fee_pay.acting_alipay_login,
          name: fee_pay.acting_alipay_name,
          scale: 1,
          tips: envConfig.name + '手续费',
        });

        // 延迟 1 秒（除最后一个）
        if (index < fee_pays.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
      withdraw.fee_status = 1;
      await this.withdrawRepository.save(withdraw);
      Logger.warn(`手续费打款成功: ${JSON.stringify(withdraw)}`);
      return 'success';
    } catch (e) {
      Logger.error(`手续费打款失败: ${e}`);
      await this.rollback(id);
      throw new InternalServerErrorException('手续费打款失败');
    }
  }

  async pay_acting(id: number) {
    try {
      const withdraw = await this.withdrawRepository.findOne({ where: { id } });
      if (!withdraw) {
        throw new BadRequestException('该提现记录不存在');
      }
      if (withdraw.acting_status === 1) {
        Logger.log('该手续费已经支付过了');
        return 'success';
      }
      const user = await this.userRepository.findOne({
        where: { nickname: withdraw.nickname },
      });
      if (!user) {
        throw new BadRequestException('该提现用户不存在');
      }
      const acting = await this.actingRepository.findOne({
        where: { acting_id: user.acting_id },
      });
      const company = await this.companyRepository.findOne({
        where: { app_id: envConfig.app_id },
      });
      if (!company) {
        throw new BadRequestException('公司信息不存在');
      }
      if (company.isActing === 0) {
        Logger.log('用户暂无代理不处理');
        return 'success';
      }
      if (!acting) {
        Logger.log('用户暂无代理 使用默认代理处理');
        const acting = await this.actingRepository.findOne({
          where: { main_acting: true },
        });
        if (!acting) {
          throw new BadRequestException('代理信息不存在');
        }
        const acting_amount = Number(
          (Number(withdraw.amount) * acting.scale) / 100,
        ).toFixed(2);
        await this.alipayService.approveWithdraw({
          id: String(id) + 'acting',
          amount: parseFloat(acting_amount),
          alipay: acting.acting_alipay_login,
          name: acting.acting_alipay_name,
          scale: 1,
          tips: envConfig.name + '代理分成',
        });

        const acting_top = await this.actingRepository.findOne({
          where: { acting_id: '888888' },
        });
        if (!acting_top) {
          Logger.log('用户暂无上级代理不处理');
        } else {
          const acting_top_amount = Number(
            (Number(withdraw.amount) * 10) / 100,
          ).toFixed(2);
          await this.alipayService.approveWithdraw({
            id: String(id) + 'acting_top',
            amount: parseFloat(acting_top_amount),
            alipay: acting_top.acting_alipay_login,
            name: acting_top.acting_alipay_name,
            scale: 1,
            tips: envConfig.name + '代理分成',
          });
        }
      } else {
        const acting_amount = Number(
          (Number(withdraw.amount) * Number(acting.scale)) / 100,
        ).toFixed(2);
        await this.alipayService.approveWithdraw({
          id: String(id) + 'acting',
          amount: parseFloat(acting_amount),
          alipay: acting.acting_alipay_login,
          name: acting.acting_alipay_name,
          tips: envConfig.name + '代理分成',
          scale: 1,
        });

        await new Promise((resolve) => setTimeout(resolve, 1000));

        const acting_top = await this.actingRepository.findOne({
          where: { acting_id: acting.acting_top_id },
        });
        if (!acting_top) {
          Logger.log('用户暂无上级代理不处理');
        } else {
          const acting_top_amount = Number(
            (Number(withdraw.amount) * Number(acting_top.scale)) / 100,
          ).toFixed(2);
          await this.alipayService.approveWithdraw({
            id: String(id) + 'acting_top',
            amount: parseFloat(acting_top_amount),
            alipay: acting_top.acting_alipay_login,
            name: acting_top.acting_alipay_name,
            scale: 1,
            tips: envConfig.name + '代理分成',
          });
        }
      }
      withdraw.acting_status = 1;
      await this.withdrawRepository.save(withdraw);
      Logger.warn(`代理分成打款成功: ${JSON.stringify(withdraw)}`);
      return 'success';
    } catch (e) {
      Logger.error(`代理分成打款失败: ${e}`);
      throw new InternalServerErrorException('代理分成打款失败');
    }
  }

  async approve(ids: number[]) {
    try {
      // await this.withdrawRepository.find();
      const results = await Promise.all(
        ids.map(async (id: number) => {
          /**
           * 定义返回的数据结构
           */
          const client_result = {
            message: 'success',
            id: id,
          };
          /**
           * 判断该提现记录是否存在
           */
          const withdraw = await this.withdrawRepository.findOne({
            where: { id },
          });
          if (!withdraw) {
            client_result.message = '该提现记录不存在';
            return client_result;
          }
          /**
           * 判断该提现用户是否存在
           */
          const user = await this.userRepository.findOne({
            where: { nickname: withdraw.nickname },
          });
          Logger.warn(
            `user: ${JSON.stringify(user?.nickname)}${JSON.stringify(user?.frozen)}`,
          );
          if (!user) {
            client_result.message = '该提现用户不存在';
            withdraw.status = WithdrawEntity.STATUS_EMNU.FAIL;
            withdraw.end_at = new Date();
            withdraw.remark = client_result.message;
            await this.withdrawRepository.save(withdraw);
            return client_result;
          }
          if (user.identity === 'blacklist') {
            client_result.message = '该用户已被拉黑';
            withdraw.status = WithdrawEntity.STATUS_EMNU.FAIL;
            withdraw.end_at = new Date();
            withdraw.remark = client_result.message;
            await this.withdrawRepository.save(withdraw);
            return client_result;
          }
          /**
           * 判断该提现记录是否已经处理过了
           */
          if (withdraw.status !== WithdrawEntity.STATUS_EMNU.PENDING) {
            client_result.message = '该提现记录已经处理过了';
            throw new BadRequestException('该提现记录已经处理过了');
          }
          /**
           * 判断提现金额是否正确
           */
          if (Number(user.frozen) < Number(withdraw.amount)) {
            Logger.warn(
              `用户冻结金额不足: ${JSON.stringify(user?.frozen)}${JSON.stringify(
                withdraw.amount,
              )}
              ${typeof user.frozen}${typeof withdraw.amount}`,
            );
            client_result.message =
              '该账单金额错误，请联系管理员' + user.frozen + withdraw.amount;
            withdraw.status = WithdrawEntity.STATUS_EMNU.FAIL;
            withdraw.end_at = new Date();
            withdraw.remark = client_result.message;
            await this.withdrawRepository.save(withdraw);
            return client_result;
          }
          /**
           * 处理手续费打款
           */
          await this.pay_fee(id);

          /**
           * 处理代理分成打款
           */
          await this.pay_acting(id);

          /**
           * 计算用户结算比例
           */
          const acing_list = await this.actingRepository.find({
            select: ['withdraw_type', 'scale'],
          });

          let client_scale = 1;

          if (acing_list.length === 0) {
            Logger.warn('未配置有效的代理分成');
          } else {
            // 计算 withdraw_type === 1 的 scale 百分比总和（转为小数）
            const totalScale = acing_list
              .filter((item) => item.withdraw_type === 1)
              .reduce((sum, item) => sum + item.scale / 100, 0);

            // 计算剩余比例（防止为负）
            client_scale = Math.max(0, 1 - totalScale);

            if (totalScale === 0) {
              Logger.warn(`客户结算比例为100%`, client_scale);
            }
          }

          /**
           * 开始处理客户转账
           */
          client_result.message = await this.alipayService.approveWithdraw({
            id: String(id),
            amount: withdraw.amount,
            alipay: user.withdraw_info.alipay,
            name: user.withdraw_info.name,
            tips: envConfig.name + '提现',
            scale: client_scale,
          });
          console.log('支付宝返回信息 ', client_result.message);
          if (client_result.message === 'success') {
            withdraw.status = WithdrawEntity.STATUS_EMNU.SUCCESS;
            withdraw.end_at = new Date();
            await this.withdrawRepository.save(withdraw);
            user.frozen = Number(user.frozen) - Number(withdraw.amount);
            user.withdraw_dt = new Date();
            user.withdraw_total =
              Number(user.withdraw_total) + Number(withdraw.amount);
            await this.userRepository.save(user);
          } else {
            // 修改订单状态
            withdraw.status = WithdrawEntity.STATUS_EMNU.FAIL;
            withdraw.end_at = new Date();
            withdraw.remark = client_result.message;
            withdraw.acting_status = 1;
            withdraw.fee_status = 1;
            await this.withdrawRepository.save(withdraw);
            Logger.warn(`提现失败，修改订单状态: ${JSON.stringify(withdraw)}`);
          }
          await this.userRepository.save(user);
          return client_result;
        }),
      );
      return results;
    } catch (e) {
      Logger.error(`审核提现记录失败: ${e}`);
      throw new InternalServerErrorException('审核提现记录失败');
    }
  }

  /**
   * 被拒绝的打款将无法再发起打款
   * @param rejectDto
   * @returns
   */
  async withdrawReject(rejectDto: RejectWithdrawDto): Promise<boolean> {
    const { id, remark } = rejectDto;
    const db_result = await this.withdrawRepository.findOne({ where: { id } });
    if (!db_result) {
      throw new BadRequestException('该提现记录不存在');
    }
    const user = await this.userRepository.findOne({
      where: { nickname: db_result.nickname },
    });
    if (!user) {
      throw new BadRequestException('该用户不存在');
    }
    if (db_result.status !== WithdrawEntity.STATUS_EMNU.PENDING) {
      throw new BadRequestException('该提现记录已经处理过了');
    }
    db_result.status = WithdrawEntity.STATUS_EMNU.REJECT;
    db_result.end_at = new Date();
    db_result.remark = remark + '该账单被拒绝已作废';
    // 冻结金额减去提现金额
    user.frozen = Number(user.frozen) - Number(db_result.amount);
    // 总金额减去提现金额
    user.total = Number(user.total) - Number(db_result.amount);
    await this.userRepository.save(user);
    await this.withdrawRepository.save(db_result);
    return true;
  }

  /**
   * 只处理系统内部审核失败的提现记录 (也就是未成功打款版本)
   * @param id 提现记录id
   */
  async fallback(id: number): Promise<boolean> {
    const db_result = await this.withdrawRepository.findOne({ where: { id } });
    if (!db_result) {
      throw new BadRequestException('该提现记录不存在');
    }
    const user = await this.userRepository.findOne({
      where: { nickname: db_result.nickname },
    });
    if (!user) {
      throw new BadRequestException('该用户不存在');
    }
    if (db_result.status !== WithdrawEntity.STATUS_EMNU.FAIL) {
      throw new BadRequestException('该提现记录已经处理过了');
    }
    db_result.status = WithdrawEntity.STATUS_EMNU.PENDING;
    db_result.end_at = new Date();
    db_result.remark = '该账单系统内部审核失败，已重新发起审核';
    await this.withdrawRepository.save(db_result);
    return true;
  }

  /**
   * 清空提现表
   */
  async clearWithdraw(queryRunner?: QueryRunner): Promise<boolean> {
    try {
      if (queryRunner) {
        // 在事务中执行
        await queryRunner.manager
          .createQueryBuilder()
          .delete()
          .from(WithdrawEntity)
          .execute();
      } else {
        // 独立执行
        await this.withdrawRepository
          .createQueryBuilder()
          .delete()
          .from(WithdrawEntity)
          .execute();
      }
      return true;
    } catch (error) {
      Logger.error(`清空提现表失败: ${error}`);
      throw new InternalServerErrorException('清空提现表失败');
    }
  }
}
