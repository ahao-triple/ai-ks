# Kuaishou Token Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add super-admin managed Kuaishou Marketing API token authorization and make ECPM refresh prefer the database token over `.env`.

**Architecture:** Store one global token row in Prisma and expose guarded admin token status, authorize, and refresh endpoints. Keep external OAuth HTTP calls in a small integration client, keep state transitions in a token service, and let the existing ECPM client resolve credentials through the token service. Extend the existing Operations workspace with a compact platform authorization panel.

**Tech Stack:** Prisma, NestJS, Zod, Jest, React, Vite, Vitest, existing API client and UI components.

---

## File Structure

- Modify `apps/api/prisma/schema.prisma`: add `KuaishouTokenStatus` and `KuaishouPlatformToken`.
- Create `apps/api/src/integrations/kuaishou/kuaishou-oauth.client.ts`: HTTP client for access token and refresh token endpoints.
- Create `apps/api/src/integrations/kuaishou/kuaishou-oauth.client.spec.ts`: payload parsing and request tests.
- Create `apps/api/src/features/kuaishou-admin/kuaishou-token.service.ts`: token status, authorize, refresh, credential resolution, and error marking.
- Create `apps/api/src/features/kuaishou-admin/kuaishou-token.service.spec.ts`: service unit tests with a fake Prisma and fake OAuth client.
- Create `apps/api/src/features/kuaishou-admin/kuaishou-token.controller.ts`: guarded token admin endpoints.
- Create `apps/api/src/features/kuaishou-admin/kuaishou-token.controller.spec.ts`: controller validation and response tests.
- Modify `apps/api/src/integrations/kuaishou/kuaishou-ecpm.client.ts`: use token service for real mode credentials.
- Modify `apps/api/src/integrations/kuaishou/kuaishou-ecpm.client.spec.ts`: database token and `.env` fallback tests.
- Modify `apps/api/src/integrations/kuaishou/kuaishou.module.ts`: provide OAuth client and token service.
- Modify `apps/api/src/features/kuaishou-admin/kuaishou-refresh.controller.ts`: add admin actor, audit success/failure, mark token error.
- Modify `apps/api/src/features/kuaishou-admin/kuaishou-refresh.controller.spec.ts`: success/failure audit tests.
- Modify `apps/api/src/features/kuaishou-admin/kuaishou-refresh.module.ts`: import audit support if needed.
- Modify `apps/web/src/types/api.ts`: add token status/result types.
- Modify `apps/web/src/lib/aiKsApi.ts`: add token status, authorize, and refresh methods.
- Modify `apps/web/src/lib/aiKsApi.test.ts`: request tests for new methods.
- Modify `apps/web/src/pages/OperationsWorkspace.tsx`: platform authorization panel.
- Modify `apps/web/src/pages/pages.test.tsx`: panel render tests.
- Modify `apps/web/src/App.tsx`: token status state and actions.

## Task 1: Prisma Token Model

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add schema fields**

Add:

```prisma
enum KuaishouTokenStatus {
  UNCONFIGURED
  ACTIVE
  EXPIRED
  ERROR
}

model KuaishouPlatformToken {
  id                    String               @id @default(uuid())
  key                   String               @unique @default("default")
  appId                 String               @map("app_id")
  secret                String
  advertiserId          String?              @map("advertiser_id")
  accessToken           String?              @map("access_token")
  refreshToken          String?              @map("refresh_token")
  accessTokenExpiresAt  DateTime?            @map("access_token_expires_at")
  refreshTokenExpiresAt DateTime?            @map("refresh_token_expires_at")
  status                KuaishouTokenStatus  @default(UNCONFIGURED)
  lastError             String?              @map("last_error")
  authorizedAt          DateTime?            @map("authorized_at")
  refreshedAt           DateTime?            @map("refreshed_at")
  createdAt             DateTime             @default(now()) @map("created_at")
  updatedAt             DateTime             @updatedAt @map("updated_at")

  @@map("kuaishou_platform_tokens")
}
```

- [ ] **Step 2: Generate and validate Prisma**

Run:

```bash
pnpm --filter api prisma:generate
pnpm --filter api prisma:validate
```

Expected: both commands exit 0.

- [ ] **Step 3: Commit schema**

Run:

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(api): add kuaishou token schema"
```

## Task 2: OAuth Client And Token Service

**Files:**
- Create: `apps/api/src/integrations/kuaishou/kuaishou-oauth.client.ts`
- Create: `apps/api/src/integrations/kuaishou/kuaishou-oauth.client.spec.ts`
- Create: `apps/api/src/features/kuaishou-admin/kuaishou-token.service.ts`
- Create: `apps/api/src/features/kuaishou-admin/kuaishou-token.service.spec.ts`

- [ ] **Step 1: Write failing OAuth client tests**

Test:

- `exchangeAuthCode` POSTs JSON to `/oauth2/authorize/access_token` with `app_id`, `secret`, and `auth_code`.
- `refreshAccessToken` POSTs JSON to `/oauth2/authorize/refresh_token` with `app_id`, `secret`, and `refresh_token`.
- successful responses parse `data.access_token`, `data.refresh_token`, expiry seconds, and `advertiser_id`.
- non-zero `code` or missing token throws an error containing the response message.

- [ ] **Step 2: Run OAuth tests and verify RED**

Run:

```bash
pnpm --filter api test -- kuaishou-oauth.client.spec.ts
```

Expected: FAIL because the OAuth client does not exist.

- [ ] **Step 3: Implement OAuth client**

Implement `KuaishouOAuthClient` with:

```ts
exchangeAuthCode(input: { appId: string; secret: string; authCode: string })
refreshAccessToken(input: { appId: string; secret: string; refreshToken: string })
```

Return:

```ts
{
  accessToken: string;
  refreshToken: string;
  advertiserId?: string;
  accessTokenExpiresIn: number;
  refreshTokenExpiresIn: number;
  raw: unknown;
}
```

- [ ] **Step 4: Write failing token service tests**

Test:

- status returns unconfigured when DB and env are empty.
- status returns `source='env'` when env fallback exists.
- authorize success upserts key `default`, computes expiry dates from `now + expiresIn seconds`, clears `lastError`.
- authorize failure upserts `ERROR` and `lastError`.
- refresh success replaces old tokens and updates `refreshedAt`.
- refresh without stored refresh token throws `BadRequestException`.
- resolve credentials returns active database token before `.env`.
- expired database access token falls back to `.env`.
- mark error updates database token status to `ERROR`.

- [ ] **Step 5: Run token service tests and verify RED**

Run:

```bash
pnpm --filter api test -- kuaishou-token.service.spec.ts
```

Expected: FAIL because service does not exist.

- [ ] **Step 6: Implement token service**

Implement `KuaishouTokenService` with:

- `getStatus()`
- `authorizeWithAuthCode(input)`
- `refreshStoredToken(input)`
- `resolveReportCredentials()`
- `markTokenError(message)`

Use `ConfigService` for `.env` fallback and `PrismaService.kuaishouPlatformToken` for DB state.

- [ ] **Step 7: Run focused tests**

Run:

```bash
pnpm --filter api test -- kuaishou-oauth.client.spec.ts kuaishou-token.service.spec.ts
```

Expected: PASS.

- [ ] **Step 8: Commit OAuth and token service**

Run:

```bash
git add apps/api/src/integrations/kuaishou/kuaishou-oauth.client.ts apps/api/src/integrations/kuaishou/kuaishou-oauth.client.spec.ts apps/api/src/features/kuaishou-admin/kuaishou-token.service.ts apps/api/src/features/kuaishou-admin/kuaishou-token.service.spec.ts
git commit -m "feat(api): add kuaishou token service"
```

## Task 3: Token Controller, ECPM Credentials, And Audit

**Files:**
- Create: `apps/api/src/features/kuaishou-admin/kuaishou-token.controller.ts`
- Create: `apps/api/src/features/kuaishou-admin/kuaishou-token.controller.spec.ts`
- Modify: `apps/api/src/integrations/kuaishou/kuaishou-ecpm.client.ts`
- Modify: `apps/api/src/integrations/kuaishou/kuaishou-ecpm.client.spec.ts`
- Modify: `apps/api/src/integrations/kuaishou/kuaishou.module.ts`
- Modify: `apps/api/src/features/kuaishou-admin/kuaishou-refresh.controller.ts`
- Modify: `apps/api/src/features/kuaishou-admin/kuaishou-refresh.controller.spec.ts`
- Modify: `apps/api/src/features/kuaishou-admin/kuaishou-refresh.module.ts`

- [ ] **Step 1: Write failing controller and ECPM tests**

Controller tests:

- `status` presents token status and omits secret/access/refresh tokens.
- `authorize` trims fields and passes current admin.
- `refresh` passes current admin.
- invalid authorize body throws `BadRequestException`.

ECPM tests:

- real mode uses `resolveReportCredentials()` from token service.
- real mode falls back to env through token service.
- missing credentials throws.

Refresh controller tests:

- refresh success writes `kuaishou.ecpm_refreshed`.
- refresh failure writes `kuaishou.ecpm_refresh_failed` and calls `markTokenError`.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
pnpm --filter api test -- kuaishou-token.controller.spec.ts kuaishou-ecpm.client.spec.ts kuaishou-refresh.controller.spec.ts
```

Expected: FAIL because controller/audit behavior does not exist.

- [ ] **Step 3: Implement controller, module exports, and ECPM client changes**

Add routes:

- `GET /admin/kuaishou/token`
- `POST /admin/kuaishou/token/authorize`
- `POST /admin/kuaishou/token/refresh`

Modify `KuaishouEcpmClient` to inject `KuaishouTokenService` and call `resolveReportCredentials()` in real mode.

Modify `KuaishouModule` to provide/export `KuaishouOAuthClient` and `KuaishouTokenService`.

Modify refresh controller to inject `CurrentAdmin`, `AuditLogService`, and `KuaishouTokenService` for success/failure audit.

- [ ] **Step 4: Run API tests**

Run:

```bash
pnpm --filter api test
```

Expected: PASS.

- [ ] **Step 5: Commit backend token endpoints**

Run:

```bash
git add apps/api/src/integrations/kuaishou apps/api/src/features/kuaishou-admin
git commit -m "feat(api): expose kuaishou token management"
```

## Task 4: Web API Client

**Files:**
- Modify: `apps/web/src/types/api.ts`
- Modify: `apps/web/src/lib/aiKsApi.ts`
- Modify: `apps/web/src/lib/aiKsApi.test.ts`

- [ ] **Step 1: Write failing client tests**

Test:

- `getKuaishouTokenStatus('token')` calls `GET /admin/kuaishou/token`.
- `authorizeKuaishouToken('token', payload)` posts `appId`, `secret`, `authCode`.
- `refreshKuaishouToken('token')` posts an empty body to `/admin/kuaishou/token/refresh`.
- methods are typed as `KuaishouTokenStatusResult`.

- [ ] **Step 2: Run web client tests and verify RED**

Run:

```bash
pnpm --filter web test -- aiKsApi.test.ts
```

Expected: FAIL because methods/types do not exist.

- [ ] **Step 3: Add types and methods**

Add:

```ts
export type KuaishouTokenStatusResult = {
  accessTokenExpiresAt?: string | null;
  advertiserId?: string | null;
  appId?: string | null;
  authorizedAt?: string | null;
  configured: boolean;
  lastError?: string | null;
  refreshTokenExpiresAt?: string | null;
  refreshedAt?: string | null;
  source: 'database' | 'env' | 'none';
  status: 'ACTIVE' | 'ERROR' | 'EXPIRED' | 'UNCONFIGURED';
};
```

Add `aiKsApi` methods.

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
git commit -m "feat(web): add kuaishou token api client"
```

## Task 5: Platform Authorization Panel And App Wiring

**Files:**
- Modify: `apps/web/src/pages/OperationsWorkspace.tsx`
- Modify: `apps/web/src/pages/pages.test.tsx`
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Write failing UI and helper tests**

Page tests:

- Operations workspace renders `平台授权`.
- token status/source/appId/advertiserId/lastError are visible.
- authorize and refresh buttons call supplied callbacks.

App helper tests:

- default auth form app id uses existing token status appId when available.

- [ ] **Step 2: Run page tests and verify RED**

Run:

```bash
pnpm --filter web test -- pages.test.tsx
```

Expected: FAIL because UI/wiring does not exist.

- [ ] **Step 3: Add UI props and panel**

Add props for:

- `kuaishouTokenStatus`
- `kuaishouAppId`, `kuaishouSecret`, `kuaishouAuthCode`
- change handlers
- `onAuthorizeKuaishouToken`
- `onRefreshKuaishouToken`

Panel uses `ReadoutGrid`, `InputField`, `StatusBadge`, and existing button styles.

- [ ] **Step 4: Wire App state/actions**

State:

- `kuaishouTokenStatus`
- `kuaishouAppId`
- `kuaishouSecret`
- `kuaishouAuthCode`

Actions:

- load token status on admin entry.
- authorize token and clear auth code.
- refresh token.

Busy actions:

- `kuaishou-token`
- `kuaishou-authorize`
- `kuaishou-refresh-token`

- [ ] **Step 5: Run web tests and lint**

Run:

```bash
pnpm --filter web test
pnpm --filter web lint
```

Expected: PASS.

- [ ] **Step 6: Commit UI wiring**

Run:

```bash
git add apps/web/src/App.tsx apps/web/src/pages/OperationsWorkspace.tsx apps/web/src/pages/pages.test.tsx
git commit -m "feat(web): add kuaishou token panel"
```

## Task 6: Final Verification

**Files:**
- No edits unless verification reveals a defect.

- [ ] **Step 1: Run Prisma verification**

Run:

```bash
pnpm --filter api prisma:generate
pnpm --filter api prisma:validate
```

Expected: both pass.

- [ ] **Step 2: Run API verification**

Run:

```bash
pnpm --filter api test
pnpm --filter api build
```

Expected: tests and build pass.

- [ ] **Step 3: Run Web verification**

Run:

```bash
pnpm --filter web test
pnpm --filter web lint
pnpm --filter web build
```

Expected: tests, typecheck, and Vite build pass.

- [ ] **Step 4: Check git status**

Run:

```bash
git status --short --branch
```

Expected: `## main` with no uncommitted changes.
