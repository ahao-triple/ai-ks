# AI-KS Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the clean new monorepo foundation for AI-KS with a NestJS API, Prisma/PostgreSQL schema baseline, pure money/config/permission domain engines, and a unified React workspace shell.

**Architecture:** This first implementation slice creates a new `apps/api` and `apps/web` without importing old code. The backend starts with pure domain modules that are easy to test before database and external API workflows are wired in; the frontend starts with role-aware navigation and the approved visual tokens so feature pages share one shell.

**Tech Stack:** pnpm workspace, NestJS, Prisma, PostgreSQL, Zod, Jest, React, Vite, Tailwind CSS, shadcn/ui-compatible CSS variables, lucide-react, TanStack Router, TanStack Table.

---

## Scope Split

The approved requirements cover several independent subsystems. This plan implements the first runnable foundation only:

- Monorepo and toolchain.
- Backend API skeleton.
- Prisma schema baseline for core entities.
- Pure amount units, money display strategy, config resolver, and permission resolver.
- Frontend app shell for user, agent, company admin, and super admin workspaces.

Payment execution, Kuaishou token refresh, ECPM sync jobs, settlement APIs, withdrawal APIs, and full UI pages should be implemented in separate follow-up plans after this foundation is green.

## File Structure

Create these files:

- `package.json`: workspace scripts and shared dev commands.
- `pnpm-workspace.yaml`: declares `apps/*` packages.
- `.gitignore`: ignores dependencies, build output, env files, logs, and OS metadata.
- `tsconfig.base.json`: shared TypeScript compiler settings.
- `apps/api/package.json`: NestJS API dependencies and scripts.
- `apps/api/tsconfig.json`: API TypeScript config.
- `apps/api/tsconfig.build.json`: API build config.
- `apps/api/nest-cli.json`: Nest compiler config.
- `apps/api/src/main.ts`: API bootstrap and global route prefix.
- `apps/api/src/app.module.ts`: root module wiring.
- `apps/api/src/health/health.controller.ts`: health endpoint.
- `apps/api/src/health/health.module.ts`: health module.
- `apps/api/src/common/prisma/prisma.module.ts`: Prisma provider module.
- `apps/api/src/common/prisma/prisma.service.ts`: Prisma service lifecycle hooks.
- `apps/api/prisma/schema.prisma`: PostgreSQL schema baseline.
- `apps/api/src/domain/money/amount.ts`: integer amount helpers.
- `apps/api/src/domain/money/display-amount.strategy.ts`: configurable display amount engine.
- `apps/api/src/domain/money/display-amount.strategy.spec.ts`: display amount tests.
- `apps/api/src/domain/config/config-resolver.ts`: override precedence resolver.
- `apps/api/src/domain/config/config-resolver.spec.ts`: config resolver tests.
- `apps/api/src/domain/authz/permission-resolver.ts`: data scope and operation permission resolver.
- `apps/api/src/domain/authz/permission-resolver.spec.ts`: permission tests.
- `apps/web/package.json`: React app dependencies and scripts.
- `apps/web/index.html`: Vite root HTML.
- `apps/web/tsconfig.json`: web TypeScript config.
- `apps/web/vite.config.ts`: Vite config.
- `apps/web/tailwind.config.ts`: Tailwind content and token mapping.
- `apps/web/postcss.config.js`: PostCSS config.
- `apps/web/src/main.tsx`: React entry.
- `apps/web/src/App.tsx`: role-aware workspace shell.
- `apps/web/src/styles.css`: visual tokens and base styles.

Modify these files:

- No old application files are modified.

Test commands:

- `pnpm install`
- `pnpm --filter api test`
- `pnpm --filter api build`
- `pnpm --filter web build`

## Task 1: Monorepo Workspace

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `.gitignore`
- Create: `tsconfig.base.json`

- [ ] **Step 1: Create root workspace files**

Create `package.json`:

```json
{
  "name": "ai-ks",
  "private": true,
  "version": "0.1.0",
  "packageManager": "pnpm@10.0.0",
  "scripts": {
    "build": "pnpm --recursive build",
    "test": "pnpm --recursive test",
    "lint": "pnpm --recursive lint",
    "dev:api": "pnpm --filter api dev",
    "dev:web": "pnpm --filter web dev",
    "prisma:generate": "pnpm --filter api prisma:generate",
    "prisma:validate": "pnpm --filter api prisma:validate"
  }
}
```

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
```

Create `.gitignore`:

```gitignore
.DS_Store
node_modules
dist
coverage
.env
.env.*
!.env.example
.turbo
.vite
*.log
```

Create `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "baseUrl": "."
  }
}
```

- [ ] **Step 2: Validate root package metadata**

Run: `pnpm -v`

Expected: prints a pnpm version. If pnpm is missing, install or enable pnpm before continuing.

- [ ] **Step 3: Commit workspace foundation**

Run:

```bash
git add package.json pnpm-workspace.yaml .gitignore tsconfig.base.json
git commit -m "chore: add pnpm workspace foundation"
```

Expected: commit succeeds with four created files.

## Task 2: NestJS API Skeleton

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/tsconfig.build.json`
- Create: `apps/api/nest-cli.json`
- Create: `apps/api/src/main.ts`
- Create: `apps/api/src/app.module.ts`
- Create: `apps/api/src/health/health.controller.ts`
- Create: `apps/api/src/health/health.module.ts`

- [ ] **Step 1: Create API package files**

Create `apps/api/package.json`:

```json
{
  "name": "api",
  "private": true,
  "version": "0.1.0",
  "scripts": {
    "build": "nest build",
    "dev": "nest start --watch",
    "start": "nest start",
    "test": "jest --runInBand",
    "lint": "eslint \"src/**/*.ts\"",
    "prisma:generate": "prisma generate",
    "prisma:validate": "prisma validate"
  },
  "dependencies": {
    "@nestjs/common": "^11.0.0",
    "@nestjs/config": "^4.0.0",
    "@nestjs/core": "^11.0.0",
    "@nestjs/jwt": "^11.0.0",
    "@nestjs/passport": "^11.0.0",
    "@nestjs/platform-express": "^11.0.0",
    "@prisma/client": "^6.0.0",
    "bcryptjs": "^3.0.0",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@nestjs/cli": "^11.0.0",
    "@nestjs/schematics": "^11.0.0",
    "@nestjs/testing": "^11.0.0",
    "@types/jest": "^29.5.14",
    "@types/node": "^22.0.0",
    "@types/passport-jwt": "^4.0.1",
    "jest": "^29.7.0",
    "prisma": "^6.0.0",
    "ts-jest": "^29.2.0",
    "ts-node": "^10.9.2",
    "typescript": "^5.7.0"
  },
  "jest": {
    "moduleFileExtensions": ["js", "json", "ts"],
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": {
      "^.+\\.(t|j)s$": "ts-jest"
    },
    "testEnvironment": "node"
  }
}
```

Create `apps/api/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "sourceMap": true,
    "declaration": true
  },
  "include": ["src/**/*.ts"]
}
```

Create `apps/api/tsconfig.build.json`:

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "dist", "**/*.spec.ts"]
}
```

Create `apps/api/nest-cli.json`:

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true
  }
}
```

- [ ] **Step 2: Create health endpoint**

Create `apps/api/src/main.ts`:

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  await app.listen(process.env.PORT ? Number(process.env.PORT) : 3000);
}

void bootstrap();
```

Create `apps/api/src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    HealthModule,
  ],
})
export class AppModule {}
```

Create `apps/api/src/health/health.controller.ts`:

```typescript
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  getHealth() {
    return {
      status: 'ok',
      service: 'ai-ks-api',
    };
  }
}
```

Create `apps/api/src/health/health.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
```

- [ ] **Step 3: Install dependencies**

Run: `pnpm install`

Expected: installs workspace dependencies and creates `pnpm-lock.yaml`.

- [ ] **Step 4: Build the API**

Run: `pnpm --filter api build`

Expected: build succeeds and creates `apps/api/dist`.

- [ ] **Step 5: Commit API skeleton**

Run:

```bash
git add pnpm-lock.yaml apps/api
git commit -m "feat(api): add nest application skeleton"
```

Expected: commit succeeds with the API scaffold and lockfile.

## Task 3: Prisma Schema Baseline

**Files:**
- Create: `apps/api/prisma/schema.prisma`
- Create: `apps/api/src/common/prisma/prisma.module.ts`
- Create: `apps/api/src/common/prisma/prisma.service.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create Prisma schema**

Create `apps/api/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum PrincipalType {
  USER
  AGENT
  COMPANY_ADMIN
  SUPER_ADMIN
}

enum WithdrawalDetailType {
  USER
  DIRECT_AGENT
  PARENT_AGENT
  DEFAULT_AGENT
  FEE
}

enum WithdrawalDetailStatus {
  PENDING_REVIEW
  APPROVED
  PAYING
  PAID
  FAILED
  MANUAL_PROCESSING
  CLOSED
}

enum SettlementStatus {
  RAW
  PENDING
  SETTLED
  PAUSED
  CLOSED
}

model Company {
  id             String    @id @default(uuid())
  name           String
  balanceLi      BigInt    @default(0) @map("balance_li")
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")
  deletedAt      DateTime? @map("deleted_at")

  games          Game[]
  admins         CompanyAdminScope[]

  @@map("companies")
}

model Game {
  id              String    @id @default(uuid())
  companyId       String    @map("company_id")
  name            String
  gameAppId       String    @unique @map("game_app_id")
  gameSecret      String    @map("game_secret")
  budgetLi        BigInt    @default(0) @map("budget_li")
  settlementPaused Boolean  @default(false) @map("settlement_paused")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")
  deletedAt       DateTime? @map("deleted_at")

  company         Company   @relation(fields: [companyId], references: [id])
  openIds         GameOpenId[]
  rawEcpms        RawEcpm[]

  @@index([companyId])
  @@map("games")
}

model UserAccount {
  id                 String    @id @default(uuid())
  username           String    @unique
  passwordHash       String    @map("password_hash")
  readableId         String    @unique @map("readable_id")
  currentAgentId     String?   @map("current_agent_id")
  alipayAccount      String?   @map("alipay_account")
  alipayRealName     String?   @map("alipay_real_name")
  availableBalanceLi BigInt    @default(0) @map("available_balance_li")
  frozenBalanceLi    BigInt    @default(0) @map("frozen_balance_li")
  createdAt          DateTime  @default(now()) @map("created_at")
  updatedAt          DateTime  @updatedAt @map("updated_at")
  deletedAt          DateTime? @map("deleted_at")

  currentAgent       Agent?    @relation(fields: [currentAgentId], references: [id])
  openIds            GameOpenId[]
  agentBindings      UserAgentBindingHistory[]

  @@index([currentAgentId])
  @@map("user_accounts")
}

model Agent {
  id                String    @id @default(uuid())
  username          String    @unique
  passwordHash      String    @map("password_hash")
  invitationCode    String    @unique @map("invitation_code")
  parentAgentId     String?   @map("parent_agent_id")
  alipayAccount     String?   @map("alipay_account")
  alipayRealName    String?   @map("alipay_real_name")
  enabled           Boolean   @default(true)
  createdAt         DateTime  @default(now()) @map("created_at")
  updatedAt         DateTime  @updatedAt @map("updated_at")
  deletedAt         DateTime? @map("deleted_at")

  parentAgent       Agent?    @relation("AgentTree", fields: [parentAgentId], references: [id])
  childAgents       Agent[]   @relation("AgentTree")
  users             UserAccount[]

  @@index([parentAgentId])
  @@map("agents")
}

model GameOpenId {
  id          String       @id @default(uuid())
  gameId      String       @map("game_id")
  userId      String?      @map("user_id")
  openId      String       @unique @map("open_id")
  readableId  String       @unique @map("readable_id")
  createdAt   DateTime     @default(now()) @map("created_at")
  updatedAt   DateTime     @updatedAt @map("updated_at")

  game        Game         @relation(fields: [gameId], references: [id])
  user        UserAccount? @relation(fields: [userId], references: [id])
  rawEcpms    RawEcpm[]

  @@index([gameId])
  @@index([userId])
  @@map("game_open_ids")
}

model RawEcpm {
  id              String           @id @default(uuid())
  gameId          String           @map("game_id")
  openIdRecordId  String?          @map("open_id_record_id")
  platformEventId String           @map("platform_event_id")
  openId          String           @map("open_id")
  rawCostLi       BigInt           @map("raw_cost_li")
  displayAmountLi BigInt           @map("display_amount_li")
  eventTime       DateTime         @map("event_time")
  status          SettlementStatus @default(PENDING)
  configSnapshot  Json             @map("config_snapshot")
  createdAt       DateTime         @default(now()) @map("created_at")

  game            Game             @relation(fields: [gameId], references: [id])
  openIdRecord    GameOpenId?      @relation(fields: [openIdRecordId], references: [id])

  @@unique([gameId, platformEventId])
  @@index([openId])
  @@index([eventTime])
  @@map("raw_ecpms")
}

model UserAgentBindingHistory {
  id          String      @id @default(uuid())
  userId      String      @map("user_id")
  fromAgentId String?     @map("from_agent_id")
  toAgentId   String?     @map("to_agent_id")
  source      String
  createdAt   DateTime    @default(now()) @map("created_at")

  user        UserAccount @relation(fields: [userId], references: [id])

  @@index([userId])
  @@map("user_agent_binding_history")
}

model CompanyAdminScope {
  id             String   @id @default(uuid())
  companyId      String   @map("company_id")
  principalId    String   @map("principal_id")
  gameIds        String[] @map("game_ids")
  operationCodes String[] @map("operation_codes")
  createdAt      DateTime @default(now()) @map("created_at")

  company        Company  @relation(fields: [companyId], references: [id])

  @@index([companyId])
  @@index([principalId])
  @@map("company_admin_scopes")
}

model WithdrawalBatch {
  id            String   @id @default(uuid())
  userId        String   @map("user_id")
  status        String
  totalAmountLi BigInt   @map("total_amount_li")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  details       WithdrawalDetail[]

  @@index([userId])
  @@map("withdrawal_batches")
}

model WithdrawalDetail {
  id                    String                 @id @default(uuid())
  batchId               String                 @map("batch_id")
  type                  WithdrawalDetailType
  status                WithdrawalDetailStatus @default(PENDING_REVIEW)
  amountLi              BigInt                 @map("amount_li")
  recipientAlipay       String                 @map("recipient_alipay")
  recipientName         String                 @map("recipient_name")
  configSnapshot        Json                   @map("config_snapshot")
  alipayRequestSnapshot Json?                  @map("alipay_request_snapshot")
  alipayResponseSnapshot Json?                 @map("alipay_response_snapshot")
  errorCode             String?                @map("error_code")
  errorMessage          String?                @map("error_message")
  createdAt             DateTime               @default(now()) @map("created_at")
  updatedAt             DateTime               @updatedAt @map("updated_at")

  batch                 WithdrawalBatch        @relation(fields: [batchId], references: [id])

  @@index([batchId])
  @@index([status])
  @@map("withdrawal_details")
}
```

- [ ] **Step 2: Add Prisma service**

Create `apps/api/src/common/prisma/prisma.service.ts`:

```typescript
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

Create `apps/api/src/common/prisma/prisma.module.ts`:

```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

Modify `apps/api/src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/prisma/prisma.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    HealthModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 3: Validate Prisma schema**

Run: `pnpm --filter api prisma:validate`

Expected: prints that `schema.prisma` is valid.

- [ ] **Step 4: Generate Prisma client**

Run: `pnpm --filter api prisma:generate`

Expected: Prisma client generation completes without schema errors.

- [ ] **Step 5: Commit schema baseline**

Run:

```bash
git add apps/api/prisma apps/api/src/common/prisma apps/api/src/app.module.ts
git commit -m "feat(api): add prisma core schema baseline"
```

Expected: commit succeeds with Prisma schema and service files.

## Task 4: Money Display Domain Engine

**Files:**
- Create: `apps/api/src/domain/money/amount.ts`
- Create: `apps/api/src/domain/money/display-amount.strategy.ts`
- Create: `apps/api/src/domain/money/display-amount.strategy.spec.ts`

- [ ] **Step 1: Write failing tests for amount conversion and display rules**

Create `apps/api/src/domain/money/display-amount.strategy.spec.ts`:

```typescript
import { liToYuan, percentOfLi, yuanToLi } from './amount';
import { computeDisplayAmount } from './display-amount.strategy';

describe('amount helpers', () => {
  it('converts yuan to li and back using integer storage', () => {
    expect(yuanToLi('1.23')).toBe(1230n);
    expect(liToYuan(1230n)).toBe('1.23');
  });

  it('calculates percentages without floating point drift', () => {
    expect(percentOfLi(999n, 50)).toBe(500n);
    expect(percentOfLi(1001n, 50)).toBe(501n);
  });
});

describe('computeDisplayAmount', () => {
  it('uses the default 50 percent display ratio', () => {
    const result = computeDisplayAmount({
      rawCostLi: 10000n,
      rule: {
        ratioPercent: 50,
      },
    });

    expect(result.displayAmountLi).toBe(5000n);
    expect(result.reason).toBe('ratio');
  });

  it('caps the displayed amount when maxDisplayLi is configured', () => {
    const result = computeDisplayAmount({
      rawCostLi: 100000n,
      rule: {
        ratioPercent: 80,
        maxDisplayLi: 30000n,
      },
    });

    expect(result.displayAmountLi).toBe(30000n);
    expect(result.reason).toBe('max_cap');
  });

  it('returns zero when the deterministic drop decision is enabled', () => {
    const result = computeDisplayAmount({
      rawCostLi: 10000n,
      rule: {
        ratioPercent: 50,
        dropPercent: 100,
      },
      randomPercent: 1,
    });

    expect(result.displayAmountLi).toBe(0n);
    expect(result.reason).toBe('dropped');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter api test -- display-amount.strategy.spec.ts`

Expected: FAIL because `amount.ts` and `display-amount.strategy.ts` do not exist.

- [ ] **Step 3: Implement amount helpers**

Create `apps/api/src/domain/money/amount.ts`:

```typescript
export function yuanToLi(value: string): bigint {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,3})?$/.test(trimmed)) {
    throw new Error('Amount must be a positive yuan value with up to 3 decimals');
  }

  const [yuanPart, decimalPart = ''] = trimmed.split('.');
  const normalizedDecimals = decimalPart.padEnd(3, '0');
  return BigInt(yuanPart) * 1000n + BigInt(normalizedDecimals);
}

export function liToYuan(value: bigint): string {
  const sign = value < 0n ? '-' : '';
  const absolute = value < 0n ? -value : value;
  const yuan = absolute / 1000n;
  const li = absolute % 1000n;
  const cents = Number((li + 5n) / 10n)
    .toString()
    .padStart(2, '0');
  return `${sign}${yuan.toString()}.${cents}`;
}

export function percentOfLi(value: bigint, percent: number): bigint {
  if (!Number.isInteger(percent) || percent < 0 || percent > 10000) {
    throw new Error('Percent must be an integer from 0 to 10000');
  }

  return (value * BigInt(percent) + 50n) / 100n;
}
```

- [ ] **Step 4: Implement display amount strategy**

Create `apps/api/src/domain/money/display-amount.strategy.ts`:

```typescript
import { percentOfLi } from './amount';

export type DisplayAmountRule = {
  ratioPercent: number;
  maxDisplayLi?: bigint;
  minDisplayLi?: bigint;
  middleDisplayLi?: bigint;
  topDisplayLi?: bigint;
  dropPercent?: number;
};

export type DisplayAmountInput = {
  rawCostLi: bigint;
  rule: DisplayAmountRule;
  randomPercent?: number;
};

export type DisplayAmountResult = {
  rawCostLi: bigint;
  displayAmountLi: bigint;
  reason: 'ratio' | 'max_cap' | 'min_floor' | 'dropped';
};

export function computeDisplayAmount(
  input: DisplayAmountInput,
): DisplayAmountResult {
  const randomPercent = input.randomPercent ?? 101;
  if (
    input.rule.dropPercent !== undefined &&
    randomPercent <= input.rule.dropPercent
  ) {
    return {
      rawCostLi: input.rawCostLi,
      displayAmountLi: 0n,
      reason: 'dropped',
    };
  }

  let displayAmountLi = percentOfLi(input.rawCostLi, input.rule.ratioPercent);
  let reason: DisplayAmountResult['reason'] = 'ratio';

  if (
    input.rule.maxDisplayLi !== undefined &&
    displayAmountLi > input.rule.maxDisplayLi
  ) {
    displayAmountLi = input.rule.maxDisplayLi;
    reason = 'max_cap';
  }

  if (
    input.rule.minDisplayLi !== undefined &&
    displayAmountLi > 0n &&
    displayAmountLi < input.rule.minDisplayLi
  ) {
    displayAmountLi = input.rule.minDisplayLi;
    reason = 'min_floor';
  }

  return {
    rawCostLi: input.rawCostLi,
    displayAmountLi,
    reason,
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter api test -- display-amount.strategy.spec.ts`

Expected: PASS for all amount and display amount tests.

- [ ] **Step 6: Commit money engine**

Run:

```bash
git add apps/api/src/domain/money
git commit -m "feat(api): add money display strategy"
```

Expected: commit succeeds with money domain tests and implementation.

## Task 5: Config and Permission Domain Engines

**Files:**
- Create: `apps/api/src/domain/config/config-resolver.ts`
- Create: `apps/api/src/domain/config/config-resolver.spec.ts`
- Create: `apps/api/src/domain/authz/permission-resolver.ts`
- Create: `apps/api/src/domain/authz/permission-resolver.spec.ts`

- [ ] **Step 1: Write failing config resolver tests**

Create `apps/api/src/domain/config/config-resolver.spec.ts`:

```typescript
import { resolveConfigValue } from './config-resolver';

describe('resolveConfigValue', () => {
  it('uses agent plus game override before game and agent overrides', () => {
    const value = resolveConfigValue({
      globalDefault: 50,
      agentDefault: 55,
      gameDefault: 60,
      agentGameOverride: 65,
    });

    expect(value).toBe(65);
  });

  it('uses game override before agent override', () => {
    const value = resolveConfigValue({
      globalDefault: 50,
      agentDefault: 55,
      gameDefault: 60,
    });

    expect(value).toBe(60);
  });

  it('falls back to global default when no overrides are present', () => {
    expect(resolveConfigValue({ globalDefault: 3 })).toBe(3);
  });
});
```

- [ ] **Step 2: Write failing permission resolver tests**

Create `apps/api/src/domain/authz/permission-resolver.spec.ts`:

```typescript
import { canAccessGame, canPerformOperation } from './permission-resolver';

describe('permission resolver', () => {
  it('allows super admin to access every game and operation', () => {
    expect(
      canAccessGame({
        principalType: 'SUPER_ADMIN',
        gameId: 'game-a',
        scopes: [],
      }),
    ).toBe(true);

    expect(
      canPerformOperation({
        principalType: 'SUPER_ADMIN',
        operationCode: 'withdrawal.review',
        scopes: [],
      }),
    ).toBe(true);
  });

  it('restricts company admins to assigned games and operations', () => {
    const scopes = [
      {
        companyId: 'company-a',
        gameIds: ['game-a'],
        operationCodes: ['settlement.confirm'],
      },
    ];

    expect(
      canAccessGame({
        principalType: 'COMPANY_ADMIN',
        gameId: 'game-a',
        scopes,
      }),
    ).toBe(true);
    expect(
      canAccessGame({
        principalType: 'COMPANY_ADMIN',
        gameId: 'game-b',
        scopes,
      }),
    ).toBe(false);
    expect(
      canPerformOperation({
        principalType: 'COMPANY_ADMIN',
        operationCode: 'withdrawal.review',
        scopes,
      }),
    ).toBe(false);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter api test -- config-resolver.spec.ts permission-resolver.spec.ts`

Expected: FAIL because resolver implementation files do not exist.

- [ ] **Step 4: Implement config resolver**

Create `apps/api/src/domain/config/config-resolver.ts`:

```typescript
export type ConfigResolutionInput<T> = {
  globalDefault: T;
  agentDefault?: T;
  gameDefault?: T;
  agentGameOverride?: T;
};

export function resolveConfigValue<T>(input: ConfigResolutionInput<T>): T {
  if (input.agentGameOverride !== undefined) {
    return input.agentGameOverride;
  }

  if (input.gameDefault !== undefined) {
    return input.gameDefault;
  }

  if (input.agentDefault !== undefined) {
    return input.agentDefault;
  }

  return input.globalDefault;
}
```

- [ ] **Step 5: Implement permission resolver**

Create `apps/api/src/domain/authz/permission-resolver.ts`:

```typescript
export type PrincipalType =
  | 'USER'
  | 'AGENT'
  | 'COMPANY_ADMIN'
  | 'SUPER_ADMIN';

export type AdminScope = {
  companyId: string;
  gameIds: string[];
  operationCodes: string[];
};

export type GameAccessInput = {
  principalType: PrincipalType;
  gameId: string;
  scopes: AdminScope[];
};

export type OperationAccessInput = {
  principalType: PrincipalType;
  operationCode: string;
  scopes: AdminScope[];
};

export function canAccessGame(input: GameAccessInput): boolean {
  if (input.principalType === 'SUPER_ADMIN') {
    return true;
  }

  if (input.principalType !== 'COMPANY_ADMIN') {
    return false;
  }

  return input.scopes.some((scope) => scope.gameIds.includes(input.gameId));
}

export function canPerformOperation(input: OperationAccessInput): boolean {
  if (input.principalType === 'SUPER_ADMIN') {
    return true;
  }

  if (input.principalType !== 'COMPANY_ADMIN') {
    return false;
  }

  return input.scopes.some((scope) =>
    scope.operationCodes.includes(input.operationCode),
  );
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter api test -- config-resolver.spec.ts permission-resolver.spec.ts`

Expected: PASS for config and permission resolver tests.

- [ ] **Step 7: Commit config and permission engines**

Run:

```bash
git add apps/api/src/domain/config apps/api/src/domain/authz
git commit -m "feat(api): add config and permission resolvers"
```

Expected: commit succeeds with resolver tests and implementations.

## Task 6: React Workspace Shell

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/index.html`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/postcss.config.js`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/styles.css`

- [ ] **Step 1: Create web package config**

Create `apps/web/package.json`:

```json
{
  "name": "web",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "test": "echo \"web tests are added with feature pages\"",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@tanstack/react-table": "^8.20.0",
    "@tanstack/react-router": "^1.80.0",
    "clsx": "^2.1.1",
    "lucide-react": "^0.468.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "tailwind-merge": "^2.5.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.7.0",
    "vite": "^6.0.0"
  }
}
```

Create `apps/web/index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI-KS</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `apps/web/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "allowSyntheticDefaultImports": true,
    "isolatedModules": true,
    "noEmit": true,
    "types": ["vite/client"]
  },
  "include": ["src", "vite.config.ts", "tailwind.config.ts"]
}
```

Create `apps/web/vite.config.ts`:

```typescript
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
});
```

Create `apps/web/postcss.config.js`:

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

Create `apps/web/tailwind.config.ts`:

```typescript
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        surface: 'var(--surface)',
        border: 'var(--border)',
        primary: 'var(--primary)',
        muted: 'var(--muted)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
      },
    },
  },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 2: Create React shell**

Create `apps/web/src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

Create `apps/web/src/App.tsx`:

```tsx
import {
  Banknote,
  Building2,
  Gamepad2,
  Gauge,
  HandCoins,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react';

type WorkspaceRole = '用户' | '代理' | '公司管理员' | '超级管理员';

const navByRole: Record<WorkspaceRole, Array<{ label: string; icon: typeof Gauge }>> = {
  用户: [
    { label: '收益查询', icon: Gauge },
    { label: 'ID 绑定', icon: Gamepad2 },
    { label: '提现记录', icon: Banknote },
  ],
  代理: [
    { label: '收益概览', icon: HandCoins },
    { label: '名下用户', icon: Users },
    { label: '收款信息', icon: Banknote },
  ],
  公司管理员: [
    { label: '游戏数据', icon: Gamepad2 },
    { label: '结算审核', icon: ShieldCheck },
    { label: '提现审核', icon: Banknote },
  ],
  超级管理员: [
    { label: '全局概览', icon: Gauge },
    { label: '公司与游戏', icon: Building2 },
    { label: '代理配置', icon: Users },
    { label: '系统配置', icon: Settings },
  ],
};

const roles = Object.keys(navByRole) as WorkspaceRole[];

export function App() {
  const activeRole: WorkspaceRole = '超级管理员';
  const navItems = navByRole[activeRole];

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">KS</span>
          <div>
            <strong>AI-KS</strong>
            <span>运营后台</span>
          </div>
        </div>

        <div className="role-switcher" aria-label="身份预览">
          {roles.map((role) => (
            <button
              className={role === activeRole ? 'role-chip active' : 'role-chip'}
              key={role}
              type="button"
            >
              {role}
            </button>
          ))}
        </div>

        <nav className="nav-list" aria-label="主导航">
          {navItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <a className={index === 0 ? 'nav-item active' : 'nav-item'} href="#" key={item.label}>
                <Icon size={18} />
                <span>{item.label}</span>
              </a>
            );
          })}
        </nav>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p>超级管理员工作台</p>
            <h1>全局运营概览</h1>
          </div>
          <button className="primary-action" type="button">
            <Settings size={16} />
            配置中心
          </button>
        </header>

        <section className="metric-grid" aria-label="关键指标">
          <article className="metric-card">
            <span>今日展示金额</span>
            <strong>¥ 12,480.36</strong>
            <p>基于 display_amount 统计</p>
          </article>
          <article className="metric-card">
            <span>待结算收益</span>
            <strong>¥ 8,230.10</strong>
            <p>等待授权人员确认</p>
          </article>
          <article className="metric-card">
            <span>打款异常</span>
            <strong>6</strong>
            <p>明细独立处理</p>
          </article>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>待处理事项</h2>
          <p>当前视图展示静态演示数据，接口接入在独立任务中完成。</p>
            </div>
          </div>
          <div className="table">
            <div className="table-row table-head">
              <span>类型</span>
              <span>范围</span>
              <span>状态</span>
            </div>
            <div className="table-row">
              <span>游戏预算</span>
              <span>开心消消</span>
              <span className="status warning">预警</span>
            </div>
            <div className="table-row">
              <span>平台 token</span>
              <span>全局 MAPI</span>
              <span className="status success">正常</span>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
```

Create `apps/web/src/styles.css`:

```css
:root {
  --background: #faf9f5;
  --foreground: #141413;
  --surface: #ffffff;
  --surface-soft: #f5f0e8;
  --surface-muted: #efe9de;
  --border: #e6dfd8;
  --muted: #6c6a64;
  --primary: #cc785c;
  --primary-hover: #a9583e;
  --primary-soft: #f4ded5;
  --success: #4f9f65;
  --success-soft: #e4f3e8;
  --warning: #d4a017;
  --warning-soft: #fbf0cc;
  --danger: #c64545;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
    "Segoe UI", sans-serif;
  color: var(--foreground);
  background: var(--background);
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
}

button,
a {
  font: inherit;
}

.app-shell {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  min-height: 100vh;
  background: var(--background);
}

.sidebar {
  border-right: 1px solid var(--border);
  background: var(--surface);
  padding: 20px;
}

.brand {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 20px;
}

.brand-mark {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: var(--primary-soft);
  color: var(--primary-hover);
  font-weight: 700;
}

.brand strong,
.brand span {
  display: block;
}

.brand span {
  color: var(--muted);
  font-size: 12px;
}

.role-switcher {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
}

.role-chip {
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--muted);
  padding: 6px 10px;
  cursor: pointer;
}

.role-chip.active {
  border-color: var(--primary);
  background: var(--primary-soft);
  color: var(--primary-hover);
}

.nav-list {
  display: grid;
  gap: 6px;
}

.nav-item {
  display: flex;
  gap: 10px;
  align-items: center;
  min-height: 38px;
  border-radius: 8px;
  padding: 8px 10px;
  color: var(--muted);
  text-decoration: none;
}

.nav-item.active {
  background: var(--primary-soft);
  color: var(--primary-hover);
}

.content {
  padding: 24px;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.topbar p,
.topbar h1 {
  margin: 0;
}

.topbar p {
  color: var(--muted);
  font-size: 13px;
}

.topbar h1 {
  font-size: 24px;
  font-weight: 650;
}

.primary-action {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  border: 0;
  border-radius: 8px;
  background: var(--primary);
  color: white;
  padding: 10px 14px;
  cursor: pointer;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}

.metric-card,
.panel {
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
}

.metric-card {
  padding: 16px;
}

.metric-card span,
.metric-card p {
  color: var(--muted);
  font-size: 13px;
}

.metric-card strong {
  display: block;
  margin-top: 8px;
  font-size: 24px;
}

.panel {
  overflow: hidden;
}

.panel-heading {
  padding: 16px;
  border-bottom: 1px solid var(--border);
}

.panel-heading h2,
.panel-heading p {
  margin: 0;
}

.panel-heading h2 {
  font-size: 18px;
}

.panel-heading p {
  margin-top: 4px;
  color: var(--muted);
  font-size: 13px;
}

.table {
  display: grid;
}

.table-row {
  display: grid;
  grid-template-columns: 1fr 1fr 140px;
  gap: 12px;
  align-items: center;
  min-height: 44px;
  padding: 0 16px;
  border-bottom: 1px solid var(--border);
}

.table-row:last-child {
  border-bottom: 0;
}

.table-head {
  background: var(--surface-soft);
  color: var(--muted);
  font-size: 13px;
  font-weight: 600;
}

.status {
  width: fit-content;
  border-radius: 999px;
  padding: 4px 8px;
  font-size: 12px;
  font-weight: 600;
}

.status.warning {
  background: var(--warning-soft);
  color: #8a6100;
}

.status.success {
  background: var(--success-soft);
  color: #2f7044;
}

@media (max-width: 860px) {
  .app-shell {
    grid-template-columns: 1fr;
  }

  .sidebar {
    border-right: 0;
    border-bottom: 1px solid var(--border);
  }

  .metric-grid {
    grid-template-columns: 1fr;
  }

  .topbar {
    align-items: flex-start;
    flex-direction: column;
    gap: 12px;
  }
}
```

- [ ] **Step 3: Build the web app**

Run: `pnpm --filter web build`

Expected: TypeScript and Vite build both succeed.

- [ ] **Step 4: Commit web shell**

Run:

```bash
git add apps/web
git commit -m "feat(web): add role aware workspace shell"
```

Expected: commit succeeds with the web app foundation.

## Task 7: Whole-Workspace Verification

**Files:**
- No file creation.

- [ ] **Step 1: Run backend tests**

Run: `pnpm --filter api test`

Expected: all API unit tests pass.

- [ ] **Step 2: Build backend**

Run: `pnpm --filter api build`

Expected: API build succeeds.

- [ ] **Step 3: Build frontend**

Run: `pnpm --filter web build`

Expected: web build succeeds.

- [ ] **Step 4: Check git status**

Run: `git status --short`

Expected: only intentionally untracked legacy/reference files remain outside the new foundation, such as `old/` and existing design docs if they have not been committed.

- [ ] **Step 5: Commit verification note if needed**

If no source files changed during verification, do not create a commit. If build or test fixes changed the API money engine, commit the fix:

```bash
git add apps/api/src/domain/money apps/api/package.json
git commit -m "chore: stabilize foundation verification"
```

If build or test fixes changed the web shell, commit the fix:

```bash
git add apps/web
git commit -m "chore: stabilize web shell verification"
```

Expected: no uncommitted changes in `apps/api`, `apps/web`, root workspace config, or `pnpm-lock.yaml`.

## Self-Review Checklist

- Spec coverage in this plan:
  - Covered: clean new project boundary, no HeroUI, backend NestJS + Prisma foundation, amount unit storage, display amount strategy, configurable precedence, permission baseline, four-role frontend shell.
  - Not covered in this first plan: Kuaishou token APIs, ECPM sync jobs, settlement workflow APIs, withdrawal/payment execution, audit log persistence, full CRUD screens. These are intentionally assigned to separate implementation plans because they are independently testable subsystems.
- Placeholder scan: this plan contains no placeholder values or unspecified code steps.
- Type consistency: `displayAmountLi`, `rawCostLi`, `ratioPercent`, `AdminScope`, and `PrincipalType` are defined before use and reused consistently.
