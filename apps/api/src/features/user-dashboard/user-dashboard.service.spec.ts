import { UserDashboardService } from './user-dashboard.service';

type FakeOpenId = {
  id: string;
  gameId: string;
  userId: string | null;
  openId: string;
  readableId: string;
  createdAt: Date;
};

type FakeRawEcpm = {
  id: string;
  gameId?: string;
  openIdRecordId: string;
  rawCostLi: bigint;
  eventTime: Date;
};

type FakeGame = { id: string; name: string };

function makeFakePrisma(seed: {
  games: FakeGame[];
  openIds: FakeOpenId[];
  rawEcpms: FakeRawEcpm[];
}) {
  return {
    gameOpenId: {
      findMany: async ({
        where,
        include,
      }: {
        where: { userId: string };
        include?: { game: true };
      }) => {
        const matched = seed.openIds.filter((o) => o.userId === where.userId);
        if (include?.game) {
          return matched.map((o) => ({
            ...o,
            game: seed.games.find((g) => g.id === o.gameId) ?? {
              id: o.gameId,
              name: '',
            },
          }));
        }
        return matched;
      },
    },
    rawEcpm: {
      findMany: async ({
        where,
        orderBy,
        take,
      }: {
        where: {
          openIdRecordId?: { in: string[] };
          gameId?: string;
          eventTime?: { gte: Date; lt: Date };
        };
        orderBy?: { eventTime: 'asc' | 'desc' };
        take?: number;
      }) => {
        let rows = seed.rawEcpms.slice().map((r) => {
          const matched = seed.openIds.find((o) => o.id === r.openIdRecordId);
          return { ...r, gameId: r.gameId ?? matched?.gameId ?? '' };
        });
        if (where.openIdRecordId?.in) {
          const ids = new Set(where.openIdRecordId.in);
          rows = rows.filter((r) => ids.has(r.openIdRecordId));
        }
        if (where.gameId) {
          rows = rows.filter((r) => r.gameId === where.gameId);
        }
        if (where.eventTime) {
          rows = rows.filter(
            (r) =>
              r.eventTime >= where.eventTime!.gte &&
              r.eventTime < where.eventTime!.lt,
          );
        }
        if (orderBy?.eventTime === 'desc') {
          rows.sort((a, b) => b.eventTime.getTime() - a.eventTime.getTime());
        } else if (orderBy?.eventTime === 'asc') {
          rows.sort((a, b) => a.eventTime.getTime() - b.eventTime.getTime());
        }
        if (typeof take === 'number') rows = rows.slice(0, take);
        return rows;
      },
    },
  } as never;
}

const TODAY = new Date('2026-05-11T00:00:00+08:00');
const TOMORROW = new Date('2026-05-12T00:00:00+08:00');

function todayAt(time: string): Date {
  return new Date(`2026-05-11T${time}+08:00`);
}

const baseSeed = {
  games: [
    { id: 'g1', name: '消消乐 Pro' },
    { id: 'g2', name: '合成大西瓜' },
  ],
  openIds: [
    { id: 'o1', gameId: 'g1', userId: 'u1', openId: 'open-1', readableId: 'A8F3D2K', createdAt: TODAY },
    { id: 'o2', gameId: 'g1', userId: 'u1', openId: 'open-2', readableId: 'B7C2E91', createdAt: TODAY },
    { id: 'o3', gameId: 'g2', userId: 'u1', openId: 'open-3', readableId: 'C2A5F33', createdAt: TODAY },
  ] as FakeOpenId[],
  rawEcpms: [
    { id: 'r1', openIdRecordId: 'o1', rawCostLi: 45200n, eventTime: todayAt('14:34:18') },
    { id: 'r2', openIdRecordId: 'o2', rawCostLi: 42800n, eventTime: todayAt('14:25:47') },
    { id: 'r3', openIdRecordId: 'o3', rawCostLi: 36500n, eventTime: todayAt('14:18:03') },
  ] as FakeRawEcpm[],
};

describe('UserDashboardService.getOverview', () => {
  it('返回今日 KPI、游戏数、账号数（基于 raw_ecpms 聚合）', async () => {
    const prisma = makeFakePrisma(baseSeed);
    const service = new UserDashboardService(prisma);

    const overview = await service.getOverview({
      userId: 'u1',
      range: { startAt: TODAY, endAt: TOMORROW },
    });

    expect(overview.todayCount).toBe(3);
    expect(overview.todayAverageEcpmYuan).toBeCloseTo(41.5, 1);
    expect(overview.todayMaxEcpmYuan).toBeCloseTo(45.2, 2);
    expect(overview.gameCount).toBe(2);
    expect(overview.accountCount).toBe(3);
    expect(overview.activeGameCount).toBe(2);
    expect(overview.activeAccountCount).toBe(3);
  });

  it('用户没有数据时返回 0 值结构', async () => {
    const prisma = makeFakePrisma({ games: [], openIds: [], rawEcpms: [] });
    const service = new UserDashboardService(prisma);

    const overview = await service.getOverview({
      userId: 'u-empty',
      range: { startAt: TODAY, endAt: TOMORROW },
    });

    expect(overview).toEqual({
      todayCount: 0,
      todayAverageEcpmYuan: 0,
      todayMaxEcpmYuan: 0,
      gameCount: 0,
      accountCount: 0,
      activeGameCount: 0,
      activeAccountCount: 0,
    });
  });

  it('有 open_id 但今日无 ECPM：账号数计入但今日条数为 0', async () => {
    const prisma = makeFakePrisma({
      ...baseSeed,
      rawEcpms: [
        {
          id: 'r-old',
          openIdRecordId: 'o1',
          rawCostLi: 30000n,
          eventTime: new Date('2026-05-09T14:00:00+08:00'),
        },
      ],
    });
    const service = new UserDashboardService(prisma);

    const overview = await service.getOverview({
      userId: 'u1',
      range: { startAt: TODAY, endAt: TOMORROW },
    });

    expect(overview.todayCount).toBe(0);
    expect(overview.gameCount).toBe(2);
    expect(overview.accountCount).toBe(3);
    expect(overview.activeGameCount).toBe(0);
    expect(overview.activeAccountCount).toBe(0);
  });
});

describe('UserDashboardService.getGameAccountGroups', () => {
  it('按游戏分组聚合账号信息，按今日条数降序', async () => {
    const prisma = makeFakePrisma(baseSeed);
    const service = new UserDashboardService(prisma);

    const groups = await service.getGameAccountGroups({
      userId: 'u1',
      range: { startAt: TODAY, endAt: TOMORROW },
    });

    expect(groups.map((g) => g.gameId)).toEqual(['g1', 'g2']);

    const xxl = groups.find((g) => g.gameId === 'g1')!;
    expect(xxl.gameName).toBe('消消乐 Pro');
    expect(xxl.todayCount).toBe(2);
    expect(xxl.totalCount).toBe(2);
    expect(xxl.accounts).toHaveLength(2);
    expect(xxl.accounts.find((a) => a.readableId === 'A8F3D2K')!.todayCount).toBe(1);
    expect(xxl.accounts.find((a) => a.readableId === 'B7C2E91')!.todayCount).toBe(1);

    const xigua = groups.find((g) => g.gameId === 'g2')!;
    expect(xigua.gameName).toBe('合成大西瓜');
    expect(xigua.accounts).toHaveLength(1);
    expect(xigua.accounts[0].todayAverageEcpmYuan).toBeCloseTo(36.5, 1);
  });

  it('用户没有 open_id 时返回空数组', async () => {
    const prisma = makeFakePrisma({ games: [], openIds: [], rawEcpms: [] });
    const service = new UserDashboardService(prisma);

    const groups = await service.getGameAccountGroups({
      userId: 'u-empty',
      range: { startAt: TODAY, endAt: TOMORROW },
    });

    expect(groups).toEqual([]);
  });

  it('从未活跃的账号 status = NEVER；超过 24 小时为 IDLE', async () => {
    const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const prisma = makeFakePrisma({
      games: [{ id: 'g1', name: 'Game' }],
      openIds: [
        { id: 'o-active', gameId: 'g1', userId: 'u1', openId: 'oa', readableId: 'AAAAAAA', createdAt: TODAY },
        { id: 'o-idle', gameId: 'g1', userId: 'u1', openId: 'ob', readableId: 'BBBBBBB', createdAt: TODAY },
        { id: 'o-never', gameId: 'g1', userId: 'u1', openId: 'oc', readableId: 'CCCCCCC', createdAt: TODAY },
      ],
      rawEcpms: [
        { id: 'r-fresh', openIdRecordId: 'o-active', rawCostLi: 30000n, eventTime: new Date() },
        { id: 'r-old', openIdRecordId: 'o-idle', rawCostLi: 30000n, eventTime: oldDate },
      ],
    });
    const service = new UserDashboardService(prisma);

    const groups = await service.getGameAccountGroups({
      userId: 'u1',
      range: { startAt: TODAY, endAt: TOMORROW },
    });

    const accounts = groups[0].accounts;
    expect(accounts.find((a) => a.readableId === 'AAAAAAA')!.activeStatus).toBe('ACTIVE');
    expect(accounts.find((a) => a.readableId === 'BBBBBBB')!.activeStatus).toBe('IDLE');
    expect(accounts.find((a) => a.readableId === 'CCCCCCC')!.activeStatus).toBe('NEVER');
  });
});

describe('UserDashboardService.listEcpmRecords', () => {
  const seedForRecords = {
    games: [
      { id: 'g1', name: '消消乐 Pro' },
      { id: 'g2', name: '合成大西瓜' },
    ],
    openIds: [
      { id: 'o1', gameId: 'g1', userId: 'u1', openId: 'open-1', readableId: 'A8F3D2K', createdAt: TODAY },
      { id: 'o2', gameId: 'g1', userId: 'u1', openId: 'open-2', readableId: 'B7C2E91', createdAt: TODAY },
      { id: 'o3', gameId: 'g2', userId: 'u1', openId: 'open-3', readableId: 'C2A5F33', createdAt: TODAY },
    ] as FakeOpenId[],
    rawEcpms: [
      { id: 'r1', openIdRecordId: 'o1', rawCostLi: 45200n, eventTime: todayAt('14:34:18') },
      { id: 'r2', openIdRecordId: 'o1', rawCostLi: 42800n, eventTime: todayAt('14:25:47') },
      { id: 'r3', openIdRecordId: 'o3', rawCostLi: 36500n, eventTime: todayAt('09:12:33') },
    ] as FakeRawEcpm[],
  };

  it('按时间倒序返回 ECPM 单条记录，每条带"今日序号"（按用户当天累计编号，从 1 开始）', async () => {
    const prisma = makeFakePrisma(seedForRecords);
    const service = new UserDashboardService(prisma);

    const result = await service.listEcpmRecords({
      userId: 'u1',
      range: { startAt: TODAY, endAt: TOMORROW },
      limit: 50,
    });

    expect(result.records).toHaveLength(3);
    expect(result.records[0].todaySequence).toBe(3);
    expect(result.records[2].todaySequence).toBe(1);
    expect(result.records[0].ecpmYuan).toBeCloseTo(45.2, 2);
    expect(result.records[0].gameName).toBe('消消乐 Pro');
    expect(result.records[0].accountReadableId).toBe('A8F3D2K');
    expect(result.totalToday).toBe(3);
    expect(result.totalAll).toBe(3);
  });

  it('支持按 gameId 筛选，序号在筛选后重新编号', async () => {
    const prisma = makeFakePrisma(seedForRecords);
    const service = new UserDashboardService(prisma);

    const result = await service.listEcpmRecords({
      userId: 'u1',
      range: { startAt: TODAY, endAt: TOMORROW },
      limit: 50,
      gameId: 'g2',
    });

    expect(result.records).toHaveLength(1);
    expect(result.records[0].gameName).toBe('合成大西瓜');
    expect(result.records[0].todaySequence).toBe(1);
    expect(result.totalToday).toBe(1);
  });

  it('支持按 accountId 筛选', async () => {
    const prisma = makeFakePrisma(seedForRecords);
    const service = new UserDashboardService(prisma);

    const result = await service.listEcpmRecords({
      userId: 'u1',
      range: { startAt: TODAY, endAt: TOMORROW },
      limit: 50,
      accountId: 'o3',
    });

    expect(result.records).toHaveLength(1);
    expect(result.records[0].accountReadableId).toBe('C2A5F33');
  });

  it('limit 限制返回数量但不影响 total', async () => {
    const prisma = makeFakePrisma(seedForRecords);
    const service = new UserDashboardService(prisma);

    const result = await service.listEcpmRecords({
      userId: 'u1',
      range: { startAt: TODAY, endAt: TOMORROW },
      limit: 2,
    });

    expect(result.records).toHaveLength(2);
    expect(result.totalAll).toBe(3);
  });

  it('用户没有 open_id 时返回空结果', async () => {
    const prisma = makeFakePrisma({ games: [], openIds: [], rawEcpms: [] });
    const service = new UserDashboardService(prisma);

    const result = await service.listEcpmRecords({
      userId: 'u-empty',
      range: { startAt: TODAY, endAt: TOMORROW },
      limit: 50,
    });

    expect(result).toEqual({ records: [], totalToday: 0, totalAll: 0 });
  });
});

