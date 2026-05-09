import type { AdminWithdrawalBatch } from '../../types/api';
import { formatMoney } from '../../lib/format';
import { Button, DataTable, StatusBadge } from '../ui';
import type { DataTableColumn, StatusBadgeTone } from '../ui';

export interface WithdrawalBatchTableProps {
  busyAction: string;
  onApprove(batchId: string): void;
  onClose(batchId: string): void;
  onDetail(batchId: string): void;
  onPay(batchId: string, result: 'failed' | 'success'): void;
  rows: AdminWithdrawalBatch[];
}

function statusTone(status: string): StatusBadgeTone {
  if (status === 'APPROVED' || status === 'COMPLETED') {
    return 'success';
  }

  if (status === 'FAILED' || status === 'REJECTED') {
    return 'danger';
  }

  return 'warning';
}

function renderActions(
  row: AdminWithdrawalBatch,
  props: WithdrawalBatchTableProps,
) {
  const { busyAction, onApprove, onClose, onDetail, onPay } = props;
  const isActionBusy = busyAction !== '';

  return (
    <span className="inline-actions">
      <Button
        compact
        disabled={busyAction === `detail-${row.id}`}
        onClick={() => onDetail(row.id)}
        variant="secondary"
      >
        详情
      </Button>
      {row.status === 'APPROVED' ? (
        <>
          <Button
            compact
            disabled={isActionBusy}
            onClick={() => onPay(row.id, 'success')}
            variant="secondary"
          >
            {busyAction === `pay-success-${row.id}` ? '打款中' : '打款'}
          </Button>
          <Button
            compact
            disabled={isActionBusy}
            onClick={() => onPay(row.id, 'failed')}
            variant="secondary"
          >
            {busyAction === `pay-failed-${row.id}` ? '提交中' : '失败'}
          </Button>
        </>
      ) : row.status === 'FAILED' ? (
        <Button
          compact
          disabled={isActionBusy}
          onClick={() => onClose(row.id)}
          variant="secondary"
        >
          {busyAction === `close-${row.id}` ? '关闭中' : '关闭'}
        </Button>
      ) : row.status === 'PENDING_REVIEW' ? (
        <Button
          compact
          disabled={isActionBusy}
          onClick={() => onApprove(row.id)}
          variant="secondary"
        >
          {busyAction === `approve-${row.id}` ? '审核中' : '通过'}
        </Button>
      ) : null}
    </span>
  );
}

export function WithdrawalBatchTable(props: WithdrawalBatchTableProps) {
  const columns: Array<DataTableColumn<AdminWithdrawalBatch>> = [
    {
      key: 'id',
      label: '批次',
    },
    {
      key: 'owner',
      label: '归属',
      render: (row) =>
        row.ownerType === 'AGENT'
          ? `代理 ${row.ownerId ?? '-'}`
          : `用户 ${row.userId ?? row.ownerId ?? '-'}`,
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
        <StatusBadge tone={statusTone(row.status)}>{row.status}</StatusBadge>
      ),
    },
    {
      key: 'actions',
      label: '操作',
      render: (row) => renderActions(row, props),
    },
  ];

  return (
    <DataTable
      columns={columns}
      emptyLabel="暂无提现批次"
      getRowKey={(row) => row.id}
      rows={props.rows}
    />
  );
}
