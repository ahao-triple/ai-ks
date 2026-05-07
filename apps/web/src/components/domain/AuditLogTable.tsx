import type { AuditLogRow } from '../../types/api';
import { formatAuditMetadata, formatDateTime } from '../../lib/format';
import { DataTable } from '../ui';
import type { DataTableColumn } from '../ui';

export interface AuditLogTableProps {
  rows: AuditLogRow[];
}

const columns: Array<DataTableColumn<AuditLogRow>> = [
  {
    key: 'createdAt',
    label: '时间',
    render: (row) => formatDateTime(row.createdAt),
  },
  {
    key: 'action',
    label: '动作',
  },
  {
    key: 'actor',
    label: '操作者',
    render: (row) => `${row.actorType}/${row.actorId}`,
  },
  {
    key: 'target',
    label: '目标',
    render: (row) => `${row.targetType}/${row.targetId}`,
  },
  {
    key: 'metadata',
    label: '摘要',
    render: (row) => formatAuditMetadata(row.metadata),
  },
];

export function AuditLogTable({ rows }: AuditLogTableProps) {
  return (
    <DataTable
      columns={columns}
      emptyLabel="暂无审计日志"
      getRowKey={(row) => row.id}
      rows={rows}
    />
  );
}
