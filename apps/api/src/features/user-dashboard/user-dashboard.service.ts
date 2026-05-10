import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LI_PER_YUAN } from '../../domain/money/amount';

const ACTIVE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

export type Range = { startAt: Date; endAt: Date };

export type UserDashboardOverview = {
  todayCount: number;
  todayAverageEcpmYuan: number;
  todayMaxEcpmYuan: number;
  gameCount: number;
  accountCount: number;
  activeGameCount: number;
  activeAccountCount: number;
};

export type AccountActiveStatus = 'ACTIVE' | 'IDLE' | 'NEVER';

export type GameAccountRow = {
  accountId: string;
  readableId: string;
  todayCount: number;
  todayAverageEcpmYuan: number;
  totalCount: number;
  lastActiveAt: Date | null;
  activeStatus: AccountActiveStatus;
};

export type GameGroupRow = {
  gameId: string;
  gameName: string;
  todayCount: number;
  todayAverageEcpmYuan: number;
  totalCount: number;
  lastActiveAt: Date | null;
  accounts: GameAccountRow[];
};

type DashboardPrisma = {
  gameOpenId: {
    findMany(args: {
      where: { userId: string };
      include?: { game: true };
    }): Promise<
      Array<{
        id: string;
        gameId: string;
        userId: string | null;
        openId: string;
        readableId: string;
        createdAt: Date;
        game?: { id: string; name: string };
      }>
    >;
  };
  rawEcpm: {
    findMany(args: {
      where: {
        openIdRecordId?: { in: string[] };
        eventTime?: { gte: Date; lt: Date };
      };
      orderBy?: { eventTime: 'asc' | 'desc' };
    }): Promise<
      Array<{
        id: string;
        openIdRecordId: string | null;
        rawCostLi: bigint;
        eventTime: Date;
      }>
    >;
  };
};

@Injectable()
export class UserDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(input: {
    userId: string;
    range: Range;
  }): Promise<UserDashboardOverview> {
    const prisma = this.prisma as unknown as DashboardPrisma;
    const openIds = await prisma.gameOpenId.findMany({
      where: { userId: input.userId },
    });

    if (openIds.length === 0) {
      return emptyOverview();
    }

    const recordIds = openIds.map((o) => o.id);
    const todayRecords = await prisma.rawEcpm.findMany({
      where: {
        openIdRecordId: { in: recordIds },
        eventTime: { gte: input.range.startAt, lt: input.range.endAt },
      },
    });

    const todayCount = todayRecords.length;
    const ecpmYuanValues = todayRecords.map(
      (r) => Number(r.rawCostLi) / LI_PER_YUAN,
    );
    const todayAverageEcpmYuan = average(ecpmYuanValues);
    const todayMaxEcpmYuan =
      ecpmYuanValues.length === 0 ? 0 : Math.max(...ecpmYuanValues);

    const gameIds = new Set(openIds.map((o) => o.gameId));
    const accountIds = new Set(openIds.map((o) => o.id));
    const activeGameIds = new Set<string>();
    const activeAccountIds = new Set<string>();
    for (const r of todayRecords) {
      if (!r.openIdRecordId) continue;
      activeAccountIds.add(r.openIdRecordId);
      const matched = openIds.find((o) => o.id === r.openIdRecordId);
      if (matched) activeGameIds.add(matched.gameId);
    }

    return {
      todayCount,
      todayAverageEcpmYuan,
      todayMaxEcpmYuan,
      gameCount: gameIds.size,
      accountCount: accountIds.size,
      activeGameCount: activeGameIds.size,
      activeAccountCount: activeAccountIds.size,
    };
  }

  async getGameAccountGroups(input: {
    userId: string;
    range: Range;
  }): Promise<GameGroupRow[]> {
    const prisma = this.prisma as unknown as DashboardPrisma;
    const openIds = await prisma.gameOpenId.findMany({
      where: { userId: input.userId },
      include: { game: true },
    });

    if (openIds.length === 0) return [];

    const recordIds = openIds.map((o) => o.id);
    const allRecords = await prisma.rawEcpm.findMany({
      where: { openIdRecordId: { in: recordIds } },
      orderBy: { eventTime: 'desc' },
    });

    const todayWindow = (eventTime: Date) =>
      eventTime >= input.range.startAt && eventTime < input.range.endAt;

    const groupsByGameId = new Map<string, GameGroupRow>();
    for (const openId of openIds) {
      const accountRecords = allRecords.filter(
        (r) => r.openIdRecordId === openId.id,
      );
      const todayRecords = accountRecords.filter((r) => todayWindow(r.eventTime));
      const todayEcpmValues = todayRecords.map(
        (r) => Number(r.rawCostLi) / LI_PER_YUAN,
      );
      const lastActiveAt = accountRecords[0]?.eventTime ?? null;
      const account: GameAccountRow = {
        accountId: openId.id,
        readableId: openId.readableId,
        todayCount: todayRecords.length,
        todayAverageEcpmYuan: average(todayEcpmValues),
        totalCount: accountRecords.length,
        lastActiveAt,
        activeStatus: classifyStatus(lastActiveAt),
      };

      let group = groupsByGameId.get(openId.gameId);
      if (!group) {
        group = {
          gameId: openId.gameId,
          gameName: openId.game?.name ?? '',
          todayCount: 0,
          todayAverageEcpmYuan: 0,
          totalCount: 0,
          lastActiveAt: null,
          accounts: [],
        };
        groupsByGameId.set(openId.gameId, group);
      }
      group.accounts.push(account);
    }

    for (const group of groupsByGameId.values()) {
      group.todayCount = group.accounts.reduce(
        (sum, a) => sum + a.todayCount,
        0,
      );
      group.totalCount = group.accounts.reduce(
        (sum, a) => sum + a.totalCount,
        0,
      );
      group.lastActiveAt = group.accounts
        .map((a) => a.lastActiveAt)
        .filter((x): x is Date => x !== null)
        .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

      const todayEcpmAcrossAccounts = group.accounts.flatMap((a) =>
        a.todayCount === 0
          ? []
          : Array.from({ length: a.todayCount }, () => a.todayAverageEcpmYuan),
      );
      group.todayAverageEcpmYuan = average(todayEcpmAcrossAccounts);
    }

    return Array.from(groupsByGameId.values()).sort(
      (a, b) => b.todayCount - a.todayCount,
    );
  }
}

function emptyOverview(): UserDashboardOverview {
  return {
    todayCount: 0,
    todayAverageEcpmYuan: 0,
    todayMaxEcpmYuan: 0,
    gameCount: 0,
    accountCount: 0,
    activeGameCount: 0,
    activeAccountCount: 0,
  };
}

function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((sum, n) => sum + n, 0) / nums.length;
}

function classifyStatus(lastActiveAt: Date | null): AccountActiveStatus {
  if (!lastActiveAt) return 'NEVER';
  return Date.now() - lastActiveAt.getTime() < ACTIVE_THRESHOLD_MS
    ? 'ACTIVE'
    : 'IDLE';
}
