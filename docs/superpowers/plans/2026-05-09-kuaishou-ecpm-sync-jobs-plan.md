# Kuaishou ECPM Sync Jobs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent, admin-visible history of Kuaishou ECPM sync jobs while keeping the current refresh endpoint synchronous.

**Architecture:** Add one Prisma job table and a focused `KuaishouEcpmSyncJobService` that owns job state transitions. `KuaishouRefreshController` remains the orchestrator: it starts a job, performs the existing ECPM refresh flow, completes or fails the job, and returns the existing refresh payload plus `job`. The web app extends its API client and Operations workspace to load and display recent jobs.

**Tech Stack:** Prisma, NestJS, Zod, Jest, React, Vite, Vitest, existing UI components.

---

## File Structure

- Modify `apps/api/prisma/schema.prisma`: add `KuaishouEcpmSyncJobStatus` and `KuaishouEcpmSyncJob`.
- Create `apps/api/src/features/kuaishou-admin/kuaishou-ecpm-sync-job.service.ts`: start, complete, fail, list, and present sync jobs.
- Create `apps/api/src/features/kuaishou-admin/kuaishou-ecpm-sync-job.service.spec.ts`: service tests with fake Prisma.
- Modify `apps/api/src/features/kuaishou-admin/kuaishou-refresh.controller.ts`: create/complete/fail jobs and expose job list route.
- Modify `apps/api/src/features/kuaishou-admin/kuaishou-refresh.controller.spec.ts`: refresh success/failure job assertions and list route test.
- Modify `apps/api/src/features/kuaishou-admin/kuaishou-refresh.module.ts`: provide `KuaishouEcpmSyncJobService`.
- Modify `apps/web/src/types/api.ts`: add sync job types and add `job` to `EcpmRefreshResult`.
- Modify `apps/web/src/lib/aiKsApi.ts`: add `getKuaishouEcpmJobs`.
- Modify `apps/web/src/lib/aiKsApi.test.ts`: request and type tests for sync jobs.
- Modify `apps/web/src/pages/OperationsWorkspace.tsx`: render recent sync jobs and add refresh jobs action.
- Modify `apps/web/src/pages/pages.test.tsx`: static render tests for the jobs panel.
- Modify `apps/web/src/App.tsx`: state, loading on admin entry, and refresh-after-ECPM behavior.

## Task 1: Prisma Sync Job Schema

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add schema model and enum**

Add this enum after `KuaishouTokenStatus`:

```prisma
enum KuaishouEcpmSyncJobStatus {
  RUNNING
  SUCCEEDED
  FAILED
}
```

Add this model after `KuaishouPlatformToken`:

```prisma
model KuaishouEcpmSyncJob {
  id                   String                    @id @default(uuid())
  status               KuaishouEcpmSyncJobStatus @default(RUNNING)
  gameAppId            String                    @map("game_app_id")
  dataHour             String                    @map("data_hour")
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
  @@index([status])
  @@map("kuaishou_ecpm_sync_jobs")
}
```

- [ ] **Step 2: Generate and validate Prisma**

Run:

```bash
pnpm --filter api prisma:generate
pnpm --filter api prisma:validate
```

Expected:

- `prisma:generate` exits 0.
- `prisma:validate` exits 0 and reports the schema is valid.

- [ ] **Step 3: Commit schema**

Run:

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(api): add kuaishou ecpm sync job schema"
```

## Task 2: Sync Job Service

**Files:**
- Create: `apps/api/src/features/kuaishou-admin/kuaishou-ecpm-sync-job.service.ts`
- Create: `apps/api/src/features/kuaishou-admin/kuaishou-ecpm-sync-job.service.spec.ts`

- [ ] **Step 1: Write failing service tests**

Create `apps/api/src/features/kuaishou-admin/kuaishou-ecpm-sync-job.service.spec.ts` with:

```ts
import { KuaishouEcpmSyncJobStatus } from '@prisma/client';
import {
  KuaishouEcpmSyncJobService,
  presentKuaishouEcpmSyncJob,
} from './kuaishou-ecpm-sync-job.service';

describe('KuaishouEcpmSyncJobService', () => {
  it('starts running sync jobs with actor and request summary', async () => {
    const { prisma, service } = createService();

    const job = await service.startJob({
      actorId: 'admin',
      actorType: 'SUPER_ADMIN',
      dataHour: '2026-05-08',
      gameAppId: 'game-1',
      requestedOpenIdCount: 2,
    });

    expect(job).toMatchObject({
      actorId: 'admin',
      actorType: 'SUPER_ADMIN',
      dataHour: '2026-05-08',
      gameAppId: 'game-1',
      requestedOpenIdCount: 2,
      savedCount: 0,
      status: KuaishouEcpmSyncJobStatus.RUNNING,
    });
    expect(prisma.rows).toHaveLength(1);
  });

  it('completes sync jobs with source, saved count, and finish time', async () => {
    const { service } = createService();
    const job = await service.startJob(baseStartInput());

    const completed = await service.completeJob({
      jobId: job.id,
      savedCount: 3,
      source: 'kuaishou',
    });

    expect(completed).toMatchObject({
      savedCount: 3,
      source: 'kuaishou',
      status: KuaishouEcpmSyncJobStatus.SUCCEEDED,
      finishedAt: now,
    });
  });

  it('fails sync jobs with an error message and finish time', async () => {
    const { service } = createService();
    const job = await service.startJob(baseStartInput());

    const failed = await service.failJob({
      errorMessage: 'token expired',
      jobId: job.id,
    });

    expect(failed).toMatchObject({
      errorMessage: 'token expired',
      status: KuaishouEcpmSyncJobStatus.FAILED,
      finishedAt: now,
    });
  });

  it('lists recent sync jobs newest first with clamped limits', async () => {
    const { service } = createService();
    await service.startJob({ ...baseStartInput(), gameAppId: 'game-1' });
    await service.startJob({ ...baseStartInput(), gameAppId: 'game-2' });

    const result = await service.listJobs({ limit: 200 });

    expect(result).toHaveLength(2);
    expect(result[0].gameAppId).toBe('game-2');
  });

  it('presents job dates as ISO strings', async () => {
    const { service } = createService();
    const job = await service.startJob(baseStartInput());

    expect(presentKuaishouEcpmSyncJob(job)).toEqual({
      actorId: 'admin',
      actorType: 'SUPER_ADMIN',
      createdAt: '2026-05-08T00:00:00.000Z',
      dataHour: '2026-05-08',
      errorMessage: null,
      finishedAt: null,
      gameAppId: 'game-1',
      id: 'job-1',
      requestedOpenIdCount: 1,
      savedCount: 0,
      source: null,
      startedAt: '2026-05-08T00:00:00.000Z',
      status: KuaishouEcpmSyncJobStatus.RUNNING,
      updatedAt: '2026-05-08T00:00:00.000Z',
    });
  });
});

const now = new Date('2026-05-08T00:00:00.000Z');

function baseStartInput() {
  return {
    actorId: 'admin',
    actorType: 'SUPER_ADMIN',
    dataHour: '2026-05-08',
    gameAppId: 'game-1',
    requestedOpenIdCount: 1,
  };
}

function createService() {
  const prisma = createFakePrisma();
  const service = new KuaishouEcpmSyncJobService(prisma, () => now);
  return { prisma, service };
}

function createFakePrisma() {
  const rows: any[] = [];

  return {
    rows,
    kuaishouEcpmSyncJob: {
      create: async ({ data }: any) => {
        const row = {
          id: `job-${rows.length + 1}`,
          createdAt: new Date(now.getTime() + rows.length * 1000),
          updatedAt: new Date(now.getTime() + rows.length * 1000),
          ...data,
        };
        rows.push(row);
        return row;
      },
      update: async ({ data, where }: any) => {
        const index = rows.findIndex((row) => row.id === where.id);
        if (index === -1) {
          throw new Error('job not found');
        }
        rows[index] = {
          ...rows[index],
          ...data,
          updatedAt: now,
        };
        return rows[index];
      },
      findMany: async ({ orderBy, take }: any) =>
        rows
          .slice()
          .sort((a, b) =>
            orderBy?.createdAt === 'desc'
              ? b.createdAt.getTime() - a.createdAt.getTime()
              : a.createdAt.getTime() - b.createdAt.getTime(),
          )
          .slice(0, take),
    },
  } as any;
}
```

- [ ] **Step 2: Run service tests and verify RED**

Run:

```bash
pnpm --filter api test -- kuaishou-ecpm-sync-job.service.spec.ts
```

Expected: FAIL because `kuaishou-ecpm-sync-job.service.ts` does not exist.

- [ ] **Step 3: Implement sync job service**

Create `apps/api/src/features/kuaishou-admin/kuaishou-ecpm-sync-job.service.ts` with:

```ts
import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  type KuaishouEcpmSyncJob,
  KuaishouEcpmSyncJobStatus,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export const KUAISHOU_ECPM_SYNC_JOB_NOW = Symbol(
  'KUAISHOU_ECPM_SYNC_JOB_NOW',
);

type SyncJobPrisma = Pick<PrismaService, 'kuaishouEcpmSyncJob'>;

export type StartKuaishouEcpmSyncJobInput = {
  actorId: string;
  actorType: string;
  dataHour: string;
  gameAppId: string;
  requestedOpenIdCount: number;
};

export type CompleteKuaishouEcpmSyncJobInput = {
  jobId: string;
  savedCount: number;
  source: 'mock' | 'kuaishou';
};

export type FailKuaishouEcpmSyncJobInput = {
  errorMessage: string;
  jobId: string;
};

export type ListKuaishouEcpmSyncJobsInput = {
  limit?: number;
};

@Injectable()
export class KuaishouEcpmSyncJobService {
  constructor(
    @Inject(PrismaService) private readonly prisma: SyncJobPrisma,
    @Optional()
    @Inject(KUAISHOU_ECPM_SYNC_JOB_NOW)
    private readonly nowProvider?: () => Date,
  ) {}

  startJob(input: StartKuaishouEcpmSyncJobInput) {
    return this.prisma.kuaishouEcpmSyncJob.create({
      data: {
        actorId: input.actorId,
        actorType: input.actorType,
        dataHour: input.dataHour,
        gameAppId: input.gameAppId,
        requestedOpenIdCount: input.requestedOpenIdCount,
        savedCount: 0,
        startedAt: this.now(),
        status: KuaishouEcpmSyncJobStatus.RUNNING,
      },
    });
  }

  completeJob(input: CompleteKuaishouEcpmSyncJobInput) {
    return this.prisma.kuaishouEcpmSyncJob.update({
      data: {
        errorMessage: null,
        finishedAt: this.now(),
        savedCount: input.savedCount,
        source: input.source,
        status: KuaishouEcpmSyncJobStatus.SUCCEEDED,
      },
      where: {
        id: input.jobId,
      },
    });
  }

  failJob(input: FailKuaishouEcpmSyncJobInput) {
    return this.prisma.kuaishouEcpmSyncJob.update({
      data: {
        errorMessage: input.errorMessage,
        finishedAt: this.now(),
        status: KuaishouEcpmSyncJobStatus.FAILED,
      },
      where: {
        id: input.jobId,
      },
    });
  }

  listJobs(input: ListKuaishouEcpmSyncJobsInput = {}) {
    return this.prisma.kuaishouEcpmSyncJob.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      take: clampLimit(input.limit),
    });
  }

  private now() {
    return this.nowProvider?.() ?? new Date();
  }
}

export function presentKuaishouEcpmSyncJob(job: KuaishouEcpmSyncJob) {
  return {
    actorId: job.actorId,
    actorType: job.actorType,
    createdAt: job.createdAt.toISOString(),
    dataHour: job.dataHour,
    errorMessage: job.errorMessage,
    finishedAt: job.finishedAt?.toISOString() ?? null,
    gameAppId: job.gameAppId,
    id: job.id,
    requestedOpenIdCount: job.requestedOpenIdCount,
    savedCount: job.savedCount,
    source: job.source as 'mock' | 'kuaishou' | null,
    startedAt: job.startedAt.toISOString(),
    status: job.status,
    updatedAt: job.updatedAt.toISOString(),
  };
}

function clampLimit(limit?: number) {
  if (!Number.isFinite(limit)) {
    return 20;
  }

  return Math.min(Math.max(Math.trunc(limit!), 1), 100);
}
```

- [ ] **Step 4: Run service tests and verify GREEN**

Run:

```bash
pnpm --filter api test -- kuaishou-ecpm-sync-job.service.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit service**

Run:

```bash
git add apps/api/src/features/kuaishou-admin/kuaishou-ecpm-sync-job.service.ts apps/api/src/features/kuaishou-admin/kuaishou-ecpm-sync-job.service.spec.ts
git commit -m "feat(api): add kuaishou ecpm sync job service"
```

## Task 3: Refresh Controller Job Integration

**Files:**
- Modify: `apps/api/src/features/kuaishou-admin/kuaishou-refresh.controller.ts`
- Modify: `apps/api/src/features/kuaishou-admin/kuaishou-refresh.controller.spec.ts`
- Modify: `apps/api/src/features/kuaishou-admin/kuaishou-refresh.module.ts`

- [ ] **Step 1: Write failing controller tests**

Modify `apps/api/src/features/kuaishou-admin/kuaishou-refresh.controller.spec.ts`:

1. Update `createController()` to pass `dependencies.syncJobService` after `tokenService`.
2. Add this assertion to the success test:

```ts
expect(dependencies.syncJobService.startJob).toHaveBeenCalledWith({
  actorId: 'admin',
  actorType: 'SUPER_ADMIN',
  dataHour: '2026-05-08',
  gameAppId: 'game-1',
  requestedOpenIdCount: 1,
});
expect(dependencies.syncJobService.completeJob).toHaveBeenCalledWith({
  jobId: 'job-1',
  savedCount: 1,
  source: 'kuaishou',
});
expect(result).toMatchObject({
  job: expect.objectContaining({
    id: 'job-1',
    savedCount: 1,
    status: 'SUCCEEDED',
  }),
});
```

3. Add this assertion to the failure test:

```ts
expect(dependencies.syncJobService.failJob).toHaveBeenCalledWith({
  errorMessage: 'token expired',
  jobId: 'job-1',
});
```

4. Add this test:

```ts
it('lists recent ECPM sync jobs with a clamped limit', async () => {
  const dependencies = createDependencies();
  const controller = createController(dependencies);

  const result = await controller.jobs('200');

  expect(dependencies.syncJobService.listJobs).toHaveBeenCalledWith({
    limit: 100,
  });
  expect(result).toEqual({
    jobs: [
      expect.objectContaining({
        id: 'job-1',
        status: 'SUCCEEDED',
      }),
    ],
  });
});
```

Add this fake dependency in `createDependencies()`:

```ts
const syncJob = {
  actorId: 'admin',
  actorType: 'SUPER_ADMIN',
  createdAt: new Date('2026-05-08T00:00:00.000Z'),
  dataHour: '2026-05-08',
  errorMessage: null,
  finishedAt: new Date('2026-05-08T00:01:00.000Z'),
  gameAppId: 'game-1',
  id: 'job-1',
  requestedOpenIdCount: 1,
  savedCount: 1,
  source: 'kuaishou',
  startedAt: new Date('2026-05-08T00:00:00.000Z'),
  status: 'SUCCEEDED',
  updatedAt: new Date('2026-05-08T00:01:00.000Z'),
};
```

and:

```ts
syncJobService: {
  completeJob: jest.fn(async () => syncJob),
  failJob: jest.fn(async () => ({ ...syncJob, errorMessage: 'token expired', status: 'FAILED' })),
  listJobs: jest.fn(async () => [syncJob]),
  startJob: jest.fn(async () => ({ ...syncJob, savedCount: 0, status: 'RUNNING' })),
},
```

- [ ] **Step 2: Run controller tests and verify RED**

Run:

```bash
pnpm --filter api test -- kuaishou-refresh.controller.spec.ts
```

Expected: FAIL because `KuaishouRefreshController` does not accept or use `syncJobService`, and `jobs()` does not exist.

- [ ] **Step 3: Implement controller integration**

Modify `apps/api/src/features/kuaishou-admin/kuaishou-refresh.controller.ts`:

- Add imports:

```ts
import { Get, Query } from '@nestjs/common';
import {
  KuaishouEcpmSyncJobService,
  presentKuaishouEcpmSyncJob,
} from './kuaishou-ecpm-sync-job.service';
```

- Add constructor dependency after `tokenService`:

```ts
private readonly syncJobService: KuaishouEcpmSyncJobService,
```

- Replace the body of `refresh()` with this flow:

```ts
const input = refreshEcpmSchema.parse(body);
const dataHour = input.dataHour ?? currentChinaDate();
const knownOpenIds = (await this.demoStore.listOpenIds(input.gameAppId)).map(
  (record) => record.openId,
);
const openIds = input.openIds?.length ? input.openIds : knownOpenIds;
const job = await this.syncJobService.startJob({
  actorId: admin.username,
  actorType: admin.role,
  dataHour,
  gameAppId: input.gameAppId,
  requestedOpenIdCount: openIds.length,
});

try {
  const refreshResult = await this.ecpmClient.refresh({
    dataHour,
    gameAppId: input.gameAppId,
    openIds,
  });
  const savedRows = await this.demoStore.addEcpmRows({
    gameAppId: input.gameAppId,
    rows: refreshResult.rows,
  });
  const completedJob = await this.syncJobService.completeJob({
    jobId: job.id,
    savedCount: savedRows.length,
    source: refreshResult.source,
  });
  await this.auditLogService.record({
    action: 'kuaishou.ecpm_refreshed',
    actorId: admin.username,
    actorType: admin.role,
    metadata: {
      dataHour,
      jobId: job.id,
      requestedOpenIds: openIds,
      savedCount: savedRows.length,
      source: refreshResult.source,
    },
    targetId: input.gameAppId,
    targetType: 'kuaishou_ecpm_refresh',
  });

  return {
    job: presentKuaishouEcpmSyncJob(completedJob),
    requestedOpenIds: openIds,
    rows: savedRows.map(presentEcpmRow),
    savedCount: savedRows.length,
    source: refreshResult.source,
  };
} catch (error) {
  const message = readErrorMessage(error);
  await this.syncJobService.failJob({
    errorMessage: message,
    jobId: job.id,
  });
  await this.tokenService.markTokenError(message);
  await this.auditLogService.record({
    action: 'kuaishou.ecpm_refresh_failed',
    actorId: admin.username,
    actorType: admin.role,
    metadata: {
      dataHour,
      error: message,
      jobId: job.id,
      requestedOpenIds: openIds,
    },
    targetId: input.gameAppId,
    targetType: 'kuaishou_ecpm_refresh',
  });
  throw error;
}
```

- Add the list route:

```ts
@Get('ecpm/jobs')
async jobs(@Query('limit') limit?: string) {
  const jobs = await this.syncJobService.listJobs({
    limit: parseLimit(limit),
  });

  return {
    jobs: jobs.map(presentKuaishouEcpmSyncJob),
  };
}
```

- Add helper:

```ts
function parseLimit(value?: string) {
  if (!value) {
    return 20;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 20;
  }

  return Math.min(Math.max(Math.trunc(parsed), 1), 100);
}
```

- Remove `refreshEcpmOrRecordFailure()` because job handling now wraps refresh and save together.

- [ ] **Step 4: Provide the service in module**

Modify `apps/api/src/features/kuaishou-admin/kuaishou-refresh.module.ts`:

```ts
import { KuaishouEcpmSyncJobService } from './kuaishou-ecpm-sync-job.service';

@Module({
  controllers: [KuaishouRefreshController, KuaishouTokenController],
  imports: [AdminAuthModule, AuditLogModule, DemoModule, KuaishouModule],
  providers: [KuaishouEcpmSyncJobService],
})
export class KuaishouRefreshModule {}
```

- [ ] **Step 5: Run controller tests and focused API tests**

Run:

```bash
pnpm --filter api test -- kuaishou-refresh.controller.spec.ts kuaishou-ecpm-sync-job.service.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Run full API tests**

Run:

```bash
pnpm --filter api test
```

Expected: PASS.

- [ ] **Step 7: Commit backend integration**

Run:

```bash
git add apps/api/src/features/kuaishou-admin/kuaishou-refresh.controller.ts apps/api/src/features/kuaishou-admin/kuaishou-refresh.controller.spec.ts apps/api/src/features/kuaishou-admin/kuaishou-refresh.module.ts
git commit -m "feat(api): track kuaishou ecpm sync jobs"
```

## Task 4: Web API Types And Client

**Files:**
- Modify: `apps/web/src/types/api.ts`
- Modify: `apps/web/src/lib/aiKsApi.ts`
- Modify: `apps/web/src/lib/aiKsApi.test.ts`

- [ ] **Step 1: Write failing Web API tests**

Modify `apps/web/src/lib/aiKsApi.test.ts`:

- Import these types:

```ts
import type {
  KuaishouEcpmSyncJob,
  KuaishouEcpmSyncJobListResult,
} from '../types/api';
```

- Add type test:

```ts
it('types kuaishou ecpm job methods and refresh responses', () => {
  expectTypeOf(aiKsApi.getKuaishouEcpmJobs)
    .returns.resolves.toEqualTypeOf<KuaishouEcpmSyncJobListResult>();
  expectTypeOf<EcpmRefreshResult['job']>().toEqualTypeOf<KuaishouEcpmSyncJob>();
});
```

- Add request test:

```ts
it('loads kuaishou ecpm sync jobs with the admin token', async () => {
  mockJsonResponse({ jobs: [] });

  await aiKsApi.getKuaishouEcpmJobs('admin-token', 50);

  expect(globalThis.fetch).toHaveBeenCalledWith(
    `${API_BASE_URL}/admin/kuaishou/ecpm/jobs?limit=50`,
    {
      body: undefined,
      headers: {
        Authorization: 'Bearer admin-token',
        'Content-Type': 'application/json',
      },
      method: 'GET',
    },
  );
});
```

- [ ] **Step 2: Run Web API tests and verify RED**

Run:

```bash
pnpm --filter web test -- aiKsApi.test.ts
```

Expected: FAIL because `getKuaishouEcpmJobs`, `KuaishouEcpmSyncJob`, and `KuaishouEcpmSyncJobListResult` do not exist.

- [ ] **Step 3: Add web types**

Modify `apps/web/src/types/api.ts`:

```ts
export type KuaishouEcpmSyncJob = {
  actorId: string;
  actorType: string;
  createdAt: string;
  dataHour: string;
  errorMessage: string | null;
  finishedAt: string | null;
  gameAppId: string;
  id: string;
  requestedOpenIdCount: number;
  savedCount: number;
  source: 'mock' | 'kuaishou' | null;
  startedAt: string;
  status: 'FAILED' | 'RUNNING' | 'SUCCEEDED';
  updatedAt: string;
};

export type KuaishouEcpmSyncJobListResult = {
  jobs: KuaishouEcpmSyncJob[];
};
```

Change `EcpmRefreshResult` to:

```ts
export type EcpmRefreshResult = {
  job: KuaishouEcpmSyncJob;
  requestedOpenIds: string[];
  rows: EcpmRow[];
  savedCount: number;
  source: 'mock' | 'kuaishou';
};
```

- [ ] **Step 4: Add API client method**

Modify `apps/web/src/lib/aiKsApi.ts`:

- Import `KuaishouEcpmSyncJobListResult`.
- Add method after `refreshEcpm()`:

```ts
getKuaishouEcpmJobs(adminAccessToken: string, limit = 20) {
  return requestJson<KuaishouEcpmSyncJobListResult>(
    `/admin/kuaishou/ecpm/jobs?limit=${encodeURIComponent(String(limit))}`,
    {
      accessToken: adminAccessToken,
    },
  );
},
```

- [ ] **Step 5: Run Web API tests and verify GREEN**

Run:

```bash
pnpm --filter web test -- aiKsApi.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Web API client**

Run:

```bash
git add apps/web/src/types/api.ts apps/web/src/lib/aiKsApi.ts apps/web/src/lib/aiKsApi.test.ts
git commit -m "feat(web): add kuaishou ecpm sync job client"
```

## Task 5: Operations Workspace Jobs UI

**Files:**
- Modify: `apps/web/src/pages/OperationsWorkspace.tsx`
- Modify: `apps/web/src/pages/pages.test.tsx`
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Write failing render tests**

Modify `apps/web/src/pages/pages.test.tsx`:

- Import `KuaishouEcpmSyncJob`.
- Add fixture:

```ts
const kuaishouEcpmJob: KuaishouEcpmSyncJob = {
  actorId: 'admin',
  actorType: 'SUPER_ADMIN',
  createdAt: '2026-05-08T00:00:00.000Z',
  dataHour: '2026-05-08',
  errorMessage: null,
  finishedAt: '2026-05-08T00:01:00.000Z',
  gameAppId: 'game-1',
  id: 'job-1',
  requestedOpenIdCount: 2,
  savedCount: 1,
  source: 'kuaishou',
  startedAt: '2026-05-08T00:00:00.000Z',
  status: 'SUCCEEDED',
  updatedAt: '2026-05-08T00:01:00.000Z',
};
```

- Add default props:

```ts
kuaishouEcpmJobs: [],
onLoadKuaishouEcpmJobs: () => undefined,
```

- Add test:

```ts
it('renders recent kuaishou ecpm sync jobs', () => {
  const html = renderToStaticMarkup(
    <OperationsWorkspace
      {...operationsWorkspaceProps({
        kuaishouEcpmJobs: [
          kuaishouEcpmJob,
          {
            ...kuaishouEcpmJob,
            errorMessage: 'token expired',
            id: 'job-2',
            status: 'FAILED',
          },
        ],
      })}
    />,
  );

  expect(html).toContain('同步任务');
  expect(html).toContain('job-1');
  expect(html).toContain('SUCCEEDED');
  expect(html).toContain('FAILED');
  expect(html).toContain('token expired');
  expect(html).toContain('kuaishou');
});
```

- [ ] **Step 2: Run page tests and verify RED**

Run:

```bash
pnpm --filter web test -- pages.test.tsx
```

Expected: FAIL because `OperationsWorkspaceProps` does not include job props and the UI does not render sync jobs.

- [ ] **Step 3: Add Operations workspace props and UI**

Modify `apps/web/src/pages/OperationsWorkspace.tsx`:

- Import `KuaishouEcpmSyncJob`.
- Add busy action:

```ts
| 'kuaishou-ecpm-jobs'
```

- Add props:

```ts
kuaishouEcpmJobs: KuaishouEcpmSyncJob[];
onLoadKuaishouEcpmJobs(): void;
```

- Add helper:

```ts
function syncJobTone(status: KuaishouEcpmSyncJob['status']) {
  if (status === 'SUCCEEDED') {
    return 'success';
  }

  if (status === 'FAILED') {
    return 'danger';
  }

  return 'warning';
}
```

- Add panel after `EcpmTable`:

```tsx
<Panel
  actions={
    <Button
      disabled={workspaceBusy}
      icon={<RefreshCw size={16} />}
      onClick={onLoadKuaishouEcpmJobs}
      variant="secondary"
    >
      {busyAction === 'kuaishou-ecpm-jobs' ? '加载中' : '刷新任务'}
    </Button>
  }
  description="最近同步"
  title="同步任务"
>
  <div className="data-table-wrap">
    <table className="data-table">
      <thead>
        <tr>
          <th>任务</th>
          <th>状态</th>
          <th>游戏</th>
          <th>数据小时</th>
          <th>open_id</th>
          <th>写入</th>
          <th>来源</th>
          <th>错误</th>
        </tr>
      </thead>
      <tbody>
        {kuaishouEcpmJobs.map((job) => (
          <tr key={job.id}>
            <td>{job.id}</td>
            <td>
              <StatusBadge tone={syncJobTone(job.status)}>
                {job.status}
              </StatusBadge>
            </td>
            <td>{job.gameAppId}</td>
            <td>{job.dataHour}</td>
            <td>{job.requestedOpenIdCount}</td>
            <td>{job.savedCount}</td>
            <td>{job.source ?? '-'}</td>
            <td>{job.errorMessage ?? '-'}</td>
          </tr>
        ))}
        {kuaishouEcpmJobs.length === 0 ? (
          <tr>
            <td colSpan={8}>暂无同步任务</td>
          </tr>
        ) : null}
      </tbody>
    </table>
  </div>
</Panel>
```

- [ ] **Step 4: Run page tests and verify GREEN**

Run:

```bash
pnpm --filter web test -- pages.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Add App state and actions**

Modify `apps/web/src/App.tsx`:

- Import `KuaishouEcpmSyncJob`.
- Add state:

```ts
const [kuaishouEcpmJobs, setKuaishouEcpmJobs] = useState<
  KuaishouEcpmSyncJob[]
>([]);
```

- Clear in `clearAdminAuth()` and `signOut()`:

```ts
setKuaishouEcpmJobs([]);
```

- Add loading function:

```ts
async function loadKuaishouEcpmJobsForToken(
  token: string,
  isCurrent = () => true,
) {
  try {
    const result = await aiKsApi.getKuaishouEcpmJobs(token, 20);
    if (!isCurrent()) {
      return false;
    }

    setKuaishouEcpmJobs(result.jobs);
    return true;
  } catch (nextError) {
    if (!isCurrent()) {
      return false;
    }

    if (nextError instanceof ApiError && nextError.status === 401) {
      handleUnauthorized('admin');
      setError(nextError.message);
      return false;
    }

    setError(
      nextError instanceof Error ? nextError.message : '请求失败，请检查 API',
    );
    return false;
  }
}
```

- Add user action:

```ts
async function loadKuaishouEcpmJobs() {
  if (!adminAccessToken) {
    setError('请先登录管理员账号');
    return;
  }

  await runAction('kuaishou-ecpm-jobs', async (isCurrent) => {
    const loaded = await loadKuaishouEcpmJobsForToken(
      adminAccessToken,
      isCurrent,
    );
    if (!isCurrent() || !loaded) {
      return;
    }

    setNotice('同步任务已刷新');
  }, 'admin');
}
```

- Load on admin entry with a `useEffect` like the token status effect:

```ts
useEffect(() => {
  if (appSession.mode !== 'admin' || !adminAccessToken) {
    return;
  }

  const jobSessionVersion = sessionVersionRef.current;
  void loadKuaishouEcpmJobsForToken(adminAccessToken, () =>
    isCurrentSessionVersion(jobSessionVersion),
  );
}, [adminAccessToken, appSession.mode]);
```

- Update `refreshEcpm()` after success:

```ts
setRefreshResult(result);
setKuaishouEcpmJobs((current) => [result.job, ...current].slice(0, 20));
await loadKuaishouEcpmJobsForToken(adminAccessToken, isCurrent);
if (!isCurrent()) {
  return;
}
setNotice(`ECPM 刷新成功，写入 ${result.savedCount} 条明细`);
```

- Pass props to `OperationsWorkspace`:

```tsx
kuaishouEcpmJobs={kuaishouEcpmJobs}
onLoadKuaishouEcpmJobs={loadKuaishouEcpmJobs}
```

- Add `kuaishou-ecpm-jobs` to `isOperationsBusyAction()`.

- [ ] **Step 6: Run Web tests and lint**

Run:

```bash
pnpm --filter web test
pnpm --filter web lint
```

Expected: both PASS.

- [ ] **Step 7: Commit UI integration**

Run:

```bash
git add apps/web/src/pages/OperationsWorkspace.tsx apps/web/src/pages/pages.test.tsx apps/web/src/App.tsx
git commit -m "feat(web): show kuaishou ecpm sync jobs"
```

## Task 6: Final Verification

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run final backend verification**

Run:

```bash
pnpm --filter api prisma:generate
pnpm --filter api prisma:validate
pnpm --filter api test
pnpm --filter api build
```

Expected: all commands exit 0.

- [ ] **Step 2: Run final frontend verification**

Run:

```bash
pnpm --filter web test
pnpm --filter web lint
pnpm --filter web build
```

Expected: all commands exit 0.

- [ ] **Step 3: Check git status**

Run:

```bash
git status --short
```

Expected: no output.

- [ ] **Step 4: Start or confirm dev server**

Run:

```bash
pnpm dev
```

Expected:

- Web reports `Local: http://localhost:8008/`.
- API starts with no Nest dependency errors.
- `/api/health` returns `{ "status": "ok", "service": "ai-ks-api" }`.
