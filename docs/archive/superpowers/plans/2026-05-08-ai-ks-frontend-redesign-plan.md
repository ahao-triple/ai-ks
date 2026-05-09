# AI-KS Frontend Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current single-file React frontend with a clean login entry, guest query mode, dashboard shell, reusable UI primitives, and page modules that follow `DESIGN.md`.

**Architecture:** Split `apps/web/src/App.tsx` into typed API helpers, session state, layouts, UI primitives, and feature pages. The frontend only organizes display by current identity mode; backend responses remain the source of authorization truth and are surfaced through centralized error handling.

**Tech Stack:** React 19, Vite 6, TypeScript, CSS design tokens, lucide-react icons, Vitest for pure unit and render-to-static-markup tests.

---

## File Structure

Create or modify these frontend files:

- Modify: `apps/web/package.json` for real `test` script.
- Modify: `apps/web/src/main.tsx` only if imports need updated paths.
- Replace: `apps/web/src/App.tsx` with application orchestration.
- Replace: `apps/web/src/styles.css` with design tokens, layout, components, and responsive rules.
- Create: `apps/web/src/types/api.ts` for API response types currently embedded in `App.tsx`.
- Create: `apps/web/src/lib/api.ts` for request, response, and error normalization.
- Create: `apps/web/src/lib/aiKsApi.ts` for endpoint-specific API methods.
- Create: `apps/web/src/lib/auth.ts` for storage keys and token persistence helpers.
- Create: `apps/web/src/lib/format.ts` for money, date, and metadata formatting.
- Create: `apps/web/src/app/session.ts` for frontend session mode and navigation model.
- Create: `apps/web/src/app/session.test.ts` for session and nav behavior.
- Create: `apps/web/src/lib/api.test.ts` for error normalization.
- Create: `apps/web/src/lib/aiKsApi.test.ts` for endpoint path and auth header behavior.
- Create: `apps/web/src/lib/format.test.ts` for formatting behavior.
- Create: `apps/web/src/components/ui/Button.tsx`.
- Create: `apps/web/src/components/ui/InputField.tsx`.
- Create: `apps/web/src/components/ui/Panel.tsx`.
- Create: `apps/web/src/components/ui/MetricCard.tsx`.
- Create: `apps/web/src/components/ui/StatusBadge.tsx`.
- Create: `apps/web/src/components/ui/Alert.tsx`.
- Create: `apps/web/src/components/ui/DataTable.tsx`.
- Create: `apps/web/src/components/ui/index.ts`.
- Create: `apps/web/src/components/ui/ui.test.tsx`.
- Create: `apps/web/src/components/domain/EcpmTable.tsx`.
- Create: `apps/web/src/components/domain/ReadoutGrid.tsx`.
- Create: `apps/web/src/components/domain/WithdrawalBatchTable.tsx`.
- Create: `apps/web/src/components/domain/AuditLogTable.tsx`.
- Create: `apps/web/src/components/domain/index.ts`.
- Create: `apps/web/src/layouts/AuthLayout.tsx`.
- Create: `apps/web/src/layouts/DashboardLayout.tsx`.
- Create: `apps/web/src/layouts/layouts.test.tsx`.
- Create: `apps/web/src/pages/LoginPage.tsx`.
- Create: `apps/web/src/pages/GuestQueryPage.tsx`.
- Create: `apps/web/src/pages/AccountWorkspace.tsx`.
- Create: `apps/web/src/pages/OperationsWorkspace.tsx`.
- Create: `apps/web/src/pages/pages.test.tsx`.

The `.superpowers/` brainstorm files are local artifacts and must not be committed.

---

### Task 1: Add Web Test Harness

**Files:**
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Install Vitest**

Run:

```bash
pnpm --filter web add -D vitest
```

Expected: `apps/web/package.json` gains `vitest` in `devDependencies` and `pnpm-lock.yaml` updates.

- [ ] **Step 2: Update web scripts**

Edit `apps/web/package.json` scripts to:

```json
{
  "dev": "vite",
  "build": "tsc --noEmit && vite build",
  "test": "vitest run --passWithNoTests",
  "lint": "tsc --noEmit"
}
```

- [ ] **Step 3: Verify empty test harness**

Run:

```bash
pnpm --filter web test
```

Expected: command exits 0. Output may report no test files.

- [ ] **Step 4: Commit test harness**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "test(web): add vitest harness"
```

---

### Task 2: Extract API Types And Format Helpers

**Files:**
- Create: `apps/web/src/types/api.ts`
- Create: `apps/web/src/lib/format.ts`
- Create: `apps/web/src/lib/format.test.ts`

- [ ] **Step 1: Write failing format tests**

Create `apps/web/src/lib/format.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatAuditMetadata, formatDateTime, formatMoney } from './format';

describe('formatMoney', () => {
  it('formats missing money as yuan zero', () => {
    expect(formatMoney()).toBe('¥ 0.00');
  });

  it('formats the yuan string from API money values', () => {
    expect(formatMoney({ li: '1234', yuan: '123.40' })).toBe('¥ 123.40');
  });
});

describe('formatDateTime', () => {
  it('formats ISO timestamps with the local date and time text', () => {
    expect(formatDateTime('2026-05-08T01:02:03.000Z')).toContain('2026');
  });

  it('returns dash for missing timestamps', () => {
    expect(formatDateTime()).toBe('-');
  });
});

describe('formatAuditMetadata', () => {
  it('returns dash for missing metadata', () => {
    expect(formatAuditMetadata(null)).toBe('-');
  });

  it('prints at most three metadata entries', () => {
    expect(
      formatAuditMetadata({ a: 1, b: 'two', c: true, d: 'hidden' }),
    ).toBe('a:1 / b:two / c:true');
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm --filter web test -- src/lib/format.test.ts
```

Expected: FAIL because `src/lib/format.ts` does not exist.

- [ ] **Step 3: Create shared API types**

Create `apps/web/src/types/api.ts`:

```ts
export type MoneyValue = {
  li: string;
  yuan: string;
};

export type DemoGame = {
  companyName: string;
  gameAppId: string;
  id: string;
  name: string;
};

export type IntegrationStatus = {
  kuaishouApiMode: 'mock' | 'real';
  requiredForRealMode: {
    kuaishouAccessToken: boolean;
    kuaishouAdvertiserId: boolean;
  };
};

export type GameSessionResult = {
  game: {
    gameAppId: string;
    name: string;
  };
  openId: string;
  readableId: string;
};

export type EcpmRow = {
  displayAmount: MoneyValue;
  eventTime: string;
  gameAppId: string;
  openId: string;
  platformEventId: string;
  rawCost: MoneyValue;
};

export type EcpmRefreshResult = {
  requestedOpenIds: string[];
  rows: EcpmRow[];
  savedCount: number;
  source: 'mock' | 'kuaishou';
};

export type EarningsResult = {
  date: string;
  identity: string;
  openId: string;
  readableId?: string;
  rows: EcpmRow[];
  totalDisplayAmount: MoneyValue;
  totalRawCost: MoneyValue;
};

export type AccountResult = {
  id: string;
  readableId: string;
  username: string;
};

export type AuthResult = {
  accessToken: string;
  account: AccountResult;
};

export type AdminAuthResult = {
  accessToken: string;
  admin: {
    role: 'SUPER_ADMIN';
    username: string;
  };
};

export type AccountEarningsResult = {
  date: string;
  openIds: string[];
  rows: EcpmRow[];
  totalDisplayAmount: MoneyValue;
  totalRawCost: MoneyValue;
  userId: string;
};

export type AlipayProfile = {
  alipayAccount: string | null;
  alipayRealName: string | null;
};

export type WithdrawalResult = {
  details: Array<{
    amount: MoneyValue;
    alipayRequestSnapshot?: unknown;
    alipayResponseSnapshot?: unknown;
    errorCode?: string | null;
    errorMessage?: string | null;
    recipientAlipay: string;
    recipientName: string;
    status: string;
    type: string;
  }>;
  id: string;
  status: string;
  totalAmount: MoneyValue;
};

export type AdminWithdrawalBatch = WithdrawalResult & {
  createdAt: string;
  updatedAt: string;
  userId: string;
};

export type AdminWithdrawalListResult = {
  batches: AdminWithdrawalBatch[];
};

export type SettlementResult = {
  settledAmount: MoneyValue;
  settledCount: number;
  userId: string;
};

export type AuditLogRow = {
  action: string;
  actorId: string;
  actorType: string;
  createdAt: string;
  id: string;
  metadata: unknown;
  targetId: string;
  targetType: string;
};

export type AuditLogListResult = {
  logs: AuditLogRow[];
};

export type AdminWithdrawalDetailResult = {
  auditLogs: AuditLogRow[];
  batch: AdminWithdrawalBatch;
};
```

- [ ] **Step 4: Implement format helpers**

Create `apps/web/src/lib/format.ts`:

```ts
import type { MoneyValue } from '../types/api';

export function formatMoney(money?: MoneyValue): string {
  return `¥ ${money?.yuan ?? '0.00'}`;
}

export function formatDateTime(value?: string): string {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString();
}

export function formatAuditMetadata(metadata: unknown): string {
  if (!metadata || typeof metadata !== 'object') {
    return '-';
  }

  return Object.entries(metadata as Record<string, unknown>)
    .slice(0, 3)
    .map(([key, value]) => `${key}:${String(value)}`)
    .join(' / ');
}
```

- [ ] **Step 5: Verify format tests pass**

Run:

```bash
pnpm --filter web test -- src/lib/format.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit type and format extraction**

```bash
git add apps/web/src/types/api.ts apps/web/src/lib/format.ts apps/web/src/lib/format.test.ts
git commit -m "refactor(web): extract api types and format helpers"
```

---

### Task 3: Centralize API Errors And Requests

**Files:**
- Create: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/lib/api.test.ts`

- [ ] **Step 1: Write failing API error tests**

Create `apps/web/src/lib/api.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ApiError, createHeaders, readApiErrorMessage, readResponse } from './api';

describe('readApiErrorMessage', () => {
  it('joins array messages from validation errors', () => {
    expect(readApiErrorMessage({ message: ['账号必填', '密码必填'] }, 400)).toBe(
      '账号必填；密码必填',
    );
  });

  it('uses string message from API payload', () => {
    expect(readApiErrorMessage({ message: '无权限' }, 403)).toBe('无权限');
  });

  it('maps duplicate submissions', () => {
    expect(readApiErrorMessage({}, 409)).toBe('数据已存在，请勿重复提交');
  });

  it('maps bad requests', () => {
    expect(readApiErrorMessage({}, 400)).toBe('请求参数错误，请检查输入');
  });
});

describe('readResponse', () => {
  it('returns JSON payloads when response is ok', async () => {
    const response = new Response(JSON.stringify({ ok: true }), {
      headers: { 'content-type': 'application/json' },
      status: 200,
    });

    await expect(readResponse<{ ok: boolean }>(response)).resolves.toEqual({
      ok: true,
    });
  });

  it('throws ApiError with status and message when response fails', async () => {
    const response = new Response(JSON.stringify({ message: '登录失效' }), {
      headers: { 'content-type': 'application/json' },
      status: 401,
    });

    await expect(readResponse(response)).rejects.toMatchObject({
      message: '登录失效',
      status: 401,
    });
  });
});

describe('createHeaders', () => {
  it('omits authorization for guest requests', () => {
    expect(createHeaders()).toEqual({ 'Content-Type': 'application/json' });
  });

  it('adds bearer token when provided', () => {
    expect(createHeaders('token-1')).toEqual({
      Authorization: 'Bearer token-1',
      'Content-Type': 'application/json',
    });
  });
});

describe('ApiError', () => {
  it('stores the HTTP status', () => {
    expect(new ApiError('无权限', 403).status).toBe(403);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm --filter web test -- src/lib/api.test.ts
```

Expected: FAIL because `src/lib/api.ts` does not exist.

- [ ] **Step 3: Implement centralized API helpers**

Create `apps/web/src/lib/api.ts`:

```ts
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() || '/api';

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export type RequestMethod = 'GET' | 'PATCH' | 'POST';

export function createHeaders(accessToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return headers;
}

export async function requestJson<T>(
  path: string,
  options: {
    accessToken?: string;
    body?: unknown;
    method?: RequestMethod;
  } = {},
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    headers: createHeaders(options.accessToken),
    method: options.method ?? 'GET',
  });

  return readResponse<T>(response);
}

export async function readResponse<T>(response: Response): Promise<T> {
  const payload = await readPayload(response);
  if (!response.ok) {
    throw new ApiError(readApiErrorMessage(payload, response.status), response.status);
  }

  return payload as T;
}

export async function readPayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return response.text();
  }

  return response.json();
}

export function readApiErrorMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message?: unknown }).message;
    if (Array.isArray(message)) {
      return message.join('；');
    }

    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }

  if (typeof payload === 'string' && payload.length > 0) {
    return payload;
  }

  if (status === 403) {
    return '无权限访问该操作';
  }

  if (status === 409) {
    return '数据已存在，请勿重复提交';
  }

  if (status === 400) {
    return '请求参数错误，请检查输入';
  }

  return '请求失败，请稍后重试';
}
```

- [ ] **Step 4: Verify API helper tests pass**

Run:

```bash
pnpm --filter web test -- src/lib/api.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit API helpers**

```bash
git add apps/web/src/lib/api.ts apps/web/src/lib/api.test.ts
git commit -m "refactor(web): centralize api error handling"
```

---

### Task 4: Create Endpoint-Specific API Client

**Files:**
- Create: `apps/web/src/lib/aiKsApi.ts`
- Create: `apps/web/src/lib/aiKsApi.test.ts`

- [ ] **Step 1: Write failing endpoint tests**

Create `apps/web/src/lib/aiKsApi.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { aiKsApi } from './aiKsApi';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function mockJsonResponse(payload: unknown) {
  globalThis.fetch = vi.fn(async () => {
    return new Response(JSON.stringify(payload), {
      headers: { 'content-type': 'application/json' },
      status: 200,
    });
  }) as typeof fetch;
}

describe('aiKsApi', () => {
  it('queries guest earnings without an authorization header', async () => {
    mockJsonResponse({ rows: [] });

    await aiKsApi.queryGuestEarnings('OPEN ID');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/user/earnings?identity=OPEN%20ID',
      {
        body: undefined,
        headers: { 'Content-Type': 'application/json' },
        method: 'GET',
      },
    );
  });

  it('logs in accounts with username and password', async () => {
    mockJsonResponse({ accessToken: 'token', account: { id: '1' } });

    await aiKsApi.loginAccount({ username: 'demo', password: 'secret' });

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/accounts/login', {
      body: JSON.stringify({ password: 'secret', username: 'demo' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
  });

  it('loads account earnings with the account token', async () => {
    mockJsonResponse({ rows: [] });

    await aiKsApi.getAccountEarnings('account-token');

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/accounts/me/earnings', {
      body: undefined,
      headers: {
        Authorization: 'Bearer account-token',
        'Content-Type': 'application/json',
      },
      method: 'GET',
    });
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm --filter web test -- src/lib/aiKsApi.test.ts
```

Expected: FAIL because `src/lib/aiKsApi.ts` does not exist.

- [ ] **Step 3: Implement API client**

Create `apps/web/src/lib/aiKsApi.ts`:

```ts
import { requestJson } from './api';
import type {
  AccountEarningsResult,
  AccountResult,
  AdminAuthResult,
  AdminWithdrawalDetailResult,
  AdminWithdrawalListResult,
  AlipayProfile,
  AuditLogListResult,
  AuthResult,
  DemoGame,
  EarningsResult,
  EcpmRefreshResult,
  GameSessionResult,
  IntegrationStatus,
  SettlementResult,
  WithdrawalResult,
} from '../types/api';

export const aiKsApi = {
  getDemoContext() {
    return requestJson<{ games: DemoGame[]; sampleJsCodes: string[] }>(
      '/demo/test-context',
    );
  },

  getIntegrationStatus() {
    return requestJson<IntegrationStatus>('/integrations/status');
  },

  queryGuestEarnings(identity: string) {
    return requestJson<EarningsResult>(
      `/user/earnings?identity=${encodeURIComponent(identity)}`,
    );
  },

  registerAccount(payload: { password: string; username: string }) {
    return requestJson<AuthResult>('/accounts/register', {
      body: payload,
      method: 'POST',
    });
  },

  loginAccount(payload: { password: string; username: string }) {
    return requestJson<AuthResult>('/accounts/login', {
      body: payload,
      method: 'POST',
    });
  },

  getCurrentAccount(accessToken: string) {
    return requestJson<AccountResult>('/accounts/me', { accessToken });
  },

  bindAccountOpenId(accessToken: string, identity: string) {
    return requestJson<unknown>('/accounts/me/open-ids', {
      accessToken,
      body: { identity },
      method: 'POST',
    });
  },

  getAccountEarnings(accessToken: string) {
    return requestJson<AccountEarningsResult>('/accounts/me/earnings', {
      accessToken,
    });
  },

  confirmSettlement(accessToken: string) {
    return requestJson<SettlementResult>('/accounts/me/settlements/confirm', {
      accessToken,
      body: {},
      method: 'POST',
    });
  },

  getAlipayProfile(accessToken: string) {
    return requestJson<AlipayProfile>('/accounts/me/alipay', { accessToken });
  },

  updateAlipayProfile(
    accessToken: string,
    payload: { alipayAccount: string; alipayRealName: string },
  ) {
    return requestJson<AlipayProfile>('/accounts/me/alipay', {
      accessToken,
      body: payload,
      method: 'PATCH',
    });
  },

  requestWithdrawal(accessToken: string, amountYuan: string) {
    return requestJson<WithdrawalResult>('/accounts/me/withdrawals', {
      accessToken,
      body: { amountYuan },
      method: 'POST',
    });
  },

  loginAdmin(payload: { password: string; username: string }) {
    return requestJson<AdminAuthResult>('/admin/auth/login', {
      body: payload,
      method: 'POST',
    });
  },

  createGameSession(payload: { gameAppId: string; jsCode: string }) {
    return requestJson<GameSessionResult>('/game/sessions', {
      body: payload,
      method: 'POST',
    });
  },

  refreshEcpm(adminAccessToken: string, gameAppId: string) {
    return requestJson<EcpmRefreshResult>('/admin/kuaishou/ecpm/refresh', {
      accessToken: adminAccessToken,
      body: { gameAppId },
      method: 'POST',
    });
  },

  getAdminWithdrawals(adminAccessToken: string, status: string) {
    return requestJson<AdminWithdrawalListResult>(
      `/admin/withdrawals?status=${encodeURIComponent(status)}`,
      { accessToken: adminAccessToken },
    );
  },

  getWithdrawalDetail(adminAccessToken: string, batchId: string) {
    return requestJson<AdminWithdrawalDetailResult>(
      `/admin/withdrawals/${batchId}`,
      { accessToken: adminAccessToken },
    );
  },

  approveWithdrawal(adminAccessToken: string, batchId: string) {
    return requestJson('/admin/withdrawals/' + batchId + '/approve', {
      accessToken: adminAccessToken,
      body: {},
      method: 'POST',
    });
  },

  payWithdrawal(
    adminAccessToken: string,
    batchId: string,
    mockResult: 'failed' | 'success',
  ) {
    return requestJson('/admin/withdrawals/' + batchId + '/pay', {
      accessToken: adminAccessToken,
      body: { mockResult },
      method: 'POST',
    });
  },

  closeWithdrawal(adminAccessToken: string, batchId: string) {
    return requestJson('/admin/withdrawals/' + batchId + '/close', {
      accessToken: adminAccessToken,
      body: {},
      method: 'POST',
    });
  },

  getAuditLogs(adminAccessToken: string) {
    return requestJson<AuditLogListResult>('/admin/audit-logs?limit=20', {
      accessToken: adminAccessToken,
    });
  },
};
```

- [ ] **Step 4: Verify API client tests pass**

Run:

```bash
pnpm --filter web test -- src/lib/aiKsApi.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit API client**

```bash
git add apps/web/src/lib/aiKsApi.ts apps/web/src/lib/aiKsApi.test.ts
git commit -m "refactor(web): add typed api client"
```

---

### Task 5: Add Session Model And Navigation Rules

**Files:**
- Create: `apps/web/src/lib/auth.ts`
- Create: `apps/web/src/app/session.ts`
- Create: `apps/web/src/app/session.test.ts`

- [ ] **Step 1: Write failing session tests**

Create `apps/web/src/app/session.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  createGuestSession,
  createSignedOutSession,
  getVisibleNavItems,
  isAuthenticatedSession,
} from './session';

describe('session model', () => {
  it('starts signed out', () => {
    expect(createSignedOutSession()).toEqual({ mode: 'signed-out' });
  });

  it('marks guest mode as not authenticated', () => {
    expect(isAuthenticatedSession(createGuestSession())).toBe(false);
  });

  it('shows only earnings query for guests', () => {
    expect(getVisibleNavItems(createGuestSession()).map((item) => item.key)).toEqual([
      'query',
    ]);
  });

  it('shows account workspace for account sessions', () => {
    expect(
      getVisibleNavItems({
        account: { id: '1', readableId: '1234567', username: 'demo' },
        accessToken: 'token',
        mode: 'account',
      }).map((item) => item.key),
    ).toEqual(['query', 'account']);
  });

  it('shows operations for admin sessions', () => {
    expect(
      getVisibleNavItems({
        accessToken: 'admin-token',
        adminName: 'admin',
        mode: 'admin',
      }).map((item) => item.key),
    ).toEqual(['query', 'operations']);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm --filter web test -- src/app/session.test.ts
```

Expected: FAIL because `src/app/session.ts` does not exist.

- [ ] **Step 3: Implement auth storage helpers**

Create `apps/web/src/lib/auth.ts`:

```ts
export const ACCOUNT_AUTH_STORAGE_KEY = 'ai-ks.accountAccessToken';
export const ADMIN_AUTH_STORAGE_KEY = 'ai-ks.adminAccessToken';

export function readStoredToken(key: string): string {
  return window.localStorage.getItem(key) ?? '';
}

export function writeStoredToken(key: string, token: string): void {
  window.localStorage.setItem(key, token);
}

export function clearStoredToken(key: string): void {
  window.localStorage.removeItem(key);
}
```

- [ ] **Step 4: Implement session model**

Create `apps/web/src/app/session.ts`:

```ts
import {
  CircleUserRound,
  Gauge,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import type { AccountResult } from '../types/api';

export type ViewKey = 'account' | 'operations' | 'query';

export type NavItem = {
  description: string;
  icon: LucideIcon;
  key: ViewKey;
  label: string;
  subtitle: string;
};

export type AppSession =
  | { mode: 'signed-out' }
  | { mode: 'guest' }
  | { accessToken: string; account: AccountResult; mode: 'account' }
  | { accessToken: string; adminName: string; mode: 'admin' };

export const navItems: Record<ViewKey, NavItem> = {
  query: {
    description: '按 open_id 或可读 ID 查看当天收益',
    icon: Gauge,
    key: 'query',
    label: '收益查询',
    subtitle: '游客可用',
  },
  account: {
    description: '账号绑定、收益、支付宝与提现',
    icon: CircleUserRound,
    key: 'account',
    label: '账号工作台',
    subtitle: '用户账号',
  },
  operations: {
    description: '联调、刷新、提现审核与审计日志',
    icon: ShieldCheck,
    key: 'operations',
    label: '运营管理',
    subtitle: '管理员',
  },
};

export function createSignedOutSession(): AppSession {
  return { mode: 'signed-out' };
}

export function createGuestSession(): AppSession {
  return { mode: 'guest' };
}

export function isAuthenticatedSession(session: AppSession): boolean {
  return session.mode === 'account' || session.mode === 'admin';
}

export function getVisibleNavItems(session: AppSession): NavItem[] {
  if (session.mode === 'account') {
    return [navItems.query, navItems.account];
  }

  if (session.mode === 'admin') {
    return [navItems.query, navItems.operations];
  }

  if (session.mode === 'guest') {
    return [navItems.query];
  }

  return [];
}
```

- [ ] **Step 5: Verify session tests pass**

Run:

```bash
pnpm --filter web test -- src/app/session.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit session model**

```bash
git add apps/web/src/lib/auth.ts apps/web/src/app/session.ts apps/web/src/app/session.test.ts
git commit -m "refactor(web): add session and navigation model"
```

---

### Task 6: Build Reusable UI Primitives

**Files:**
- Create: `apps/web/src/components/ui/Button.tsx`
- Create: `apps/web/src/components/ui/InputField.tsx`
- Create: `apps/web/src/components/ui/Panel.tsx`
- Create: `apps/web/src/components/ui/MetricCard.tsx`
- Create: `apps/web/src/components/ui/StatusBadge.tsx`
- Create: `apps/web/src/components/ui/Alert.tsx`
- Create: `apps/web/src/components/ui/DataTable.tsx`
- Create: `apps/web/src/components/ui/index.ts`
- Create: `apps/web/src/components/ui/ui.test.tsx`

- [ ] **Step 1: Write failing UI primitive tests**

Create `apps/web/src/components/ui/ui.test.tsx`:

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Alert, Button, DataTable, InputField, MetricCard, Panel, StatusBadge } from '.';

describe('ui primitives', () => {
  it('renders primary buttons with the shared class', () => {
    const html = renderToStaticMarkup(<Button variant="primary">登录</Button>);
    expect(html).toContain('ui-button ui-button-primary');
    expect(html).toContain('登录');
  });

  it('renders input labels above fields', () => {
    const html = renderToStaticMarkup(
      <InputField label="账号" onChange={() => undefined} value="demo" />,
    );
    expect(html).toContain('账号');
    expect(html).toContain('value="demo"');
  });

  it('renders panels with title and description', () => {
    const html = renderToStaticMarkup(
      <Panel description="当天收益" title="收益查询">内容</Panel>,
    );
    expect(html).toContain('收益查询');
    expect(html).toContain('当天收益');
  });

  it('renders status badges with semantic tone', () => {
    const html = renderToStaticMarkup(<StatusBadge tone="warning">待审核</StatusBadge>);
    expect(html).toContain('status-badge-warning');
  });

  it('renders data tables and empty states', () => {
    const html = renderToStaticMarkup(
      <DataTable
        columns={[{ key: 'name', label: '名称' }]}
        emptyLabel="暂无数据"
        getRowKey={(row: { id: string }) => row.id}
        rows={[] as Array<{ id: string; name: string }>}
      />,
    );
    expect(html).toContain('暂无数据');
  });

  it('renders alerts by tone', () => {
    const html = renderToStaticMarkup(<Alert tone="danger">请求失败</Alert>);
    expect(html).toContain('alert-danger');
  });

  it('renders metric cards with value and detail', () => {
    const html = renderToStaticMarkup(
      <MetricCard detail="3 条明细" label="展示金额" value="¥ 10.00" />,
    );
    expect(html).toContain('展示金额');
    expect(html).toContain('¥ 10.00');
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm --filter web test -- src/components/ui/ui.test.tsx
```

Expected: FAIL because `src/components/ui/index.ts` does not exist.

- [ ] **Step 3: Implement Button**

Create `apps/web/src/components/ui/Button.tsx`:

```tsx
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'danger' | 'ghost' | 'primary' | 'secondary';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  compact?: boolean;
  icon?: ReactNode;
  variant?: ButtonVariant;
};

export function Button({
  children,
  className = '',
  compact = false,
  icon,
  type = 'button',
  variant = 'secondary',
  ...props
}: ButtonProps) {
  const classes = [
    'ui-button',
    `ui-button-${variant}`,
    compact ? 'ui-button-compact' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={classes} type={type} {...props}>
      {icon}
      <span>{children}</span>
    </button>
  );
}
```

- [ ] **Step 4: Implement InputField**

Create `apps/web/src/components/ui/InputField.tsx`:

```tsx
import type { InputHTMLAttributes, ReactNode } from 'react';

type InputFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
  error?: string;
  helper?: string;
  label: string;
  onChange: (value: string) => void;
  trailing?: ReactNode;
};

export function InputField({
  error,
  helper,
  id,
  label,
  onChange,
  trailing,
  ...props
}: InputFieldProps) {
  const inputId = id ?? props.name ?? label;

  return (
    <label className="field" htmlFor={inputId}>
      <span className="field-label">{label}</span>
      <span className="field-control">
        <input
          id={inputId}
          onChange={(event) => onChange(event.target.value)}
          {...props}
        />
        {trailing ? <span className="field-trailing">{trailing}</span> : null}
      </span>
      {error ? <span className="field-error">{error}</span> : null}
      {!error && helper ? <span className="field-helper">{helper}</span> : null}
    </label>
  );
}
```

- [ ] **Step 5: Implement Panel and MetricCard**

Create `apps/web/src/components/ui/Panel.tsx`:

```tsx
import type { ReactNode } from 'react';

type PanelProps = {
  actions?: ReactNode;
  children: ReactNode;
  description?: string;
  title: string;
};

export function Panel({ actions, children, description, title }: PanelProps) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {actions ? <div className="panel-actions">{actions}</div> : null}
      </div>
      <div className="panel-body">{children}</div>
    </section>
  );
}
```

Create `apps/web/src/components/ui/MetricCard.tsx`:

```tsx
type MetricCardProps = {
  detail?: string;
  label: string;
  value: string;
};

export function MetricCard({ detail, label, value }: MetricCardProps) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{detail ?? '-'}</p>
    </article>
  );
}
```

- [ ] **Step 6: Implement StatusBadge and Alert**

Create `apps/web/src/components/ui/StatusBadge.tsx`:

```tsx
import type { ReactNode } from 'react';

type StatusTone = 'danger' | 'info' | 'muted' | 'success' | 'warning';

type StatusBadgeProps = {
  children: ReactNode;
  tone?: StatusTone;
};

export function StatusBadge({ children, tone = 'muted' }: StatusBadgeProps) {
  return <span className={`status-badge status-badge-${tone}`}>{children}</span>;
}
```

Create `apps/web/src/components/ui/Alert.tsx`:

```tsx
import type { ReactNode } from 'react';

type AlertProps = {
  children: ReactNode;
  tone: 'danger' | 'success';
};

export function Alert({ children, tone }: AlertProps) {
  return <div className={`alert alert-${tone}`}>{children}</div>;
}
```

- [ ] **Step 7: Implement DataTable**

Create `apps/web/src/components/ui/DataTable.tsx`:

```tsx
import type { ReactNode } from 'react';

export type DataTableColumn<T> = {
  align?: 'left' | 'right';
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
};

type DataTableProps<T> = {
  columns: Array<DataTableColumn<T>>;
  emptyLabel: string;
  getRowKey: (row: T) => string;
  rows: T[];
};

export function DataTable<T>({
  columns,
  emptyLabel,
  getRowKey,
  rows,
}: DataTableProps<T>) {
  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th className={column.align === 'right' ? 'cell-right' : ''} key={column.key}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getRowKey(row)}>
              {columns.map((column) => (
                <td className={column.align === 'right' ? 'cell-right' : ''} key={column.key}>
                  {column.render ? column.render(row) : String(row[column.key as keyof T] ?? '-')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? <div className="empty-state">{emptyLabel}</div> : null}
    </div>
  );
}
```

- [ ] **Step 8: Export UI primitives**

Create `apps/web/src/components/ui/index.ts`:

```ts
export { Alert } from './Alert';
export { Button } from './Button';
export { DataTable, type DataTableColumn } from './DataTable';
export { InputField } from './InputField';
export { MetricCard } from './MetricCard';
export { Panel } from './Panel';
export { StatusBadge } from './StatusBadge';
```

- [ ] **Step 9: Verify UI tests pass**

Run:

```bash
pnpm --filter web test -- src/components/ui/ui.test.tsx
```

Expected: PASS.

- [ ] **Step 10: Commit UI primitives**

```bash
git add apps/web/src/components/ui
git commit -m "feat(web): add shared ui primitives"
```

---

### Task 7: Add Domain Display Components

**Files:**
- Create: `apps/web/src/components/domain/EcpmTable.tsx`
- Create: `apps/web/src/components/domain/ReadoutGrid.tsx`
- Create: `apps/web/src/components/domain/WithdrawalBatchTable.tsx`
- Create: `apps/web/src/components/domain/AuditLogTable.tsx`
- Create: `apps/web/src/components/domain/index.ts`

- [ ] **Step 1: Create ECPM table**

Create `apps/web/src/components/domain/EcpmTable.tsx`:

```tsx
import { DataTable, Panel } from '../ui';
import { formatMoney } from '../../lib/format';
import type { EcpmRow } from '../../types/api';

type EcpmTableProps = {
  emptyLabel: string;
  meta: string;
  rows: EcpmRow[];
  title: string;
};

export function EcpmTable({ emptyLabel, meta, rows, title }: EcpmTableProps) {
  return (
    <Panel
      actions={<span className="table-count">{rows.length} 条</span>}
      description={meta}
      title={title}
    >
      <DataTable
        columns={[
          { key: 'platformEventId', label: '事件' },
          { key: 'gameAppId', label: '游戏' },
          { key: 'openId', label: 'open_id' },
          {
            align: 'right',
            key: 'rawCost',
            label: '原始金额',
            render: (row) => formatMoney(row.rawCost),
          },
          {
            align: 'right',
            key: 'displayAmount',
            label: '展示金额',
            render: (row) => formatMoney(row.displayAmount),
          },
        ]}
        emptyLabel={emptyLabel}
        getRowKey={(row) => row.platformEventId}
        rows={rows}
      />
    </Panel>
  );
}
```

- [ ] **Step 2: Create readout grid**

Create `apps/web/src/components/domain/ReadoutGrid.tsx`:

```tsx
type ReadoutItem = {
  label: string;
  value: string;
};

type ReadoutGridProps = {
  items: ReadoutItem[];
};

export function ReadoutGrid({ items }: ReadoutGridProps) {
  return (
    <div className="readout-grid">
      {items.map((item) => (
        <div className="readout" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create withdrawal batch table**

Create `apps/web/src/components/domain/WithdrawalBatchTable.tsx`:

```tsx
import { Button, DataTable, StatusBadge } from '../ui';
import { formatMoney } from '../../lib/format';
import type { AdminWithdrawalBatch } from '../../types/api';

type WithdrawalBatchTableProps = {
  busyAction: string;
  onApprove: (batchId: string) => void;
  onClose: (batchId: string) => void;
  onDetail: (batchId: string) => void;
  onPay: (batchId: string, result: 'failed' | 'success') => void;
  rows: AdminWithdrawalBatch[];
};

export function WithdrawalBatchTable({
  busyAction,
  onApprove,
  onClose,
  onDetail,
  onPay,
  rows,
}: WithdrawalBatchTableProps) {
  return (
    <DataTable
      columns={[
        { key: 'id', label: '批次' },
        { key: 'userId', label: '用户' },
        {
          align: 'right',
          key: 'totalAmount',
          label: '金额',
          render: (row) => formatMoney(row.totalAmount),
        },
        {
          key: 'recipient',
          label: '收款人',
          render: (row) => row.details[0]?.recipientName ?? '-',
        },
        {
          key: 'status',
          label: '状态',
          render: (row) => <StatusBadge tone={statusTone(row.status)}>{row.status}</StatusBadge>,
        },
        {
          key: 'actions',
          label: '操作',
          render: (row) => (
            <span className="inline-actions">
              <Button compact disabled={busyAction === `detail-${row.id}`} onClick={() => onDetail(row.id)}>
                详情
              </Button>
              {renderActionButtons(row, busyAction, onApprove, onClose, onPay)}
            </span>
          ),
        },
      ]}
      emptyLabel="暂无提现批次"
      getRowKey={(row) => row.id}
      rows={rows}
    />
  );
}

function renderActionButtons(
  row: AdminWithdrawalBatch,
  busyAction: string,
  onApprove: (batchId: string) => void,
  onClose: (batchId: string) => void,
  onPay: (batchId: string, result: 'failed' | 'success') => void,
) {
  if (row.status === 'APPROVED') {
    return (
      <>
        <Button compact disabled={busyAction === `pay-success-${row.id}`} onClick={() => onPay(row.id, 'success')}>
          {busyAction === `pay-success-${row.id}` ? '打款中' : '打款'}
        </Button>
        <Button compact disabled={busyAction === `pay-failed-${row.id}`} onClick={() => onPay(row.id, 'failed')}>
          {busyAction === `pay-failed-${row.id}` ? '提交中' : '失败'}
        </Button>
      </>
    );
  }

  if (row.status === 'FAILED') {
    return (
      <Button compact disabled={busyAction === `close-${row.id}`} onClick={() => onClose(row.id)}>
        {busyAction === `close-${row.id}` ? '关闭中' : '关闭'}
      </Button>
    );
  }

  return (
    <Button compact disabled={busyAction === `approve-${row.id}`} onClick={() => onApprove(row.id)}>
      {busyAction === `approve-${row.id}` ? '审核中' : '通过'}
    </Button>
  );
}

function statusTone(status: string) {
  if (status === 'APPROVED' || status === 'COMPLETED') {
    return 'success';
  }

  if (status === 'FAILED' || status === 'REJECTED') {
    return 'danger';
  }

  return 'warning';
}
```

- [ ] **Step 4: Create audit log table**

Create `apps/web/src/components/domain/AuditLogTable.tsx`:

```tsx
import { DataTable } from '../ui';
import { formatAuditMetadata, formatDateTime } from '../../lib/format';
import type { AuditLogRow } from '../../types/api';

type AuditLogTableProps = {
  rows: AuditLogRow[];
};

export function AuditLogTable({ rows }: AuditLogTableProps) {
  return (
    <DataTable
      columns={[
        { key: 'createdAt', label: '时间', render: (row) => formatDateTime(row.createdAt) },
        { key: 'action', label: '动作' },
        {
          key: 'actor',
          label: '操作者',
          render: (row) => `${row.actorType}/${row.actorId}`,
        },
        {
          key: 'target',
          label: '目标',
          render: (row) => `${row.targetType}/${row.targetId}`,
        },
        {
          key: 'metadata',
          label: '摘要',
          render: (row) => formatAuditMetadata(row.metadata),
        },
      ]}
      emptyLabel="暂无审计日志"
      getRowKey={(row) => row.id}
      rows={rows}
    />
  );
}
```

- [ ] **Step 5: Export domain components**

Create `apps/web/src/components/domain/index.ts`:

```ts
export { AuditLogTable } from './AuditLogTable';
export { EcpmTable } from './EcpmTable';
export { ReadoutGrid } from './ReadoutGrid';
export { WithdrawalBatchTable } from './WithdrawalBatchTable';
```

- [ ] **Step 6: Type-check domain components**

Run:

```bash
pnpm --filter web lint
```

Expected: PASS.

- [ ] **Step 7: Commit domain components**

```bash
git add apps/web/src/components/domain
git commit -m "feat(web): add domain display components"
```

---

### Task 8: Build Layout Components

**Files:**
- Create: `apps/web/src/layouts/AuthLayout.tsx`
- Create: `apps/web/src/layouts/DashboardLayout.tsx`
- Create: `apps/web/src/layouts/layouts.test.tsx`

- [ ] **Step 1: Write failing layout tests**

Create `apps/web/src/layouts/layouts.test.tsx`:

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createGuestSession } from '../app/session';
import { AuthLayout } from './AuthLayout';
import { DashboardLayout } from './DashboardLayout';

describe('layouts', () => {
  it('renders auth layout without dashboard navigation', () => {
    const html = renderToStaticMarkup(<AuthLayout>登录表单</AuthLayout>);
    expect(html).toContain('登录表单');
    expect(html).not.toContain('主导航');
  });

  it('renders dashboard layout with guest navigation only', () => {
    const html = renderToStaticMarkup(
      <DashboardLayout
        activeView="query"
        modeText="快手 Mock"
        onNavigate={() => undefined}
        onSignOut={() => undefined}
        session={createGuestSession()}
      >
        查询页面
      </DashboardLayout>,
    );

    expect(html).toContain('收益查询');
    expect(html).toContain('查询页面');
    expect(html).not.toContain('账号工作台');
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm --filter web test -- src/layouts/layouts.test.tsx
```

Expected: FAIL because layout files do not exist.

- [ ] **Step 3: Implement AuthLayout**

Create `apps/web/src/layouts/AuthLayout.tsx`:

```tsx
import type { ReactNode } from 'react';

type AuthLayoutProps = {
  children: ReactNode;
};

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="auth-brand">
          <span className="brand-mark">KS</span>
          <div>
            <strong>AI-KS</strong>
            <span>收益结算后台</span>
          </div>
        </div>
        {children}
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Implement DashboardLayout**

Create `apps/web/src/layouts/DashboardLayout.tsx`:

```tsx
import { LogOut } from 'lucide-react';
import type { ReactNode } from 'react';
import { getVisibleNavItems, navItems, type AppSession, type ViewKey } from '../app/session';
import { Button, StatusBadge } from '../components/ui';

type DashboardLayoutProps = {
  activeView: ViewKey;
  children: ReactNode;
  modeText: string;
  onNavigate: (view: ViewKey) => void;
  onSignOut: () => void;
  session: AppSession;
};

export function DashboardLayout({
  activeView,
  children,
  modeText,
  onNavigate,
  onSignOut,
  session,
}: DashboardLayoutProps) {
  const activeMeta = navItems[activeView];
  const visibleNavItems = getVisibleNavItems(session);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">KS</span>
          <div>
            <strong>AI-KS</strong>
            <span>收益结算后台</span>
          </div>
        </div>
        <nav aria-label="主导航" className="nav-list">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={item.key === activeView ? 'nav-item active' : 'nav-item'}
                key={item.key}
                onClick={() => onNavigate(item.key)}
                type="button"
              >
                <Icon size={18} />
                <span>{item.label}</span>
                <small>{item.subtitle}</small>
              </button>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <span>接口环境</span>
          <strong>{modeText}</strong>
          <small>{session.mode === 'guest' ? '游客仅可查询单个 ID' : '以后端授权结果为准'}</small>
        </div>
      </aside>
      <section className="content">
        <header className="topbar">
          <div>
            <p>{activeMeta.subtitle}</p>
            <h1>{activeMeta.label}</h1>
            <span>{activeMeta.description}</span>
          </div>
          <div className="topbar-actions">
            <SessionBadge session={session} />
            <StatusBadge tone="info">{modeText}</StatusBadge>
            <Button icon={<LogOut size={16} />} onClick={onSignOut} variant="ghost">
              退出
            </Button>
          </div>
        </header>
        {children}
      </section>
    </main>
  );
}

function SessionBadge({ session }: { session: AppSession }) {
  if (session.mode === 'account') {
    return <StatusBadge tone="muted">{session.account.username}</StatusBadge>;
  }

  if (session.mode === 'admin') {
    return <StatusBadge tone="muted">{session.adminName}</StatusBadge>;
  }

  if (session.mode === 'guest') {
    return <StatusBadge tone="warning">游客</StatusBadge>;
  }

  return null;
}
```

- [ ] **Step 5: Verify layout tests pass**

Run:

```bash
pnpm --filter web test -- src/layouts/layouts.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit layouts**

```bash
git add apps/web/src/layouts
git commit -m "feat(web): add auth and dashboard layouts"
```

---

### Task 9: Build Login And Guest Query Pages

**Files:**
- Create: `apps/web/src/pages/LoginPage.tsx`
- Create: `apps/web/src/pages/GuestQueryPage.tsx`
- Create: `apps/web/src/pages/pages.test.tsx`

- [ ] **Step 1: Write failing page tests**

Create `apps/web/src/pages/pages.test.tsx`:

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LoginPage } from './LoginPage';
import { GuestQueryPage } from './GuestQueryPage';

describe('LoginPage', () => {
  it('renders a clean login page with guest entry', () => {
    const html = renderToStaticMarkup(
      <LoginPage
        adminPassword="admin123456"
        adminUsername="admin"
        busyAction=""
        mode="account"
        onAdminPasswordChange={() => undefined}
        onAdminUsernameChange={() => undefined}
        onGuestEnter={() => undefined}
        onLoginAdmin={() => undefined}
        onLoginAccount={() => undefined}
        onModeChange={() => undefined}
        onPasswordChange={() => undefined}
        onRegister={() => undefined}
        onUsernameChange={() => undefined}
        password="demo123456"
        username="demo_user"
      />,
    );

    expect(html).toContain('游客登录');
    expect(html).toContain('登录');
    expect(html).not.toContain('收益明细');
  });
});

describe('GuestQueryPage', () => {
  it('renders single ID query controls', () => {
    const html = renderToStaticMarkup(
      <GuestQueryPage
        busy={false}
        identity=""
        onIdentityChange={() => undefined}
        onQuery={() => undefined}
      />,
    );

    expect(html).toContain('单个 ID 查询');
    expect(html).toContain('open_id / 可读 ID');
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm --filter web test -- src/pages/pages.test.tsx
```

Expected: FAIL because pages do not exist.

- [ ] **Step 3: Implement LoginPage**

Create `apps/web/src/pages/LoginPage.tsx`:

```tsx
import { LogIn, UserPlus } from 'lucide-react';
import { AuthLayout } from '../layouts/AuthLayout';
import { Button, InputField } from '../components/ui';

type LoginMode = 'account' | 'admin';

type LoginPageProps = {
  adminPassword: string;
  adminUsername: string;
  busyAction: string;
  mode: LoginMode;
  onAdminPasswordChange: (value: string) => void;
  onAdminUsernameChange: (value: string) => void;
  onGuestEnter: () => void;
  onLoginAccount: () => void;
  onLoginAdmin: () => void;
  onModeChange: (mode: LoginMode) => void;
  onPasswordChange: (value: string) => void;
  onRegister: () => void;
  onUsernameChange: (value: string) => void;
  password: string;
  username: string;
};

export function LoginPage({
  adminPassword,
  adminUsername,
  busyAction,
  mode,
  onAdminPasswordChange,
  onAdminUsernameChange,
  onGuestEnter,
  onLoginAccount,
  onLoginAdmin,
  onModeChange,
  onPasswordChange,
  onRegister,
  onUsernameChange,
  password,
  username,
}: LoginPageProps) {
  const isAdmin = mode === 'admin';
  const activeUsername = isAdmin ? adminUsername : username;
  const activePassword = isAdmin ? adminPassword : password;
  const canSubmit = activeUsername.trim().length > 0 && activePassword.trim().length > 0;

  return (
    <AuthLayout>
      <div className="login-copy">
        <h1>登录</h1>
        <p>进入收益结算后台</p>
      </div>
      <div className="segmented-control" role="tablist">
        <button
          className={mode === 'account' ? 'active' : ''}
          onClick={() => onModeChange('account')}
          type="button"
        >
          用户
        </button>
        <button
          className={mode === 'admin' ? 'active' : ''}
          onClick={() => onModeChange('admin')}
          type="button"
        >
          管理员
        </button>
      </div>
      <div className="form-stack">
        <InputField
          label={isAdmin ? '管理员账号' : '账号'}
          onChange={isAdmin ? onAdminUsernameChange : onUsernameChange}
          value={activeUsername}
        />
        <InputField
          label={isAdmin ? '管理员密码' : '密码'}
          onChange={isAdmin ? onAdminPasswordChange : onPasswordChange}
          type="password"
          value={activePassword}
        />
        <Button
          disabled={!canSubmit || busyAction === (isAdmin ? 'admin-login' : 'login')}
          icon={<LogIn size={16} />}
          onClick={isAdmin ? onLoginAdmin : onLoginAccount}
          variant="primary"
        >
          {busyAction === (isAdmin ? 'admin-login' : 'login') ? '登录中' : '登录'}
        </Button>
        {!isAdmin ? (
          <Button
            disabled={!canSubmit || busyAction === 'register'}
            icon={<UserPlus size={16} />}
            onClick={onRegister}
          >
            {busyAction === 'register' ? '注册中' : '注册'}
          </Button>
        ) : null}
        <Button onClick={onGuestEnter} variant="ghost">
          游客登录
        </Button>
      </div>
    </AuthLayout>
  );
}
```

- [ ] **Step 4: Implement GuestQueryPage**

Create `apps/web/src/pages/GuestQueryPage.tsx`:

```tsx
import { Search } from 'lucide-react';
import { EcpmTable, ReadoutGrid } from '../components/domain';
import { Button, InputField, MetricCard, Panel } from '../components/ui';
import { formatMoney } from '../lib/format';
import type { DemoGame, EarningsResult } from '../types/api';

type GuestQueryPageProps = {
  busy: boolean;
  earnings?: EarningsResult;
  identity: string;
  onIdentityChange: (value: string) => void;
  onQuery: () => void;
  selectedGame?: DemoGame;
};

export function GuestQueryPage({
  busy,
  earnings,
  identity,
  onIdentityChange,
  onQuery,
  selectedGame,
}: GuestQueryPageProps) {
  return (
    <div className="view-stack">
      <section className="metric-grid" aria-label="收益概览">
        <MetricCard
          detail={earnings ? `${earnings.rows.length} 条 ECPM 明细` : '默认当天'}
          label="展示金额"
          value={formatMoney(earnings?.totalDisplayAmount)}
        />
        <MetricCard
          detail={earnings?.readableId ?? '等待查询'}
          label="可读 ID"
          value={earnings?.readableId ?? '-'}
        />
        <MetricCard
          detail={selectedGame?.gameAppId ?? '-'}
          label="当前游戏"
          value={selectedGame?.name ?? '-'}
        />
      </section>
      <section className="split-grid">
        <Panel description="当天 00:00 - 24:00" title="单个 ID 查询">
          <div className="query-form">
            <InputField
              label="open_id / 可读 ID"
              onChange={onIdentityChange}
              placeholder="输入 open_id 或 7 位可读 ID"
              value={identity}
            />
            <Button
              disabled={!identity.trim() || busy}
              icon={<Search size={16} />}
              onClick={onQuery}
              variant="primary"
            >
              {busy ? '查询中' : '查询收益'}
            </Button>
          </div>
        </Panel>
        <Panel description={earnings?.date ?? '今日'} title="查询结果">
          <ReadoutGrid
            items={[
              { label: 'open_id', value: earnings?.openId ?? '-' },
              { label: '原始金额', value: formatMoney(earnings?.totalRawCost) },
              { label: '展示金额', value: formatMoney(earnings?.totalDisplayAmount) },
            ]}
          />
        </Panel>
      </section>
      <EcpmTable
        emptyLabel="暂无收益明细"
        meta={earnings?.date ?? '今日'}
        rows={earnings?.rows ?? []}
        title="收益明细"
      />
    </div>
  );
}
```

- [ ] **Step 5: Verify page tests pass**

Run:

```bash
pnpm --filter web test -- src/pages/pages.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit login and guest pages**

```bash
git add apps/web/src/pages/LoginPage.tsx apps/web/src/pages/GuestQueryPage.tsx apps/web/src/pages/pages.test.tsx
git commit -m "feat(web): add clean login and guest query pages"
```

---

### Task 10: Extract User Account Workspace

**Files:**
- Create: `apps/web/src/pages/AccountWorkspace.tsx`
- Modify: `apps/web/src/pages/pages.test.tsx`

- [ ] **Step 1: Add failing account workspace render test**

Append to `apps/web/src/pages/pages.test.tsx`:

```tsx
import { AccountWorkspace } from './AccountWorkspace';

describe('AccountWorkspace', () => {
  it('renders account forms and account earnings table', () => {
    const html = renderToStaticMarkup(
      <AccountWorkspace
        alipayAccount=""
        alipayRealName=""
        bindIdentity=""
        busyAction=""
        onAlipayAccountChange={() => undefined}
        onAlipayRealNameChange={() => undefined}
        onBindIdentityChange={() => undefined}
        onBindOpenId={() => undefined}
        onConfirmSettlement={() => undefined}
        onQueryAccountEarnings={() => undefined}
        onRequestWithdrawal={() => undefined}
        onUpdateAlipayProfile={() => undefined}
        onWithdrawalAmountChange={() => undefined}
        withdrawalAmountYuan="10.00"
      />,
    );

    expect(html).toContain('ID 绑定');
    expect(html).toContain('支付宝资料');
    expect(html).toContain('提现申请');
    expect(html).toContain('账号收益明细');
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm --filter web test -- src/pages/pages.test.tsx
```

Expected: FAIL because `AccountWorkspace` does not exist.

- [ ] **Step 3: Implement AccountWorkspace**

Create `apps/web/src/pages/AccountWorkspace.tsx`:

```tsx
import { Link2, Send, WalletCards } from 'lucide-react';
import { EcpmTable, ReadoutGrid } from '../components/domain';
import { Button, InputField, MetricCard, Panel } from '../components/ui';
import { formatMoney } from '../lib/format';
import type {
  AccountEarningsResult,
  AccountResult,
  SettlementResult,
  WithdrawalResult,
} from '../types/api';

type AccountWorkspaceProps = {
  account?: AccountResult;
  accountEarnings?: AccountEarningsResult;
  alipayAccount: string;
  alipayRealName: string;
  bindIdentity: string;
  busyAction: string;
  onAlipayAccountChange: (value: string) => void;
  onAlipayRealNameChange: (value: string) => void;
  onBindIdentityChange: (value: string) => void;
  onBindOpenId: () => void;
  onConfirmSettlement: () => void;
  onQueryAccountEarnings: () => void;
  onRequestWithdrawal: () => void;
  onUpdateAlipayProfile: () => void;
  onWithdrawalAmountChange: (value: string) => void;
  settlement?: SettlementResult;
  withdrawal?: WithdrawalResult;
  withdrawalAmountYuan: string;
};

export function AccountWorkspace({
  account,
  accountEarnings,
  alipayAccount,
  alipayRealName,
  bindIdentity,
  busyAction,
  onAlipayAccountChange,
  onAlipayRealNameChange,
  onBindIdentityChange,
  onBindOpenId,
  onConfirmSettlement,
  onQueryAccountEarnings,
  onRequestWithdrawal,
  onUpdateAlipayProfile,
  onWithdrawalAmountChange,
  settlement,
  withdrawal,
  withdrawalAmountYuan,
}: AccountWorkspaceProps) {
  return (
    <div className="view-stack">
      <section className="metric-grid metric-grid-four" aria-label="账号概览">
        <MetricCard detail={account?.readableId ?? '未登录'} label="当前账号" value={account?.username ?? '-'} />
        <MetricCard detail="已绑定游戏 ID" label="绑定数量" value={`${accountEarnings?.openIds.length ?? 0}`} />
        <MetricCard detail={accountEarnings?.date ?? '默认当天'} label="账号展示金额" value={formatMoney(accountEarnings?.totalDisplayAmount)} />
        <MetricCard detail={`${settlement?.settledCount ?? 0} 条 ECPM 入账`} label="最近结算" value={formatMoney(settlement?.settledAmount)} />
      </section>
      <section className="split-grid">
        <Panel description={account ? account.readableId : '请先登录账号'} title="ID 绑定">
          <InputField
            label="open_id / 可读 ID"
            onChange={onBindIdentityChange}
            placeholder="输入要绑定的游戏 ID"
            value={bindIdentity}
          />
          <div className="button-row">
            <Button
              disabled={!account || !bindIdentity.trim() || busyAction === 'bind'}
              icon={<Link2 size={16} />}
              onClick={onBindOpenId}
              variant="primary"
            >
              {busyAction === 'bind' ? '绑定中' : '绑定 ID'}
            </Button>
            <Button
              disabled={!account || busyAction === 'account-query'}
              icon={<WalletCards size={16} />}
              onClick={onQueryAccountEarnings}
            >
              {busyAction === 'account-query' ? '查询中' : '账号收益'}
            </Button>
          </div>
        </Panel>
        <Panel description={alipayAccount ? '已维护收款信息' : '提现前必须维护'} title="支付宝资料">
          <InputField label="支付宝账号" onChange={onAlipayAccountChange} placeholder="邮箱或手机号" value={alipayAccount} />
          <InputField label="真实姓名" onChange={onAlipayRealNameChange} placeholder="收款人实名" value={alipayRealName} />
          <Button
            disabled={!account || !alipayAccount.trim() || !alipayRealName.trim() || busyAction === 'alipay'}
            icon={<WalletCards size={16} />}
            onClick={onUpdateAlipayProfile}
            variant="primary"
          >
            {busyAction === 'alipay' ? '保存中' : '保存支付宝'}
          </Button>
        </Panel>
      </section>
      <section className="split-grid">
        <Panel description={withdrawal?.status ?? '生成待审核批次'} title="提现申请">
          <InputField
            inputMode="decimal"
            label="提现金额"
            onChange={onWithdrawalAmountChange}
            placeholder="例如 10.00"
            value={withdrawalAmountYuan}
          />
          <div className="button-row">
            <Button
              disabled={!account || !withdrawalAmountYuan.trim() || busyAction === 'withdrawal'}
              icon={<Send size={16} />}
              onClick={onRequestWithdrawal}
              variant="primary"
            >
              {busyAction === 'withdrawal' ? '提交中' : '提交提现'}
            </Button>
            <Button disabled={!account || busyAction === 'settlement'} icon={<WalletCards size={16} />} onClick={onConfirmSettlement}>
              {busyAction === 'settlement' ? '结算中' : '确认结算'}
            </Button>
          </div>
          <ReadoutGrid
            items={[
              { label: '最近入账', value: formatMoney(settlement?.settledAmount) },
              { label: '最近批次', value: withdrawal ? withdrawal.id : '-' },
              { label: '冻结金额', value: formatMoney(withdrawal?.totalAmount) },
            ]}
          />
        </Panel>
      </section>
      <EcpmTable
        emptyLabel="暂无账号收益明细"
        meta={`${accountEarnings?.openIds.length ?? 0} 个 open_id`}
        rows={accountEarnings?.rows ?? []}
        title="账号收益明细"
      />
    </div>
  );
}
```

- [ ] **Step 4: Verify account workspace tests pass**

Run:

```bash
pnpm --filter web test -- src/pages/pages.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit account workspace**

```bash
git add apps/web/src/pages/AccountWorkspace.tsx apps/web/src/pages/pages.test.tsx
git commit -m "feat(web): extract account workspace"
```

---

### Task 11: Extract Administrator Operations Workspace

**Files:**
- Create: `apps/web/src/pages/OperationsWorkspace.tsx`
- Modify: `apps/web/src/pages/pages.test.tsx`

- [ ] **Step 1: Add failing operations workspace render test**

Append to `apps/web/src/pages/pages.test.tsx`:

```tsx
import { OperationsWorkspace } from './OperationsWorkspace';

describe('OperationsWorkspace', () => {
  it('renders admin operations sections', () => {
    const html = renderToStaticMarkup(
      <OperationsWorkspace
        adminName=""
        adminWithdrawalStatus="PENDING_REVIEW"
        adminWithdrawals={[]}
        auditLogs={[]}
        busyAction=""
        gameAppId=""
        games={[]}
        jsCode=""
        onApproveWithdrawal={() => undefined}
        onCloseWithdrawal={() => undefined}
        onCreateSession={() => undefined}
        onGameChange={() => undefined}
        onJsCodeChange={() => undefined}
        onLoadAuditLogs={() => undefined}
        onLoadWithdrawalDetail={() => undefined}
        onLoadWithdrawals={() => undefined}
        onPayWithdrawal={() => undefined}
        onRefreshEcpm={() => undefined}
        sampleJsCodes={[]}
      />,
    );

    expect(html).toContain('游戏端登录');
    expect(html).toContain('快手 ECPM');
    expect(html).toContain('提现审核');
    expect(html).toContain('审计日志');
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm --filter web test -- src/pages/pages.test.tsx
```

Expected: FAIL because `OperationsWorkspace` does not exist.

- [ ] **Step 3: Implement OperationsWorkspace**

Create `apps/web/src/pages/OperationsWorkspace.tsx` with these props and sections:

```tsx
import { RefreshCw, Send } from 'lucide-react';
import { AuditLogTable, EcpmTable, ReadoutGrid, WithdrawalBatchTable } from '../components/domain';
import { Button, InputField, MetricCard, Panel, StatusBadge } from '../components/ui';
import { formatAuditMetadata, formatMoney } from '../lib/format';
import type {
  AdminWithdrawalBatch,
  AdminWithdrawalDetailResult,
  AuditLogRow,
  DemoGame,
  EcpmRefreshResult,
  GameSessionResult,
} from '../types/api';

type OperationsWorkspaceProps = {
  adminName: string;
  adminWithdrawalStatus: string;
  adminWithdrawals: AdminWithdrawalBatch[];
  auditLogs: AuditLogRow[];
  busyAction: string;
  gameAppId: string;
  games: DemoGame[];
  jsCode: string;
  onApproveWithdrawal: (batchId: string) => void;
  onCloseWithdrawal: (batchId: string) => void;
  onCreateSession: () => void;
  onGameChange: (value: string) => void;
  onJsCodeChange: (value: string) => void;
  onLoadAuditLogs: () => void;
  onLoadWithdrawalDetail: (batchId: string) => void;
  onLoadWithdrawals: (status?: string) => void;
  onPayWithdrawal: (batchId: string, mockResult?: 'failed' | 'success') => void;
  onRefreshEcpm: () => void;
  refreshResult?: EcpmRefreshResult;
  sampleJsCodes: string[];
  selectedGame?: DemoGame;
  selectedWithdrawalDetail?: AdminWithdrawalDetailResult;
  session?: GameSessionResult;
};

export function OperationsWorkspace(props: OperationsWorkspaceProps) {
  const {
    adminName,
    adminWithdrawalStatus,
    adminWithdrawals,
    auditLogs,
    busyAction,
    gameAppId,
    games,
    jsCode,
    onApproveWithdrawal,
    onCloseWithdrawal,
    onCreateSession,
    onGameChange,
    onJsCodeChange,
    onLoadAuditLogs,
    onLoadWithdrawalDetail,
    onLoadWithdrawals,
    onPayWithdrawal,
    onRefreshEcpm,
    refreshResult,
    sampleJsCodes,
    selectedGame,
    selectedWithdrawalDetail,
    session,
  } = props;

  return (
    <div className="view-stack">
      <section className="metric-grid" aria-label="联调状态">
        <MetricCard detail={gameAppId || '-'} label="测试游戏" value={selectedGame?.name ?? '-'} />
        <MetricCard detail={session?.openId ?? '等待游戏登录'} label="最新可读 ID" value={session?.readableId ?? '-'} />
        <MetricCard detail={`${refreshResult?.requestedOpenIds.length ?? 0} 个 open_id`} label="最近写入" value={`${refreshResult?.savedCount ?? 0} 条`} />
      </section>
      <section className="tool-grid">
        <Panel description={session?.game.name ?? 'code2Session'} title="游戏端登录">
          <label className="field">
            <span className="field-label">游戏</span>
            <select onChange={(event) => onGameChange(event.target.value)} value={gameAppId}>
              {games.map((game) => (
                <option key={game.gameAppId} value={game.gameAppId}>
                  {game.name} / {game.gameAppId}
                </option>
              ))}
            </select>
          </label>
          <InputField label="js_code" list="sample-js-codes" onChange={onJsCodeChange} value={jsCode} />
          <datalist id="sample-js-codes">
            {sampleJsCodes.map((code) => (
              <option key={code} value={code} />
            ))}
          </datalist>
          <Button disabled={!gameAppId || !jsCode || busyAction === 'session'} icon={<Send size={16} />} onClick={onCreateSession} variant="primary">
            {busyAction === 'session' ? '获取中' : '换取 open_id'}
          </Button>
        </Panel>
        <Panel description={adminName ? `已登录 ${adminName}` : '以后端接口授权为准'} title="快手 ECPM">
          <ReadoutGrid
            items={[
              { label: '游戏 AppID', value: gameAppId || '-' },
              { label: '刷新来源', value: refreshResult?.source ?? '等待刷新' },
            ]}
          />
          <Button disabled={!gameAppId || busyAction === 'refresh'} icon={<RefreshCw size={16} />} onClick={onRefreshEcpm} variant="primary">
            {busyAction === 'refresh' ? '刷新中' : '刷新游戏 ECPM'}
          </Button>
        </Panel>
        <Panel description={session?.game.name ?? '未获取'} title="最新 open_id">
          <ReadoutGrid
            items={[
              { label: '可读 ID', value: session?.readableId ?? '-' },
              { label: 'open_id', value: session?.openId ?? '-' },
              { label: '写入明细', value: `${refreshResult?.savedCount ?? 0} 条` },
            ]}
          />
        </Panel>
      </section>
      <EcpmTable
        emptyLabel="暂无刷新明细"
        meta={`${refreshResult?.requestedOpenIds.length ?? 0} 个 open_id`}
        rows={refreshResult?.rows ?? []}
        title="刷新明细"
      />
      <Panel
        actions={
          <div className="button-row">
            <Button disabled={busyAction === 'admin-withdrawals'} onClick={() => onLoadWithdrawals('PENDING_REVIEW')}>待审核</Button>
            <Button disabled={busyAction === 'admin-withdrawals'} onClick={() => onLoadWithdrawals('APPROVED')}>已审核</Button>
            <Button disabled={busyAction === 'admin-withdrawals'} onClick={() => onLoadWithdrawals('FAILED')}>失败</Button>
          </div>
        }
        description={adminWithdrawalStatus}
        title="提现审核"
      >
        <WithdrawalBatchTable
          busyAction={busyAction}
          onApprove={onApproveWithdrawal}
          onClose={onCloseWithdrawal}
          onDetail={onLoadWithdrawalDetail}
          onPay={onPayWithdrawal}
          rows={adminWithdrawals}
        />
      </Panel>
      {selectedWithdrawalDetail ? <WithdrawalDetailPanel detail={selectedWithdrawalDetail} /> : null}
      <Panel
        actions={
          <Button disabled={busyAction === 'audit-logs'} icon={<RefreshCw size={16} />} onClick={onLoadAuditLogs}>
            {busyAction === 'audit-logs' ? '加载中' : '刷新日志'}
          </Button>
        }
        description="最近操作"
        title="审计日志"
      >
        <AuditLogTable rows={auditLogs} />
      </Panel>
    </div>
  );
}

function WithdrawalDetailPanel({ detail }: { detail: AdminWithdrawalDetailResult }) {
  return (
    <Panel
      actions={<StatusBadge tone="info">{detail.batch.status}</StatusBadge>}
      description={detail.batch.id}
      title="提现详情"
    >
      <ReadoutGrid
        items={[
          { label: '用户', value: detail.batch.userId },
          { label: '金额', value: formatMoney(detail.batch.totalAmount) },
          { label: '审计', value: `${detail.auditLogs.length} 条` },
        ]}
      />
      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>明细</th>
              <th>状态</th>
              <th>收款人</th>
              <th>错误</th>
              <th>响应</th>
            </tr>
          </thead>
          <tbody>
            {detail.batch.details.map((row) => (
              <tr key={row.type}>
                <td>{row.type}</td>
                <td>{row.status}</td>
                <td>{row.recipientName}</td>
                <td>{row.errorCode ?? '-'}</td>
                <td>{formatAuditMetadata(row.alipayResponseSnapshot)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
```

- [ ] **Step 4: Verify operations workspace tests pass**

Run:

```bash
pnpm --filter web test -- src/pages/pages.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit operations workspace**

```bash
git add apps/web/src/pages/OperationsWorkspace.tsx apps/web/src/pages/pages.test.tsx
git commit -m "feat(web): extract admin operations workspace"
```

---

### Task 12: Assemble App State And API Actions

**Files:**
- Replace: `apps/web/src/App.tsx`

- [ ] **Step 1: Replace imports and top-level state**

Replace `apps/web/src/App.tsx` with an orchestration component that imports:

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from './lib/api';
import { aiKsApi } from './lib/aiKsApi';
import {
  ACCOUNT_AUTH_STORAGE_KEY,
  ADMIN_AUTH_STORAGE_KEY,
  clearStoredToken,
  readStoredToken,
  writeStoredToken,
} from './lib/auth';
import { createGuestSession, createSignedOutSession, type AppSession, type ViewKey } from './app/session';
import { Alert } from './components/ui';
import { DashboardLayout } from './layouts/DashboardLayout';
import { AccountWorkspace } from './pages/AccountWorkspace';
import { GuestQueryPage } from './pages/GuestQueryPage';
import { LoginPage } from './pages/LoginPage';
import { OperationsWorkspace } from './pages/OperationsWorkspace';
import type {
  AccountEarningsResult,
  AccountResult,
  AdminWithdrawalBatch,
  AdminWithdrawalDetailResult,
  AlipayProfile,
  AuditLogRow,
  DemoGame,
  EarningsResult,
  EcpmRefreshResult,
  GameSessionResult,
  IntegrationStatus,
  SettlementResult,
  WithdrawalResult,
} from './types/api';
```

Then define state equivalent to the current `App.tsx`, with these changes:

- `session: AppSession` replaces `account`, `accessToken`, `adminName`, and `adminAccessToken` as the display source.
- Keep `account` and token-derived values only where API calls need them.
- `loginMode: 'account' | 'admin'` controls the clean login page.
- `activeView: ViewKey` defaults to `'query'`.

- [ ] **Step 2: Move existing action behavior to API client**

Move current behavior from `App.tsx` into these handlers, replacing direct `apiGet`, `apiPost`, and `apiPatch` calls with `aiKsApi` methods:

```ts
async function queryEarnings() {
  const targetIdentity = identity.trim();
  if (!targetIdentity) {
    setError('请输入 open_id 或可读 ID');
    return;
  }

  await runAction('query', async () => {
    const result = await aiKsApi.queryGuestEarnings(targetIdentity);
    setEarnings(result);
    setNotice('收益查询成功');
  });
}

async function registerAccount() {
  await runAction('register', async () => {
    const result = await aiKsApi.registerAccount({ password, username });
    persistAccountAuth(result.accessToken, result.account);
    setNotice('账号注册成功');
  });
}

async function loginAccount() {
  await runAction('login', async () => {
    const result = await aiKsApi.loginAccount({ password, username });
    persistAccountAuth(result.accessToken, result.account);
    setNotice('账号登录成功');
  });
}

async function loginAdmin() {
  await runAction('admin-login', async () => {
    const result = await aiKsApi.loginAdmin({
      password: adminPassword,
      username: adminUsername,
    });
    writeStoredToken(ADMIN_AUTH_STORAGE_KEY, result.accessToken);
    setAdminAccessToken(result.accessToken);
    setSession({
      accessToken: result.accessToken,
      adminName: result.admin.username,
      mode: 'admin',
    });
    setActiveView('operations');
    setNotice('管理员登录成功');
  });
}
```

Move all remaining current handlers with the same request paths:

- `createGameSession` uses `aiKsApi.createGameSession`.
- `refreshEcpm` uses `aiKsApi.refreshEcpm`.
- `bindAccountOpenId` uses `aiKsApi.bindAccountOpenId` and `aiKsApi.getAccountEarnings`.
- `queryAccountEarnings` uses `aiKsApi.getAccountEarnings`.
- `loadAlipayProfile` uses `aiKsApi.getAlipayProfile`.
- `updateAlipayProfile` uses `aiKsApi.updateAlipayProfile`.
- `requestWithdrawal` uses `aiKsApi.requestWithdrawal`.
- `confirmSettlement` uses `aiKsApi.confirmSettlement` and then `aiKsApi.getAccountEarnings`.
- `loadAdminWithdrawals` uses `aiKsApi.getAdminWithdrawals`.
- `approveAdminWithdrawal` uses `aiKsApi.approveWithdrawal`.
- `payAdminWithdrawal` uses `aiKsApi.payWithdrawal`.
- `closeAdminWithdrawal` uses `aiKsApi.closeWithdrawal`.
- `loadWithdrawalDetail` uses `aiKsApi.getWithdrawalDetail`.
- `loadAuditLogs` uses `aiKsApi.getAuditLogs`.

- [ ] **Step 3: Add token persistence helpers inside App**

Add:

```ts
function persistAccountAuth(token: string, nextAccount: AccountResult) {
  writeStoredToken(ACCOUNT_AUTH_STORAGE_KEY, token);
  setAccessToken(token);
  setAccount(nextAccount);
  setSession({ accessToken: token, account: nextAccount, mode: 'account' });
  setActiveView('account');
  void loadAlipayProfile(token);
}

function enterGuestMode() {
  setSession(createGuestSession());
  setActiveView('query');
  setError('');
  setNotice('');
}

function signOut() {
  clearStoredToken(ACCOUNT_AUTH_STORAGE_KEY);
  clearStoredToken(ADMIN_AUTH_STORAGE_KEY);
  setAccessToken('');
  setAdminAccessToken('');
  setAccount(undefined);
  setSession(createSignedOutSession());
  setActiveView('query');
}
```

- [ ] **Step 4: Preserve backend-error boundary**

Implement `runAction` so `401` clears the active token and `403` displays the backend message without redirect:

```ts
async function runAction(name: string, action: () => Promise<void>) {
  if (busyRef.current) {
    return;
  }

  busyRef.current = true;
  setBusyAction(name);
  setError('');
  setNotice('');
  try {
    await action();
  } catch (nextError) {
    if (nextError instanceof ApiError && nextError.status === 401) {
      if (session.mode === 'admin') {
        clearStoredToken(ADMIN_AUTH_STORAGE_KEY);
        setAdminAccessToken('');
      }
      if (session.mode === 'account') {
        clearStoredToken(ACCOUNT_AUTH_STORAGE_KEY);
        setAccessToken('');
        setAccount(undefined);
      }
      setSession(createSignedOutSession());
    }

    setError(nextError instanceof Error ? nextError.message : '请求失败，请检查 API');
  } finally {
    busyRef.current = false;
    setBusyAction('');
  }
}
```

- [ ] **Step 5: Render clean login or dashboard shell**

In `App` render:

```tsx
if (session.mode === 'signed-out') {
  return (
    <>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}
      <LoginPage
        adminPassword={adminPassword}
        adminUsername={adminUsername}
        busyAction={busyAction}
        mode={loginMode}
        onAdminPasswordChange={setAdminPassword}
        onAdminUsernameChange={setAdminUsername}
        onGuestEnter={enterGuestMode}
        onLoginAccount={loginAccount}
        onLoginAdmin={loginAdmin}
        onModeChange={setLoginMode}
        onPasswordChange={setPassword}
        onRegister={registerAccount}
        onUsernameChange={setUsername}
        password={password}
        username={username}
      />
    </>
  );
}

return (
  <DashboardLayout
    activeView={activeView}
    modeText={modeText}
    onNavigate={setActiveView}
    onSignOut={signOut}
    session={session}
  >
    {error ? <Alert tone="danger">{error}</Alert> : null}
    {notice ? <Alert tone="success">{notice}</Alert> : null}
    {activeView === 'query' ? (
      <GuestQueryPage
        busy={busyAction === 'query'}
        earnings={earnings}
        identity={identity}
        onIdentityChange={setIdentity}
        onQuery={queryEarnings}
        selectedGame={selectedGame}
      />
    ) : null}
    {activeView === 'account' && session.mode === 'account' ? (
      <AccountWorkspace
        account={account}
        accountEarnings={accountEarnings}
        alipayAccount={alipayAccount}
        alipayRealName={alipayRealName}
        bindIdentity={bindIdentity}
        busyAction={busyAction}
        onAlipayAccountChange={setAlipayAccount}
        onAlipayRealNameChange={setAlipayRealName}
        onBindIdentityChange={setBindIdentity}
        onBindOpenId={bindAccountOpenId}
        onConfirmSettlement={confirmSettlement}
        onQueryAccountEarnings={queryAccountEarnings}
        onRequestWithdrawal={requestWithdrawal}
        onUpdateAlipayProfile={updateAlipayProfile}
        onWithdrawalAmountChange={setWithdrawalAmountYuan}
        settlement={settlement}
        withdrawal={withdrawal}
        withdrawalAmountYuan={withdrawalAmountYuan}
      />
    ) : null}
    {activeView === 'operations' && session.mode === 'admin' ? (
      <OperationsWorkspace
        adminName={session.adminName}
        adminWithdrawalStatus={adminWithdrawalStatus}
        adminWithdrawals={adminWithdrawals}
        auditLogs={auditLogs}
        busyAction={busyAction}
        gameAppId={gameAppId}
        games={games}
        jsCode={jsCode}
        onApproveWithdrawal={approveAdminWithdrawal}
        onCloseWithdrawal={closeAdminWithdrawal}
        onCreateSession={createGameSession}
        onGameChange={setGameAppId}
        onJsCodeChange={setJsCode}
        onLoadAuditLogs={loadAuditLogs}
        onLoadWithdrawalDetail={loadWithdrawalDetail}
        onLoadWithdrawals={loadAdminWithdrawals}
        onPayWithdrawal={payAdminWithdrawal}
        onRefreshEcpm={refreshEcpm}
        refreshResult={refreshResult}
        sampleJsCodes={sampleJsCodes}
        selectedGame={selectedGame}
        selectedWithdrawalDetail={selectedWithdrawalDetail}
        session={gameSession}
      />
    ) : null}
  </DashboardLayout>
);
```

- [ ] **Step 6: Type-check App orchestration**

Run:

```bash
pnpm --filter web lint
```

Expected: PASS.

- [ ] **Step 7: Commit App assembly**

```bash
git add apps/web/src/App.tsx
git commit -m "refactor(web): assemble redesigned app shell"
```

---

### Task 13: Replace Global CSS With DESIGN.md Tokens

**Files:**
- Replace: `apps/web/src/styles.css`

- [ ] **Step 1: Replace root tokens**

Replace the existing `:root` block with the tokens from `DESIGN.md`:

```css
:root {
  --background: #faf9f5;
  --foreground: #141413;
  --surface: #ffffff;
  --surface-soft: #f5f0e8;
  --surface-muted: #efe9de;
  --border: #e6dfd8;
  --border-strong: #d8cec1;
  --muted: #6c6a64;
  --muted-soft: #8e8b82;
  --primary: #cc785c;
  --primary-hover: #a9583e;
  --primary-soft: #f4ded5;
  --success: #4f9f65;
  --success-soft: #e4f3e8;
  --warning: #d4a017;
  --warning-soft: #fbf0cc;
  --danger: #c64545;
  --danger-soft: #f7dddd;
  --info: #4f83a8;
  --info-soft: #e3eef5;
  --dark-surface: #181715;
  --dark-surface-elevated: #252320;
  --on-dark: #faf9f5;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
    "Segoe UI", sans-serif;
  color: var(--foreground);
  background: var(--background);
}
```

- [ ] **Step 2: Add base, auth, shell, component, and responsive CSS**

Replace the rest of `apps/web/src/styles.css` with class rules for:

- `body`, `button`, `input`, `select`.
- `.auth-shell`, `.auth-panel`, `.auth-brand`, `.login-copy`, `.segmented-control`, `.form-stack`.
- `.app-shell`, `.sidebar`, `.brand`, `.brand-mark`, `.nav-list`, `.nav-item`, `.sidebar-footer`.
- `.content`, `.topbar`, `.topbar-actions`, `.view-stack`.
- `.metric-grid`, `.metric-grid-four`, `.metric-card`.
- `.panel`, `.panel-heading`, `.panel-actions`, `.panel-body`.
- `.field`, `.field-label`, `.field-control`, `.field-trailing`, `.field-helper`, `.field-error`.
- `.ui-button`, `.ui-button-primary`, `.ui-button-secondary`, `.ui-button-ghost`, `.ui-button-danger`, `.ui-button-compact`.
- `.status-badge`, `.status-badge-warning`, `.status-badge-success`, `.status-badge-danger`, `.status-badge-muted`, `.status-badge-info`.
- `.alert`, `.alert-danger`, `.alert-success`.
- `.data-table-wrap`, `.data-table`, `.cell-right`, `.empty-state`, `.table-count`.
- `.split-grid`, `.tool-grid`, `.query-form`, `.readout-grid`, `.readout`, `.button-row`, `.inline-actions`.
- Media query `@media (max-width: 1120px)` to collapse split/tool grids.
- Media query `@media (max-width: 860px)` to collapse the sidebar and metrics.

Use only the DESIGN.md token colors in these rules. Do not reintroduce green as primary or page-level gradients.

- [ ] **Step 3: Verify CSS compiles**

Run:

```bash
pnpm --filter web build
```

Expected: PASS.

- [ ] **Step 4: Commit CSS redesign**

```bash
git add apps/web/src/styles.css
git commit -m "style(web): apply warm admin design system"
```

---

### Task 14: Final Verification And Browser QA

**Files:**
- No planned file edits.

- [ ] **Step 1: Run all web tests**

Run:

```bash
pnpm --filter web test
```

Expected: PASS.

- [ ] **Step 2: Run TypeScript lint**

Run:

```bash
pnpm --filter web lint
```

Expected: PASS.

- [ ] **Step 3: Run production build**

Run:

```bash
pnpm --filter web build
```

Expected: PASS.

- [ ] **Step 4: Start web dev server**

Run:

```bash
pnpm --filter web dev
```

Expected: Vite prints a local URL, normally `http://localhost:5173`.

- [ ] **Step 5: Browser-check login and guest flow**

Open the Vite URL and verify:

- Login page is a clean single-purpose page.
- The login page has user/admin switching.
- The login page has a “游客登录” button.
- Clicking “游客登录” enters the dashboard shell.
- Guest dashboard navigation shows only “收益查询”.
- Guest query page accepts a single `open_id` or readable ID.

- [ ] **Step 6: Browser-check account and admin display paths**

With backend running, verify:

- Account login reaches account workspace.
- Admin login reaches operations workspace.
- 401 clears the current token and returns to login.
- 403 displays the backend error message without pretending frontend permissions are authoritative.

- [ ] **Step 7: Commit final verification note if any small fixes were needed**

If Step 1 through Step 6 required small fixes, commit those changed files:

```bash
git add apps/web
git commit -m "fix(web): polish redesigned frontend verification"
```

If no fixes were needed, do not create an empty commit.

---

## Self-Review

Spec coverage:

- Clean login page: Task 9.
- Guest login button leading to single-ID query inside full dashboard shell: Tasks 5, 8, 9, and 12.
- One-time complete frontend architecture split: Tasks 2 through 12.
- DESIGN.md visual tokens and operational dashboard style: Tasks 6, 7, 8, 13, and 14.
- Backend as authorization boundary and frontend by-error handling: Tasks 3 and 12.
- No HeroUI: all tasks use local components and existing dependencies.
- Existing API behavior preserved: Task 4 and Task 12 list the exact current endpoint paths.
- Verification: Tasks 1 through 14 include tests, lint, build, and browser QA.

Placeholder scan:

- The plan does not use undecided markers.
- Every created file has a concrete path.
- Every behavior-oriented task includes either a failing test, exact implementation code, or exact verification command.

Type consistency:

- `ViewKey` values are `query`, `account`, and `operations` across session, layout, and app assembly.
- API response types are defined once in `src/types/api.ts`.
- `formatMoney`, `formatAuditMetadata`, and `formatDateTime` are used consistently by domain components.
