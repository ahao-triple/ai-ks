# ECPM Operations Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a super-admin ECPM operations center with a left-side business function rail, multi-view ECPM querying, scoped ECPM updates, and detailed update reports.

**Architecture:** Add a focused `ecpm-admin` backend feature for dashboard queries, update orchestration, and report APIs. Reuse the existing game-level `KuaishouEcpmRangeSyncService` for the actual Kuaishou refresh calls, and add aggregate update job tables to represent company, game, user, and open_id level operations. On the web app, add an `EcpmOperationsCenter` page component and replace the current horizontal operations pane nav with an internal left function rail.

**Tech Stack:** NestJS, Prisma, Jest, React, Vite, Vitest, existing `DataTable`, `Panel`, `Button`, `InputField`, and `StatusBadge` components.

---

## File Structure

Create:

- `apps/api/src/features/ecpm-admin/ecpm-admin.module.ts` wires controller and services.
- `apps/api/src/features/ecpm-admin/ecpm-dashboard.service.ts` owns ECPM query aggregation and read-scope filtering.
- `apps/api/src/features/ecpm-admin/ecpm-dashboard.service.spec.ts` covers company, game, user, open_id, latest, and scoped queries.
- `apps/api/src/features/ecpm-admin/ecpm-update-job.service.ts` owns aggregate update job persistence and presentation.
- `apps/api/src/features/ecpm-admin/ecpm-update-job.service.spec.ts` covers job start, item recording, completion, partial failure, detail lookup, and retry lookup.
- `apps/api/src/features/ecpm-admin/ecpm-update-range.service.ts` resolves update scopes and delegates game/open_id batches to `KuaishouEcpmRangeSyncService`.
- `apps/api/src/features/ecpm-admin/ecpm-update-range.service.spec.ts` covers company, game, user, open_id, latest hour, explicit hour range, empty scope, and partial failure.
- `apps/api/src/features/ecpm-admin/ecpm-admin.controller.ts` exposes `/admin/ecpm/*` routes.
- `apps/api/src/features/ecpm-admin/ecpm-admin.controller.spec.ts` covers request parsing, permissions, query delegation, update delegation, and report endpoints.
- `apps/web/src/pages/EcpmOperationsCenter.tsx` renders data, update, and report tabs.
- `apps/web/src/pages/EcpmOperationsCenter.test.tsx` covers default latest view, update form modes, report rendering, and disabled update controls for company admins.

Modify:

- `apps/api/prisma/schema.prisma` adds aggregate ECPM update job models and a `PARTIAL` capable status enum.
- `apps/api/src/app.module.ts` imports `EcpmAdminModule`.
- `apps/web/src/types/api.ts` adds dashboard, update request, update job, and report types.
- `apps/web/src/lib/aiKsApi.ts` adds ECPM dashboard/update/report client methods.
- `apps/web/src/pages/OperationsWorkspace.tsx` replaces the horizontal operations nav with a business function rail and mounts `EcpmOperationsCenter`.
- `apps/web/src/pages/pages.test.tsx` updates operations navigation expectations.
- `apps/web/src/styles.css` adds the internal operations shell, function rail, and ECPM center styles.
- `apps/web/src/styles.test.ts` adds CSS guard checks for the new function rail.

## Task 1: Add ECPM Update Job Persistence

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add Prisma models and enum**

Add this enum near the existing ECPM job status enum:

```prisma
enum EcpmUpdateJobStatus {
  RUNNING
  SUCCEEDED
  FAILED
  PARTIAL
}
```

Add these relations to `Game` and `UserAccount`:

```prisma
  ecpmUpdateJobItems EcpmUpdateJobItem[]
```

Add these models near `KuaishouEcpmSyncJob`:

```prisma
model EcpmUpdateJob {
  id                   String              @id @default(uuid())
  status               EcpmUpdateJobStatus @default(RUNNING)
  scopeType            String              @map("scope_type")
  scopeId              String              @map("scope_id")
  mode                 String
  startedDataHour      String              @map("started_data_hour")
  endedDataHour        String              @map("ended_data_hour")
  requestedGameCount   Int                 @default(0) @map("requested_game_count")
  requestedOpenIdCount Int                 @default(0) @map("requested_open_id_count")
  savedCount           Int                 @default(0) @map("saved_count")
  failedCount          Int                 @default(0) @map("failed_count")
  skippedCount         Int                 @default(0) @map("skipped_count")
  errorMessage         String?             @map("error_message")
  actorType            String              @map("actor_type")
  actorId              String              @map("actor_id")
  startedAt            DateTime            @default(now()) @map("started_at")
  finishedAt           DateTime?           @map("finished_at")
  createdAt            DateTime            @default(now()) @map("created_at")
  updatedAt            DateTime            @updatedAt @map("updated_at")

  items EcpmUpdateJobItem[]

  @@index([createdAt])
  @@index([scopeType, scopeId])
  @@index([status])
  @@map("ecpm_update_jobs")
}

model EcpmUpdateJobItem {
  id                 String              @id @default(uuid())
  jobId              String              @map("job_id")
  gameId             String?             @map("game_id")
  userId             String?             @map("user_id")
  gameAppId          String?             @map("game_app_id")
  openId             String?             @map("open_id")
  dataHour           String              @map("data_hour")
  status             EcpmUpdateJobStatus
  savedCount         Int                 @default(0) @map("saved_count")
  skipReason         String?             @map("skip_reason")
  errorMessage       String?             @map("error_message")
  kuaishouSyncJobId  String?             @map("kuaishou_sync_job_id")
  createdAt          DateTime            @default(now()) @map("created_at")
  updatedAt          DateTime            @updatedAt @map("updated_at")

  job  EcpmUpdateJob @relation(fields: [jobId], references: [id])
  game Game?         @relation(fields: [gameId], references: [id])
  user UserAccount?  @relation(fields: [userId], references: [id])

  @@index([jobId])
  @@index([gameId])
  @@index([userId])
  @@index([gameAppId, dataHour])
  @@map("ecpm_update_job_items")
}
```

- [ ] **Step 2: Validate Prisma schema**

Run: `pnpm --filter api prisma:validate`

Expected: command exits `0` and includes Prisma schema validation success.

- [ ] **Step 3: Generate Prisma client**

Run: `pnpm --filter api prisma:generate`

Expected: command exits `0` and `@prisma/client` includes `ecpmUpdateJob`, `ecpmUpdateJobItem`, and `EcpmUpdateJobStatus`.

- [ ] **Step 4: Commit persistence changes**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(api): add ecpm update job persistence"
```

## Task 2: Add ECPM Dashboard Query Service

**Files:**
- Create: `apps/api/src/features/ecpm-admin/ecpm-dashboard.service.spec.ts`
- Create: `apps/api/src/features/ecpm-admin/ecpm-dashboard.service.ts`

- [ ] **Step 1: Write failing dashboard query tests**

Create `apps/api/src/features/ecpm-admin/ecpm-dashboard.service.spec.ts` with tests named exactly:

```ts
describe('EcpmDashboardService', () => {
  it('summarizes latest ECPM by company and game for super admins', async () => {});
  it('lists open_id rows for a selected game and hour range', async () => {});
  it('lists rows for a selected user across bound open_ids', async () => {});
  it('lists rows for a selected open_id', async () => {});
  it('returns an empty list when a company admin has no scoped games', async () => {});
  it('filters company-admin queries to scoped game ids', async () => {});
});
```

Use a fake Prisma object with `rawEcpm.groupBy`, `rawEcpm.findMany`, `game.findMany`, and `gameOpenId.findMany` jest functions. The first test must expect a company query response shaped like:

```ts
expect(result).toEqual({
  rows: [
    {
      companyId: 'company-1',
      companyName: 'Company A',
      dataHour: '2026-05-08T14:00:00+08:00',
      displayAmount: { li: '50', yuan: '0.05' },
      eventCount: 2,
      gameAppId: 'game-app-1',
      gameId: 'game-1',
      gameName: 'Game A',
      openIdCount: 2,
      rawCost: { li: '100', yuan: '0.10' },
      updatedAt: '2026-05-08T14:30:00.000Z',
    },
  ],
  scope: 'company',
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm --filter api test -- ecpm-dashboard.service.spec.ts`

Expected: FAIL because `ecpm-dashboard.service.ts` does not exist.

- [ ] **Step 3: Implement dashboard service**

Create `apps/api/src/features/ecpm-admin/ecpm-dashboard.service.ts` with these exports:

```ts
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Prisma, SettlementStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  AdminAccessControlService,
  type AdminReadScope,
} from '../admin-auth/admin-access-control.service';
import type { AdminPrincipal } from '../admin-auth/admin-auth.service';
import { presentMoneyLi } from '../demo/money-presenter';

export type EcpmDashboardScope = 'company' | 'game' | 'latest' | 'open_id' | 'user';

export type EcpmDashboardQueryInput = {
  admin: AdminPrincipal;
  companyId?: string;
  gameId?: string;
  openId?: string;
  page?: number;
  pageSize?: number;
  startedDataHour?: string;
  endedDataHour?: string;
  status?: SettlementStatus;
  userId?: string;
};

@Injectable()
export class EcpmDashboardService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    private readonly accessControlService: AdminAccessControlService,
  ) {}

  async queryCompany(input: EcpmDashboardQueryInput) {
    const scope = await this.accessControlService.resolveReadScope(input.admin);
    const where = this.buildRawEcpmWhere(input, scope);
    const rows = await this.prisma.rawEcpm.findMany({
      include: {
        game: { include: { company: true } },
      },
      orderBy: { eventTime: 'desc' },
      where,
    });
    const grouped = new Map<string, typeof rows>();
    for (const row of rows) {
      const dataHour = toChinaDataHour(row.eventTime);
      const key = `${row.gameId}:${dataHour}`;
      grouped.set(key, [...(grouped.get(key) ?? []), row]);
    }
    return {
      rows: [...grouped.values()].map((group) => {
        const first = group[0]!;
        return {
          companyId: first.game.companyId,
          companyName: first.game.company.name,
          dataHour: toChinaDataHour(first.eventTime),
          displayAmount: presentMoneyLi(sumBigInt(group.map((row) => row.displayAmountLi))),
          eventCount: group.length,
          gameAppId: first.game.gameAppId,
          gameId: first.gameId,
          gameName: first.game.name,
          openIdCount: new Set(group.map((row) => row.openId)).size,
          rawCost: presentMoneyLi(sumBigInt(group.map((row) => row.rawCostLi))),
          updatedAt: latestDate(group.map((row) => row.createdAt)).toISOString(),
        };
      }),
      scope: 'company' as const,
    };
  }

  async queryGame(input: EcpmDashboardQueryInput) {
    return {
      rows: await this.queryRawRows(input),
      scope: 'game' as const,
    };
  }

  async queryUser(input: EcpmDashboardQueryInput) {
    return {
      rows: await this.queryRawRows(input),
      scope: 'user' as const,
    };
  }

  async queryOpenId(input: EcpmDashboardQueryInput) {
    return {
      rows: await this.queryRawRows(input),
      scope: 'open_id' as const,
    };
  }

  async queryLatest(input: EcpmDashboardQueryInput) {
    return {
      rows: await this.queryRawRows({ ...input, startedDataHour: undefined, endedDataHour: undefined }),
      scope: 'latest' as const,
    };
  }

  private async queryRawRows(input: EcpmDashboardQueryInput) {
    const scope = await this.accessControlService.resolveReadScope(input.admin);
    const rows = await this.prisma.rawEcpm.findMany({
      include: {
        game: { include: { company: true } },
        openIdRecord: { include: { user: true } },
      },
      orderBy: { eventTime: 'desc' },
      skip: offset(input),
      take: pageSize(input),
      where: this.buildRawEcpmWhere(input, scope),
    });
    return rows.map((row) => ({
      companyId: row.game.companyId,
      companyName: row.game.company.name,
      dataHour: toChinaDataHour(row.eventTime),
      displayAmount: presentMoneyLi(row.displayAmountLi),
      eventTime: row.eventTime.toISOString(),
      gameAppId: row.game.gameAppId,
      gameId: row.gameId,
      gameName: row.game.name,
      openId: row.openId,
      platformEventId: row.platformEventId,
      rawCost: presentMoneyLi(row.rawCostLi),
      readableId: row.openIdRecord?.readableId ?? null,
      status: row.status,
      userId: row.openIdRecord?.userId ?? null,
      username: row.openIdRecord?.user?.username ?? null,
    }));
  }

  private buildRawEcpmWhere(input: EcpmDashboardQueryInput, scope: AdminReadScope): Prisma.RawEcpmWhereInput {
    const gameIds = scope.isSuperAdmin ? undefined : (scope.gameIds ?? []);
    if (gameIds?.length === 0) {
      return { id: { in: [] } };
    }
    const range = resolveHourRange(input);
    return {
      ...(gameIds ? { gameId: { in: gameIds } } : {}),
      ...(input.companyId ? { game: { companyId: input.companyId } } : {}),
      ...(input.gameId ? { gameId: input.gameId } : {}),
      ...(input.openId ? { openId: input.openId } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.userId ? { openIdRecord: { userId: input.userId } } : {}),
      ...(range ? { eventTime: range } : {}),
    };
  }
}

function resolveHourRange(input: EcpmDashboardQueryInput): Prisma.DateTimeFilter | undefined {
  if (!input.startedDataHour && !input.endedDataHour) {
    return undefined;
  }
  const gte = input.startedDataHour ? new Date(input.startedDataHour) : undefined;
  const lte = input.endedDataHour ? new Date(input.endedDataHour) : undefined;
  if ((gte && Number.isNaN(gte.getTime())) || (lte && Number.isNaN(lte.getTime()))) {
    throw new BadRequestException('Invalid ECPM data-hour range');
  }
  return { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) };
}

function pageSize(input: EcpmDashboardQueryInput) {
  return Math.min(Math.max(Math.trunc(input.pageSize ?? 50), 1), 100);
}

function offset(input: EcpmDashboardQueryInput) {
  return (Math.max(Math.trunc(input.page ?? 1), 1) - 1) * pageSize(input);
}

function sumBigInt(values: bigint[]) {
  return values.reduce((sum, value) => sum + value, 0n);
}

function latestDate(values: Date[]) {
  return values.reduce((latest, value) => (value > latest ? value : latest), values[0]!);
}

function toChinaDataHour(value: Date) {
  const chinaMs = value.getTime() + 8 * 60 * 60 * 1000;
  const date = new Date(Math.floor(chinaMs / 3600000) * 3600000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hour = String(date.getUTCHours()).padStart(2, '0');
  return `${year}-${month}-${day}T${hour}:00:00+08:00`;
}
```

- [ ] **Step 4: Run dashboard tests**

Run: `pnpm --filter api test -- ecpm-dashboard.service.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit dashboard query service**

```bash
git add apps/api/src/features/ecpm-admin/ecpm-dashboard.service.ts apps/api/src/features/ecpm-admin/ecpm-dashboard.service.spec.ts
git commit -m "feat(api): add ecpm dashboard queries"
```

## Task 3: Add ECPM Update Job Service

**Files:**
- Create: `apps/api/src/features/ecpm-admin/ecpm-update-job.service.spec.ts`
- Create: `apps/api/src/features/ecpm-admin/ecpm-update-job.service.ts`

- [ ] **Step 1: Write failing update job service tests**

Create tests for these behaviors:

```ts
describe('EcpmUpdateJobService', () => {
  it('starts an aggregate update job with requested counts', async () => {});
  it('records successful and skipped item rows', async () => {});
  it('completes a job as SUCCEEDED when no failures exist', async () => {});
  it('completes a job as PARTIAL when failures and saves exist', async () => {});
  it('completes a job as FAILED when every item failed or skipped', async () => {});
  it('lists jobs newest first with item counts', async () => {});
  it('returns job details with item rows', async () => {});
  it('returns retryable failed and partial jobs', async () => {});
  it('rejects retry lookup for succeeded jobs', async () => {});
});
```

Use fake Prisma delegates `ecpmUpdateJob.create`, `ecpmUpdateJob.update`, `ecpmUpdateJob.findMany`, `ecpmUpdateJob.findUnique`, and `ecpmUpdateJobItem.create`.

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm --filter api test -- ecpm-update-job.service.spec.ts`

Expected: FAIL because the service file does not exist.

- [ ] **Step 3: Implement update job service**

Create `apps/api/src/features/ecpm-admin/ecpm-update-job.service.ts` with these public methods:

```ts
export type EcpmUpdateScopeType = 'company' | 'game' | 'open_id' | 'user';
export type EcpmUpdateMode = 'latest' | 'range';

export type StartEcpmUpdateJobInput = {
  actorId: string;
  actorType: string;
  endedDataHour: string;
  mode: EcpmUpdateMode;
  requestedGameCount: number;
  requestedOpenIdCount: number;
  scopeId: string;
  scopeType: EcpmUpdateScopeType;
  startedDataHour: string;
};

export type RecordEcpmUpdateJobItemInput = {
  dataHour: string;
  errorMessage?: string;
  gameAppId?: string;
  gameId?: string;
  jobId: string;
  kuaishouSyncJobId?: string;
  openId?: string;
  savedCount?: number;
  skipReason?: string;
  status: 'FAILED' | 'PARTIAL' | 'SUCCEEDED';
  userId?: string;
};
```

Implementation requirements:

- `startJob(input)` creates `ecpmUpdateJob` with `RUNNING`.
- `recordItem(input)` creates one `ecpmUpdateJobItem`.
- `finishJob(jobId)` reads job items, sums `savedCount`, `failedCount`, and `skippedCount`, then updates the job status.
- `listJobs({ limit })` clamps limit to `1..100`.
- `findJob(jobId)` returns a job with `items`.
- `findRetryableJob(jobId)` returns a job only when status is `FAILED` or `PARTIAL`; otherwise it throws `BadRequestException`.
- `presentEcpmUpdateJob(job)` returns ISO strings for date fields and includes `items` when present.

- [ ] **Step 4: Run update job tests**

Run: `pnpm --filter api test -- ecpm-update-job.service.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit update job service**

```bash
git add apps/api/src/features/ecpm-admin/ecpm-update-job.service.ts apps/api/src/features/ecpm-admin/ecpm-update-job.service.spec.ts
git commit -m "feat(api): add ecpm update job reports"
```

## Task 4: Add ECPM Update Range Service

**Files:**
- Create: `apps/api/src/features/ecpm-admin/ecpm-update-range.service.spec.ts`
- Create: `apps/api/src/features/ecpm-admin/ecpm-update-range.service.ts`

- [ ] **Step 1: Write failing range service tests**

Create tests for:

```ts
describe('EcpmUpdateRangeService', () => {
  it('updates the latest hour for a company by grouping open_ids by game', async () => {});
  it('updates an explicit hour range for one game', async () => {});
  it('updates all open_ids bound to a user grouped by game', async () => {});
  it('updates one open_id only', async () => {});
  it('records a skipped report when the resolved range has no open_ids', async () => {});
  it('rejects ranges longer than 24 hours', async () => {});
  it('finishes a company job as partial when one game refresh fails', async () => {});
  it('records an audit log with scope, hours, counts, and job id', async () => {});
  it('retries a failed aggregate job with the original scope and hour range', async () => {});
});
```

The company test must expect `KuaishouEcpmRangeSyncService.refreshRange` to be called once per game with explicit `openIds` and `dataHours`.

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm --filter api test -- ecpm-update-range.service.spec.ts`

Expected: FAIL because the service file does not exist.

- [ ] **Step 3: Implement range service**

Create `apps/api/src/features/ecpm-admin/ecpm-update-range.service.ts` with:

```ts
export type EcpmUpdateRequest = {
  endedDataHour?: string | null;
  mode: 'latest' | 'range';
  scopeId: string;
  scopeType: 'company' | 'game' | 'open_id' | 'user';
  startedDataHour?: string | null;
};
```

Implementation requirements:

- `update(input: EcpmUpdateRequest & { actorId: string; actorType: string })` resolves data hours.
- `latest` uses `buildRecentDataHours(1, now)[0]`.
- `range` uses `buildDataHoursBetween(startedDataHour, endedDataHour)`.
- Company scope queries active games with open IDs by `companyId`.
- Game scope queries one active game with open IDs by `game.id`.
- User scope queries `gameOpenId` rows by `userId`, grouped by game.
- open_id scope queries one `gameOpenId` by `openId`.
- Empty resolved scopes create a job and a skipped item with `skipReason: 'NO_OPEN_IDS'`.
- Non-empty scopes call `rangeSyncService.refreshRange` with `markTokenError: true`, explicit `dataHours`, and explicit `openIds`.
- Each delegated refresh records an update job item with the returned child job ID.
- Any delegated refresh error records a failed item and continues to the next game batch.
- After all batches, `finishJob(jobId)` returns the presented aggregate job.
- After finishing, call `auditLogService.record` with `action: 'ecpm.update_finished'`, `targetType: 'ecpm_update_job'`, `targetId: job.id`, and metadata containing `scopeType`, `scopeId`, `mode`, `startedDataHour`, `endedDataHour`, `requestedGameCount`, `requestedOpenIdCount`, `savedCount`, `failedCount`, and `skippedCount`.
- `retry(jobId, actor)` loads `findRetryableJob(jobId)`, then calls `update` with the original `scopeType`, `scopeId`, `mode: 'range'`, `startedDataHour`, and `endedDataHour`.

- [ ] **Step 4: Run range service tests**

Run: `pnpm --filter api test -- ecpm-update-range.service.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit range service**

```bash
git add apps/api/src/features/ecpm-admin/ecpm-update-range.service.ts apps/api/src/features/ecpm-admin/ecpm-update-range.service.spec.ts
git commit -m "feat(api): add scoped ecpm updates"
```

## Task 5: Add ECPM Admin Controller and Module

**Files:**
- Create: `apps/api/src/features/ecpm-admin/ecpm-admin.controller.spec.ts`
- Create: `apps/api/src/features/ecpm-admin/ecpm-admin.controller.ts`
- Create: `apps/api/src/features/ecpm-admin/ecpm-admin.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Write failing controller tests**

Create tests for:

```ts
describe('EcpmAdminController', () => {
  it('delegates company dashboard queries', async () => {});
  it('delegates latest dashboard queries', async () => {});
  it('rejects invalid update payloads', async () => {});
  it('allows only super admins to trigger updates', async () => {});
  it('lists update jobs', async () => {});
  it('returns one update job detail', async () => {});
  it('retries failed or partial update jobs for super admins', async () => {});
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm --filter api test -- ecpm-admin.controller.spec.ts`

Expected: FAIL because the controller file does not exist.

- [ ] **Step 3: Implement controller routes**

Create controller routes:

```ts
@Controller('admin/ecpm')
@UseGuards(AdminJwtGuard)
export class EcpmAdminController {
  @Get('dashboard/company')
  company(@CurrentAdmin() admin: AdminPrincipal, @Query() query: unknown) {
    return this.dashboardService.queryCompany({ admin, ...parseDashboardQuery(query) });
  }

  @Get('dashboard/game')
  game(@CurrentAdmin() admin: AdminPrincipal, @Query() query: unknown) {
    return this.dashboardService.queryGame({ admin, ...parseDashboardQuery(query) });
  }

  @Get('dashboard/user')
  user(@CurrentAdmin() admin: AdminPrincipal, @Query() query: unknown) {
    return this.dashboardService.queryUser({ admin, ...parseDashboardQuery(query) });
  }

  @Get('dashboard/open-id')
  openId(@CurrentAdmin() admin: AdminPrincipal, @Query() query: unknown) {
    return this.dashboardService.queryOpenId({ admin, ...parseDashboardQuery(query) });
  }

  @Get('dashboard/latest')
  latest(@CurrentAdmin() admin: AdminPrincipal, @Query() query: unknown) {
    return this.dashboardService.queryLatest({ admin, ...parseDashboardQuery(query) });
  }

  @Post('update')
  @UseGuards(SuperAdminGuard)
  update(@CurrentAdmin() admin: AdminPrincipal, @Body() body: unknown) {
    const actor = requireSuperAdminPrincipal(admin);
    return this.updateRangeService.update({
      ...parseUpdateRequest(body),
      actorId: actor.username,
      actorType: actor.role,
    });
  }

  @Get('update-jobs')
  jobs(@Query('limit') limit?: string) {
    return this.updateJobService.listJobs({ limit: parseLimit(limit) });
  }

  @Get('update-jobs/:jobId')
  job(@Param('jobId') jobId: string) {
    return this.updateJobService.findJob(jobId);
  }

  @Post('update-jobs/:jobId/retry')
  @UseGuards(SuperAdminGuard)
  retry(@CurrentAdmin() admin: AdminPrincipal, @Param('jobId') jobId: string) {
    const actor = requireSuperAdminPrincipal(admin);
    return this.updateRangeService.retry(jobId, {
      actorId: actor.username,
      actorType: actor.role,
    });
  }
}
```

Use `zod` schemas:

```ts
const dashboardQuerySchema = z.object({
  companyId: z.string().optional(),
  endedDataHour: z.string().optional(),
  gameId: z.string().optional(),
  openId: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  startedDataHour: z.string().optional(),
  status: z.enum(['PENDING', 'SETTLED']).optional(),
  userId: z.string().optional(),
}).strict();

const updateRequestSchema = z.object({
  endedDataHour: z.string().nullable().optional(),
  mode: z.enum(['latest', 'range']),
  scopeId: z.string().min(1),
  scopeType: z.enum(['company', 'game', 'user', 'open_id']),
  startedDataHour: z.string().nullable().optional(),
}).strict();
```

- [ ] **Step 4: Implement module and app import**

Create `EcpmAdminModule` importing `AdminAuthModule`, `AuditLogModule`, `DemoModule`, `KuaishouModule`, and `PrismaModule`. Provide `EcpmDashboardService`, `EcpmUpdateJobService`, `EcpmUpdateRangeService`, `KuaishouEcpmRangeSyncService`, and `KuaishouEcpmSyncJobService`.

Import `EcpmAdminModule` in `apps/api/src/app.module.ts`.

- [ ] **Step 5: Run controller tests and full API lint**

Run:

```bash
pnpm --filter api test -- ecpm-admin.controller.spec.ts
pnpm --filter api lint
```

Expected: both commands pass.

- [ ] **Step 6: Commit controller and module**

```bash
git add apps/api/src/features/ecpm-admin apps/api/src/app.module.ts
git commit -m "feat(api): expose ecpm admin operations"
```

## Task 6: Add Web API Types and Client Methods

**Files:**
- Modify: `apps/web/src/types/api.ts`
- Modify: `apps/web/src/lib/aiKsApi.ts`
- Modify: `apps/web/src/lib/aiKsApi.test.ts`

- [ ] **Step 1: Write failing client tests**

Add tests that assert:

```ts
expect(fetch).toHaveBeenCalledWith(
  expect.stringContaining('/admin/ecpm/dashboard/latest?'),
  expect.objectContaining({ method: undefined }),
);

expect(fetch).toHaveBeenCalledWith(
  expect.stringContaining('/admin/ecpm/update'),
  expect.objectContaining({ method: 'POST' }),
);
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm --filter web test -- aiKsApi.test.ts`

Expected: FAIL because the client methods do not exist.

- [ ] **Step 3: Add types**

Add these exported types to `apps/web/src/types/api.ts`:

```ts
export type EcpmDashboardScope = 'company' | 'game' | 'latest' | 'open_id' | 'user';
export type EcpmUpdateScopeType = 'company' | 'game' | 'open_id' | 'user';
export type EcpmUpdateMode = 'latest' | 'range';
export type EcpmUpdateJobStatus = 'FAILED' | 'PARTIAL' | 'RUNNING' | 'SUCCEEDED';

export type EcpmDashboardRow = {
  companyId?: string;
  companyName?: string;
  dataHour: string;
  displayAmount: MoneyValue;
  eventCount?: number;
  eventTime?: string;
  gameAppId: string;
  gameId: string;
  gameName: string;
  openId?: string;
  openIdCount?: number;
  platformEventId?: string;
  rawCost: MoneyValue;
  readableId?: string | null;
  status?: string;
  updatedAt?: string;
  userId?: string | null;
  username?: string | null;
};

export type EcpmDashboardResult = {
  rows: EcpmDashboardRow[];
  scope: EcpmDashboardScope;
};

export type EcpmUpdateRequest = {
  endedDataHour?: string | null;
  mode: EcpmUpdateMode;
  scopeId: string;
  scopeType: EcpmUpdateScopeType;
  startedDataHour?: string | null;
};

export type EcpmUpdateJobItem = {
  dataHour: string;
  errorMessage: string | null;
  gameAppId: string | null;
  id: string;
  openId: string | null;
  savedCount: number;
  skipReason: string | null;
  status: EcpmUpdateJobStatus;
};

export type EcpmUpdateJob = {
  actorId: string;
  actorType: string;
  createdAt: string;
  endedDataHour: string;
  errorMessage: string | null;
  failedCount: number;
  finishedAt: string | null;
  id: string;
  items?: EcpmUpdateJobItem[];
  mode: EcpmUpdateMode;
  requestedGameCount: number;
  requestedOpenIdCount: number;
  savedCount: number;
  scopeId: string;
  scopeType: EcpmUpdateScopeType;
  skippedCount: number;
  startedAt: string;
  startedDataHour: string;
  status: EcpmUpdateJobStatus;
  updatedAt: string;
};

export type EcpmUpdateJobListResult = {
  jobs: EcpmUpdateJob[];
};
```

- [ ] **Step 4: Add client methods**

Add methods:

```ts
getEcpmDashboard(accessToken: string, scope: EcpmDashboardScope, query: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  return requestJson<EcpmDashboardResult>(`/admin/ecpm/dashboard/${scope}?${params}`, {
    accessToken,
  });
},

updateEcpm(accessToken: string, body: EcpmUpdateRequest) {
  return requestJson<EcpmUpdateJob>('/admin/ecpm/update', {
    accessToken,
    body,
    method: 'POST',
  });
},

getEcpmUpdateJobs(accessToken: string, limit = 20) {
  return requestJson<EcpmUpdateJobListResult>(`/admin/ecpm/update-jobs?limit=${limit}`, {
    accessToken,
  });
},

getEcpmUpdateJob(accessToken: string, jobId: string) {
  return requestJson<EcpmUpdateJob>(`/admin/ecpm/update-jobs/${encodeURIComponent(jobId)}`, {
    accessToken,
  });
},

retryEcpmUpdateJob(accessToken: string, jobId: string) {
  return requestJson<EcpmUpdateJob>(`/admin/ecpm/update-jobs/${encodeURIComponent(jobId)}/retry`, {
    accessToken,
    body: {},
    method: 'POST',
  });
},
```

- [ ] **Step 5: Run web API tests**

Run: `pnpm --filter web test -- aiKsApi.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit web API client**

```bash
git add apps/web/src/types/api.ts apps/web/src/lib/aiKsApi.ts apps/web/src/lib/aiKsApi.test.ts
git commit -m "feat(web): add ecpm operations api client"
```

## Task 7: Build ECPM Operations Center Component

**Files:**
- Create: `apps/web/src/pages/EcpmOperationsCenter.test.tsx`
- Create: `apps/web/src/pages/EcpmOperationsCenter.tsx`

- [ ] **Step 1: Write failing component tests**

Create tests that render:

```tsx
<EcpmOperationsCenter
  canUpdate
  companies={[{ id: 'company-1', name: 'Company A', balance: { li: '0', yuan: '0.00' } }]}
  games={[{ id: 'game-1', companyId: 'company-1', gameAppId: 'game-app-1', name: 'Game A' } as any]}
  jobs={[job]}
  loadingAction=""
  onDashboardQuery={() => undefined}
  onJobSelect={() => undefined}
  onUpdate={() => undefined}
  rows={[row]}
  selectedJob={job}
/>
```

Assertions:

- Default tab text includes `最新数据`.
- Update tab includes scope choices `公司`, `游戏`, `用户`, `open_id`.
- Report tab includes `成功`, `失败`, `跳过`.
- With `canUpdate={false}`, the update button is disabled.

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm --filter web test -- EcpmOperationsCenter.test.tsx`

Expected: FAIL because component file does not exist.

- [ ] **Step 3: Implement component**

Implement props:

```ts
export type EcpmOperationsCenterProps = {
  canUpdate: boolean;
  companies: AdminCompany[];
  games: AdminGame[];
  jobs: EcpmUpdateJob[];
  loadingAction: '' | 'ecpm-dashboard' | 'ecpm-update' | 'ecpm-jobs';
  onDashboardQuery(scope: EcpmDashboardScope, query: Record<string, string | undefined>): void;
  onJobSelect(jobId: string): void;
  onUpdate(request: EcpmUpdateRequest): void;
  rows: EcpmDashboardRow[];
  selectedJob?: EcpmUpdateJob;
};
```

Use internal state:

```ts
const [activeTab, setActiveTab] = useState<'dashboard' | 'reports' | 'update'>('dashboard');
const [dashboardScope, setDashboardScope] = useState<EcpmDashboardScope>('latest');
const [updateMode, setUpdateMode] = useState<EcpmUpdateMode>('latest');
const [updateScopeType, setUpdateScopeType] = useState<EcpmUpdateScopeType>('game');
const [scopeId, setScopeId] = useState('');
const [startedDataHour, setStartedDataHour] = useState('');
const [endedDataHour, setEndedDataHour] = useState('');
```

Render three compact tab buttons and use `DataTable` for dashboard rows and report rows. The update button calls:

```ts
onUpdate({
  endedDataHour: updateMode === 'range' ? endedDataHour : null,
  mode: updateMode,
  scopeId,
  scopeType: updateScopeType,
  startedDataHour: updateMode === 'range' ? startedDataHour : null,
});
```

- [ ] **Step 4: Run component tests**

Run: `pnpm --filter web test -- EcpmOperationsCenter.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit component**

```bash
git add apps/web/src/pages/EcpmOperationsCenter.tsx apps/web/src/pages/EcpmOperationsCenter.test.tsx
git commit -m "feat(web): add ecpm operations center"
```

## Task 8: Replace Operations Nav with Business Function Rail

**Files:**
- Modify: `apps/web/src/pages/OperationsWorkspace.tsx`
- Modify: `apps/web/src/pages/pages.test.tsx`
- Modify: `apps/web/src/styles.css`
- Modify: `apps/web/src/styles.test.ts`

- [ ] **Step 1: Write failing operations layout tests**

In `pages.test.tsx`, replace the existing operations nav expectation with:

```ts
expect(html).toContain('运营功能栏');
expect(html).toContain('公司');
expect(html).toContain('游戏');
expect(html).toContain('ECPM 看板');
expect(html).not.toContain('class="operations-nav"');
```

Add a company admin test assertion:

```ts
expect(html).toContain('ECPM 看板');
expect(html).not.toContain('测试数据维护');
```

In `styles.test.ts`, add:

```ts
it('moves operation feature navigation into a side rail', () => {
  expect(styles).toContain('.operations-shell');
  expect(styles).toContain('grid-template-columns: 220px minmax(0, 1fr)');
  expect(styles).toContain('.operations-feature-rail');
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm --filter web test -- pages.test.tsx styles.test.ts
```

Expected: FAIL because the rail classes and markup do not exist.

- [ ] **Step 3: Refactor pane model**

In `OperationsWorkspace.tsx`, replace `paneItems` labels with business groups:

```ts
const paneItems: Array<{ key: OperationsPane; label: string; subtitle: string }> = [
  { key: 'overview', label: '总览', subtitle: '状态与异常' },
  { key: 'company', label: '公司', subtitle: '公司与余额' },
  { key: 'game', label: '游戏', subtitle: '游戏与预算' },
  { key: 'ecpm', label: 'ECPM 看板', subtitle: '查询、更新、报告' },
  { key: 'kuaishou', label: '快手授权/同步', subtitle: '授权与同步任务' },
  { key: 'settlement', label: '结算', subtitle: '预览与确认' },
  { key: 'withdrawal', label: '提现', subtitle: '审核与打款' },
  { key: 'agent', label: '代理', subtitle: '代理与提现' },
  { key: 'audit', label: '审计', subtitle: '操作日志' },
];
if (isSuperAdmin) {
  paneItems.push({ key: 'config', label: '配置/维护', subtitle: '平台配置与清理' });
}
```

Map old panes into new sections:

- `company` contains company list, create company, recharge company, company admins.
- `game` contains game list, create game, allocate budget, game config, integration login.
- `ecpm` mounts `EcpmOperationsCenter`.
- `kuaishou` contains authorization and sync jobs.
- `settlement`, `withdrawal`, `agent`, `audit`, `config` reuse current panels.

- [ ] **Step 4: Replace nav markup**

Replace the top `operations-nav` with:

```tsx
<div className="operations-shell">
  <nav aria-label="运营功能栏" className="operations-feature-rail">
    {paneItems.map((item) => (
      <button
        aria-current={activePane === item.key ? 'page' : undefined}
        className="operations-feature-item"
        key={item.key}
        onClick={() => setActivePane(item.key)}
        type="button"
      >
        <span>{item.label}</span>
        <small>{item.subtitle}</small>
      </button>
    ))}
  </nav>
  <div className="operations-workspace">
    {/* existing pane sections move here */}
  </div>
</div>
```

- [ ] **Step 5: Add styles**

Add CSS:

```css
.operations-shell {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.operations-feature-rail {
  position: sticky;
  top: 16px;
  display: grid;
  gap: 8px;
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  padding: 10px;
}

.operations-feature-item {
  display: grid;
  gap: 2px;
  width: 100%;
  min-height: 48px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--muted);
  padding: 9px 10px;
  text-align: left;
  cursor: pointer;
}

.operations-feature-item span {
  color: var(--foreground);
  font-weight: 650;
}

.operations-feature-item small {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.35;
}

.operations-feature-item:hover {
  border-color: var(--border);
  background: var(--surface-soft);
}

.operations-feature-item[aria-current="page"] {
  border-color: rgba(204, 120, 92, 0.32);
  background: var(--primary-soft);
}

.operations-feature-item[aria-current="page"] span,
.operations-feature-item[aria-current="page"] small {
  color: var(--primary-hover);
}

.operations-workspace {
  display: grid;
  gap: 16px;
  min-width: 0;
}
```

At `max-width: 1120px`, set `.operations-shell { grid-template-columns: 1fr; }` and `.operations-feature-rail { position: static; grid-template-columns: repeat(3, minmax(0, 1fr)); }`. At `max-width: 860px`, set `.operations-feature-rail { grid-template-columns: 1fr; }`.

- [ ] **Step 6: Run layout tests**

Run: `pnpm --filter web test -- pages.test.tsx styles.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit operations rail**

```bash
git add apps/web/src/pages/OperationsWorkspace.tsx apps/web/src/pages/pages.test.tsx apps/web/src/styles.css apps/web/src/styles.test.ts
git commit -m "feat(web): reorganize operations function rail"
```

## Task 9: Wire ECPM State Through App

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/app/operationFeedback.test.tsx` if operation feedback status text changes
- Modify: `apps/web/src/pages/pages.test.tsx`

- [ ] **Step 1: Write failing app wiring expectations**

Add a page render test that passes `ecpmDashboardRows`, `ecpmUpdateJobs`, and handlers through `OperationsWorkspace`, then asserts:

```ts
expect(html).toContain('ECPM 看板');
expect(html).toContain('最新数据');
expect(html).toContain('更新报告');
```

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm --filter web test -- pages.test.tsx`

Expected: FAIL because `OperationsWorkspace` does not accept ECPM center props yet.

- [ ] **Step 3: Add App state and handlers**

In `App.tsx`, add state:

```ts
const [ecpmDashboardRows, setEcpmDashboardRows] = useState<EcpmDashboardRow[]>([]);
const [ecpmUpdateJobs, setEcpmUpdateJobs] = useState<EcpmUpdateJob[]>([]);
const [selectedEcpmUpdateJob, setSelectedEcpmUpdateJob] = useState<EcpmUpdateJob>();
```

Add handlers:

```ts
async function handleEcpmDashboardQuery(scope: EcpmDashboardScope, query: Record<string, string | undefined>) {
  if (appSession.mode !== 'admin') return;
  await runOperation('ecpm-dashboard', async () => {
    const result = await aiKsApi.getEcpmDashboard(appSession.accessToken, scope, query);
    setEcpmDashboardRows(result.rows);
  });
}

async function handleEcpmUpdate(request: EcpmUpdateRequest) {
  if (appSession.mode !== 'admin') return;
  await runOperation('ecpm-update', async () => {
    const job = await aiKsApi.updateEcpm(appSession.accessToken, request);
    setSelectedEcpmUpdateJob(job);
    await handleLoadEcpmUpdateJobs();
  });
}

async function handleLoadEcpmUpdateJobs() {
  if (appSession.mode !== 'admin') return;
  await runOperation('ecpm-jobs', async () => {
    const result = await aiKsApi.getEcpmUpdateJobs(appSession.accessToken, 20);
    setEcpmUpdateJobs(result.jobs);
  });
}
```

Add `ecpm-dashboard`, `ecpm-update`, and `ecpm-jobs` to the busy action union used by the web app.

- [ ] **Step 4: Pass props into `OperationsWorkspace`**

Pass:

```tsx
ecpmDashboardRows={ecpmDashboardRows}
ecpmUpdateJobs={ecpmUpdateJobs}
onEcpmDashboardQuery={handleEcpmDashboardQuery}
onEcpmUpdate={handleEcpmUpdate}
onLoadEcpmUpdateJobs={handleLoadEcpmUpdateJobs}
onSelectEcpmUpdateJob={handleSelectEcpmUpdateJob}
selectedEcpmUpdateJob={selectedEcpmUpdateJob}
```

- [ ] **Step 5: Run app/page tests**

Run: `pnpm --filter web test -- pages.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit app wiring**

```bash
git add apps/web/src/App.tsx apps/web/src/pages/pages.test.tsx apps/web/src/app/operationFeedback.test.tsx
git commit -m "feat(web): wire ecpm operations center"
```

## Task 10: Final Verification

**Files:**
- No new files. This task verifies the branch.

- [ ] **Step 1: Run backend focused tests**

Run:

```bash
pnpm --filter api test -- ecpm-admin
```

Expected: all `ecpm-admin` tests pass.

- [ ] **Step 2: Run full backend tests**

Run:

```bash
pnpm --filter api test
pnpm --filter api lint
pnpm --filter api prisma:validate
```

Expected: all commands pass.

- [ ] **Step 3: Run frontend tests**

Run:

```bash
pnpm --filter web test
pnpm --filter web lint
```

Expected: all commands pass.

- [ ] **Step 4: Build web app**

Run:

```bash
pnpm --filter web build
```

Expected: TypeScript and Vite build pass.

- [ ] **Step 5: Run full workspace verification**

Run:

```bash
pnpm test
pnpm lint
```

Expected: all workspace tests and type checks pass.

- [ ] **Step 6: Commit final fixes if verification required any**

If verification changed files, commit them:

```bash
git add <changed-files>
git commit -m "fix: stabilize ecpm operations center"
```

If verification did not change files, do not create an empty commit.

## Self-Review

Spec coverage:

- Super-admin function rail: Task 8.
- ECPM as standalone first-level entry: Task 8.
- Query by company, game, user, open_id, and latest: Tasks 2, 5, 6, 7, 9.
- Update by company, game, user, open_id: Tasks 3, 4, 5, 6, 7, 9.
- Default latest hour and optional hour range: Tasks 4, 5, 7.
- Detailed update report: Tasks 1, 3, 5, 6, 7, 9.
- Permissions and audit log recording: Tasks 3, 4, 5.
- Verification: Task 10.

Placeholder scan:

- No placeholder tokens are used.
- Each task has concrete files, commands, and expected outcomes.

Type consistency:

- Backend scope names are `company`, `game`, `user`, and `open_id`.
- Frontend `EcpmUpdateScopeType` uses the same values.
- Dashboard scope names are `company`, `game`, `user`, `open_id`, and `latest`.
- Job status names are `RUNNING`, `SUCCEEDED`, `FAILED`, and `PARTIAL`.
