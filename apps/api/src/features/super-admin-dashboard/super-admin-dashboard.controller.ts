import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
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
  resolveDashboardDayRange,
} from '../user/china-day-range';
import { CachedResponseInterceptor } from '../../common/rate-limit/cached-response.interceptor';
import { RateLimitGuard } from '../../common/rate-limit/rate-limit.guard';
import { Throttle } from '../../common/rate-limit/throttle.decorator';
import { SuperAdminDashboardService } from './super-admin-dashboard.service';

const dayQuerySchema = z.object({
  start: z.string().optional(),
  end: z.string().optional(),
});

const userRecordsQuerySchema = z.object({
  date: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  gameId: z.string().optional(),
  accountId: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).optional().default(50),
});

function parseDashboardRange(query: unknown) {
  const { start, end } = dayQuerySchema.parse(query ?? {});
  return resolveDashboardDayRange({ startDay: start, endDay: end });
}

const refreshScopeSchema = z.union([
  z.object({
    scope: z.literal('company'),
    companyId: z.string().min(1),
  }),
  z.object({
    scope: z.literal('game'),
    gameId: z.string().min(1),
  }),
  z.object({
    scope: z.literal('user'),
    gameId: z.string().min(1),
    userId: z.string().min(1),
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
  private readonly logger = new Logger('刷新链路:Controller');

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
    const { date, start, end, gameId, accountId, limit } =
      userRecordsQuerySchema.parse(query ?? {});
    // 用户详情记录列表：兼容旧的单日 date 参数；否则按 start/end 日期范围
    const resolvedRange = date
      ? resolveChinaDayRange(date)
      : resolveDashboardDayRange({ startDay: start, endDay: end });
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
    const tStart = Date.now();
    const parsed = refreshScopeSchema.safeParse(body);
    if (!parsed.success) {
      this.logger.warn('入参校验失败，body=' + JSON.stringify(body));
      throw new BadRequestException('刷新范围参数无效');
    }
    const input = parsed.data;
    const actor = requireSuperAdminPrincipal(admin);
    this.logger.log(
      `[入口] scope=${input.scope} 操作者=${actor.username} body=${JSON.stringify(input)}`,
    );

    const callRefresh = async (gameAppId: string, openIds?: string[]) => {
      const tGame = Date.now();
      this.logger.log(
        `[游戏开始] gameAppId=${gameAppId} openIds数=${openIds?.length ?? '未传(整游戏)'}`,
      );
      // 行级 ⟳ 默认只刷"当天"。dataDays 不传，由 service 默认拿当天。
      const result = await this.rangeSyncService.refreshRange({
        actorId: actor.username,
        actorType: actor.role,
        gameAppId,
        markTokenError: true,
        openIds,
      });
      this.logger.log(
        `[游戏完成] gameAppId=${gameAppId} 耗时=${Date.now() - tGame}ms savedCount=${(result as { savedCount?: number })?.savedCount ?? '?'}`,
      );
      return result;
    };

    try {
      if (input.scope === 'game') {
        const game = await this.prisma.game.findUnique({
          where: { id: input.gameId },
          select: { gameAppId: true },
        });
        if (!game) throw new BadRequestException('游戏不存在');
        const result = await callRefresh(game.gameAppId);
        this.logger.log(`[出口] scope=game 总耗时=${Date.now() - tStart}ms`);
        return { results: [result] };
      }

      if (input.scope === 'company') {
        const games = await this.prisma.game.findMany({
          where: { companyId: input.companyId, deletedAt: null },
          select: { gameAppId: true },
        });
        this.logger.log(
          `[公司展开] companyId=${input.companyId} 该公司有 ${games.length} 个游戏，开始串行刷新`,
        );
        const results: unknown[] = [];
        for (const game of games) {
          results.push(await callRefresh(game.gameAppId));
        }
        this.logger.log(
          `[出口] scope=company 游戏数=${games.length} 总耗时=${Date.now() - tStart}ms`,
        );
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
      const result = await callRefresh(
        game.gameAppId,
        openIdRecords.map((o) => o.openId),
      );
      this.logger.log(
        `[出口] scope=user openIds数=${openIdRecords.length} 总耗时=${Date.now() - tStart}ms`,
      );
      return { results: [result] };
    } catch (err) {
      this.logger.error(
        `[失败] 总耗时=${Date.now() - tStart}ms 错误=${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }
  }
}
