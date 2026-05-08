# AI-KS 快手 ECPM 同步任务历史设计

日期：2026-05-09

状态：已按当前讨论确认，等待实施计划。

## 目标

本阶段把现有“手动刷新快手 ECPM”升级为可追踪的同步任务，让管理员能看到每次同步的状态、范围、写入数量和失败原因。

当前系统已经有：

- 快手平台 token 授权、刷新和状态面板。
- ECPM real/mock 刷新能力。
- ECPM 刷新成功/失败审计日志。
- access token 过期时的自动 refresh token 兜底。

但现有刷新接口只返回当次结果，页面刷新后无法看到历史任务，也无法从运营台快速判断最近一次同步是否失败、失败在哪个游戏或哪个数据小时。本阶段补齐任务历史，不引入后台队列。

## 非目标

本阶段不做以下事项：

- 不做异步队列。
- 不做自动定时任务。
- 不做失败任务自动重试。
- 不做按任务重新执行按钮。
- 不改变现有 ECPM 报表写入规则和金额计算规则。
- 不改变快手 token 授权和刷新流程。

后续定时同步和重试会复用本阶段新增的任务表。

## 数据模型

新增枚举 `KuaishouEcpmSyncJobStatus`：

- `RUNNING`：任务已创建，刷新正在执行。
- `SUCCEEDED`：刷新成功，ECPM 明细已保存。
- `FAILED`：刷新失败，记录错误信息。

新增模型 `KuaishouEcpmSyncJob`：

- `id`
- `status`
- `gameAppId`
- `dataHour`
- `requestedOpenIdCount`
- `savedCount`
- `source`：`mock`、`kuaishou` 或 `null`。
- `errorMessage`
- `actorId`
- `actorType`
- `startedAt`
- `finishedAt`
- `createdAt`
- `updatedAt`

`requestedOpenIdCount` 存数量，不存完整 open_id 列表，避免任务历史中保存过多用户标识。现有审计日志仍可记录必要摘要。

## 后端 API

继续使用 `apps/api/src/features/kuaishou-admin/`，所有接口用现有 `AdminJwtGuard` 保护。

### 手动刷新 ECPM

保留现有接口：

`POST /api/admin/kuaishou/ecpm/refresh`

请求体保持兼容：

- `gameAppId`：必填。
- `dataHour`：可选，默认当前中国日期。
- `openIds`：可选；为空时使用该游戏已知 open_id。

行为调整：

1. 校验请求并解析实际 `dataHour`、`openIds`。
2. 创建 `KuaishouEcpmSyncJob(status=RUNNING)`。
3. 调用现有 `KuaishouEcpmClient.refresh()`。
4. 保存 ECPM rows。
5. 成功时更新任务：
   - `status=SUCCEEDED`
   - `source`
   - `savedCount`
   - `finishedAt`
6. 失败时更新任务：
   - `status=FAILED`
   - `errorMessage`
   - `finishedAt`
7. 保留现有成功/失败审计行为。
8. 响应中增加 `job` 字段，包含任务展示信息。

如果保存任务失败，接口应按普通服务错误处理；不做“无任务但继续刷新”的降级，因为本阶段目标就是让刷新可追踪。

### 查询最近同步任务

新增接口：

`GET /api/admin/kuaishou/ecpm/jobs?limit=20`

返回：

```ts
{
  jobs: Array<{
    id: string;
    status: 'RUNNING' | 'SUCCEEDED' | 'FAILED';
    gameAppId: string;
    dataHour: string;
    requestedOpenIdCount: number;
    savedCount: number;
    source: 'mock' | 'kuaishou' | null;
    errorMessage: string | null;
    actorId: string;
    actorType: string;
    startedAt: string;
    finishedAt: string | null;
    createdAt: string;
    updatedAt: string;
  }>
}
```

`limit` 范围为 1 到 100，默认 20。按 `createdAt desc` 排序。

## 服务边界

新增 `KuaishouEcpmSyncJobService`，负责：

- `startJob(input)`：创建 RUNNING 任务。
- `completeJob(input)`：标记 SUCCEEDED。
- `failJob(input)`：标记 FAILED。
- `listJobs(input)`：查询最近任务。

`KuaishouRefreshController` 只编排流程，不直接写 Prisma 任务表。这样后续定时任务或队列 worker 可以复用同一个 service。

## 前端交互

运营工作台的“快手 ECPM”区域增加最近同步任务展示：

- 最近任务状态。
- 游戏 AppID。
- 数据小时。
- 请求 open_id 数量。
- 写入数量。
- 来源。
- 操作者。
- 开始/完成时间。
- 错误摘要。

进入管理员运营台时加载最近任务。手动刷新 ECPM 成功或失败后重新加载任务列表；成功响应中的 `job` 可先插入到列表顶部，随后再以接口查询结果为准。

前端不展示完整 open_id 列表。

## 错误处理

- 参数缺失：`400`。
- 快手接口失败：任务标记 `FAILED`，接口仍返回现有错误。
- token 不可用：任务标记 `FAILED`，现有 token 错误标记和审计继续执行。
- ECPM rows 保存失败：任务标记 `FAILED`。
- 管理员登录失效：`401`，前端清理管理员 token。

## 测试策略

Prisma 验证：

- 更新 schema 后运行 `pnpm --filter api prisma:generate` 和 `pnpm --filter api prisma:validate`。

后端测试：

- `KuaishouEcpmSyncJobService` 创建 RUNNING 任务。
- 成功完成任务时写入 `SUCCEEDED`、`source`、`savedCount`、`finishedAt`。
- 失败任务写入 `FAILED`、`errorMessage`、`finishedAt`。
- 列表接口按时间倒序返回，limit 限制在 1 到 100。
- ECPM refresh 成功时创建并完成任务，响应包含 `job`。
- ECPM refresh 失败时创建并失败任务，同时保留现有失败审计和 token error 标记。

前端测试：

- API client 调用 `GET /admin/kuaishou/ecpm/jobs?limit=20`。
- `EcpmRefreshResult` 类型包含 `job`。
- 运营工作台渲染最近同步任务列表。
- App 进入管理员后加载任务列表。
- 手动刷新 ECPM 后更新任务列表。

最终验证：

- `pnpm --filter api prisma:generate`
- `pnpm --filter api prisma:validate`
- `pnpm --filter api test`
- `pnpm --filter api build`
- `pnpm --filter web test`
- `pnpm --filter web lint`
- `pnpm --filter web build`

## 实施顺序

1. 扩展 Prisma schema，生成并校验 Prisma client。
2. 新增后端同步任务 service 和单元测试。
3. 修改 ECPM refresh controller 创建/完成/失败任务。
4. 新增同步任务列表接口。
5. 扩展前端类型和 API client。
6. 在运营工作台展示最近同步任务。
7. 接入 App 状态加载和刷新后更新。
8. 跑全量验证并提交。

## 后续扩展

本阶段完成后，可以继续做：

- 定时 ECPM 同步任务。
- 失败任务手动重试。
- 异步队列执行。
- 按游戏/日期筛选同步任务。
- 更细粒度的同步明细表。
