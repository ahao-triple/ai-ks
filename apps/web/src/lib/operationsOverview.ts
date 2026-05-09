import type {
  AdminGame,
  AdminSettlementBatch,
  AdminSettlementPreview,
  KuaishouEcpmSyncJob,
} from '../types/api';

export type OverviewMetric = {
  detail?: string;
  label: string;
  value: string;
};

export type OverviewSummaryItem = {
  label: string;
  value: string;
};

export type OverviewRankingItem = {
  budget: string;
  companyName: string;
  gameId: string;
  gameName: string;
  settlementStatus: '可结算' | '已暂停';
};

export type OverviewExceptionItem = {
  detail: string;
  key: 'ecpm-sync-failed' | 'game-budget-low' | 'settlement-paused';
  label: string;
};

export type OperationsOverview = {
  emptyStates: {
    noExceptions: boolean;
    noGames: boolean;
    noRankings: boolean;
  };
  exceptions: OverviewExceptionItem[];
  metrics: {
    budgetBalance: OverviewMetric;
    failedJobs: OverviewMetric;
    pendingSettlement: OverviewMetric;
    todayRevenue: OverviewMetric;
  };
  rankings: OverviewRankingItem[];
  summary: OverviewSummaryItem[];
};

type BuildOperationsOverviewInput = {
  adminGames: AdminGame[];
  configKuaishouEcpmJobs: KuaishouEcpmSyncJob[];
  kuaishouEcpmJobs: KuaishouEcpmSyncJob[];
  now?: Date | string;
  settlementBatches?: AdminSettlementBatch[];
  settlementPreview?: AdminSettlementPreview;
};

export function buildOperationsOverview(
  input: BuildOperationsOverviewInput,
): OperationsOverview {
  const now = resolveNow(input.now);
  const settlementBatches = input.settlementBatches ?? [];
  const budgetLiTotal = input.adminGames.reduce(
    (total, game) => total + parseLi(game.budget.li),
    0n,
  );
  const failedJobs = collectFailedJobs(
    input.kuaishouEcpmJobs,
    input.configKuaishouEcpmJobs,
  );
  const rankings: OverviewRankingItem[] = input.adminGames
    .slice()
    .sort((left, right) => {
      const leftBudget = parseLi(left.budget.li);
      const rightBudget = parseLi(right.budget.li);
      if (leftBudget === rightBudget) {
        return left.name.localeCompare(right.name);
      }

      return leftBudget > rightBudget ? -1 : 1;
    })
    .map((game) => ({
      budget: formatLi(parseLi(game.budget.li)),
      companyName: game.companyName,
      gameId: game.id,
      gameName: game.name,
      settlementStatus: game.settlementPaused ? '已暂停' : '可结算',
    }));

  const exceptions = buildExceptions(input.adminGames, failedJobs.length);
  const todaySettledLi = settlementBatches.reduce((total, batch) => {
    const createdAt = parseDate(batch.createdAt);
    if (!createdAt || !isSameLocalDay(createdAt, now)) {
      return total;
    }

    return total + parseLi(batch.settledAmount.li);
  }, 0n);
  const recentSettlements = collectRecentSettlements(settlementBatches, now, 7);
  const recentSettledLi = recentSettlements.reduce(
    (total, batch) => total + parseLi(batch.settledAmount.li),
    0n,
  );
  const recentSettledUsers = recentSettlements.reduce(
    (total, batch) => total + batch.userCount,
    0,
  );
  const todayRevenue =
    input.settlementPreview?.settlementAmount?.yuan !== undefined
      ? `¥ ${input.settlementPreview.settlementAmount.yuan}`
      : todaySettledLi > 0n
        ? formatLi(todaySettledLi)
      : '-';
  const pendingSettlement =
    input.settlementPreview?.settlementAmount?.yuan !== undefined
      ? `¥ ${input.settlementPreview.settlementAmount.yuan}`
      : '-';

  return {
    emptyStates: {
      noExceptions: exceptions.length === 0,
      noGames: input.adminGames.length === 0,
      noRankings: rankings.length === 0,
    },
    exceptions,
    metrics: {
      budgetBalance: {
        detail: `${input.adminGames.length} 个可见游戏`,
        label: '游戏预算余额',
        value: formatLi(budgetLiTotal),
      },
      failedJobs: {
        detail: failedJobs.length > 0 ? '按任务 ID 去重' : '暂无失败任务',
        label: '异常任务数',
        value: String(failedJobs.length),
      },
      pendingSettlement: {
        detail: input.settlementPreview
          ? `${input.settlementPreview.settlementCount} 条待结算记录`
          : '请先执行结算预览',
        label: '待结算金额',
        value: pendingSettlement,
      },
      todayRevenue: {
        detail: input.settlementPreview
          ? '口径：当前可见结算预览金额'
          : todaySettledLi > 0n
            ? '口径：当日已确认结算批次金额'
          : '口径：暂无全局今日收益数据',
        label: '今日收益',
        value: todayRevenue,
      },
    },
    rankings,
    summary: [
      {
        label: '已接入游戏',
        value: `${input.adminGames.length} 个`,
      },
      {
        label: '自动同步开启',
        value: `${input.adminGames.filter((game) => game.ecpmAutoSyncEnabled).length} 个`,
      },
      {
        label: '可结算游戏',
        value: `${input.adminGames.filter((game) => !game.settlementPaused).length} 个`,
      },
      {
        label: '同步任务总数',
        value: `${uniqueJobCount(
          input.kuaishouEcpmJobs,
          input.configKuaishouEcpmJobs,
        )} 条`,
      },
      {
        label: '近7日结算金额',
        value: formatLi(recentSettledLi),
      },
      {
        label: '近7日结算批次',
        value: `${recentSettlements.length} 条`,
      },
      {
        label: '近7日结算用户',
        value: `${recentSettledUsers} 人`,
      },
    ],
  };
}

function resolveNow(now: Date | string | undefined) {
  if (now instanceof Date) {
    return now;
  }

  if (typeof now === 'string') {
    const parsed = new Date(now);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return new Date();
}

function collectFailedJobs(
  globalJobs: KuaishouEcpmSyncJob[],
  configJobs: KuaishouEcpmSyncJob[],
) {
  const failedById = new Map<string, KuaishouEcpmSyncJob>();
  for (const job of [...globalJobs, ...configJobs]) {
    if (job.status !== 'FAILED') {
      continue;
    }

    failedById.set(job.id, job);
  }

  return [...failedById.values()];
}

function uniqueJobCount(
  globalJobs: KuaishouEcpmSyncJob[],
  configJobs: KuaishouEcpmSyncJob[],
) {
  return new Set([...globalJobs, ...configJobs].map((job) => job.id)).size;
}

function collectRecentSettlements(
  batches: AdminSettlementBatch[],
  now: Date,
  dayRange: number,
) {
  const rangeStart = startOfLocalDay(offsetDate(now, -(dayRange - 1)));
  return batches.filter((batch) => {
    const createdAt = parseDate(batch.createdAt);
    if (!createdAt) {
      return false;
    }

    return createdAt >= rangeStart && createdAt <= now;
  });
}

function buildExceptions(adminGames: AdminGame[], failedJobCount: number) {
  const result: OverviewExceptionItem[] = [];
  if (failedJobCount > 0) {
    result.push({
      detail: `${failedJobCount} 条失败任务待处理`,
      key: 'ecpm-sync-failed',
      label: 'ECPM 同步失败',
    });
  }

  const lowBudgetGameCount = adminGames.filter(
    (game) => parseLi(game.budget.li) <= 0n,
  ).length;
  if (lowBudgetGameCount > 0) {
    result.push({
      detail: `${lowBudgetGameCount} 个游戏预算不足`,
      key: 'game-budget-low',
      label: '预算风险',
    });
  }

  const pausedSettlementGameCount = adminGames.filter(
    (game) => game.settlementPaused,
  ).length;
  if (pausedSettlementGameCount > 0) {
    result.push({
      detail: `${pausedSettlementGameCount} 个游戏处于暂停结算`,
      key: 'settlement-paused',
      label: '结算暂停',
    });
  }

  return result;
}

function parseLi(value: string) {
  if (!/^-?\d+$/.test(value.trim())) {
    return 0n;
  }

  return BigInt(value);
}

function formatLi(li: bigint) {
  const sign = li < 0n ? '-' : '';
  const absolute = li < 0n ? -li : li;
  const yuan = absolute / 100n;
  const cents = String(absolute % 100n).padStart(2, '0');

  return `¥ ${sign}${yuan}.${cents}`;
}

function parseDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function isSameLocalDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function offsetDate(date: Date, dayOffset: number) {
  const next = new Date(date);
  next.setDate(date.getDate() + dayOffset);
  return next;
}
