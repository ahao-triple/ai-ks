import { useCallback, useEffect, useState } from 'react';
import {
  DateRangeInput,
  RowRefreshButton,
  defaultDashboardDayRange,
  type DashboardDayRange,
} from '../components/domain';
import { useThrottledRefresh } from '../lib/useThrottledRefresh';
import type {
  SuperAdminAnomalies,
  SuperAdminCompanyRow,
  SuperAdminOverview,
  SuperAdminUnderCompanyResult,
  SuperAdminUnderGameResult,
  UserDashboardEcpmRecordsResult,
} from '../types/api';
import {
  SuperAdminDrilldown,
  type DrilldownApi,
  type DrilldownPath,
} from './SuperAdminDrilldown';

type DayRangeInput = { startDay?: string; endDay?: string };

export type SuperAdminDashboardApi = {
  getSuperAdminDashboardOverview: (
    input?: DayRangeInput,
  ) => Promise<SuperAdminOverview>;
  getSuperAdminDashboardCompanies: (
    input?: DayRangeInput,
  ) => Promise<SuperAdminCompanyRow[]>;
  getSuperAdminDashboardAnomalies: () => Promise<SuperAdminAnomalies>;
  getSuperAdminGamesUnderCompany: (
    companyId: string,
    input?: DayRangeInput,
  ) => Promise<SuperAdminUnderCompanyResult>;
  getSuperAdminUsersUnderGame: (
    gameId: string,
    input?: DayRangeInput,
  ) => Promise<SuperAdminUnderGameResult>;
  getSuperAdminUserRecords: (
    userId: string,
    input?: {
      startDay?: string;
      endDay?: string;
      gameId?: string;
      accountId?: string;
      limit?: number;
    },
  ) => Promise<UserDashboardEcpmRecordsResult>;
  refreshSuperAdminScope: (
    body:
      | { scope: 'company'; companyId: string }
      | { scope: 'game'; gameId: string }
      | { scope: 'user'; gameId: string; userId: string },
  ) => Promise<unknown>;
};

export type SuperAdminDashboardData = {
  overview: SuperAdminOverview;
  companies: SuperAdminCompanyRow[];
  anomalies: SuperAdminAnomalies;
};

export type SuperAdminDashboardPageProps = {
  api: SuperAdminDashboardApi;
  initialData?: SuperAdminDashboardData;
};

export function SuperAdminDashboardPage(props: SuperAdminDashboardPageProps) {
  const { api, initialData } = props;
  const [dayRange, setDayRange] = useState<DashboardDayRange>(
    defaultDashboardDayRange(),
  );
  const [drilldown, setDrilldown] = useState<DrilldownPath | null>(null);

  const rangeInput = { startDay: dayRange.startDay, endDay: dayRange.endDay };
  const drilldownApi: DrilldownApi = {
    loadCompanyGames: (companyId) =>
      api.getSuperAdminGamesUnderCompany(companyId, rangeInput),
    loadGameUsers: (gameId) =>
      api.getSuperAdminUsersUnderGame(gameId, rangeInput),
    loadUserRecords: (userId) =>
      api.getSuperAdminUserRecords(userId, { ...rangeInput, limit: 50 }),
    refreshScope: (body) => api.refreshSuperAdminScope(body),
  };

  const fetchAll = useCallback(async (): Promise<SuperAdminDashboardData> => {
    const range = { startDay: dayRange.startDay, endDay: dayRange.endDay };
    const [overview, companies, anomalies] = await Promise.all([
      api.getSuperAdminDashboardOverview(range),
      api.getSuperAdminDashboardCompanies(range),
      api.getSuperAdminDashboardAnomalies(),
    ]);
    return { overview, companies, anomalies };
  }, [api, dayRange.startDay, dayRange.endDay]);

  const {
    data: liveData,
    loading,
    toast,
    refresh,
  } = useThrottledRefresh<SuperAdminDashboardData>(fetchAll, {
    windowMs: 5000,
  });
  const data = liveData ?? initialData ?? null;

  useEffect(() => {
    if (drilldown) return;
    void refresh();
  }, [refresh, drilldown]);

  if (drilldown) {
    return (
      <SuperAdminDrilldown
        path={drilldown}
        api={drilldownApi}
        onNavigate={setDrilldown}
      />
    );
  }

  return (
    <div className="user-dashboard admin-dashboard">
      <header className="user-dashboard-header">
        <div>
          <div className="user-dashboard-greeting">全平台看板</div>
          <div className="user-dashboard-subtitle">
            {data
              ? `${data.overview.activeGameCount}/${data.overview.totalGameCount} 个游戏今日活跃 · ${data.overview.activeUserCount} 名用户活跃`
              : '加载中…'}
          </div>
        </div>
        <div className="user-dashboard-time-filters">
          <DateRangeInput value={dayRange} onChange={setDayRange} />
          <button
            type="button"
            className="user-dashboard-refresh"
            onClick={() => void refresh()}
            disabled={loading}
          >
            ⟳ 立即刷新
          </button>
          {toast && (
            <span className={`user-dashboard-toast user-dashboard-toast-${toast.kind}`}>
              {toast.message}
            </span>
          )}
        </div>
      </header>

      <section className="user-dashboard-kpi">
        <KpiCard
          label="今日 ECPM 条数"
          value={data ? formatInt(data.overview.todayCount) : '—'}
        />
        <KpiCard
          label="今日平均 ECPM"
          value={
            data ? `¥ ${data.overview.todayAverageEcpmYuan.toFixed(2)}` : '—'
          }
          hint={
            data ? `最高 ¥ ${data.overview.todayMaxEcpmYuan.toFixed(2)}` : ''
          }
        />
        <KpiCard
          label="今日活跃游戏"
          value={
            data
              ? `${data.overview.activeGameCount}`
              : '—'
          }
          hint={
            data
              ? `共 ${data.overview.totalGameCount} 个 · ${
                  data.overview.totalGameCount - data.overview.activeGameCount
                } 个无数据`
              : ''
          }
        />
        <KpiCard
          label="今日活跃用户"
          value={data ? formatInt(data.overview.activeUserCount) : '—'}
        />
      </section>

      <section className="admin-dashboard-anomaly">
        <div className="user-dashboard-section-header">
          <h2>异常提示</h2>
        </div>
        <Anomalies anomalies={data?.anomalies} />
      </section>

      <section className="user-dashboard-records">
        <div className="user-dashboard-section-header">
          <h2>今日 ECPM 数据（按公司）</h2>
          <div className="user-dashboard-records-controls">
            <span className="user-dashboard-subtitle">
              点击公司名进入下钻
            </span>
          </div>
        </div>
        <CompanyDistributionTable
          companies={data?.companies ?? []}
          onSelect={(row) =>
            setDrilldown({
              kind: 'company',
              companyId: row.companyId,
              companyName: row.companyName,
            })
          }
          onRefresh={async (row) => {
            const tStart = performance.now();
            // eslint-disable-next-line no-console
            console.log(
              `[刷新链路:UI] 点击行级 ⟳ companyId=${row.companyId} companyName=${row.companyName}`,
            );
            await api.refreshSuperAdminScope({
              scope: 'company',
              companyId: row.companyId,
            });
            const tApi = performance.now();
            // eslint-disable-next-line no-console
            console.log(
              `[刷新链路:UI] 后端刷新返回 耗时=${Math.round(tApi - tStart)}ms 开始重拉看板数据`,
            );
            await refresh();
            // eslint-disable-next-line no-console
            console.log(
              `[刷新链路:UI] 全链路完成 看板重拉耗时=${Math.round(performance.now() - tApi)}ms 总耗时=${Math.round(performance.now() - tStart)}ms`,
            );
          }}
        />
      </section>
    </div>
  );
}

function KpiCard(props: { label: string; value: string; hint?: string }) {
  return (
    <div className="user-dashboard-kpi-card">
      <div className="user-dashboard-kpi-label">{props.label}</div>
      <div className="user-dashboard-kpi-value">{props.value}</div>
      {props.hint && (
        <div className="user-dashboard-kpi-hint">{props.hint}</div>
      )}
    </div>
  );
}

function Anomalies({ anomalies }: { anomalies?: SuperAdminAnomalies }) {
  if (!anomalies) {
    return <div className="user-dashboard-groups-empty">加载中…</div>;
  }
  if (
    anomalies.syncFailures.length === 0 &&
    anomalies.longSilent.length === 0
  ) {
    return (
      <div className="admin-dashboard-anomaly-empty">其它暂无异常</div>
    );
  }
  return (
    <div className="admin-dashboard-anomaly-list">
      {anomalies.syncFailures.map((f) => (
        <div
          key={`fail-${f.jobId}`}
          className="admin-dashboard-anomaly-item admin-dashboard-anomaly-error"
        >
          <div className="admin-dashboard-anomaly-title">
            ● 同步失败：{f.gameName}
          </div>
          <div className="admin-dashboard-anomaly-meta">
            {f.errorMessage ? f.errorMessage : '未提供详细原因'} · {' '}
            {new Date(f.failedAt).toLocaleString()}
          </div>
        </div>
      ))}
      {anomalies.longSilent.map((s) => (
        <div
          key={`silent-${s.gameId}`}
          className="admin-dashboard-anomaly-item admin-dashboard-anomaly-warn"
        >
          <div className="admin-dashboard-anomaly-title">
            ● 长时间无数据：{s.gameName}
          </div>
          <div className="admin-dashboard-anomaly-meta">
            {Number.isFinite(s.hoursSinceLastEcpm)
              ? `已超过 ${s.hoursSinceLastEcpm.toFixed(1)} 小时`
              : '从未产生 ECPM 数据'}
          </div>
        </div>
      ))}
    </div>
  );
}

function CompanyDistributionTable({
  companies,
  onSelect,
  onRefresh,
}: {
  companies: SuperAdminCompanyRow[];
  onSelect?: (row: SuperAdminCompanyRow) => void;
  onRefresh?: (row: SuperAdminCompanyRow) => Promise<void>;
}) {
  if (companies.length === 0) {
    return (
      <div className="user-dashboard-groups-empty">还没有公司或无 ECPM 数据。</div>
    );
  }
  return (
    <table className="user-dashboard-groups-table">
      <thead>
        <tr>
          <th>公司</th>
          <th className="user-dashboard-col-num">ECPM 条数</th>
          <th className="user-dashboard-col-num">活跃游戏</th>
          <th className="user-dashboard-col-num">活跃用户</th>
          <th className="user-dashboard-col-num">平均 ECPM</th>
          <th className="user-dashboard-col-num">最高 ECPM</th>
          {onRefresh && <th className="user-dashboard-col-num">操作</th>}
        </tr>
      </thead>
      <tbody>
        {companies.map((row) => (
          <tr key={row.companyId}>
            <td>
              {onSelect ? (
                <button
                  type="button"
                  className="admin-drilldown-link"
                  onClick={() => onSelect(row)}
                >
                  <strong>{row.companyName}</strong> ▶
                </button>
              ) : (
                <strong>{row.companyName}</strong>
              )}
            </td>
            <td className="user-dashboard-col-num">{formatInt(row.ecpmCount)}</td>
            <td className="user-dashboard-col-num">
              {row.activeGameCount} / {row.totalGameCount}
            </td>
            <td className="user-dashboard-col-num">
              {formatInt(row.activeUserCount)}
            </td>
            <td className="user-dashboard-col-num">
              ¥ {row.averageEcpmYuan.toFixed(2)}
            </td>
            <td className="user-dashboard-col-num">
              {row.maxEcpmYuan === 0 ? '—' : `¥ ${row.maxEcpmYuan.toFixed(2)}`}
            </td>
            {onRefresh && (
              <td className="user-dashboard-col-num">
                <RowRefreshButton onRefresh={() => onRefresh(row)} />
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function formatInt(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}
