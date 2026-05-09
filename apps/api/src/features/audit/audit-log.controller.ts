import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { type AdminPrincipal } from '../admin-auth/admin-auth.service';
import { AdminJwtGuard } from '../admin-auth/admin-jwt.guard';
import { CurrentAdmin } from '../admin-auth/current-admin.decorator';
import { AuditLogService } from './audit-log.service';

@Controller('admin/audit-logs')
@UseGuards(AdminJwtGuard)
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  async list(
    @CurrentAdmin() admin: AdminPrincipal,
    @Query('limit') limit?: string,
  ) {
    const rows = await this.auditLogService.list({
      admin,
      limit: limit ? Number(limit) : undefined,
    });

    return {
      logs: rows.map((row) => ({
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
}
