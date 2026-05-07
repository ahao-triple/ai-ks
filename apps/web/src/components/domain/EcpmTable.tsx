import type { EcpmRow } from '../../types/api';
import { formatMoney } from '../../lib/format';
import { DataTable, Panel } from '../ui';
import type { DataTableColumn } from '../ui';

export interface EcpmTableProps {
  emptyLabel: string;
  meta: string;
  rows: EcpmRow[];
  title: string;
}

const columns: Array<DataTableColumn<EcpmRow>> = [
  {
    key: 'platformEventId',
    label: '事件',
  },
  {
    key: 'gameAppId',
    label: '游戏',
  },
  {
    key: 'openId',
    label: 'open_id',
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
];

export function EcpmTable({ emptyLabel, meta, rows, title }: EcpmTableProps) {
  return (
    <Panel
      actions={<span className="table-count">{rows.length} 条</span>}
      description={meta}
      title={title}
    >
      <DataTable
        columns={columns}
        emptyLabel={emptyLabel}
        getRowKey={(row) => row.platformEventId}
        rows={rows}
      />
    </Panel>
  );
}
