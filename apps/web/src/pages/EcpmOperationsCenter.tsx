import { useState } from 'react';
import {
  Button,
  DataTable,
  InputField,
  Panel,
  StatusBadge,
  type DataTableColumn,
} from '../components/ui';
import { formatMoney } from '../lib/format';
import type {
  AdminCompany,
  AdminGame,
  EcpmDashboardRow,
  EcpmDashboardScope,
  EcpmUpdateJob,
  EcpmUpdateJobItem,
  EcpmUpdateJobStatus,
  EcpmUpdateMode,
  EcpmUpdateRequest,
  EcpmUpdateScopeType,
} from '../types/api';

export type EcpmOperationsCenterProps = {
  canUpdate: boolean;
  companies: AdminCompany[];
  games: AdminGame[];
  jobs: EcpmUpdateJob[];
  loadingAction: '' | 'ecpm-dashboard' | 'ecpm-update' | 'ecpm-jobs';
  onDashboardQuery(
    scope: EcpmDashboardScope,
    query: Record<string, string | undefined>,
  ): void;
  onJobSelect(jobId: string): void;
  onUpdate(request: EcpmUpdateRequest): void;
  rows: EcpmDashboardRow[];
  selectedJob?: EcpmUpdateJob;
};

type TabId = 'dashboard' | 'reports' | 'update';

const dashboardScopes: Array<{ label: string; value: EcpmDashboardScope }> = [
  { label: '最新数据', value: 'latest' },
  { label: '公司', value: 'company' },
  { label: '游戏', value: 'game' },
  { label: '用户', value: 'user' },
  { label: 'open_id', value: 'open_id' },
];

const updateScopes: Array<{ label: string; value: EcpmUpdateScopeType }> = [
  { label: '公司', value: 'company' },
  { label: '游戏', value: 'game' },
  { label: '用户', value: 'user' },
  { label: 'open_id', value: 'open_id' },
];

const updateModes: Array<{ label: string; value: EcpmUpdateMode }> = [
  { label: '最新数据', value: 'latest' },
  { label: '时间范围', value: 'range' },
];

const dashboardColumns: Array<DataTableColumn<EcpmDashboardRow>> = [
  {
    key: 'dataHour',
    label: '数据小时',
  },
  {
    key: 'companyName',
    label: '公司',
    render: (row) => row.companyName ?? row.companyId ?? '-',
  },
  {
    key: 'gameName',
    label: '游戏',
    render: (row) => row.gameName || row.gameAppId,
  },
  {
    key: 'openId',
    label: 'open_id',
    render: (row) => row.openId ?? row.openIdRecordId ?? '-',
  },
  {
    align: 'right',
    key: 'openIdCount',
    label: 'open_id 数',
    render: (row) => row.openIdCount ?? '-',
  },
  {
    key: 'readableId',
    label: '可读 ID',
    render: (row) =>
      [row.readableId, row.userReadableId].filter(Boolean).join(' / ') || '-',
  },
  {
    key: 'username',
    label: '用户',
    render: (row) => row.username ?? row.userReadableId ?? row.userId ?? '-',
  },
  {
    key: 'status',
    label: '结算状态',
    render: (row) => row.status ?? '-',
  },
  {
    align: 'right',
    key: 'eventCount',
    label: '事件',
    render: (row) => row.eventCount ?? '-',
  },
  {
    align: 'right',
    key: 'rawCost',
    label: '原始金额',
    render: (row) => formatMoney(row.rawCost),
  },
  {
    align: 'right',
    key: 'displayAmount',
    label: '展示金额',
    render: (row) => formatMoney(row.displayAmount),
  },
  {
    key: 'updatedAt',
    label: '更新时间',
    render: (row) => row.updatedAt ?? row.createdAt ?? row.eventTime ?? '-',
  },
];

const reportColumns: Array<DataTableColumn<EcpmUpdateJobItem>> = [
  {
    key: 'dataHour',
    label: '数据小时',
  },
  {
    key: 'gameAppId',
    label: '游戏',
    render: (row) => row.gameAppId ?? row.gameId ?? '-',
  },
  {
    key: 'openId',
    label: 'open_id',
    render: (row) => row.openId ?? '-',
  },
  {
    key: 'userId',
    label: '用户',
    render: (row) => row.userId ?? '-',
  },
  {
    align: 'right',
    key: 'savedCount',
    label: '成功',
  },
  {
    key: 'status',
    label: '状态',
    render: (row) => (
      <StatusBadge tone={updateStatusTone(row.status)}>
        {updateStatusLabel(row.status)}
      </StatusBadge>
    ),
  },
  {
    key: 'skipReason',
    label: '跳过原因',
    render: (row) => row.skipReason ?? row.errorMessage ?? '-',
  },
];

function buildDashboardQuery(
  dashboardScope: EcpmDashboardScope,
  scopeId: string,
  startedDataHour: string | null,
  endedDataHour: string | null,
): Record<string, string | undefined> {
  const query: Record<string, string | undefined> = {};

  if (dashboardScope === 'company') {
    query.companyId = scopeId || undefined;
  }

  if (dashboardScope === 'game') {
    query.gameId = scopeId || undefined;
  }

  if (dashboardScope === 'user') {
    query.userId = scopeId || undefined;
  }

  if (dashboardScope === 'open_id') {
    query.openId = scopeId || undefined;
  }

  if (startedDataHour) {
    query.startedDataHour = startedDataHour;
  }

  if (endedDataHour) {
    query.endedDataHour = endedDataHour;
  }

  return query;
}

function updateStatusLabel(status: EcpmUpdateJobStatus) {
  if (status === 'SUCCEEDED') {
    return '成功';
  }

  if (status === 'FAILED') {
    return '失败';
  }

  if (status === 'PARTIAL') {
    return '部分';
  }

  return '运行中';
}

function updateStatusTone(status: EcpmUpdateJobStatus) {
  if (status === 'SUCCEEDED') {
    return 'success';
  }

  if (status === 'FAILED') {
    return 'danger';
  }

  if (status === 'PARTIAL') {
    return 'warning';
  }

  return 'info';
}

function scopeLabel(scope: EcpmUpdateScopeType) {
  return updateScopes.find((item) => item.value === scope)?.label ?? scope;
}

function modeLabel(mode: EcpmUpdateMode) {
  return updateModes.find((item) => item.value === mode)?.label ?? mode;
}

function normalizeChinaDataHour(value: string) {
  const match = value
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):00(?::00)?$/);
  if (!match) {
    return null;
  }

  const [, yearText, monthText, dayText, hourText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const date = new Date(Date.UTC(year, month - 1, day, hour));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour
  ) {
    return null;
  }

  return `${yearText}-${monthText}-${dayText}T${hourText}:00:00+08:00`;
}

function isReversedDataHourRange(
  startedDataHour: string | null,
  endedDataHour: string | null,
) {
  return Boolean(
    startedDataHour &&
      endedDataHour &&
      startedDataHour > endedDataHour,
  );
}

function dataHourRangeCount(
  startedDataHour: string | null,
  endedDataHour: string | null,
) {
  if (!startedDataHour || !endedDataHour) {
    return null;
  }

  const startedAt = Date.parse(startedDataHour);
  const endedAt = Date.parse(endedDataHour);
  if (Number.isNaN(startedAt) || Number.isNaN(endedAt) || endedAt < startedAt) {
    return null;
  }

  return Math.floor((endedAt - startedAt) / 3_600_000) + 1;
}

function isDataHourRangeTooLong(
  startedDataHour: string | null,
  endedDataHour: string | null,
) {
  const count = dataHourRangeCount(startedDataHour, endedDataHour);
  return count !== null && count > 24;
}

export function EcpmOperationsCenter({
  canUpdate,
  companies,
  games,
  jobs,
  loadingAction,
  onDashboardQuery,
  onJobSelect,
  onUpdate,
  rows,
  selectedJob,
}: EcpmOperationsCenterProps) {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [dashboardScope, setDashboardScope] =
    useState<EcpmDashboardScope>('latest');
  const [updateMode, setUpdateMode] = useState<EcpmUpdateMode>('latest');
  const [updateScopeType, setUpdateScopeType] =
    useState<EcpmUpdateScopeType>('game');
  const [dashboardScopeId, setDashboardScopeId] = useState('');
  const [updateScopeId, setUpdateScopeId] = useState('');
  const [dashboardStartedDataHour, setDashboardStartedDataHour] = useState('');
  const [dashboardEndedDataHour, setDashboardEndedDataHour] = useState('');
  const [startedDataHour, setStartedDataHour] = useState('');
  const [endedDataHour, setEndedDataHour] = useState('');

  const dashboardLoading = loadingAction === 'ecpm-dashboard';
  const updateLoading = loadingAction === 'ecpm-update';
  const jobsLoading = loadingAction === 'ecpm-jobs';
  const loading = loadingAction !== '';
  const trimmedDashboardScopeId = dashboardScopeId.trim();
  const trimmedUpdateScopeId = updateScopeId.trim();
  const normalizedDashboardStartedDataHour = normalizeChinaDataHour(
    dashboardStartedDataHour,
  );
  const normalizedDashboardEndedDataHour = normalizeChinaDataHour(
    dashboardEndedDataHour,
  );
  const normalizedStartedDataHour = normalizeChinaDataHour(startedDataHour);
  const normalizedEndedDataHour = normalizeChinaDataHour(endedDataHour);
  const dashboardRangeInvalid =
    (dashboardStartedDataHour.trim() !== '' &&
      !normalizedDashboardStartedDataHour) ||
    (dashboardEndedDataHour.trim() !== '' && !normalizedDashboardEndedDataHour) ||
    isReversedDataHourRange(
      normalizedDashboardStartedDataHour,
      normalizedDashboardEndedDataHour,
    );
  const dashboardScopeNeedsId =
    dashboardScope === 'user' || dashboardScope === 'open_id';
  const dashboardQueryDisabled =
    dashboardLoading ||
    dashboardRangeInvalid ||
    (dashboardScopeNeedsId && !trimmedDashboardScopeId);
  const rangeUpdateInvalid =
    updateMode === 'range' &&
    (!normalizedStartedDataHour ||
      !normalizedEndedDataHour ||
      isReversedDataHourRange(normalizedStartedDataHour, normalizedEndedDataHour) ||
      isDataHourRangeTooLong(normalizedStartedDataHour, normalizedEndedDataHour));
  const updateScopeExists =
    updateScopeType === 'company'
      ? companies.some((company) => company.id === trimmedUpdateScopeId)
      : updateScopeType === 'game'
        ? games.some((game) => game.id === trimmedUpdateScopeId)
        : true;
  const reportRows = selectedJob?.items ?? [];
  const reportRequestCount =
    selectedJob?.requestCount ?? selectedJob?.itemCount ?? reportRows.length;
  const coveredDataHours = Array.from(
    new Set(reportRows.map((item) => item.dataHour)),
  ).sort();
  const updateDisabled =
    !canUpdate ||
    loading ||
    !trimmedUpdateScopeId ||
    !updateScopeExists ||
    rangeUpdateInvalid;

  const jobColumns: Array<DataTableColumn<EcpmUpdateJob>> = [
    {
      key: 'id',
      label: '任务',
    },
    {
      key: 'scopeType',
      label: '范围',
      render: (job) => `${scopeLabel(job.scopeType)} ${job.scopeId}`,
    },
    {
      key: 'mode',
      label: '模式',
      render: (job) => modeLabel(job.mode),
    },
    {
      key: 'status',
      label: '状态',
      render: (job) => (
        <StatusBadge tone={updateStatusTone(job.status)}>
          {updateStatusLabel(job.status)}
        </StatusBadge>
      ),
    },
    {
      align: 'right',
      key: 'savedCount',
      label: '成功',
    },
    {
      align: 'right',
      key: 'failedCount',
      label: '失败',
    },
    {
      align: 'right',
      key: 'skippedCount',
      label: '跳过',
    },
    {
      key: 'actions',
      label: '操作',
      render: (job) => (
        <Button
          compact
          disabled={jobsLoading}
          onClick={() => onJobSelect(job.id)}
          variant={selectedJob?.id === job.id ? 'secondary' : 'ghost'}
        >
          查看
        </Button>
      ),
    },
  ];

  function handleDashboardQuery() {
    if (dashboardQueryDisabled) {
      return;
    }

    onDashboardQuery(
      dashboardScope,
      buildDashboardQuery(
        dashboardScope,
        trimmedDashboardScopeId,
        normalizedDashboardStartedDataHour,
        normalizedDashboardEndedDataHour,
      ),
    );
  }

  function handleDashboardScopeChange(scope: EcpmDashboardScope) {
    if (scope === dashboardScope) {
      return;
    }

    setDashboardScope(scope);
    setDashboardScopeId('');
  }

  function handleUpdateScopeTypeChange(scopeType: EcpmUpdateScopeType) {
    if (scopeType === updateScopeType) {
      return;
    }

    setUpdateScopeType(scopeType);
    setUpdateScopeId('');
  }

  function handleUpdate() {
    if (updateDisabled) {
      return;
    }

    onUpdate({
      endedDataHour: updateMode === 'range' ? normalizedEndedDataHour : null,
      mode: updateMode,
      scopeId: trimmedUpdateScopeId,
      scopeType: updateScopeType,
      startedDataHour: updateMode === 'range' ? normalizedStartedDataHour : null,
    });
  }

  return (
    <div className="ecpm-center">
      <div aria-label="ECPM operations" className="ecpm-tabs" role="tablist">
        <Button
          aria-selected={activeTab === 'dashboard'}
          compact
          onClick={() => setActiveTab('dashboard')}
          role="tab"
          variant={activeTab === 'dashboard' ? 'primary' : 'secondary'}
        >
          数据
        </Button>
        <Button
          aria-selected={activeTab === 'reports'}
          compact
          onClick={() => setActiveTab('reports')}
          role="tab"
          variant={activeTab === 'reports' ? 'primary' : 'secondary'}
        >
          报告
        </Button>
        <Button
          aria-selected={activeTab === 'update'}
          compact
          onClick={() => setActiveTab('update')}
          role="tab"
          variant={activeTab === 'update' ? 'primary' : 'secondary'}
        >
          更新
        </Button>
      </div>

      <div className="ecpm-tab-panel" hidden={activeTab !== 'dashboard'} role="tabpanel">
        <Panel
          actions={
            <Button
              compact
              disabled={dashboardQueryDisabled}
              onClick={handleDashboardQuery}
              variant="secondary"
            >
              {dashboardLoading ? '查询中' : '查询'}
            </Button>
          }
          title="ECPM 数据"
        >
          <div className="ecpm-controls" role="group">
            {dashboardScopes.map((scope) => (
              <Button
                aria-pressed={dashboardScope === scope.value}
                compact
                key={scope.value}
                onClick={() => handleDashboardScopeChange(scope.value)}
                variant={dashboardScope === scope.value ? 'primary' : 'secondary'}
              >
                {scope.label}
              </Button>
            ))}
          </div>
          <InputField
            id="ecpm-dashboard-scope-id"
            label="查询 ID"
            onChange={setDashboardScopeId}
            value={dashboardScopeId}
          />
          <div className="ecpm-controls">
            <InputField
              id="ecpm-dashboard-started-data-hour"
              label="开始小时"
              onChange={setDashboardStartedDataHour}
              step={3600}
              type="datetime-local"
              value={dashboardStartedDataHour}
            />
            <InputField
              id="ecpm-dashboard-ended-data-hour"
              label="结束小时"
              onChange={setDashboardEndedDataHour}
              step={3600}
              type="datetime-local"
              value={dashboardEndedDataHour}
            />
          </div>
          <DataTable
            columns={dashboardColumns}
            emptyLabel="暂无数据"
            getRowKey={(row, index) => row.id ?? `${row.gameId}-${row.openId ?? index}`}
            rows={rows}
          />
        </Panel>
      </div>

      <div className="ecpm-tab-panel" hidden={activeTab !== 'reports'} role="tabpanel">
        <Panel
          actions={
            <div className="ecpm-report-grid">
              <StatusBadge tone="success">成功 {selectedJob?.savedCount ?? 0}</StatusBadge>
              <StatusBadge tone="danger">失败 {selectedJob?.failedCount ?? 0}</StatusBadge>
              <StatusBadge tone="warning">跳过 {selectedJob?.skippedCount ?? 0}</StatusBadge>
            </div>
          }
          title="更新报告"
        >
          {selectedJob ? (
            <div className="ecpm-report-grid">
              <StatusBadge tone="muted">
                {selectedJob.actorType} {selectedJob.actorId}
              </StatusBadge>
              <span>创建 {selectedJob.createdAt}</span>
              <span>开始 {selectedJob.startedAt}</span>
              <span>完成 {selectedJob.finishedAt ?? '-'}</span>
              <span>
                数据 {selectedJob.startedDataHour} - {selectedJob.endedDataHour}
              </span>
              <span>请求游戏 {selectedJob.requestedGameCount}</span>
              <span>open_id {selectedJob.requestedOpenIdCount}</span>
              <span>来源 {selectedJob.source ?? '-'}</span>
              <span>请求数 {reportRequestCount}</span>
              {selectedJob.errorMessage ? (
                <StatusBadge tone="danger">{selectedJob.errorMessage}</StatusBadge>
              ) : null}
              <span>
                覆盖小时 {coveredDataHours.length > 0 ? coveredDataHours.join(' / ') : '-'}
              </span>
            </div>
          ) : null}
          <DataTable
            columns={jobColumns}
            emptyLabel={jobsLoading ? '加载中' : '暂无任务'}
            getRowKey={(job) => job.id}
            rows={jobs}
          />
          <DataTable
            columns={reportColumns}
            emptyLabel="暂无报告"
            getRowKey={(item) => item.id}
            rows={reportRows}
          />
        </Panel>
      </div>

      <div className="ecpm-tab-panel" hidden={activeTab !== 'update'} role="tabpanel">
        <Panel
          actions={
            <Button compact disabled={updateDisabled} onClick={handleUpdate}>
              {updateLoading ? '更新中' : '更新'}
            </Button>
          }
          title="ECPM 更新"
        >
          <div className="ecpm-controls" role="group">
            {updateModes.map((mode) => (
              <Button
                aria-pressed={updateMode === mode.value}
                compact
                key={mode.value}
                onClick={() => setUpdateMode(mode.value)}
                variant={updateMode === mode.value ? 'primary' : 'secondary'}
              >
                {mode.label}
              </Button>
            ))}
          </div>
          <div className="ecpm-controls" role="group">
            {updateScopes.map((scope) => (
              <Button
                aria-pressed={updateScopeType === scope.value}
                compact
                key={scope.value}
                onClick={() => handleUpdateScopeTypeChange(scope.value)}
                variant={updateScopeType === scope.value ? 'primary' : 'secondary'}
              >
                {scope.label}
              </Button>
            ))}
          </div>
          <div className="ecpm-controls">
            {updateScopeType === 'company' ? (
              <label className="ecpm-select-field" htmlFor="ecpm-company-scope">
                <span>公司</span>
                <select
                  id="ecpm-company-scope"
                  onChange={(event) => setUpdateScopeId(event.currentTarget.value)}
                  value={updateScopeId}
                >
                  <option value="">未选择</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {updateScopeType === 'game' ? (
              <label className="ecpm-select-field" htmlFor="ecpm-game-scope">
                <span>游戏</span>
                <select
                  id="ecpm-game-scope"
                  onChange={(event) => setUpdateScopeId(event.currentTarget.value)}
                  value={updateScopeId}
                >
                  <option value="">未选择</option>
                  {games.map((game) => (
                    <option key={game.id} value={game.id}>
                      {game.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {updateScopeType === 'user' ? (
              <InputField
                id="ecpm-user-scope"
                label="用户"
                onChange={setUpdateScopeId}
                value={updateScopeId}
              />
            ) : null}
            {updateScopeType === 'open_id' ? (
              <InputField
                id="ecpm-open-id-scope"
                label="open_id"
                onChange={setUpdateScopeId}
                value={updateScopeId}
              />
            ) : null}
          </div>
          {updateMode === 'range' ? (
            <div className="ecpm-controls">
              <InputField
                id="ecpm-started-data-hour"
                label="开始小时"
                onChange={setStartedDataHour}
                step={3600}
                type="datetime-local"
                value={startedDataHour}
              />
              <InputField
                id="ecpm-ended-data-hour"
                label="结束小时"
                onChange={setEndedDataHour}
                step={3600}
                type="datetime-local"
                value={endedDataHour}
              />
            </div>
          ) : null}
        </Panel>
      </div>
    </div>
  );
}
