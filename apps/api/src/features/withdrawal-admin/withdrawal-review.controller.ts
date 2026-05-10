import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { AdminAccessControlService } from '../admin-auth/admin-access-control.service';
import {
  type AdminPrincipal,
  type SuperAdminPrincipal,
  requireSuperAdminPrincipal,
} from '../admin-auth/admin-auth.service';
import { AdminJwtGuard } from '../admin-auth/admin-jwt.guard';
import { CurrentAdmin } from '../admin-auth/current-admin.decorator';
import { SuperAdminGuard } from '../admin-auth/super-admin.guard';
import { AuditLogService } from '../audit/audit-log.service';
import { presentMoneyLi } from '../../common/presenters/money-presenter';
import {
  type WithdrawalBatchDetailResult,
  WithdrawalDetailService,
} from './withdrawal-detail.service';
import { WithdrawalPaymentService } from './withdrawal-payment.service';
import {
  type WithdrawalBatchWithDetails,
  WithdrawalReviewService,
} from './withdrawal-review.service';

const payWithdrawalSchema = z.object({
  mockResult: z.enum(['failed', 'success']).optional(),
});

@Controller('admin/withdrawals')
@UseGuards(AdminJwtGuard)
export class WithdrawalReviewController {
  constructor(
    private readonly adminAccessControlService: AdminAccessControlService,
    private readonly auditLogService: AuditLogService,
    private readonly withdrawalDetailService: WithdrawalDetailService,
    private readonly withdrawalPaymentService: WithdrawalPaymentService,
    private readonly withdrawalReviewService: WithdrawalReviewService,
  ) {}

  @Get()
  async list(@CurrentAdmin() admin: AdminPrincipal, @Query('status') status?: string) {
    const readScope = await this.adminAccessControlService.resolveReadScope(admin);
    const batches = await this.withdrawalReviewService.listBatches({
      readScope,
      status: status?.trim() || undefined,
    });

    return {
      batches: batches.map(presentWithdrawalBatch),
    };
  }

  @Get(':batchId')
  async detail(
    @CurrentAdmin() admin: AdminPrincipal,
    @Param('batchId') batchId: string,
  ) {
    const readScope = await this.adminAccessControlService.resolveReadScope(admin);
    const detail = await this.withdrawalDetailService.getBatchDetail({
      batchId,
      readScope,
    });

    return presentWithdrawalDetail(detail);
  }

  @Post(':batchId/approve')
  @UseGuards(SuperAdminGuard)
  async approve(
    @CurrentAdmin() admin: AdminPrincipal,
    @Param('batchId') batchId: string,
  ) {
    const actor = requireSuperAdminPrincipal(admin);
    const batch = await this.withdrawalReviewService.approveBatch({
      batchId,
    });
    await this.recordAdminWithdrawalAudit(actor, {
      action: 'withdrawal.approved',
      batch,
    });

    return presentWithdrawalBatch(batch);
  }

  @Post(':batchId/pay')
  @UseGuards(SuperAdminGuard)
  async pay(
    @CurrentAdmin() admin: AdminPrincipal,
    @Param('batchId') batchId: string,
    @Body() body: unknown,
  ) {
    const input = payWithdrawalSchema.parse(body ?? {});
    const actor = requireSuperAdminPrincipal(admin);
    const batch = await this.withdrawalPaymentService.payBatch({
      batchId,
      mockResult: input.mockResult,
    });
    await this.recordAdminWithdrawalAudit(actor, {
      action:
        input.mockResult === 'failed'
          ? 'withdrawal.payment_failed'
          : 'withdrawal.paid',
      batch,
    });

    return presentWithdrawalBatch(batch);
  }

  @Post(':batchId/close')
  @UseGuards(SuperAdminGuard)
  async close(
    @CurrentAdmin() admin: AdminPrincipal,
    @Param('batchId') batchId: string,
  ) {
    const actor = requireSuperAdminPrincipal(admin);
    const batch = await this.withdrawalPaymentService.closeFailedBatch({
      batchId,
    });
    await this.recordAdminWithdrawalAudit(actor, {
      action: 'withdrawal.closed_refunded',
      batch,
    });

    return presentWithdrawalBatch(batch);
  }

  private recordAdminWithdrawalAudit(
    admin: SuperAdminPrincipal,
    input: {
      action: string;
      batch: WithdrawalBatchWithDetails;
    },
  ) {
    return this.auditLogService.record({
      action: input.action,
      actorId: admin.username,
      actorType: admin.role,
      metadata: {
        detailCount: input.batch.details.length,
        status: input.batch.status,
        totalAmountLi: input.batch.totalAmountLi.toString(),
      },
      targetId: input.batch.id,
      targetType: 'withdrawal_batch',
    });
  }
}

function presentWithdrawalDetail(detail: WithdrawalBatchDetailResult) {
  return {
    batch: presentWithdrawalBatch(detail.batch),
    auditLogs: detail.auditLogs.map((row) => ({
      id: row.id,
      action: row.action,
      actorId: row.actorId,
      actorType: row.actorType,
      createdAt: row.createdAt.toISOString(),
      metadata: row.metadata,
      targetId: row.targetId,
      targetType: row.targetType,
    })),
  };
}

function presentWithdrawalBatch(batch: WithdrawalBatchWithDetails) {
  return {
    id: batch.id,
    status: batch.status,
    totalAmount: presentMoneyLi(batch.totalAmountLi),
    ownerId: batch.ownerId,
    ownerType: batch.ownerType,
    userId: batch.userId,
    createdAt: batch.createdAt.toISOString(),
    updatedAt: batch.updatedAt.toISOString(),
    details: batch.details.map((detail) => ({
      id: detail.id,
      amount: presentMoneyLi(detail.amountLi),
      alipayRequestSnapshot: detail.alipayRequestSnapshot,
      alipayResponseSnapshot: detail.alipayResponseSnapshot,
      errorCode: detail.errorCode,
      errorMessage: detail.errorMessage,
      recipientAlipay: detail.recipientAlipay,
      recipientName: detail.recipientName,
      status: detail.status,
      type: detail.type,
    })),
  };
}
