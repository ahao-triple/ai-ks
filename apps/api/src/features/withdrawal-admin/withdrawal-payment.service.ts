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
  PrincipalType,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

type WithdrawalPaymentPrisma = Pick<
  PrismaService,
  '$transaction' | 'agent' | 'userAccount' | 'withdrawalBatch' | 'withdrawalDetail'
>;

export type PaidWithdrawalBatch = WithdrawalBatch & {
  details: WithdrawalDetail[];
};

export type PayWithdrawalBatchInput = {
  batchId: string;
  mockResult?: 'failed' | 'success';
};

export type CloseFailedWithdrawalBatchInput = {
  batchId: string;
};

@Injectable()
export class WithdrawalPaymentService {
  constructor(
    @Inject(PrismaService) private readonly prisma: WithdrawalPaymentPrisma,
  ) {}

  async payBatch(input: PayWithdrawalBatchInput): Promise<PaidWithdrawalBatch> {
    return this.prisma.$transaction(async (tx) => {
      const batch = await tx.withdrawalBatch.findUnique({
        include: {
          details: true,
        },
        where: {
          id: input.batchId,
        },
      });

      if (!batch) {
        throw new NotFoundException(`Withdrawal batch ${input.batchId} is not found`);
      }

      if (batch.status !== 'APPROVED') {
        throw new BadRequestException('只有已审核提现批次可以打款');
      }

      const nextDetailStatus =
        input.mockResult === 'failed'
          ? WithdrawalDetailStatus.FAILED
          : WithdrawalDetailStatus.PAID;
      const nextBatchStatus =
        input.mockResult === 'failed' ? 'FAILED' : 'PAID';
      const mockStatus = input.mockResult === 'failed' ? 'failed' : 'success';

      await tx.withdrawalDetail.updateMany({
        data: {
          alipayResponseSnapshot: {
            mode: 'mock',
            status: mockStatus,
          },
          errorCode:
            input.mockResult === 'failed' ? 'MOCK_PAYMENT_FAILED' : null,
          errorMessage:
            input.mockResult === 'failed' ? 'Mock payment failed' : null,
          status: nextDetailStatus,
        },
        where: {
          batchId: input.batchId,
          status: WithdrawalDetailStatus.APPROVED,
        },
      });

      const paid = await tx.withdrawalBatch.update({
        data: {
          status: nextBatchStatus,
        },
        include: {
          details: true,
        },
        where: {
          id: input.batchId,
        },
      });

      return paid as PaidWithdrawalBatch;
    });
  }

  async closeFailedBatch(
    input: CloseFailedWithdrawalBatchInput,
  ): Promise<PaidWithdrawalBatch> {
    return this.prisma.$transaction(async (tx) => {
      const batch = await tx.withdrawalBatch.findUnique({
        include: {
          details: true,
        },
        where: {
          id: input.batchId,
        },
      });

      if (!batch) {
        throw new NotFoundException(`Withdrawal batch ${input.batchId} is not found`);
      }

      if (batch.status !== 'FAILED') {
        throw new BadRequestException('只有失败提现批次可以关闭并退回');
      }

      let refunded: { count: number };
      if (batch.ownerType === PrincipalType.AGENT && batch.ownerId) {
        refunded = await tx.agent.updateMany({
          data: {
            availableBalanceLi: {
              increment: batch.totalAmountLi,
            },
            frozenBalanceLi: {
              decrement: batch.totalAmountLi,
            },
          },
          where: {
            frozenBalanceLi: {
              gte: batch.totalAmountLi,
            },
            id: batch.ownerId,
          },
        });
      } else {
        if (!batch.userId) {
          throw new BadRequestException('提现批次缺少用户归属，无法关闭批次');
        }
        refunded = await tx.userAccount.updateMany({
          data: {
            availableBalanceLi: {
              increment: batch.totalAmountLi,
            },
            frozenBalanceLi: {
              decrement: batch.totalAmountLi,
            },
          },
          where: {
            frozenBalanceLi: {
              gte: batch.totalAmountLi,
            },
            id: batch.userId,
          },
        });
      }

      if (refunded.count !== 1) {
        throw new BadRequestException('冻结余额不足，无法关闭批次');
      }

      await tx.withdrawalDetail.updateMany({
        data: {
          status: WithdrawalDetailStatus.CLOSED,
        },
        where: {
          batchId: input.batchId,
          status: WithdrawalDetailStatus.FAILED,
        },
      });

      const closed = await tx.withdrawalBatch.update({
        data: {
          status: 'CLOSED',
        },
        include: {
          details: true,
        },
        where: {
          id: input.batchId,
        },
      });

      return closed as PaidWithdrawalBatch;
    });
  }
}
