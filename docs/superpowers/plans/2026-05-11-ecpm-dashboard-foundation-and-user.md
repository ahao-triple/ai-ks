# ECPM 看板重构 · Plan 1：基础设施与普通用户端

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落实 ECPM 看板重构 spec 的第一个垂直切片——基础设施（限流、共享组件、按身份导航）和**普通用户端看板**（KPI、游戏与账号分组、ECPM 单条记录、移动端）。其它角色看板（代理 / 公司管理员 / 超级管理员）放到 Plan 2。

**Architecture:**
- 后端新增 `user-dashboard` 模块（KPI 聚合 / 游戏分组 / ECPM 单条记录），加 `RateLimitGuard` + 缓存兜底（内存存储，按 user-id × route 维度）。
- 前端：新增共享 `EcpmRecordTable` 组件 + `useThrottledRefresh` hook + `formatUserId/formatAccountId` 工具；新增 `AppShell` 左侧导航；改写 `App.tsx` 按身份路由分发；重写 `AccountWorkspace` 为新看板。

**Tech Stack:** NestJS 11 + Prisma 6 + Zod（后端）｜ React 19 + Vite 6 + Tailwind 3 + Vitest（前端）｜ pnpm workspace。

**Spec ref:** `docs/superpowers/specs/2026-05-11-ecpm-dashboard-redesign-design.md`

---

## 总览

| Milestone | Tasks | 产出 |
|---|---|---|
| M1 后端基础 | T1-T4 | 限流中间件、用户看板 API、ECPM 单条记录 API |
| M2 前端共享基础 | T5-T7 | ID 格式化工具、限流 hook、ECPM 通用组件 |
| M3 前端导航重构 | T8-T9 | AppShell + 路由按身份分发 |
| M4 普通用户看板 | T10-T13 | 普通用户看板页（含移动端） |
| M5 验收 | T14 | 端到端验收 + 提交 |

每个 Task 完成后单独 commit。每次 commit 前必须验证 `pnpm --filter api test` 和 `pnpm --filter web test` 不破坏现有用例。

---

## M1 后端基础

### Task 1：RateLimitGuard + 缓存兜底

**Files:**
- Create: `apps/api/src/common/rate-limit/rate-limit.guard.ts`
- Create: `apps/api/src/common/rate-limit/rate-limit.guard.spec.ts`
- Create: `apps/api/src/common/rate-limit/rate-limit.module.ts`
- Create: `apps/api/src/common/rate-limit/throttle.decorator.ts`

- [ ] **Step 1：写 RateLimitGuard 失败测试**

```ts
// apps/api/src/common/rate-limit/rate-limit.guard.spec.ts
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitGuard, RATE_LIMIT_META, RateLimitOptions } from './rate-limit.guard';

function ctxFor(userId: string, route: string): ExecutionContext {
  const req: any = { user: { id: userId }, route: { path: route }, method: 'GET' };
  return {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => ({}) }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as any;
}

describe('RateLimitGuard', () => {
  const opts: RateLimitOptions = { windowMs: 1000, max: 2, cacheMs: 60_000 };
  let reflector: Reflector;
  let guard: RateLimitGuard;

  beforeEach(() => {
    reflector = new Reflector();
    jest.spyOn(reflector, 'get').mockReturnValue(opts);
    guard = new RateLimitGuard(reflector);
  });

  it('放行未触限请求', async () => {
    const ctx = ctxFor('u1', '/api/users/me/dashboard');
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('超出限频时设置 cache-hit 标记并放行（不抛 429）', async () => {
    const ctx = ctxFor('u2', '/api/users/me/dashboard');
    await guard.canActivate(ctx); await guard.canActivate(ctx);
    const req = ctx.switchToHttp().getRequest();
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(req.rateLimitHit).toBe(true);
  });

  it('窗口过期后重置计数', async () => {
    jest.useFakeTimers();
    const ctx = ctxFor('u3', '/api/users/me/dashboard');
    await guard.canActivate(ctx); await guard.canActivate(ctx);
    jest.advanceTimersByTime(1100);
    const req = ctx.switchToHttp().getRequest();
    await guard.canActivate(ctx);
    expect(req.rateLimitHit).toBeUndefined();
    jest.useRealTimers();
  });
});
```

- [ ] **Step 2：跑测试确认失败**

Run: `pnpm --filter api test -- --testPathPattern=rate-limit.guard.spec`
Expected: FAIL（找不到 RateLimitGuard / RATE_LIMIT_META）

- [ ] **Step 3：实现 throttle.decorator.ts 和 RateLimitGuard**

```ts
// apps/api/src/common/rate-limit/throttle.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { RATE_LIMIT_META, RateLimitOptions } from './rate-limit.guard';

export const Throttle = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_META, options);
```

```ts
// apps/api/src/common/rate-limit/rate-limit.guard.ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const RATE_LIMIT_META = 'rate-limit-options';

export type RateLimitOptions = {
  windowMs: number;
  max: number;
  cacheMs: number;
};

type Bucket = { count: number; windowStart: number };

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const opts = this.reflector.get<RateLimitOptions | undefined>(
      RATE_LIMIT_META,
      ctx.getHandler(),
    );
    if (!opts) return true;

    const req = ctx.switchToHttp().getRequest();
    const key = this.bucketKey(req);
    const now = Date.now();
    const bucket = this.buckets.get(key) ?? { count: 0, windowStart: now };

    if (now - bucket.windowStart > opts.windowMs) {
      bucket.count = 0;
      bucket.windowStart = now;
    }
    bucket.count += 1;
    this.buckets.set(key, bucket);

    if (bucket.count > opts.max) {
      req.rateLimitHit = true;
    }
    return true;
  }

  private bucketKey(req: any): string {
    const principalId = req?.user?.id ?? req?.ip ?? 'anon';
    const route = req?.route?.path ?? req?.url ?? 'unknown';
    return `${principalId}:${route}:${req?.method ?? 'GET'}`;
  }
}
```

- [ ] **Step 4：实现 RateLimitModule（导出 guard 给 features 用）**

```ts
// apps/api/src/common/rate-limit/rate-limit.module.ts
import { Global, Module } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitGuard } from './rate-limit.guard';

@Global()
@Module({
  providers: [Reflector, RateLimitGuard],
  exports: [RateLimitGuard],
})
export class RateLimitModule {}
```

注册到 `app.module.ts`：在 imports 数组里 `RateLimitModule`（紧跟 PrismaModule 之后）。

- [ ] **Step 5：跑测试确认通过**

Run: `pnpm --filter api test -- --testPathPattern=rate-limit.guard.spec`
Expected: PASS, 3 tests passed.

- [ ] **Step 6：commit**

```bash
git add apps/api/src/common/rate-limit/ apps/api/src/app.module.ts
git commit -m "feat(api): 添加 RateLimitGuard 与 Throttle 装饰器（静默节流，超限标记 rateLimitHit 不抛错）"
```

---

### Task 2：缓存兜底拦截器（请求被限流时返回上次缓存）

**Files:**
- Create: `apps/api/src/common/rate-limit/cached-response.interceptor.ts`
- Create: `apps/api/src/common/rate-limit/cached-response.interceptor.spec.ts`
- Modify: `apps/api/src/common/rate-limit/rate-limit.module.ts`

- [ ] **Step 1：写失败测试**

```ts
// apps/api/src/common/rate-limit/cached-response.interceptor.spec.ts
import { firstValueFrom, of } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { CachedResponseInterceptor } from './cached-response.interceptor';
import { RATE_LIMIT_META } from './rate-limit.guard';

function ctxFor(userId: string, route: string, hit = false) {
  const req: any = { user: { id: userId }, route: { path: route }, method: 'GET', rateLimitHit: hit };
  const res: any = { setHeader: jest.fn() };
  return {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as any;
}

describe('CachedResponseInterceptor', () => {
  let reflector: Reflector;
  let interceptor: CachedResponseInterceptor;

  beforeEach(() => {
    reflector = new Reflector();
    jest.spyOn(reflector, 'get').mockReturnValue({ windowMs: 1000, max: 2, cacheMs: 60_000 });
    interceptor = new CachedResponseInterceptor(reflector);
  });

  it('未触限：透传 + 写入缓存', async () => {
    const ctx = ctxFor('u1', '/api/x');
    const res = await firstValueFrom(
      interceptor.intercept(ctx, { handle: () => of({ data: 'fresh' }) }),
    );
    expect(res).toEqual({ data: 'fresh' });
  });

  it('已触限且有缓存：返回缓存并打 X-Cache-Hit 头', async () => {
    const okCtx = ctxFor('u1', '/api/x');
    await firstValueFrom(interceptor.intercept(okCtx, { handle: () => of({ data: 'fresh' }) }));

    const hitCtx = ctxFor('u1', '/api/x', true);
    const res = await firstValueFrom(
      interceptor.intercept(hitCtx, { handle: () => of({ data: 'should-not-emit' }) }),
    );
    expect(res).toEqual({ data: 'fresh' });
    expect(hitCtx.switchToHttp().getResponse().setHeader).toHaveBeenCalledWith('X-Cache-Hit', 'true');
  });
});
```

- [ ] **Step 2：跑测试确认失败**

Run: `pnpm --filter api test -- --testPathPattern=cached-response.interceptor.spec`
Expected: FAIL。

- [ ] **Step 3：实现 CachedResponseInterceptor**

```ts
// apps/api/src/common/rate-limit/cached-response.interceptor.ts
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { RATE_LIMIT_META, RateLimitOptions } from './rate-limit.guard';

type CacheEntry = { value: unknown; expiresAt: number };

@Injectable()
export class CachedResponseInterceptor implements NestInterceptor {
  private readonly cache = new Map<string, CacheEntry>();
  constructor(private readonly reflector: Reflector) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const opts = this.reflector.get<RateLimitOptions | undefined>(RATE_LIMIT_META, ctx.getHandler());
    if (!opts) return next.handle();

    const req = ctx.switchToHttp().getRequest();
    const res = ctx.switchToHttp().getResponse();
    const key = `${req?.user?.id ?? req?.ip ?? 'anon'}:${req?.route?.path ?? req?.url}:${req?.method ?? 'GET'}`;
    const now = Date.now();

    if (req.rateLimitHit) {
      const cached = this.cache.get(key);
      if (cached && cached.expiresAt > now) {
        res.setHeader('X-Cache-Hit', 'true');
        return of(cached.value);
      }
    }

    return next.handle().pipe(
      tap((value) => this.cache.set(key, { value, expiresAt: now + opts.cacheMs })),
    );
  }
}
```

把它加进 `RateLimitModule.providers` 与 exports，并在 `main.ts` 用 `app.useGlobalInterceptors(app.get(CachedResponseInterceptor))` 注册。

- [ ] **Step 4：跑测试确认通过**

Run: `pnpm --filter api test -- --testPathPattern=cached-response.interceptor.spec`
Expected: PASS, 2 tests passed.

- [ ] **Step 5：跑全量 API 测试确认未破坏其它用例**

Run: `pnpm --filter api test`
Expected: 全部通过（256 + 5 ≈ 261 tests）。

- [ ] **Step 6：commit**

```bash
git add apps/api/src/common/rate-limit/ apps/api/src/main.ts
git commit -m "feat(api): 缓存兜底拦截器 - 限流命中时返回上次缓存数据 + X-Cache-Hit 头"
```

---

### Task 3：UserDashboard 查询服务（KPI + 游戏分组）

**Files:**
- Create: `apps/api/src/features/user-dashboard/user-dashboard.module.ts`
- Create: `apps/api/src/features/user-dashboard/user-dashboard.service.ts`
- Create: `apps/api/src/features/user-dashboard/user-dashboard.service.spec.ts`
- Create: `apps/api/src/features/user-dashboard/user-dashboard.controller.ts`
- Create: `apps/api/src/features/user-dashboard/user-dashboard.controller.spec.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1：写 service 失败测试 — 用户 KPI 聚合**

```ts
// apps/api/src/features/user-dashboard/user-dashboard.service.spec.ts
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UserDashboardService } from './user-dashboard.service';

describe('UserDashboardService.getOverview', () => {
  let prisma: PrismaService;
  let service: UserDashboardService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [UserDashboardService, { provide: PrismaService, useValue: makePrismaStub() }],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    service = moduleRef.get(UserDashboardService);
  });

  it('返回今日 KPI、游戏数、账号数（基于 raw_ecpms 聚合）', async () => {
    seedRawEcpms(prisma, [
      { userId: 'u1', gameId: 'g1', openIdRecordId: 'o1', rawCostLi: 4520_0000n, eventTime: today('14:34:18') },
      { userId: 'u1', gameId: 'g1', openIdRecordId: 'o2', rawCostLi: 4280_0000n, eventTime: today('14:25:47') },
      { userId: 'u1', gameId: 'g2', openIdRecordId: 'o3', rawCostLi: 3650_0000n, eventTime: today('14:18:03') },
    ]);
    seedOpenIds(prisma, [
      { id: 'o1', userId: 'u1', gameId: 'g1', readableId: 'A8F3D2K' },
      { id: 'o2', userId: 'u1', gameId: 'g1', readableId: 'B7C2E91' },
      { id: 'o3', userId: 'u1', gameId: 'g2', readableId: 'C2A5F33' },
    ]);

    const overview = await service.getOverview({ userId: 'u1', range: todayRange() });

    expect(overview.todayCount).toBe(3);
    expect(overview.todayAverageEcpmYuan).toBeCloseTo(41.5, 1);
    expect(overview.gameCount).toBe(2);
    expect(overview.accountCount).toBe(3);
  });

  it('用户没有数据时返回 0 值结构', async () => {
    const overview = await service.getOverview({ userId: 'u-empty', range: todayRange() });
    expect(overview).toEqual({
      todayCount: 0,
      todayAverageEcpmYuan: 0,
      todayMaxEcpmYuan: 0,
      gameCount: 0,
      accountCount: 0,
      activeGameCount: 0,
      activeAccountCount: 0,
    });
  });
});
```

> 测试 helper（`makePrismaStub / seedRawEcpms / seedOpenIds / today / todayRange`）参考 `apps/api/src/features/account/account.service.spec.ts` 现有 stub 模式实现，把 `prisma.rawEcpm.findMany` `prisma.gameOpenId.findMany` 设为基于内存数组的 `jest.fn` mock。

- [ ] **Step 2：跑测试确认失败**

Run: `pnpm --filter api test -- --testPathPattern=user-dashboard.service.spec`
Expected: FAIL（找不到 service / 找不到方法）。

- [ ] **Step 3：实现 UserDashboardService.getOverview**

```ts
// apps/api/src/features/user-dashboard/user-dashboard.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export type UserDashboardOverview = {
  todayCount: number;
  todayAverageEcpmYuan: number;
  todayMaxEcpmYuan: number;
  gameCount: number;
  accountCount: number;
  activeGameCount: number;
  activeAccountCount: number;
};

export type Range = { startAt: Date; endAt: Date };

@Injectable()
export class UserDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(input: { userId: string; range: Range }): Promise<UserDashboardOverview> {
    const records = await this.prisma.rawEcpm.findMany({
      where: {
        eventTime: { gte: input.range.startAt, lt: input.range.endAt },
        openIdRecord: { userId: input.userId },
      },
      include: { openIdRecord: { include: { game: true } } },
    });
    const allOpenIds = await this.prisma.gameOpenId.findMany({
      where: { userId: input.userId },
    });

    const todayCount = records.length;
    const todayAverageEcpmYuan = todayCount === 0
      ? 0
      : Number(records.reduce((sum, r) => sum + Number(r.rawCostLi), 0)) / todayCount / 100_0000;
    const todayMaxEcpmYuan = todayCount === 0
      ? 0
      : Math.max(...records.map((r) => Number(r.rawCostLi))) / 100_0000;

    const gameIds = new Set(allOpenIds.map((o) => o.gameId));
    const accountIds = new Set(allOpenIds.map((o) => o.id));
    const activeGameIds = new Set(records.map((r) => r.openIdRecord!.gameId));
    const activeAccountIds = new Set(records.map((r) => r.openIdRecordId).filter((x): x is string => Boolean(x)));

    return {
      todayCount,
      todayAverageEcpmYuan,
      todayMaxEcpmYuan,
      gameCount: gameIds.size,
      accountCount: accountIds.size,
      activeGameCount: activeGameIds.size,
      activeAccountCount: activeAccountIds.size,
    };
  }
}
```

注：`100_0000` 是项目里"li → 元"的兑换基数（1 元 = 1,000,000 li）。验证一下 `domain/money/amount.ts` 里的常量并复用，不要硬编码 magic number——见 Step 7。

- [ ] **Step 4：跑测试确认通过**

Run: `pnpm --filter api test -- --testPathPattern=user-dashboard.service.spec`
Expected: PASS。

- [ ] **Step 5：增加 service 第二个方法 getGameAccountGroups（游戏分组）**

```ts
export type GameGroupRow = {
  gameId: string;
  gameName: string;
  todayCount: number;
  todayAverageEcpmYuan: number;
  totalCount: number;
  lastActiveAt: Date | null;
  accounts: Array<{
    accountId: string;        // = GameOpenId.id
    readableId: string;       // 7 位
    todayCount: number;
    todayAverageEcpmYuan: number;
    totalCount: number;
    lastActiveAt: Date | null;
    activeStatus: 'ACTIVE' | 'IDLE' | 'NEVER';
  }>;
};

async getGameAccountGroups(input: { userId: string; range: Range }): Promise<GameGroupRow[]> {
  const openIds = await this.prisma.gameOpenId.findMany({
    where: { userId: input.userId },
    include: { game: true },
  });
  const records = await this.prisma.rawEcpm.findMany({
    where: { openIdRecord: { userId: input.userId } },
    orderBy: { eventTime: 'desc' },
  });

  const groups = new Map<string, GameGroupRow>();
  for (const o of openIds) {
    const game = o.game;
    if (!groups.has(game.id)) {
      groups.set(game.id, {
        gameId: game.id,
        gameName: game.name,
        todayCount: 0,
        todayAverageEcpmYuan: 0,
        totalCount: 0,
        lastActiveAt: null,
        accounts: [],
      });
    }
    const accountRecords = records.filter((r) => r.openIdRecordId === o.id);
    const todayRecords = accountRecords.filter(
      (r) => r.eventTime >= input.range.startAt && r.eventTime < input.range.endAt,
    );
    const lastActiveAt = accountRecords[0]?.eventTime ?? null;
    const todayCount = todayRecords.length;

    groups.get(game.id)!.accounts.push({
      accountId: o.id,
      readableId: o.readableId,
      todayCount,
      todayAverageEcpmYuan: this.average(todayRecords.map((r) => Number(r.rawCostLi))) / 100_0000,
      totalCount: accountRecords.length,
      lastActiveAt,
      activeStatus: this.statusOf(lastActiveAt),
    });
  }

  // 汇总每个 group 的字段
  for (const group of groups.values()) {
    group.todayCount = group.accounts.reduce((s, a) => s + a.todayCount, 0);
    group.totalCount = group.accounts.reduce((s, a) => s + a.totalCount, 0);
    group.lastActiveAt = group.accounts
      .map((a) => a.lastActiveAt)
      .filter((x): x is Date => Boolean(x))
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
    const todayEcpms = group.accounts.flatMap((a) => Array(a.todayCount).fill(a.todayAverageEcpmYuan));
    group.todayAverageEcpmYuan = this.average(todayEcpms);
  }

  return Array.from(groups.values()).sort((a, b) => b.todayCount - a.todayCount);
}

private average(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

private statusOf(lastActiveAt: Date | null): 'ACTIVE' | 'IDLE' | 'NEVER' {
  if (!lastActiveAt) return 'NEVER';
  const ageMs = Date.now() - lastActiveAt.getTime();
  return ageMs < 24 * 60 * 60 * 1000 ? 'ACTIVE' : 'IDLE';
}
```

补充测试：
```ts
it('按游戏分组聚合账号信息', async () => {
  // 同 step 1 数据
  const groups = await service.getGameAccountGroups({ userId: 'u1', range: todayRange() });
  expect(groups.map((g) => g.gameId)).toEqual(['g1', 'g2']); // 按 todayCount 降序
  expect(groups[0].accounts).toHaveLength(2);
  expect(groups[0].accounts[0].readableId).toBe('A8F3D2K');
  expect(groups[0].todayCount).toBe(2);
});
```

- [ ] **Step 6：跑测试确认通过**

Run: `pnpm --filter api test -- --testPathPattern=user-dashboard.service.spec`
Expected: PASS, 3 tests passed.

- [ ] **Step 7：复用 li 常量**

```ts
// 在 user-dashboard.service.ts 顶部
import { LI_PER_YUAN } from '../../domain/money/amount';
// 把所有 100_0000 替换为 LI_PER_YUAN
```

如果 `LI_PER_YUAN` 不存在则在 `apps/api/src/domain/money/amount.ts` 导出：`export const LI_PER_YUAN = 100_0000n;` 并把数值除法转成 `Number(BigInt) / Number(LI_PER_YUAN)`。

- [ ] **Step 8：commit**

```bash
git add apps/api/src/features/user-dashboard/ apps/api/src/domain/money/amount.ts
git commit -m "feat(api): UserDashboardService 提供 KPI 聚合与游戏分组查询"
```

---

### Task 4：UserDashboardController + ECPM 单条记录（含今日序号）

**Files:**
- Modify: `apps/api/src/features/user-dashboard/user-dashboard.service.ts`
- Modify: `apps/api/src/features/user-dashboard/user-dashboard.service.spec.ts`
- Create: `apps/api/src/features/user-dashboard/user-dashboard.controller.ts`
- Create: `apps/api/src/features/user-dashboard/user-dashboard.controller.spec.ts`
- Create: `apps/api/src/features/user-dashboard/user-dashboard.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1：service 加 listEcpmRecords 方法 — 写测试**

```ts
it('按时间倒序返回 ECPM 单条记录，且每条带"今日序号"（按用户当天累计编号，从 1 开始）', async () => {
  seedRawEcpms(prisma, [
    { userId: 'u1', gameId: 'g1', openIdRecordId: 'o1', rawCostLi: 4520_0000n, eventTime: today('14:34:18') },
    { userId: 'u1', gameId: 'g1', openIdRecordId: 'o1', rawCostLi: 4280_0000n, eventTime: today('14:25:47') },
    { userId: 'u1', gameId: 'g2', openIdRecordId: 'o3', rawCostLi: 3650_0000n, eventTime: today('09:12:33') },
  ]);
  // 同前面的 seedOpenIds + seedGames

  const result = await service.listEcpmRecords({
    userId: 'u1',
    range: todayRange(),
    limit: 50,
  });

  expect(result.records).toHaveLength(3);
  expect(result.records[0].todaySequence).toBe(3);  // 最新在顶
  expect(result.records[2].todaySequence).toBe(1);  // 最早是第 1 条
  expect(result.records[0].ecpmYuan).toBeCloseTo(45.2);
  expect(result.records[0].gameName).toBe('消消乐 Pro');
  expect(result.records[0].accountReadableId).toBe('A8F3D2K');
  expect(result.totalToday).toBe(3);
  expect(result.totalAll).toBe(3);
});

it('支持按 gameId 筛选', async () => {
  // ...同上数据
  const result = await service.listEcpmRecords({
    userId: 'u1',
    range: todayRange(),
    limit: 50,
    gameId: 'g2',
  });
  expect(result.records).toHaveLength(1);
});

it('支持按 accountId 筛选', async () => {
  const result = await service.listEcpmRecords({
    userId: 'u1',
    range: todayRange(),
    limit: 50,
    accountId: 'o3',
  });
  expect(result.records).toHaveLength(1);
  expect(result.records[0].accountReadableId).toBe('C2A5F33');
});
```

- [ ] **Step 2：跑测试确认失败**

Run: `pnpm --filter api test -- --testPathPattern=user-dashboard.service.spec`
Expected: FAIL (3 个新用例)。

- [ ] **Step 3：实现 listEcpmRecords**

```ts
export type EcpmRecordRow = {
  todaySequence: number;
  eventTime: Date;
  ecpmYuan: number;
  gameId: string;
  gameName: string;
  accountId: string;
  accountReadableId: string;
  source: 'kuaishou' | 'manual';
};

export type EcpmRecordsResult = {
  records: EcpmRecordRow[];
  totalToday: number;
  totalAll: number;
};

async listEcpmRecords(input: {
  userId: string;
  range: Range;
  limit: number;
  gameId?: string;
  accountId?: string;
  cursor?: { eventTime: Date; id: string };
}): Promise<EcpmRecordsResult> {
  const where: any = {
    openIdRecord: {
      userId: input.userId,
      ...(input.accountId ? { id: input.accountId } : {}),
    },
    ...(input.gameId ? { gameId: input.gameId } : {}),
  };

  // 总数
  const totalAll = await this.prisma.rawEcpm.count({ where });
  const totalToday = await this.prisma.rawEcpm.count({
    where: { ...where, eventTime: { gte: input.range.startAt, lt: input.range.endAt } },
  });

  // 列表
  const rows = await this.prisma.rawEcpm.findMany({
    where,
    orderBy: { eventTime: 'desc' },
    take: input.limit,
    include: { openIdRecord: { include: { game: true } } },
  });

  // 计算今日序号：先取今天所有按时间升序的事件，map(id → 序号)
  const todayAsc = await this.prisma.rawEcpm.findMany({
    where: { ...where, eventTime: { gte: input.range.startAt, lt: input.range.endAt } },
    orderBy: { eventTime: 'asc' },
    select: { id: true },
  });
  const seqById = new Map(todayAsc.map((r, idx) => [r.id, idx + 1]));

  const records: EcpmRecordRow[] = rows.map((r) => ({
    todaySequence: seqById.get(r.id) ?? 0,
    eventTime: r.eventTime,
    ecpmYuan: Number(r.rawCostLi) / Number(LI_PER_YUAN),
    gameId: r.gameId,
    gameName: r.openIdRecord!.game.name,
    accountId: r.openIdRecordId!,
    accountReadableId: r.openIdRecord!.readableId,
    source: 'kuaishou',
  }));

  return { records, totalToday, totalAll };
}
```

- [ ] **Step 4：跑测试确认通过**

Run: `pnpm --filter api test -- --testPathPattern=user-dashboard.service.spec`
Expected: PASS, 6 tests passed.

- [ ] **Step 5：写 controller**

```ts
// apps/api/src/features/user-dashboard/user-dashboard.controller.ts
import { Controller, Get, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { z } from 'zod';
import { AccountJwtGuard } from '../account/account-jwt.guard';
import { CurrentAccount } from '../account/current-account.decorator';
import type { AccountPrincipal } from '../account/account-auth.service';
import { resolveChinaDayRange } from '../user/china-day-range';
import { Throttle } from '../../common/rate-limit/throttle.decorator';
import { RateLimitGuard } from '../../common/rate-limit/rate-limit.guard';
import { CachedResponseInterceptor } from '../../common/rate-limit/cached-response.interceptor';
import { UserDashboardService } from './user-dashboard.service';

const querySchema = z.object({
  date: z.string().optional(),
  gameId: z.string().optional(),
  accountId: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).optional().default(50),
});

@Controller('users/me/dashboard')
@UseGuards(AccountJwtGuard, RateLimitGuard)
@UseInterceptors(CachedResponseInterceptor)
export class UserDashboardController {
  constructor(private readonly service: UserDashboardService) {}

  @Get('overview')
  @Throttle({ windowMs: 5_000, max: 1, cacheMs: 60_000 })
  async overview(@CurrentAccount() account: AccountPrincipal, @Query() query: unknown) {
    const { date } = querySchema.parse(query);
    return this.service.getOverview({ userId: account.id, range: resolveChinaDayRange(date) });
  }

  @Get('groups')
  @Throttle({ windowMs: 5_000, max: 1, cacheMs: 60_000 })
  async groups(@CurrentAccount() account: AccountPrincipal, @Query() query: unknown) {
    const { date } = querySchema.parse(query);
    return this.service.getGameAccountGroups({ userId: account.id, range: resolveChinaDayRange(date) });
  }

  @Get('records')
  @Throttle({ windowMs: 5_000, max: 1, cacheMs: 60_000 })
  async records(@CurrentAccount() account: AccountPrincipal, @Query() query: unknown) {
    const { date, gameId, accountId, limit } = querySchema.parse(query);
    return this.service.listEcpmRecords({
      userId: account.id,
      range: resolveChinaDayRange(date),
      gameId,
      accountId,
      limit,
    });
  }
}
```

- [ ] **Step 6：写 controller 集成测试**

```ts
// apps/api/src/features/user-dashboard/user-dashboard.controller.spec.ts
import { Test } from '@nestjs/testing';
import { UserDashboardController } from './user-dashboard.controller';
import { UserDashboardService } from './user-dashboard.service';

describe('UserDashboardController', () => {
  let controller: UserDashboardController;
  const service = {
    getOverview: jest.fn().mockResolvedValue({
      todayCount: 12, todayAverageEcpmYuan: 39.8, todayMaxEcpmYuan: 56.8,
      gameCount: 3, accountCount: 6, activeGameCount: 2, activeAccountCount: 5,
    }),
    getGameAccountGroups: jest.fn().mockResolvedValue([]),
    listEcpmRecords: jest.fn().mockResolvedValue({ records: [], totalToday: 0, totalAll: 0 }),
  };

  beforeEach(async () => {
    const m = await Test.createTestingModule({
      controllers: [UserDashboardController],
      providers: [{ provide: UserDashboardService, useValue: service }],
    })
      .overrideGuard(require('../account/account-jwt.guard').AccountJwtGuard).useValue({ canActivate: () => true })
      .overrideGuard(require('../../common/rate-limit/rate-limit.guard').RateLimitGuard).useValue({ canActivate: () => true })
      .compile();
    controller = m.get(UserDashboardController);
  });

  it('GET /overview 透传到 service.getOverview', async () => {
    const account = { id: 'u1' } as any;
    const r = await controller.overview(account, {});
    expect(r.todayCount).toBe(12);
    expect(service.getOverview).toHaveBeenCalledWith({ userId: 'u1', range: expect.any(Object) });
  });
});
```

- [ ] **Step 7：注册 module**

```ts
// apps/api/src/features/user-dashboard/user-dashboard.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AccountAuthModule } from '../account/account-auth.module'; // 如果不存在则 import AccountModule
import { UserDashboardController } from './user-dashboard.controller';
import { UserDashboardService } from './user-dashboard.service';

@Module({
  imports: [PrismaModule],
  controllers: [UserDashboardController],
  providers: [UserDashboardService],
})
export class UserDashboardModule {}
```

加进 `app.module.ts`：

```ts
import { UserDashboardModule } from './features/user-dashboard/user-dashboard.module';
// imports 数组追加 UserDashboardModule
```

- [ ] **Step 8：跑全量 API 测试**

Run: `pnpm --filter api test`
Expected: 全部通过。

- [ ] **Step 9：commit**

```bash
git add apps/api/src/features/user-dashboard/ apps/api/src/app.module.ts
git commit -m "feat(api): UserDashboardController 提供 overview/groups/records 三个接口（含今日序号、限流装饰器）"
```

---

## M2 前端共享基础

### Task 5：ID 格式化工具

**Files:**
- Create: `apps/web/src/lib/idFormat.ts`
- Create: `apps/web/src/lib/idFormat.test.ts`

- [ ] **Step 1：写失败测试**

```ts
// apps/web/src/lib/idFormat.test.ts
import { describe, expect, it } from 'vitest';
import { formatUserId, formatAccountId, formatAgentInvitationCode } from './idFormat';

describe('idFormat', () => {
  it('formatUserId: U- 前缀 + 7 位', () => {
    expect(formatUserId('A8F3D2K')).toBe('U-A8F3D2K');
    expect(formatUserId('u-a8f3d2k')).toBe('U-A8F3D2K');     // 已带前缀的也归一
  });

  it('formatAccountId: 纯 7 位无前缀', () => {
    expect(formatAccountId('A8F3D2K')).toBe('A8F3D2K');
    expect(formatAccountId('U-A8F3D2K')).toBe('A8F3D2K');     // 误传带前缀也兼容
  });

  it('formatAgentInvitationCode: L- 前缀 + 6 位', () => {
    expect(formatAgentInvitationCode('A8F3D2')).toBe('L-A8F3D2');
  });

  it('未知格式：原样返回', () => {
    expect(formatUserId('')).toBe('');
    expect(formatUserId('not-readable')).toBe('not-readable');
  });
});
```

- [ ] **Step 2：跑测试确认失败**

Run: `pnpm --filter web test -- idFormat`
Expected: FAIL（找不到 idFormat 模块）。

- [ ] **Step 3：实现**

```ts
// apps/web/src/lib/idFormat.ts
const READABLE = /^[0-9A-Z]{7}$/i;

export function formatUserId(raw: string): string {
  if (!raw) return raw;
  const stripped = raw.replace(/^U-/i, '').toUpperCase();
  if (READABLE.test(stripped)) return `U-${stripped}`;
  return raw;
}

export function formatAccountId(raw: string): string {
  if (!raw) return raw;
  const stripped = raw.replace(/^U-/i, '').toUpperCase();
  if (READABLE.test(stripped)) return stripped;
  return raw;
}

export function formatAgentInvitationCode(raw: string): string {
  if (!raw) return raw;
  if (raw.startsWith('L-')) return raw.toUpperCase();
  if (/^[0-9A-Z]{6}$/i.test(raw)) return `L-${raw.toUpperCase()}`;
  return raw;
}
```

- [ ] **Step 4：跑测试确认通过**

Run: `pnpm --filter web test -- idFormat`
Expected: PASS, 4 tests passed.

- [ ] **Step 5：commit**

```bash
git add apps/web/src/lib/idFormat.ts apps/web/src/lib/idFormat.test.ts
git commit -m "feat(web): ID 格式化工具（U- 前缀用户级、纯 7 位账号级、L- 前缀邀请码）"
```

---

### Task 6：useThrottledRefresh hook（前端节流 + toast 反馈）

**Files:**
- Create: `apps/web/src/lib/useThrottledRefresh.ts`
- Create: `apps/web/src/lib/useThrottledRefresh.test.ts`

- [ ] **Step 1：写失败测试**

```tsx
// apps/web/src/lib/useThrottledRefresh.test.ts
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useThrottledRefresh } from './useThrottledRefresh';

describe('useThrottledRefresh', () => {
  it('窗口内多次调用：仅触发 fetcher 一次，其余收到"已是最新"', async () => {
    const fetcher = vi.fn().mockResolvedValue({ value: 1 });
    const { result } = renderHook(() => useThrottledRefresh(fetcher, { windowMs: 5000 }));

    await act(() => result.current.refresh());
    await act(() => result.current.refresh());
    await act(() => result.current.refresh());

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.current.toast?.kind).toBe('idle-hit');
  });

  it('窗口过后：再次调用真正触发 fetcher', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockResolvedValue({ value: 1 });
    const { result } = renderHook(() => useThrottledRefresh(fetcher, { windowMs: 5000 }));
    await act(() => result.current.refresh());
    vi.advanceTimersByTime(5100);
    await act(() => result.current.refresh());
    expect(fetcher).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('toast 经 toastDurationMs 后自动消失', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockResolvedValue({ value: 1 });
    const { result } = renderHook(() => useThrottledRefresh(fetcher, { windowMs: 5000, toastDurationMs: 1000 }));
    await act(() => result.current.refresh());
    expect(result.current.toast).toBeTruthy();
    vi.advanceTimersByTime(1100);
    expect(result.current.toast).toBeNull();
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2：跑测试确认失败**

Run: `pnpm --filter web test -- useThrottledRefresh`
Expected: FAIL。

- [ ] **Step 3：实现**

```ts
// apps/web/src/lib/useThrottledRefresh.ts
import { useCallback, useEffect, useRef, useState } from 'react';

type ToastKind = 'success' | 'idle-hit' | 'error';
type Toast = { kind: ToastKind; message: string } | null;

export type ThrottleOptions = {
  windowMs: number;
  toastDurationMs?: number;
};

export function useThrottledRefresh<T>(
  fetcher: () => Promise<T>,
  options: ThrottleOptions,
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const lastFetchAt = useRef<number>(0);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), options.toastDurationMs ?? 1500);
    return () => clearTimeout(t);
  }, [toast, options.toastDurationMs]);

  const refresh = useCallback(async () => {
    const now = Date.now();
    if (now - lastFetchAt.current < options.windowMs) {
      setToast({ kind: 'idle-hit', message: '✓ 数据已是最新' });
      return;
    }
    lastFetchAt.current = now;
    setLoading(true);
    try {
      const value = await fetcher();
      setData(value);
      setToast({ kind: 'success', message: '✓ 已刷新' });
    } catch (e) {
      setToast({ kind: 'error', message: '⚠ 刷新失败，稍后再试' });
    } finally {
      setLoading(false);
    }
  }, [fetcher, options.windowMs]);

  const startAuto = useCallback(
    (intervalMs: number) => {
      stopAuto();
      pendingTimer.current = setInterval(refresh, intervalMs);
    },
    [refresh],
  );

  const stopAuto = useCallback(() => {
    if (pendingTimer.current) {
      clearInterval(pendingTimer.current);
      pendingTimer.current = null;
    }
  }, []);

  useEffect(() => () => stopAuto(), [stopAuto]);

  return { data, loading, toast, refresh, startAuto, stopAuto };
}
```

- [ ] **Step 4：跑测试确认通过**

Run: `pnpm --filter web test -- useThrottledRefresh`
Expected: PASS, 3 tests passed.

- [ ] **Step 5：commit**

```bash
git add apps/web/src/lib/useThrottledRefresh.ts apps/web/src/lib/useThrottledRefresh.test.ts
git commit -m "feat(web): useThrottledRefresh hook（5s 节流 + toast 反馈，疯狂刷新静默）"
```

---

### Task 7：EcpmRecordTable 通用组件

**Files:**
- Create: `apps/web/src/components/domain/EcpmRecordTable.tsx`
- Create: `apps/web/src/components/domain/EcpmRecordTable.test.tsx`
- Modify: `apps/web/src/components/domain/index.ts`

- [ ] **Step 1：写失败测试**

```tsx
// apps/web/src/components/domain/EcpmRecordTable.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EcpmRecordTable, type EcpmRecordView } from './EcpmRecordTable';

const sample: EcpmRecordView[] = [
  { todaySequence: 4, eventTimeIso: '2026-05-11T14:34:18+08:00', ecpmYuan: 45.20, gameName: '消消乐 Pro', accountReadableId: 'A8F3D2K', source: '快手同步' },
  { todaySequence: 1, eventTimeIso: '2026-05-11T13:42:11+08:00', ecpmYuan: 38.20, gameName: '消消乐 Pro', accountReadableId: 'A8F3D2K', source: '快手同步' },
];

describe('EcpmRecordTable', () => {
  it('渲染默认列：序号 / 时间 / ECPM / 游戏 / 账号', () => {
    render(<EcpmRecordTable rows={sample} loading={false} totalToday={2} totalAll={2} />);
    expect(screen.getByText('第 4 条')).toBeInTheDocument();
    expect(screen.getByText('第 1 条 🎯')).toBeInTheDocument();
    expect(screen.getByText('¥ 45.20')).toBeInTheDocument();
    expect(screen.getByText('A8F3D2K')).toBeInTheDocument();
  });

  it('loading 时显示骨架行', () => {
    render(<EcpmRecordTable rows={[]} loading={true} totalToday={0} totalAll={0} />);
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0);
  });

  it('空记录显示友好引导文案', () => {
    render(<EcpmRecordTable rows={[]} loading={false} totalToday={0} totalAll={0} />);
    expect(screen.getByText(/还没有 ECPM 记录/)).toBeInTheDocument();
  });

  it('extraColumns 打开"展示金额"列', () => {
    render(
      <EcpmRecordTable
        rows={[{ ...sample[0], displayAmountYuan: 0.45 }]}
        loading={false}
        totalToday={1}
        totalAll={1}
        extraColumns={['displayAmount']}
      />,
    );
    expect(screen.getByText('¥ 0.45')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2：跑测试确认失败**

Run: `pnpm --filter web test -- EcpmRecordTable`
Expected: FAIL。

- [ ] **Step 3：实现组件**

```tsx
// apps/web/src/components/domain/EcpmRecordTable.tsx
import { useMemo } from 'react';

export type EcpmRecordView = {
  todaySequence: number;
  eventTimeIso: string;
  ecpmYuan: number;
  gameName: string;
  accountReadableId: string;
  source: string;
  displayAmountYuan?: number;
  status?: string;
  errorReason?: string;
};

export type EcpmRecordExtraColumn = 'displayAmount' | 'status' | 'errorReason';

export type EcpmRecordTableProps = {
  rows: EcpmRecordView[];
  loading: boolean;
  totalToday: number;
  totalAll: number;
  extraColumns?: EcpmRecordExtraColumn[];
  highlightLatestId?: string | null;
};

export function EcpmRecordTable(props: EcpmRecordTableProps) {
  const { rows, loading, totalToday, totalAll, extraColumns = [] } = props;

  const cols = useMemo(() => buildColumns(extraColumns), [extraColumns]);

  if (loading && rows.length === 0) {
    return (
      <div className="space-y-2" role="status" aria-busy>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} role="status" className="h-9 rounded bg-zinc-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="border border-dashed rounded p-8 text-center text-sm text-zinc-500">
        <div className="text-3xl opacity-40 mb-2">📭</div>
        <div className="font-semibold text-zinc-700">还没有 ECPM 记录</div>
        <div className="mt-1">绑定一个游戏并在游戏内看广告后，记录会出现在这里。</div>
      </div>
    );
  }

  return (
    <div>
      <div className="text-xs text-zinc-500 mb-2">
        今日 <strong>{totalToday}</strong> 条 · 累计 <strong>{totalAll}</strong> 条
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-zinc-50 text-xs text-zinc-600">
            <tr>
              {cols.map((c) => (
                <th key={c.key} className={c.className ?? 'text-left p-2 font-normal'}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.todaySequence}-${r.eventTimeIso}-${r.accountReadableId}`} className="border-t">
                {cols.map((c) => (
                  <td key={c.key} className={c.cellClass ?? 'p-2'}>
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function buildColumns(extra: EcpmRecordExtraColumn[]) {
  const base = [
    {
      key: 'seq',
      label: '今日序号',
      render: (r: EcpmRecordView) =>
        r.todaySequence === 1 ? (
          <span className="font-semibold text-emerald-600">第 1 条 🎯</span>
        ) : (
          <span className="font-semibold">第 {r.todaySequence} 条</span>
        ),
    },
    { key: 'time', label: '时间', render: (r: EcpmRecordView) => <span className="font-mono">{formatEventTime(r.eventTimeIso)}</span> },
    { key: 'ecpm', label: 'ECPM', cellClass: 'p-2 text-right', className: 'text-right p-2 font-normal',
      render: (r: EcpmRecordView) => `¥ ${r.ecpmYuan.toFixed(2)}` },
    { key: 'game', label: '游戏', render: (r: EcpmRecordView) => r.gameName },
    { key: 'account', label: '账号', render: (r: EcpmRecordView) => <code className="font-mono">{r.accountReadableId}</code> },
  ];

  if (extra.includes('displayAmount')) {
    base.push({ key: 'displayAmount', label: '展示金额', cellClass: 'p-2 text-right', className: 'text-right p-2 font-normal',
      render: (r: EcpmRecordView) => r.displayAmountYuan != null ? `¥ ${r.displayAmountYuan.toFixed(2)}` : '—' });
  }
  if (extra.includes('status')) base.push({ key: 'status', label: '入账状态', render: (r) => r.status ?? '—' });
  if (extra.includes('errorReason')) base.push({ key: 'err', label: '异常原因', render: (r) => r.errorReason ?? '—' });

  return base;
}

function formatEventTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
```

- [ ] **Step 4：导出组件**

```ts
// apps/web/src/components/domain/index.ts
export * from './AuditLogTable';
export * from './EcpmTable';
export * from './EcpmRecordTable';   // 新增
export * from './ReadoutGrid';
export * from './WithdrawalBatchTable';
```

- [ ] **Step 5：跑测试确认通过**

Run: `pnpm --filter web test -- EcpmRecordTable`
Expected: PASS, 4 tests passed.

- [ ] **Step 6：commit**

```bash
git add apps/web/src/components/domain/EcpmRecordTable.tsx apps/web/src/components/domain/EcpmRecordTable.test.tsx apps/web/src/components/domain/index.ts
git commit -m "feat(web): EcpmRecordTable 通用组件（默认 5 列 + 可选展示金额/状态/异常列、骨架屏、空引导）"
```

---

## M3 前端导航重构

### Task 8：AppShell（左侧一级导航 + 主区）

**Files:**
- Create: `apps/web/src/layouts/AppShell.tsx`
- Create: `apps/web/src/layouts/AppShell.test.tsx`

- [ ] **Step 1：写失败测试**

```tsx
// apps/web/src/layouts/AppShell.test.tsx
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AppShell, type NavItem } from './AppShell';

const items: NavItem[] = [
  { key: 'dashboard', label: '看板' },
  { key: 'withdrawal', label: '我的提现' },
  { key: 'profile', label: '资料' },
];

describe('AppShell', () => {
  it('渲染左侧菜单项', () => {
    render(<AppShell items={items} active="dashboard" onNavigate={() => {}} title="用户工作台">child</AppShell>);
    expect(screen.getByText('看板')).toBeInTheDocument();
    expect(screen.getByText('我的提现')).toBeInTheDocument();
    expect(screen.getByText('资料')).toBeInTheDocument();
  });

  it('点击菜单触发 onNavigate', () => {
    const fn = vi.fn();
    render(<AppShell items={items} active="dashboard" onNavigate={fn} title="t">x</AppShell>);
    fireEvent.click(screen.getByText('我的提现'));
    expect(fn).toHaveBeenCalledWith('withdrawal');
  });

  it('active 项加 active 样式', () => {
    render(<AppShell items={items} active="withdrawal" onNavigate={() => {}} title="t">x</AppShell>);
    const active = screen.getByText('我的提现').closest('button')!;
    expect(active).toHaveClass('bg-blue-600');
  });
});
```

(顶部 `import { vi } from 'vitest';`)

- [ ] **Step 2：跑测试确认失败**

Run: `pnpm --filter web test -- AppShell`
Expected: FAIL。

- [ ] **Step 3：实现**

```tsx
// apps/web/src/layouts/AppShell.tsx
import { ReactNode } from 'react';
import { clsx } from 'clsx';

export type NavItem = {
  key: string;
  label: string;
};

export type AppShellProps = {
  items: NavItem[];
  active: string;
  onNavigate: (key: string) => void;
  title: string;
  children: ReactNode;
  topRight?: ReactNode;
};

export function AppShell(props: AppShellProps) {
  const { items, active, onNavigate, title, children, topRight } = props;
  return (
    <div className="min-h-screen flex bg-zinc-50">
      <aside className="w-52 bg-white border-r border-zinc-200 py-4 hidden md:block">
        <div className="px-4 pb-3 text-xs uppercase tracking-wide text-zinc-500">{title}</div>
        <nav>
          {items.map((item) => (
            <button
              type="button"
              key={item.key}
              onClick={() => onNavigate(item.key)}
              className={clsx(
                'block w-full text-left px-4 py-2 text-sm',
                item.key === active
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'text-zinc-700 hover:bg-zinc-100',
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1">
        {topRight && <div className="md:hidden p-3 border-b bg-white">{topRight}</div>}
        <div className="p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
}
```

(在手机端隐藏左侧菜单——后续 Task 13 加移动端抽屉。先这样。)

- [ ] **Step 4：跑测试确认通过**

Run: `pnpm --filter web test -- AppShell`
Expected: PASS, 3 tests passed.

- [ ] **Step 5：commit**

```bash
git add apps/web/src/layouts/AppShell.tsx apps/web/src/layouts/AppShell.test.tsx
git commit -m "feat(web): AppShell 左侧一级导航 + 主区域骨架"
```

---

### Task 9：App.tsx 路由按身份分发

**Files:**
- Modify: `apps/web/src/App.tsx`
- Create: `apps/web/src/app/menus.ts`
- Create: `apps/web/src/app/menus.test.ts`

> App.tsx 当前 3794 行，本任务最小改动：在登录后插入 AppShell 布局，把现有 AccountWorkspace / AgentWorkspace / OperationsWorkspace 作为"看板"键的子页加载，并按身份选择菜单。其它一级菜单（提现、资料、其它）后续 task 再补；本任务只让"看板"和"登出"工作。

- [ ] **Step 1：写菜单工厂失败测试**

```ts
// apps/web/src/app/menus.test.ts
import { describe, expect, it } from 'vitest';
import { menusForScope } from './menus';

describe('menusForScope', () => {
  it('account 角色返回 看板/我的提现/资料', () => {
    const m = menusForScope('account');
    expect(m.map((x) => x.key)).toEqual(['dashboard', 'withdrawal', 'profile']);
  });
  it('agent 角色返回 看板/我的数据/我的提现/资料', () => {
    const m = menusForScope('agent');
    expect(m.map((x) => x.key)).toEqual(['dashboard', 'mydata', 'withdrawal', 'profile']);
  });
  it('admin 角色返回 看板/公司管理/游戏管理/提现管理/代理管理/结算管理/快手授权/分账与配置/权限/审计与维护', () => {
    const m = menusForScope('admin');
    expect(m).toHaveLength(10);
    expect(m[0].key).toBe('dashboard');
  });
});
```

- [ ] **Step 2：跑测试确认失败**

Run: `pnpm --filter web test -- menus`
Expected: FAIL。

- [ ] **Step 3：实现 menus.ts**

```ts
// apps/web/src/app/menus.ts
import type { NavItem } from '../layouts/AppShell';

export type AuthScope = 'account' | 'agent' | 'admin' | 'company-admin' | 'none';

export function menusForScope(scope: AuthScope): NavItem[] {
  switch (scope) {
    case 'account':
      return [
        { key: 'dashboard', label: '看板' },
        { key: 'withdrawal', label: '我的提现' },
        { key: 'profile', label: '资料' },
      ];
    case 'agent':
      return [
        { key: 'dashboard', label: '看板' },
        { key: 'mydata', label: '我的数据' },
        { key: 'withdrawal', label: '我的提现' },
        { key: 'profile', label: '资料' },
      ];
    case 'admin':
      return [
        { key: 'dashboard', label: '看板' },
        { key: 'companies', label: '公司管理' },
        { key: 'games', label: '游戏管理' },
        { key: 'withdrawals', label: '提现管理' },
        { key: 'agents', label: '代理管理' },
        { key: 'settlements', label: '结算管理' },
        { key: 'kuaishou', label: '快手授权' },
        { key: 'config', label: '分账与配置' },
        { key: 'permissions', label: '权限' },
        { key: 'maintenance', label: '审计与维护' },
      ];
    case 'company-admin':
      return [
        { key: 'dashboard', label: '看板' },
        { key: 'games', label: '游戏列表' },
        { key: 'user-search', label: '用户查询' },
      ];
    case 'none':
    default:
      return [];
  }
}
```

- [ ] **Step 4：跑测试确认通过**

Run: `pnpm --filter web test -- menus`
Expected: PASS, 3 tests passed.

- [ ] **Step 5：在 App.tsx 引入 AppShell（最小改动）**

定位 App.tsx 中"登录后渲染 workspace"的部分（搜 `AccountWorkspace` 看哪里被渲染），在它外面包 AppShell。在 App 顶层 useState 加：

```tsx
const [activeMenu, setActiveMenu] = useState('dashboard');
```

把 workspace 渲染替换为：

```tsx
import { AppShell } from './layouts/AppShell';
import { menusForScope, type AuthScope } from './app/menus';

// ... 在 render 时
const scope: AuthScope =
  session.kind === 'account' ? 'account' :
  session.kind === 'agent' ? 'agent' :
  session.kind === 'admin' ? 'admin' :
  'none';

return (
  <AppShell
    items={menusForScope(scope)}
    active={activeMenu}
    onNavigate={setActiveMenu}
    title={titleForScope(scope)}
  >
    {activeMenu === 'dashboard' && session.kind === 'account' && <AccountWorkspace ... />}
    {activeMenu === 'dashboard' && session.kind === 'agent' && <AgentWorkspace ... />}
    {activeMenu === 'dashboard' && session.kind === 'admin' && <OperationsWorkspace ... />}
    {/* 其它菜单后续 task 补；当前先用占位 */}
    {activeMenu !== 'dashboard' && (
      <div className="text-sm text-zinc-500">该模块在后续迭代中接入。</div>
    )}
  </AppShell>
);

function titleForScope(s: AuthScope): string {
  return s === 'account' ? '用户工作台'
    : s === 'agent' ? '代理工作台'
    : s === 'admin' ? '超级管理员'
    : s === 'company-admin' ? '公司管理员'
    : '';
}
```

> **重要**：本任务**不删除** OperationsWorkspace / AccountWorkspace / AgentWorkspace 等现有组件，只在外面包 shell。这样保留所有现有功能完整运行，渐进式重构。

- [ ] **Step 6：跑全量前端测试**

Run: `pnpm --filter web test`
Expected: 全部通过（既有 119 + 新增）。

- [ ] **Step 7：手工验收**

```bash
pnpm dev
```
浏览器开 `http://127.0.0.1:8012/`，登录每种角色看：
- 左侧能看到对应菜单
- 默认进入"看板"显示原 workspace
- 点击其它菜单显示"该模块在后续迭代中接入"
- 仍能登出

- [ ] **Step 8：commit**

```bash
git add apps/web/src/App.tsx apps/web/src/app/menus.ts apps/web/src/app/menus.test.ts
git commit -m "feat(web): AppShell 接入 App.tsx 路由分发，按身份显示一级菜单（看板默认开）"
```

---

## M4 普通用户看板

### Task 10：API 客户端方法 + 类型

**Files:**
- Modify: `apps/web/src/lib/aiKsApi.ts`
- Modify: `apps/web/src/types/api.ts`

- [ ] **Step 1：在 types/api.ts 追加类型**

```ts
// apps/web/src/types/api.ts （文件末尾）

export type UserDashboardOverview = {
  todayCount: number;
  todayAverageEcpmYuan: number;
  todayMaxEcpmYuan: number;
  gameCount: number;
  accountCount: number;
  activeGameCount: number;
  activeAccountCount: number;
};

export type UserDashboardAccountRow = {
  accountId: string;
  readableId: string;
  todayCount: number;
  todayAverageEcpmYuan: number;
  totalCount: number;
  lastActiveAt: string | null;
  activeStatus: 'ACTIVE' | 'IDLE' | 'NEVER';
};

export type UserDashboardGameGroup = {
  gameId: string;
  gameName: string;
  todayCount: number;
  todayAverageEcpmYuan: number;
  totalCount: number;
  lastActiveAt: string | null;
  accounts: UserDashboardAccountRow[];
};

export type UserDashboardEcpmRecord = {
  todaySequence: number;
  eventTime: string;
  ecpmYuan: number;
  gameId: string;
  gameName: string;
  accountId: string;
  accountReadableId: string;
  source: string;
  displayAmountYuan?: number;
  status?: string;
  errorReason?: string;
};

export type UserDashboardEcpmRecordsResult = {
  records: UserDashboardEcpmRecord[];
  totalToday: number;
  totalAll: number;
};
```

- [ ] **Step 2：在 aiKsApi.ts 追加方法**

```ts
// apps/web/src/lib/aiKsApi.ts （在 aiKsApi 对象内合适位置）
async getUserDashboardOverview(date?: string): Promise<UserDashboardOverview> {
  const qs = date ? `?date=${encodeURIComponent(date)}` : '';
  return apiFetch<UserDashboardOverview>(`/users/me/dashboard/overview${qs}`);
},

async getUserDashboardGroups(date?: string): Promise<UserDashboardGameGroup[]> {
  const qs = date ? `?date=${encodeURIComponent(date)}` : '';
  return apiFetch<UserDashboardGameGroup[]>(`/users/me/dashboard/groups${qs}`);
},

async getUserDashboardRecords(input: { date?: string; gameId?: string; accountId?: string; limit?: number }): Promise<UserDashboardEcpmRecordsResult> {
  const params = new URLSearchParams();
  if (input.date) params.set('date', input.date);
  if (input.gameId) params.set('gameId', input.gameId);
  if (input.accountId) params.set('accountId', input.accountId);
  if (input.limit) params.set('limit', String(input.limit));
  const qs = params.toString();
  return apiFetch<UserDashboardEcpmRecordsResult>(`/users/me/dashboard/records${qs ? '?' + qs : ''}`);
},
```

> 顶部 import 时从 types/api 引入新增类型。

- [ ] **Step 3：跑前端 lint 确认类型对**

Run: `pnpm --filter web lint`
Expected: 通过。

- [ ] **Step 4：commit**

```bash
git add apps/web/src/lib/aiKsApi.ts apps/web/src/types/api.ts
git commit -m "feat(web): API 客户端添加 user-dashboard 三个查询方法（overview/groups/records）"
```

---

### Task 11：UserDashboardPage（KPI + 游戏分组 + 记录列表）

**Files:**
- Create: `apps/web/src/pages/UserDashboardPage.tsx`
- Create: `apps/web/src/pages/UserDashboardPage.test.tsx`

- [ ] **Step 1：写组件失败测试（render 路径 + 关键交互）**

```tsx
// apps/web/src/pages/UserDashboardPage.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { UserDashboardPage } from './UserDashboardPage';

const stubApi = {
  getUserDashboardOverview: vi.fn().mockResolvedValue({
    todayCount: 12, todayAverageEcpmYuan: 39.8, todayMaxEcpmYuan: 56.8,
    gameCount: 3, accountCount: 6, activeGameCount: 2, activeAccountCount: 5,
  }),
  getUserDashboardGroups: vi.fn().mockResolvedValue([
    { gameId: 'g1', gameName: '消消乐 Pro', todayCount: 8, todayAverageEcpmYuan: 40.5, totalCount: 382, lastActiveAt: null,
      accounts: [
        { accountId: 'a1', readableId: 'A8F3D2K', todayCount: 5, todayAverageEcpmYuan: 41.4, totalCount: 287, lastActiveAt: null, activeStatus: 'ACTIVE' },
      ] },
  ]),
  getUserDashboardRecords: vi.fn().mockResolvedValue({
    records: [
      { todaySequence: 1, eventTime: '2026-05-11T13:42:11+08:00', ecpmYuan: 38.20, gameId: 'g1', gameName: '消消乐 Pro', accountId: 'a1', accountReadableId: 'A8F3D2K', source: 'kuaishou' },
    ],
    totalToday: 1, totalAll: 1,
  }),
};

describe('UserDashboardPage', () => {
  it('加载完成后显示 KPI 与游戏分组与单条记录', async () => {
    render(<UserDashboardPage api={stubApi} userReadableId="A8F3D2K" />);
    await waitFor(() => expect(screen.getByText('12')).toBeInTheDocument());
    expect(screen.getByText('¥ 39.80')).toBeInTheDocument();
    expect(screen.getByText('消消乐 Pro')).toBeInTheDocument();
    expect(screen.getByText('第 1 条 🎯')).toBeInTheDocument();
  });

  it('点击"立即刷新"会重新调用 3 个 API', async () => {
    render(<UserDashboardPage api={stubApi} userReadableId="A8F3D2K" />);
    await waitFor(() => expect(screen.getByText('12')).toBeInTheDocument());
    fireEvent.click(screen.getByText(/立即刷新/));
    await waitFor(() => expect(stubApi.getUserDashboardOverview).toHaveBeenCalledTimes(2));
  });
});
```

- [ ] **Step 2：跑测试确认失败**

Run: `pnpm --filter web test -- UserDashboardPage`
Expected: FAIL。

- [ ] **Step 3：实现 UserDashboardPage**

```tsx
// apps/web/src/pages/UserDashboardPage.tsx
import { useCallback, useEffect, useState } from 'react';
import { EcpmRecordTable, type EcpmRecordExtraColumn } from '../components/domain/EcpmRecordTable';
import { useThrottledRefresh } from '../lib/useThrottledRefresh';
import { formatUserId } from '../lib/idFormat';
import type {
  UserDashboardOverview,
  UserDashboardGameGroup,
  UserDashboardEcpmRecordsResult,
} from '../types/api';

type Api = {
  getUserDashboardOverview: (date?: string) => Promise<UserDashboardOverview>;
  getUserDashboardGroups: (date?: string) => Promise<UserDashboardGameGroup[]>;
  getUserDashboardRecords: (i: { date?: string; gameId?: string; accountId?: string; limit?: number }) => Promise<UserDashboardEcpmRecordsResult>;
};

export type UserDashboardPageProps = {
  api: Api;
  userReadableId: string;
  date?: string;
};

export function UserDashboardPage({ api, userReadableId, date }: UserDashboardPageProps) {
  const [filter, setFilter] = useState<{ gameId?: string; accountId?: string }>({});
  const [extraCols, setExtraCols] = useState<EcpmRecordExtraColumn[]>([]);

  const fetchAll = useCallback(async () => {
    const [overview, groups, records] = await Promise.all([
      api.getUserDashboardOverview(date),
      api.getUserDashboardGroups(date),
      api.getUserDashboardRecords({ date, ...filter, limit: 50 }),
    ]);
    return { overview, groups, records };
  }, [api, date, filter]);

  const refresher = useThrottledRefresh(fetchAll, { windowMs: 5000 });
  const { data, refresh, toast } = refresher;

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div className="space-y-4">
      {/* 顶部欢迎条 */}
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <div className="text-base font-semibold">
            你好 <span className="font-mono">{formatUserId(userReadableId)}</span>
          </div>
          <div className="text-xs text-zinc-500">
            {data?.overview ? `${data.overview.gameCount} 个游戏 · ${data.overview.accountCount} 个账号` : '加载中...'}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={refresh}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >⟳ 立即刷新</button>
          {toast && (
            <span className={toast.kind === 'error' ? 'text-red-500 text-xs' : 'text-emerald-600 text-xs'}>
              {toast.message}
            </span>
          )}
        </div>
      </div>

      {/* 4 KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="今日 ECPM 条数" value={String(data?.overview.todayCount ?? '—')} />
        <KpiCard label="今日平均 ECPM" value={data?.overview ? `¥ ${data.overview.todayAverageEcpmYuan.toFixed(2)}` : '—'} />
        <KpiCard label="游戏数" value={String(data?.overview.gameCount ?? '—')} hint={data?.overview ? `${data.overview.activeGameCount} 个今日活跃` : ''} />
        <KpiCard label="账号总数" value={String(data?.overview.accountCount ?? '—')} hint={data?.overview ? `${data.overview.activeAccountCount} 个今日活跃` : ''} />
      </div>

      {/* 游戏与账号分组 */}
      <section className="bg-white border rounded p-4">
        <div className="font-semibold mb-2">我的游戏与账号</div>
        {data?.groups?.length ? (
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs text-zinc-600">
              <tr>
                <th className="text-left p-2 font-normal">游戏 / 账号</th>
                <th className="text-right p-2 font-normal">今日条数</th>
                <th className="text-right p-2 font-normal">平均 ECPM</th>
                <th className="text-right p-2 font-normal">累计</th>
                <th className="text-left p-2 font-normal">状态</th>
              </tr>
            </thead>
            <tbody>
              {data.groups.map((g) => (
                <>
                  <tr key={g.gameId} className="bg-zinc-50/50 border-t">
                    <td className="p-2 font-semibold">{g.gameName} <span className="text-xs font-normal text-zinc-500">{g.accounts.length} 个账号</span></td>
                    <td className="p-2 text-right font-semibold">{g.todayCount}</td>
                    <td className="p-2 text-right font-semibold">¥ {g.todayAverageEcpmYuan.toFixed(2)}</td>
                    <td className="p-2 text-right font-semibold">{g.totalCount}</td>
                    <td />
                  </tr>
                  {g.accounts.map((a) => (
                    <tr key={a.accountId} className="border-t">
                      <td className="pl-7 p-2 font-mono text-blue-600">{a.readableId}</td>
                      <td className="p-2 text-right">{a.todayCount}</td>
                      <td className="p-2 text-right">¥ {a.todayAverageEcpmYuan.toFixed(2)}</td>
                      <td className="p-2 text-right">{a.totalCount}</td>
                      <td className="p-2 text-xs"><StatusBadge status={a.activeStatus} /></td>
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        ) : <div className="text-sm text-zinc-500">还没有绑定游戏。</div>}
      </section>

      {/* ECPM 单条记录 */}
      <section className="bg-white border rounded p-4">
        <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
          <div className="font-semibold">我的 ECPM 记录</div>
          <div className="flex items-center gap-2 text-xs">
            <select className="border rounded px-2 py-1 text-xs" value={filter.gameId ?? ''} onChange={(e) => setFilter((f) => ({ ...f, gameId: e.target.value || undefined }))}>
              <option value="">全部游戏</option>
              {data?.groups?.map((g) => <option key={g.gameId} value={g.gameId}>{g.gameName}</option>)}
            </select>
            <button type="button" onClick={() => setExtraCols((cols) => cols.length ? [] : ['displayAmount'])} className="px-2 py-1 border rounded">
              ⚙ 列设置
            </button>
          </div>
        </div>
        <EcpmRecordTable
          rows={data?.records.records.map((r) => ({
            todaySequence: r.todaySequence,
            eventTimeIso: r.eventTime,
            ecpmYuan: r.ecpmYuan,
            gameName: r.gameName,
            accountReadableId: r.accountReadableId,
            source: r.source,
            displayAmountYuan: r.displayAmountYuan,
          })) ?? []}
          loading={!data}
          totalToday={data?.records.totalToday ?? 0}
          totalAll={data?.records.totalAll ?? 0}
          extraColumns={extraCols}
        />
      </section>
    </div>
  );
}

function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-white border rounded p-3">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {hint && <div className="text-xs text-zinc-500 mt-1">{hint}</div>}
    </div>
  );
}

function StatusBadge({ status }: { status: 'ACTIVE' | 'IDLE' | 'NEVER' }) {
  const cls = status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-600';
  const text = status === 'ACTIVE' ? '活跃' : status === 'IDLE' ? '闲置' : '从未活跃';
  return <span className={`px-2 py-0.5 rounded ${cls}`}>{text}</span>;
}
```

- [ ] **Step 4：跑测试确认通过**

Run: `pnpm --filter web test -- UserDashboardPage`
Expected: PASS, 2 tests passed.

- [ ] **Step 5：commit**

```bash
git add apps/web/src/pages/UserDashboardPage.tsx apps/web/src/pages/UserDashboardPage.test.tsx
git commit -m "feat(web): UserDashboardPage 普通用户看板（KPI + 游戏分组 + ECPM 单条记录 + 限流刷新）"
```

---

### Task 12：把 UserDashboardPage 接入 App.tsx 替代旧 AccountWorkspace

**Files:**
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1：修改 App.tsx 中"账号 dashboard"分支**

把：
```tsx
{activeMenu === 'dashboard' && session.kind === 'account' && <AccountWorkspace ... />}
```

改成：
```tsx
{activeMenu === 'dashboard' && session.kind === 'account' && (
  <UserDashboardPage api={aiKsApi} userReadableId={session.account.readableId} />
)}
```

确保：
1. `session.account.readableId` 是从登录返回的字段（按需 import 或映射）。如果当前 session 类型没有 readableId，从 `session.account` 取 `readableId`，对照 `apps/api/src/features/account/account.service.ts` 看登录返回字段。如缺失需要先后端补：在 `presentAuthenticatedAccount` 里把 `readableId` 加入响应（这是 readableId 已存在数据库字段，加 select 即可）。
2. 顶部 import：

```tsx
import { UserDashboardPage } from './pages/UserDashboardPage';
import { aiKsApi } from './lib/aiKsApi';
```

- [ ] **Step 2：保持 "我的提现" / "资料" 走旧 AccountWorkspace**

在 AppShell 内：

```tsx
{activeMenu === 'withdrawal' && session.kind === 'account' && (
  <AccountWorkspace
    onlySection="withdrawal"
    /* ...原 props */
  />
)}
{activeMenu === 'profile' && session.kind === 'account' && (
  <AccountWorkspace onlySection="profile" /* ... */ />
)}
```

如果 AccountWorkspace 不支持 `onlySection`，加一个可选 prop（默认显示全部，传值时只渲染对应 section）。这样保留旧功能可达。

- [ ] **Step 3：手工跑测试**

Run: `pnpm --filter web test`
Expected: 全部通过。

- [ ] **Step 4：手工验收**

```bash
pnpm dev
```
- 注册一个测试账号，登录
- 进入"看板"应该看到 UserDashboardPage 而不是旧 AccountWorkspace
- 点"我的提现"仍然能用旧的提现页
- 点"资料"仍然能改资料

- [ ] **Step 5：commit**

```bash
git add apps/web/src/App.tsx apps/web/src/pages/AccountWorkspace.tsx
git commit -m "feat(web): 普通用户看板默认进入 UserDashboardPage（提现/资料保留旧页）"
```

---

### Task 13：移动端响应式适配（用户看板专项）

**Files:**
- Modify: `apps/web/src/pages/UserDashboardPage.tsx`
- Modify: `apps/web/src/components/domain/EcpmRecordTable.tsx`
- Modify: `apps/web/src/layouts/AppShell.tsx`

- [ ] **Step 1：AppShell 加移动端汉堡菜单**

```tsx
// apps/web/src/layouts/AppShell.tsx 修改
import { useState } from 'react';

export function AppShell(props: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // ...

  return (
    <div className="min-h-screen flex bg-zinc-50">
      {/* 移动端汉堡 */}
      <header className="md:hidden fixed top-0 left-0 right-0 bg-white border-b z-20 flex items-center px-3 py-2 gap-2">
        <button onClick={() => setMobileNavOpen(true)} className="p-1 text-xl">☰</button>
        <span className="font-semibold">{title}</span>
      </header>

      {/* 移动端抽屉 */}
      {mobileNavOpen && (
        <div className="md:hidden fixed inset-0 z-30 bg-black/30" onClick={() => setMobileNavOpen(false)}>
          <aside className="w-60 h-full bg-white py-4" onClick={(e) => e.stopPropagation()}>
            {/* 同桌面菜单内容 */}
          </aside>
        </div>
      )}

      {/* 桌面侧栏（保持原样，hidden md:block） */}
      <aside className="w-52 bg-white border-r border-zinc-200 py-4 hidden md:block">...</aside>

      <main className="flex-1 md:ml-0 mt-12 md:mt-0">
        <div className="p-3 md:p-6">{children}</div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2：UserDashboardPage 默认关闭自动刷新（移动端节流流量）**

把 useThrottledRefresh 改为接收 `autoRefresh` 状态：

```tsx
const [autoRefreshOn, setAutoRefreshOn] = useState(false);  // 默认关
const [autoIntervalMs, setAutoIntervalMs] = useState(10_000);

useEffect(() => {
  if (autoRefreshOn) refresher.startAuto(autoIntervalMs);
  else refresher.stopAuto();
}, [autoRefreshOn, autoIntervalMs, refresher]);
```

在 ECPM 记录卡片标题栏右上加：

```tsx
<label className="flex items-center gap-1 text-xs">
  <input type="checkbox" checked={autoRefreshOn} onChange={(e) => setAutoRefreshOn(e.target.checked)} />
  自动刷新
</label>
<select value={autoIntervalMs} onChange={(e) => setAutoIntervalMs(Number(e.target.value))} className="text-xs border rounded px-1 py-0.5">
  <option value={5000}>5 秒</option>
  <option value={10000}>10 秒</option>
  <option value={30000}>30 秒</option>
</select>
```

- [ ] **Step 3：UserDashboardPage 游戏分组移动端折叠卡片**

把 `<table>` 改成 `<div className="md:hidden">` 卡片堆叠版 + `<table className="hidden md:table">` 桌面版（双视图）：

```tsx
{/* 移动端 */}
<div className="md:hidden space-y-2">
  {data.groups?.map((g) => (
    <details key={g.gameId} className="border rounded bg-white">
      <summary className="p-3 cursor-pointer flex justify-between items-center">
        <div>
          <div className="font-semibold text-sm">{g.gameName}</div>
          <div className="text-xs text-zinc-500">{g.accounts.length} 个账号 · 今日 {g.todayCount} 条 · 平均 ¥{g.todayAverageEcpmYuan.toFixed(2)}</div>
        </div>
      </summary>
      <ul className="border-t">
        {g.accounts.map((a) => (
          <li key={a.accountId} className="p-3 flex justify-between text-xs border-t first:border-t-0">
            <span className="font-mono text-blue-600">{a.readableId}</span>
            <span className="text-zinc-500">{a.todayCount} 条 · ¥{a.todayAverageEcpmYuan.toFixed(2)}</span>
          </li>
        ))}
      </ul>
    </details>
  ))}
</div>
```

- [ ] **Step 4：EcpmRecordTable 在窄屏下用卡片视图**

把现有 `<table>` 包在 `<div className="hidden md:block">` 里，再加一段 `<div className="md:hidden space-y-2">{rows.map...}</div>` 用卡片：

```tsx
{/* 移动端 */}
<div className="md:hidden space-y-2">
  {rows.map((r) => (
    <div key={`${r.todaySequence}-${r.eventTimeIso}`} className="border rounded bg-white p-3 flex justify-between text-xs">
      <div>
        <div className="font-semibold">{r.todaySequence === 1 ? '第 1 条 🎯' : `第 ${r.todaySequence} 条`}</div>
        <div className="font-mono text-zinc-500">{formatEventTime(r.eventTimeIso)}</div>
      </div>
      <div className="text-right">
        <div className="font-semibold">¥ {r.ecpmYuan.toFixed(2)}</div>
        <div className="text-zinc-500">{r.gameName} · {r.accountReadableId}</div>
      </div>
    </div>
  ))}
</div>
```

- [ ] **Step 5：跑全量前端测试**

Run: `pnpm --filter web test`
Expected: 全部通过。

- [ ] **Step 6：手工移动端验收**

```bash
pnpm dev
```
浏览器开 `http://127.0.0.1:8012/`，DevTools 切到 iPhone 360px：
- 顶部出现汉堡 + 标题
- 点汉堡能打开侧栏菜单
- KPI 卡 2x2 布局
- 游戏分组变成可折叠卡片
- ECPM 记录是卡片堆叠不是表格
- 没有横向溢出

- [ ] **Step 7：commit**

```bash
git add apps/web/src/pages/UserDashboardPage.tsx apps/web/src/components/domain/EcpmRecordTable.tsx apps/web/src/layouts/AppShell.tsx
git commit -m "feat(web): 用户看板移动端响应式适配（汉堡菜单 + 折叠分组 + 卡片记录 + 默认关自动刷新）"
```

---

## M5 端到端验收

### Task 14：验收 + 总结

- [ ] **Step 1：跑完整验证矩阵**

```bash
pnpm --filter api test
pnpm --filter api build
pnpm --filter api prisma:validate
pnpm --filter web test
pnpm --filter web lint
pnpm --filter web build
```
Expected: 全部通过。

- [ ] **Step 2：本地端到端验收**

```bash
pnpm dev
```

打开 `http://127.0.0.1:8012/`，按以下顺序验收：

1. **超级管理员登录**：能看到 10 项菜单；"看板"显示原 OperationsWorkspace（兼容过渡，Plan 2 重构）
2. **代理登录**：能看到 4 项菜单；"看板"显示原 AgentWorkspace（兼容过渡）
3. **普通用户登录**：能看到 3 项菜单；"看板"显示新 UserDashboardPage
   - 顶部欢迎 `你好 U-XXXXXXX`
   - 4 KPI 数字（今日条数 / 平均 ECPM / 游戏数 / 账号数），数字基于 raw_ecpms 真实数据
   - 游戏与账号分组表正常显示
   - ECPM 记录列表按时间倒序，每条带"今日序号"
   - 点"⟳ 立即刷新"5 秒内连续点 10 次，只发出 1 次请求（DevTools Network 验证），不出错误提示
   - 切换游戏筛选后列表更新
4. **移动端验收**（DevTools 切 iPhone 360px）：所有内容能滑动、无横向溢出、汉堡菜单可用

- [ ] **Step 3：测试 ECPM 实时验证场景**

1. 用超级管理员给"测试游戏"分配预算
2. 用普通测试账号绑定 open_id
3. （mock 模式下）触发一次 ECPM 同步
4. 测试账号登录看板 → 看到"今日 ECPM 条数"+1，记录列表顶部出现"第 1 条 🎯"
5. 再触发一次同步 → 顶部出现"第 2 条"，黄底高亮 2 秒褪去（如时间允许实现这个动效）

- [ ] **Step 4：把验收结果记录回 spec 状态**

修改 `docs/PROJECT_STATUS.zh-CN.md`，在合适位置添加：

```markdown
### N. ECPM 看板重构（Plan 1：基础 + 普通用户端）

- 新增 `UserDashboardModule` 提供 KPI / 游戏分组 / ECPM 单条记录三个查询接口
- 新增 `RateLimitGuard` + `CachedResponseInterceptor` 实现"静默节流"
- 前端新增 `AppShell` 左侧导航，按身份分发菜单
- 普通用户看板（`UserDashboardPage`）含 KPI、游戏分组、ECPM 单条记录、移动端响应式
- 代理 / 公司管理员 / 超级管理员看板留待 Plan 2
```

- [ ] **Step 5：最终 commit**

```bash
git add docs/PROJECT_STATUS.zh-CN.md
git commit -m "docs: ECPM 看板重构 Plan 1（基础 + 普通用户端）落地小结"
```

---

## 后续（Plan 2 范围）

Plan 2 将覆盖：

- 代理看板（身份卡 + 名下用户列表，代理"我的数据"复用 UserDashboardPage）
- 公司管理员看板（公司切换器 + 只读游戏列表）
- 超级管理员看板（全平台 KPI + 异常区 + 公司/游戏/用户下钻）
- 拆除旧 OperationsWorkspace 10-tab 巨型组件

完成 Plan 1 后调用 `superpowers:brainstorming` 或直接调用 `superpowers:writing-plans` 撰写 Plan 2。
