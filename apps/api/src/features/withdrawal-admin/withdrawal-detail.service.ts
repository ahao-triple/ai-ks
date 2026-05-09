import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type AuditLog,
  type WithdrawalBatch,
  type WithdrawalDetail,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { type AdminReadScope } from '../admin-auth/admin-access-control.service';

type WithdrawalDetailPrisma = Pick<
  PrismaService,
  'auditLog' | 'withdrawalBatch'
>;

export type WithdrawalBatchDetail = WithdrawalBatch & {
  details: WithdrawalDetail[];
};

export type GetWithdrawalBatchDetailInput = {
  batchId: string;
  readScope: AdminReadScope;
};

export type WithdrawalBatchDetailResult = {
  auditLogs: AuditLog[];
  batch: WithdrawalBatchDetail;
};

@Injectable()
export class WithdrawalDetailService {
  constructor(
    @Inject(PrismaService) private readonly prisma: WithdrawalDetailPrisma,
  ) {}

  async getBatchDetail(
    input: GetWithdrawalBatchDetailInput,
  ): Promise<WithdrawalBatchDetailResult> {
    if (!input.readScope.isSuperAdmin) {
      throw new ForbiddenException('无权限访问该操作');
    }

    const batch = await this.prisma.withdrawalBatch.findUnique({
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

    const auditLogs = await this.prisma.auditLog.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      where: {
        targetId: input.batchId,
        targetType: 'withdrawal_batch',
      },
    });

    return {
      auditLogs,
      batch: batch as WithdrawalBatchDetail,
    };
  }
}
