import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { z } from 'zod';
import { AdminJwtGuard } from '../admin-auth/admin-jwt.guard';
import { SuperAdminGuard } from '../admin-auth/super-admin.guard';
import { UserDashboardService } from '../user-dashboard/user-dashboard.service';
import { resolveChinaDayRange } from '../user/china-day-range';
import { CachedResponseInterceptor } from '../../common/rate-limit/cached-response.interceptor';
import { RateLimitGuard } from '../../common/rate-limit/rate-limit.guard';
import { Throttle } from '../../common/rate-limit/throttle.decorator';
import { SuperAdminDashboardService } from './super-admin-dashboard.service';

const dateOnly = z.object({ date: z.string().optional() });

const userRecordsQuerySchema = z.object({
  date: z.string().optional(),
  gameId: z.string().optional(),
  accountId: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).optional().default(50),
});

const STANDARD_THROTTLE = {
  windowMs: 5_000,
  max: 1,
  cacheMs: 60_000,
};

@Controller('admin/dashboard')
@UseGuards(AdminJwtGuard, SuperAdminGuard, RateLimitGuard)
@UseInterceptors(CachedResponseInterceptor)
export class SuperAdminDashboardController {
  constructor(
    private readonly service: SuperAdminDashboardService,
    private readonly userDashboardService: UserDashboardService,
  ) {}

  @Get('overview')
  @Throttle(STANDARD_THROTTLE)
  async overview(@Query() query: unknown) {
    const { date } = dateOnly.parse(query ?? {});
    return this.service.getOverview({ range: resolveChinaDayRange(date) });
  }

  @Get('companies')
  @Throttle(STANDARD_THROTTLE)
  async companies(@Query() query: unknown) {
    const { date } = dateOnly.parse(query ?? {});
    return this.service.getCompanyDistribution({
      range: resolveChinaDayRange(date),
    });
  }

  @Get('anomalies')
  @Throttle(STANDARD_THROTTLE)
  async anomalies() {
    return this.service.getAnomalies();
  }

  @Get('companies/:companyId/games')
  @Throttle(STANDARD_THROTTLE)
  async gamesUnderCompany(
    @Param('companyId') companyId: string,
    @Query() query: unknown,
  ) {
    const { date } = dateOnly.parse(query ?? {});
    return this.service.listGamesUnderCompany({
      companyId,
      range: resolveChinaDayRange(date),
    });
  }

  @Get('games/:gameId/users')
  @Throttle(STANDARD_THROTTLE)
  async usersUnderGame(
    @Param('gameId') gameId: string,
    @Query() query: unknown,
  ) {
    const { date } = dateOnly.parse(query ?? {});
    return this.service.listUsersUnderGame({
      gameId,
      range: resolveChinaDayRange(date),
    });
  }

  @Get('users/:userId/records')
  @Throttle(STANDARD_THROTTLE)
  async userRecords(
    @Param('userId') userId: string,
    @Query() query: unknown,
  ) {
    const { date, gameId, accountId, limit } = userRecordsQuerySchema.parse(
      query ?? {},
    );
    return this.userDashboardService.listEcpmRecords({
      userId,
      range: resolveChinaDayRange(date),
      gameId,
      accountId,
      limit,
    });
  }
}
