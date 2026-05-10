import { useCallback, useEffect, useState } from 'react';
import {
  EcpmRecordTable,
  type EcpmRecordView,
} from '../components/domain';
import { formatUserId } from '../lib/idFormat';
import { useThrottledRefresh } from '../lib/useThrottledRefresh';
import type {
  SuperAdminUnderCompanyResult,
  SuperAdminUnderGameResult,
  UserDashboardEcpmRecordsResult,
} from '../types/api';
import {
  RefreshWindowSelect,
  RowRefreshButton,
  type RefreshLookbackHours,
} from './SuperAdminDashboardPage';

export type DrilldownApi = {
  loadCompanyGames: (companyId: string) => Promise<SuperAdminUnderCompanyResult>;
  loadGameUsers: (gameId: string) => Promise<SuperAdminUnderGameResult>;
  loadUserRecords: (userId: string) => Promise<UserDashboardEcpmRecordsResult>;
  refreshScope: (
    body:
      | {
          scope: 'company';
          companyId: string;
          lookbackHours?: RefreshLookbackHours;
        }
      | {
          scope: 'game';
          gameId: string;
          lookbackHours?: RefreshLookbackHours;
        }
      | {
          scope: 'user';
          gameId: string;
          userId: string;
          lookbackHours?: RefreshLookbackHours;
        },
  ) => Promise<unknown>;
};

export type DrilldownPath =
  | {
      kind: 'company';
      companyId: string;
      companyName: string;
    }
  | {
      kind: 'game';
      companyId: string;
      companyName: string;
      gameId: string;
      gameName: string;
    }
  | {
      kind: 'user';
      companyId: string;
      companyName: string;
      gameId: string;
      gameName: string;
      userId: string;
      userReadableId: string;
    };

export type SuperAdminDrilldownProps = {
  path: DrilldownPath;
  api: DrilldownApi;
  onNavigate: (path: DrilldownPath | null) => void;
};

export function SuperAdminDrilldown(props: SuperAdminDrilldownProps) {
  return (
    <div className="user-dashboard admin-drilldown">
      <Breadcrumb path={props.path} onNavigate={props.onNavigate} />
      {props.path.kind === 'company' && (
        <CompanyLevel path={props.path} api={props.api} onNavigate={props.onNavigate} />
      )}
      {props.path.kind === 'game' && (
        <GameLevel path={props.path} api={props.api} onNavigate={props.onNavigate} />
      )}
      {props.path.kind === 'user' && (
        <UserLevel path={props.path} api={props.api} />
      )}
    </div>
  );
}

function Breadcrumb(props: {
  path: DrilldownPath;
  onNavigate: (path: DrilldownPath | null) => void;
}) {
  const { path } = props;
  return (
    <nav className="admin-drilldown-breadcrumb">
      <button type="button" className="admin-drilldown-bc-link" onClick={() => props.onNavigate(null)}>
        全平台
      </button>
      <span className="admin-drilldown-bc-sep">/</span>
      {path.kind === 'company' ? (
        <span className="admin-drilldown-bc-current">{path.companyName}</span>
      ) : (
        <button
          type="button"
          className="admin-drilldown-bc-link"
          onClick={() =>
            props.onNavigate({
              kind: 'company',
              companyId: path.companyId,
              companyName: path.companyName,
            })
          }
        >
          {path.companyName}
        </button>
      )}
      {(path.kind === 'game' || path.kind === 'user') && (
        <>
          <span className="admin-drilldown-bc-sep">/</span>
          {path.kind === 'game' ? (
            <span className="admin-drilldown-bc-current">{path.gameName}</span>
          ) : (
            <button
              type="button"
              className="admin-drilldown-bc-link"
              onClick={() =>
                props.onNavigate({
                  kind: 'game',
                  companyId: path.companyId,
                  companyName: path.companyName,
                  gameId: path.gameId,
                  gameName: path.gameName,
                })
              }
            >
              {path.gameName}
            </button>
          )}
        </>
      )}
      {path.kind === 'user' && (
        <>
          <span className="admin-drilldown-bc-sep">/</span>
          <span className="admin-drilldown-bc-current">
            {formatUserId(path.userReadableId)}
          </span>
        </>
      )}
    </nav>
  );
}

function CompanyLevel(props: {
  path: Extract<DrilldownPath, { kind: 'company' }>;
  api: DrilldownApi;
  onNavigate: (path: DrilldownPath) => void;
}) {
  const { path, api } = props;
  const [refreshHours, setRefreshHours] = useState<RefreshLookbackHours>(1);
  const fetchAll = useCallback(
    () => api.loadCompanyGames(path.companyId),
    [api, path.companyId],
  );
  const { data, loading, toast, refresh } =
    useThrottledRefresh<SuperAdminUnderCompanyResult>(fetchAll, {
      windowMs: 5000,
    });

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <section className="user-dashboard-records">
      <div className="user-dashboard-section-header">
        <h2>{path.companyName} · 游戏列表（按今日 ECPM 条数降序）</h2>
        <RefreshControls
          loading={loading}
          toast={toast}
          refresh={refresh}
          refreshHours={refreshHours}
          onChangeRefreshHours={setRefreshHours}
        />
      </div>
      {!data ? (
        <div className="user-dashboard-groups-empty">加载中…</div>
      ) : data.games.length === 0 ? (
        <div className="user-dashboard-groups-empty">该公司暂无游戏数据。</div>
      ) : (
        <table className="user-dashboard-groups-table">
          <thead>
            <tr>
              <th>游戏</th>
              <th className="user-dashboard-col-num">ECPM 条数</th>
              <th className="user-dashboard-col-num">活跃用户</th>
              <th className="user-dashboard-col-num">平均 ECPM</th>
              <th className="user-dashboard-col-num">最高 ECPM</th>
              <th className="user-dashboard-col-num">操作</th>
            </tr>
          </thead>
          <tbody>
            {data.games.map((g) => (
              <tr key={g.gameId}>
                <td>
                  <button
                    type="button"
                    className="admin-drilldown-link"
                    onClick={() =>
                      props.onNavigate({
                        kind: 'game',
                        companyId: path.companyId,
                        companyName: path.companyName,
                        gameId: g.gameId,
                        gameName: g.gameName,
                      })
                    }
                  >
                    {g.gameName} ▶
                  </button>
                </td>
                <td className="user-dashboard-col-num">{g.ecpmCount}</td>
                <td className="user-dashboard-col-num">{g.activeUserCount}</td>
                <td className="user-dashboard-col-num">¥ {g.averageEcpmYuan.toFixed(2)}</td>
                <td className="user-dashboard-col-num">
                  {g.maxEcpmYuan === 0 ? '—' : `¥ ${g.maxEcpmYuan.toFixed(2)}`}
                </td>
                <td className="user-dashboard-col-num">
                  <RowRefreshButton
                    hours={refreshHours}
                    onRefresh={async () => {
                      await api.refreshScope({
                        scope: 'game',
                        gameId: g.gameId,
                        lookbackHours: refreshHours,
                      });
                      await refresh();
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function GameLevel(props: {
  path: Extract<DrilldownPath, { kind: 'game' }>;
  api: DrilldownApi;
  onNavigate: (path: DrilldownPath) => void;
}) {
  const { path, api } = props;
  const [refreshHours, setRefreshHours] = useState<RefreshLookbackHours>(1);
  const fetchAll = useCallback(
    () => api.loadGameUsers(path.gameId),
    [api, path.gameId],
  );
  const { data, loading, toast, refresh } =
    useThrottledRefresh<SuperAdminUnderGameResult>(fetchAll, { windowMs: 5000 });

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <section className="user-dashboard-records">
      <div className="user-dashboard-section-header">
        <h2>{path.gameName} · 用户列表（按今日 ECPM 条数降序）</h2>
        <RefreshControls
          loading={loading}
          toast={toast}
          refresh={refresh}
          refreshHours={refreshHours}
          onChangeRefreshHours={setRefreshHours}
        />
      </div>
      {!data ? (
        <div className="user-dashboard-groups-empty">加载中…</div>
      ) : data.users.length === 0 ? (
        <div className="user-dashboard-groups-empty">该游戏暂无用户数据。</div>
      ) : (
        <table className="user-dashboard-groups-table">
          <thead>
            <tr>
              <th>用户 ID</th>
              <th className="user-dashboard-col-num">今日 ECPM 条数</th>
              <th className="user-dashboard-col-num">平均 ECPM</th>
              <th className="user-dashboard-col-num">最高 ECPM</th>
              <th>最近活跃</th>
              <th className="user-dashboard-col-num">操作</th>
            </tr>
          </thead>
          <tbody>
            {data.users.map((u) => (
              <tr key={u.userId}>
                <td>
                  <button
                    type="button"
                    className="admin-drilldown-link admin-drilldown-link-mono"
                    onClick={() =>
                      props.onNavigate({
                        kind: 'user',
                        companyId: path.companyId,
                        companyName: path.companyName,
                        gameId: path.gameId,
                        gameName: path.gameName,
                        userId: u.userId,
                        userReadableId: u.readableId,
                      })
                    }
                  >
                    {formatUserId(u.readableId)} ▶
                  </button>
                </td>
                <td className="user-dashboard-col-num">{u.ecpmCount}</td>
                <td className="user-dashboard-col-num">¥ {u.averageEcpmYuan.toFixed(2)}</td>
                <td className="user-dashboard-col-num">
                  {u.maxEcpmYuan === 0 ? '—' : `¥ ${u.maxEcpmYuan.toFixed(2)}`}
                </td>
                <td>{u.lastActiveAt ? formatRelative(u.lastActiveAt) : '从未活跃'}</td>
                <td className="user-dashboard-col-num">
                  <RowRefreshButton
                    hours={refreshHours}
                    onRefresh={async () => {
                      await api.refreshScope({
                        scope: 'user',
                        gameId: path.gameId,
                        userId: u.userId,
                        lookbackHours: refreshHours,
                      });
                      await refresh();
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function UserLevel(props: {
  path: Extract<DrilldownPath, { kind: 'user' }>;
  api: DrilldownApi;
}) {
  const { path, api } = props;
  const fetchAll = useCallback(
    () => api.loadUserRecords(path.userId),
    [api, path.userId],
  );
  const { data, loading, toast, refresh } =
    useThrottledRefresh<UserDashboardEcpmRecordsResult>(fetchAll, {
      windowMs: 5000,
    });

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const rows: EcpmRecordView[] = (data?.records ?? []).map((r) => ({
    todaySequence: r.todaySequence,
    eventTimeIso: r.eventTime,
    ecpmYuan: r.ecpmYuan,
    gameName: r.gameName,
    accountReadableId: r.accountReadableId,
    source: r.source,
  }));

  return (
    <section className="user-dashboard-records">
      <div className="user-dashboard-section-header">
        <h2>用户 {formatUserId(path.userReadableId)} · ECPM 记录</h2>
        <RefreshControls loading={loading} toast={toast} refresh={refresh} />
      </div>
      <EcpmRecordTable
        rows={rows}
        loading={!data}
        totalToday={data?.totalToday ?? 0}
        totalAll={data?.totalAll ?? 0}
      />
    </section>
  );
}

function RefreshControls(props: {
  loading: boolean;
  toast: { kind: string; message: string } | null;
  refresh: () => void;
  refreshHours?: RefreshLookbackHours;
  onChangeRefreshHours?: (value: RefreshLookbackHours) => void;
}) {
  return (
    <div className="user-dashboard-records-controls">
      {props.refreshHours !== undefined && props.onChangeRefreshHours && (
        <RefreshWindowSelect
          value={props.refreshHours}
          onChange={props.onChangeRefreshHours}
        />
      )}
      <button
        type="button"
        className="user-dashboard-refresh"
        onClick={() => props.refresh()}
        disabled={props.loading}
      >
        ⟳ 刷新本层
      </button>
      {props.toast && (
        <span
          className={`user-dashboard-toast user-dashboard-toast-${props.toast.kind}`}
        >
          {props.toast.message}
        </span>
      )}
    </div>
  );
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
