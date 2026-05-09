# Game Config Auto ECPM Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a per-game configuration center and per-game automatic Kuaishou ECPM sync with preset frequency/range controls.

**Architecture:** Extend the existing `admin-resources` feature for game configuration fields and endpoints. Extract Kuaishou ECPM range refresh into a reusable service used by both manual admin refresh and an in-process scheduler. Keep the frontend in the current operations workspace, adding a left-navigation game config view that reuses existing API clients and UI primitives.

**Tech Stack:** NestJS, Prisma, Jest, React, Vite, Vitest, TypeScript, CSS modules via global `styles.css`.

---

## Scope Check

This plan implements one feature surface end to end:

- Backend schema and API support for per-game automatic sync settings.
- Backend range refresh execution and in-process scheduler.
- Frontend API types/client updates.
- Frontend game config view with basic info, budget/settlement, ECPM sync, and task history.

No external queue, external cron, distributed lock, arbitrary date range picker, retry workflow, or permission matrix is included.

## File Structure

### Backend

- Modify `apps/api/prisma/schema.prisma`
  - Add game auto sync fields.
  - Add Kuaishou sync job range fields.
- Modify `apps/api/src/features/admin-resources/admin-resources.service.ts`
  - Accept auto sync fields in `UpdateGameInput`.
  - Validate preset frequencies.
  - Set `ecpmAutoSyncNextRunAt` when enabling from disabled state.
  - Present changed fields for audit.
- Modify `apps/api/src/features/admin-resources/admin-resources.controller.ts`
  - Accept config fields on the existing `PATCH /admin/games/:gameId` endpoint.
  - Present the new game fields in game list and update responses.
- Modify `apps/api/src/features/kuaishou-admin/kuaishou-ecpm-sync-job.service.ts`
  - Persist and present range metadata.
  - Add helpers to list jobs by game and check running jobs.
- Create `apps/api/src/features/kuaishou-admin/kuaishou-ecpm-range-sync.service.ts`
  - Own data-hour point generation.
  - Execute one manual or system range refresh job.
  - Record success/failure audit.
- Create `apps/api/src/features/kuaishou-admin/kuaishou-ecpm-range-sync.service.spec.ts`
  - Unit tests for manual/system range execution.
- Create `apps/api/src/features/kuaishou-admin/kuaishou-ecpm-scheduler.service.ts`
  - In-process scheduler checks due games every minute.
  - Runs immediate and interval-driven automatic sync.
  - Skips a game when it already has a running sync job.
- Create `apps/api/src/features/kuaishou-admin/kuaishou-ecpm-scheduler.service.spec.ts`
  - Unit tests for due game selection, skip behavior, success, and failure.
- Modify `apps/api/src/features/kuaishou-admin/kuaishou-refresh.controller.ts`
  - Parse `lookbackHours`.
  - Delegate manual refresh to range sync service.
  - Support listing jobs filtered by `gameAppId`.
- Modify `apps/api/src/features/kuaishou-admin/kuaishou-refresh.module.ts`
  - Register range sync service and scheduler.
- Modify backend specs:
  - `apps/api/src/features/admin-resources/admin-resources.service.spec.ts`
  - `apps/api/src/features/admin-resources/admin-resources.controller.spec.ts`
  - `apps/api/src/features/kuaishou-admin/kuaishou-ecpm-sync-job.service.spec.ts`
  - `apps/api/src/features/kuaishou-admin/kuaishou-refresh.controller.spec.ts`

### Frontend

- Modify `apps/web/src/types/api.ts`
  - Add game auto sync fields and sync job range fields.
  - Add `EcpmLookbackHours` type.
- Modify `apps/web/src/lib/aiKsApi.ts`
  - Add `lookbackHours` to `refreshEcpm`.
  - Add optional `gameAppId` to `getKuaishouEcpmJobs`.
  - Allow game config fields in `updateAdminGame`.
- Modify `apps/web/src/lib/aiKsApi.test.ts`
  - Assert request bodies and query strings.
- Modify `apps/web/src/App.tsx`
  - Track selected config game, active config section, form fields, manual range.
  - Add handlers for opening config, saving config, allocating budget in config, manual range refresh.
- Modify `apps/web/src/pages/OperationsWorkspace.tsx`
  - Add game list configuration entry.
  - Add left-navigation game config view.
  - Keep existing budget and ECPM panels usable while moving primary per-game operations into config view.
- Modify `apps/web/src/pages/pages.test.tsx`
  - Assert config button, config view modules, saving auto sync config, manual range refresh.
- Modify `apps/web/src/styles.css`
  - Add game config layout, left navigation, module panels, compact settings rows.

---

## Task 1: Prisma Schema And Generated Client

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Run: `pnpm --filter api prisma:generate`
- Run: `pnpm --filter api prisma:validate`

- [ ] **Step 1: Add `Game` auto sync fields**

In `apps/api/prisma/schema.prisma`, update `model Game`:

```prisma
model Game {
  id                         String    @id @default(uuid())
  companyId                  String    @map("company_id")
  name                       String
  gameAppId                  String    @unique @map("game_app_id")
  gameSecret                 String    @map("game_secret")
  budgetLi                   BigInt    @default(0) @map("budget_li")
  settlementPaused           Boolean   @default(false) @map("settlement_paused")
  ecpmAutoSyncEnabled        Boolean   @default(false) @map("ecpm_auto_sync_enabled")
  ecpmAutoSyncIntervalHours  Int       @default(3) @map("ecpm_auto_sync_interval_hours")
  ecpmAutoSyncNextRunAt      DateTime? @map("ecpm_auto_sync_next_run_at")
  ecpmAutoSyncLastRunAt      DateTime? @map("ecpm_auto_sync_last_run_at")
  createdAt                  DateTime  @default(now()) @map("created_at")
  updatedAt                  DateTime  @updatedAt @map("updated_at")
  deletedAt                  DateTime? @map("deleted_at")

  company           Company           @relation(fields: [companyId], references: [id])
  openIds           GameOpenId[]
  rawEcpms          RawEcpm[]
  settlementBatches SettlementBatch[]

  @@unique([id, companyId])
  @@index([companyId])
  @@index([ecpmAutoSyncEnabled, ecpmAutoSyncNextRunAt])
  @@map("games")
}
```

- [ ] **Step 2: Add sync job range fields**

In `apps/api/prisma/schema.prisma`, update `model KuaishouEcpmSyncJob`:

```prisma
model KuaishouEcpmSyncJob {
  id                   String                    @id @default(uuid())
  status               KuaishouEcpmSyncJobStatus @default(RUNNING)
  gameAppId            String                    @map("game_app_id")
  dataHour             String                    @map("data_hour")
  lookbackHours        Int?                      @map("lookback_hours")
  startedDataHour      String?                   @map("started_data_hour")
  endedDataHour        String?                   @map("ended_data_hour")
  requestedOpenIdCount Int                       @map("requested_open_id_count")
  savedCount           Int                       @default(0) @map("saved_count")
  source               String?
  errorMessage         String?                   @map("error_message")
  actorId              String                    @map("actor_id")
  actorType            String                    @map("actor_type")
  startedAt            DateTime                  @default(now()) @map("started_at")
  finishedAt           DateTime?                 @map("finished_at")
  createdAt            DateTime                  @default(now()) @map("created_at")
  updatedAt            DateTime                  @updatedAt @map("updated_at")

  @@index([createdAt])
  @@index([gameAppId, dataHour])
  @@index([gameAppId, status])
  @@index([status])
  @@map("kuaishou_ecpm_sync_jobs")
}
```

- [ ] **Step 3: Generate and validate Prisma**

Run:

```bash
pnpm --filter api prisma:generate
pnpm --filter api prisma:validate
```

Expected:

```text
Generated Prisma Client
The schema at prisma/schema.prisma is valid
```

- [ ] **Step 4: Commit schema change**

Run:

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(api): add game ecpm auto sync schema"
```

---

## Task 2: Game Config API Fields

**Files:**
- Modify: `apps/api/src/features/admin-resources/admin-resources.service.spec.ts`
- Modify: `apps/api/src/features/admin-resources/admin-resources.service.ts`
- Modify: `apps/api/src/features/admin-resources/admin-resources.controller.spec.ts`
- Modify: `apps/api/src/features/admin-resources/admin-resources.controller.ts`

- [ ] **Step 1: Write failing service tests**

Add these tests to `AdminResourcesService` before the budget allocation test:

```ts
it('enables game ECPM auto sync immediately with the default next run time', async () => {
  const prisma = createFakePrisma({
    companies: [{ id: 'company-1', name: 'Acme Studio' }],
    games: [
      {
        id: 'game-1',
        companyId: 'company-1',
        gameAppId: 'ks_game_001',
        gameSecret: 'secret-1',
        name: 'Runner',
      },
    ],
  });
  const service = new AdminResourcesService(prisma, () => now);

  const game = await service.updateGame({
    actor: adminActor,
    ecpmAutoSyncEnabled: true,
    ecpmAutoSyncIntervalHours: 3,
    gameId: 'game-1',
  });

  expect(game).toMatchObject({
    ecpmAutoSyncEnabled: true,
    ecpmAutoSyncIntervalHours: 3,
    ecpmAutoSyncNextRunAt: now,
  });
  expect(prisma.auditLogs).toEqual([
    expect.objectContaining({
      action: 'game.updated',
      metadata: {
        changedFields: ['ecpmAutoSyncEnabled', 'ecpmAutoSyncIntervalHours'],
      },
    }),
  ]);
});

it('rejects unsupported ECPM auto sync frequencies', async () => {
  const prisma = createFakePrisma({
    companies: [{ id: 'company-1', name: 'Acme Studio' }],
    games: [
      {
        id: 'game-1',
        companyId: 'company-1',
        gameAppId: 'ks_game_001',
        gameSecret: 'secret-1',
        name: 'Runner',
      },
    ],
  });
  const service = new AdminResourcesService(prisma, () => now);

  await expect(
    service.updateGame({
      actor: adminActor,
      ecpmAutoSyncIntervalHours: 2,
      gameId: 'game-1',
    }),
  ).rejects.toBeInstanceOf(BadRequestException);
});

it('clears next run when disabling game ECPM auto sync', async () => {
  const prisma = createFakePrisma({
    companies: [{ id: 'company-1', name: 'Acme Studio' }],
    games: [
      {
        id: 'game-1',
        companyId: 'company-1',
        ecpmAutoSyncEnabled: true,
        ecpmAutoSyncIntervalHours: 6,
        ecpmAutoSyncNextRunAt: new Date('2026-05-08T06:00:00.000Z'),
        gameAppId: 'ks_game_001',
        gameSecret: 'secret-1',
        name: 'Runner',
      },
    ],
  });
  const service = new AdminResourcesService(prisma, () => now);

  const game = await service.updateGame({
    actor: adminActor,
    ecpmAutoSyncEnabled: false,
    gameId: 'game-1',
  });

  expect(game).toMatchObject({
    ecpmAutoSyncEnabled: false,
    ecpmAutoSyncNextRunAt: null,
  });
});
```

Add this constant near `adminActor`:

```ts
const now = new Date('2026-05-08T05:00:00.000Z');
```

Extend `FakeGame`:

```ts
type FakeGame = {
  id: string;
  budgetLi: bigint;
  companyId: string;
  ecpmAutoSyncEnabled: boolean;
  ecpmAutoSyncIntervalHours: number;
  ecpmAutoSyncLastRunAt: Date | null;
  ecpmAutoSyncNextRunAt: Date | null;
  gameAppId: string;
  gameSecret: string;
  name: string;
  settlementPaused: boolean;
  createdAt: Date;
  deletedAt: Date | null;
  updatedAt: Date;
};
```

Update fake seeded and created games to fill defaults:

```ts
ecpmAutoSyncEnabled: game.ecpmAutoSyncEnabled ?? false,
ecpmAutoSyncIntervalHours: game.ecpmAutoSyncIntervalHours ?? 3,
ecpmAutoSyncLastRunAt: game.ecpmAutoSyncLastRunAt ?? null,
ecpmAutoSyncNextRunAt: game.ecpmAutoSyncNextRunAt ?? null,
```

- [ ] **Step 2: Run service test to verify it fails**

Run:

```bash
pnpm --filter api test -- admin-resources.service.spec.ts
```

Expected: fail because `AdminResourcesService` does not accept auto sync fields or injected time yet.

- [ ] **Step 3: Implement service fields and validation**

In `apps/api/src/features/admin-resources/admin-resources.service.ts`, add injectable time support:

```ts
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
```

Add a provider token near the types:

```ts
export const ADMIN_RESOURCES_NOW = Symbol('ADMIN_RESOURCES_NOW');
const ALLOWED_ECPM_SYNC_INTERVAL_HOURS = new Set([1, 3, 6, 12, 24]);
```

Extend `UpdateGameInput`:

```ts
export type UpdateGameInput = {
  actor: AdminActor;
  ecpmAutoSyncEnabled?: boolean;
  ecpmAutoSyncIntervalHours?: number;
  gameId: string;
  gameSecret?: string;
  name?: string;
  settlementPaused?: boolean;
};
```

Update constructor:

```ts
constructor(
  @Inject(PrismaService) private readonly prisma: AdminResourcesPrisma,
  @Optional()
  @Inject(ADMIN_RESOURCES_NOW)
  private readonly nowProvider?: () => Date,
) {}
```

Add private time helper:

```ts
private now() {
  return this.nowProvider?.() ?? new Date();
}
```

Replace the start of `updateGame` with:

```ts
async updateGame(input: UpdateGameInput) {
  const changedFields = collectChangedFields(input);
  if (changedFields.length === 0) {
    throw new BadRequestException('至少提供一个可更新字段');
  }
  if (
    input.ecpmAutoSyncIntervalHours !== undefined &&
    !ALLOWED_ECPM_SYNC_INTERVAL_HOURS.has(input.ecpmAutoSyncIntervalHours)
  ) {
    throw new BadRequestException('ECPM 自动同步频率无效');
  }

  const currentGame = await findActiveGame(this.prisma, input.gameId);
  const data: Prisma.GameUpdateInput = {};
```

After existing `settlementPaused` assignment:

```ts
if (input.ecpmAutoSyncIntervalHours !== undefined) {
  data.ecpmAutoSyncIntervalHours = input.ecpmAutoSyncIntervalHours;
}
if (input.ecpmAutoSyncEnabled !== undefined) {
  data.ecpmAutoSyncEnabled = input.ecpmAutoSyncEnabled;
  data.ecpmAutoSyncNextRunAt = input.ecpmAutoSyncEnabled
    ? currentGame.ecpmAutoSyncEnabled
      ? currentGame.ecpmAutoSyncNextRunAt
      : this.now()
    : null;
}
```

Update `collectChangedFields`:

```ts
function collectChangedFields(input: UpdateGameInput) {
  return [
    input.name !== undefined ? 'name' : undefined,
    input.gameSecret !== undefined ? 'gameSecret' : undefined,
    input.settlementPaused !== undefined ? 'settlementPaused' : undefined,
    input.ecpmAutoSyncEnabled !== undefined ? 'ecpmAutoSyncEnabled' : undefined,
    input.ecpmAutoSyncIntervalHours !== undefined
      ? 'ecpmAutoSyncIntervalHours'
      : undefined,
  ].filter((field): field is string => Boolean(field));
}
```

- [ ] **Step 4: Run service test to verify it passes**

Run:

```bash
pnpm --filter api test -- admin-resources.service.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Write failing controller tests**

In `apps/api/src/features/admin-resources/admin-resources.controller.spec.ts`, update the presented game expectation with:

```ts
ecpmAutoSyncEnabled: false,
ecpmAutoSyncIntervalHours: 3,
ecpmAutoSyncLastRunAt: null,
ecpmAutoSyncNextRunAt: null,
```

Update the fake `game` object with:

```ts
ecpmAutoSyncEnabled: false,
ecpmAutoSyncIntervalHours: 3,
ecpmAutoSyncLastRunAt: null,
ecpmAutoSyncNextRunAt: null,
```

Add controller update assertion:

```ts
it('updates game ECPM auto sync config with allowed frequency presets', async () => {
  const service = createService();
  const controller = new AdminResourcesController(service);

  await controller.updateGame(admin, ' game-1 ', {
    ecpmAutoSyncEnabled: true,
    ecpmAutoSyncIntervalHours: 6,
  });

  expect(service.lastUpdateGameInput).toEqual({
    actor: admin,
    ecpmAutoSyncEnabled: true,
    ecpmAutoSyncIntervalHours: 6,
    gameId: 'game-1',
    gameSecret: undefined,
    name: undefined,
    settlementPaused: undefined,
  });
});
```

Add invalid frequency assertion:

```ts
it('rejects invalid game ECPM auto sync frequency input', async () => {
  const controller = new AdminResourcesController(createService());

  await expect(
    controller.updateGame(admin, 'game-1', {
      ecpmAutoSyncIntervalHours: 2,
    }),
  ).rejects.toBeInstanceOf(BadRequestException);
});
```

- [ ] **Step 6: Run controller test to verify it fails**

Run:

```bash
pnpm --filter api test -- admin-resources.controller.spec.ts
```

Expected: fail because schema and presenter do not include auto sync fields.

- [ ] **Step 7: Implement controller parsing and presenter**

In `apps/api/src/features/admin-resources/admin-resources.controller.ts`, add:

```ts
const ecpmAutoSyncIntervalSchema = z.union([
  z.literal(1),
  z.literal(3),
  z.literal(6),
  z.literal(12),
  z.literal(24),
]);
```

Extend `updateGameSchema`:

```ts
const updateGameSchema = z.object({
  ecpmAutoSyncEnabled: z.boolean().optional(),
  ecpmAutoSyncIntervalHours: ecpmAutoSyncIntervalSchema.optional(),
  gameSecret: idSchema.optional(),
  name: idSchema.optional(),
  settlementPaused: z.boolean().optional(),
});
```

Update empty body check:

```ts
if (
  input.name === undefined &&
  input.gameSecret === undefined &&
  input.settlementPaused === undefined &&
  input.ecpmAutoSyncEnabled === undefined &&
  input.ecpmAutoSyncIntervalHours === undefined
) {
  throw new BadRequestException('Game update is invalid');
}
```

Pass fields to service:

```ts
const game = await this.adminResourcesService.updateGame({
  actor: admin,
  ecpmAutoSyncEnabled: input.ecpmAutoSyncEnabled,
  ecpmAutoSyncIntervalHours: input.ecpmAutoSyncIntervalHours,
  gameId: parseId(gameId, 'Game id is invalid'),
  gameSecret: input.gameSecret,
  name: input.name,
  settlementPaused: input.settlementPaused,
});
```

Extend `presentGame` input and output:

```ts
function presentGame(
  game: {
    budgetLi: bigint;
    companyId: string;
    createdAt: Date;
    ecpmAutoSyncEnabled: boolean;
    ecpmAutoSyncIntervalHours: number;
    ecpmAutoSyncLastRunAt: Date | null;
    ecpmAutoSyncNextRunAt: Date | null;
    gameAppId: string;
    gameSecret: string;
    id: string;
    name: string;
    settlementPaused: boolean;
    updatedAt: Date;
  } & Partial<Pick<GameWithCompany, 'company'>>,
) {
  return {
    budget: presentMoneyLi(game.budgetLi),
    companyId: game.companyId,
    companyName: game.company?.name ?? '',
    createdAt: game.createdAt.toISOString(),
    ecpmAutoSyncEnabled: game.ecpmAutoSyncEnabled,
    ecpmAutoSyncIntervalHours: game.ecpmAutoSyncIntervalHours,
    ecpmAutoSyncLastRunAt:
      game.ecpmAutoSyncLastRunAt?.toISOString() ?? null,
    ecpmAutoSyncNextRunAt:
      game.ecpmAutoSyncNextRunAt?.toISOString() ?? null,
    gameAppId: game.gameAppId,
    gameSecret: game.gameSecret,
    id: game.id,
    name: game.name,
    settlementPaused: game.settlementPaused,
    updatedAt: game.updatedAt.toISOString(),
  };
}
```

- [ ] **Step 8: Run controller test to verify it passes**

Run:

```bash
pnpm --filter api test -- admin-resources.controller.spec.ts
```

Expected: PASS.

- [ ] **Step 9: Commit game config API fields**

Run:

```bash
git add apps/api/src/features/admin-resources/admin-resources.service.ts apps/api/src/features/admin-resources/admin-resources.service.spec.ts apps/api/src/features/admin-resources/admin-resources.controller.ts apps/api/src/features/admin-resources/admin-resources.controller.spec.ts
git commit -m "feat(api): add game ecpm auto sync config"
```

---

## Task 3: Sync Job Range Metadata

**Files:**
- Modify: `apps/api/src/features/kuaishou-admin/kuaishou-ecpm-sync-job.service.spec.ts`
- Modify: `apps/api/src/features/kuaishou-admin/kuaishou-ecpm-sync-job.service.ts`

- [ ] **Step 1: Write failing sync job metadata tests**

Update the first `startJob` call in `kuaishou-ecpm-sync-job.service.spec.ts`:

```ts
const job = await service.startJob({
  actorId: 'admin',
  actorType: 'SUPER_ADMIN',
  dataHour: '2026-05-08T02:00:00+08:00',
  endedDataHour: '2026-05-08T02:00:00+08:00',
  gameAppId: 'game-1',
  lookbackHours: 3,
  requestedOpenIdCount: 2,
  startedDataHour: '2026-05-08T00:00:00+08:00',
});
```

Extend the expectation:

```ts
expect(job).toMatchObject({
  actorId: 'admin',
  actorType: 'SUPER_ADMIN',
  dataHour: '2026-05-08T02:00:00+08:00',
  endedDataHour: '2026-05-08T02:00:00+08:00',
  gameAppId: 'game-1',
  lookbackHours: 3,
  requestedOpenIdCount: 2,
  savedCount: 0,
  startedDataHour: '2026-05-08T00:00:00+08:00',
  status: KuaishouEcpmSyncJobStatus.RUNNING,
});
```

Add tests:

```ts
it('filters jobs by game app id when listing recent sync jobs', async () => {
  const { prisma, service } = createService();
  await service.startJob({ ...baseStartInput(), gameAppId: 'game-1' });
  await service.startJob({ ...baseStartInput(), gameAppId: 'game-2' });

  const result = await service.listJobs({ gameAppId: 'game-1', limit: 20 });

  expect(result).toHaveLength(1);
  expect(result[0].gameAppId).toBe('game-1');
  expect(prisma.lastFindManyArgs).toMatchObject({
    where: {
      gameAppId: 'game-1',
    },
  });
});

it('detects running sync jobs for one game', async () => {
  const { service } = createService();
  await service.startJob({ ...baseStartInput(), gameAppId: 'game-1' });

  await expect(service.hasRunningJob('game-1')).resolves.toBe(true);
  await expect(service.hasRunningJob('game-2')).resolves.toBe(false);
});
```

Extend presenter expectation:

```ts
endedDataHour: null,
lookbackHours: null,
startedDataHour: null,
```

Update fake `findMany` to honor `args.where?.gameAppId`, and add fake `findFirst`:

```ts
findFirst: async (args: any) =>
  rows.find(
    (row) =>
      row.gameAppId === args.where.gameAppId &&
      row.status === args.where.status,
  ) ?? null,
findMany: async (args: any) => {
  lastFindManyArgs = args;
  return rows
    .filter((row) => !args.where?.gameAppId || row.gameAppId === args.where.gameAppId)
    .slice()
    .sort((a, b) =>
      args.orderBy?.createdAt === 'desc'
        ? b.createdAt.getTime() - a.createdAt.getTime()
        : a.createdAt.getTime() - b.createdAt.getTime(),
    )
    .slice(0, args.take);
},
```

- [ ] **Step 2: Run sync job service test to verify it fails**

Run:

```bash
pnpm --filter api test -- kuaishou-ecpm-sync-job.service.spec.ts
```

Expected: fail because range fields and running-job helper do not exist.

- [ ] **Step 3: Implement sync job service metadata**

In `apps/api/src/features/kuaishou-admin/kuaishou-ecpm-sync-job.service.ts`, update the Prisma pick:

```ts
type SyncJobPrisma = Pick<PrismaService, 'kuaishouEcpmSyncJob'>;
```

Extend start input:

```ts
export type StartKuaishouEcpmSyncJobInput = {
  actorId: string;
  actorType: string;
  dataHour: string;
  endedDataHour?: string;
  gameAppId: string;
  lookbackHours?: number;
  requestedOpenIdCount: number;
  startedDataHour?: string;
};
```

Extend list input:

```ts
export type ListKuaishouEcpmSyncJobsInput = {
  gameAppId?: string;
  limit?: number;
};
```

In `startJob`, add:

```ts
endedDataHour: input.endedDataHour,
lookbackHours: input.lookbackHours,
startedDataHour: input.startedDataHour,
```

Update `listJobs`:

```ts
listJobs(input: ListKuaishouEcpmSyncJobsInput = {}) {
  return this.prisma.kuaishouEcpmSyncJob.findMany({
    orderBy: {
      createdAt: 'desc',
    },
    take: clampLimit(input.limit),
    where: input.gameAppId ? { gameAppId: input.gameAppId } : undefined,
  });
}
```

Add helper:

```ts
async hasRunningJob(gameAppId: string) {
  const job = await this.prisma.kuaishouEcpmSyncJob.findFirst({
    where: {
      gameAppId,
      status: KuaishouEcpmSyncJobStatus.RUNNING,
    },
  });

  return Boolean(job);
}
```

Extend presenter:

```ts
endedDataHour: job.endedDataHour ?? null,
lookbackHours: job.lookbackHours ?? null,
startedDataHour: job.startedDataHour ?? null,
```

- [ ] **Step 4: Run sync job service test to verify it passes**

Run:

```bash
pnpm --filter api test -- kuaishou-ecpm-sync-job.service.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit sync job metadata**

Run:

```bash
git add apps/api/src/features/kuaishou-admin/kuaishou-ecpm-sync-job.service.ts apps/api/src/features/kuaishou-admin/kuaishou-ecpm-sync-job.service.spec.ts
git commit -m "feat(api): track ecpm sync job ranges"
```

---

## Task 4: Range ECPM Sync Service And Manual Refresh

**Files:**
- Create: `apps/api/src/features/kuaishou-admin/kuaishou-ecpm-range-sync.service.ts`
- Create: `apps/api/src/features/kuaishou-admin/kuaishou-ecpm-range-sync.service.spec.ts`
- Modify: `apps/api/src/features/kuaishou-admin/kuaishou-refresh.controller.ts`
- Modify: `apps/api/src/features/kuaishou-admin/kuaishou-refresh.controller.spec.ts`
- Modify: `apps/api/src/features/kuaishou-admin/kuaishou-refresh.module.ts`

- [ ] **Step 1: Create failing range sync service tests**

Create `apps/api/src/features/kuaishou-admin/kuaishou-ecpm-range-sync.service.spec.ts`:

```ts
import { BadRequestException } from '@nestjs/common';
import { KuaishouEcpmRangeSyncService } from './kuaishou-ecpm-range-sync.service';

describe('KuaishouEcpmRangeSyncService', () => {
  it('splits lookback hours into hourly dataHour points and saves one job', async () => {
    const dependencies = createDependencies();
    const service = createService(dependencies);

    const result = await service.refreshRange({
      actorId: 'admin',
      actorType: 'SUPER_ADMIN',
      gameAppId: 'game-1',
      lookbackHours: 3,
      markTokenError: true,
    });

    expect(dependencies.ecpmClient.refresh).toHaveBeenCalledTimes(3);
    expect(dependencies.ecpmClient.refresh.mock.calls.map(([input]) => input.dataHour)).toEqual([
      '2026-05-08T12:00:00+08:00',
      '2026-05-08T13:00:00+08:00',
      '2026-05-08T14:00:00+08:00',
    ]);
    expect(dependencies.syncJobService.startJob).toHaveBeenCalledWith({
      actorId: 'admin',
      actorType: 'SUPER_ADMIN',
      dataHour: '2026-05-08T14:00:00+08:00',
      endedDataHour: '2026-05-08T14:00:00+08:00',
      gameAppId: 'game-1',
      lookbackHours: 3,
      requestedOpenIdCount: 2,
      startedDataHour: '2026-05-08T12:00:00+08:00',
    });
    expect(dependencies.demoStore.addEcpmRows).toHaveBeenCalledWith({
      gameAppId: 'game-1',
      rows: expect.arrayContaining([
        expect.objectContaining({ platformEventId: 'event-1' }),
        expect.objectContaining({ platformEventId: 'event-2' }),
        expect.objectContaining({ platformEventId: 'event-3' }),
      ]),
    });
    expect(result.savedCount).toBe(3);
  });

  it('uses explicit open ids when provided', async () => {
    const dependencies = createDependencies();
    const service = createService(dependencies);

    await service.refreshRange({
      actorId: 'admin',
      actorType: 'SUPER_ADMIN',
      gameAppId: 'game-1',
      lookbackHours: 1,
      markTokenError: true,
      openIds: ['open-explicit'],
    });

    expect(dependencies.demoStore.listOpenIds).not.toHaveBeenCalled();
    expect(dependencies.ecpmClient.refresh).toHaveBeenCalledWith({
      dataHour: '2026-05-08T14:00:00+08:00',
      gameAppId: 'game-1',
      openIds: ['open-explicit'],
    });
  });

  it('rejects unsupported lookback hours', async () => {
    const service = createService(createDependencies());

    await expect(
      service.refreshRange({
        actorId: 'admin',
        actorType: 'SUPER_ADMIN',
        gameAppId: 'game-1',
        lookbackHours: 2,
        markTokenError: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('fails the job and marks token errors when upstream refresh fails', async () => {
    const dependencies = createDependencies();
    dependencies.ecpmClient.refresh.mockRejectedValueOnce(new Error('token expired'));
    const service = createService(dependencies);

    await expect(
      service.refreshRange({
        actorId: 'admin',
        actorType: 'SUPER_ADMIN',
        gameAppId: 'game-1',
        lookbackHours: 1,
        markTokenError: true,
      }),
    ).rejects.toThrow('token expired');

    expect(dependencies.syncJobService.failJob).toHaveBeenCalledWith({
      errorMessage: 'token expired',
      jobId: 'job-1',
    });
    expect(dependencies.tokenService.markTokenError).toHaveBeenCalledWith('token expired');
    expect(dependencies.auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'kuaishou.ecpm_refresh_failed',
        actorId: 'admin',
        actorType: 'SUPER_ADMIN',
      }),
    );
  });
});

const now = new Date('2026-05-08T06:20:00.000Z');

function createService(dependencies: ReturnType<typeof createDependencies>) {
  return new KuaishouEcpmRangeSyncService(
    dependencies.demoStore as any,
    dependencies.ecpmClient as any,
    dependencies.auditLogService as any,
    dependencies.tokenService as any,
    dependencies.syncJobService as any,
    () => now,
  );
}

function createDependencies() {
  const syncJob = {
    actorId: 'admin',
    actorType: 'SUPER_ADMIN',
    createdAt: new Date('2026-05-08T06:20:00.000Z'),
    dataHour: '2026-05-08T14:00:00+08:00',
    endedDataHour: '2026-05-08T14:00:00+08:00',
    errorMessage: null,
    finishedAt: null,
    gameAppId: 'game-1',
    id: 'job-1',
    lookbackHours: 3,
    requestedOpenIdCount: 2,
    savedCount: 0,
    source: null,
    startedAt: new Date('2026-05-08T06:20:00.000Z'),
    startedDataHour: '2026-05-08T12:00:00+08:00',
    status: 'RUNNING',
    updatedAt: new Date('2026-05-08T06:20:00.000Z'),
  };

  return {
    auditLogService: {
      record: jest.fn(async () => undefined),
    },
    demoStore: {
      addEcpmRows: jest.fn(async (input: { rows: unknown[] }) => input.rows),
      listOpenIds: jest.fn(async () => [{ openId: 'open-1' }, { openId: 'open-2' }]),
    },
    ecpmClient: {
      refresh: jest.fn(async (input: { dataHour: string }) => ({
        rows: [
          {
            eventTime: new Date(input.dataHour),
            openId: 'open-1',
            platformEventId: `event-${input.dataHour.slice(11, 13)}`,
            rawCostLi: 2300n,
          },
        ],
        source: 'kuaishou' as const,
      })),
    },
    syncJobService: {
      completeJob: jest.fn(async (input: { savedCount: number; source: string }) => ({
        ...syncJob,
        finishedAt: now,
        savedCount: input.savedCount,
        source: input.source,
        status: 'SUCCEEDED',
      })),
      failJob: jest.fn(async () => ({ ...syncJob, status: 'FAILED' })),
      startJob: jest.fn(async () => syncJob),
    },
    tokenService: {
      markTokenError: jest.fn(async () => undefined),
    },
  };
}
```

- [ ] **Step 2: Run range sync test to verify it fails**

Run:

```bash
pnpm --filter api test -- kuaishou-ecpm-range-sync.service.spec.ts
```

Expected: fail because service file does not exist.

- [ ] **Step 3: Implement range sync service**

Create `apps/api/src/features/kuaishou-admin/kuaishou-ecpm-range-sync.service.ts`:

```ts
import {
  BadRequestException,
  Inject,
  Injectable,
  Optional,
} from '@nestjs/common';
import { KuaishouEcpmClient } from '../../integrations/kuaishou/kuaishou-ecpm.client';
import { AuditLogService } from '../audit/audit-log.service';
import { DemoStore } from '../demo/demo-store';
import { presentEcpmRow } from '../demo/money-presenter';
import { KuaishouEcpmSyncJobService, presentKuaishouEcpmSyncJob } from './kuaishou-ecpm-sync-job.service';
import { KuaishouTokenService } from './kuaishou-token.service';

export const KUAISHOU_ECPM_RANGE_SYNC_NOW = Symbol('KUAISHOU_ECPM_RANGE_SYNC_NOW');
const ALLOWED_LOOKBACK_HOURS = new Set([1, 3, 6, 12, 24]);

export type KuaishouEcpmRangeSyncInput = {
  actorId: string;
  actorType: string;
  gameAppId: string;
  lookbackHours: number;
  markTokenError: boolean;
  openIds?: string[];
};

@Injectable()
export class KuaishouEcpmRangeSyncService {
  constructor(
    private readonly demoStore: DemoStore,
    private readonly ecpmClient: KuaishouEcpmClient,
    private readonly auditLogService: AuditLogService,
    private readonly tokenService: KuaishouTokenService,
    private readonly syncJobService: KuaishouEcpmSyncJobService,
    @Optional()
    @Inject(KUAISHOU_ECPM_RANGE_SYNC_NOW)
    private readonly nowProvider?: () => Date,
  ) {}

  async refreshRange(input: KuaishouEcpmRangeSyncInput) {
    assertAllowedLookbackHours(input.lookbackHours);
    const dataHours = buildRecentDataHours(input.lookbackHours, this.now());
    const knownOpenIds = input.openIds?.length
      ? input.openIds
      : (await this.demoStore.listOpenIds(input.gameAppId)).map((record) => record.openId);
    const startedDataHour = dataHours[0]!;
    const endedDataHour = dataHours[dataHours.length - 1]!;
    const job = await this.syncJobService.startJob({
      actorId: input.actorId,
      actorType: input.actorType,
      dataHour: endedDataHour,
      endedDataHour,
      gameAppId: input.gameAppId,
      lookbackHours: input.lookbackHours,
      requestedOpenIdCount: knownOpenIds.length,
      startedDataHour,
    });

    try {
      const refreshResults = [];
      for (const dataHour of dataHours) {
        refreshResults.push(
          await this.ecpmClient.refresh({
            dataHour,
            gameAppId: input.gameAppId,
            openIds: knownOpenIds,
          }),
        );
      }
      const rows = refreshResults.flatMap((result) => result.rows);
      const savedRows = await this.demoStore.addEcpmRows({
        gameAppId: input.gameAppId,
        rows,
      });
      const source = refreshResults.find((result) => result.source === 'kuaishou')
        ? 'kuaishou'
        : 'mock';
      const completedJob = await this.syncJobService.completeJob({
        jobId: job.id,
        savedCount: savedRows.length,
        source,
      });
      await this.auditLogService.record({
        action: 'kuaishou.ecpm_refreshed',
        actorId: input.actorId,
        actorType: input.actorType,
        metadata: {
          dataHours,
          endedDataHour,
          jobId: job.id,
          lookbackHours: input.lookbackHours,
          requestedOpenIds: knownOpenIds,
          savedCount: savedRows.length,
          source,
          startedDataHour,
        },
        targetId: input.gameAppId,
        targetType: 'kuaishou_ecpm_refresh',
      });

      return {
        job: presentKuaishouEcpmSyncJob(completedJob),
        requestedOpenIds: knownOpenIds,
        rows: savedRows.map(presentEcpmRow),
        savedCount: savedRows.length,
        source,
      };
    } catch (error) {
      await this.recordFailure({
        actorId: input.actorId,
        actorType: input.actorType,
        dataHours,
        endedDataHour,
        error,
        gameAppId: input.gameAppId,
        jobId: job.id,
        lookbackHours: input.lookbackHours,
        markTokenError: input.markTokenError,
        openIds: knownOpenIds,
        startedDataHour,
      });
      throw error;
    }
  }

  private async recordFailure(input: {
    actorId: string;
    actorType: string;
    dataHours: string[];
    endedDataHour: string;
    error: unknown;
    gameAppId: string;
    jobId: string;
    lookbackHours: number;
    markTokenError: boolean;
    openIds: string[];
    startedDataHour: string;
  }) {
    const message = readErrorMessage(input.error);
    await this.syncJobService.failJob({
      errorMessage: message,
      jobId: input.jobId,
    });
    if (input.markTokenError) {
      await this.tokenService.markTokenError(message);
    }
    await this.auditLogService.record({
      action: 'kuaishou.ecpm_refresh_failed',
      actorId: input.actorId,
      actorType: input.actorType,
      metadata: {
        dataHours: input.dataHours,
        endedDataHour: input.endedDataHour,
        error: message,
        jobId: input.jobId,
        lookbackHours: input.lookbackHours,
        requestedOpenIds: input.openIds,
        startedDataHour: input.startedDataHour,
      },
      targetId: input.gameAppId,
      targetType: 'kuaishou_ecpm_refresh',
    });
  }

  private now() {
    return this.nowProvider?.() ?? new Date();
  }
}

export function buildRecentDataHours(lookbackHours: number, now: Date) {
  assertAllowedLookbackHours(lookbackHours);
  const chinaNow = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  chinaNow.setUTCMinutes(0, 0, 0);
  const result = [];
  for (let index = lookbackHours - 1; index >= 0; index -= 1) {
    const point = new Date(chinaNow.getTime() - index * 60 * 60 * 1000);
    result.push(point.toISOString().slice(0, 19) + '+08:00');
  }
  return result;
}

function assertAllowedLookbackHours(value: number) {
  if (!ALLOWED_LOOKBACK_HOURS.has(value)) {
    throw new BadRequestException('ECPM 同步范围无效');
  }
}

function readErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'unknown error';
}
```

- [ ] **Step 4: Run range sync test to verify it passes**

Run:

```bash
pnpm --filter api test -- kuaishou-ecpm-range-sync.service.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Write failing manual refresh controller tests**

In `apps/api/src/features/kuaishou-admin/kuaishou-refresh.controller.spec.ts`, replace dependency expectations for `ecpmClient`, `demoStore.addEcpmRows`, and `syncJobService.startJob` with range sync delegation:

```ts
it('delegates manual ECPM lookback refresh to the range sync service', async () => {
  const dependencies = createDependencies();
  const controller = createController(dependencies);

  const result = await controller.refresh(admin, {
    gameAppId: 'game-1',
    lookbackHours: 3,
    openIds: ['open-1'],
  });

  expect(dependencies.rangeSyncService.refreshRange).toHaveBeenCalledWith({
    actorId: 'admin',
    actorType: 'SUPER_ADMIN',
    gameAppId: 'game-1',
    lookbackHours: 3,
    markTokenError: true,
    openIds: ['open-1'],
  });
  expect(result).toMatchObject({
    savedCount: 1,
    source: 'kuaishou',
  });
});

it('lists recent ECPM sync jobs filtered by game app id', async () => {
  const dependencies = createDependencies();
  const controller = createController(dependencies);

  await controller.jobs('50', 'game-1');

  expect(dependencies.syncJobService.listJobs).toHaveBeenCalledWith({
    gameAppId: 'game-1',
    limit: 50,
  });
});
```

Update `createController` constructor usage:

```ts
return new (KuaishouRefreshController as any)(
  dependencies.rangeSyncService,
  dependencies.syncJobService,
) as KuaishouRefreshController;
```

Add fake dependency:

```ts
rangeSyncService: {
  refreshRange: jest.fn(async () => ({
    job: syncJob,
    requestedOpenIds: ['open-1'],
    rows: [savedRow],
    savedCount: 1,
    source: 'kuaishou' as const,
  })),
},
```

- [ ] **Step 6: Run refresh controller test to verify it fails**

Run:

```bash
pnpm --filter api test -- kuaishou-refresh.controller.spec.ts
```

Expected: fail because controller still owns refresh internals and does not parse `lookbackHours`.

- [ ] **Step 7: Implement manual refresh delegation**

Replace `KuaishouRefreshController` constructor and `refresh` body:

```ts
const lookbackHoursSchema = z.union([
  z.literal(1),
  z.literal(3),
  z.literal(6),
  z.literal(12),
  z.literal(24),
]);

const refreshEcpmSchema = z.object({
  dataHour: z.string().min(1).optional(),
  gameAppId: z.string().min(1),
  lookbackHours: lookbackHoursSchema.optional(),
  openIds: z.array(z.string().min(1)).optional(),
});
```

```ts
constructor(
  private readonly rangeSyncService: KuaishouEcpmRangeSyncService,
  private readonly syncJobService: KuaishouEcpmSyncJobService,
) {}
```

```ts
@Post('ecpm/refresh')
async refresh(@CurrentAdmin() admin: AdminPrincipal, @Body() body: unknown) {
  const input = refreshEcpmSchema.parse(body);
  return this.rangeSyncService.refreshRange({
    actorId: admin.username,
    actorType: admin.role,
    gameAppId: input.gameAppId,
    lookbackHours: input.lookbackHours ?? 1,
    markTokenError: true,
    openIds: input.openIds,
  });
}
```

Update jobs endpoint:

```ts
@Get('ecpm/jobs')
async jobs(@Query('limit') limit?: string, @Query('gameAppId') gameAppId?: string) {
  const jobs = await this.syncJobService.listJobs({
    gameAppId: gameAppId?.trim() || undefined,
    limit: parseLimit(limit),
  });

  return {
    jobs: jobs.map(presentKuaishouEcpmSyncJob),
  };
}
```

Remove unused imports: `KuaishouEcpmClient`, `AuditLogService`, `DemoStore`, `presentEcpmRow`, `KuaishouTokenService`.

- [ ] **Step 8: Register range sync service**

In `apps/api/src/features/kuaishou-admin/kuaishou-refresh.module.ts`, update providers:

```ts
import { KuaishouEcpmRangeSyncService } from './kuaishou-ecpm-range-sync.service';

@Module({
  controllers: [KuaishouRefreshController, KuaishouTokenController],
  imports: [AdminAuthModule, AuditLogModule, DemoModule, KuaishouModule],
  providers: [KuaishouEcpmRangeSyncService, KuaishouEcpmSyncJobService],
})
export class KuaishouRefreshModule {}
```

- [ ] **Step 9: Run refresh controller and range sync tests**

Run:

```bash
pnpm --filter api test -- kuaishou-refresh.controller.spec.ts kuaishou-ecpm-range-sync.service.spec.ts
```

Expected: PASS.

- [ ] **Step 10: Commit manual range sync**

Run:

```bash
git add apps/api/src/features/kuaishou-admin/kuaishou-ecpm-range-sync.service.ts apps/api/src/features/kuaishou-admin/kuaishou-ecpm-range-sync.service.spec.ts apps/api/src/features/kuaishou-admin/kuaishou-refresh.controller.ts apps/api/src/features/kuaishou-admin/kuaishou-refresh.controller.spec.ts apps/api/src/features/kuaishou-admin/kuaishou-refresh.module.ts
git commit -m "feat(api): support ecpm range refresh"
```

---

## Task 5: In-Process Automatic ECPM Scheduler

**Files:**
- Create: `apps/api/src/features/kuaishou-admin/kuaishou-ecpm-scheduler.service.ts`
- Create: `apps/api/src/features/kuaishou-admin/kuaishou-ecpm-scheduler.service.spec.ts`
- Modify: `apps/api/src/features/kuaishou-admin/kuaishou-refresh.module.ts`

- [ ] **Step 1: Write failing scheduler tests**

Create `apps/api/src/features/kuaishou-admin/kuaishou-ecpm-scheduler.service.spec.ts`:

```ts
import { KuaishouEcpmSchedulerService } from './kuaishou-ecpm-scheduler.service';

describe('KuaishouEcpmSchedulerService', () => {
  it('runs due enabled games with a SYSTEM actor and advances last and next run times', async () => {
    const dependencies = createDependencies();
    dependencies.prisma.games = [
      game({
        ecpmAutoSyncEnabled: true,
        ecpmAutoSyncIntervalHours: 3,
        ecpmAutoSyncNextRunAt: new Date('2026-05-08T05:59:00.000Z'),
      }),
    ];
    const service = createService(dependencies);

    await service.runDueSyncsOnce();

    expect(dependencies.rangeSyncService.refreshRange).toHaveBeenCalledWith({
      actorId: 'system',
      actorType: 'SYSTEM',
      gameAppId: 'ks_game_001',
      lookbackHours: 3,
      markTokenError: false,
    });
    expect(dependencies.prisma.updates).toEqual([
      {
        data: {
          ecpmAutoSyncLastRunAt: now,
          ecpmAutoSyncNextRunAt: new Date('2026-05-08T09:00:00.000Z'),
        },
        where: { id: 'game-1' },
      },
    ]);
  });

  it('skips a due game that already has a running sync job and advances next run', async () => {
    const dependencies = createDependencies();
    dependencies.syncJobService.hasRunningJob.mockResolvedValueOnce(true);
    dependencies.prisma.games = [
      game({
        ecpmAutoSyncEnabled: true,
        ecpmAutoSyncIntervalHours: 6,
        ecpmAutoSyncNextRunAt: new Date('2026-05-08T05:59:00.000Z'),
      }),
    ];
    const service = createService(dependencies);

    await service.runDueSyncsOnce();

    expect(dependencies.rangeSyncService.refreshRange).not.toHaveBeenCalled();
    expect(dependencies.prisma.updates).toEqual([
      {
        data: {
          ecpmAutoSyncNextRunAt: new Date('2026-05-08T12:00:00.000Z'),
        },
        where: { id: 'game-1' },
      },
    ]);
  });

  it('advances last and next run after a failed automatic sync without throwing', async () => {
    const dependencies = createDependencies();
    dependencies.rangeSyncService.refreshRange.mockRejectedValueOnce(new Error('upstream down'));
    dependencies.prisma.games = [
      game({
        ecpmAutoSyncEnabled: true,
        ecpmAutoSyncIntervalHours: 1,
        ecpmAutoSyncNextRunAt: new Date('2026-05-08T05:59:00.000Z'),
      }),
    ];
    const service = createService(dependencies);

    await expect(service.runDueSyncsOnce()).resolves.toBeUndefined();

    expect(dependencies.prisma.updates).toEqual([
      {
        data: {
          ecpmAutoSyncLastRunAt: now,
          ecpmAutoSyncNextRunAt: new Date('2026-05-08T07:00:00.000Z'),
        },
        where: { id: 'game-1' },
      },
    ]);
  });
});

const now = new Date('2026-05-08T06:00:00.000Z');

function createService(dependencies: ReturnType<typeof createDependencies>) {
  return new KuaishouEcpmSchedulerService(
    dependencies.prisma as any,
    dependencies.rangeSyncService as any,
    dependencies.syncJobService as any,
    () => now,
  );
}

function game(overrides: Partial<any> = {}) {
  return {
    id: 'game-1',
    deletedAt: null,
    ecpmAutoSyncEnabled: false,
    ecpmAutoSyncIntervalHours: 3,
    ecpmAutoSyncNextRunAt: null,
    gameAppId: 'ks_game_001',
    ...overrides,
  };
}

function createDependencies() {
  const dependencies = {
    prisma: {
      games: [] as any[],
      updates: [] as any[],
      game: {
        findMany: async ({ where }: any) =>
          dependencies.prisma.games.filter(
            (row) =>
              row.deletedAt === where.deletedAt &&
              row.ecpmAutoSyncEnabled === where.ecpmAutoSyncEnabled &&
              row.ecpmAutoSyncNextRunAt <= where.ecpmAutoSyncNextRunAt.lte,
          ),
        update: async (args: any) => {
          dependencies.prisma.updates.push(args);
          return args;
        },
      },
    },
    rangeSyncService: {
      refreshRange: jest.fn(async () => ({ savedCount: 1 })),
    },
    syncJobService: {
      hasRunningJob: jest.fn(async () => false),
    },
  };
  return dependencies;
}
```

- [ ] **Step 2: Run scheduler test to verify it fails**

Run:

```bash
pnpm --filter api test -- kuaishou-ecpm-scheduler.service.spec.ts
```

Expected: fail because scheduler service does not exist.

- [ ] **Step 3: Implement scheduler service**

Create `apps/api/src/features/kuaishou-admin/kuaishou-ecpm-scheduler.service.ts`:

```ts
import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { KuaishouEcpmSyncJobService } from './kuaishou-ecpm-sync-job.service';
import { KuaishouEcpmRangeSyncService } from './kuaishou-ecpm-range-sync.service';

export const KUAISHOU_ECPM_SCHEDULER_NOW = Symbol('KUAISHOU_ECPM_SCHEDULER_NOW');
const CHECK_INTERVAL_MS = 60_000;

type SchedulerPrisma = Pick<PrismaService, 'game'>;

@Injectable()
export class KuaishouEcpmSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KuaishouEcpmSchedulerService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    @Inject(PrismaService) private readonly prisma: SchedulerPrisma,
    private readonly rangeSyncService: KuaishouEcpmRangeSyncService,
    private readonly syncJobService: KuaishouEcpmSyncJobService,
    @Optional()
    @Inject(KUAISHOU_ECPM_SCHEDULER_NOW)
    private readonly nowProvider?: () => Date,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.runDueSyncsOnce();
    }, CHECK_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async runDueSyncsOnce() {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      const now = this.now();
      const games = await this.prisma.game.findMany({
        where: {
          deletedAt: null,
          ecpmAutoSyncEnabled: true,
          ecpmAutoSyncNextRunAt: {
            lte: now,
          },
        },
      });

      for (const game of games) {
        await this.runGameSync(game, now);
      }
    } finally {
      this.running = false;
    }
  }

  private async runGameSync(
    game: {
      ecpmAutoSyncIntervalHours: number;
      gameAppId: string;
      id: string;
    },
    now: Date,
  ) {
    const nextRunAt = addHours(now, game.ecpmAutoSyncIntervalHours);
    if (await this.syncJobService.hasRunningJob(game.gameAppId)) {
      await this.prisma.game.update({
        data: {
          ecpmAutoSyncNextRunAt: nextRunAt,
        },
        where: {
          id: game.id,
        },
      });
      return;
    }

    try {
      await this.rangeSyncService.refreshRange({
        actorId: 'system',
        actorType: 'SYSTEM',
        gameAppId: game.gameAppId,
        lookbackHours: game.ecpmAutoSyncIntervalHours,
        markTokenError: false,
      });
    } catch (error) {
      this.logger.warn(
        `Automatic Kuaishou ECPM sync failed for ${game.gameAppId}: ${readErrorMessage(error)}`,
      );
    }

    await this.prisma.game.update({
      data: {
        ecpmAutoSyncLastRunAt: now,
        ecpmAutoSyncNextRunAt: nextRunAt,
      },
      where: {
        id: game.id,
      },
    });
  }

  private now() {
    return this.nowProvider?.() ?? new Date();
  }
}

function addHours(value: Date, hours: number) {
  return new Date(value.getTime() + hours * 60 * 60 * 1000);
}

function readErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'unknown error';
}
```

- [ ] **Step 4: Register scheduler**

In `apps/api/src/features/kuaishou-admin/kuaishou-refresh.module.ts`:

```ts
import { KuaishouEcpmSchedulerService } from './kuaishou-ecpm-scheduler.service';

@Module({
  controllers: [KuaishouRefreshController, KuaishouTokenController],
  imports: [AdminAuthModule, AuditLogModule, DemoModule, KuaishouModule],
  providers: [
    KuaishouEcpmRangeSyncService,
    KuaishouEcpmSchedulerService,
    KuaishouEcpmSyncJobService,
  ],
})
export class KuaishouRefreshModule {}
```

- [ ] **Step 5: Run scheduler tests**

Run:

```bash
pnpm --filter api test -- kuaishou-ecpm-scheduler.service.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit scheduler**

Run:

```bash
git add apps/api/src/features/kuaishou-admin/kuaishou-ecpm-scheduler.service.ts apps/api/src/features/kuaishou-admin/kuaishou-ecpm-scheduler.service.spec.ts apps/api/src/features/kuaishou-admin/kuaishou-refresh.module.ts
git commit -m "feat(api): add ecpm auto sync scheduler"
```

---

## Task 6: Web API Types And Client

**Files:**
- Modify: `apps/web/src/types/api.ts`
- Modify: `apps/web/src/lib/aiKsApi.ts`
- Modify: `apps/web/src/lib/aiKsApi.test.ts`

- [ ] **Step 1: Write failing web API tests**

In `apps/web/src/lib/aiKsApi.test.ts`, update the refresh test or add:

```ts
it('refreshes kuaishou ecpm with a preset lookback range', async () => {
  mockJsonResponse({
    job: {} as KuaishouEcpmSyncJob,
    requestedOpenIds: [],
    rows: [],
    savedCount: 0,
    source: 'mock',
  });

  await aiKsApi.refreshEcpm('admin-token', 'game-1', 6);

  expect(globalThis.fetch).toHaveBeenCalledWith(
    `${API_BASE_URL}/admin/kuaishou/ecpm/refresh`,
    expect.objectContaining({
      body: JSON.stringify({
        gameAppId: 'game-1',
        lookbackHours: 6,
      }),
    }),
  );
});

it('loads kuaishou ecpm sync jobs filtered by game app id', async () => {
  mockJsonResponse({ jobs: [] });

  await aiKsApi.getKuaishouEcpmJobs('admin-token', 20, 'game 1');

  expect(globalThis.fetch).toHaveBeenCalledWith(
    `${API_BASE_URL}/admin/kuaishou/ecpm/jobs?limit=20&gameAppId=game%201`,
    expect.anything(),
  );
});

it('updates admin game auto sync config fields', async () => {
  mockJsonResponse({ game: {} as AdminGame });

  await aiKsApi.updateAdminGame('admin-token', 'game-1', {
    ecpmAutoSyncEnabled: true,
    ecpmAutoSyncIntervalHours: 3,
  });

  expect(globalThis.fetch).toHaveBeenCalledWith(
    `${API_BASE_URL}/admin/games/game-1`,
    expect.objectContaining({
      body: JSON.stringify({
        ecpmAutoSyncEnabled: true,
        ecpmAutoSyncIntervalHours: 3,
      }),
    }),
  );
});
```

- [ ] **Step 2: Run web API tests to verify they fail**

Run:

```bash
pnpm --filter web test -- aiKsApi.test.ts
```

Expected: fail because client signatures and types do not include the new fields.

- [ ] **Step 3: Extend frontend types**

In `apps/web/src/types/api.ts`, add:

```ts
export type EcpmLookbackHours = 1 | 3 | 6 | 12 | 24;
```

Extend `KuaishouEcpmSyncJob`:

```ts
endedDataHour: string | null;
lookbackHours: number | null;
startedDataHour: string | null;
```

Extend `AdminGame`:

```ts
ecpmAutoSyncEnabled: boolean;
ecpmAutoSyncIntervalHours: EcpmLookbackHours;
ecpmAutoSyncLastRunAt: string | null;
ecpmAutoSyncNextRunAt: string | null;
```

- [ ] **Step 4: Extend frontend API client**

In `apps/web/src/lib/aiKsApi.ts`, import `EcpmLookbackHours`.

Update `updateAdminGame` payload:

```ts
payload: {
  ecpmAutoSyncEnabled?: boolean;
  ecpmAutoSyncIntervalHours?: EcpmLookbackHours;
  gameSecret?: string;
  name?: string;
  settlementPaused?: boolean;
},
```

Update `refreshEcpm`:

```ts
refreshEcpm(
  adminAccessToken: string,
  gameAppId: string,
  lookbackHours: EcpmLookbackHours = 1,
) {
  return requestJson<EcpmRefreshResult>('/admin/kuaishou/ecpm/refresh', {
    accessToken: adminAccessToken,
    body: { gameAppId, lookbackHours },
    method: 'POST',
  });
},
```

Update `getKuaishouEcpmJobs`:

```ts
getKuaishouEcpmJobs(
  adminAccessToken: string,
  limit = 20,
  gameAppId?: string,
) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (gameAppId) {
    params.set('gameAppId', gameAppId);
  }

  return requestJson<KuaishouEcpmSyncJobListResult>(
    `/admin/kuaishou/ecpm/jobs?${params.toString()}`,
    {
      accessToken: adminAccessToken,
    },
  );
},
```

- [ ] **Step 5: Run web API tests**

Run:

```bash
pnpm --filter web test -- aiKsApi.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit web API client**

Run:

```bash
git add apps/web/src/types/api.ts apps/web/src/lib/aiKsApi.ts apps/web/src/lib/aiKsApi.test.ts
git commit -m "feat(web): add game ecpm config api client"
```

---

## Task 7: App State And Handlers For Game Config

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/pages/pages.test.tsx`

- [ ] **Step 1: Write failing App-level UI tests**

In `apps/web/src/pages/pages.test.tsx`, update `adminGame` with:

```ts
ecpmAutoSyncEnabled: false,
ecpmAutoSyncIntervalHours: 3,
ecpmAutoSyncLastRunAt: null,
ecpmAutoSyncNextRunAt: null,
```

Update `kuaishouEcpmJob` with:

```ts
endedDataHour: '2026-05-08T02:00:00+08:00',
lookbackHours: 3,
startedDataHour: '2026-05-08T00:00:00+08:00',
```

Extend `operationsWorkspaceProps` with new props:

```ts
configBudgetAmountYuan: '',
configBudgetReason: '',
configEcpmLookbackHours: 3,
configGameDraft: undefined,
configSection: 'basic',
selectedConfigGameId: '',
onCloseGameConfig: () => undefined,
onConfigBudgetAmountChange: () => undefined,
onConfigBudgetReasonChange: () => undefined,
onConfigEcpmLookbackHoursChange: () => undefined,
onConfigGameDraftChange: () => undefined,
onConfigSectionChange: () => undefined,
onOpenGameConfig: () => undefined,
onRefreshConfigGameEcpm: () => undefined,
onSaveGameConfig: () => undefined,
onSubmitConfigBudget: () => undefined,
```

Add tests:

```tsx
it('renders game config entry buttons from the admin game list', () => {
  const html = renderToStaticMarkup(
    <OperationsWorkspace
      {...operationsWorkspaceProps({
        adminGames: [adminGame],
      })}
    />,
  );

  expect(html).toContain('配置');
  expect(html).toContain('Runner');
});

it('renders selected game config modules', () => {
  const html = renderToStaticMarkup(
    <OperationsWorkspace
      {...operationsWorkspaceProps({
        adminGames: [adminGame],
        configGameDraft: {
          ecpmAutoSyncEnabled: false,
          ecpmAutoSyncIntervalHours: 3,
          gameSecret: 'secret-1',
          name: 'Runner',
          settlementPaused: true,
        },
        selectedConfigGameId: 'game-1',
      })}
    />,
  );

  expect(html).toContain('游戏配置');
  expect(html).toContain('基础信息');
  expect(html).toContain('预算与结算');
  expect(html).toContain('ECPM 同步');
  expect(html).toContain('审计/任务历史');
  expect(html).toContain('默认关闭');
  expect(html).toContain('失败不会自动重试');
});
```

- [ ] **Step 2: Run page tests to verify they fail**

Run:

```bash
pnpm --filter web test -- pages.test.tsx
```

Expected: fail because the workspace props and UI do not exist yet.

- [ ] **Step 3: Add App state types and defaults**

In `apps/web/src/App.tsx`, import `EcpmLookbackHours`.

Add a draft type near state helpers:

```ts
type GameConfigSection = 'audit' | 'basic' | 'budget' | 'ecpm';

type GameConfigDraft = {
  ecpmAutoSyncEnabled: boolean;
  ecpmAutoSyncIntervalHours: EcpmLookbackHours;
  gameSecret: string;
  name: string;
  settlementPaused: boolean;
};

const ECPM_LOOKBACK_OPTIONS: EcpmLookbackHours[] = [1, 3, 6, 12, 24];
```

Add state near existing admin game state:

```ts
const [selectedConfigGameId, setSelectedConfigGameId] = useState('');
const [configSection, setConfigSection] = useState<GameConfigSection>('basic');
const [configGameDraft, setConfigGameDraft] = useState<GameConfigDraft>();
const [configBudgetAmountYuan, setConfigBudgetAmountYuan] = useState('');
const [configBudgetReason, setConfigBudgetReason] = useState('');
const [configEcpmLookbackHours, setConfigEcpmLookbackHours] =
  useState<EcpmLookbackHours>(3);
```

Add memo:

```ts
const selectedConfigGame = useMemo(
  () => adminGames.find((game) => game.id === selectedConfigGameId),
  [adminGames, selectedConfigGameId],
);
```

- [ ] **Step 4: Add draft helpers**

In `apps/web/src/App.tsx`, add:

```ts
function buildGameConfigDraft(game: AdminGame): GameConfigDraft {
  return {
    ecpmAutoSyncEnabled: game.ecpmAutoSyncEnabled,
    ecpmAutoSyncIntervalHours: game.ecpmAutoSyncIntervalHours,
    gameSecret: game.gameSecret,
    name: game.name,
    settlementPaused: game.settlementPaused,
  };
}

function openGameConfig(gameId: string) {
  const game = adminGames.find((row) => row.id === gameId);
  if (!game) {
    setError('未找到游戏配置');
    return;
  }

  setSelectedConfigGameId(game.id);
  setConfigSection('basic');
  setConfigGameDraft(buildGameConfigDraft(game));
  void loadKuaishouEcpmJobsForToken(adminAccessToken, undefined, {
    gameAppId: game.gameAppId,
    reportError: false,
  });
}

function closeGameConfig() {
  setSelectedConfigGameId('');
  setConfigGameDraft(undefined);
  setConfigBudgetAmountYuan('');
  setConfigBudgetReason('');
}

function changeConfigGameDraft(patch: Partial<GameConfigDraft>) {
  setConfigGameDraft((current) => (current ? { ...current, ...patch } : current));
}
```

Update `loadKuaishouEcpmJobsForToken` options:

```ts
options: { gameAppId?: string; reportError?: boolean } = {},
```

and call:

```ts
const result = await aiKsApi.getKuaishouEcpmJobs(
  token,
  20,
  options.gameAppId,
);
```

- [ ] **Step 5: Add config action handlers**

In `apps/web/src/App.tsx`, add:

```ts
async function saveGameConfig() {
  if (!adminAccessToken) {
    setError('请先登录管理员账号');
    return;
  }
  if (!selectedConfigGame || !configGameDraft) {
    setError('请选择游戏配置');
    return;
  }

  await runAction('game-config', async (isCurrent) => {
    const result = await aiKsApi.updateAdminGame(
      adminAccessToken,
      selectedConfigGame.id,
      configGameDraft,
    );
    if (!isCurrent()) {
      return;
    }

    await loadAdminResourcesForToken(adminAccessToken, isCurrent);
    if (!isCurrent()) {
      return;
    }

    setConfigGameDraft(buildGameConfigDraft(result.game));
    setNotice('游戏配置已保存');
  }, 'admin');
}

async function submitConfigBudget() {
  if (!adminAccessToken) {
    setError('请先登录管理员账号');
    return;
  }
  if (!selectedConfigGame || !configBudgetAmountYuan.trim()) {
    setError('请选择游戏并填写分配金额');
    return;
  }

  await runAction('game-config-budget', async (isCurrent) => {
    await aiKsApi.allocateGameBudget(adminAccessToken, selectedConfigGame.id, {
      amountYuan: configBudgetAmountYuan,
      reason: configBudgetReason,
    });
    if (!isCurrent()) {
      return;
    }

    setConfigBudgetAmountYuan('');
    await loadAdminResourcesForToken(adminAccessToken, isCurrent);
    if (!isCurrent()) {
      return;
    }

    setNotice('游戏预算已分配');
  }, 'admin');
}

async function refreshConfigGameEcpm() {
  if (!adminAccessToken) {
    setError('请先登录管理员账号');
    return;
  }
  if (!selectedConfigGame) {
    setError('请选择游戏配置');
    return;
  }

  await runAction('game-config-ecpm-refresh', async (isCurrent) => {
    const result = await aiKsApi.refreshEcpm(
      adminAccessToken,
      selectedConfigGame.gameAppId,
      configEcpmLookbackHours,
    );
    if (!isCurrent()) {
      return;
    }

    setRefreshResult(result);
    await loadKuaishouEcpmJobsForToken(adminAccessToken, isCurrent, {
      gameAppId: selectedConfigGame.gameAppId,
      reportError: false,
    });
    if (!isCurrent()) {
      return;
    }

    setNotice('游戏 ECPM 已刷新');
  }, 'admin');
}
```

Extend `BusyAction` union and `operationsBusyAction` with:

```ts
| 'game-config'
| 'game-config-budget'
| 'game-config-ecpm-refresh'
```

- [ ] **Step 6: Pass props to OperationsWorkspace**

In the `OperationsWorkspace` JSX props, add:

```tsx
configBudgetAmountYuan={configBudgetAmountYuan}
configBudgetReason={configBudgetReason}
configEcpmLookbackHours={configEcpmLookbackHours}
configGameDraft={configGameDraft}
configSection={configSection}
selectedConfigGameId={selectedConfigGameId}
onCloseGameConfig={closeGameConfig}
onConfigBudgetAmountChange={setConfigBudgetAmountYuan}
onConfigBudgetReasonChange={setConfigBudgetReason}
onConfigEcpmLookbackHoursChange={setConfigEcpmLookbackHours}
onConfigGameDraftChange={changeConfigGameDraft}
onConfigSectionChange={setConfigSection}
onOpenGameConfig={openGameConfig}
onRefreshConfigGameEcpm={refreshConfigGameEcpm}
onSaveGameConfig={saveGameConfig}
onSubmitConfigBudget={submitConfigBudget}
```

- [ ] **Step 7: Run TypeScript via web test**

Run:

```bash
pnpm --filter web test -- pages.test.tsx
```

Expected: still fail until `OperationsWorkspace` props and UI are implemented in Task 8.

- [ ] **Step 8: Commit App state after Task 8 passes**

Do not commit at this point if TypeScript fails. Commit this task together with Task 8 when page tests pass.

---

## Task 8: Game Config UI

**Files:**
- Modify: `apps/web/src/pages/OperationsWorkspace.tsx`
- Modify: `apps/web/src/pages/pages.test.tsx`
- Modify: `apps/web/src/styles.css`

- [ ] **Step 1: Extend OperationsWorkspace props and busy actions**

In `OperationsWorkspaceBusyAction`, add:

```ts
| 'game-config'
| 'game-config-budget'
| 'game-config-ecpm-refresh'
```

Add local types:

```ts
type GameConfigSection = 'audit' | 'basic' | 'budget' | 'ecpm';

type GameConfigDraft = {
  ecpmAutoSyncEnabled: boolean;
  ecpmAutoSyncIntervalHours: 1 | 3 | 6 | 12 | 24;
  gameSecret: string;
  name: string;
  settlementPaused: boolean;
};
```

Extend `OperationsWorkspaceProps`:

```ts
configBudgetAmountYuan: string;
configBudgetReason: string;
configEcpmLookbackHours: 1 | 3 | 6 | 12 | 24;
configGameDraft?: GameConfigDraft;
configSection: GameConfigSection;
selectedConfigGameId: string;
onCloseGameConfig(): void;
onConfigBudgetAmountChange(value: string): void;
onConfigBudgetReasonChange(value: string): void;
onConfigEcpmLookbackHoursChange(value: 1 | 3 | 6 | 12 | 24): void;
onConfigGameDraftChange(patch: Partial<GameConfigDraft>): void;
onConfigSectionChange(value: GameConfigSection): void;
onOpenGameConfig(gameId: string): void;
onRefreshConfigGameEcpm(): void;
onSaveGameConfig(): void;
onSubmitConfigBudget(): void;
```

Destructure these props in the component.

- [ ] **Step 2: Add helper functions**

Add helpers below `formatTokenDate`:

```ts
const ECPM_LOOKBACK_OPTIONS = [1, 3, 6, 12, 24] as const;

function formatDateTime(value?: string | null) {
  if (!value) {
    return '-';
  }

  return value.replace('T', ' ').slice(0, 16);
}

function formatSyncRange(job: KuaishouEcpmSyncJob) {
  if (job.startedDataHour && job.endedDataHour) {
    return `${job.startedDataHour} ~ ${job.endedDataHour}`;
  }

  return job.dataHour;
}

function parseEcpmLookback(value: string): 1 | 3 | 6 | 12 | 24 {
  const parsed = Number(value);
  return ECPM_LOOKBACK_OPTIONS.includes(parsed as 1 | 3 | 6 | 12 | 24)
    ? (parsed as 1 | 3 | 6 | 12 | 24)
    : 3;
}
```

- [ ] **Step 3: Add config buttons to game table**

In the admin game table header, add:

```tsx
<th>操作</th>
```

In each game row, add:

```tsx
<td>
  <Button
    compact
    disabled={workspaceBusy}
    onClick={() => onOpenGameConfig(game.id)}
    variant="secondary"
  >
    配置
  </Button>
</td>
```

Change the empty row `colSpan` from `5` to `6`.

- [ ] **Step 4: Render selected game config view**

Add this block after the budget management panel:

```tsx
{selectedConfigGameId && configGameDraft ? (
  <GameConfigView
    busyAction={busyAction}
    configBudgetAmountYuan={configBudgetAmountYuan}
    configBudgetReason={configBudgetReason}
    configEcpmLookbackHours={configEcpmLookbackHours}
    configGameDraft={configGameDraft}
    configSection={configSection}
    game={adminGames.find((row) => row.id === selectedConfigGameId)}
    jobs={kuaishouEcpmJobs}
    workspaceBusy={workspaceBusy}
    onClose={onCloseGameConfig}
    onConfigBudgetAmountChange={onConfigBudgetAmountChange}
    onConfigBudgetReasonChange={onConfigBudgetReasonChange}
    onConfigEcpmLookbackHoursChange={onConfigEcpmLookbackHoursChange}
    onConfigGameDraftChange={onConfigGameDraftChange}
    onConfigSectionChange={onConfigSectionChange}
    onRefreshConfigGameEcpm={onRefreshConfigGameEcpm}
    onSaveGameConfig={onSaveGameConfig}
    onSubmitConfigBudget={onSubmitConfigBudget}
  />
) : null}
```

- [ ] **Step 5: Add `GameConfigView` component**

Append this component before exported helper functions at the bottom of `OperationsWorkspace.tsx`:

```tsx
function GameConfigView({
  busyAction,
  configBudgetAmountYuan,
  configBudgetReason,
  configEcpmLookbackHours,
  configGameDraft,
  configSection,
  game,
  jobs,
  workspaceBusy,
  onClose,
  onConfigBudgetAmountChange,
  onConfigBudgetReasonChange,
  onConfigEcpmLookbackHoursChange,
  onConfigGameDraftChange,
  onConfigSectionChange,
  onRefreshConfigGameEcpm,
  onSaveGameConfig,
  onSubmitConfigBudget,
}: {
  busyAction: OperationsWorkspaceBusyAction;
  configBudgetAmountYuan: string;
  configBudgetReason: string;
  configEcpmLookbackHours: 1 | 3 | 6 | 12 | 24;
  configGameDraft: GameConfigDraft;
  configSection: GameConfigSection;
  game?: AdminGame;
  jobs: KuaishouEcpmSyncJob[];
  workspaceBusy: boolean;
  onClose(): void;
  onConfigBudgetAmountChange(value: string): void;
  onConfigBudgetReasonChange(value: string): void;
  onConfigEcpmLookbackHoursChange(value: 1 | 3 | 6 | 12 | 24): void;
  onConfigGameDraftChange(patch: Partial<GameConfigDraft>): void;
  onConfigSectionChange(value: GameConfigSection): void;
  onRefreshConfigGameEcpm(): void;
  onSaveGameConfig(): void;
  onSubmitConfigBudget(): void;
}) {
  if (!game) {
    return null;
  }

  const sectionLabel = {
    audit: '审计/任务历史',
    basic: '基础信息',
    budget: '预算与结算',
    ecpm: 'ECPM 同步',
  } satisfies Record<GameConfigSection, string>;

  return (
    <section className="game-config-shell" aria-label="游戏配置">
      <aside className="game-config-nav">
        <div className="game-config-title">
          <strong>{game.name}</strong>
          <span>{game.gameAppId}</span>
        </div>
        {(['basic', 'budget', 'ecpm', 'audit'] as GameConfigSection[]).map(
          (section) => (
            <button
              className={
                section === configSection
                  ? 'game-config-nav-item active'
                  : 'game-config-nav-item'
              }
              key={section}
              onClick={() => onConfigSectionChange(section)}
              type="button"
            >
              {sectionLabel[section]}
            </button>
          ),
        )}
        <Button compact onClick={onClose} variant="ghost">
          返回列表
        </Button>
      </aside>
      <div className="game-config-content">
        <header className="game-config-header">
          <div>
            <p>游戏配置</p>
            <h2>{sectionLabel[configSection]}</h2>
            <span>
              {game.companyName} / {game.gameAppId}
            </span>
          </div>
          <StatusBadge tone={game.settlementPaused ? 'warning' : 'success'}>
            {game.settlementPaused ? '已暂停结算' : '可结算'}
          </StatusBadge>
        </header>
        {configSection === 'basic' ? (
          <Panel description="修改会影响后续游戏端登录校验" title="基础信息">
            <InputField
              disabled={workspaceBusy}
              helper="用于后台识别该游戏，保存后列表同步更新。"
              label="游戏名称"
              onChange={(value) => onConfigGameDraftChange({ name: value })}
              value={configGameDraft.name}
            />
            <InputField
              disabled
              helper="快手小游戏 AppID 只读展示，不允许在配置页迁移。"
              label="game_app_id"
              value={game.gameAppId}
            />
            <InputField
              disabled={workspaceBusy}
              helper="用于游戏端登录校验和相关服务端校验。"
              label="game_secret"
              onChange={(value) => onConfigGameDraftChange({ gameSecret: value })}
              value={configGameDraft.gameSecret}
            />
            <Button
              disabled={workspaceBusy || !configGameDraft.name || !configGameDraft.gameSecret}
              onClick={onSaveGameConfig}
            >
              {busyAction === 'game-config' ? '保存中' : '保存基础信息'}
            </Button>
          </Panel>
        ) : null}
        {configSection === 'budget' ? (
          <Panel description="预算影响结算确认，暂停后不能确认新的结算批次" title="预算与结算">
            <ReadoutGrid
              items={[
                { label: '当前预算', value: formatMoney(game.budget) },
                { label: '所属公司', value: game.companyName || '-' },
                { label: '结算状态', value: game.settlementPaused ? '已暂停' : '可结算' },
              ]}
            />
            <label className="settings-row">
              <span>
                <strong>结算暂停</strong>
                <small>开启后，该游戏不能确认新的结算批次。</small>
              </span>
              <input
                checked={configGameDraft.settlementPaused}
                disabled={workspaceBusy}
                onChange={(event) =>
                  onConfigGameDraftChange({
                    settlementPaused: event.currentTarget.checked,
                  })
                }
                type="checkbox"
              />
            </label>
            <div className="query-form">
              <InputField
                disabled={workspaceBusy}
                label="分配金额"
                onChange={onConfigBudgetAmountChange}
                placeholder="例如 50.00"
                value={configBudgetAmountYuan}
              />
              <InputField
                disabled={workspaceBusy}
                label="分配原因"
                onChange={onConfigBudgetReasonChange}
                placeholder="可选"
                value={configBudgetReason}
              />
              <Button
                disabled={workspaceBusy || !configBudgetAmountYuan.trim()}
                onClick={onSubmitConfigBudget}
                variant="secondary"
              >
                {busyAction === 'game-config-budget' ? '提交中' : '分配预算'}
              </Button>
            </div>
            <Button disabled={workspaceBusy} onClick={onSaveGameConfig}>
              {busyAction === 'game-config' ? '保存中' : '保存结算配置'}
            </Button>
          </Panel>
        ) : null}
        {configSection === 'ecpm' ? (
          <Panel description="默认关闭；管理员开启后才会自动同步" title="ECPM 同步">
            <label className="settings-row">
              <span>
                <strong>自动同步</strong>
                <small>开启后，系统会按所选频率同步最近一个频率窗口内的 ECPM 数据。</small>
              </span>
              <input
                checked={configGameDraft.ecpmAutoSyncEnabled}
                disabled={workspaceBusy}
                onChange={(event) =>
                  onConfigGameDraftChange({
                    ecpmAutoSyncEnabled: event.currentTarget.checked,
                  })
                }
                type="checkbox"
              />
            </label>
            <label className="ui-input-field">
              <span className="ui-input-label">自动同步频率</span>
              <span className="ui-input-control">
                <select
                  disabled={workspaceBusy}
                  onChange={(event) =>
                    onConfigGameDraftChange({
                      ecpmAutoSyncIntervalHours: parseEcpmLookback(
                        event.currentTarget.value,
                      ),
                    })
                  }
                  value={configGameDraft.ecpmAutoSyncIntervalHours}
                >
                  {ECPM_LOOKBACK_OPTIONS.map((hours) => (
                    <option key={hours} value={hours}>
                      {hours} 小时
                    </option>
                  ))}
                </select>
              </span>
              <span className="ui-input-message">
                例如频率为 3 小时，则每次自动同步只处理最近 3 小时。失败不会自动重试。
              </span>
            </label>
            <ReadoutGrid
              items={[
                { label: '下次执行', value: formatDateTime(game.ecpmAutoSyncNextRunAt) },
                { label: '最近执行', value: formatDateTime(game.ecpmAutoSyncLastRunAt) },
                { label: '默认状态', value: game.ecpmAutoSyncEnabled ? '已开启' : '默认关闭' },
              ]}
            />
            <div className="query-form">
              <label className="ui-input-field">
                <span className="ui-input-label">手动刷新范围</span>
                <span className="ui-input-control">
                  <select
                    disabled={workspaceBusy}
                    onChange={(event) =>
                      onConfigEcpmLookbackHoursChange(
                        parseEcpmLookback(event.currentTarget.value),
                      )
                    }
                    value={configEcpmLookbackHours}
                  >
                    {ECPM_LOOKBACK_OPTIONS.map((hours) => (
                      <option key={hours} value={hours}>
                        最近 {hours} 小时
                      </option>
                    ))}
                  </select>
                </span>
              </label>
              <Button
                disabled={workspaceBusy}
                icon={<RefreshCw size={16} />}
                onClick={onRefreshConfigGameEcpm}
                variant="secondary"
              >
                {busyAction === 'game-config-ecpm-refresh' ? '刷新中' : '手动刷新'}
              </Button>
            </div>
            <Button disabled={workspaceBusy} onClick={onSaveGameConfig}>
              {busyAction === 'game-config' ? '保存中' : '保存同步配置'}
            </Button>
          </Panel>
        ) : null}
        {configSection === 'audit' ? (
          <Panel description="失败任务不自动处理，由管理员查看后手动刷新补处理" title="审计/任务历史">
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>任务</th>
                    <th>状态</th>
                    <th>范围</th>
                    <th>open_id</th>
                    <th>写入</th>
                    <th>错误</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs
                    .filter((job) => job.gameAppId === game.gameAppId)
                    .map((job) => (
                      <tr key={job.id}>
                        <td>{job.id}</td>
                        <td>
                          <StatusBadge tone={syncJobTone(job.status)}>
                            {job.status}
                          </StatusBadge>
                        </td>
                        <td>{formatSyncRange(job)}</td>
                        <td>{job.requestedOpenIdCount}</td>
                        <td>{job.savedCount}</td>
                        <td>{job.errorMessage ?? '-'}</td>
                      </tr>
                    ))}
                  {jobs.filter((job) => job.gameAppId === game.gameAppId).length === 0 ? (
                    <tr>
                      <td colSpan={6}>暂无同步任务</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Panel>
        ) : null}
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Add styles**

In `apps/web/src/styles.css`, add before media queries:

```css
.game-config-shell {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  gap: 16px;
  min-width: 0;
}

.game-config-nav,
.game-config-content {
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
}

.game-config-nav {
  display: grid;
  align-content: start;
  gap: 8px;
  padding: 12px;
}

.game-config-title {
  display: grid;
  gap: 4px;
  border-bottom: 1px solid var(--border);
  padding: 4px 4px 12px;
}

.game-config-title strong,
.game-config-title span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.game-config-title span {
  color: var(--muted);
  font-size: 12px;
}

.game-config-nav-item {
  width: 100%;
  min-height: 38px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--foreground);
  padding: 8px 10px;
  text-align: left;
  cursor: pointer;
}

.game-config-nav-item:hover {
  border-color: var(--border);
  background: var(--surface-soft);
}

.game-config-nav-item.active {
  border-color: rgba(204, 120, 92, 0.32);
  background: var(--primary-soft);
  color: var(--primary-hover);
  font-weight: 650;
}

.game-config-content {
  display: grid;
  gap: 14px;
  padding: 16px;
}

.game-config-header {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.game-config-header p,
.game-config-header h2,
.game-config-header span {
  margin: 0;
}

.game-config-header p,
.game-config-header span {
  color: var(--muted);
  font-size: 13px;
}

.game-config-header h2 {
  margin-top: 2px;
  overflow-wrap: anywhere;
  font-size: 20px;
  font-weight: 650;
}

.settings-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-soft);
  padding: 12px;
}

.settings-row span {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.settings-row strong,
.settings-row small {
  min-width: 0;
  overflow-wrap: anywhere;
}

.settings-row small {
  color: var(--muted);
  font-size: 12px;
}

.settings-row input[type='checkbox'] {
  width: 18px;
  height: 18px;
  accent-color: var(--primary);
}
```

Inside `@media (max-width: 1120px)`, add:

```css
.game-config-shell {
  grid-template-columns: 1fr;
}
```

- [ ] **Step 7: Run page tests**

Run:

```bash
pnpm --filter web test -- pages.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit App and UI together**

Run:

```bash
git add apps/web/src/App.tsx apps/web/src/pages/OperationsWorkspace.tsx apps/web/src/pages/pages.test.tsx apps/web/src/styles.css
git commit -m "feat(web): add game config workspace"
```

---

## Task 9: End-To-End Verification

**Files:**
- Read: all changed files from previous tasks.

- [ ] **Step 1: Generate and validate Prisma**

Run:

```bash
pnpm --filter api prisma:generate
pnpm --filter api prisma:validate
```

Expected: both commands exit 0.

- [ ] **Step 2: Run backend tests and build**

Run:

```bash
pnpm --filter api test
pnpm --filter api build
```

Expected: both commands exit 0.

- [ ] **Step 3: Run frontend tests, lint, and build**

Run:

```bash
pnpm --filter web test
pnpm --filter web lint
pnpm --filter web build
```

Expected: all commands exit 0.

- [ ] **Step 4: Manual smoke check with existing dev server**

If the dev server is still running, open `http://localhost:8008/`. Otherwise run:

```bash
pnpm dev
```

Smoke path:

1. Login as admin.
2. Refresh budget/resources.
3. Click a game row `配置`.
4. Confirm left nav shows `基础信息`, `预算与结算`, `ECPM 同步`, `审计/任务历史`.
5. In `ECPM 同步`, enable auto sync and keep frequency at `3 小时`.
6. Save config.
7. Confirm the same view shows next run time.
8. Choose manual refresh `最近 3 小时`.
9. Click manual refresh.
10. Confirm task history shows a range and success or failure state.

- [ ] **Step 5: Final status**

Run:

```bash
git status --short
```

Expected: no uncommitted changes except files intentionally left for the user.
