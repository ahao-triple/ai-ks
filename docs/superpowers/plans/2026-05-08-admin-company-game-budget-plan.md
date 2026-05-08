# Admin Company Game Budget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the super-admin company, game, and budget management MVP so settlement budgets can be maintained from the app.

**Architecture:** Add a focused `admin-resources` API module for company/game CRUD and budget movements. Keep money conversion and response presentation consistent with existing settlement and withdrawal controllers. Extend the existing Operations workspace with one budget management panel rather than introducing a new route.

**Tech Stack:** NestJS, Prisma, Zod, Jest, React, Vite, Vitest, existing `aiKsApi` and UI components.

---

## File Structure

- Create `apps/api/src/features/admin-resources/admin-resources.service.ts`: service methods for company listing/creation, company balance adjustment, game listing/creation/update, and budget allocation.
- Create `apps/api/src/features/admin-resources/admin-resources.service.spec.ts`: service unit tests with an in-memory Prisma fake.
- Create `apps/api/src/features/admin-resources/admin-resources.controller.ts`: guarded admin routes, zod validation, money presentation.
- Create `apps/api/src/features/admin-resources/admin-resources.controller.spec.ts`: controller and parser tests.
- Create `apps/api/src/features/admin-resources/admin-resources.module.ts`: module wiring.
- Modify `apps/api/src/app.module.ts`: import `AdminResourcesModule`.
- Modify `apps/web/src/types/api.ts`: add `AdminCompany`, `AdminGame`, and result types.
- Modify `apps/web/src/lib/aiKsApi.ts`: add admin company/game/budget client methods.
- Modify `apps/web/src/lib/aiKsApi.test.ts`: add client method request tests.
- Modify `apps/web/src/pages/OperationsWorkspace.tsx`: add budget panel props and UI.
- Modify `apps/web/src/pages/pages.test.tsx`: add panel rendering tests.
- Modify `apps/web/src/App.tsx`: state, load actions, submit actions, and refresh behavior.

## Task 1: Backend Admin Resources Service

**Files:**
- Create: `apps/api/src/features/admin-resources/admin-resources.service.ts`
- Create: `apps/api/src/features/admin-resources/admin-resources.service.spec.ts`

- [ ] **Step 1: Write failing service tests**

Add tests covering these behaviors:

```ts
describe('AdminResourcesService', () => {
  it('creates a company with zero balance and writes an audit log', async () => {});
  it('adds positive company balance and records before and after amounts', async () => {});
  it('rejects non-positive company balance adjustments', async () => {});
  it('creates a game for an existing company and writes an audit log', async () => {});
  it('rejects duplicate game app ids with a conflict error', async () => {});
  it('updates only allowed game fields and records changed keys', async () => {});
  it('allocates company balance into game budget transactionally', async () => {});
  it('rejects budget allocation when company balance is insufficient', async () => {});
});
```

Use a fake Prisma object with `company`, `game`, `auditLog`, and `$transaction` methods. Store amounts as `bigint`. The fake must preserve state so assertions can verify no mutation after insufficient balance.

- [ ] **Step 2: Run service tests and verify RED**

Run:

```bash
pnpm --filter api test -- admin-resources.service.spec.ts
```

Expected: FAIL because `admin-resources.service.ts` does not exist.

- [ ] **Step 3: Implement service**

Implement:

```ts
export type AdminActor = { role: 'SUPER_ADMIN'; username: string };
export type CreateCompanyInput = { actor: AdminActor; name: string };
export type AdjustCompanyBalanceInput = {
  actor: AdminActor;
  amountLi: bigint;
  companyId: string;
  reason?: string;
};
export type CreateGameInput = {
  actor: AdminActor;
  companyId: string;
  gameAppId: string;
  gameSecret: string;
  name: string;
};
export type UpdateGameInput = {
  actor: AdminActor;
  gameId: string;
  gameSecret?: string;
  name?: string;
  settlementPaused?: boolean;
};
export type AllocateGameBudgetInput = {
  actor: AdminActor;
  amountLi: bigint;
  gameId: string;
  reason?: string;
};
```

Service methods:

- `listCompanies()`: return non-deleted companies ordered by `createdAt asc`.
- `createCompany(input)`: create company with `balanceLi: 0n`, audit `company.created`.
- `adjustCompanyBalance(input)`: reject `amountLi <= 0n`, update company balance in transaction, audit `company.balance_adjusted`.
- `listGames({ companyId } = {})`: return non-deleted games with company included, ordered by `createdAt asc`.
- `createGame(input)`: require company exists and `deletedAt: null`, catch Prisma `P2002` as `ConflictException`, audit `game.created`.
- `updateGame(input)`: require at least one allowed field, update game, audit `game.updated` with changed field names.
- `allocateGameBudget(input)`: transactionally decrement company balance with `balanceLi.gte`, increment game budget, set `settlementPaused: false`, audit `game.budget_allocated`, reject insufficient balance with `ConflictException`.

- [ ] **Step 4: Run service tests and verify GREEN**

Run:

```bash
pnpm --filter api test -- admin-resources.service.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit backend service**

Run:

```bash
git add apps/api/src/features/admin-resources/admin-resources.service.ts apps/api/src/features/admin-resources/admin-resources.service.spec.ts
git commit -m "feat(api): add admin resource budget service"
```

## Task 2: Backend Controller And Module

**Files:**
- Create: `apps/api/src/features/admin-resources/admin-resources.controller.ts`
- Create: `apps/api/src/features/admin-resources/admin-resources.controller.spec.ts`
- Create: `apps/api/src/features/admin-resources/admin-resources.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Write failing controller tests**

Add tests for:

- company list money presentation.
- create company trims name and passes current admin.
- balance adjustment converts `amountYuan` to li and defaults blank reason to `manual_adjustment`.
- game list includes `companyName`, `budget`, and `settlementPaused`.
- create game trims fields and passes current admin.
- update game rejects empty body.
- budget allocation converts `amountYuan` to li and defaults blank reason to `manual_allocation`.
- invalid amount strings throw `BadRequestException`.

- [ ] **Step 2: Run controller tests and verify RED**

Run:

```bash
pnpm --filter api test -- admin-resources.controller.spec.ts
```

Expected: FAIL because controller does not exist.

- [ ] **Step 3: Implement controller and module**

Routes:

- `GET /admin/companies`
- `POST /admin/companies`
- `POST /admin/companies/:companyId/balance-adjustments`
- `GET /admin/games`
- `POST /admin/games`
- `PATCH /admin/games/:gameId`
- `POST /admin/games/:gameId/budget-allocations`

Validation:

- trimmed non-empty strings for names, ids, app ids, secrets.
- `amountYuan` converted by `yuanToLi`; reject `<= 0n`.
- update body must contain at least one of `name`, `gameSecret`, `settlementPaused`.

Presentation:

- company `{ id, name, balance: presentMoneyLi(balanceLi), createdAt, updatedAt }`.
- game `{ id, companyId, companyName, name, gameAppId, gameSecret, budget: presentMoneyLi(budgetLi), settlementPaused, createdAt, updatedAt }`.
- budget allocation `{ company, game }`.

Module:

- provide `AdminResourcesService`.
- import `PrismaModule` and `AuditLogModule`.
- guard controller with `AdminJwtGuard`.
- import module in `AppModule`.

- [ ] **Step 4: Run controller tests and API tests**

Run:

```bash
pnpm --filter api test -- admin-resources.controller.spec.ts
pnpm --filter api test
```

Expected: PASS.

- [ ] **Step 5: Commit backend controller**

Run:

```bash
git add apps/api/src/features/admin-resources apps/api/src/app.module.ts
git commit -m "feat(api): expose admin resource budget endpoints"
```

## Task 3: Web API Types And Client

**Files:**
- Modify: `apps/web/src/types/api.ts`
- Modify: `apps/web/src/lib/aiKsApi.ts`
- Modify: `apps/web/src/lib/aiKsApi.test.ts`

- [ ] **Step 1: Write failing client tests**

Add Vitest cases for:

- `getAdminCompanies('token')` calls `GET /admin/companies` with bearer token.
- `adjustCompanyBalance('token', 'company 1', { amountYuan: '100.00', reason: 'seed' })` URL-encodes the company id and sends body.
- `getAdminGames('token', 'company 1')` appends `?companyId=company%201`.
- `createAdminGame` posts company/game fields.
- `updateAdminGame` PATCHes allowed fields.
- `allocateGameBudget('token', 'game 1', { amountYuan: '30.00', reason: 'launch' })` URL-encodes the game id and sends body.

- [ ] **Step 2: Run client tests and verify RED**

Run:

```bash
pnpm --filter web test -- aiKsApi.test.ts
```

Expected: FAIL because the client methods do not exist.

- [ ] **Step 3: Add types and client methods**

Types:

```ts
export type AdminCompany = {
  balance: MoneyValue;
  createdAt: string;
  id: string;
  name: string;
  updatedAt: string;
};

export type AdminGame = {
  budget: MoneyValue;
  companyId: string;
  companyName: string;
  createdAt: string;
  gameAppId: string;
  gameSecret: string;
  id: string;
  name: string;
  settlementPaused: boolean;
  updatedAt: string;
};
```

Client methods:

- `getAdminCompanies(adminAccessToken)`.
- `createAdminCompany(adminAccessToken, { name })`.
- `adjustCompanyBalance(adminAccessToken, companyId, { amountYuan, reason })`.
- `getAdminGames(adminAccessToken, companyId?)`.
- `createAdminGame(adminAccessToken, payload)`.
- `updateAdminGame(adminAccessToken, gameId, payload)`.
- `allocateGameBudget(adminAccessToken, gameId, payload)`.

- [ ] **Step 4: Run client tests**

Run:

```bash
pnpm --filter web test -- aiKsApi.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit web client**

Run:

```bash
git add apps/web/src/types/api.ts apps/web/src/lib/aiKsApi.ts apps/web/src/lib/aiKsApi.test.ts
git commit -m "feat(web): add admin budget api client"
```

## Task 4: Operations Budget Panel UI

**Files:**
- Modify: `apps/web/src/pages/OperationsWorkspace.tsx`
- Modify: `apps/web/src/pages/pages.test.tsx`

- [ ] **Step 1: Write failing page tests**

Add tests that render `OperationsWorkspace` with:

- two companies and one game.
- assertions for panel title `预算管理`, company balance, game budget, and paused status.
- assertions that budget buttons call `onCreateCompany`, `onAdjustCompanyBalance`, `onCreateGame`, and `onAllocateGameBudget`.

- [ ] **Step 2: Run page tests and verify RED**

Run:

```bash
pnpm --filter web test -- pages.test.tsx
```

Expected: FAIL because props and panel do not exist.

- [ ] **Step 3: Add panel props and UI**

Add props:

- `adminCompanies`, `adminGames`.
- form state values for company name, balance company id, balance amount/reason, game company id/name/app id/secret, budget game id, budget amount/reason.
- handlers for form value changes and submit actions.

Panel layout:

- `ReadoutGrid` for total company balance and total game budget.
- compact company table.
- compact game table.
- forms using existing `InputField`, `select`, and `Button`.
- disable submit buttons when workspace is busy or required fields are blank.

- [ ] **Step 4: Run page tests**

Run:

```bash
pnpm --filter web test -- pages.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit budget panel**

Run:

```bash
git add apps/web/src/pages/OperationsWorkspace.tsx apps/web/src/pages/pages.test.tsx
git commit -m "feat(web): add admin budget management panel"
```

## Task 5: App Wiring

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/pages/pages.test.tsx`

- [ ] **Step 1: Write failing app helper tests**

Add exported helpers and tests for:

- selecting default company id from company list.
- selecting default game id from game list.
- clearing or preserving form defaults after admin resources load.

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
pnpm --filter web test -- pages.test.tsx
```

Expected: FAIL because helpers and wiring do not exist.

- [ ] **Step 3: Wire state and actions**

Add state:

- `adminCompanies`, `adminGames`.
- budget form state for create company, adjust balance, create game, allocate budget.

Add actions:

- `loadAdminResources()`: load companies and games in parallel when entering admin session.
- `createAdminCompany()`: create then reload resources.
- `adjustCompanyBalance()`: adjust then reload resources.
- `createAdminGame()`: create then reload resources and update `games` context if needed by reloading demo context.
- `allocateGameBudget()`: allocate then reload resources and settlement batches for the selected game.

Unauthorized handling uses `authScope: 'admin'`.

Busy actions add:

- `admin-resources`
- `company-create`
- `company-balance`
- `game-create`
- `game-budget`

- [ ] **Step 4: Run web tests**

Run:

```bash
pnpm --filter web test
```

Expected: PASS.

- [ ] **Step 5: Commit app wiring**

Run:

```bash
git add apps/web/src/App.tsx apps/web/src/pages/pages.test.tsx
git commit -m "feat(web): wire admin budget management"
```

## Task 6: Final Verification

**Files:**
- No code edits unless verification reveals a defect.

- [ ] **Step 1: Run API verification**

Run:

```bash
pnpm --filter api test
pnpm --filter api build
```

Expected: all tests pass and Nest build exits 0.

- [ ] **Step 2: Run Web verification**

Run:

```bash
pnpm --filter web test
pnpm --filter web lint
pnpm --filter web build
```

Expected: all tests pass, TypeScript check exits 0, and Vite build succeeds.

- [ ] **Step 3: Check working tree**

Run:

```bash
git status --short --branch
```

Expected: current branch is `main` with no uncommitted changes.
