# Admin Settlement Budget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an admin-confirmed settlement flow that previews pending ECPM, enforces game budget, creates settlement batches, credits user balances, and removes user self-settlement.

**Architecture:** Add Prisma settlement batch models, then implement a focused NestJS `settlement-admin` module with preview, confirm, list, and detail APIs guarded by admin JWT. Update the React admin operations workspace to preview and confirm settlements, while the account workspace becomes read-only for settlement status and no longer posts user-initiated settlement confirmation.

**Tech Stack:** NestJS 11, Prisma 6, PostgreSQL schema, Jest unit tests, React 19, Vite 6, TypeScript, Vitest render tests.

---

## File Structure

Create these backend files:

- `apps/api/src/features/settlement-admin/settlement-admin.service.ts`: service for previewing, confirming, listing, and detailing settlement batches.
- `apps/api/src/features/settlement-admin/settlement-admin.service.spec.ts`: TDD tests for budget, transaction, unbound, and conflict behavior.
- `apps/api/src/features/settlement-admin/settlement-admin.controller.ts`: admin routes, zod validation, and response presenters.
- `apps/api/src/features/settlement-admin/settlement-admin.controller.spec.ts`: controller validation and presentation tests.
- `apps/api/src/features/settlement-admin/settlement-admin.module.ts`: module wiring.

Modify these backend files:

- `apps/api/prisma/schema.prisma`: add `SettlementBatchStatus`, `SettlementBatch`, and `SettlementBatchItem`.
- `apps/api/src/app.module.ts`: import `SettlementAdminModule`.
- `apps/api/src/features/account/account.controller.ts`: remove user self-settlement route and unused settlement dependency.
- `apps/api/src/features/account/account.module.ts`: remove `AccountSettlementService` provider if no other code uses it.
- `apps/api/src/features/account/account-settlement.service.ts`: delete after admin settlement replaces it.
- `apps/api/src/features/account/account-settlement.service.spec.ts`: delete matching obsolete tests.

Modify these frontend files:

- `apps/web/src/types/api.ts`: add admin settlement preview, batch, item, list, and detail response types; remove the account `SettlementResult` type from page props.
- `apps/web/src/lib/aiKsApi.ts`: add admin settlement methods and remove `confirmSettlement`.
- `apps/web/src/lib/aiKsApi.test.ts`: verify new endpoint paths and auth headers.
- `apps/web/src/pages/AccountWorkspace.tsx`: remove the “确认结算” button and settlement prop/callback.
- `apps/web/src/pages/OperationsWorkspace.tsx`: add settlement preview/confirm controls and recent batches section.
- `apps/web/src/pages/pages.test.tsx`: update account tests and add admin settlement rendering tests.
- `apps/web/src/App.tsx`: add settlement state/actions and remove user self-settlement state/action.

Do not modify unrelated `.superpowers/` brainstorm artifacts.

---

### Task 1: Extend Prisma Settlement Schema

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Record baseline Prisma validation**

Run:

```bash
pnpm --filter api prisma:validate
```

Expected: PASS before edits. This establishes the schema starts valid.

- [ ] **Step 2: Add settlement batch enum and models**

Edit `apps/api/prisma/schema.prisma`.

Add this enum after `enum SettlementStatus`:

```prisma
enum SettlementBatchStatus {
  CONFIRMED
  BUDGET_INSUFFICIENT
  CONFLICTED
}
```

Add this relation field to `model Company`:

```prisma
  settlementBatches SettlementBatch[]
```

Add this relation field to `model Game`:

```prisma
  settlementBatches SettlementBatch[]
```

Add this relation field to `model UserAccount`:

```prisma
  settlementItems SettlementBatchItem[]
```

Add this relation field to `model GameOpenId`:

```prisma
  settlementItems SettlementBatchItem[]
```

Add this relation field to `model RawEcpm`:

```prisma
  settlementItem SettlementBatchItem?
```

Add these models after `model RawEcpm`:

```prisma
model SettlementBatch {
  id              String                @id @default(uuid())
  gameId          String                @map("game_id")
  companyId       String                @map("company_id")
  operatorType    PrincipalType         @map("operator_type")
  operatorId      String                @map("operator_id")
  status          SettlementBatchStatus @default(CONFIRMED)
  startedAt       DateTime              @map("started_at")
  endedAt         DateTime              @map("ended_at")
  settledAmountLi BigInt                @map("settled_amount_li")
  settledCount    Int                   @map("settled_count")
  userCount       Int                   @map("user_count")
  budgetBeforeLi  BigInt                @map("budget_before_li")
  budgetAfterLi   BigInt                @map("budget_after_li")
  configSnapshot  Json                  @map("config_snapshot")
  createdAt       DateTime              @default(now()) @map("created_at")

  game    Game                  @relation(fields: [gameId], references: [id])
  company Company               @relation(fields: [companyId], references: [id])
  items   SettlementBatchItem[]

  @@index([gameId, createdAt])
  @@index([companyId, createdAt])
  @@index([status])
  @@map("settlement_batches")
}

model SettlementBatchItem {
  id                 String   @id @default(uuid())
  batchId            String   @map("batch_id")
  rawEcpmId          String   @unique @map("raw_ecpm_id")
  userId             String   @map("user_id")
  gameOpenIdId       String   @map("game_open_id_id")
  openId             String   @map("open_id")
  displayAmountLi    BigInt   @map("display_amount_li")
  settlementAmountLi BigInt   @map("settlement_amount_li")
  createdAt          DateTime @default(now()) @map("created_at")

  batch      SettlementBatch @relation(fields: [batchId], references: [id])
  rawEcpm    RawEcpm         @relation(fields: [rawEcpmId], references: [id])
  user       UserAccount     @relation(fields: [userId], references: [id])
  gameOpenId GameOpenId      @relation(fields: [gameOpenIdId], references: [id])

  @@index([batchId])
  @@index([userId])
  @@index([gameOpenIdId])
  @@map("settlement_batch_items")
}
```

- [ ] **Step 3: Validate schema**

Run:

```bash
pnpm --filter api prisma:validate
```

Expected: PASS.

- [ ] **Step 4: Generate Prisma client**

Run:

```bash
pnpm --filter api prisma:generate
```

Expected: PASS and generated client includes `SettlementBatch`, `SettlementBatchItem`, and `SettlementBatchStatus`.

- [ ] **Step 5: Commit schema changes**

Run:

```bash
git add apps/api/prisma/schema.prisma pnpm-lock.yaml
git commit -m "feat(api): add settlement batch schema"
```

Expected: commit succeeds. `pnpm-lock.yaml` may be unchanged; omit it from `git add` if it does not appear in `git status --short`.

---

### Task 2: Implement Settlement Admin Service

**Files:**
- Create: `apps/api/src/features/settlement-admin/settlement-admin.service.ts`
- Create: `apps/api/src/features/settlement-admin/settlement-admin.service.spec.ts`

- [ ] **Step 1: Write failing service tests**

Create `apps/api/src/features/settlement-admin/settlement-admin.service.spec.ts`:

```ts
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  SettlementAdminService,
  type SettlementAdminPrisma,
} from './settlement-admin.service';

describe('SettlementAdminService', () => {
  const range = {
    endedAt: new Date('2026-05-08T23:59:59.999Z'),
    startedAt: new Date('2026-05-08T00:00:00.000Z'),
  };

  it('previews bound pending ECPM against game budget', async () => {
    const prisma = createFakePrisma();
    const service = new SettlementAdminService(prisma);

    const result = await service.previewSettlement({
      gameId: 'game-1',
      ...range,
    });

    expect(result).toMatchObject({
      budgetAfterLi: 7000n,
      budgetBeforeLi: 10000n,
      canConfirm: true,
      gameId: 'game-1',
      settlementAmountLi: 3000n,
      settlementCount: 2,
      unboundCount: 1,
      userCount: 2,
    });
  });

  it('confirms settlement by creating a batch, crediting users, and deducting budget', async () => {
    const prisma = createFakePrisma();
    const service = new SettlementAdminService(prisma);

    const result = await service.confirmSettlement({
      gameId: 'game-1',
      operatorId: 'admin',
      operatorType: 'SUPER_ADMIN',
      ...range,
    });

    expect(result.batch.status).toBe('CONFIRMED');
    expect(result.batch.settledAmountLi).toBe(3000n);
    expect(result.items).toHaveLength(2);
    expect(prisma.getGame('game-1')?.budgetLi).toBe(7000n);
    expect(prisma.getGame('game-1')?.settlementPaused).toBe(false);
    expect(prisma.getUser('user-1')?.availableBalanceLi).toBe(1000n);
    expect(prisma.getUser('user-2')?.availableBalanceLi).toBe(2000n);
    expect(prisma.getRawEcpm('ecpm-1')?.status).toBe('SETTLED');
    expect(prisma.getRawEcpm('ecpm-2')?.status).toBe('SETTLED');
    expect(prisma.getRawEcpm('ecpm-unbound')?.status).toBe('PENDING');
  });

  it('marks the game paused and rejects confirmation when budget is insufficient', async () => {
    const prisma = createFakePrisma({
      gameBudgetLi: 2500n,
    });
    const service = new SettlementAdminService(prisma);

    await expect(
      service.confirmSettlement({
        gameId: 'game-1',
        operatorId: 'admin',
        operatorType: 'SUPER_ADMIN',
        ...range,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.getGame('game-1')?.budgetLi).toBe(2500n);
    expect(prisma.getGame('game-1')?.settlementPaused).toBe(true);
    expect(prisma.getUser('user-1')?.availableBalanceLi).toBe(0n);
    expect(prisma.getRawEcpm('ecpm-1')?.status).toBe('PENDING');
    expect(prisma.getAuditActions()).toContain('settlement.budget_insufficient');
  });

  it('rejects confirmation when no bound pending ECPM exists', async () => {
    const prisma = createFakePrisma({
      includeBoundRows: false,
    });
    const service = new SettlementAdminService(prisma);

    await expect(
      service.confirmSettlement({
        gameId: 'game-1',
        operatorId: 'admin',
        operatorType: 'SUPER_ADMIN',
        ...range,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects missing games', async () => {
    const prisma = createFakePrisma();
    const service = new SettlementAdminService(prisma);

    await expect(
      service.previewSettlement({
        gameId: 'missing',
        ...range,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects concurrent settlement changes', async () => {
    const prisma = createFakePrisma({
      updateManyCountOverride: 1,
    });
    const service = new SettlementAdminService(prisma);

    await expect(
      service.confirmSettlement({
        gameId: 'game-1',
        operatorId: 'admin',
        operatorType: 'SUPER_ADMIN',
        ...range,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.getGame('game-1')?.budgetLi).toBe(10000n);
  });
});

type FakeGame = {
  id: string;
  budgetLi: bigint;
  companyId: string;
  settlementPaused: boolean;
};

type FakeOpenId = {
  id: string;
  openId: string;
  userId: string | null;
};

type FakeRawEcpm = {
  id: string;
  displayAmountLi: bigint;
  eventTime: Date;
  gameId: string;
  openId: string;
  openIdRecord: FakeOpenId | null;
  openIdRecordId: string | null;
  status: string;
};

type FakeUser = {
  id: string;
  availableBalanceLi: bigint;
};

function createFakePrisma(
  options: {
    gameBudgetLi?: bigint;
    includeBoundRows?: boolean;
    updateManyCountOverride?: number;
  } = {},
) {
  const games = new Map<string, FakeGame>([
    [
      'game-1',
      {
        budgetLi: options.gameBudgetLi ?? 10000n,
        companyId: 'company-1',
        id: 'game-1',
        settlementPaused: true,
      },
    ],
  ]);

  const openIds = new Map<string, FakeOpenId>([
    ['open-row-1', { id: 'open-row-1', openId: 'open-1', userId: 'user-1' }],
    ['open-row-2', { id: 'open-row-2', openId: 'open-2', userId: 'user-2' }],
    ['open-row-3', { id: 'open-row-3', openId: 'open-3', userId: null }],
  ]);

  const users = new Map<string, FakeUser>([
    ['user-1', { availableBalanceLi: 0n, id: 'user-1' }],
    ['user-2', { availableBalanceLi: 0n, id: 'user-2' }],
  ]);

  const rawEcpms = new Map<string, FakeRawEcpm>();
  if (options.includeBoundRows !== false) {
    rawEcpms.set('ecpm-1', {
      displayAmountLi: 1000n,
      eventTime: new Date('2026-05-08T01:00:00.000Z'),
      gameId: 'game-1',
      id: 'ecpm-1',
      openId: 'open-1',
      openIdRecord: openIds.get('open-row-1') ?? null,
      openIdRecordId: 'open-row-1',
      status: 'PENDING',
    });
    rawEcpms.set('ecpm-2', {
      displayAmountLi: 2000n,
      eventTime: new Date('2026-05-08T02:00:00.000Z'),
      gameId: 'game-1',
      id: 'ecpm-2',
      openId: 'open-2',
      openIdRecord: openIds.get('open-row-2') ?? null,
      openIdRecordId: 'open-row-2',
      status: 'PENDING',
    });
  }
  rawEcpms.set('ecpm-unbound', {
    displayAmountLi: 9000n,
    eventTime: new Date('2026-05-08T03:00:00.000Z'),
    gameId: 'game-1',
    id: 'ecpm-unbound',
    openId: 'open-3',
    openIdRecord: openIds.get('open-row-3') ?? null,
    openIdRecordId: 'open-row-3',
    status: 'PENDING',
  });

  const batches: any[] = [];
  const auditLogs: any[] = [];

  const findPendingRows = (where: any) =>
    Array.from(rawEcpms.values()).filter((row) => {
      if (row.gameId !== where.gameId) return false;
      if (row.status !== where.status) return false;
      if (row.eventTime < where.eventTime.gte) return false;
      if (row.eventTime > where.eventTime.lte) return false;
      const relationFilter = where.openIdRecord?.is;
      if (relationFilter?.userId?.not === null) {
        return row.openIdRecord?.userId !== null;
      }
      if (relationFilter?.userId === null) {
        return row.openIdRecord?.userId === null;
      }
      if (relationFilter?.userId) {
        return row.openIdRecord?.userId === relationFilter.userId;
      }
      return true;
    });

  const prisma: SettlementAdminPrisma & {
    getAuditActions(): string[];
    getGame(id: string): FakeGame | undefined;
    getRawEcpm(id: string): FakeRawEcpm | undefined;
    getUser(id: string): FakeUser | undefined;
  } = {
    $transaction: async (callback: any) => callback(prisma),
    auditLog: {
      create: async ({ data }: any) => {
        auditLogs.push(data);
        return data;
      },
    } as any,
    game: {
      findUnique: async ({ where }: any) => games.get(where.id) ?? null,
      update: async ({ data, where }: any) => {
        const game = games.get(where.id);
        if (!game) throw new Error('game not found');
        const next = {
          ...game,
          budgetLi:
            data.budgetLi?.decrement === undefined
              ? game.budgetLi
              : game.budgetLi - data.budgetLi.decrement,
          settlementPaused: data.settlementPaused ?? game.settlementPaused,
        };
        games.set(where.id, next);
        return next;
      },
    } as any,
    rawEcpm: {
      findMany: async ({ where }: any) => findPendingRows(where),
      updateMany: async ({ data, where }: any) => {
        const rows = Array.from(rawEcpms.values()).filter(
          (row) => where.id.in.includes(row.id) && row.status === where.status,
        );
        for (const row of rows) {
          row.status = data.status;
        }
        return {
          count: options.updateManyCountOverride ?? rows.length,
        };
      },
    } as any,
    settlementBatch: {
      create: async ({ data }: any) => {
        const batch = {
          ...data,
          createdAt: new Date('2026-05-08T04:00:00.000Z'),
          id: 'batch-1',
          items: data.items.create.map((item: any, index: number) => ({
            ...item,
            batchId: 'batch-1',
            createdAt: new Date('2026-05-08T04:00:00.000Z'),
            id: `item-${index + 1}`,
          })),
        };
        batches.push(batch);
        return batch;
      },
      findMany: async () => batches,
      findUnique: async ({ where }: any) =>
        batches.find((batch) => batch.id === where.id) ?? null,
    } as any,
    userAccount: {
      update: async ({ data, where }: any) => {
        const user = users.get(where.id);
        if (!user) throw new Error('user not found');
        user.availableBalanceLi += data.availableBalanceLi.increment;
        return user;
      },
    } as any,
    getAuditActions: () => auditLogs.map((row) => row.action),
    getGame: (id: string) => games.get(id),
    getRawEcpm: (id: string) => rawEcpms.get(id),
    getUser: (id: string) => users.get(id),
  };

  return prisma;
}
```

- [ ] **Step 2: Run service tests to verify failure**

Run:

```bash
pnpm --filter api test -- settlement-admin.service.spec.ts
```

Expected: FAIL because `settlement-admin.service.ts` does not exist.

- [ ] **Step 3: Implement settlement admin service**

Create `apps/api/src/features/settlement-admin/settlement-admin.service.ts`:

```ts
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PrincipalType,
  SettlementBatchStatus,
  SettlementStatus,
  type Prisma,
  type RawEcpm,
  type SettlementBatch,
  type SettlementBatchItem,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export type SettlementAdminPrisma = Pick<
  PrismaService,
  | '$transaction'
  | 'auditLog'
  | 'game'
  | 'rawEcpm'
  | 'settlementBatch'
  | 'userAccount'
>;

export type SettlementRangeInput = {
  endedAt: Date;
  gameId: string;
  startedAt: Date;
  userId?: string;
};

export type ConfirmSettlementInput = SettlementRangeInput & {
  operatorId: string;
  operatorType: PrincipalType;
};

type PendingSettlementRow = RawEcpm & {
  openIdRecord: {
    id: string;
    userId: string | null;
  } | null;
};

export type SettlementPreviewResult = {
  budgetAfterLi: bigint;
  budgetBeforeLi: bigint;
  canConfirm: boolean;
  companyId: string;
  gameId: string;
  settlementAmountLi: bigint;
  settlementCount: number;
  unboundCount: number;
  userCount: number;
};

export type SettlementBatchWithItems = SettlementBatch & {
  items: SettlementBatchItem[];
};

export type ConfirmSettlementResult = {
  batch: SettlementBatchWithItems;
  items: SettlementBatchItem[];
};

@Injectable()
export class SettlementAdminService {
  constructor(
    @Inject(PrismaService) private readonly prisma: SettlementAdminPrisma,
  ) {}

  async previewSettlement(
    input: SettlementRangeInput,
  ): Promise<SettlementPreviewResult> {
    this.assertValidRange(input);
    const game = await this.findGameOrThrow(input.gameId);
    const [boundRows, unboundRows] = await Promise.all([
      this.findPendingRows(input, true),
      this.findPendingRows(input, false),
    ]);
    const settlementAmountLi = sumDisplayAmount(boundRows);

    return {
      budgetAfterLi: game.budgetLi - settlementAmountLi,
      budgetBeforeLi: game.budgetLi,
      canConfirm: boundRows.length > 0 && game.budgetLi >= settlementAmountLi,
      companyId: game.companyId,
      gameId: game.id,
      settlementAmountLi,
      settlementCount: boundRows.length,
      unboundCount: unboundRows.length,
      userCount: countUsers(boundRows),
    };
  }

  async confirmSettlement(
    input: ConfirmSettlementInput,
  ): Promise<ConfirmSettlementResult> {
    this.assertValidRange(input);

    return this.prisma.$transaction(async (tx) => {
      const service = new SettlementAdminService(tx);
      const game = await service.findGameOrThrow(input.gameId);
      const boundRows = await service.findPendingRows(input, true);
      const unboundRows = await service.findPendingRows(input, false);

      if (boundRows.length === 0) {
        throw new BadRequestException('没有可结算收益');
      }

      const settlementAmountLi = sumDisplayAmount(boundRows);
      if (game.budgetLi < settlementAmountLi) {
        await tx.game.update({
          data: {
            settlementPaused: true,
          },
          where: {
            id: game.id,
          },
        });
        await tx.auditLog.create({
          data: {
            action: 'settlement.budget_insufficient',
            actorId: input.operatorId,
            actorType: input.operatorType,
            metadata: {
              budgetLi: game.budgetLi.toString(),
              endedAt: input.endedAt.toISOString(),
              requiredLi: settlementAmountLi.toString(),
              startedAt: input.startedAt.toISOString(),
              settlementCount: boundRows.length,
            },
            targetId: game.id,
            targetType: 'game',
          },
        });
        throw new ConflictException('游戏预算不足，已暂停该游戏结算');
      }

      const updated = await tx.rawEcpm.updateMany({
        data: {
          status: SettlementStatus.SETTLED,
        },
        where: {
          id: {
            in: boundRows.map((row) => row.id),
          },
          status: SettlementStatus.PENDING,
        },
      });

      if (updated.count !== boundRows.length) {
        await tx.auditLog.create({
          data: {
            action: 'settlement.conflict',
            actorId: input.operatorId,
            actorType: input.operatorType,
            metadata: {
              expectedCount: boundRows.length,
              updatedCount: updated.count,
            },
            targetId: game.id,
            targetType: 'game',
          },
        });
        throw new ConflictException('结算数据已变化，请重新预览');
      }

      const batch = await tx.settlementBatch.create({
        data: {
          budgetAfterLi: game.budgetLi - settlementAmountLi,
          budgetBeforeLi: game.budgetLi,
          companyId: game.companyId,
          configSnapshot: createSettlementConfigSnapshot(),
          endedAt: input.endedAt,
          gameId: game.id,
          operatorId: input.operatorId,
          operatorType: input.operatorType,
          settledAmountLi: settlementAmountLi,
          settledCount: boundRows.length,
          startedAt: input.startedAt,
          status: SettlementBatchStatus.CONFIRMED,
          userCount: countUsers(boundRows),
          items: {
            create: boundRows.map((row) => ({
              displayAmountLi: row.displayAmountLi,
              gameOpenIdId: row.openIdRecordId as string,
              openId: row.openId,
              rawEcpmId: row.id,
              settlementAmountLi: row.displayAmountLi,
              userId: row.openIdRecord?.userId as string,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      for (const [userId, amountLi] of sumByUser(boundRows)) {
        await tx.userAccount.update({
          data: {
            availableBalanceLi: {
              increment: amountLi,
            },
          },
          where: {
            id: userId,
          },
        });
      }

      await tx.game.update({
        data: {
          budgetLi: {
            decrement: settlementAmountLi,
          },
          settlementPaused: false,
        },
        where: {
          id: game.id,
        },
      });

      await tx.auditLog.create({
        data: {
          action: 'settlement.confirmed',
          actorId: input.operatorId,
          actorType: input.operatorType,
          metadata: {
            budgetAfterLi: (game.budgetLi - settlementAmountLi).toString(),
            budgetBeforeLi: game.budgetLi.toString(),
            endedAt: input.endedAt.toISOString(),
            settledAmountLi: settlementAmountLi.toString(),
            settledCount: boundRows.length,
            startedAt: input.startedAt.toISOString(),
            unboundCount: unboundRows.length,
            userCount: countUsers(boundRows),
          },
          targetId: batch.id,
          targetType: 'settlement_batch',
        },
      });

      return {
        batch: batch as SettlementBatchWithItems,
        items: batch.items,
      };
    });
  }

  listBatches(input: { gameId?: string } = {}) {
    return this.prisma.settlementBatch.findMany({
      include: {
        items: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20,
      where: input.gameId
        ? {
            gameId: input.gameId,
          }
        : undefined,
    }) as Promise<SettlementBatchWithItems[]>;
  }

  async getBatch(batchId: string) {
    const batch = await this.prisma.settlementBatch.findUnique({
      include: {
        items: true,
      },
      where: {
        id: batchId,
      },
    });

    if (!batch) {
      throw new NotFoundException(`Settlement batch ${batchId} is not found`);
    }

    return batch as SettlementBatchWithItems;
  }

  private assertValidRange(input: SettlementRangeInput) {
    if (input.startedAt > input.endedAt) {
      throw new BadRequestException('结算开始时间不能晚于结束时间');
    }
  }

  private async findGameOrThrow(gameId: string) {
    const game = await this.prisma.game.findUnique({
      where: {
        id: gameId,
      },
    });

    if (!game) {
      throw new NotFoundException(`Game ${gameId} is not found`);
    }

    return game;
  }

  private findPendingRows(input: SettlementRangeInput, bound: boolean) {
    const openIdRecordFilter = bound
      ? {
          is: input.userId
            ? {
                userId: input.userId,
              }
            : {
                userId: {
                  not: null,
                },
              },
        }
      : {
          is: {
            userId: null,
          },
        };

    return this.prisma.rawEcpm.findMany({
      include: {
        openIdRecord: true,
      },
      orderBy: {
        eventTime: 'asc',
      },
      where: {
        eventTime: {
          gte: input.startedAt,
          lte: input.endedAt,
        },
        gameId: input.gameId,
        openIdRecord: openIdRecordFilter,
        status: SettlementStatus.PENDING,
      },
    }) as Promise<PendingSettlementRow[]>;
  }
}

function createSettlementConfigSnapshot(): Prisma.InputJsonObject {
  return {
    displayAmountBasis: 'raw_ecpm.displayAmountLi',
    source: 'admin_settlement_mvp',
  };
}

function sumDisplayAmount(rows: PendingSettlementRow[]) {
  return rows.reduce((total, row) => total + row.displayAmountLi, 0n);
}

function countUsers(rows: PendingSettlementRow[]) {
  return new Set(rows.map((row) => row.openIdRecord?.userId).filter(Boolean))
    .size;
}

function sumByUser(rows: PendingSettlementRow[]) {
  const totals = new Map<string, bigint>();
  for (const row of rows) {
    const userId = row.openIdRecord?.userId;
    if (!userId) {
      continue;
    }
    totals.set(userId, (totals.get(userId) ?? 0n) + row.displayAmountLi);
  }

  return totals;
}
```

- [ ] **Step 4: Run service tests to verify pass**

Run:

```bash
pnpm --filter api test -- settlement-admin.service.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit service**

Run:

```bash
git add apps/api/src/features/settlement-admin/settlement-admin.service.ts apps/api/src/features/settlement-admin/settlement-admin.service.spec.ts
git commit -m "feat(api): add settlement admin service"
```

---

### Task 3: Add Settlement Admin Controller And Module

**Files:**
- Create: `apps/api/src/features/settlement-admin/settlement-admin.controller.ts`
- Create: `apps/api/src/features/settlement-admin/settlement-admin.controller.spec.ts`
- Create: `apps/api/src/features/settlement-admin/settlement-admin.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Write failing controller tests**

Create `apps/api/src/features/settlement-admin/settlement-admin.controller.spec.ts`:

```ts
import { BadRequestException } from '@nestjs/common';
import {
  SettlementAdminController,
  parseSettlementRange,
} from './settlement-admin.controller';

describe('parseSettlementRange', () => {
  it('parses date-only ranges into full-day UTC bounds', () => {
    expect(
      parseSettlementRange({
        endDate: '2026-05-08',
        gameId: 'game-1',
        startDate: '2026-05-08',
      }),
    ).toEqual({
      endedAt: new Date('2026-05-08T23:59:59.999Z'),
      gameId: 'game-1',
      startedAt: new Date('2026-05-08T00:00:00.000Z'),
      userId: undefined,
    });
  });

  it('rejects invalid ranges', () => {
    expect(() =>
      parseSettlementRange({
        endDate: '2026-05-07',
        gameId: 'game-1',
        startDate: '2026-05-08',
      }),
    ).toThrow(BadRequestException);
  });
});

describe('SettlementAdminController', () => {
  it('presents preview money and counts', async () => {
    const controller = new SettlementAdminController(createService());

    await expect(
      controller.preview({
        endDate: '2026-05-08',
        gameId: 'game-1',
        startDate: '2026-05-08',
      }),
    ).resolves.toMatchObject({
      budgetAfter: {
        li: '7000',
        yuan: '700.00',
      },
      canConfirm: true,
      settlementCount: 2,
      userCount: 2,
    });
  });

  it('passes current admin into confirmation', async () => {
    const service = createService();
    const controller = new SettlementAdminController(service);

    const result = await controller.confirm(
      {
        role: 'SUPER_ADMIN',
        username: 'admin',
      },
      {
        endDate: '2026-05-08',
        gameId: 'game-1',
        startDate: '2026-05-08',
      },
    );

    expect(result.batch.operatorId).toBe('admin');
    expect(service.lastOperatorId).toBe('admin');
  });
});

function createService() {
  return {
    lastOperatorId: '',
    confirmSettlement: async (input: any) => {
      const batch = {
        budgetAfterLi: 7000n,
        budgetBeforeLi: 10000n,
        companyId: 'company-1',
        createdAt: new Date('2026-05-08T04:00:00.000Z'),
        endedAt: input.endedAt,
        gameId: input.gameId,
        id: 'batch-1',
        items: [
          {
            createdAt: new Date('2026-05-08T04:00:00.000Z'),
            displayAmountLi: 1000n,
            gameOpenIdId: 'open-row-1',
            id: 'item-1',
            openId: 'open-1',
            rawEcpmId: 'ecpm-1',
            settlementAmountLi: 1000n,
            userId: 'user-1',
          },
        ],
        operatorId: input.operatorId,
        operatorType: input.operatorType,
        settledAmountLi: 3000n,
        settledCount: 2,
        startedAt: input.startedAt,
        status: 'CONFIRMED',
        userCount: 2,
      };
      (service as any).lastOperatorId = input.operatorId;
      return {
        batch,
        items: batch.items,
      };
    },
    getBatch: async () => ({
      budgetAfterLi: 7000n,
      budgetBeforeLi: 10000n,
      companyId: 'company-1',
      createdAt: new Date('2026-05-08T04:00:00.000Z'),
      endedAt: new Date('2026-05-08T23:59:59.999Z'),
      gameId: 'game-1',
      id: 'batch-1',
      items: [],
      operatorId: 'admin',
      operatorType: 'SUPER_ADMIN',
      settledAmountLi: 3000n,
      settledCount: 2,
      startedAt: new Date('2026-05-08T00:00:00.000Z'),
      status: 'CONFIRMED',
      userCount: 2,
    }),
    listBatches: async () => [],
    previewSettlement: async () => ({
      budgetAfterLi: 7000n,
      budgetBeforeLi: 10000n,
      canConfirm: true,
      companyId: 'company-1',
      gameId: 'game-1',
      settlementAmountLi: 3000n,
      settlementCount: 2,
      unboundCount: 1,
      userCount: 2,
    }),
  } as any;
}
```

- [ ] **Step 2: Run controller tests to verify failure**

Run:

```bash
pnpm --filter api test -- settlement-admin.controller.spec.ts
```

Expected: FAIL because `settlement-admin.controller.ts` does not exist.

- [ ] **Step 3: Implement controller**

Create `apps/api/src/features/settlement-admin/settlement-admin.controller.ts`:

```ts
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { AdminPrincipal } from '../admin-auth/admin-auth.service';
import { AdminJwtGuard } from '../admin-auth/admin-jwt.guard';
import { CurrentAdmin } from '../admin-auth/current-admin.decorator';
import { presentMoneyLi } from '../demo/money-presenter';
import {
  SettlementAdminService,
  type SettlementBatchWithItems,
  type SettlementRangeInput,
} from './settlement-admin.service';

const settlementRangeSchema = z.object({
  endDate: z.string().min(10),
  gameId: z.string().min(1),
  startDate: z.string().min(10),
  userId: z.string().min(1).optional(),
});

@Controller('admin/settlements')
@UseGuards(AdminJwtGuard)
export class SettlementAdminController {
  constructor(private readonly settlementAdminService: SettlementAdminService) {}

  @Get('preview')
  async preview(@Query() query: unknown) {
    const input = parseSettlementRange(query);
    const result = await this.settlementAdminService.previewSettlement(input);

    return {
      budgetAfter: presentMoneyLi(result.budgetAfterLi),
      budgetBefore: presentMoneyLi(result.budgetBeforeLi),
      canConfirm: result.canConfirm,
      companyId: result.companyId,
      gameId: result.gameId,
      settlementAmount: presentMoneyLi(result.settlementAmountLi),
      settlementCount: result.settlementCount,
      unboundCount: result.unboundCount,
      userCount: result.userCount,
    };
  }

  @Post('confirm')
  async confirm(@CurrentAdmin() admin: AdminPrincipal, @Body() body: unknown) {
    const input = parseSettlementRange(body);
    const result = await this.settlementAdminService.confirmSettlement({
      ...input,
      operatorId: admin.username,
      operatorType: admin.role,
    });

    return {
      batch: presentSettlementBatch(result.batch),
      items: result.items.map(presentSettlementItem),
    };
  }

  @Get()
  async list(@Query('gameId') gameId?: string) {
    const batches = await this.settlementAdminService.listBatches({
      gameId: gameId?.trim() || undefined,
    });

    return {
      batches: batches.map(presentSettlementBatch),
    };
  }

  @Get(':batchId')
  async detail(@Param('batchId') batchId: string) {
    const batch = await this.settlementAdminService.getBatch(batchId);

    return {
      batch: presentSettlementBatch(batch),
      items: batch.items.map(presentSettlementItem),
    };
  }
}

export function parseSettlementRange(input: unknown): SettlementRangeInput {
  const parsed = settlementRangeSchema.parse(input);
  const startedAt = parseDateBound(parsed.startDate, false);
  const endedAt = parseDateBound(parsed.endDate, true);
  if (startedAt > endedAt) {
    throw new BadRequestException('结算开始时间不能晚于结束时间');
  }

  return {
    endedAt,
    gameId: parsed.gameId,
    startedAt,
    userId: parsed.userId,
  };
}

function parseDateBound(value: string, endOfDay: boolean) {
  const datePart = value.slice(0, 10);
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(datePart)) {
    throw new BadRequestException('日期格式必须为 YYYY-MM-DD');
  }

  return new Date(`${datePart}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
}

function presentSettlementBatch(batch: SettlementBatchWithItems) {
  return {
    budgetAfter: presentMoneyLi(batch.budgetAfterLi),
    budgetBefore: presentMoneyLi(batch.budgetBeforeLi),
    companyId: batch.companyId,
    createdAt: batch.createdAt.toISOString(),
    endedAt: batch.endedAt.toISOString(),
    gameId: batch.gameId,
    id: batch.id,
    operatorId: batch.operatorId,
    operatorType: batch.operatorType,
    settledAmount: presentMoneyLi(batch.settledAmountLi),
    settledCount: batch.settledCount,
    startedAt: batch.startedAt.toISOString(),
    status: batch.status,
    userCount: batch.userCount,
  };
}

function presentSettlementItem(item: SettlementBatchWithItems['items'][number]) {
  return {
    createdAt: item.createdAt.toISOString(),
    displayAmount: presentMoneyLi(item.displayAmountLi),
    gameOpenIdId: item.gameOpenIdId,
    id: item.id,
    openId: item.openId,
    rawEcpmId: item.rawEcpmId,
    settlementAmount: presentMoneyLi(item.settlementAmountLi),
    userId: item.userId,
  };
}
```

- [ ] **Step 4: Implement module**

Create `apps/api/src/features/settlement-admin/settlement-admin.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { SettlementAdminController } from './settlement-admin.controller';
import { SettlementAdminService } from './settlement-admin.service';

@Module({
  controllers: [SettlementAdminController],
  imports: [AdminAuthModule, PrismaModule],
  providers: [SettlementAdminService],
})
export class SettlementAdminModule {}
```

- [ ] **Step 5: Wire module into AppModule**

Modify `apps/api/src/app.module.ts` to import the module:

```ts
import { SettlementAdminModule } from './features/settlement-admin/settlement-admin.module';
```

Add `SettlementAdminModule` to the `imports` array after `KuaishouRefreshModule`:

```ts
    KuaishouRefreshModule,
    SettlementAdminModule,
    WithdrawalReviewModule,
```

- [ ] **Step 6: Run controller tests**

Run:

```bash
pnpm --filter api test -- settlement-admin.controller.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Run all settlement admin tests**

Run:

```bash
pnpm --filter api test -- settlement-admin
```

Expected: PASS for both settlement admin spec files.

- [ ] **Step 8: Commit controller and module**

Run:

```bash
git add apps/api/src/app.module.ts apps/api/src/features/settlement-admin
git commit -m "feat(api): expose admin settlement endpoints"
```

---

### Task 4: Remove User Self-Settlement Backend Entry

**Files:**
- Modify: `apps/api/src/features/account/account.controller.ts`
- Modify: `apps/api/src/features/account/account.module.ts`
- Delete: `apps/api/src/features/account/account-settlement.service.ts`
- Delete: `apps/api/src/features/account/account-settlement.service.spec.ts`

- [ ] **Step 1: Verify existing account tests include self-settlement**

Run:

```bash
pnpm --filter api test -- account-settlement.service.spec.ts
```

Expected: PASS before deletion. This confirms the obsolete self-settlement service is covered before removing it.

- [ ] **Step 2: Remove account self-settlement controller route**

In `apps/api/src/features/account/account.controller.ts`, remove these imports:

```ts
import {
  AccountSettlementService,
  type ConfirmPendingEarningsResult,
} from './account-settlement.service';
```

Remove `private readonly accountSettlementService: AccountSettlementService,` from the constructor.

Remove the whole `confirmOwnPendingEarnings` method:

```ts
  @Post('me/settlements/confirm')
  @UseGuards(AccountJwtGuard)
  async confirmOwnPendingEarnings(@CurrentAccount() account: AccountPrincipal) {
    const result = await this.accountSettlementService.confirmPendingEarnings({
      userId: account.id,
    });
    await this.auditLogService.record({
      action: 'account.settlement.confirmed',
      actorId: account.id,
      actorType: 'USER',
      metadata: {
        settledAmountLi: result.settledAmountLi.toString(),
        settledCount: result.settledCount,
      },
      targetId: account.id,
      targetType: 'user_account',
    });

    return presentSettlement(result);
  }
```

Remove the `presentSettlement` helper at the bottom of the file.

- [ ] **Step 3: Remove obsolete provider**

In `apps/api/src/features/account/account.module.ts`, remove `AccountSettlementService` import and remove it from the `providers` array.

- [ ] **Step 4: Delete obsolete service and tests**

Run:

```bash
git rm apps/api/src/features/account/account-settlement.service.ts apps/api/src/features/account/account-settlement.service.spec.ts
```

Expected: the two obsolete files are staged for deletion.

- [ ] **Step 5: Run account and API tests**

Run:

```bash
pnpm --filter api test -- account
```

Expected: PASS.

Run:

```bash
pnpm --filter api test
```

Expected: PASS.

- [ ] **Step 6: Commit backend removal**

Run:

```bash
git add apps/api/src/features/account/account.controller.ts apps/api/src/features/account/account.module.ts
git commit -m "refactor(api): remove user self settlement"
```

---

### Task 5: Add Web API Types And Client Methods

**Files:**
- Modify: `apps/web/src/types/api.ts`
- Modify: `apps/web/src/lib/aiKsApi.ts`
- Modify: `apps/web/src/lib/aiKsApi.test.ts`

- [ ] **Step 1: Write failing API client tests**

Append these tests to `apps/web/src/lib/aiKsApi.test.ts` inside the existing `describe('aiKsApi', () => {` block:

```ts
  it('previews admin settlement with encoded query parameters', async () => {
    mockJsonResponse({ settlementCount: 2 });

    await aiKsApi.previewSettlement('admin-token', {
      endDate: '2026-05-08',
      gameId: 'game 1',
      startDate: '2026-05-08',
      userId: 'user-1',
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/admin/settlements/preview?gameId=game+1&startDate=2026-05-08&endDate=2026-05-08&userId=user-1',
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

  it('confirms admin settlement with the admin token', async () => {
    mockJsonResponse({ batch: { id: 'batch-1' }, items: [] });

    await aiKsApi.confirmSettlement('admin-token', {
      endDate: '2026-05-08',
      gameId: 'game-1',
      startDate: '2026-05-08',
    });

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/admin/settlements/confirm', {
      body: JSON.stringify({
        endDate: '2026-05-08',
        gameId: 'game-1',
        startDate: '2026-05-08',
      }),
      headers: {
        Authorization: 'Bearer admin-token',
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });
  });
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm --filter web test -- src/lib/aiKsApi.test.ts
```

Expected: FAIL because `previewSettlement` and `confirmSettlement` do not exist with admin signatures.

- [ ] **Step 3: Add settlement response types**

Append these types to `apps/web/src/types/api.ts` after `AdminWithdrawalDetailResult`:

```ts
export type AdminSettlementRange = {
  endDate: string;
  gameId: string;
  startDate: string;
  userId?: string;
};

export type AdminSettlementPreview = {
  budgetAfter: MoneyValue;
  budgetBefore: MoneyValue;
  canConfirm: boolean;
  companyId: string;
  gameId: string;
  settlementAmount: MoneyValue;
  settlementCount: number;
  unboundCount: number;
  userCount: number;
};

export type AdminSettlementItem = {
  createdAt: string;
  displayAmount: MoneyValue;
  gameOpenIdId: string;
  id: string;
  openId: string;
  rawEcpmId: string;
  settlementAmount: MoneyValue;
  userId: string;
};

export type AdminSettlementBatch = {
  budgetAfter: MoneyValue;
  budgetBefore: MoneyValue;
  companyId: string;
  createdAt: string;
  endedAt: string;
  gameId: string;
  id: string;
  operatorId: string;
  operatorType: string;
  settledAmount: MoneyValue;
  settledCount: number;
  startedAt: string;
  status: string;
  userCount: number;
};

export type AdminSettlementConfirmResult = {
  batch: AdminSettlementBatch;
  items: AdminSettlementItem[];
};

export type AdminSettlementListResult = {
  batches: AdminSettlementBatch[];
};

export type AdminSettlementDetailResult = {
  batch: AdminSettlementBatch;
  items: AdminSettlementItem[];
};
```

Remove the obsolete `SettlementResult` type from `apps/web/src/types/api.ts`.

- [ ] **Step 4: Update API client imports**

In `apps/web/src/lib/aiKsApi.ts`, add these imports from `../types/api`:

```ts
  AdminSettlementConfirmResult,
  AdminSettlementDetailResult,
  AdminSettlementListResult,
  AdminSettlementPreview,
  AdminSettlementRange,
```

Remove `SettlementResult` from the imports.

- [ ] **Step 5: Replace account confirm method with admin settlement methods**

Remove this method from `aiKsApi`:

```ts
  confirmSettlement(accessToken: string) {
    return requestJson<SettlementResult>('/accounts/me/settlements/confirm', {
      accessToken,
      body: {},
      method: 'POST',
    });
  },
```

Add these helpers near the admin methods:

```ts
  previewSettlement(adminAccessToken: string, range: AdminSettlementRange) {
    return requestJson<AdminSettlementPreview>(
      `/admin/settlements/preview?${settlementQuery(range)}`,
      { accessToken: adminAccessToken },
    );
  },

  confirmSettlement(adminAccessToken: string, range: AdminSettlementRange) {
    return requestJson<AdminSettlementConfirmResult>('/admin/settlements/confirm', {
      accessToken: adminAccessToken,
      body: compactSettlementRange(range),
      method: 'POST',
    });
  },

  getSettlementBatches(adminAccessToken: string, gameId?: string) {
    const query = gameId ? `?gameId=${encodeURIComponent(gameId)}` : '';
    return requestJson<AdminSettlementListResult>(`/admin/settlements${query}`, {
      accessToken: adminAccessToken,
    });
  },

  getSettlementDetail(adminAccessToken: string, batchId: string) {
    return requestJson<AdminSettlementDetailResult>(
      `/admin/settlements/${encodeURIComponent(batchId)}`,
      { accessToken: adminAccessToken },
    );
  },
```

Add these helper functions above `export const aiKsApi`:

```ts
function settlementQuery(range: AdminSettlementRange) {
  const query = new URLSearchParams({
    endDate: range.endDate,
    gameId: range.gameId,
    startDate: range.startDate,
  });
  if (range.userId?.trim()) {
    query.set('userId', range.userId.trim());
  }

  return query.toString();
}

function compactSettlementRange(range: AdminSettlementRange) {
  return {
    endDate: range.endDate,
    gameId: range.gameId,
    startDate: range.startDate,
    ...(range.userId?.trim() ? { userId: range.userId.trim() } : {}),
  };
}
```

- [ ] **Step 6: Run API client tests**

Run:

```bash
pnpm --filter web test -- src/lib/aiKsApi.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit web API client**

Run:

```bash
git add apps/web/src/types/api.ts apps/web/src/lib/aiKsApi.ts apps/web/src/lib/aiKsApi.test.ts
git commit -m "feat(web): add admin settlement api client"
```

---

### Task 6: Remove User Settlement Controls From Web

**Files:**
- Modify: `apps/web/src/pages/AccountWorkspace.tsx`
- Modify: `apps/web/src/pages/pages.test.tsx`
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Update failing account page tests**

In `apps/web/src/pages/pages.test.tsx`, modify the first `AccountWorkspace` test props by removing:

```tsx
        onConfirmSettlement={() => undefined}
```

Modify the second `AccountWorkspace` test props by removing:

```tsx
        onConfirmSettlement={() => undefined}
```

In the second `AccountWorkspace` test, change:

```ts
    expect(html.match(/<button\b[^>]*disabled=""/g)).toHaveLength(5);
    expect(html).toContain('提交中');
    expect(html).toContain('确认结算');
```

to:

```ts
    expect(html.match(/<button\b[^>]*disabled=""/g)).toHaveLength(4);
    expect(html).toContain('提交中');
    expect(html).not.toContain('确认结算');
```

- [ ] **Step 2: Run page tests to verify failure**

Run:

```bash
pnpm --filter web test -- src/pages/pages.test.tsx
```

Expected: FAIL because `AccountWorkspace` still requires `onConfirmSettlement` and renders “确认结算”.

- [ ] **Step 3: Remove account settlement props and UI**

In `apps/web/src/pages/AccountWorkspace.tsx`, remove `WalletCards` from the icon import if it becomes unused, remove `SettlementResult` from the type import, and remove these type members:

```ts
  | 'settlement'
```

```ts
  onConfirmSettlement(): void;
  settlement?: SettlementResult;
```

Remove these destructured props:

```ts
  onConfirmSettlement,
  settlement,
```

Replace the “最近结算” metric with a static balance-related label:

```tsx
        <MetricCard
          detail="等待管理员确认结算"
          label="最近结算"
          value="-"
        />
```

Remove the secondary confirm button from the withdrawal panel:

```tsx
              <Button
                disabled={!account || workspaceBusy}
                icon={<WalletCards size={16} />}
                onClick={onConfirmSettlement}
                variant="secondary"
              >
                {busyAction === 'settlement' ? '结算中' : '确认结算'}
              </Button>
```

Replace the “最近入账” readout value with a static waiting value:

```tsx
                {
                  label: '最近入账',
                  value: '-',
                },
```

- [ ] **Step 4: Remove account settlement state and action from App**

In `apps/web/src/App.tsx`, remove `SettlementResult` from API type imports.

Remove `'settlement'` from `AccountWorkspaceBusyAction` handling by deleting the case in `accountBusyAction`.

Remove this state:

```ts
  const [settlement, setSettlement] = useState<SettlementResult>();
```

Remove every `setSettlement(undefined);` call.

Remove the whole `confirmSettlement` function.

Remove these props from `AccountWorkspace`:

```tsx
          onConfirmSettlement={confirmSettlement}
          settlement={settlement}
```

- [ ] **Step 5: Run page tests**

Run:

```bash
pnpm --filter web test -- src/pages/pages.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Run web type check**

Run:

```bash
pnpm --filter web lint
```

Expected: PASS.

- [ ] **Step 7: Commit user settlement removal**

Run:

```bash
git add apps/web/src/pages/AccountWorkspace.tsx apps/web/src/pages/pages.test.tsx apps/web/src/App.tsx
git commit -m "refactor(web): remove user settlement action"
```

---

### Task 7: Add Admin Settlement Panel To Operations Workspace

**Files:**
- Modify: `apps/web/src/pages/OperationsWorkspace.tsx`
- Modify: `apps/web/src/pages/pages.test.tsx`

- [ ] **Step 1: Write failing operations workspace test**

In `apps/web/src/pages/pages.test.tsx`, update the `OperationsWorkspace` test props in both tests to include:

```tsx
        onConfirmSettlement={() => undefined}
        onPreviewSettlement={() => undefined}
        settlementEndDate="2026-05-08"
        settlementStartDate="2026-05-08"
        settlementUserId=""
        onSettlementEndDateChange={() => undefined}
        onSettlementStartDateChange={() => undefined}
        onSettlementUserIdChange={() => undefined}
        settlementBatches={[]}
```

Add this assertion to the `renders admin operations sections` test:

```ts
    expect(html).toContain('结算确认');
    expect(html).toContain('预览结算');
```

In the `disables all top-level actions while an operations action is busy` test, change:

```ts
    expect(html.match(/<button\b[^>]*disabled=""/g)).toHaveLength(6);
```

to:

```ts
    expect(html.match(/<button\b[^>]*disabled=""/g)).toHaveLength(8);
```

- [ ] **Step 2: Run page tests to verify failure**

Run:

```bash
pnpm --filter web test -- src/pages/pages.test.tsx
```

Expected: FAIL because `OperationsWorkspace` does not accept or render settlement props.

- [ ] **Step 3: Add settlement props and busy actions**

In `apps/web/src/pages/OperationsWorkspace.tsx`, import `AdminSettlementBatch` and `AdminSettlementPreview` from `../types/api`.

Extend `OperationsWorkspaceBusyAction`:

```ts
  | 'settlement-confirm'
  | 'settlement-preview'
```

Add these props to `OperationsWorkspaceProps`:

```ts
  onConfirmSettlement(): void;
  onPreviewSettlement(): void;
  onSettlementEndDateChange(value: string): void;
  onSettlementStartDateChange(value: string): void;
  onSettlementUserIdChange(value: string): void;
  settlementBatches: AdminSettlementBatch[];
  settlementEndDate: string;
  settlementPreview?: AdminSettlementPreview;
  settlementStartDate: string;
  settlementUserId: string;
```

Destructure the same props in the component parameter list.

- [ ] **Step 4: Render settlement panel**

Add this section after the ECPM refresh table and before withdrawal review:

```tsx
      <Panel description="按游戏和日期范围入账" title="结算确认">
        <div className="query-form">
          <InputField
            label="开始日期"
            onChange={onSettlementStartDateChange}
            type="date"
            value={settlementStartDate}
          />
          <InputField
            label="结束日期"
            onChange={onSettlementEndDateChange}
            type="date"
            value={settlementEndDate}
          />
          <InputField
            label="用户 ID"
            onChange={onSettlementUserIdChange}
            placeholder="可选"
            value={settlementUserId}
          />
          <div className="button-row">
            <Button
              disabled={!gameAppId || workspaceBusy}
              onClick={onPreviewSettlement}
              variant="secondary"
            >
              {busyAction === 'settlement-preview' ? '预览中' : '预览结算'}
            </Button>
            <Button
              disabled={
                !gameAppId ||
                workspaceBusy ||
                !settlementPreview?.canConfirm ||
                settlementPreview.settlementCount === 0
              }
              onClick={onConfirmSettlement}
            >
              {busyAction === 'settlement-confirm' ? '结算中' : '确认结算'}
            </Button>
          </div>
        </div>
        <ReadoutGrid
          items={[
            {
              label: '待结算金额',
              value: formatMoney(settlementPreview?.settlementAmount),
            },
            {
              label: '待结算记录',
              value: `${settlementPreview?.settlementCount ?? 0} 条`,
            },
            {
              label: '涉及用户',
              value: `${settlementPreview?.userCount ?? 0} 个`,
            },
            {
              label: '未绑定收益',
              value: `${settlementPreview?.unboundCount ?? 0} 条`,
            },
            {
              label: '当前预算',
              value: formatMoney(settlementPreview?.budgetBefore),
            },
            {
              label: '结算后预算',
              value: formatMoney(settlementPreview?.budgetAfter),
            },
          ]}
        />
        {settlementPreview && !settlementPreview.canConfirm ? (
          <StatusBadge tone="warning">预算不足或暂无可结算收益</StatusBadge>
        ) : null}
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>批次</th>
                <th>状态</th>
                <th>金额</th>
                <th>记录</th>
                <th>预算</th>
              </tr>
            </thead>
            <tbody>
              {settlementBatches.map((batch) => (
                <tr key={batch.id}>
                  <td>{batch.id}</td>
                  <td>{batch.status}</td>
                  <td>{formatMoney(batch.settledAmount)}</td>
                  <td>{batch.settledCount}</td>
                  <td>{formatMoney(batch.budgetAfter)}</td>
                </tr>
              ))}
              {settlementBatches.length === 0 ? (
                <tr>
                  <td colSpan={5}>暂无结算批次</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>
```

- [ ] **Step 5: Run page tests**

Run:

```bash
pnpm --filter web test -- src/pages/pages.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit operations settlement panel**

Run:

```bash
git add apps/web/src/pages/OperationsWorkspace.tsx apps/web/src/pages/pages.test.tsx
git commit -m "feat(web): add admin settlement panel"
```

---

### Task 8: Wire Settlement Actions Into App

**Files:**
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Add failing type-check expectation**

Run:

```bash
pnpm --filter web lint
```

Expected: FAIL because `OperationsWorkspace` now requires settlement props that `App.tsx` does not pass.

- [ ] **Step 2: Add settlement imports and busy actions**

In `apps/web/src/App.tsx`, import these API types:

```ts
  AdminSettlementBatch,
  AdminSettlementPreview,
```

Add these to `AppBusyAction`:

```ts
  | 'settlement-confirm'
  | 'settlement-preview'
```

- [ ] **Step 3: Add settlement state**

Add this helper near the top-level types:

```ts
function todayDateText() {
  return new Date().toISOString().slice(0, 10);
}
```

Add state inside `App`:

```ts
  const [settlementStartDate, setSettlementStartDate] = useState(() =>
    todayDateText(),
  );
  const [settlementEndDate, setSettlementEndDate] = useState(() =>
    todayDateText(),
  );
  const [settlementUserId, setSettlementUserId] = useState('');
  const [settlementPreview, setSettlementPreview] =
    useState<AdminSettlementPreview>();
  const [settlementBatches, setSettlementBatches] = useState<
    AdminSettlementBatch[]
  >([]);
```

Add these reset lines to `clearAdminAuth` and `signOut`:

```ts
    setSettlementPreview(undefined);
    setSettlementBatches([]);
```

- [ ] **Step 4: Add settlement range helper and actions**

Add this helper inside `App` before settlement actions:

```ts
  function getSettlementRange() {
    return {
      endDate: settlementEndDate,
      gameId: gameAppId,
      startDate: settlementStartDate,
      ...(settlementUserId.trim() ? { userId: settlementUserId.trim() } : {}),
    };
  }
```

Add these actions near other admin actions:

```ts
  async function previewSettlement() {
    if (!adminAccessToken) {
      setError('请先登录管理员账号');
      return;
    }

    await runAction('settlement-preview', async (isCurrent) => {
      const result = await aiKsApi.previewSettlement(
        adminAccessToken,
        getSettlementRange(),
      );
      if (!isCurrent()) {
        return;
      }

      setSettlementPreview(result);
      setNotice(`待结算 ${result.settlementCount} 条`);
    }, 'admin');
  }

  async function confirmSettlement() {
    if (!adminAccessToken) {
      setError('请先登录管理员账号');
      return;
    }

    await runAction('settlement-confirm', async (isCurrent) => {
      const result = await aiKsApi.confirmSettlement(
        adminAccessToken,
        getSettlementRange(),
      );
      if (!isCurrent()) {
        return;
      }

      setSettlementPreview(undefined);
      setSettlementBatches((current) => [result.batch, ...current].slice(0, 20));
      setNotice(`结算成功，入账 ${result.batch.settledCount} 条`);
    }, 'admin');
  }
```

- [ ] **Step 5: Pass settlement props to OperationsWorkspace**

Add these props to `OperationsWorkspace`:

```tsx
          onConfirmSettlement={confirmSettlement}
          onPreviewSettlement={previewSettlement}
          onSettlementEndDateChange={setSettlementEndDate}
          onSettlementStartDateChange={setSettlementStartDate}
          onSettlementUserIdChange={setSettlementUserId}
          settlementBatches={settlementBatches}
          settlementEndDate={settlementEndDate}
          settlementPreview={settlementPreview}
          settlementStartDate={settlementStartDate}
          settlementUserId={settlementUserId}
```

- [ ] **Step 6: Mark settlement actions as operations busy actions**

In `isOperationsBusyAction`, add cases:

```ts
    case 'settlement-confirm':
    case 'settlement-preview':
```

- [ ] **Step 7: Run web tests and lint**

Run:

```bash
pnpm --filter web test
```

Expected: PASS.

Run:

```bash
pnpm --filter web lint
```

Expected: PASS.

- [ ] **Step 8: Commit app wiring**

Run:

```bash
git add apps/web/src/App.tsx
git commit -m "feat(web): wire admin settlement actions"
```

---

### Task 9: Final Integration Verification

**Files:**
- Verify all changed files.

- [ ] **Step 1: Validate Prisma schema**

Run:

```bash
pnpm --filter api prisma:validate
```

Expected: PASS.

- [ ] **Step 2: Generate Prisma client**

Run:

```bash
pnpm --filter api prisma:generate
```

Expected: PASS.

- [ ] **Step 3: Run API tests**

Run:

```bash
pnpm --filter api test
```

Expected: PASS.

- [ ] **Step 4: Run web tests**

Run:

```bash
pnpm --filter web test
```

Expected: PASS.

- [ ] **Step 5: Run web build**

Run:

```bash
pnpm --filter web build
```

Expected: PASS.

- [ ] **Step 6: Run git diff check**

Run:

```bash
git diff --check
```

Expected: no output and exit 0.

- [ ] **Step 7: Start local stack**

Run:

```bash
pnpm dev
```

Expected: API listens on `API_PORT` and web listens on `WEB_PORT` from root `.env`.

- [ ] **Step 8: Browser QA**

Open the web app at the `WEB_PORT` URL from `.env`.

Verify:

- Admin login works.
- Operations workspace shows “结算确认”.
- Preview settlement shows amount, record count, users, unbound count, current budget, and after-settlement budget.
- Budget-insufficient preview disables “确认结算”.
- Account workspace no longer shows “确认结算”.

- [ ] **Step 9: Commit final fixes if needed**

If browser QA required fixes, commit them:

```bash
git add apps/api apps/web
git commit -m "fix: polish admin settlement flow"
```

If no fixes were needed, do not create an empty commit.
