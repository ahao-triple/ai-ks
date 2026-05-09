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
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { type AdminReadScope } from '../admin-auth/admin-access-control.service';

type WithdrawalReviewPrisma = Pick<
  PrismaService,
  '$transaction' | 'withdrawalBatch' | 'withdrawalDetail'
>;

export type WithdrawalBatchWithDetails = WithdrawalBatch & {
  details: WithdrawalDetail[];
};

export type ListWithdrawalBatchesInput = {
  readScope: AdminReadScope;
  status?: string;
};

export type ApproveWithdrawalBatchInput = {
  batchId: string;
};

@Injectable()
export class WithdrawalReviewService {
  constructor(
    @Inject(PrismaService) private readonly prisma: WithdrawalReviewPrisma,
  ) {}

  async listBatches(
    input: ListWithdrawalBatchesInput,
  ): Promise<WithdrawalBatchWithDetails[]> {
    if (!input.readScope.isSuperAdmin) {
      return [];
    }

    const batches = await this.prisma.withdrawalBatch.findMany({
      include: {
        details: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      where: input.status
        ? {
            status: input.status,
          }
        : undefined,
    });

    return batches as WithdrawalBatchWithDetails[];
  }

  async approveBatch(
    input: ApproveWithdrawalBatchInput,
  ): Promise<WithdrawalBatchWithDetails> {
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

      if (batch.status !== 'PENDING_REVIEW') {
        throw new BadRequestException('只有待审核提现批次可以审核通过');
      }

      await tx.withdrawalDetail.updateMany({
        data: {
          status: WithdrawalDetailStatus.APPROVED,
        },
        where: {
          batchId: input.batchId,
          status: WithdrawalDetailStatus.PENDING_REVIEW,
        },
      });

      const approved = await tx.withdrawalBatch.update({
        data: {
          status: 'APPROVED',
        },
        include: {
          details: true,
        },
        where: {
          id: input.batchId,
        },
      });

      return approved as WithdrawalBatchWithDetails;
    });
  }
}
