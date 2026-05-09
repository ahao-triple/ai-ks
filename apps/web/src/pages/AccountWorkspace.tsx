import { Link2, Send, WalletCards } from 'lucide-react';
import { EcpmTable, ReadoutGrid } from '../components/domain';
import { Button, InputField, MetricCard, Panel } from '../components/ui';
import { formatMoney } from '../lib/format';
import type {
  AccountEarningsResult,
  AccountAgentBindingResult,
  AccountResult,
  WithdrawalResult,
} from '../types/api';

export type AccountWorkspaceBusyAction =
  | ''
  | 'account-query'
  | 'agent-binding'
  | 'alipay'
  | 'bind'
  | 'withdrawal';

export interface AccountWorkspaceProps {
  account?: AccountResult;
  accountEarnings?: AccountEarningsResult;
  agentBinding?: AccountAgentBindingResult;
  agentInvitationCode: string;
  alipayAccount: string;
  alipayRealName: string;
  bindIdentity: string;
  busyAction: AccountWorkspaceBusyAction;
  onAgentInvitationCodeChange(value: string): void;
  onAlipayAccountChange(value: string): void;
  onBindAgent(): void;
  onAlipayRealNameChange(value: string): void;
  onBindIdentityChange(value: string): void;
  onBindOpenId(): void;
  onQueryAccountEarnings(): void;
  onRequestWithdrawal(): void;
  onUpdateAlipayProfile(): void;
  onWithdrawalAmountChange(value: string): void;
  withdrawal?: WithdrawalResult;
  withdrawalAmountYuan: string;
}

export function AccountWorkspace({
  account,
  accountEarnings,
  agentBinding,
  agentInvitationCode,
  alipayAccount,
  alipayRealName,
  bindIdentity,
  busyAction,
  onAgentInvitationCodeChange,
  onAlipayAccountChange,
  onAlipayRealNameChange,
  onBindAgent,
  onBindIdentityChange,
  onBindOpenId,
  onQueryAccountEarnings,
  onRequestWithdrawal,
  onUpdateAlipayProfile,
  onWithdrawalAmountChange,
  withdrawal,
  withdrawalAmountYuan,
}: AccountWorkspaceProps) {
  const workspaceBusy = busyAction !== '';

  return (
    <div className="view-stack">
      <section className="metric-grid metric-grid-four" aria-label="账号概览">
        <MetricCard
          detail={account?.readableId ?? '未登录'}
          label="当前账号"
          value={account?.username ?? '-'}
        />
        <MetricCard
          detail="已绑定游戏 ID"
          label="绑定数量"
          value={`${accountEarnings?.openIds.length ?? 0}`}
        />
        <MetricCard
          detail={accountEarnings?.date ?? '默认当天'}
          label="账号展示金额"
          value={formatMoney(accountEarnings?.totalDisplayAmount)}
        />
        <MetricCard
          detail="等待管理员确认结算"
          label="最近结算"
          value="-"
        />
      </section>

      <section className="split-grid">
        <Panel
          description={account?.readableId ?? '请先登录账号'}
          title="ID 绑定"
        >
          <div className="query-form">
            <InputField
              label="open_id / 可读 ID"
              onChange={onBindIdentityChange}
              placeholder="输入要绑定的游戏 ID"
              value={bindIdentity}
            />
            <div className="button-row">
              <Button
                disabled={!account || !bindIdentity.trim() || workspaceBusy}
                icon={<Link2 size={16} />}
                onClick={onBindOpenId}
              >
                {busyAction === 'bind' ? '绑定中' : '绑定 ID'}
              </Button>
              <Button
                disabled={!account || workspaceBusy}
                icon={<WalletCards size={16} />}
                onClick={onQueryAccountEarnings}
                variant="secondary"
              >
                {busyAction === 'account-query' ? '查询中' : '账号收益'}
              </Button>
            </div>
          </div>
        </Panel>

        <Panel
          description={
            agentBinding?.agent
              ? `当前代理：${agentBinding.agent.username}`
              : '注册后可用代理邀请码绑定'
          }
          title="代理归属"
        >
          <div className="query-form">
            <InputField
              label="代理邀请码"
              onChange={onAgentInvitationCodeChange}
              placeholder="输入代理邀请码"
              value={agentInvitationCode}
            />
            <Button
              disabled={!account || !agentInvitationCode.trim() || workspaceBusy}
              icon={<Link2 size={16} />}
              onClick={onBindAgent}
            >
              {busyAction === 'agent-binding' ? '绑定中' : '绑定代理'}
            </Button>
            <ReadoutGrid
              items={[
                {
                  label: '当前代理',
                  value: agentBinding?.agent?.username ?? '-',
                },
                {
                  label: '邀请码',
                  value: agentBinding?.agent?.invitationCode ?? '-',
                },
                {
                  label: '代理 ID',
                  value: agentBinding?.agent?.id ?? '-',
                },
              ]}
            />
          </div>
        </Panel>

        <Panel
          description={alipayAccount ? '已维护收款信息' : '提现前必须维护'}
          title="支付宝资料"
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
                !account ||
                !alipayAccount.trim() ||
                !alipayRealName.trim() ||
                workspaceBusy
              }
              icon={<WalletCards size={16} />}
              onClick={onUpdateAlipayProfile}
            >
              {busyAction === 'alipay' ? '保存中' : '保存支付宝'}
            </Button>
          </div>
        </Panel>
      </section>

      <section className="split-grid">
        <Panel description={withdrawal?.status ?? '生成待审核批次'} title="提现申请">
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
                disabled={
                  !account ||
                  !withdrawalAmountYuan.trim() ||
                  workspaceBusy
                }
                icon={<Send size={16} />}
                onClick={onRequestWithdrawal}
              >
                {busyAction === 'withdrawal' ? '提交中' : '提交提现'}
              </Button>
            </div>
            <ReadoutGrid
              items={[
                {
                  label: '最近入账',
                  value: '-',
                },
                { label: '最近批次', value: withdrawal?.id ?? '-' },
                {
                  label: '冻结金额',
                  value: formatMoney(withdrawal?.totalAmount),
                },
              ]}
            />
          </div>
        </Panel>
      </section>

      <EcpmTable
        emptyLabel="暂无账号收益明细"
        meta={`${accountEarnings?.openIds.length ?? 0} 个 open_id`}
        rows={accountEarnings?.rows ?? []}
        title="账号收益明细"
      />
    </div>
  );
}
