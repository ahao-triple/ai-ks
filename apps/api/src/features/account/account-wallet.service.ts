import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type WithdrawalBatch,
  type WithdrawalDetail,
  WithdrawalDetailStatus,
  WithdrawalDetailType,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

type WalletPrisma = Pick<
  PrismaService,
  '$transaction' | 'userAccount' | 'withdrawalBatch'
>;

export type UpdateAlipayProfileInput = {
  alipayAccount: string;
  alipayRealName: string;
  userId: string;
};

export type RequestWithdrawalInput = {
  amountLi: bigint;
  userId: string;
};

export type AccountWithdrawal = WithdrawalBatch & {
  details: WithdrawalDetail[];
};

@Injectable()
export class AccountWalletService {
  constructor(@Inject(PrismaService) private readonly prisma: WalletPrisma) {}

  async getAlipayProfile(userId: string) {
    const user = await this.findUserOrThrow(userId);

    return {
      alipayAccount: user.alipayAccount,
      alipayRealName: user.alipayRealName,
    };
  }

  async updateAlipayProfile(input: UpdateAlipayProfileInput) {
    const user = await this.prisma.userAccount.update({
      data: {
        alipayAccount: input.alipayAccount,
        alipayRealName: input.alipayRealName,
      },
      where: {
        id: input.userId,
      },
    });

    return {
      alipayAccount: user.alipayAccount,
      alipayRealName: user.alipayRealName,
    };
  }

  async requestWithdrawal(
    input: RequestWithdrawalInput,
  ): Promise<AccountWithdrawal> {
    if (input.amountLi <= 0n) {
      throw new BadRequestException('提现金额必须大于 0');
    }

    const user = await this.findUserOrThrow(input.userId);
    if (!user.alipayAccount || !user.alipayRealName) {
      throw new BadRequestException('请先维护支付宝收款信息');
    }
    const recipientAlipay = user.alipayAccount;
    const recipientName = user.alipayRealName;

    const withdrawal = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.userAccount.updateMany({
        data: {
          availableBalanceLi: {
            decrement: input.amountLi,
          },
          frozenBalanceLi: {
            increment: input.amountLi,
          },
        },
        where: {
          availableBalanceLi: {
            gte: input.amountLi,
          },
          id: input.userId,
        },
      });

      if (updated.count !== 1) {
        throw new BadRequestException('可提现余额不足');
      }

      return tx.withdrawalBatch.create({
        data: {
          status: 'PENDING_REVIEW',
          totalAmountLi: input.amountLi,
          userId: input.userId,
          details: {
            create: [
              {
                amountLi: input.amountLi,
                configSnapshot: {
                  source: 'account_withdrawal_mvp',
                },
                recipientAlipay,
                recipientName,
                status: WithdrawalDetailStatus.PENDING_REVIEW,
                type: WithdrawalDetailType.USER,
              },
            ],
          },
        },
        include: {
          details: true,
        },
      });
    });

    return withdrawal as AccountWithdrawal;
  }

  private async findUserOrThrow(userId: string) {
    const user = await this.prisma.userAccount.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} is not found`);
    }

    return user;
  }
}
