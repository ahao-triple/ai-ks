import { KeyRound, RefreshCw, Send } from 'lucide-react';
import {
  AuditLogTable,
  EcpmTable,
  ReadoutGrid,
  WithdrawalBatchTable,
} from '../components/domain';
import { Button, InputField, MetricCard, Panel, StatusBadge } from '../components/ui';
import { formatAuditMetadata, formatMoney } from '../lib/format';
import type {
  AdminCompany,
  AdminGame,
  AdminWithdrawalBatch,
  AdminWithdrawalDetailResult,
  AuditLogRow,
  AdminSettlementBatch,
  AdminSettlementPreview,
  DemoGame,
  EcpmRefreshResult,
  GameSessionResult,
  KuaishouTokenStatusResult,
} from '../types/api';

export type OperationsWorkspaceBusyAction =
  | ''
  | 'admin-resources'
  | 'admin-withdrawals'
  | 'audit-logs'
  | 'company-balance'
  | 'company-create'
  | 'game-budget'
  | 'game-create'
  | 'kuaishou-authorize'
  | 'kuaishou-refresh-token'
  | 'kuaishou-token'
  | 'refresh'
  | 'settlement-confirm'
  | 'settlement-preview'
  | 'session'
  | `approve-${string}`
  | `close-${string}`
  | `detail-${string}`
  | `pay-failed-${string}`
  | `pay-success-${string}`;

export interface OperationsWorkspaceProps {
  adminCompanies: AdminCompany[];
  adminGames: AdminGame[];
  adminName: string;
  adminWithdrawalStatus: string;
  adminWithdrawals: AdminWithdrawalBatch[];
  auditLogs: AuditLogRow[];
  balanceAmountYuan: string;
  balanceCompanyId: string;
  balanceReason: string;
  budgetAmountYuan: string;
  budgetGameId: string;
  budgetReason: string;
  busyAction: OperationsWorkspaceBusyAction;
  gameAppId: string;
  games: DemoGame[];
  jsCode: string;
  kuaishouAppId: string;
  kuaishouAuthCode: string;
  kuaishouSecret: string;
  kuaishouTokenStatus?: KuaishouTokenStatusResult;
  newCompanyName: string;
  newGameAppId: string;
  newGameCompanyId: string;
  newGameName: string;
  newGameSecret: string;
  onAdjustCompanyBalance(): void;
  onAllocateGameBudget(): void;
  onApproveWithdrawal(batchId: string): void;
  onBalanceAmountChange(value: string): void;
  onBalanceCompanyIdChange(value: string): void;
  onBalanceReasonChange(value: string): void;
  onBudgetAmountChange(value: string): void;
  onBudgetGameIdChange(value: string): void;
  onBudgetReasonChange(value: string): void;
  onCloseWithdrawal(batchId: string): void;
  onConfirmSettlement(): void;
  onCreateCompany(): void;
  onCreateGame(): void;
  onCreateSession(): void;
  onGameChange(value: string): void;
  onJsCodeChange(value: string): void;
  onKuaishouAppIdChange(value: string): void;
  onKuaishouAuthCodeChange(value: string): void;
  onKuaishouAuthorize(): void;
  onKuaishouRefreshToken(): void;
  onKuaishouSecretChange(value: string): void;
  onLoadKuaishouTokenStatus(): void;
  onLoadAdminResources(): void;
  onLoadAuditLogs(): void;
  onLoadWithdrawalDetail(batchId: string): void;
  onLoadWithdrawals(status?: string): void;
  onNewCompanyNameChange(value: string): void;
  onNewGameAppIdChange(value: string): void;
  onNewGameCompanyIdChange(value: string): void;
  onNewGameNameChange(value: string): void;
  onNewGameSecretChange(value: string): void;
  onPayWithdrawal(batchId: string, result: 'failed' | 'success'): void;
  onPreviewSettlement(): void;
  onRefreshEcpm(): void;
  onSettlementEndDateChange(value: string): void;
  onSettlementStartDateChange(value: string): void;
  onSettlementUserIdChange(value: string): void;
  refreshResult?: EcpmRefreshResult;
  sampleJsCodes: string[];
  selectedGame?: DemoGame;
  selectedWithdrawalDetail?: AdminWithdrawalDetailResult;
  settlementBatches: AdminSettlementBatch[];
  settlementEndDate: string;
  settlementPreview?: AdminSettlementPreview;
  settlementStartDate: string;
  settlementUserId: string;
  session?: GameSessionResult;
}

function statusTone(status: string) {
  if (status === 'APPROVED' || status === 'COMPLETED') {
    return 'success';
  }

  if (status === 'FAILED' || status === 'REJECTED') {
    return 'danger';
  }

  return 'warning';
}

function tokenStatusTone(status?: KuaishouTokenStatusResult['status']) {
  if (status === 'ACTIVE') {
    return 'success';
  }

  if (status === 'ERROR') {
    return 'danger';
  }

  if (status === 'EXPIRED') {
    return 'warning';
  }

  return 'muted';
}

function formatTokenDate(value?: string | null) {
  if (!value) {
    return '-';
  }

  return value.replace('T', ' ').slice(0, 16);
}

export function OperationsWorkspace({
  adminCompanies,
  adminGames,
  adminName,
  adminWithdrawalStatus,
  adminWithdrawals,
  auditLogs,
  balanceAmountYuan,
  balanceCompanyId,
  balanceReason,
  budgetAmountYuan,
  budgetGameId,
  budgetReason,
  busyAction,
  gameAppId,
  games,
  jsCode,
  kuaishouAppId,
  kuaishouAuthCode,
  kuaishouSecret,
  kuaishouTokenStatus,
  newCompanyName,
  newGameAppId,
  newGameCompanyId,
  newGameName,
  newGameSecret,
  onAdjustCompanyBalance,
  onAllocateGameBudget,
  onApproveWithdrawal,
  onBalanceAmountChange,
  onBalanceCompanyIdChange,
  onBalanceReasonChange,
  onBudgetAmountChange,
  onBudgetGameIdChange,
  onBudgetReasonChange,
  onCloseWithdrawal,
  onConfirmSettlement,
  onCreateCompany,
  onCreateGame,
  onCreateSession,
  onGameChange,
  onJsCodeChange,
  onKuaishouAppIdChange,
  onKuaishouAuthCodeChange,
  onKuaishouAuthorize,
  onKuaishouRefreshToken,
  onKuaishouSecretChange,
  onLoadKuaishouTokenStatus,
  onLoadAdminResources,
  onLoadAuditLogs,
  onLoadWithdrawalDetail,
  onLoadWithdrawals,
  onNewCompanyNameChange,
  onNewGameAppIdChange,
  onNewGameCompanyIdChange,
  onNewGameNameChange,
  onNewGameSecretChange,
  onPayWithdrawal,
  onPreviewSettlement,
  onRefreshEcpm,
  onSettlementEndDateChange,
  onSettlementStartDateChange,
  onSettlementUserIdChange,
  refreshResult,
  sampleJsCodes,
  selectedGame,
  selectedWithdrawalDetail,
  settlementBatches,
  settlementEndDate,
  settlementPreview,
  settlementStartDate,
  settlementUserId,
  session,
}: OperationsWorkspaceProps) {
  const workspaceBusy = busyAction !== '';
  const canCreateCompany = newCompanyName.trim().length > 0;
  const canAdjustCompanyBalance =
    balanceCompanyId.trim().length > 0 && balanceAmountYuan.trim().length > 0;
  const canCreateGame =
    newGameCompanyId.trim().length > 0 &&
    newGameName.trim().length > 0 &&
    newGameAppId.trim().length > 0 &&
    newGameSecret.trim().length > 0;
  const canAllocateBudget =
    budgetGameId.trim().length > 0 && budgetAmountYuan.trim().length > 0;
  const canAuthorizeKuaishou =
    kuaishouAppId.trim().length > 0 &&
    kuaishouAuthCode.trim().length > 0 &&
    kuaishouSecret.trim().length > 0;
  const canRefreshKuaishouToken = Boolean(kuaishouTokenStatus?.configured);

  return (
    <div className="view-stack">
      <section className="metric-grid" aria-label="联调状态">
        <MetricCard
          detail={gameAppId || '-'}
          label="测试游戏"
          value={selectedGame?.name ?? '-'}
        />
        <MetricCard
          detail={session?.openId ?? '等待游戏登录'}
          label="最新可读 ID"
          value={session?.readableId ?? '-'}
        />
        <MetricCard
          detail={`${refreshResult?.requestedOpenIds.length ?? 0} 个 open_id`}
          label="最近写入"
          value={`${refreshResult?.savedCount ?? 0} 条`}
        />
      </section>

      <Panel
        actions={
          <Button
            disabled={workspaceBusy}
            icon={<RefreshCw size={16} />}
            onClick={onLoadAdminResources}
            variant="secondary"
          >
            {busyAction === 'admin-resources' ? '加载中' : '刷新预算'}
          </Button>
        }
        description="公司余额与游戏预算"
        title="预算管理"
      >
        <ReadoutGrid
          items={[
            { label: '公司数量', value: `${adminCompanies.length} 个` },
            { label: '游戏数量', value: `${adminGames.length} 个` },
          ]}
        />
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>公司</th>
                <th>余额</th>
              </tr>
            </thead>
            <tbody>
              {adminCompanies.map((company) => (
                <tr key={company.id}>
                  <td>{company.name}</td>
                  <td>{formatMoney(company.balance)}</td>
                </tr>
              ))}
              {adminCompanies.length === 0 ? (
                <tr>
                  <td colSpan={2}>暂无公司</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>游戏</th>
                <th>公司</th>
                <th>AppID</th>
                <th>预算</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {adminGames.map((game) => (
                <tr key={game.id}>
                  <td>{game.name}</td>
                  <td>{game.companyName}</td>
                  <td>{game.gameAppId}</td>
                  <td>{formatMoney(game.budget)}</td>
                  <td>
                    <StatusBadge tone={game.settlementPaused ? 'warning' : 'success'}>
                      {game.settlementPaused ? '已暂停' : '可结算'}
                    </StatusBadge>
                  </td>
                </tr>
              ))}
              {adminGames.length === 0 ? (
                <tr>
                  <td colSpan={5}>暂无游戏</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="query-form">
          <InputField
            disabled={workspaceBusy}
            label="公司名称"
            onChange={onNewCompanyNameChange}
            value={newCompanyName}
          />
          <Button
            disabled={workspaceBusy || !canCreateCompany}
            onClick={onCreateCompany}
            variant="secondary"
          >
            {busyAction === 'company-create' ? '创建中' : '创建公司'}
          </Button>
        </div>
        <div className="query-form">
          <label className="ui-input-field">
            <span className="ui-input-label">充值公司</span>
            <span className="ui-input-control">
              <select
                disabled={workspaceBusy}
                onChange={(event) =>
                  onBalanceCompanyIdChange(event.currentTarget.value)
                }
                value={balanceCompanyId}
              >
                <option value="">选择公司</option>
                {adminCompanies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </span>
          </label>
          <InputField
            disabled={workspaceBusy}
            label="充值金额"
            onChange={onBalanceAmountChange}
            placeholder="例如 100.00"
            value={balanceAmountYuan}
          />
          <InputField
            disabled={workspaceBusy}
            label="充值原因"
            onChange={onBalanceReasonChange}
            placeholder="可选"
            value={balanceReason}
          />
          <Button
            disabled={workspaceBusy || !canAdjustCompanyBalance}
            onClick={onAdjustCompanyBalance}
            variant="secondary"
          >
            {busyAction === 'company-balance' ? '提交中' : '充值公司余额'}
          </Button>
        </div>
        <div className="query-form">
          <label className="ui-input-field">
            <span className="ui-input-label">所属公司</span>
            <span className="ui-input-control">
              <select
                disabled={workspaceBusy}
                onChange={(event) =>
                  onNewGameCompanyIdChange(event.currentTarget.value)
                }
                value={newGameCompanyId}
              >
                <option value="">选择公司</option>
                {adminCompanies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </span>
          </label>
          <InputField
            disabled={workspaceBusy}
            label="游戏名称"
            onChange={onNewGameNameChange}
            value={newGameName}
          />
          <InputField
            disabled={workspaceBusy}
            label="game_app_id"
            onChange={onNewGameAppIdChange}
            value={newGameAppId}
          />
          <InputField
            disabled={workspaceBusy}
            label="game_secret"
            onChange={onNewGameSecretChange}
            value={newGameSecret}
          />
          <Button
            disabled={workspaceBusy || !canCreateGame}
            onClick={onCreateGame}
            variant="secondary"
          >
            {busyAction === 'game-create' ? '创建中' : '创建游戏'}
          </Button>
        </div>
        <div className="query-form">
          <label className="ui-input-field">
            <span className="ui-input-label">预算游戏</span>
            <span className="ui-input-control">
              <select
                disabled={workspaceBusy}
                onChange={(event) =>
                  onBudgetGameIdChange(event.currentTarget.value)
                }
                value={budgetGameId}
              >
                <option value="">选择游戏</option>
                {adminGames.map((game) => (
                  <option key={game.id} value={game.id}>
                    {game.name}
                  </option>
                ))}
              </select>
            </span>
          </label>
          <InputField
            disabled={workspaceBusy}
            label="分配金额"
            onChange={onBudgetAmountChange}
            placeholder="例如 50.00"
            value={budgetAmountYuan}
          />
          <InputField
            disabled={workspaceBusy}
            label="分配原因"
            onChange={onBudgetReasonChange}
            placeholder="可选"
            value={budgetReason}
          />
          <Button
            disabled={workspaceBusy || !canAllocateBudget}
            onClick={onAllocateGameBudget}
            variant="secondary"
          >
            {busyAction === 'game-budget' ? '提交中' : '分配游戏预算'}
          </Button>
        </div>
      </Panel>

      <Panel
        actions={
          <Button
            disabled={workspaceBusy}
            icon={<RefreshCw size={16} />}
            onClick={onLoadKuaishouTokenStatus}
            variant="secondary"
          >
            {busyAction === 'kuaishou-token' ? '加载中' : '刷新状态'}
          </Button>
        }
        description={kuaishouTokenStatus?.source ?? 'none'}
        title="平台授权"
      >
        <div className="button-row">
          <StatusBadge tone={tokenStatusTone(kuaishouTokenStatus?.status)}>
            {kuaishouTokenStatus?.status ?? 'UNCONFIGURED'}
          </StatusBadge>
          {kuaishouTokenStatus?.lastError ? (
            <StatusBadge tone="danger">{kuaishouTokenStatus.lastError}</StatusBadge>
          ) : null}
        </div>
        <ReadoutGrid
          items={[
            {
              label: '平台 AppID',
              value: kuaishouTokenStatus?.appId ?? '-',
            },
            {
              label: '广告主',
              value: kuaishouTokenStatus?.advertiserId ?? '-',
            },
            {
              label: '来源',
              value: kuaishouTokenStatus?.source ?? 'none',
            },
            {
              label: '授权时间',
              value: formatTokenDate(kuaishouTokenStatus?.authorizedAt),
            },
            {
              label: 'access 过期',
              value: formatTokenDate(kuaishouTokenStatus?.accessTokenExpiresAt),
            },
            {
              label: 'refresh 过期',
              value: formatTokenDate(kuaishouTokenStatus?.refreshTokenExpiresAt),
            },
          ]}
        />
        <div className="query-form">
          <InputField
            disabled={workspaceBusy}
            label="平台 app_id"
            onChange={onKuaishouAppIdChange}
            value={kuaishouAppId}
          />
          <InputField
            disabled={workspaceBusy}
            label="secret"
            onChange={onKuaishouSecretChange}
            type="password"
            value={kuaishouSecret}
          />
          <InputField
            disabled={workspaceBusy}
            label="auth_code"
            onChange={onKuaishouAuthCodeChange}
            value={kuaishouAuthCode}
          />
          <div className="button-row">
            <Button
              disabled={workspaceBusy || !canAuthorizeKuaishou}
              icon={<KeyRound size={16} />}
              onClick={onKuaishouAuthorize}
            >
              {busyAction === 'kuaishou-authorize' ? '提交中' : '提交授权'}
            </Button>
            <Button
              disabled={workspaceBusy || !canRefreshKuaishouToken}
              icon={<RefreshCw size={16} />}
              onClick={onKuaishouRefreshToken}
              variant="secondary"
            >
              {busyAction === 'kuaishou-refresh-token'
                ? '刷新中'
                : '刷新 token'}
            </Button>
          </div>
        </div>
      </Panel>

      <section className="tool-grid">
        <Panel description="code2Session" title="游戏端登录">
          <div className="query-form">
            <label className="ui-input-field">
              <span className="ui-input-label">游戏</span>
              <span className="ui-input-control">
                <select
                  disabled={workspaceBusy}
                  onChange={(event) => onGameChange(event.currentTarget.value)}
                  value={gameAppId}
                >
                  {games.map((game) => (
                    <option key={game.gameAppId} value={game.gameAppId}>
                      {game.name} / {game.gameAppId}
                    </option>
                  ))}
                </select>
              </span>
            </label>
            <InputField
              label="js_code"
              list="sample-js-codes"
              onChange={onJsCodeChange}
              value={jsCode}
            />
            <datalist id="sample-js-codes">
              {sampleJsCodes.map((code) => (
                <option key={code} value={code} />
              ))}
            </datalist>
            <Button
              disabled={!gameAppId || !jsCode || workspaceBusy}
              icon={<Send size={16} />}
              onClick={onCreateSession}
            >
              {busyAction === 'session' ? '获取中' : '换取 open_id'}
            </Button>
          </div>
        </Panel>

        <Panel
          description={adminName ? `管理员 ${adminName}` : '管理员未登录'}
          title="快手 ECPM"
        >
          <div className="query-form">
            <ReadoutGrid
              items={[
                { label: '游戏 AppID', value: gameAppId || '-' },
                { label: '刷新来源', value: refreshResult?.source ?? '等待刷新' },
              ]}
            />
            <Button
              disabled={!gameAppId || workspaceBusy}
              icon={<RefreshCw size={16} />}
              onClick={onRefreshEcpm}
            >
              {busyAction === 'refresh' ? '刷新中' : '刷新游戏 ECPM'}
            </Button>
          </div>
        </Panel>

        <Panel description={session?.game.name ?? '未获取'} title="最新 open_id">
          <ReadoutGrid
            items={[
              { label: '可读 ID', value: session?.readableId ?? '-' },
              { label: 'open_id', value: session?.openId ?? '-' },
              { label: '写入明细', value: `${refreshResult?.savedCount ?? 0} 条` },
            ]}
          />
        </Panel>
      </section>

      <EcpmTable
        emptyLabel="暂无刷新明细"
        meta={`${refreshResult?.requestedOpenIds.length ?? 0} 个 open_id`}
        rows={refreshResult?.rows ?? []}
        title="刷新明细"
      />

      <Panel description="按游戏和日期范围入账" title="结算确认">
        <div className="query-form">
          <InputField
            disabled={workspaceBusy}
            label="开始日期"
            onChange={onSettlementStartDateChange}
            type="date"
            value={settlementStartDate}
          />
          <InputField
            disabled={workspaceBusy}
            label="结束日期"
            onChange={onSettlementEndDateChange}
            type="date"
            value={settlementEndDate}
          />
          <InputField
            disabled={workspaceBusy}
            label="用户 ID"
            onChange={onSettlementUserIdChange}
            placeholder="可选"
            value={settlementUserId}
          />
          <div className="button-row">
            <Button
              disabled={!gameAppId || workspaceBusy}
              onClick={onPreviewSettlement}
              variant="secondary"
            >
              {busyAction === 'settlement-preview' ? '预览中' : '预览结算'}
            </Button>
            <Button
              disabled={
                !gameAppId ||
                workspaceBusy ||
                !settlementPreview?.canConfirm ||
                settlementPreview.settlementCount === 0
              }
              onClick={onConfirmSettlement}
            >
              {busyAction === 'settlement-confirm' ? '结算中' : '确认结算'}
            </Button>
          </div>
        </div>
        <ReadoutGrid
          items={[
            {
              label: '待结算金额',
              value: formatMoney(settlementPreview?.settlementAmount),
            },
            {
              label: '待结算记录',
              value: `${settlementPreview?.settlementCount ?? 0} 条`,
            },
            {
              label: '涉及用户',
              value: `${settlementPreview?.userCount ?? 0} 个`,
            },
            {
              label: '未绑定收益',
              value: `${settlementPreview?.unboundCount ?? 0} 条`,
            },
            {
              label: '当前预算',
              value: formatMoney(settlementPreview?.budgetBefore),
            },
            {
              label: '结算后预算',
              value: formatMoney(settlementPreview?.budgetAfter),
            },
          ]}
        />
        {settlementPreview && !settlementPreview.canConfirm ? (
          <StatusBadge tone="warning">预算不足或暂无可结算收益</StatusBadge>
        ) : null}
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>批次</th>
                <th>状态</th>
                <th>金额</th>
                <th>记录</th>
                <th>预算</th>
              </tr>
            </thead>
            <tbody>
              {settlementBatches.map((batch) => (
                <tr key={batch.id}>
                  <td>{batch.id}</td>
                  <td>{batch.status}</td>
                  <td>{formatMoney(batch.settledAmount)}</td>
                  <td>{batch.settledCount}</td>
                  <td>{formatMoney(batch.budgetAfter)}</td>
                </tr>
              ))}
              {settlementBatches.length === 0 ? (
                <tr>
                  <td colSpan={5}>暂无结算批次</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel
        actions={
          <div className="button-row">
            <Button
              disabled={workspaceBusy}
              onClick={() => onLoadWithdrawals('PENDING_REVIEW')}
              variant="secondary"
            >
              待审核
            </Button>
            <Button
              disabled={workspaceBusy}
              onClick={() => onLoadWithdrawals('APPROVED')}
              variant="secondary"
            >
              已审核
            </Button>
            <Button
              disabled={workspaceBusy}
              onClick={() => onLoadWithdrawals('FAILED')}
              variant="secondary"
            >
              失败
            </Button>
          </div>
        }
        description={adminWithdrawalStatus}
        title="提现审核"
      >
        <WithdrawalBatchTable
          busyAction={busyAction}
          onApprove={onApproveWithdrawal}
          onClose={onCloseWithdrawal}
          onDetail={onLoadWithdrawalDetail}
          onPay={onPayWithdrawal}
          rows={adminWithdrawals}
        />
      </Panel>

      {selectedWithdrawalDetail ? (
        <WithdrawalDetailPanel detail={selectedWithdrawalDetail} />
      ) : null}

      <Panel
        actions={
          <Button
            disabled={workspaceBusy}
            icon={<RefreshCw size={16} />}
            onClick={onLoadAuditLogs}
            variant="secondary"
          >
            {busyAction === 'audit-logs' ? '加载中' : '刷新日志'}
          </Button>
        }
        description="最近操作"
        title="审计日志"
      >
        <AuditLogTable rows={auditLogs} />
      </Panel>
    </div>
  );
}

function WithdrawalDetailPanel({
  detail,
}: {
  detail: AdminWithdrawalDetailResult;
}) {
  return (
    <Panel
      actions={
        <StatusBadge tone={statusTone(detail.batch.status)}>
          {detail.batch.status}
        </StatusBadge>
      }
      description={detail.batch.id}
      title="提现详情"
    >
      <ReadoutGrid
        items={[
          { label: '用户', value: detail.batch.userId },
          { label: '金额', value: formatMoney(detail.batch.totalAmount) },
          { label: '审计', value: `${detail.auditLogs.length} 条` },
        ]}
      />
      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>明细</th>
              <th>状态</th>
              <th>收款人</th>
              <th>错误</th>
              <th>响应</th>
            </tr>
          </thead>
          <tbody>
            {detail.batch.details.map((row) => (
              <tr key={row.type}>
                <td>{row.type}</td>
                <td>{row.status}</td>
                <td>{row.recipientName}</td>
                <td>{row.errorCode ?? '-'}</td>
                <td>{formatAuditMetadata(row.alipayResponseSnapshot)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
