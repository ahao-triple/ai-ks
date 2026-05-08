import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { KuaishouEcpmClient } from '../../integrations/kuaishou/kuaishou-ecpm.client';
import { type AdminPrincipal } from '../admin-auth/admin-auth.service';
import { AdminJwtGuard } from '../admin-auth/admin-jwt.guard';
import { CurrentAdmin } from '../admin-auth/current-admin.decorator';
import { AuditLogService } from '../audit/audit-log.service';
import { DemoStore } from '../demo/demo-store';
import { presentEcpmRow } from '../demo/money-presenter';
import {
  KuaishouEcpmSyncJobService,
  presentKuaishouEcpmSyncJob,
} from './kuaishou-ecpm-sync-job.service';
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
    private readonly syncJobService: KuaishouEcpmSyncJobService,
  ) {}

  @Post('ecpm/refresh')
  async refresh(@CurrentAdmin() admin: AdminPrincipal, @Body() body: unknown) {
    const input = refreshEcpmSchema.parse(body);
    const dataHour = input.dataHour ?? currentChinaDate();
    const knownOpenIds = (await this.demoStore.listOpenIds(input.gameAppId)).map(
      (record) => record.openId,
    );
    const openIds = input.openIds?.length ? input.openIds : knownOpenIds;
    const job = await this.syncJobService.startJob({
      actorId: admin.username,
      actorType: admin.role,
      dataHour,
      gameAppId: input.gameAppId,
      requestedOpenIdCount: openIds.length,
    });

    try {
      const refreshResult = await this.ecpmClient.refresh({
        dataHour,
        gameAppId: input.gameAppId,
        openIds,
      });
      const savedRows = await this.demoStore.addEcpmRows({
        gameAppId: input.gameAppId,
        rows: refreshResult.rows,
      });
      const completedJob = await this.syncJobService.completeJob({
        jobId: job.id,
        savedCount: savedRows.length,
        source: refreshResult.source,
      });
      await this.auditLogService.record({
        action: 'kuaishou.ecpm_refreshed',
        actorId: admin.username,
        actorType: admin.role,
        metadata: {
          dataHour,
          jobId: job.id,
          requestedOpenIds: openIds,
          savedCount: savedRows.length,
          source: refreshResult.source,
        },
        targetId: input.gameAppId,
        targetType: 'kuaishou_ecpm_refresh',
      });

      return {
        job: presentKuaishouEcpmSyncJob(completedJob),
        requestedOpenIds: openIds,
        rows: savedRows.map(presentEcpmRow),
        savedCount: savedRows.length,
        source: refreshResult.source,
      };
    } catch (error) {
      const message = readErrorMessage(error);
      await this.syncJobService.failJob({
        errorMessage: message,
        jobId: job.id,
      });
      await this.tokenService.markTokenError(message);
      await this.auditLogService.record({
        action: 'kuaishou.ecpm_refresh_failed',
        actorId: admin.username,
        actorType: admin.role,
        metadata: {
          dataHour,
          error: message,
          jobId: job.id,
          requestedOpenIds: openIds,
        },
        targetId: input.gameAppId,
        targetType: 'kuaishou_ecpm_refresh',
      });
      throw error;
    }
  }

  @Get('ecpm/jobs')
  async jobs(@Query('limit') limit?: string) {
    const jobs = await this.syncJobService.listJobs({
      limit: parseLimit(limit),
    });

    return {
      jobs: jobs.map(presentKuaishouEcpmSyncJob),
    };
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

function parseLimit(value?: string) {
  if (!value) {
    return 20;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 20;
  }

  return Math.min(Math.max(Math.trunc(parsed), 1), 100);
}
