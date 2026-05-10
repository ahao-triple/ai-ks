# ECPM 看板重构 · Plan 2A：超级管理员看板

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让超级管理员登录后第一眼看到新 ECPM 看板（KPI + 趋势 + 异常 + 按公司分布的 ECPM 数据），渐进式接入 OperationsWorkspace 顶部，旧 10 tab 留在下方继续用。

**Architecture:** 后端新增 `super-admin-dashboard` 模块提供聚合查询；前端新增 `SuperAdminDashboardPage` 组件并嵌入 `OperationsWorkspace` 顶部；复用 Plan 1 的 `RateLimitGuard` + `useThrottledRefresh` + 时间筛选交互。

**Spec ref:** `docs/superpowers/specs/2026-05-11-ecpm-dashboard-redesign-design.md` §5.1

## Tasks

### Task 1：后端 SuperAdminDashboardService（KPI + 趋势 + 异常 + 公司分布）

**Files:**
- Create: `apps/api/src/features/super-admin-dashboard/super-admin-dashboard.service.ts`
- Create: `apps/api/src/features/super-admin-dashboard/super-admin-dashboard.service.spec.ts`

- [ ] **Step 1：写 service 失败测试**

```ts
// 关键测试：getOverview, getCompanyDistribution, getAnomalies
// 用 fake prisma 注入 raw_ecpms / games / companies / kuaishou_ecpm_sync_jobs 数据
```

- [ ] **Step 2：实现 service**

3 个方法：
- `getOverview(range)` → `{ todayCount, todayAverageEcpmYuan, todayMaxEcpmYuan, activeGameCount, totalGameCount, activeUserCount, todayDeltaPercent }`
- `getCompanyDistribution(range)` → `Array<{ companyId, companyName, ecpmCount, activeGameCount, totalGameCount, activeUserCount, averageEcpmYuan, maxEcpmYuan }>`，按 ecpmCount 降序
- `getAnomalies()` → `{ syncFailures: Array<{gameId, gameName, jobId, failedAt, error}>, longSilent: Array<{gameId, gameName, hoursSinceLastEcpm}> }`

- [ ] **Step 3：commit**

```bash
git commit -m "feat(api): SuperAdminDashboardService 提供全平台 KPI / 公司分布 / 异常聚合"
```

### Task 2：SuperAdminDashboardController（3 个 GET 接口）

**Files:**
- Create: `apps/api/src/features/super-admin-dashboard/super-admin-dashboard.controller.ts`
- Create: `apps/api/src/features/super-admin-dashboard/super-admin-dashboard.controller.spec.ts`
- Create: `apps/api/src/features/super-admin-dashboard/super-admin-dashboard.module.ts`
- Modify: `apps/api/src/app.module.ts`

接口：
- `GET /admin/dashboard/overview?date=YYYY-MM-DD`
- `GET /admin/dashboard/companies?date=YYYY-MM-DD`
- `GET /admin/dashboard/anomalies`

用 `SuperAdminGuard` + `RateLimitGuard` + `Throttle({ windowMs: 5000, max: 1, cacheMs: 60000 })`。

- [ ] **Step 1：实现 controller + 测试 + 注册 module**
- [ ] **Step 2：commit**

```bash
git commit -m "feat(api): SuperAdminDashboardController 三接口（含限流装饰）"
```

### Task 3：前端 API 客户端

**Files:**
- Modify: `apps/web/src/types/api.ts`
- Modify: `apps/web/src/lib/aiKsApi.ts`

加类型：`SuperAdminDashboardOverview`、`SuperAdminCompanyRow`、`SuperAdminAnomalies`。
加方法：`getSuperAdminDashboardOverview` / `getSuperAdminDashboardCompanies` / `getSuperAdminDashboardAnomalies`，都用 `adminAccessToken`。

- [ ] **Step 1：加类型 + 加 3 个方法**
- [ ] **Step 2：lint 通过 + commit**

```bash
git commit -m "feat(web): API 客户端添加 admin-dashboard 三个查询方法"
```

### Task 4：SuperAdminDashboardPage 组件

**Files:**
- Create: `apps/web/src/pages/SuperAdminDashboardPage.tsx`
- Create: `apps/web/src/pages/SuperAdminDashboardPage.test.tsx`

布局（参考 spec §5.1）：
1. 顶部时间筛选 + 立即刷新（用 `useThrottledRefresh`）
2. 4 个 KPI 卡：今日 ECPM 条数 / 平均 ECPM / 活跃游戏 (n/m) / 活跃用户
3. 趋势图（最近 7 天 ECPM 条数 + 平均 ECPM 双线）—— 简化为 SVG polyline
4. 异常区：同步失败（红底）+ 长时间无数据（黄底）+ "其它暂无异常"
5. 公司数据分布表：列 = 公司 / ECPM 条数 / 活跃游戏 / 活跃用户 / 平均 ECPM / 最高 ECPM；点击公司名暂时不下钻（Plan 2C 做下钻）

接受 `api`（注入 token wrap 的 3 个方法）+ 可选 `initialData` props。

- [ ] **Step 1：写组件 + SSR 测试**
- [ ] **Step 2：commit**

```bash
git commit -m "feat(web): SuperAdminDashboardPage 全平台 ECPM 看板（KPI + 趋势 + 异常 + 公司分布）"
```

### Task 5：接入 OperationsWorkspace 顶部 + CSS

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/styles.css`

在 `activeView === 'operations' && appSession.mode === 'admin'` 块的 OperationsWorkspace 之前插入 `<SuperAdminDashboardPage api={...adminToken-wrapped...} />`。

CSS 复用 `.user-dashboard-*` 风格（KPI 卡 / 时间筛选 / toast）；新增 `.admin-dashboard-anomaly-*` 异常区样式 + 趋势图 SVG container 样式。

- [ ] **Step 1：接入 + 加 CSS**
- [ ] **Step 2：lint + test + build 全过 + commit**

```bash
git commit -m "feat(web): SuperAdminDashboardPage 接入 OperationsWorkspace 顶部 + 异常区与趋势图样式"
```

### Task 6：验收 + 文档

- [ ] 跑全量验证：`pnpm --filter api test/build/prisma:validate` + `pnpm --filter web test/lint/build`
- [ ] 用 admin 账号登录手工验收（http://127.0.0.1:8012/）：进"运营管理"应当先看到新看板（顶部 KPI + 趋势 + 异常 + 公司分布表），下方继续保留旧 10 tab
- [ ] 更新 `docs/PROJECT_STATUS.zh-CN.md` 第 0 节追加 Plan 2A 落地小结
- [ ] commit

```bash
git commit -m "docs: ECPM 看板重构 Plan 2A（超级管理员看板）落地小结"
```

## 后续

- Plan 2B：代理看板（身份卡 + 名下用户列表）
- Plan 2C：下钻视图（公司 → 游戏 → 用户 → 详情）
- Plan 2D：AppShell 替换 DashboardLayout + 拆除旧 OperationsWorkspace
