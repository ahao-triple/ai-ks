import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DashboardRangeTabs,
  EcpmRecordTable,
  type DashboardRangeKey,
  type EcpmRecordExtraColumn,
  type EcpmRecordView,
} from '../components/domain';
import { formatUserId } from '../lib/idFormat';
import { useThrottledRefresh } from '../lib/useThrottledRefresh';
import type {
  UserDashboardEcpmRecordsResult,
  UserDashboardGameGroup,
  UserDashboardOverview,
} from '../types/api';

export type UserDashboardApi = {
  getUserDashboardOverview: (
    range?: DashboardRangeKey,
  ) => Promise<UserDashboardOverview>;
  getUserDashboardGroups: (
    range?: DashboardRangeKey,
  ) => Promise<UserDashboardGameGroup[]>;
  getUserDashboardRecords: (input: {
    range?: DashboardRangeKey;
    gameId?: string;
    accountId?: string;
    limit?: number;
  }) => Promise<UserDashboardEcpmRecordsResult>;
};

export type UserDashboardData = {
  overview: UserDashboardOverview;
  groups: UserDashboardGameGroup[];
  records: UserDashboardEcpmRecordsResult;
};

export type UserDashboardPageProps = {
  api: UserDashboardApi;
  userReadableId: string;
  initialData?: UserDashboardData;
};

export function UserDashboardPage(props: UserDashboardPageProps) {
  const { api, userReadableId, initialData } = props;
  const [rangeKey, setRangeKey] = useState<DashboardRangeKey>('today');
  const [selectedGameId, setSelectedGameId] = useState<string | undefined>();
  const [extraColumns, setExtraColumns] = useState<EcpmRecordExtraColumn[]>([]);
  const [autoRefreshOn, setAutoRefreshOn] = useState(false);
  const [autoIntervalMs, setAutoIntervalMs] = useState(10_000);

  const fetchAll = useCallback(async (): Promise<UserDashboardData> => {
    const [overview, groups, records] = await Promise.all([
      api.getUserDashboardOverview(rangeKey),
      api.getUserDashboardGroups(rangeKey),
      api.getUserDashboardRecords({
        range: rangeKey,
        gameId: selectedGameId,
        limit: 50,
      }),
    ]);
    return { overview, groups, records };
  }, [api, rangeKey, selectedGameId]);

  const {
    data: liveData,
    loading,
    toast,
    refresh,
    startAuto,
    stopAuto,
  } = useThrottledRefresh<UserDashboardData>(fetchAll, { windowMs: 5000 });
  const data = liveData ?? initialData ?? null;

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (autoRefreshOn) startAuto(autoIntervalMs);
    else stopAuto();
    return () => stopAuto();
  }, [autoRefreshOn, autoIntervalMs, startAuto, stopAuto]);

  const recordViews: EcpmRecordView[] = useMemo(
    () =>
      (data?.records.records ?? []).map((r) => ({
        todaySequence: r.todaySequence,
        eventTimeIso: r.eventTime,
        ecpmYuan: r.ecpmYuan,
        gameName: r.gameName,
        accountReadableId: r.accountReadableId,
        source: r.source,
      })),
    [data?.records.records],
  );

  const selectedGame = data?.groups.find(
    (g) => g.gameId === selectedGameId,
  );
  const isDrilldown = Boolean(selectedGame);

  return (
    <div className="user-dashboard">
      <header className="user-dashboard-header">
        <div>
          {isDrilldown ? (
            <>
              <div className="user-dashboard-breadcrumb">
                <button
                  type="button"
                  className="user-dashboard-bc-link"
                  onClick={() => setSelectedGameId(undefined)}
                >
                  ← 我的全部游戏
                </button>
                <span className="user-dashboard-bc-sep">/</span>
                <span className="user-dashboard-bc-current">
                  {selectedGame!.gameName}
                </span>
              </div>
              <div className="user-dashboard-subtitle">
                {selectedGame!.accounts.length} 个账号 · 今日 {selectedGame!.todayCount} 条 ECPM
              </div>
            </>
          ) : (
            <>
              <div className="user-dashboard-greeting">
                你好 <span className="user-dashboard-uid">{formatUserId(userReadableId)}</span>
              </div>
              <div className="user-dashboard-subtitle">
                {data
                  ? `${data.overview.gameCount} 个游戏 · ${data.overview.accountCount} 个账号`
                  : '加载中…'}
              </div>
            </>
          )}
        </div>
        <div className="user-dashboard-time-filters">
          <DashboardRangeTabs value={rangeKey} onChange={setRangeKey} />
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
        {isDrilldown ? (
          <>
            <KpiCard
              label="今日 ECPM 条数"
              value={String(selectedGame!.todayCount)}
            />
            <KpiCard
              label="今日平均 ECPM"
              value={`¥ ${selectedGame!.todayAverageEcpmYuan.toFixed(2)}`}
            />
            <KpiCard
              label="累计 ECPM 条数"
              value={String(selectedGame!.totalCount)}
            />
            <KpiCard
              label="账号数"
              value={String(selectedGame!.accounts.length)}
              hint={`${
                selectedGame!.accounts.filter((a) => a.activeStatus === 'ACTIVE').length
              } 个今日活跃`}
            />
          </>
        ) : (
          <>
            <KpiCard
              label="今日 ECPM 条数"
              value={data ? String(data.overview.todayCount) : '—'}
            />
            <KpiCard
              label="今日平均 ECPM"
              value={data ? `¥ ${data.overview.todayAverageEcpmYuan.toFixed(2)}` : '—'}
              hint={
                data ? `最高 ¥ ${data.overview.todayMaxEcpmYuan.toFixed(2)}` : ''
              }
            />
            <KpiCard
              label="游戏数"
              value={data ? String(data.overview.gameCount) : '—'}
              hint={data ? `${data.overview.activeGameCount} 个今日活跃` : ''}
            />
            <KpiCard
              label="账号总数"
              value={data ? String(data.overview.accountCount) : '—'}
              hint={data ? `${data.overview.activeAccountCount} 个今日活跃` : ''}
            />
          </>
        )}
      </section>

      <section className="user-dashboard-groups">
        <div className="user-dashboard-section-header">
          <h2>{isDrilldown ? '该游戏下的账号' : '我的游戏与账号'}</h2>
          {!isDrilldown && (
            <span className="user-dashboard-subtitle">点击游戏名进入下钻</span>
          )}
        </div>
        {isDrilldown ? (
          <SingleGameAccounts game={selectedGame!} />
        ) : (
          <GameAccountGroups
            groups={data?.groups ?? []}
            onSelectGame={(gameId) => setSelectedGameId(gameId)}
          />
        )}
      </section>

      <section className="user-dashboard-records">
        <div className="user-dashboard-section-header">
          <h2>
            {isDrilldown
              ? `${selectedGame!.gameName} · ECPM 记录`
              : '我的 ECPM 记录'}
          </h2>
          <div className="user-dashboard-records-controls">
            <button
              type="button"
              className="user-dashboard-cols"
              onClick={() =>
                setExtraColumns((cols) =>
                  cols.length === 0 ? ['displayAmount'] : [],
                )
              }
            >
              ⚙ 列设置
            </button>
            <label className="user-dashboard-auto">
              <input
                type="checkbox"
                checked={autoRefreshOn}
                onChange={(e) => setAutoRefreshOn(e.target.checked)}
              />
              自动刷新
            </label>
            <select
              className="user-dashboard-interval"
              value={autoIntervalMs}
              onChange={(e) => setAutoIntervalMs(Number(e.target.value))}
            >
              <option value={5000}>5 秒</option>
              <option value={10000}>10 秒</option>
              <option value={30000}>30 秒</option>
            </select>
          </div>
        </div>
        <EcpmRecordTable
          rows={recordViews}
          loading={loading && !data}
          totalToday={data?.records.totalToday ?? 0}
          totalAll={data?.records.totalAll ?? 0}
          extraColumns={extraColumns}
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

function GameAccountGroups(props: {
  groups: UserDashboardGameGroup[];
  onSelectGame: (gameId: string) => void;
}) {
  if (props.groups.length === 0) {
    return (
      <div className="user-dashboard-groups-empty">
        还没有绑定游戏，绑定后这里会显示游戏与账号列表。
      </div>
    );
  }

  return (
    <>
      {/* 桌面：合并表格 */}
      <table className="user-dashboard-groups-table">
        <thead>
          <tr>
            <th>游戏 / 账号</th>
            <th className="user-dashboard-col-num">今日条数</th>
            <th className="user-dashboard-col-num">平均 ECPM</th>
            <th className="user-dashboard-col-num">累计</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          {props.groups.map((group) => (
            <GroupRows
              key={group.gameId}
              group={group}
              onSelectGame={props.onSelectGame}
            />
          ))}
        </tbody>
      </table>

      {/* 移动：折叠卡（点击游戏标题区进入下钻） */}
      <div className="user-dashboard-groups-mobile">
        {props.groups.map((group) => (
          <div
            className="user-dashboard-groups-detail"
            key={`m-${group.gameId}`}
          >
            <button
              type="button"
              className="user-dashboard-groups-mobile-button"
              onClick={() => props.onSelectGame(group.gameId)}
            >
              <div>
                <div className="user-dashboard-groups-game">
                  {group.gameName} ▶
                </div>
                <div className="user-dashboard-groups-meta">
                  {group.accounts.length} 个账号 · 今日 {group.todayCount} 条 · 平均 ¥
                  {group.todayAverageEcpmYuan.toFixed(2)}
                </div>
              </div>
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

function GroupRows({
  group,
  onSelectGame,
}: {
  group: UserDashboardGameGroup;
  onSelectGame: (gameId: string) => void;
}) {
  return (
    <>
      <tr className="user-dashboard-groups-summary">
        <td>
          <button
            type="button"
            className="user-dashboard-game-link"
            onClick={() => onSelectGame(group.gameId)}
          >
            <strong>{group.gameName}</strong> ▶
          </button>{' '}
          <span className="user-dashboard-groups-count">
            {group.accounts.length} 个账号
          </span>
        </td>
        <td className="user-dashboard-col-num">
          <strong>{group.todayCount}</strong>
        </td>
        <td className="user-dashboard-col-num">
          <strong>¥ {group.todayAverageEcpmYuan.toFixed(2)}</strong>
        </td>
        <td className="user-dashboard-col-num">
          <strong>{group.totalCount}</strong>
        </td>
        <td />
      </tr>
      {group.accounts.map((account) => (
        <tr key={account.accountId}>
          <td className="user-dashboard-groups-account">
            <span className="user-dashboard-mono">{account.readableId}</span>
          </td>
          <td className="user-dashboard-col-num">{account.todayCount}</td>
          <td className="user-dashboard-col-num">
            ¥ {account.todayAverageEcpmYuan.toFixed(2)}
          </td>
          <td className="user-dashboard-col-num">{account.totalCount}</td>
          <td>
            <StatusBadge status={account.activeStatus} />
          </td>
        </tr>
      ))}
    </>
  );
}

function SingleGameAccounts({ game }: { game: UserDashboardGameGroup }) {
  if (game.accounts.length === 0) {
    return (
      <div className="user-dashboard-groups-empty">
        该游戏暂无绑定账号。
      </div>
    );
  }
  return (
    <table className="user-dashboard-groups-table">
      <thead>
        <tr>
          <th>账号</th>
          <th className="user-dashboard-col-num">今日条数</th>
          <th className="user-dashboard-col-num">平均 ECPM</th>
          <th className="user-dashboard-col-num">累计</th>
          <th>状态</th>
        </tr>
      </thead>
      <tbody>
        {game.accounts.map((account) => (
          <tr key={account.accountId}>
            <td>
              <span className="user-dashboard-mono">{account.readableId}</span>
            </td>
            <td className="user-dashboard-col-num">{account.todayCount}</td>
            <td className="user-dashboard-col-num">
              ¥ {account.todayAverageEcpmYuan.toFixed(2)}
            </td>
            <td className="user-dashboard-col-num">{account.totalCount}</td>
            <td>
              <StatusBadge status={account.activeStatus} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function StatusBadge({
  status,
}: {
  status: UserDashboardGameGroup['accounts'][number]['activeStatus'];
}) {
  const text =
    status === 'ACTIVE' ? '活跃' : status === 'IDLE' ? '闲置' : '从未活跃';
  return (
    <span className={`user-dashboard-status user-dashboard-status-${status.toLowerCase()}`}>
      {text}
    </span>
  );
}
