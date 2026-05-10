# ECPM 运维中心与超级管理员功能栏设计

## 背景

当前超级管理员的运营页在内容区顶部用一排横向按钮切换模块：总览、联调、预算、授权、同步、结算、提现、审计、配置、代理、权限、维护。随着功能增加，这组按钮会挤占主内容区，也不能表达业务对象之间的关系。

ECPM 目前分散在快手刷新、同步任务、游戏配置和收益明细里。后续需要支持按公司、游戏、用户、open_id 的查询和定向更新，并生成详细更新报告。因此 ECPM 需要成为独立的运维中心，而不是游戏或快手模块下的附属按钮。

## 目标

1. 超级管理员进入运营管理后，左侧功能栏按业务对象组织功能。
2. ECPM 看板作为一级功能入口，提供查询、更新和报告能力。
3. ECPM 更新默认拉取最新小时数据，也允许管理员选择小时级时间范围。
4. 支持按公司、游戏、用户、open_id 定向更新。
5. 每次更新都生成可审计的详细报告。
6. 尽量复用现有 `raw_ecpms`、`kuaishou_ecpm_sync_jobs`、`KuaishouEcpmRangeSyncService` 和前端表格组件。

## 非目标

1. 不重写现有结算、提现、代理收益算法。
2. 不改变普通账号、代理账号、游客的主导航结构。
3. 不把所有 ECPM 数据导出、图表分析、长期趋势预测纳入本次第一版。
4. 不在同步请求中直接阻塞页面等待大范围公司更新完成；大范围更新按任务处理。

## 信息架构

运营管理页保留最外层 `DashboardLayout` 侧边栏。进入超级管理员运营管理后，右侧内容区改为两栏：

- 左侧：运营功能栏。
- 右侧：当前功能的工作区。

超级管理员功能栏按业务域分组：

- 公司：公司列表、创建公司、公司余额充值、公司管理员权限。
- 游戏：游戏列表、创建游戏、游戏预算、游戏配置、游戏联调。
- ECPM 看板：ECPM 查询、定向更新、更新报告。
- 快手授权/同步：平台授权、Token 状态、同步任务、失败重试。
- 结算：结算预览、结算确认、结算明细。
- 提现：提现审核、打款处理、失败关闭、提现详情。
- 代理：代理列表、创建代理、代理收款资料、代理提现。
- 审计：审计日志。
- 配置/维护：平台业务配置、测试数据维护。

公司管理员视角只显示其有读权限的业务入口。超级管理员专属写操作继续隐藏。

## ECPM 看板

ECPM 看板是左侧一级入口，右侧工作区内部有三个标签：

1. 数据看板
2. 定向更新
3. 更新报告

### 数据看板

数据看板支持四种查询视角：

- 按公司：展示公司下各游戏的 ECPM 汇总。字段包括公司、游戏、数据小时、open_id 数、事件数、原始金额、展示金额、最近更新时间。
- 按游戏：展示某游戏下各 open_id 的 ECPM 明细或汇总。字段包括游戏、open_id、用户可读 ID、数据小时、事件数、原始金额、展示金额、结算状态。
- 按用户：展示某用户绑定的 open_id 及其 ECPM 数据。字段包括用户、可读 ID、游戏、open_id、数据小时、原始金额、展示金额、结算状态。
- 按 open_id：精确查看某个 open_id 的最新和历史 ECPM 行。

默认进入时展示“最新数据”，即最新一个数据小时。管理员可切换为小时范围查询。小时范围使用已有 `YYYY-MM-DDTHH:00:00+08:00` 口径。

### 定向更新

定向更新支持四种范围：

- 公司：解析公司下所有未删除游戏，再解析每个游戏下已登记 open_id。
- 游戏：解析指定游戏下已登记 open_id。
- 用户：解析该用户绑定的所有 open_id，并按所属游戏分组。
- open_id：解析指定 open_id 所属游戏，只更新该 open_id。

时间范围规则：

- 默认：最新小时。
- 可选：开始小时和结束小时。
- 粒度：小时。
- 第一版限制单次范围最多 24 小时，沿用现有重试范围限制，避免误触发大批量请求。

更新按钮触发后创建 ECPM 更新任务。小范围任务可以立即返回完成结果；公司级或多游戏任务必须按任务列表展示状态，前端不依赖长时间同步等待。

### 更新报告

每次更新生成一条报告，报告至少包含：

- 任务 ID
- 任务状态：RUNNING、SUCCEEDED、FAILED、PARTIAL
- 触发人和触发角色
- 触发时间、开始时间、结束时间
- 范围类型：company、game、user、open_id
- 范围对象：公司 ID、游戏 ID、用户 ID 或 open_id
- 解析出的游戏数量和 open_id 数量
- 开始数据小时、结束数据小时、覆盖小时列表
- 请求来源：mock 或 kuaishou
- 请求数量、保存数量、失败数量、跳过数量
- 失败明细：游戏、open_id、数据小时、错误信息
- 跳过明细：无 open_id、无权限、游戏未配置、Token 不可用等

现有 `kuaishou_ecpm_sync_jobs` 可以继续作为游戏级任务记录。为了支持公司、用户、open_id 范围和详细报告，需要扩展任务记录或新增报告明细表。推荐新增 ECPM 更新任务聚合表，游戏级同步记录作为子任务或明细。

## 后端设计

### 查询 API

新增 ECPM 看板查询接口，建议放在管理员域内：

- `GET /admin/ecpm/dashboard/company`
- `GET /admin/ecpm/dashboard/game`
- `GET /admin/ecpm/dashboard/user`
- `GET /admin/ecpm/dashboard/open-id`
- `GET /admin/ecpm/dashboard/latest`

共同参数：

- `companyId`
- `gameId`
- `userId`
- `openId`
- `startedDataHour`
- `endedDataHour`
- `status`
- `page`
- `pageSize`

超级管理员可查全部数据。公司管理员只能查授权公司和游戏范围内的数据。

### 更新 API

新增统一更新接口：

- `POST /admin/ecpm/update`

请求体：

```json
{
  "scopeType": "company",
  "scopeId": "company-id",
  "mode": "latest",
  "startedDataHour": null,
  "endedDataHour": null
}
```

`scopeType` 可取 `company`、`game`、`user`、`open_id`。`mode` 可取 `latest` 或 `range`。`latest` 默认只更新最新小时；`range` 必须提供开始和结束小时。

### 报告 API

新增报告接口：

- `GET /admin/ecpm/update-jobs`
- `GET /admin/ecpm/update-jobs/:jobId`
- `POST /admin/ecpm/update-jobs/:jobId/retry`

列表返回摘要，详情返回范围解析结果、子任务、失败明细和跳过明细。

## 数据设计

现有表：

- `raw_ecpms` 保存 ECPM 原始数据和展示金额。
- `kuaishou_ecpm_sync_jobs` 保存游戏级同步任务。
- `games` 已有 ECPM 自动同步配置。
- `game_open_ids` 关联 open_id、游戏和用户。

推荐新增聚合任务表：

- `ecpm_update_jobs`
  - `id`
  - `status`
  - `scope_type`
  - `scope_id`
  - `mode`
  - `started_data_hour`
  - `ended_data_hour`
  - `requested_game_count`
  - `requested_open_id_count`
  - `saved_count`
  - `failed_count`
  - `skipped_count`
  - `actor_type`
  - `actor_id`
  - `started_at`
  - `finished_at`
  - `error_message`
  - `created_at`
  - `updated_at`

- `ecpm_update_job_items`
  - `id`
  - `job_id`
  - `game_app_id`
  - `open_id`
  - `data_hour`
  - `status`
  - `saved_count`
  - `skip_reason`
  - `error_message`
  - `kuaishou_sync_job_id`
  - `created_at`
  - `updated_at`

如果第一版要降低迁移成本，可以先扩展 `kuaishou_ecpm_sync_jobs`，但这会让公司级和用户级聚合报告难以表达。推荐新增聚合表。

## 前端设计

`OperationsWorkspace` 当前维护 `activePane` 和横向 `operations-nav`。改造后：

1. 将横向 `operations-nav` 替换为运营页内部的左侧功能栏。
2. 将现有功能按业务域拆分渲染。
3. 新增 `EcpmOperationsCenter` 组件，负责 ECPM 看板三标签。
4. 保留现有 `EcpmTable`，但扩展为支持汇总行和明细行，或新增专用表格组件。
5. 定向更新表单使用范围类型选择、范围对象选择、时间模式选择、小时输入。
6. 更新报告页显示任务列表和详情，不把错误明细塞进顶部提示。

布局要求：

- 桌面端：运营页内部左侧功能栏固定宽度，右侧工作区自适应。
- 窄屏：功能栏变为顶部可横向滚动或折叠列表，避免内容挤压。
- 顶部 `topbar` 只保留当前页面标题、会话状态和退出，不承载业务模块按钮。

## 权限与审计

- ECPM 查询遵循 `AdminAccessControlService.resolveReadScope`。
- ECPM 更新只允许超级管理员。
- 每次更新任务写审计日志，记录范围、小时、解析结果和任务 ID。
- 公司管理员可查看授权范围内的 ECPM 数据和任务报告摘要，但不可触发更新。

## 错误处理

- 参数错误返回明确错误：范围类型不支持、小时格式非法、范围超过 24 小时。
- 范围解析为空时不调用快手接口，生成 `SUCCEEDED` 或 `PARTIAL` 报告，并记录跳过原因。
- 快手 Token 错误沿用现有 `KuaishouTokenService.markTokenError`。
- 单个游戏或 open_id 失败不应让整个公司任务丢失报告；聚合任务可进入 `PARTIAL`。

## 测试计划

后端：

- 查询服务按公司、游戏、用户、open_id 返回正确范围和汇总。
- 更新范围解析服务正确解析公司、游戏、用户、open_id。
- `latest` 模式生成最新小时；`range` 模式按小时生成数据小时列表。
- 超过 24 小时范围被拒绝。
- 公司管理员不能触发更新。
- 更新任务报告统计成功、失败、跳过数量。

前端：

- 超级管理员看到业务域左侧功能栏，ECPM 看板是一级入口。
- 公司管理员不看到超级管理员写操作。
- ECPM 看板默认展示最新数据。
- 定向更新表单在 `latest` 和 `range` 模式之间切换正确。
- 更新报告列表和详情展示任务统计与错误明细。

