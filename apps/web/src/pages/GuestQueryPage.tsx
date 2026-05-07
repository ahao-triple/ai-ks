import { Search } from 'lucide-react';
import { EcpmTable, ReadoutGrid } from '../components/domain';
import { Button, InputField, MetricCard, Panel } from '../components/ui';
import { formatMoney } from '../lib/format';
import type { DemoGame, EarningsResult } from '../types/api';

export interface GuestQueryPageProps {
  busy: boolean;
  earnings?: EarningsResult;
  identity: string;
  onIdentityChange(value: string): void;
  onQuery(): void;
  selectedGame?: DemoGame;
}

export function GuestQueryPage({
  busy,
  earnings,
  identity,
  onIdentityChange,
  onQuery,
  selectedGame,
}: GuestQueryPageProps) {
  return (
    <div className="view-stack">
      <section className="metric-grid" aria-label="收益概览">
        <MetricCard
          detail={earnings ? `${earnings.rows.length} 条 ECPM 明细` : '默认当天'}
          label="展示金额"
          value={formatMoney(earnings?.totalDisplayAmount)}
        />
        <MetricCard
          detail={earnings?.readableId ?? '等待查询'}
          label="可读 ID"
          value={earnings?.readableId ?? '-'}
        />
        <MetricCard
          detail={selectedGame?.gameAppId ?? '-'}
          label="当前游戏"
          value={selectedGame?.name ?? '-'}
        />
      </section>

      <section className="split-grid">
        <Panel description="当天 00:00 - 24:00" title="单个 ID 查询">
          <div className="query-form">
            <InputField
              label="open_id / 可读 ID"
              onChange={onIdentityChange}
              placeholder="输入 open_id 或 7 位可读 ID"
              value={identity}
            />
            <Button
              disabled={!identity.trim() || busy}
              icon={<Search size={16} />}
              onClick={onQuery}
            >
              {busy ? '查询中' : '查询收益'}
            </Button>
          </div>
        </Panel>

        <Panel description={earnings?.date ?? '今日'} title="查询结果">
          <ReadoutGrid
            items={[
              { label: 'open_id', value: earnings?.openId ?? '-' },
              {
                label: '原始金额',
                value: formatMoney(earnings?.totalRawCost),
              },
              {
                label: '展示金额',
                value: formatMoney(earnings?.totalDisplayAmount),
              },
            ]}
          />
        </Panel>
      </section>

      <EcpmTable
        emptyLabel="暂无收益明细"
        meta={earnings?.date ?? '今日'}
        rows={earnings?.rows ?? []}
        title="收益明细"
      />
    </div>
  );
}
