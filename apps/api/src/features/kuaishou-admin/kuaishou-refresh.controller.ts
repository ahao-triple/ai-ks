import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { KuaishouEcpmClient } from '../../integrations/kuaishou/kuaishou-ecpm.client';
import { type AdminPrincipal } from '../admin-auth/admin-auth.service';
import { AdminJwtGuard } from '../admin-auth/admin-jwt.guard';
import { CurrentAdmin } from '../admin-auth/current-admin.decorator';
import { AuditLogService } from '../audit/audit-log.service';
import { DemoStore } from '../demo/demo-store';
import { presentEcpmRow } from '../demo/money-presenter';
import { KuaishouTokenService } from './kuaishou-token.service';

const refreshEcpmSchema = z.object({
  dataHour: z.string().min(1).optional(),
  gameAppId: z.string().min(1),
  openIds: z.array(z.string().min(1)).optional(),
});

@Controller('admin/kuaishou')
@UseGuards(AdminJwtGuard)
export class KuaishouRefreshController {
  constructor(
    private readonly demoStore: DemoStore,
    private readonly ecpmClient: KuaishouEcpmClient,
    private readonly auditLogService: AuditLogService,
    private readonly tokenService: KuaishouTokenService,
  ) {}

  @Post('ecpm/refresh')
  async refresh(@CurrentAdmin() admin: AdminPrincipal, @Body() body: unknown) {
    const input = refreshEcpmSchema.parse(body);
    const dataHour = input.dataHour ?? currentChinaDate();
    const knownOpenIds = (await this.demoStore.listOpenIds(input.gameAppId)).map(
      (record) => record.openId,
    );
    const openIds = input.openIds?.length ? input.openIds : knownOpenIds;
    const refreshResult = await this.refreshEcpmOrRecordFailure(admin, {
      dataHour,
      gameAppId: input.gameAppId,
      openIds,
    });
    const savedRows = await this.demoStore.addEcpmRows({
      gameAppId: input.gameAppId,
      rows: refreshResult.rows,
    });
    await this.auditLogService.record({
      action: 'kuaishou.ecpm_refreshed',
      actorId: admin.username,
      actorType: admin.role,
      metadata: {
        dataHour,
        requestedOpenIds: openIds,
        savedCount: savedRows.length,
        source: refreshResult.source,
      },
      targetId: input.gameAppId,
      targetType: 'kuaishou_ecpm_refresh',
    });

    return {
      source: refreshResult.source,
      requestedOpenIds: openIds,
      savedCount: savedRows.length,
      rows: savedRows.map(presentEcpmRow),
    };
  }

  private async refreshEcpmOrRecordFailure(
    admin: AdminPrincipal,
    input: {
      dataHour: string;
      gameAppId: string;
      openIds: string[];
    },
  ) {
    try {
      return await this.ecpmClient.refresh(input);
    } catch (error) {
      const message = readErrorMessage(error);
      await this.tokenService.markTokenError(message);
      await this.auditLogService.record({
        action: 'kuaishou.ecpm_refresh_failed',
        actorId: admin.username,
        actorType: admin.role,
        metadata: {
          dataHour: input.dataHour,
          error: message,
          requestedOpenIds: input.openIds,
        },
        targetId: input.gameAppId,
        targetType: 'kuaishou_ecpm_refresh',
      });
      throw error;
    }
  }
}

function currentChinaDate() {
  return new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
  }).format(new Date());
}

function readErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'unknown error';
}
