import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { AuditLogController } from './audit-log.controller';
import { AuditLogService } from './audit-log.service';

@Module({
  controllers: [AuditLogController],
  exports: [AuditLogService],
  imports: [AdminAuthModule],
  providers: [AuditLogService],
})
export class AuditLogModule {}
