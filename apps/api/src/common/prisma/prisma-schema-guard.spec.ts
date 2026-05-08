import {
  PrismaSchemaGuard,
  PrismaSchemaGuardPrisma,
  REQUIRED_PRISMA_SCHEMA_COLUMNS,
} from './prisma-schema-guard';

type FakePrisma = PrismaSchemaGuardPrisma & {
  $queryRaw: PrismaSchemaGuardPrisma['$queryRaw'] & jest.Mock;
};

function createPrisma(rows: unknown[]): FakePrisma {
  return {
    $queryRaw: jest.fn().mockResolvedValue(rows),
  } as FakePrisma;
}

function rowsFor(
  columns: { tableName: string; columnName: string }[],
): { tableName: string; columnName: string }[] {
  return columns.map((column) => ({
    tableName: column.tableName,
    columnName: column.columnName,
  }));
}

describe('PrismaSchemaGuard', () => {
  it('passes when the schema contains all required columns', async () => {
    const prisma = createPrisma(rowsFor(REQUIRED_PRISMA_SCHEMA_COLUMNS));
    const guard = new PrismaSchemaGuard(prisma);

    await expect(guard.assertSchemaReady()).resolves.toBeUndefined();

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('throws a clear error when one required column is missing', async () => {
    const prisma = createPrisma(
      rowsFor(
        REQUIRED_PRISMA_SCHEMA_COLUMNS.filter(
          (column) =>
            column.tableName !== 'games' ||
            column.columnName !== 'ecpm_auto_sync_enabled',
        ),
      ),
    );
    const guard = new PrismaSchemaGuard(prisma);

    await expect(guard.assertSchemaReady()).rejects.toThrow(
      /Database schema is out of sync with Prisma schema[\s\S]*games\.ecpm_auto_sync_enabled[\s\S]*pnpm --filter api prisma:push/,
    );
  });

  it('lists all missing required columns in one error', async () => {
    const prisma = createPrisma(
      rowsFor(
        REQUIRED_PRISMA_SCHEMA_COLUMNS.filter(
          (column) =>
            !(
              column.tableName === 'games' &&
              column.columnName === 'ecpm_auto_sync_enabled'
            ) &&
            !(
              column.tableName === 'kuaishou_ecpm_sync_jobs' &&
              column.columnName === 'lookback_hours'
            ),
        ),
      ),
    );
    const guard = new PrismaSchemaGuard(prisma);

    await expect(guard.assertSchemaReady()).rejects.toThrow(
      /games\.ecpm_auto_sync_enabled[\s\S]*kuaishou_ecpm_sync_jobs\.lookback_hours/,
    );
  });
});
