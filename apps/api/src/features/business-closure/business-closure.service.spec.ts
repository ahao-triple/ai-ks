import { Logger } from '@nestjs/common';
import { BusinessClosureService } from './business-closure.service';

describe('BusinessClosureService', () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('reports blocked checks before the business flow has enough data', async () => {
    const service = new BusinessClosureService(createFakePrisma());

    await expect(service.getReport()).resolves.toMatchObject({
      summary: {
        attention: expect.any(Number),
        blocked: expect.any(Number),
        ready: expect.any(Number),
      },
      checks: expect.arrayContaining([
        expect.objectContaining({
          key: 'resources',
          status: 'BLOCKED',
        }),
        expect.objectContaining({
          key: 'user_agent_binding',
          status: 'BLOCKED',
        }),
      ]),
    });
  });

  it('marks the real data test closure as ready when each link has evidence', async () => {
    const service = new BusinessClosureService(
      createFakePrisma({
        activeAgentCount: 2,
        boundOpenIdCount: 1,
        boundUserCount: 1,
        companyCount: 1,
        gameBudgetLi: 10000n,
        gameCount: 1,
        openIdCount: 1,
        pendingEcpmCount: 2,
        rawEcpmCount: 2,
        settlementBatchCount: 1,
        userCount: 1,
        withdrawalBatchCount: 1,
      }),
    );

    const report = await service.getReport();

    expect(report.metrics).toMatchObject({
      activeAgentCount: 2,
      boundOpenIdCount: 1,
      boundUserCount: 1,
      companyCount: 1,
      gameCount: 1,
      pendingEcpmCount: 2,
      settlementBatchCount: 1,
      withdrawalBatchCount: 1,
    });
    expect(report.checks).toEqual([
      expect.objectContaining({ key: 'resources', status: 'READY' }),
      expect.objectContaining({ key: 'agents', status: 'READY' }),
      expect.objectContaining({ key: 'user_agent_binding', status: 'READY' }),
      expect.objectContaining({ key: 'open_ids', status: 'READY' }),
      expect.objectContaining({ key: 'ecpm', status: 'READY' }),
      expect.objectContaining({ key: 'settlement', status: 'READY' }),
      expect.objectContaining({ key: 'withdrawal', status: 'READY' }),
    ]);
    expect(report.summary.blocked).toBe(0);
  });

  it('writes Chinese logs for each real data closure check', async () => {
    const service = new BusinessClosureService(
      createFakePrisma({
        activeAgentCount: 1,
        boundOpenIdCount: 1,
        boundUserCount: 1,
        companyCount: 1,
        gameBudgetLi: 10000n,
        gameCount: 1,
        openIdCount: 1,
        pendingEcpmCount: 1,
        rawEcpmCount: 1,
        userCount: 1,
      }),
    );

    await service.getReport();

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('真实数据闭环核对汇总'),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('检查项：公司 / 游戏 / 预算'),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('检查项：ECPM 收益明细'),
    );
  });
});

type FakeMetrics = {
  activeAgentCount: number;
  boundOpenIdCount: number;
  boundUserCount: number;
  companyCount: number;
  gameBudgetLi: bigint;
  gameCount: number;
  openIdCount: number;
  pendingEcpmCount: number;
  rawEcpmCount: number;
  settlementBatchCount: number;
  userCount: number;
  withdrawalBatchCount: number;
};

function createFakePrisma(
  overrides: Partial<FakeMetrics> = {},
) {
  const metrics: FakeMetrics = {
    activeAgentCount: 0,
    boundOpenIdCount: 0,
    boundUserCount: 0,
    companyCount: 0,
    gameBudgetLi: 0n,
    gameCount: 0,
    openIdCount: 0,
    pendingEcpmCount: 0,
    rawEcpmCount: 0,
    settlementBatchCount: 0,
    userCount: 0,
    withdrawalBatchCount: 0,
    ...overrides,
  };

  return {
    agent: {
      count: async () => metrics.activeAgentCount,
    },
    company: {
      count: async () => metrics.companyCount,
    },
    game: {
      aggregate: async () => ({ _sum: { budgetLi: metrics.gameBudgetLi } }),
      count: async () => metrics.gameCount,
    },
    gameOpenId: {
      count: async ({ where }: any = {}) =>
        where?.userId?.not === null
          ? metrics.boundOpenIdCount
          : metrics.openIdCount,
    },
    rawEcpm: {
      count: async ({ where }: any = {}) =>
        where?.status === 'PENDING'
          ? metrics.pendingEcpmCount
          : metrics.rawEcpmCount,
    },
    settlementBatch: {
      count: async () => metrics.settlementBatchCount,
    },
    userAccount: {
      count: async ({ where }: any = {}) =>
        where?.currentAgentId?.not === null
          ? metrics.boundUserCount
          : metrics.userCount,
    },
    withdrawalBatch: {
      count: async () => metrics.withdrawalBatchCount,
    },
  } as any;
}
