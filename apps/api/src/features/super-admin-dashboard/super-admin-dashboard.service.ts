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

type DashboardPrisma = {
  rawEcpm: {
    findMany(args: {
      where?: { eventTime?: { gte: Date; lt: Date } };
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
      where?: { deletedAt: null };
    }): Promise<
      Array<{
        id: string;
        companyId: string;
        gameAppId: string;
        name: string;
        deletedAt: Date | null;
      }>
    >;
  };
  company: {
    findMany(args: {
      where?: { deletedAt: null };
    }): Promise<
      Array<{ id: string; name: string; deletedAt: Date | null }>
    >;
  };
  gameOpenId: {
    findMany(args: { where?: object }): Promise<
      Array<{ id: string; userId: string | null; gameId: string }>
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
