import { AgentDashboardService } from './agent-dashboard.service';

type FakeAgent = { id: string; invitationCode: string };
type FakeUser = {
  id: string;
  readableId: string;
  currentAgentId: string | null;
  deletedAt: Date | null;
  createdAt: Date;
};
type FakeOpenId = { id: string; userId: string | null };
type FakeRawEcpm = {
  id: string;
  openIdRecordId: string;
  rawCostLi: bigint;
  displayAmountLi: bigint;
  eventTime: Date;
};

function makeFakePrisma(seed: {
  agent: FakeAgent;
  users: FakeUser[];
  openIds: FakeOpenId[];
  rawEcpms: FakeRawEcpm[];
  directAgentRatioPercent?: number;
}) {
  return {
    agent: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        seed.agent.id === where.id ? seed.agent : null,
    },
    userAccount: {
      findMany: async ({
        where,
      }: {
        where: { currentAgentId: string; deletedAt: null };
      }) =>
        seed.users.filter(
          (u) =>
            u.currentAgentId === where.currentAgentId && u.deletedAt === null,
        ),
    },
    gameOpenId: {
      findMany: async ({ where }: { where: { userId: { in: string[] } } }) =>
        seed.openIds.filter(
          (o) => o.userId && where.userId.in.includes(o.userId),
        ),
    },
    rawEcpm: {
      findMany: async ({
        where,
        orderBy,
      }: {
        where: {
          openIdRecordId?: { in: string[] };
          eventTime?: { gte: Date; lt: Date };
        };
        orderBy?: { eventTime: 'asc' | 'desc' };
      }) => {
        let rows = seed.rawEcpms.slice();
        if (where.openIdRecordId?.in) {
          const ids = new Set(where.openIdRecordId.in);
          rows = rows.filter((r) => ids.has(r.openIdRecordId));
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
        }
        return rows;
      },
    },
    platformConfig: {
      findUnique: async () => ({
        directAgentRatioPercent: seed.directAgentRatioPercent ?? 30,
      }),
    },
  } as never;
}

const TODAY = new Date('2026-05-11T00:00:00+08:00');
const TOMORROW = new Date('2026-05-12T00:00:00+08:00');

describe('AgentDashboardService.getOverview', () => {
  it('返回邀请码 / 名下用户数 / 今日总额 / 我的分账（按 directAgentRatioPercent 折算）', async () => {
    const prisma = makeFakePrisma({
      agent: { id: 'a1', invitationCode: 'AB12CD' },
      users: [
        { id: 'u1', readableId: 'A8F3D2K', currentAgentId: 'a1', deletedAt: null, createdAt: new Date('2026-04-01') },
        { id: 'u2', readableId: 'B7C2E91', currentAgentId: 'a1', deletedAt: null, createdAt: new Date('2026-04-15') },
        { id: 'u-other', readableId: 'OOOOOOO', currentAgentId: 'a-other', deletedAt: null, createdAt: new Date('2026-04-20') },
      ],
      openIds: [
        { id: 'o1', userId: 'u1' },
        { id: 'o2', userId: 'u2' },
        { id: 'o-other', userId: 'u-other' },
      ],
      rawEcpms: [
        { id: 'r1', openIdRecordId: 'o1', rawCostLi: 45200n, displayAmountLi: 22600n, eventTime: new Date('2026-05-11T14:00:00+08:00') },
        { id: 'r2', openIdRecordId: 'o2', rawCostLi: 38000n, displayAmountLi: 19000n, eventTime: new Date('2026-05-11T13:00:00+08:00') },
        { id: 'r-other', openIdRecordId: 'o-other', rawCostLi: 50000n, displayAmountLi: 25000n, eventTime: new Date('2026-05-11T12:00:00+08:00') },
      ],
      directAgentRatioPercent: 30,
    });
    const service = new AgentDashboardService(prisma);

    const overview = await service.getOverview({
      agentId: 'a1',
      range: { startAt: TODAY, endAt: TOMORROW },
    });

    expect(overview.invitationCode).toBe('AB12CD');
    expect(overview.directUserCount).toBe(2);
    // 22.60 + 19.00 = 41.60
    expect(overview.todayTotalAmountYuan).toBeCloseTo(41.6, 1);
    // 41.60 × 30% = 12.48
    expect(overview.myShareTodayYuan).toBeCloseTo(12.48, 2);
  });

  it('代理无名下用户时返回 0 值', async () => {
    const prisma = makeFakePrisma({
      agent: { id: 'a1', invitationCode: 'AB12CD' },
      users: [],
      openIds: [],
      rawEcpms: [],
    });
    const service = new AgentDashboardService(prisma);

    const overview = await service.getOverview({
      agentId: 'a1',
      range: { startAt: TODAY, endAt: TOMORROW },
    });

    expect(overview.directUserCount).toBe(0);
    expect(overview.todayTotalAmountYuan).toBe(0);
    expect(overview.myShareTodayYuan).toBe(0);
    expect(overview.invitationCode).toBe('AB12CD');
  });
});

describe('AgentDashboardService.listUnderUsers', () => {
  it('返回名下用户的今日金额 / 条数 / 累计金额，按今日金额降序', async () => {
    const prisma = makeFakePrisma({
      agent: { id: 'a1', invitationCode: 'X' },
      users: [
        { id: 'u1', readableId: 'A8F3D2K', currentAgentId: 'a1', deletedAt: null, createdAt: new Date('2026-04-01') },
        { id: 'u2', readableId: 'B7C2E91', currentAgentId: 'a1', deletedAt: null, createdAt: new Date('2026-04-15') },
      ],
      openIds: [
        { id: 'o1', userId: 'u1' },
        { id: 'o2', userId: 'u2' },
      ],
      rawEcpms: [
        { id: 'r1', openIdRecordId: 'o1', rawCostLi: 45200n, displayAmountLi: 22600n, eventTime: new Date('2026-05-11T14:00:00+08:00') },
        { id: 'r2', openIdRecordId: 'o1', rawCostLi: 38000n, displayAmountLi: 19000n, eventTime: new Date('2026-05-11T13:00:00+08:00') },
        { id: 'r3', openIdRecordId: 'o2', rawCostLi: 30000n, displayAmountLi: 15000n, eventTime: new Date('2026-05-11T12:00:00+08:00') },
        { id: 'r-old', openIdRecordId: 'o1', rawCostLi: 30000n, displayAmountLi: 15000n, eventTime: new Date('2026-05-09T12:00:00+08:00') },
      ],
    });
    const service = new AgentDashboardService(prisma);

    const rows = await service.listUnderUsers({
      agentId: 'a1',
      range: { startAt: TODAY, endAt: TOMORROW },
    });

    expect(rows).toHaveLength(2);
    expect(rows[0].userId).toBe('u1');  // 今日金额 22.6+19=41.6 高于 u2 的 15
    expect(rows[0].readableId).toBe('A8F3D2K');
    expect(rows[0].todayEcpmCount).toBe(2);
    expect(rows[0].todayAmountYuan).toBeCloseTo(41.6, 1);
    // 累计含 r-old：22.6 + 19 + 15(r-old) = 56.6
    expect(rows[0].totalAmountYuan).toBeCloseTo(56.6, 1);
    expect(rows[1].userId).toBe('u2');
  });
});
