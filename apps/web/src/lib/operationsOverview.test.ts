import { describe, expect, it } from 'vitest';
import type {
  AdminGame,
  AdminSettlementBatch,
  AdminSettlementPreview,
  KuaishouEcpmSyncJob,
} from '../types/api';
import { buildOperationsOverview } from './operationsOverview';

const baseGame: AdminGame = {
  budget: { li: '0', yuan: '0.00' },
  companyId: 'company-1',
  companyName: 'Acme Studio',
  createdAt: '2026-05-09T00:00:00.000Z',
  ecpmAutoSyncEnabled: false,
  ecpmAutoSyncIntervalHours: 5,
  ecpmAutoSyncLastRunAt: null,
  ecpmAutoSyncNextRunAt: null,
  gameAppId: 'game-app-1',
  gameSecret: 'secret',
  id: 'game-1',
  name: 'Runner',
  settlementPaused: false,
  updatedAt: '2026-05-09T00:00:00.000Z',
};

const baseJob: KuaishouEcpmSyncJob = {
  actorId: 'admin',
  actorType: 'SUPER_ADMIN',
  createdAt: '2026-05-09T00:00:00.000Z',
  dataHour: '2026-05-09T08:00:00+08:00',
  endedDataHour: null,
  errorMessage: null,
  finishedAt: null,
  gameAppId: 'game-app-1',
  id: 'job-1',
  lookbackHours: null,
  requestedOpenIdCount: 1,
  savedCount: 0,
  source: 'kuaishou',
  startedAt: '2026-05-09T00:00:00.000Z',
  startedDataHour: null,
  status: 'RUNNING',
  updatedAt: '2026-05-09T00:00:00.000Z',
};

const baseSettlementBatch: AdminSettlementBatch = {
  budgetAfter: { li: '7000', yuan: '70.00' },
  budgetBefore: { li: '10000', yuan: '100.00' },
  companyId: 'company-1',
  configSnapshot: {},
  createdAt: '2026-05-09T10:00:00.000Z',
  endedAt: '2026-05-09T10:00:00.000Z',
  gameId: 'game-1',
  id: 'settlement-batch-1',
  operatorId: 'admin',
  operatorType: 'SUPER_ADMIN',
  settledAmount: { li: '300', yuan: '3.00' },
  settledCount: 2,
  startedAt: '2026-05-09T09:00:00.000Z',
  status: 'CONFIRMED',
  userCount: 2,
};

describe('buildOperationsOverview', () => {
  it('aggregates budget balance and ranking order from visible games', () => {
    const result = buildOperationsOverview({
      adminGames: [
        {
          ...baseGame,
          budget: { li: '1250', yuan: '12.50' },
          id: 'game-1',
          name: 'Runner',
        },
        {
          ...baseGame,
          budget: { li: '5000', yuan: '50.00' },
          id: 'game-2',
          name: 'Puzzle',
        },
      ],
      configKuaishouEcpmJobs: [],
      kuaishouEcpmJobs: [],
      settlementPreview: undefined,
    });

    expect(result.metrics.budgetBalance.label).toBe('游戏预算余额');
    expect(result.metrics.budgetBalance.value).toBe('¥ 62.50');
    expect(result.rankings.map((item) => item.gameName)).toEqual([
      'Puzzle',
      'Runner',
    ]);
    expect(result.emptyStates.noGames).toBe(false);
  });

  it('deduplicates failed ecpm jobs across global and config job lists', () => {
    const result = buildOperationsOverview({
      adminGames: [{ ...baseGame }],
      configKuaishouEcpmJobs: [
        {
          ...baseJob,
          errorMessage: 'token expired',
          id: 'job-1',
          status: 'FAILED',
        },
        {
          ...baseJob,
          errorMessage: 'timeout',
          id: 'job-2',
          status: 'FAILED',
        },
      ],
      kuaishouEcpmJobs: [
        {
          ...baseJob,
          errorMessage: 'token expired',
          id: 'job-1',
          status: 'FAILED',
        },
      ],
      settlementPreview: undefined,
    });

    expect(result.metrics.failedJobs.label).toBe('异常任务数');
    expect(result.metrics.failedJobs.value).toBe('2');
    expect(result.exceptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'ecpm-sync-failed',
          label: 'ECPM 同步失败',
        }),
      ]),
    );
  });

  it('uses settlement preview amount as pending settlement and today visible revenue', () => {
    const preview: AdminSettlementPreview = {
      budgetAfter: { li: '500', yuan: '5.00' },
      budgetBefore: { li: '1200', yuan: '12.00' },
      canConfirm: true,
      companyId: 'company-1',
      gameId: 'game-1',
      settlementAmount: { li: '700', yuan: '7.00' },
      settlementCount: 4,
      unboundCount: 0,
      userCount: 2,
    };

    const result = buildOperationsOverview({
      adminGames: [{ ...baseGame, budget: { li: '1200', yuan: '12.00' } }],
      configKuaishouEcpmJobs: [],
      kuaishouEcpmJobs: [],
      settlementPreview: preview,
    });

    expect(result.metrics.todayRevenue.label).toBe('今日收益');
    expect(result.metrics.todayRevenue.value).toBe('¥ 7.00');
    expect(result.metrics.pendingSettlement.value).toBe('¥ 7.00');
    expect(result.metrics.pendingSettlement.detail).toContain('4 条');
  });

  it('falls back to today settled amount when preview is missing', () => {
    const result = buildOperationsOverview({
      adminGames: [{ ...baseGame, budget: { li: '1200', yuan: '12.00' } }],
      configKuaishouEcpmJobs: [],
      kuaishouEcpmJobs: [],
      now: '2026-05-09T12:00:00.000Z',
      settlementBatches: [
        baseSettlementBatch,
        {
          ...baseSettlementBatch,
          createdAt: '2026-05-08T10:00:00.000Z',
          id: 'settlement-batch-2',
          settledAmount: { li: '1100', yuan: '11.00' },
        },
      ],
      settlementPreview: undefined,
    });

    expect(result.metrics.todayRevenue.value).toBe('¥ 3.00');
    expect(result.metrics.todayRevenue.detail).toContain('当日已确认结算批次金额');
  });

  it('aggregates recent 7-day settlement summary', () => {
    const result = buildOperationsOverview({
      adminGames: [{ ...baseGame, budget: { li: '1200', yuan: '12.00' } }],
      configKuaishouEcpmJobs: [],
      kuaishouEcpmJobs: [],
      now: '2026-05-09T12:00:00.000Z',
      settlementBatches: [
        {
          ...baseSettlementBatch,
          createdAt: '2026-05-09T10:00:00.000Z',
          id: 'settlement-batch-1',
          settledAmount: { li: '500', yuan: '5.00' },
          userCount: 2,
        },
        {
          ...baseSettlementBatch,
          createdAt: '2026-05-04T10:00:00.000Z',
          id: 'settlement-batch-2',
          settledAmount: { li: '700', yuan: '7.00' },
          userCount: 4,
        },
        {
          ...baseSettlementBatch,
          createdAt: '2026-05-01T10:00:00.000Z',
          id: 'settlement-batch-3',
          settledAmount: { li: '1000', yuan: '10.00' },
          userCount: 10,
        },
      ],
      settlementPreview: undefined,
    });

    expect(result.summary).toEqual(
      expect.arrayContaining([
        { label: '近7日结算金额', value: '¥ 12.00' },
        { label: '近7日结算批次', value: '2 条' },
        { label: '近7日结算用户', value: '6 人' },
      ]),
    );
  });

  it('marks empty states correctly when no data is available', () => {
    const result = buildOperationsOverview({
      adminGames: [],
      configKuaishouEcpmJobs: [],
      kuaishouEcpmJobs: [],
      now: '2026-05-09T12:00:00.000Z',
      settlementBatches: [],
      settlementPreview: undefined,
    });

    expect(result.metrics.todayRevenue.value).toBe('-');
    expect(result.metrics.budgetBalance.value).toBe('¥ 0.00');
    expect(result.emptyStates.noGames).toBe(true);
    expect(result.emptyStates.noExceptions).toBe(true);
    expect(result.emptyStates.noRankings).toBe(true);
    expect(result.summary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: '已接入游戏', value: '0 个' }),
      ]),
    );
  });
});
