import { RefreshCw, Send, WalletCards } from 'lucide-react';
import { ReadoutGrid } from '../components/domain';
import {
  Button,
  DataTable,
  InputField,
  MetricCard,
  Panel,
  StatusBadge,
} from '../components/ui';
import type { DataTableColumn, StatusBadgeTone } from '../components/ui';
import { formatMoney } from '../lib/format';
import type {
  AdminWithdrawalBatch,
  AgentEarningRow,
  AgentEarningsResult,
  AgentPrincipal,
  AgentProfile,
  AgentUserRow,
  AgentUsersResult,
} from '../types/api';

export type AgentWorkspaceBusyAction =
  | ''
  | 'agent-alipay-own'
  | 'agent-earnings'
  | 'agent-users'
  | 'agent-withdrawal-own'
  | 'agent-withdrawals';

export interface AgentWorkspaceProps {
  agent?: AgentPrincipal;
  alipayAccount: string;
  alipayRealName: string;
  busyAction: AgentWorkspaceBusyAction;
  earnings?: AgentEarningsResult;
  onAlipayAccountChange(value: string): void;
  onAlipayRealNameChange(value: string): void;
  onLoadEarnings(): void;
  onLoadUsers(): void;
  onLoadWithdrawals(): void;
  onRequestWithdrawal(): void;
  onUpdateAlipayProfile(): void;
  onWithdrawalAmountChange(value: string): void;
  profile?: AgentProfile;
  users?: AgentUsersResult;
  withdrawalAmountYuan: string;
  withdrawals?: AdminWithdrawalBatch[];
}

const earningRoleLabels: Record<AgentEarningRow['role'], string> = {
  DEFAULT_AGENT: '默认代理',
  DIRECT_AGENT: '直属代理',
  PARENT_AGENT: '上级代理',
};

export function AgentWorkspace({
  agent,
  alipayAccount,
  alipayRealName,
  busyAction,
  earnings,
  onAlipayAccountChange,
  onAlipayRealNameChange,
  onLoadEarnings,
  onLoadUsers,
  onLoadWithdrawals,
  onRequestWithdrawal,
  onUpdateAlipayProfile,
  onWithdrawalAmountChange,
  profile,
  users,
  withdrawalAmountYuan,
  withdrawals = [],
}: AgentWorkspaceProps) {
  const workspaceBusy = busyAction !== '';

  return (
    <div className="view-stack">
      <section className="metric-grid metric-grid-four" aria-label="代理收益概览">
        <MetricCard
          detail={agent?.id ?? '未登录'}
          label="代理账号"
          value={agent?.username ?? '-'}
        />
        <MetricCard
          detail={agent?.invitationCode ?? '邀请码'}
          label="邀请码"
          value={agent?.invitationCode ?? '-'}
        />
        <MetricCard
          detail="可提交提现"
          label="可提现余额"
          value={formatMoney(profile?.availableBalance)}
        />
        <MetricCard
          detail="已提交待审核或打款"
          label="冻结余额"
          value={formatMoney(profile?.frozenBalance)}
        />
      </section>

      <section className="split-grid">
        <Panel
          description={alipayAccount ? '已维护收款信息' : '提现前必须维护'}
          title="代理支付宝资料"
        >
          <div className="query-form">
            <InputField
              label="支付宝账号"
              onChange={onAlipayAccountChange}
              placeholder="邮箱或手机号"
              value={alipayAccount}
            />
            <InputField
              label="真实姓名"
              onChange={onAlipayRealNameChange}
              placeholder="收款人实名"
              value={alipayRealName}
            />
            <Button
              disabled={
                !agent ||
                !alipayAccount.trim() ||
                !alipayRealName.trim() ||
                workspaceBusy
              }
              icon={<WalletCards size={16} />}
              onClick={onUpdateAlipayProfile}
            >
              {busyAction === 'agent-alipay-own' ? '保存中' : '保存支付宝'}
            </Button>
          </div>
        </Panel>

        <Panel
          description="代理可提现余额会转入冻结，等待超级管理员审核"
          title="代理提现申请"
        >
          <div className="query-form">
            <InputField
              inputMode="decimal"
              label="提现金额"
              onChange={onWithdrawalAmountChange}
              placeholder="例如 10.00"
              value={withdrawalAmountYuan}
            />
            <div className="button-row">
              <Button
                disabled={!agent || !withdrawalAmountYuan.trim() || workspaceBusy}
                icon={<Send size={16} />}
                onClick={onRequestWithdrawal}
              >
                {busyAction === 'agent-withdrawal-own' ? '提交中' : '提交提现'}
              </Button>
              <Button
                disabled={!agent || workspaceBusy}
                icon={<RefreshCw size={16} />}
                onClick={onLoadWithdrawals}
                variant="secondary"
              >
                {busyAction === 'agent-withdrawals' ? '刷新中' : '刷新批次'}
              </Button>
            </div>
            <ReadoutGrid
              items={[
                {
                  label: '累计代理收益',
                  value: formatMoney(earnings?.totalAmount),
                },
                {
                  label: '提现批次数',
                  value: `${withdrawals.length}`,
                },
                {
                  label: '最近批次',
                  value: withdrawals[0]?.id ?? '-',
                },
              ]}
            />
          </div>
        </Panel>
      </section>

      <Panel
        description="来自已确认结算批次的直属、上级、默认代理分账"
        title="代理结算明细"
      >
        <div className="table-toolbar">
          <Button
            compact
            disabled={!agent || workspaceBusy}
            icon={<RefreshCw size={16} />}
            onClick={onLoadEarnings}
            variant="secondary"
          >
            {busyAction === 'agent-earnings' ? '查询中' : '刷新收益'}
          </Button>
        </div>
        <AgentEarningsTable rows={earnings?.rows ?? []} />
      </Panel>

      <Panel
        description="代理本人提交的提现批次，不展示其他代理或用户数据"
        title="代理提现批次"
      >
        <AgentWithdrawalTable rows={withdrawals} />
      </Panel>

      <Panel
        description="包含直属用户，以及下级代理名下用户，用于真实数据结算前核对归属"
        title="代理名下用户"
      >
        <div className="table-toolbar">
          <Button
            compact
            disabled={!agent || workspaceBusy}
            icon={<RefreshCw size={16} />}
            onClick={onLoadUsers}
            variant="secondary"
          >
            {busyAction === 'agent-users' ? '刷新中' : '刷新用户'}
          </Button>
          <span className="table-count">{users?.totalCount ?? 0} 个用户</span>
        </div>
        <AgentUsersTable rows={users?.rows ?? []} />
      </Panel>
    </div>
  );
}

function AgentEarningsTable({ rows }: { rows: AgentEarningRow[] }) {
  const columns: Array<DataTableColumn<AgentEarningRow>> = [
    {
      key: 'createdAt',
      label: '时间',
      render: (row) => new Date(row.createdAt).toLocaleString(),
    },
    {
      key: 'role',
      label: '角色',
      render: (row) => earningRoleLabels[row.role],
    },
    {
      key: 'openId',
      label: 'open_id',
    },
    {
      align: 'right',
      key: 'settlementAmount',
      label: '结算额',
      render: (row) => formatMoney(row.settlementAmount),
    },
    {
      align: 'right',
      key: 'amount',
      label: '代理入账',
      render: (row) => formatMoney(row.amount),
    },
    {
      key: 'batchId',
      label: '批次',
    },
  ];

  return (
    <DataTable
      columns={columns}
      emptyLabel="暂无代理收益明细"
      getRowKey={(row) => row.id}
      rows={rows}
    />
  );
}

function AgentWithdrawalTable({ rows }: { rows: AdminWithdrawalBatch[] }) {
  const columns: Array<DataTableColumn<AdminWithdrawalBatch>> = [
    {
      key: 'createdAt',
      label: '时间',
      render: (row) => new Date(row.createdAt).toLocaleString(),
    },
    {
      align: 'right',
      key: 'totalAmount',
      label: '金额',
      render: (row) => formatMoney(row.totalAmount),
    },
    {
      key: 'recipient',
      label: '收款人',
      render: (row) => row.details[0]?.recipientName ?? '-',
    },
    {
      key: 'status',
      label: '状态',
      render: (row) => (
        <StatusBadge tone={withdrawalStatusTone(row.status)}>
          {row.status}
        </StatusBadge>
      ),
    },
    {
      key: 'id',
      label: '批次',
    },
  ];

  return (
    <DataTable
      columns={columns}
      emptyLabel="暂无代理提现批次"
      getRowKey={(row) => row.id}
      rows={rows}
    />
  );
}

function AgentUsersTable({ rows }: { rows: AgentUserRow[] }) {
  const columns: Array<DataTableColumn<AgentUserRow>> = [
    {
      key: 'username',
      label: '用户',
    },
    {
      key: 'readableId',
      label: '可读 ID',
    },
    {
      key: 'relation',
      label: '关系',
      render: (row) =>
        row.relation === 'DIRECT' ? '直属用户' : '下级代理用户',
    },
    {
      key: 'currentAgentUsername',
      label: '当前代理',
    },
    {
      key: 'currentAgentInvitationCode',
      label: '邀请码',
    },
  ];

  return (
    <DataTable
      columns={columns}
      emptyLabel="暂无代理名下用户"
      getRowKey={(row) => row.id}
      rows={rows}
    />
  );
}

function withdrawalStatusTone(status: string): StatusBadgeTone {
  if (status === 'PAID' || status === 'COMPLETED') {
    return 'success';
  }

  if (status === 'FAILED' || status === 'CLOSED') {
    return 'danger';
  }

  return 'warning';
}
