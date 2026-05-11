import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  type KuaishouEcpmSyncJob,
  KuaishouEcpmSyncJobStatus,
} from '@prisma/client';
import { z } from 'zod';
import {
  type AdminPrincipal,
  requireSuperAdminPrincipal,
} from '../admin-auth/admin-auth.service';
import { AdminAccessControlService } from '../admin-auth/admin-access-control.service';
import { AdminJwtGuard } from '../admin-auth/admin-jwt.guard';
import { CurrentAdmin } from '../admin-auth/current-admin.decorator';
import { SuperAdminGuard } from '../admin-auth/super-admin.guard';
import {
  KuaishouEcpmSyncJobService,
  presentKuaishouEcpmSyncJob,
} from './kuaishou-ecpm-sync-job.service';
import {
  buildDataDaysBetween,
  KuaishouEcpmRangeSyncService,
} from './kuaishou-ecpm-range-sync.service';

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

const refreshEcpmSchema = z
  .object({
    gameAppId: z.string().min(1),
    // 可选：要刷的日期列表（YYYY-MM-DD[]），不传 = 默认当天
    dataDays: z.array(z.string().regex(DAY_RE)).optional(),
    openIds: z.array(z.string().min(1)).optional(),
  })
  .strict();

@Controller('admin/kuaishou')
@UseGuards(AdminJwtGuard)
export class KuaishouRefreshController {
  constructor(
    private readonly rangeSyncService: KuaishouEcpmRangeSyncService,
    private readonly syncJobService: KuaishouEcpmSyncJobService,
    private readonly accessControlService: AdminAccessControlService,
  ) {}

  @Post('ecpm/refresh')
  @UseGuards(SuperAdminGuard)
  async refresh(@CurrentAdmin() admin: AdminPrincipal, @Body() body: unknown) {
    const parsed = refreshEcpmSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException('Invalid ECPM refresh request');
    }
    const input = parsed.data;
    const actor = requireSuperAdminPrincipal(admin);

    return this.rangeSyncService.refreshRange({
      actorId: actor.username,
      actorType: actor.role,
      gameAppId: input.gameAppId,
      dataDays: input.dataDays,
      markTokenError: true,
      openIds: input.openIds,
    });
  }

  @Get('ecpm/jobs')
  async jobs(
    @CurrentAdmin() admin: AdminPrincipal,
    @Query('limit') limit?: string,
    @Query('gameAppId') gameAppId?: string,
  ) {
    const scope = await this.accessControlService.resolveReadScope(admin);
    const jobs = await this.syncJobService.listJobs({
      gameAppId,
      gameAppIds: scope.isSuperAdmin ? undefined : (scope.gameAppIds ?? []),
      limit: parseLimit(limit),
    });

    return {
      jobs: jobs.map(presentKuaishouEcpmSyncJob),
    };
  }

  @Post('ecpm/jobs/:jobId/retry')
  @UseGuards(SuperAdminGuard)
  async retryJob(
    @CurrentAdmin() admin: AdminPrincipal,
    @Param('jobId') jobId: string,
  ) {
    const actor = requireSuperAdminPrincipal(admin);
    const job = await this.syncJobService.findJobById(jobId);
    if (!job) {
      throw new NotFoundException('ECPM sync job not found');
    }
    if (job.status !== KuaishouEcpmSyncJobStatus.FAILED) {
      throw new BadRequestException('Only failed ECPM sync jobs can be retried');
    }

    return this.rangeSyncService.refreshRange({
      actorId: actor.username,
      actorType: actor.role,
      dataDays: buildRetryDataDays(job),
      gameAppId: job.gameAppId,
      markTokenError: true,
    });
  }
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

function buildRetryDataDays(job: KuaishouEcpmSyncJob) {
  const startDay = (job.startedDataHour ?? job.dataHour).slice(0, 10);
  const endDay = (job.endedDataHour ?? job.dataHour).slice(0, 10);
  return buildDataDaysBetween(startDay, endDay);
}
