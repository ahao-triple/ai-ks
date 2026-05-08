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

    let refreshResult: Awaited<ReturnType<KuaishouEcpmClient['refresh']>>;
    try {
      refreshResult = await this.ecpmClient.refresh({
        dataHour,
        gameAppId: input.gameAppId,
        openIds,
      });
    } catch (error) {
      try {
        await this.recordRefreshFailure({
          admin,
          dataHour,
          error,
          gameAppId: input.gameAppId,
          jobId: job.id,
          markTokenError: true,
          openIds,
        });
      } catch {
        // Preserve the original upstream error for callers.
      }
      throw error;
    }

    let savedRows: Awaited<ReturnType<DemoStore['addEcpmRows']>>;
    try {
      savedRows = await this.demoStore.addEcpmRows({
        gameAppId: input.gameAppId,
        rows: refreshResult.rows,
      });
    } catch (error) {
      try {
        await this.recordRefreshFailure({
          admin,
          dataHour,
          error,
          gameAppId: input.gameAppId,
          jobId: job.id,
          markTokenError: false,
          openIds,
        });
      } catch {
        // Preserve the original local save error for callers.
      }
      throw error;
    }

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

  private async recordRefreshFailure(input: {
    admin: AdminPrincipal;
    dataHour: string;
    error: unknown;
    gameAppId: string;
    jobId: string;
    markTokenError: boolean;
    openIds: string[];
  }) {
    const message = readErrorMessage(input.error);
    await this.syncJobService.failJob({
      errorMessage: message,
      jobId: input.jobId,
    });
    if (input.markTokenError) {
      await this.tokenService.markTokenError(message);
    }
    await this.auditLogService.record({
      action: 'kuaishou.ecpm_refresh_failed',
      actorId: input.admin.username,
      actorType: input.admin.role,
      metadata: {
        dataHour: input.dataHour,
        error: message,
        jobId: input.jobId,
        requestedOpenIds: input.openIds,
      },
      targetId: input.gameAppId,
      targetType: 'kuaishou_ecpm_refresh',
    });
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
