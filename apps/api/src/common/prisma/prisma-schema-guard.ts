import { Prisma } from '@prisma/client';

export type RequiredPrismaSchemaColumn = {
  columnName: string;
  tableName: string;
};

export const REQUIRED_PRISMA_SCHEMA_COLUMNS: RequiredPrismaSchemaColumn[] = [
  { tableName: 'games', columnName: 'ecpm_auto_sync_enabled' },
  { tableName: 'games', columnName: 'ecpm_auto_sync_interval_hours' },
  { tableName: 'games', columnName: 'ecpm_auto_sync_next_run_at' },
  { tableName: 'games', columnName: 'ecpm_auto_sync_last_run_at' },
  { tableName: 'kuaishou_ecpm_sync_jobs', columnName: 'lookback_hours' },
  { tableName: 'kuaishou_ecpm_sync_jobs', columnName: 'started_data_hour' },
  { tableName: 'kuaishou_ecpm_sync_jobs', columnName: 'ended_data_hour' },
  { tableName: 'company_admin_accounts', columnName: 'username' },
  { tableName: 'company_admin_accounts', columnName: 'password_hash' },
  { tableName: 'company_admin_accounts', columnName: 'display_name' },
  { tableName: 'company_admin_accounts', columnName: 'enabled' },
  { tableName: 'company_admin_scopes', columnName: 'principal_id' },
  { tableName: 'company_admin_scopes', columnName: 'game_ids' },
  { tableName: 'company_admin_scopes', columnName: 'operation_codes' },
  { tableName: 'platform_configs', columnName: 'display_ratio_percent' },
  {
    tableName: 'platform_configs',
    columnName: 'user_settlement_ratio_percent',
  },
  { tableName: 'platform_configs', columnName: 'direct_agent_ratio_percent' },
  { tableName: 'platform_configs', columnName: 'parent_agent_ratio_percent' },
  { tableName: 'platform_configs', columnName: 'default_agent_ratio_percent' },
  { tableName: 'platform_configs', columnName: 'default_agent_id' },
  { tableName: 'platform_configs', columnName: 'fee_ratio_percent' },
  { tableName: 'platform_configs', columnName: 'min_withdrawal_li' },
  { tableName: 'agents', columnName: 'available_balance_li' },
  { tableName: 'agents', columnName: 'frozen_balance_li' },
  { tableName: 'settlement_batch_items', columnName: 'user_amount_li' },
  { tableName: 'settlement_batch_items', columnName: 'direct_agent_id' },
  { tableName: 'settlement_batch_items', columnName: 'direct_agent_amount_li' },
  { tableName: 'settlement_batch_items', columnName: 'parent_agent_id' },
  { tableName: 'settlement_batch_items', columnName: 'parent_agent_amount_li' },
  { tableName: 'settlement_batch_items', columnName: 'default_agent_id' },
  { tableName: 'settlement_batch_items', columnName: 'default_agent_amount_li' },
  { tableName: 'settlement_batch_items', columnName: 'fee_amount_li' },
  { tableName: 'settlement_batch_items', columnName: 'split_snapshot' },
  { tableName: 'withdrawal_batches', columnName: 'owner_type' },
  { tableName: 'withdrawal_batches', columnName: 'owner_id' },
];

type SchemaColumnRow = {
  columnName: string;
  tableName: string;
};

export type PrismaSchemaGuardPrisma = {
  $queryRaw<T = unknown>(
    query: TemplateStringsArray | Prisma.Sql,
    ...values: unknown[]
  ): Promise<T>;
};

export class PrismaSchemaMismatchError extends Error {
  constructor(missingColumns: RequiredPrismaSchemaColumn[]) {
    super(formatSchemaMismatchMessage(missingColumns));
    this.name = 'PrismaSchemaMismatchError';
  }
}

export class PrismaSchemaGuard {
  constructor(private readonly prisma: PrismaSchemaGuardPrisma) {}

  async assertSchemaReady(): Promise<void> {
    const tableNames = Array.from(
      new Set(REQUIRED_PRISMA_SCHEMA_COLUMNS.map((column) => column.tableName)),
    );
    const rows = await this.prisma.$queryRaw<SchemaColumnRow[]>`
      SELECT table_name AS "tableName", column_name AS "columnName"
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name IN (${Prisma.join(tableNames)})
    `;
    const existingColumns = new Set(
      rows.map((row) => `${row.tableName}.${row.columnName}`),
    );
    const missingColumns = REQUIRED_PRISMA_SCHEMA_COLUMNS.filter(
      (column) =>
        !existingColumns.has(`${column.tableName}.${column.columnName}`),
    );

    if (missingColumns.length > 0) {
      throw new PrismaSchemaMismatchError(missingColumns);
    }
  }
}

function formatSchemaMismatchMessage(
  missingColumns: RequiredPrismaSchemaColumn[],
) {
  const missingList = missingColumns
    .map((column) => `- ${column.tableName}.${column.columnName}`)
    .join('\n');

  return [
    'Database schema is out of sync with Prisma schema.',
    '',
    'Missing required database columns:',
    missingList,
    '',
    'The API will not modify the database automatically.',
    'Confirm the root .env DATABASE_URL points to the intended database, then run:',
    'pnpm --filter api prisma:push',
  ].join('\n');
}
