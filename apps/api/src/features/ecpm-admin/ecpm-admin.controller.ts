import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import {
  type AdminPrincipal,
  requireSuperAdminPrincipal,
} from '../admin-auth/admin-auth.service';
import { AdminJwtGuard } from '../admin-auth/admin-jwt.guard';
import { CurrentAdmin } from '../admin-auth/current-admin.decorator';
import { SuperAdminGuard } from '../admin-auth/super-admin.guard';
import { EcpmDashboardService } from './ecpm-dashboard.service';
import { EcpmUpdateJobService } from './ecpm-update-job.service';
import { EcpmUpdateRangeService } from './ecpm-update-range.service';

const dashboardQuerySchema = z
  .object({
    companyId: z.string().optional(),
    endedDataHour: z.string().optional(),
    gameId: z.string().optional(),
    openId: z.string().optional(),
    page: z.coerce.number().int().positive().optional(),
    pageSize: z.coerce.number().int().positive().max(100).optional(),
    startedDataHour: z.string().optional(),
    status: z.enum(['PENDING', 'SETTLED']).optional(),
    userId: z.string().optional(),
  })
  .strict();

const updateRequestSchema = z
  .object({
    endedDataHour: z.string().nullable().optional(),
    mode: z.enum(['latest', 'range']),
    scopeId: z.string().min(1),
    scopeType: z.enum(['company', 'game', 'user', 'open_id']),
    startedDataHour: z.string().nullable().optional(),
  })
  .strict();

type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

@Controller('admin/ecpm')
@UseGuards(AdminJwtGuard)
export class EcpmAdminController {
  constructor(
    private readonly dashboardService: EcpmDashboardService,
    private readonly updateJobService: EcpmUpdateJobService,
    private readonly updateRangeService: EcpmUpdateRangeService,
  ) {}

  @Get('dashboard/company')
  async company(
    @CurrentAdmin() admin: AdminPrincipal,
    @Query() query: unknown,
  ) {
    return this.dashboardService.queryCompany({
      admin,
      ...parseDashboardQuery(query),
    });
  }

  @Get('dashboard/game')
  async game(@CurrentAdmin() admin: AdminPrincipal, @Query() query: unknown) {
    return this.dashboardService.queryGame({
      admin,
      ...parseDashboardQuery(query),
    });
  }

  @Get('dashboard/user')
  async user(@CurrentAdmin() admin: AdminPrincipal, @Query() query: unknown) {
    return this.dashboardService.queryUser({
      admin,
      ...parseDashboardQuery(query),
    });
  }

  @Get('dashboard/open-id')
  async openId(
    @CurrentAdmin() admin: AdminPrincipal,
    @Query() query: unknown,
  ) {
    return this.dashboardService.queryOpenId({
      admin,
      ...parseDashboardQuery(query),
    });
  }

  @Get('dashboard/latest')
  async latest(
    @CurrentAdmin() admin: AdminPrincipal,
    @Query() query: unknown,
  ) {
    return this.dashboardService.queryLatest({
      admin,
      ...withoutDashboardHourRange(parseDashboardQuery(query)),
    });
  }

  @Post('update')
  @UseGuards(SuperAdminGuard)
  async update(@CurrentAdmin() admin: AdminPrincipal, @Body() body: unknown) {
    const actor = requireSuperAdminPrincipal(admin);

    return this.updateRangeService.update({
      ...parseUpdateRequest(body),
      actorId: actor.username,
      actorType: actor.role,
    });
  }

  @Get('update-jobs')
  async jobs(@Query('limit') limit?: string) {
    return this.updateJobService.listJobs({
      limit: parseLimit(limit),
    });
  }

  @Get('update-jobs/:jobId')
  async job(@Param('jobId') jobId: string) {
    return this.updateJobService.findJob(jobId);
  }

  @Post('update-jobs/:jobId/retry')
  @UseGuards(SuperAdminGuard)
  async retry(
    @CurrentAdmin() admin: AdminPrincipal,
    @Param('jobId') jobId: string,
  ) {
    const actor = requireSuperAdminPrincipal(admin);

    return this.updateRangeService.retry(jobId, {
      actorId: actor.username,
      actorType: actor.role,
    });
  }
}

function parseDashboardQuery(query: unknown) {
  const parsed = dashboardQuerySchema.safeParse(query ?? {});
  if (!parsed.success) {
    throw new BadRequestException('Invalid ECPM dashboard query');
  }

  return parsed.data;
}

function parseUpdateRequest(body: unknown) {
  const parsed = updateRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestException('Invalid ECPM update request');
  }

  return parsed.data;
}

function withoutDashboardHourRange(input: DashboardQuery) {
  const query = { ...input };
  delete query.endedDataHour;
  delete query.startedDataHour;

  return query;
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
