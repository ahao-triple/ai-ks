# API Schema Boot Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fail API startup with a clear repair message when the `.env` database schema is missing columns required by the current Prisma schema.

**Architecture:** Add a focused Prisma schema guard under `apps/api/src/common/prisma/` that checks a small required-column list through PostgreSQL `information_schema`. Wire the guard into `PrismaService.onModuleInit()` behind a default-on environment switch, without running migrations or mutating the database. Update the runbook so operators know to verify `.env` and run `pnpm --filter api prisma:push` when the guard fails.

**Tech Stack:** NestJS 11, Prisma 6, PostgreSQL `information_schema`, Jest, TypeScript, repository-root `.env` loaded through `scripts/with-root-env.mjs`.

---

## File Structure

- Create `apps/api/src/common/prisma/prisma-schema-check-on-boot.ts`
  - Owns the environment helper for `PRISMA_SCHEMA_CHECK_ON_BOOT`.
- Create `apps/api/src/common/prisma/prisma-schema-check-on-boot.spec.ts`
  - Unit tests for default-on and explicit-disable behavior.
- Create `apps/api/src/common/prisma/prisma-schema-guard.ts`
  - Owns the required schema column list, `PrismaSchemaGuard`, and startup error formatting.
- Create `apps/api/src/common/prisma/prisma-schema-guard.spec.ts`
  - Unit tests for complete schema, missing single column, and missing multiple columns.
- Modify `apps/api/src/common/prisma/prisma.service.ts`
  - Calls the guard during `onModuleInit()` when the check is enabled.
- Create `apps/api/src/common/prisma/prisma.service.spec.ts`
  - Unit tests for PrismaService boot behavior without connecting to a real database.
- Modify `docs/runbook/env-runtime.md`
  - Documents schema startup checks and manual repair command.

---

## Task 1: Schema Check Flag

**Files:**
- Create: `apps/api/src/common/prisma/prisma-schema-check-on-boot.ts`
- Create: `apps/api/src/common/prisma/prisma-schema-check-on-boot.spec.ts`

- [ ] **Step 1: Write the failing flag tests**

Create `apps/api/src/common/prisma/prisma-schema-check-on-boot.spec.ts`:

```ts
import { shouldCheckPrismaSchemaOnBoot } from './prisma-schema-check-on-boot';

describe('shouldCheckPrismaSchemaOnBoot', () => {
  it('checks schema on boot by default', () => {
    expect(shouldCheckPrismaSchemaOnBoot({})).toBe(true);
  });

  it('skips schema check only when explicitly disabled', () => {
    expect(
      shouldCheckPrismaSchemaOnBoot({
        PRISMA_SCHEMA_CHECK_ON_BOOT: 'false',
      }),
    ).toBe(false);
  });

  it('keeps schema check enabled for other values', () => {
    expect(
      shouldCheckPrismaSchemaOnBoot({
        PRISMA_SCHEMA_CHECK_ON_BOOT: 'true',
      }),
    ).toBe(true);
    expect(
      shouldCheckPrismaSchemaOnBoot({
        PRISMA_SCHEMA_CHECK_ON_BOOT: 'FALSE',
      }),
    ).toBe(true);
    expect(
      shouldCheckPrismaSchemaOnBoot({
        PRISMA_SCHEMA_CHECK_ON_BOOT: '',
      }),
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run the flag test to verify it fails**

Run:

```bash
pnpm --filter api test -- prisma-schema-check-on-boot.spec.ts
```

Expected: FAIL because `prisma-schema-check-on-boot.ts` does not exist.

- [ ] **Step 3: Implement the flag helper**

Create `apps/api/src/common/prisma/prisma-schema-check-on-boot.ts`:

```ts
export function shouldCheckPrismaSchemaOnBoot(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.PRISMA_SCHEMA_CHECK_ON_BOOT !== 'false';
}
```

- [ ] **Step 4: Run the flag test to verify it passes**

Run:

```bash
pnpm --filter api test -- prisma-schema-check-on-boot.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the flag helper**

Run:

```bash
git add apps/api/src/common/prisma/prisma-schema-check-on-boot.ts apps/api/src/common/prisma/prisma-schema-check-on-boot.spec.ts
git commit -m "feat(api): add prisma schema boot flag"
```

---

## Task 2: Prisma Schema Guard

**Files:**
- Create: `apps/api/src/common/prisma/prisma-schema-guard.ts`
- Create: `apps/api/src/common/prisma/prisma-schema-guard.spec.ts`

- [ ] **Step 1: Write the failing guard tests**

Create `apps/api/src/common/prisma/prisma-schema-guard.spec.ts`:

```ts
import {
  PrismaSchemaGuard,
  type PrismaSchemaGuardPrisma,
  REQUIRED_PRISMA_SCHEMA_COLUMNS,
} from './prisma-schema-guard';

describe('PrismaSchemaGuard', () => {
  it('passes when all required columns exist', async () => {
    const prisma = createPrismaWithColumns(REQUIRED_PRISMA_SCHEMA_COLUMNS);
    const guard = new PrismaSchemaGuard(prisma);

    await expect(guard.assertSchemaReady()).resolves.toBeUndefined();
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('throws a repairable error when one required column is missing', async () => {
    const prisma = createPrismaWithColumns(
      REQUIRED_PRISMA_SCHEMA_COLUMNS.filter(
        (column) =>
          !(
            column.tableName === 'games' &&
            column.columnName === 'ecpm_auto_sync_enabled'
          ),
      ),
    );
    const guard = new PrismaSchemaGuard(prisma);

    await expect(guard.assertSchemaReady()).rejects.toThrow(
      'Database schema is out of sync with Prisma schema',
    );
    await expect(guard.assertSchemaReady()).rejects.toThrow(
      'games.ecpm_auto_sync_enabled',
    );
    await expect(guard.assertSchemaReady()).rejects.toThrow(
      'pnpm --filter api prisma:push',
    );
  });

  it('lists every missing required column in one error', async () => {
    const prisma = createPrismaWithColumns(
      REQUIRED_PRISMA_SCHEMA_COLUMNS.filter(
        (column) =>
          !(
            (column.tableName === 'games' &&
              column.columnName === 'ecpm_auto_sync_enabled') ||
            (column.tableName === 'kuaishou_ecpm_sync_jobs' &&
              column.columnName === 'lookback_hours')
          ),
      ),
    );
    const guard = new PrismaSchemaGuard(prisma);

    let error: unknown;
    try {
      await guard.assertSchemaReady();
    } catch (nextError) {
      error = nextError;
    }

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('games.ecpm_auto_sync_enabled');
    expect((error as Error).message).toContain(
      'kuaishou_ecpm_sync_jobs.lookback_hours',
    );
  });
});

function createPrismaWithColumns(
  columns: Array<{ columnName: string; tableName: string }>,
): PrismaSchemaGuardPrisma & { $queryRaw: jest.Mock } {
  return {
    $queryRaw: jest.fn(async () => {
      return columns.map((column) => ({
        columnName: column.columnName,
        tableName: column.tableName,
      }));
    }) as PrismaSchemaGuardPrisma['$queryRaw'] & jest.Mock,
  };
}
```

- [ ] **Step 2: Run the guard test to verify it fails**

Run:

```bash
pnpm --filter api test -- prisma-schema-guard.spec.ts
```

Expected: FAIL because `prisma-schema-guard.ts` does not exist.

- [ ] **Step 3: Implement the schema guard**

Create `apps/api/src/common/prisma/prisma-schema-guard.ts`:

```ts
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
```

- [ ] **Step 4: Run the guard test to verify it passes**

Run:

```bash
pnpm --filter api test -- prisma-schema-guard.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the schema guard**

Run:

```bash
git add apps/api/src/common/prisma/prisma-schema-guard.ts apps/api/src/common/prisma/prisma-schema-guard.spec.ts
git commit -m "feat(api): add prisma schema guard"
```

---

## Task 3: PrismaService Startup Integration

**Files:**
- Modify: `apps/api/src/common/prisma/prisma.service.ts`
- Create: `apps/api/src/common/prisma/prisma.service.spec.ts`

- [ ] **Step 1: Write the failing PrismaService tests**

Create `apps/api/src/common/prisma/prisma.service.spec.ts`:

```ts
import { PrismaSchemaGuard } from './prisma-schema-guard';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.restoreAllMocks();
    process.env = { ...originalEnv };
    delete process.env.PRISMA_CONNECT_ON_BOOT;
    delete process.env.PRISMA_SCHEMA_CHECK_ON_BOOT;
  });

  afterEach(async () => {
    process.env = originalEnv;
  });

  it('checks schema on module init by default', async () => {
    const service = new PrismaService();
    const connectSpy = jest
      .spyOn(service, '$connect')
      .mockResolvedValue(undefined);
    const schemaSpy = jest
      .spyOn(PrismaSchemaGuard.prototype, 'assertSchemaReady')
      .mockResolvedValue(undefined);

    await service.onModuleInit();

    expect(connectSpy).not.toHaveBeenCalled();
    expect(schemaSpy).toHaveBeenCalledTimes(1);
  });

  it('skips schema check when disabled', async () => {
    process.env.PRISMA_SCHEMA_CHECK_ON_BOOT = 'false';
    const service = new PrismaService();
    const schemaSpy = jest
      .spyOn(PrismaSchemaGuard.prototype, 'assertSchemaReady')
      .mockResolvedValue(undefined);

    await service.onModuleInit();

    expect(schemaSpy).not.toHaveBeenCalled();
  });

  it('connects before checking schema when eager connection is enabled', async () => {
    process.env.PRISMA_CONNECT_ON_BOOT = 'true';
    const service = new PrismaService();
    const connectSpy = jest
      .spyOn(service, '$connect')
      .mockResolvedValue(undefined);
    const schemaSpy = jest
      .spyOn(PrismaSchemaGuard.prototype, 'assertSchemaReady')
      .mockResolvedValue(undefined);

    await service.onModuleInit();

    expect(connectSpy).toHaveBeenCalledTimes(1);
    expect(schemaSpy).toHaveBeenCalledTimes(1);
    expect(connectSpy.mock.invocationCallOrder[0]).toBeLessThan(
      schemaSpy.mock.invocationCallOrder[0],
    );
  });

  it('propagates schema check errors so API startup fails', async () => {
    const service = new PrismaService();
    jest.spyOn(PrismaSchemaGuard.prototype, 'assertSchemaReady').mockRejectedValue(
      new Error('schema mismatch'),
    );

    await expect(service.onModuleInit()).rejects.toThrow('schema mismatch');
  });
});
```

- [ ] **Step 2: Run the PrismaService test to verify it fails**

Run:

```bash
pnpm --filter api test -- prisma.service.spec.ts
```

Expected: FAIL because `PrismaService` does not call `PrismaSchemaGuard`.

- [ ] **Step 3: Wire schema guard into PrismaService**

Modify `apps/api/src/common/prisma/prisma.service.ts`:

```ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { shouldCheckPrismaSchemaOnBoot } from './prisma-schema-check-on-boot';
import { PrismaSchemaGuard } from './prisma-schema-guard';
import { shouldConnectPrismaOnBoot } from './prisma-connect-on-boot';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    if (shouldConnectPrismaOnBoot()) {
      await this.$connect();
    }

    if (shouldCheckPrismaSchemaOnBoot()) {
      await new PrismaSchemaGuard(this).assertSchemaReady();
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

- [ ] **Step 4: Run focused Prisma tests**

Run:

```bash
pnpm --filter api test -- prisma.service.spec.ts prisma-schema-check-on-boot.spec.ts prisma-schema-guard.spec.ts prisma-connect-on-boot.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the PrismaService integration**

Run:

```bash
git add apps/api/src/common/prisma/prisma.service.ts apps/api/src/common/prisma/prisma.service.spec.ts
git commit -m "feat(api): check prisma schema on boot"
```

---

## Task 4: Runtime Runbook

**Files:**
- Modify: `docs/runbook/env-runtime.md`

- [ ] **Step 1: Update runbook with schema startup check**

Modify `docs/runbook/env-runtime.md` so the Server section reads:

```md
## Server

The API package scripts run through `scripts/with-root-env.mjs`, which loads
the root `.env` before starting NestJS or Prisma commands.

Use:

```bash
pnpm dev:api
```

Key server variables include `API_PORT`, `DATABASE_URL`,
`PRISMA_CONNECT_ON_BOOT`, `PRISMA_SCHEMA_CHECK_ON_BOOT`, `JWT_SECRET`,
`ADMIN_JWT_SECRET`, `KUAISHOU_API_MODE`, and the real Kuaishou credentials
when real mode is used.

The API checks key database tables and columns on startup by default. If the
database schema is behind the Prisma schema, startup fails with a message that
lists the missing columns. Confirm the root `.env` `DATABASE_URL` points to the
intended database, then run:

```bash
pnpm --filter api prisma:push
```

Do not use `PRISMA_SCHEMA_CHECK_ON_BOOT=false` for normal development. It is
only for tests or short maintenance windows where the database is being updated
separately.
```

- [ ] **Step 2: Verify the runbook has no markdown fence errors**

Run:

```bash
sed -n '1,120p' docs/runbook/env-runtime.md
```

Expected: Server section contains the schema startup check and the markdown code fences are balanced.

- [ ] **Step 3: Commit the runbook update**

Run:

```bash
git add docs/runbook/env-runtime.md
git commit -m "docs: document prisma schema boot check"
```

---

## Task 5: Final Verification

**Files:**
- No code changes expected.

- [ ] **Step 1: Validate Prisma schema**

Run:

```bash
pnpm --filter api prisma:validate
```

Expected: PASS with `The schema at prisma/schema.prisma is valid`.

- [ ] **Step 2: Run API tests**

Run:

```bash
pnpm --filter api test
```

Expected: PASS. Existing suite count may increase by the new Prisma tests.

- [ ] **Step 3: Build API**

Run:

```bash
pnpm --filter api build
```

Expected: PASS.

- [ ] **Step 4: Smoke check startup against the current `.env` database**

If a dev server is already running, stop it first. Then run:

```bash
pnpm dev:api
```

Expected: API starts successfully when the current `.env` database has the required columns.

- [ ] **Step 5: Confirm working tree**

Run:

```bash
git status --short
```

Expected: no output.
