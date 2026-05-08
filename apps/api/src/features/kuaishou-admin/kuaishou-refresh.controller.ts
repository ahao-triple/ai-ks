import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { type AdminPrincipal } from '../admin-auth/admin-auth.service';
import { AdminJwtGuard } from '../admin-auth/admin-jwt.guard';
import { CurrentAdmin } from '../admin-auth/current-admin.decorator';
import {
  KuaishouEcpmSyncJobService,
  presentKuaishouEcpmSyncJob,
} from './kuaishou-ecpm-sync-job.service';
import { KuaishouEcpmRangeSyncService } from './kuaishou-ecpm-range-sync.service';

const lookbackHoursSchema = z.union([
  z.literal(1),
  z.literal(3),
  z.literal(6),
  z.literal(12),
  z.literal(24),
]);

const refreshEcpmSchema = z
  .object({
    gameAppId: z.string().min(1),
    lookbackHours: lookbackHoursSchema.optional(),
    openIds: z.array(z.string().min(1)).optional(),
  })
  .strict();

@Controller('admin/kuaishou')
@UseGuards(AdminJwtGuard)
export class KuaishouRefreshController {
  constructor(
    private readonly rangeSyncService: KuaishouEcpmRangeSyncService,
    private readonly syncJobService: KuaishouEcpmSyncJobService,
  ) {}

  @Post('ecpm/refresh')
  async refresh(@CurrentAdmin() admin: AdminPrincipal, @Body() body: unknown) {
    const parsed = refreshEcpmSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException('Invalid ECPM refresh request');
    }
    const input = parsed.data;

    return this.rangeSyncService.refreshRange({
      actorId: admin.username,
      actorType: admin.role,
      gameAppId: input.gameAppId,
      lookbackHours: input.lookbackHours ?? 1,
      markTokenError: true,
      openIds: input.openIds,
    });
  }

  @Get('ecpm/jobs')
  async jobs(
    @Query('limit') limit?: string,
    @Query('gameAppId') gameAppId?: string,
  ) {
    const jobs = await this.syncJobService.listJobs({
      gameAppId,
      limit: parseLimit(limit),
    });

    return {
      jobs: jobs.map(presentKuaishouEcpmSyncJob),
    };
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
