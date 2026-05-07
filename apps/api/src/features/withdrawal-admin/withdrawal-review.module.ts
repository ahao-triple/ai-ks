import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { AuditLogModule } from '../audit/audit-log.module';
import { WithdrawalDetailService } from './withdrawal-detail.service';
import { WithdrawalPaymentService } from './withdrawal-payment.service';
import { WithdrawalReviewController } from './withdrawal-review.controller';
import { WithdrawalReviewService } from './withdrawal-review.service';

@Module({
  controllers: [WithdrawalReviewController],
  imports: [AdminAuthModule, AuditLogModule],
  providers: [
    WithdrawalDetailService,
    WithdrawalPaymentService,
    WithdrawalReviewService,
  ],
})
export class WithdrawalReviewModule {}
