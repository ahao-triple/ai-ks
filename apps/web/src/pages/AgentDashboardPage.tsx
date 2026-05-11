import { useCallback, useEffect, useState } from 'react';
import {
  DateRangeInput,
  defaultDashboardDayRange,
  type DashboardDayRange,
} from '../components/domain';
import { formatAgentInvitationCode, formatUserId } from '../lib/idFormat';
import { useThrottledRefresh } from '../lib/useThrottledRefresh';
import type {
  AgentDashboardOverview,
  AgentDashboardUserRow,
} from '../types/api';

type DayRangeInput = { startDay?: string; endDay?: string };

export type AgentDashboardApi = {
  getAgentDashboardOverview: (
    input?: DayRangeInput,
  ) => Promise<AgentDashboardOverview>;
  getAgentDashboardUsers: (
    input?: DayRangeInput,
  ) => Promise<AgentDashboardUserRow[]>;
};

export type AgentDashboardData = {
  overview: AgentDashboardOverview;
  users: AgentDashboardUserRow[];
};

export type AgentDashboardPageProps = {
  api: AgentDashboardApi;
  agentName: string;
  initialData?: AgentDashboardData;
};

export function AgentDashboardPage(props: AgentDashboardPageProps) {
  const { api, agentName, initialData } = props;
  const [dayRange, setDayRange] = useState<DashboardDayRange>(
    defaultDashboardDayRange(),
  );
  const [search, setSearch] = useState('');

  const fetchAll = useCallback(async (): Promise<AgentDashboardData> => {
    const range = { startDay: dayRange.startDay, endDay: dayRange.endDay };
    const [overview, users] = await Promise.all([
      api.getAgentDashboardOverview(range),
      api.getAgentDashboardUsers(range),
    ]);
    return { overview, users };
  }, [api, dayRange.startDay, dayRange.endDay]);

  const {
    data: liveData,
    loading,
    toast,
    refresh,
  } = useThrottledRefresh<AgentDashboardData>(fetchAll, { windowMs: 5000 });
  const data = liveData ?? initialData ?? null;

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filteredUsers = data
    ? data.users.filter((u) =>
        search
          ? u.readableId.toUpperCase().includes(search.toUpperCase())
          : true,
      )
    : [];

  return (
    <div className="user-dashboard agent-dashboard">
      <header className="user-dashboard-header">
        <div>
          <div className="user-dashboard-greeting">你好，{agentName}</div>
          <div className="user-dashboard-subtitle">代理工作台</div>
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
            <span
              className={`user-dashboard-toast user-dashboard-toast-${toast.kind}`}
            >
              {toast.message}
            </span>
          )}
        </div>
      </header>

      <section className="agent-dashboard-identity">
        <div className="agent-dashboard-identity-left">
          <div className="user-dashboard-kpi-label">代理身份</div>
          <div className="agent-dashboard-identity-row">
            <span>邀请码</span>
            <code className="agent-dashboard-invitation">
              {data
                ? formatAgentInvitationCode(data.overview.invitationCode)
                : 'L-XXXXXX'}
            </code>
            <button
              type="button"
              className="agent-dashboard-button"
              onClick={() =>
                data &&
                void navigator.clipboard?.writeText(
                  formatAgentInvitationCode(data.overview.invitationCode),
                )
              }
              disabled={!data}
            >
              📋 复制
            </button>
          </div>
        </div>
        <div className="agent-dashboard-identity-stats">
          <div>
            <div className="user-dashboard-kpi-label">被代理用户</div>
            <div className="user-dashboard-kpi-value">
              {data ? data.overview.directUserCount : '—'}{' '}
              <span className="user-dashboard-kpi-hint" style={{ display: 'inline' }}>
                人
              </span>
            </div>
          </div>
          <div>
            <div className="user-dashboard-kpi-label">名下今日总收益</div>
            <div className="user-dashboard-kpi-value">
              {data ? `¥ ${data.overview.todayTotalAmountYuan.toFixed(2)}` : '—'}
            </div>
          </div>
          <div>
            <div className="user-dashboard-kpi-label">我的分账（今日）</div>
            <div className="user-dashboard-kpi-value agent-dashboard-share">
              {data ? `¥ ${data.overview.myShareTodayYuan.toFixed(2)}` : '—'}
            </div>
          </div>
        </div>
      </section>

      <section className="user-dashboard-records">
        <div className="user-dashboard-section-header">
          <h2>名下用户（按今日收益降序）</h2>
          <div className="user-dashboard-records-controls">
            <span className="user-dashboard-subtitle">
              共 {data ? data.users.length : 0} 人 · 仅展示，无法查看用户内部数据
            </span>
            <input
              type="text"
              className="user-dashboard-filter"
              placeholder="搜索用户 ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 160 }}
            />
          </div>
        </div>
        <UnderUsersTable rows={filteredUsers} loading={!data} />
      </section>
    </div>
  );
}

function UnderUsersTable(props: {
  rows: AgentDashboardUserRow[];
  loading: boolean;
}) {
  if (props.loading) {
    return (
      <div className="user-dashboard-groups-empty">加载中…</div>
    );
  }
  if (props.rows.length === 0) {
    return (
      <div className="user-dashboard-groups-empty">
        还没有名下用户，把邀请码分享给用户后他们注册时填写即可。
      </div>
    );
  }
  return (
    <table className="user-dashboard-groups-table">
      <thead>
        <tr>
          <th>用户 ID</th>
          <th className="user-dashboard-col-num">今日收益</th>
          <th className="user-dashboard-col-num">今日 ECPM 条数</th>
          <th className="user-dashboard-col-num">累计收益</th>
          <th>注册时间</th>
          <th>最近活跃</th>
        </tr>
      </thead>
      <tbody>
        {props.rows.map((row) => (
          <tr key={row.userId} className={row.todayEcpmCount === 0 ? 'agent-dashboard-row-idle' : undefined}>
            <td className="user-dashboard-mono">{formatUserId(row.readableId)}</td>
            <td className="user-dashboard-col-num">
              <strong>¥ {row.todayAmountYuan.toFixed(2)}</strong>
            </td>
            <td className="user-dashboard-col-num">{row.todayEcpmCount}</td>
            <td className="user-dashboard-col-num">
              ¥ {row.totalAmountYuan.toFixed(2)}
            </td>
            <td>{formatDate(row.registeredAt)}</td>
            <td>
              {row.lastActiveAt ? formatRelative(row.lastActiveAt) : '从未活跃'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const diffMs = Date.now() - t;
  if (diffMs < 60_000) return '刚刚';
  if (diffMs < 60 * 60_000) return `${Math.floor(diffMs / 60_000)} 分钟前`;
  if (diffMs < 24 * 60 * 60_000)
    return `${Math.floor(diffMs / (60 * 60_000))} 小时前`;
  return `${Math.floor(diffMs / (24 * 60 * 60_000))} 天前`;
}
