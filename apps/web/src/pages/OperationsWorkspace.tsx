import { RefreshCw, Send } from 'lucide-react';
import {
  AuditLogTable,
  EcpmTable,
  ReadoutGrid,
  WithdrawalBatchTable,
} from '../components/domain';
import { Button, InputField, MetricCard, Panel, StatusBadge } from '../components/ui';
import { formatAuditMetadata, formatMoney } from '../lib/format';
import type {
  AdminWithdrawalBatch,
  AdminWithdrawalDetailResult,
  AuditLogRow,
  AdminSettlementBatch,
  AdminSettlementPreview,
  DemoGame,
  EcpmRefreshResult,
  GameSessionResult,
} from '../types/api';

export type OperationsWorkspaceBusyAction =
  | ''
  | 'admin-withdrawals'
  | 'audit-logs'
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
  adminName: string;
  adminWithdrawalStatus: string;
  adminWithdrawals: AdminWithdrawalBatch[];
  auditLogs: AuditLogRow[];
  busyAction: OperationsWorkspaceBusyAction;
  gameAppId: string;
  games: DemoGame[];
  jsCode: string;
  onApproveWithdrawal(batchId: string): void;
  onCloseWithdrawal(batchId: string): void;
  onConfirmSettlement(): void;
  onCreateSession(): void;
  onGameChange(value: string): void;
  onJsCodeChange(value: string): void;
  onLoadAuditLogs(): void;
  onLoadWithdrawalDetail(batchId: string): void;
  onLoadWithdrawals(status?: string): void;
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

export function OperationsWorkspace({
  adminName,
  adminWithdrawalStatus,
  adminWithdrawals,
  auditLogs,
  busyAction,
  gameAppId,
  games,
  jsCode,
  onApproveWithdrawal,
  onCloseWithdrawal,
  onConfirmSettlement,
  onCreateSession,
  onGameChange,
  onJsCodeChange,
  onLoadAuditLogs,
  onLoadWithdrawalDetail,
  onLoadWithdrawals,
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
