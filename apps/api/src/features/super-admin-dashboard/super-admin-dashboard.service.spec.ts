import { SuperAdminDashboardService } from './super-admin-dashboard.service';

type FakeGame = {
  id: string;
  companyId: string;
  gameAppId: string;
  name: string;
  deletedAt: Date | null;
};
type FakeCompany = { id: string; name: string; deletedAt: Date | null };
type FakeOpenId = { id: string; userId: string | null; gameId: string };
type FakeRawEcpm = {
  id: string;
  gameId: string;
  openIdRecordId: string | null;
  rawCostLi: bigint;
  eventTime: Date;
};
type FakeSyncJob = {
  id: string;
  gameAppId: string;
  status: 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  finishedAt: Date | null;
  errorMessage: string | null;
};

type FakeUser = { id: string; readableId: string };

function makeFakePrisma(seed: {
  games: FakeGame[];
  companies: FakeCompany[];
  openIds: FakeOpenId[];
  rawEcpms: FakeRawEcpm[];
  syncJobs?: FakeSyncJob[];
  users?: FakeUser[];
}) {
  return {
    rawEcpm: {
      findMany: async ({
        where,
        orderBy,
      }: {
        where?: {
          gameId?: string | { in: string[] };
          eventTime?: { gte: Date; lt: Date };
          openIdRecordId?: { in: string[] };
        };
        orderBy?: { eventTime: 'asc' | 'desc' };
      }) => {
        let rows = seed.rawEcpms.slice();
        if (where?.gameId) {
          if (typeof where.gameId === 'string') {
            rows = rows.filter((r) => r.gameId === where.gameId);
          } else {
            const ids = new Set(where.gameId.in);
            rows = rows.filter((r) => ids.has(r.gameId));
          }
        }
        if (where?.openIdRecordId?.in) {
          const ids = new Set(where.openIdRecordId.in);
          rows = rows.filter((r) => r.openIdRecordId && ids.has(r.openIdRecordId));
        }
        if (where?.eventTime) {
          rows = rows.filter(
            (r) =>
              r.eventTime >= where.eventTime!.gte &&
              r.eventTime < where.eventTime!.lt,
          );
        }
        if (orderBy?.eventTime === 'desc') {
          rows.sort((a, b) => b.eventTime.getTime() - a.eventTime.getTime());
        }
        return rows;
      },
    },
    game: {
      findMany: async ({
        where,
      }: { where?: { deletedAt: null; companyId?: string } } = {}) =>
        seed.games.filter(
          (g) =>
            g.deletedAt === null &&
            (where?.companyId ? g.companyId === where.companyId : true),
        ),
      findUnique: async ({ where }: { where: { id: string } }) =>
        seed.games.find((g) => g.id === where.id) ?? null,
    },
    company: {
      findMany: async () =>
        seed.companies.filter((c) => c.deletedAt === null),
      findUnique: async ({ where }: { where: { id: string } }) =>
        seed.companies.find((c) => c.id === where.id) ?? null,
    },
    gameOpenId: {
      findMany: async ({
        where,
      }: { where?: { gameId?: string; userId?: { in: string[] } } } = {}) => {
        let rows = seed.openIds.slice();
        if (where?.gameId) {
          rows = rows.filter((o) => o.gameId === where.gameId);
        }
        if (where?.userId) {
          const ids = new Set(where.userId.in);
          rows = rows.filter((o) => o.userId && ids.has(o.userId));
        }
        return rows.map((o) => ({ ...o, readableId: `R-${o.id}` }));
      },
    },
    userAccount: {
      findMany: async ({ where }: { where: { id: { in: string[] } } }) => {
        const ids = new Set(where.id.in);
        return (seed.users ?? []).filter((u) => ids.has(u.id));
      },
    },
    kuaishouEcpmSyncJob: {
      findMany: async ({
        where,
        orderBy,
      }: {
        where?: { status?: string; finishedAt?: { gte: Date } };
        orderBy?: { finishedAt: 'desc' };
      }) => {
        let rows = (seed.syncJobs ?? []).slice();
        if (where?.status) {
          rows = rows.filter((j) => j.status === where.status);
        }
        if (where?.finishedAt) {
          rows = rows.filter(
            (j) => j.finishedAt && j.finishedAt >= where.finishedAt!.gte,
          );
        }
        if (orderBy?.finishedAt === 'desc') {
          rows.sort(
            (a, b) =>
              (b.finishedAt?.getTime() ?? 0) - (a.finishedAt?.getTime() ?? 0),
          );
        }
        return rows;
      },
    },
  } as never;
}

const TODAY = new Date('2026-05-11T00:00:00+08:00');
const TOMORROW = new Date('2026-05-12T00:00:00+08:00');

const baseSeed = {
  companies: [
    { id: 'c1', name: 'XX 互娱', deletedAt: null },
    { id: 'c2', name: 'YY 网络', deletedAt: null },
  ] as FakeCompany[],
  games: [
    { id: 'g1', companyId: 'c1', gameAppId: 'app1', name: '消消乐', deletedAt: null },
    { id: 'g2', companyId: 'c1', gameAppId: 'app2', name: '割草', deletedAt: null },
    { id: 'g3', companyId: 'c2', gameAppId: 'app3', name: '西瓜', deletedAt: null },
  ] as FakeGame[],
  openIds: [
    { id: 'o1', userId: 'u1', gameId: 'g1' },
    { id: 'o2', userId: 'u2', gameId: 'g1' },
    { id: 'o3', userId: 'u3', gameId: 'g3' },
  ] as FakeOpenId[],
  rawEcpms: [
    { id: 'r1', gameId: 'g1', openIdRecordId: 'o1', rawCostLi: 45200n, eventTime: new Date('2026-05-11T14:00:00+08:00') },
    { id: 'r2', gameId: 'g1', openIdRecordId: 'o2', rawCostLi: 38000n, eventTime: new Date('2026-05-11T13:00:00+08:00') },
    { id: 'r3', gameId: 'g3', openIdRecordId: 'o3', rawCostLi: 32000n, eventTime: new Date('2026-05-11T10:00:00+08:00') },
  ] as FakeRawEcpm[],
};

describe('SuperAdminDashboardService.getOverview', () => {
  it('返回全平台 KPI', async () => {
    const prisma = makeFakePrisma(baseSeed);
    const service = new SuperAdminDashboardService(prisma);

    const overview = await service.getOverview({
      range: { startAt: TODAY, endAt: TOMORROW },
    });

    expect(overview.todayCount).toBe(3);
    expect(overview.todayAverageEcpmYuan).toBeCloseTo(38.4, 1);
    expect(overview.todayMaxEcpmYuan).toBeCloseTo(45.2, 1);
    expect(overview.activeGameCount).toBe(2);
    expect(overview.totalGameCount).toBe(3);
    expect(overview.activeUserCount).toBe(3);
  });

  it('无数据时返回 0', async () => {
    const prisma = makeFakePrisma({
      ...baseSeed,
      rawEcpms: [],
    });
    const service = new SuperAdminDashboardService(prisma);

    const overview = await service.getOverview({
      range: { startAt: TODAY, endAt: TOMORROW },
    });

    expect(overview.todayCount).toBe(0);
    expect(overview.todayAverageEcpmYuan).toBe(0);
    expect(overview.activeGameCount).toBe(0);
    expect(overview.activeUserCount).toBe(0);
    expect(overview.totalGameCount).toBe(3);
  });
});

describe('SuperAdminDashboardService.getCompanyDistribution', () => {
  it('按公司聚合并按 ECPM 条数降序', async () => {
    const prisma = makeFakePrisma(baseSeed);
    const service = new SuperAdminDashboardService(prisma);

    const rows = await service.getCompanyDistribution({
      range: { startAt: TODAY, endAt: TOMORROW },
    });

    expect(rows.map((r) => r.companyId)).toEqual(['c1', 'c2']);
    const xx = rows[0];
    expect(xx.companyName).toBe('XX 互娱');
    expect(xx.ecpmCount).toBe(2);
    expect(xx.activeGameCount).toBe(1);
    expect(xx.totalGameCount).toBe(2);
    expect(xx.activeUserCount).toBe(2);
    expect(xx.averageEcpmYuan).toBeCloseTo(41.6, 1);
    expect(xx.maxEcpmYuan).toBeCloseTo(45.2, 1);

    const yy = rows[1];
    expect(yy.ecpmCount).toBe(1);
  });
});

describe('SuperAdminDashboardService.listGamesUnderCompany', () => {
  it('返回某公司下游戏的 ECPM 聚合，按 ECPM 条数降序', async () => {
    const prisma = makeFakePrisma(baseSeed);
    const service = new SuperAdminDashboardService(prisma);

    const result = await service.listGamesUnderCompany({
      companyId: 'c1',
      range: { startAt: TODAY, endAt: TOMORROW },
    });

    expect(result.company.name).toBe('XX 互娱');
    expect(result.games).toHaveLength(2);
    expect(result.games[0].gameId).toBe('g1');
    expect(result.games[0].ecpmCount).toBe(2);
    expect(result.games[0].activeUserCount).toBe(2);
    expect(result.games[0].averageEcpmYuan).toBeCloseTo(41.6, 1);
  });

  it('公司不存在时抛错', async () => {
    const prisma = makeFakePrisma(baseSeed);
    const service = new SuperAdminDashboardService(prisma);
    await expect(
      service.listGamesUnderCompany({
        companyId: 'nope',
        range: { startAt: TODAY, endAt: TOMORROW },
      }),
    ).rejects.toThrow();
  });
});

describe('SuperAdminDashboardService.listUsersUnderGame', () => {
  it('返回某游戏下用户的 ECPM 聚合', async () => {
    const seedWithUsers = {
      ...baseSeed,
      users: [
        { id: 'u1', readableId: 'A8F3D2K' },
        { id: 'u2', readableId: 'B7C2E91' },
      ],
    };
    const prisma = makeFakePrisma(seedWithUsers);
    const service = new SuperAdminDashboardService(prisma);

    const result = await service.listUsersUnderGame({
      gameId: 'g1',
      range: { startAt: TODAY, endAt: TOMORROW },
    });

    expect(result.game.name).toBe('消消乐');
    expect(result.company.name).toBe('XX 互娱');
    expect(result.users).toHaveLength(2);
    expect(result.users[0].readableId).toBe('A8F3D2K');
    expect(result.users[0].ecpmCount).toBe(1);
  });
});

describe('SuperAdminDashboardService.getAnomalies', () => {
  it('返回最近失败任务（去重）和长时间无数据游戏', async () => {
    const recentFail = new Date(Date.now() - 30 * 60 * 1000);
    const oldFail = new Date(Date.now() - 25 * 60 * 60 * 1000);
    const oldEcpm = new Date(Date.now() - 8 * 60 * 60 * 1000);

    const prisma = makeFakePrisma({
      ...baseSeed,
      rawEcpms: [
        { id: 'r-old', gameId: 'g2', openIdRecordId: null, rawCostLi: 30000n, eventTime: oldEcpm },
      ],
      syncJobs: [
        { id: 'j1', gameAppId: 'app1', status: 'FAILED', finishedAt: recentFail, errorMessage: '认证失败' },
        { id: 'j2', gameAppId: 'app1', status: 'FAILED', finishedAt: new Date(Date.now() - 10 * 60 * 1000), errorMessage: '同左' },
        { id: 'j3', gameAppId: 'app3', status: 'FAILED', finishedAt: oldFail, errorMessage: '已过期' },
      ],
    });
    const service = new SuperAdminDashboardService(prisma);

    const anomalies = await service.getAnomalies();

    expect(anomalies.syncFailures.map((f) => f.gameAppId)).toEqual(['app1']);
    expect(anomalies.syncFailures[0].gameName).toBe('消消乐');
    expect(anomalies.longSilent.map((s) => s.gameId)).toEqual(
      expect.arrayContaining(['g1', 'g2', 'g3']),
    );
    expect(anomalies.longSilent.length).toBeGreaterThanOrEqual(3);
  });
});
