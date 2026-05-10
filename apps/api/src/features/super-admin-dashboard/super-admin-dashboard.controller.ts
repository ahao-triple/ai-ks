import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  type AdminPrincipal,
  requireSuperAdminPrincipal,
} from '../admin-auth/admin-auth.service';
import { AdminJwtGuard } from '../admin-auth/admin-jwt.guard';
import { CurrentAdmin } from '../admin-auth/current-admin.decorator';
import { SuperAdminGuard } from '../admin-auth/super-admin.guard';
import { KuaishouEcpmRangeSyncService } from '../kuaishou-admin/kuaishou-ecpm-range-sync.service';
import { UserDashboardService } from '../user-dashboard/user-dashboard.service';
import {
  resolveChinaDayRange,
  resolveDashboardRange,
  type DashboardRangeKey,
} from '../user/china-day-range';
import { CachedResponseInterceptor } from '../../common/rate-limit/cached-response.interceptor';
import { RateLimitGuard } from '../../common/rate-limit/rate-limit.guard';
import { Throttle } from '../../common/rate-limit/throttle.decorator';
import { SuperAdminDashboardService } from './super-admin-dashboard.service';

const rangeKeySchema = z
  .enum(['today', 'yesterday', 'last3', 'last7'])
  .optional()
  .default('today');

const dashboardQuerySchema = z.object({
  range: rangeKeySchema,
});

const userRecordsQuerySchema = z.object({
  date: z.string().optional(),
  range: rangeKeySchema,
  gameId: z.string().optional(),
  accountId: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).optional().default(50),
});

function parseDashboardRange(query: unknown) {
  const { range } = dashboardQuerySchema.parse(query ?? {});
  return resolveDashboardRange(range as DashboardRangeKey);
}

const lookbackHoursField = z
  .union([
    z.literal(1),
    z.literal(5),
    z.literal(24),
    z.literal(72),
    z.literal(168),
  ])
  .optional()
  .default(1);

const refreshScopeSchema = z.union([
  z.object({
    scope: z.literal('company'),
    companyId: z.string().min(1),
    lookbackHours: lookbackHoursField,
  }),
  z.object({
    scope: z.literal('game'),
    gameId: z.string().min(1),
    lookbackHours: lookbackHoursField,
  }),
  z.object({
    scope: z.literal('user'),
    gameId: z.string().min(1),
    userId: z.string().min(1),
    lookbackHours: lookbackHoursField,
  }),
]);

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
    private readonly prisma: PrismaService,
    private readonly rangeSyncService: KuaishouEcpmRangeSyncService,
  ) {}

  @Get('overview')
  @Throttle(STANDARD_THROTTLE)
  async overview(@Query() query: unknown) {
    return this.service.getOverview({ range: parseDashboardRange(query) });
  }

  @Get('companies')
  @Throttle(STANDARD_THROTTLE)
  async companies(@Query() query: unknown) {
    return this.service.getCompanyDistribution({
      range: parseDashboardRange(query),
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
    return this.service.listGamesUnderCompany({
      companyId,
      range: parseDashboardRange(query),
    });
  }

  @Get('games/:gameId/users')
  @Throttle(STANDARD_THROTTLE)
  async usersUnderGame(
    @Param('gameId') gameId: string,
    @Query() query: unknown,
  ) {
    return this.service.listUsersUnderGame({
      gameId,
      range: parseDashboardRange(query),
    });
  }

  @Get('users/:userId/records')
  @Throttle(STANDARD_THROTTLE)
  async userRecords(
    @Param('userId') userId: string,
    @Query() query: unknown,
  ) {
    const { date, range, gameId, accountId, limit } =
      userRecordsQuerySchema.parse(query ?? {});
    // 用户详情记录列表：兼容旧的单日 date 参数（如果传），否则用 range
    const resolvedRange = date
      ? resolveChinaDayRange(date)
      : resolveDashboardRange(range as DashboardRangeKey);
    return this.userDashboardService.listEcpmRecords({
      userId,
      range: resolvedRange,
      gameId,
      accountId,
      limit,
    });
  }

  @Post('refresh')
  @UseGuards(SuperAdminGuard)
  async refresh(
    @CurrentAdmin() admin: AdminPrincipal,
    @Body() body: unknown,
  ) {
    const parsed = refreshScopeSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException('刷新范围参数无效');
    }
    const input = parsed.data;
    const actor = requireSuperAdminPrincipal(admin);

    const callRefresh = (gameAppId: string, openIds?: string[]) =>
      this.rangeSyncService.refreshRange({
        actorId: actor.username,
        actorType: actor.role,
        gameAppId,
        lookbackHours: input.lookbackHours,
        markTokenError: true,
        openIds,
      });

    if (input.scope === 'game') {
      const game = await this.prisma.game.findUnique({
        where: { id: input.gameId },
        select: { gameAppId: true },
      });
      if (!game) throw new BadRequestException('游戏不存在');
      return { results: [await callRefresh(game.gameAppId)] };
    }

    if (input.scope === 'company') {
      const games = await this.prisma.game.findMany({
        where: { companyId: input.companyId, deletedAt: null },
        select: { gameAppId: true },
      });
      const results: unknown[] = [];
      for (const game of games) {
        results.push(await callRefresh(game.gameAppId));
      }
      return { results };
    }

    // scope === 'user'
    const game = await this.prisma.game.findUnique({
      where: { id: input.gameId },
      select: { gameAppId: true },
    });
    if (!game) throw new BadRequestException('游戏不存在');
    const openIdRecords = await this.prisma.gameOpenId.findMany({
      where: { gameId: input.gameId, userId: input.userId },
      select: { openId: true },
    });
    if (openIdRecords.length === 0) {
      throw new BadRequestException('该用户在此游戏下没有 open_id');
    }
    return {
      results: [
        await callRefresh(
          game.gameAppId,
          openIdRecords.map((o) => o.openId),
        ),
      ],
    };
  }
}
