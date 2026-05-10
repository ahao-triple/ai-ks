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

export type EcpmRecordRow = {
  id: string;
  todaySequence: number;
  eventTime: Date;
  ecpmYuan: number;
  gameId: string;
  gameName: string;
  accountId: string;
  accountReadableId: string;
  source: 'kuaishou';
};

export type EcpmRecordsResult = {
  records: EcpmRecordRow[];
  totalToday: number;
  totalAll: number;
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
        gameId?: string;
        eventTime?: { gte: Date; lt: Date };
      };
      orderBy?: { eventTime: 'asc' | 'desc' };
      take?: number;
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

  async listEcpmRecords(input: {
    userId: string;
    range: Range;
    limit: number;
    gameId?: string;
    accountId?: string;
  }): Promise<EcpmRecordsResult> {
    const prisma = this.prisma as unknown as DashboardPrisma;
    const openIds = await prisma.gameOpenId.findMany({
      where: { userId: input.userId },
      include: { game: true },
    });

    if (openIds.length === 0) {
      return { records: [], totalToday: 0, totalAll: 0 };
    }

    let recordIds = openIds.map((o) => o.id);
    if (input.accountId) {
      recordIds = recordIds.filter((id) => id === input.accountId);
    }
    if (recordIds.length === 0) {
      return { records: [], totalToday: 0, totalAll: 0 };
    }

    const filterWhere = {
      openIdRecordId: { in: recordIds },
      ...(input.gameId ? { gameId: input.gameId } : {}),
    };

    const allMatching = await prisma.rawEcpm.findMany({
      where: filterWhere,
      orderBy: { eventTime: 'desc' },
    });
    const totalAll = allMatching.length;

    const todayMatching = allMatching.filter(
      (r) =>
        r.eventTime >= input.range.startAt && r.eventTime < input.range.endAt,
    );
    const totalToday = todayMatching.length;

    const todayAsc = todayMatching
      .slice()
      .sort((a, b) => a.eventTime.getTime() - b.eventTime.getTime());
    const sequenceById = new Map<string, number>();
    todayAsc.forEach((r, idx) => sequenceById.set(r.id, idx + 1));

    const limited = allMatching.slice(0, input.limit);
    const openIdById = new Map(openIds.map((o) => [o.id, o]));

    const records: EcpmRecordRow[] = limited.map((r) => {
      const openId = openIdById.get(r.openIdRecordId ?? '');
      return {
        id: r.id,
        todaySequence: sequenceById.get(r.id) ?? 0,
        eventTime: r.eventTime,
        ecpmYuan: Number(r.rawCostLi) / LI_PER_YUAN,
        gameId: r.gameId,
        gameName: openId?.game?.name ?? '',
        accountId: r.openIdRecordId ?? '',
        accountReadableId: openId?.readableId ?? '',
        source: 'kuaishou',
      };
    });

    return { records, totalToday, totalAll };
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
