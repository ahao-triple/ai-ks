import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LI_PER_YUAN } from '../../domain/money/amount';

const HOURS_FOR_LONG_SILENT = 6;
const HOURS_FOR_SYNC_FAILURE_WINDOW = 24;

export type Range = { startAt: Date; endAt: Date };

export type SuperAdminOverview = {
  todayCount: number;
  todayAverageEcpmYuan: number;
  todayMaxEcpmYuan: number;
  activeGameCount: number;
  totalGameCount: number;
  activeUserCount: number;
};

export type SuperAdminCompanyRow = {
  companyId: string;
  companyName: string;
  ecpmCount: number;
  activeGameCount: number;
  totalGameCount: number;
  activeUserCount: number;
  averageEcpmYuan: number;
  maxEcpmYuan: number;
};

export type SuperAdminAnomalies = {
  syncFailures: Array<{
    gameAppId: string;
    gameName: string;
    jobId: string;
    failedAt: Date;
    errorMessage: string | null;
  }>;
  longSilent: Array<{
    gameId: string;
    gameName: string;
    hoursSinceLastEcpm: number;
  }>;
};

export type GameRow = {
  gameId: string;
  gameName: string;
  ecpmCount: number;
  activeUserCount: number;
  averageEcpmYuan: number;
  maxEcpmYuan: number;
};

export type UnderGameUserRow = {
  userId: string;
  readableId: string;
  ecpmCount: number;
  averageEcpmYuan: number;
  maxEcpmYuan: number;
  lastActiveAt: Date | null;
};

type DashboardPrisma = {
  rawEcpm: {
    findMany(args: {
      where?: {
        gameId?: string | { in: string[] };
        eventTime?: { gte: Date; lt: Date };
        openIdRecordId?: { in: string[] };
      };
      orderBy?: { eventTime: 'asc' | 'desc' };
    }): Promise<
      Array<{
        id: string;
        gameId: string;
        openIdRecordId: string | null;
        rawCostLi: bigint;
        eventTime: Date;
      }>
    >;
  };
  game: {
    findMany(args: {
      where?: { deletedAt: null; companyId?: string };
    }): Promise<
      Array<{
        id: string;
        companyId: string;
        gameAppId: string;
        name: string;
        deletedAt: Date | null;
      }>
    >;
    findUnique(args: { where: { id: string } }): Promise<{
      id: string;
      companyId: string;
      gameAppId: string;
      name: string;
    } | null>;
  };
  company: {
    findMany(args: {
      where?: { deletedAt: null };
    }): Promise<
      Array<{ id: string; name: string; deletedAt: Date | null }>
    >;
    findUnique(args: { where: { id: string } }): Promise<{
      id: string;
      name: string;
    } | null>;
  };
  gameOpenId: {
    findMany(args: {
      where?: { gameId?: string; userId?: { in: string[] } };
    }): Promise<
      Array<{
        id: string;
        userId: string | null;
        gameId: string;
        readableId: string;
      }>
    >;
  };
  userAccount: {
    findMany(args: {
      where: { id: { in: string[] } };
    }): Promise<
      Array<{ id: string; readableId: string }>
    >;
  };
  kuaishouEcpmSyncJob: {
    findMany(args: {
      where?: {
        status?: 'RUNNING' | 'SUCCEEDED' | 'FAILED';
        finishedAt?: { gte: Date };
      };
      orderBy?: { finishedAt: 'desc' };
    }): Promise<
      Array<{
        id: string;
        gameAppId: string;
        status: 'RUNNING' | 'SUCCEEDED' | 'FAILED';
        finishedAt: Date | null;
        errorMessage: string | null;
      }>
    >;
  };
};

@Injectable()
export class SuperAdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(input: { range: Range }): Promise<SuperAdminOverview> {
    const prisma = this.prisma as unknown as DashboardPrisma;

    const todayRecords = await prisma.rawEcpm.findMany({
      where: {
        eventTime: { gte: input.range.startAt, lt: input.range.endAt },
      },
    });
    const allGames = await prisma.game.findMany({ where: { deletedAt: null } });
    const allOpenIds = await prisma.gameOpenId.findMany({ where: {} });

    const todayCount = todayRecords.length;
    const ecpmYuanValues = todayRecords.map(
      (r) => Number(r.rawCostLi) / LI_PER_YUAN,
    );
    const todayAverageEcpmYuan = average(ecpmYuanValues);
    const todayMaxEcpmYuan =
      ecpmYuanValues.length === 0 ? 0 : Math.max(...ecpmYuanValues);

    const activeGameIds = new Set(todayRecords.map((r) => r.gameId));
    const activeAccountIds = new Set(
      todayRecords
        .map((r) => r.openIdRecordId)
        .filter((x): x is string => Boolean(x)),
    );
    const activeUserIds = new Set<string>();
    for (const accountId of activeAccountIds) {
      const matched = allOpenIds.find((o) => o.id === accountId);
      if (matched?.userId) activeUserIds.add(matched.userId);
    }

    return {
      todayCount,
      todayAverageEcpmYuan,
      todayMaxEcpmYuan,
      activeGameCount: activeGameIds.size,
      totalGameCount: allGames.length,
      activeUserCount: activeUserIds.size,
    };
  }

  async getCompanyDistribution(input: {
    range: Range;
  }): Promise<SuperAdminCompanyRow[]> {
    const prisma = this.prisma as unknown as DashboardPrisma;

    const [todayRecords, allGames, allCompanies, allOpenIds] =
      await Promise.all([
        prisma.rawEcpm.findMany({
          where: {
            eventTime: { gte: input.range.startAt, lt: input.range.endAt },
          },
        }),
        prisma.game.findMany({ where: { deletedAt: null } }),
        prisma.company.findMany({ where: { deletedAt: null } }),
        prisma.gameOpenId.findMany({ where: {} }),
      ]);

    const gameById = new Map(allGames.map((g) => [g.id, g]));

    const rows: SuperAdminCompanyRow[] = allCompanies.map((company) => {
      const companyGames = allGames.filter((g) => g.companyId === company.id);
      const companyGameIds = new Set(companyGames.map((g) => g.id));

      const companyRecords = todayRecords.filter((r) =>
        companyGameIds.has(r.gameId),
      );
      const ecpmCount = companyRecords.length;
      const yuanValues = companyRecords.map(
        (r) => Number(r.rawCostLi) / LI_PER_YUAN,
      );

      const activeGameIds = new Set(companyRecords.map((r) => r.gameId));
      const activeAccountIds = new Set(
        companyRecords
          .map((r) => r.openIdRecordId)
          .filter((x): x is string => Boolean(x)),
      );
      const activeUserIds = new Set<string>();
      for (const accountId of activeAccountIds) {
        const matched = allOpenIds.find((o) => o.id === accountId);
        if (matched?.userId) activeUserIds.add(matched.userId);
      }

      return {
        companyId: company.id,
        companyName: company.name,
        ecpmCount,
        activeGameCount: activeGameIds.size,
        totalGameCount: companyGames.length,
        activeUserCount: activeUserIds.size,
        averageEcpmYuan: average(yuanValues),
        maxEcpmYuan: yuanValues.length === 0 ? 0 : Math.max(...yuanValues),
      };
    });

    void gameById;
    return rows.sort((a, b) => b.ecpmCount - a.ecpmCount);
  }

  async listGamesUnderCompany(input: {
    companyId: string;
    range: Range;
  }): Promise<{
    company: { id: string; name: string };
    games: GameRow[];
  }> {
    const prisma = this.prisma as unknown as DashboardPrisma;
    const company = await prisma.company.findUnique({
      where: { id: input.companyId },
    });
    if (!company) {
      throw new Error(`Company ${input.companyId} not found`);
    }

    const games = await prisma.game.findMany({
      where: { deletedAt: null, companyId: input.companyId },
    });
    if (games.length === 0) {
      return { company: { id: company.id, name: company.name }, games: [] };
    }

    const gameIds = games.map((g) => g.id);
    const todayRecords = await prisma.rawEcpm.findMany({
      where: {
        gameId: { in: gameIds },
        eventTime: { gte: input.range.startAt, lt: input.range.endAt },
      },
    });
    const allOpenIds = await prisma.gameOpenId.findMany({ where: {} });
    const openIdById = new Map(allOpenIds.map((o) => [o.id, o]));

    const rows: GameRow[] = games.map((game) => {
      const gameRecords = todayRecords.filter((r) => r.gameId === game.id);
      const yuanValues = gameRecords.map(
        (r) => Number(r.rawCostLi) / LI_PER_YUAN,
      );
      const userIds = new Set<string>();
      for (const r of gameRecords) {
        if (!r.openIdRecordId) continue;
        const o = openIdById.get(r.openIdRecordId);
        if (o?.userId) userIds.add(o.userId);
      }
      return {
        gameId: game.id,
        gameName: game.name,
        ecpmCount: gameRecords.length,
        activeUserCount: userIds.size,
        averageEcpmYuan: average(yuanValues),
        maxEcpmYuan: yuanValues.length === 0 ? 0 : Math.max(...yuanValues),
      };
    });

    return {
      company: { id: company.id, name: company.name },
      games: rows.sort((a, b) => b.ecpmCount - a.ecpmCount),
    };
  }

  async listUsersUnderGame(input: {
    gameId: string;
    range: Range;
  }): Promise<{
    company: { id: string; name: string };
    game: { id: string; name: string };
    users: UnderGameUserRow[];
  }> {
    const prisma = this.prisma as unknown as DashboardPrisma;

    const game = await prisma.game.findUnique({ where: { id: input.gameId } });
    if (!game) {
      throw new Error(`Game ${input.gameId} not found`);
    }
    const company = await prisma.company.findUnique({
      where: { id: game.companyId },
    });
    if (!company) {
      throw new Error(`Company ${game.companyId} not found`);
    }

    const openIds = await prisma.gameOpenId.findMany({
      where: { gameId: input.gameId },
    });
    if (openIds.length === 0) {
      return {
        company: { id: company.id, name: company.name },
        game: { id: game.id, name: game.name },
        users: [],
      };
    }

    const todayRecords = await prisma.rawEcpm.findMany({
      where: {
        gameId: input.gameId,
        eventTime: { gte: input.range.startAt, lt: input.range.endAt },
      },
    });
    const allRecords = await prisma.rawEcpm.findMany({
      where: { gameId: input.gameId },
      orderBy: { eventTime: 'desc' },
    });

    const userIds = Array.from(
      new Set(
        openIds.map((o) => o.userId).filter((x): x is string => Boolean(x)),
      ),
    );
    const users =
      userIds.length === 0
        ? []
        : await prisma.userAccount.findMany({ where: { id: { in: userIds } } });
    const userById = new Map(users.map((u) => [u.id, u]));

    const userRows: UnderGameUserRow[] = userIds
      .map((userId) => {
        const userOpenIdSet = new Set(
          openIds.filter((o) => o.userId === userId).map((o) => o.id),
        );
        const userTodayRecords = todayRecords.filter(
          (r) => r.openIdRecordId && userOpenIdSet.has(r.openIdRecordId),
        );
        const userAllRecords = allRecords.filter(
          (r) => r.openIdRecordId && userOpenIdSet.has(r.openIdRecordId),
        );
        const yuanValues = userTodayRecords.map(
          (r) => Number(r.rawCostLi) / LI_PER_YUAN,
        );
        return {
          userId,
          readableId: userById.get(userId)?.readableId ?? '',
          ecpmCount: userTodayRecords.length,
          averageEcpmYuan: average(yuanValues),
          maxEcpmYuan: yuanValues.length === 0 ? 0 : Math.max(...yuanValues),
          lastActiveAt: userAllRecords[0]?.eventTime ?? null,
        };
      })
      .sort((a, b) => b.ecpmCount - a.ecpmCount);

    return {
      company: { id: company.id, name: company.name },
      game: { id: game.id, name: game.name },
      users: userRows,
    };
  }

  async getAnomalies(): Promise<SuperAdminAnomalies> {
    const prisma = this.prisma as unknown as DashboardPrisma;
    const now = Date.now();

    const since = new Date(now - HOURS_FOR_SYNC_FAILURE_WINDOW * 60 * 60 * 1000);
    const failedJobs = await prisma.kuaishouEcpmSyncJob.findMany({
      where: { status: 'FAILED', finishedAt: { gte: since } },
      orderBy: { finishedAt: 'desc' },
    });

    const allGames = await prisma.game.findMany({ where: { deletedAt: null } });
    const gameByAppId = new Map(allGames.map((g) => [g.gameAppId, g]));

    const seenAppIds = new Set<string>();
    const syncFailures = failedJobs
      .filter((job) => {
        if (seenAppIds.has(job.gameAppId)) return false;
        seenAppIds.add(job.gameAppId);
        return true;
      })
      .map((job) => ({
        gameAppId: job.gameAppId,
        gameName: gameByAppId.get(job.gameAppId)?.name ?? job.gameAppId,
        jobId: job.id,
        failedAt: job.finishedAt ?? new Date(0),
        errorMessage: job.errorMessage,
      }));

    const allRecords = await prisma.rawEcpm.findMany({
      orderBy: { eventTime: 'desc' },
    });
    const lastByGame = new Map<string, Date>();
    for (const r of allRecords) {
      if (!lastByGame.has(r.gameId)) lastByGame.set(r.gameId, r.eventTime);
    }

    const longSilent = allGames
      .map((game) => {
        const last = lastByGame.get(game.id);
        const hours = last
          ? (now - last.getTime()) / (60 * 60 * 1000)
          : Number.POSITIVE_INFINITY;
        return { gameId: game.id, gameName: game.name, hoursSinceLastEcpm: hours };
      })
      .filter((x) => x.hoursSinceLastEcpm >= HOURS_FOR_LONG_SILENT)
      .sort((a, b) => b.hoursSinceLastEcpm - a.hoursSinceLastEcpm);

    return { syncFailures, longSilent };
  }
}

function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((sum, n) => sum + n, 0) / nums.length;
}
