# AI-KS 管理员公司、游戏与预算管理设计

日期：2026-05-08

状态：已按当前讨论确认，进入实施计划前审阅。

## 目标

本阶段实现超级管理员可用的公司、游戏和预算管理 MVP，让刚完成的管理员结算流程能自然使用后台维护的公司余额和游戏预算。

系统当前已经有 `Company.balanceLi`、`Game.budgetLi` 和结算扣减逻辑，但公司和游戏主要由 `DemoStore` 自动创建，游戏预算也没有后台入口维护。结果是结算能力已经具备，但运营人员无法在应用内给公司充值、创建真实游戏或给游戏分配预算。

本阶段补齐这个运营入口：

- 超级管理员创建和查看公司。
- 超级管理员调整公司余额。
- 超级管理员创建、查看和更新游戏基础信息与快手登录凭证。
- 超级管理员把公司余额分配到指定游戏预算。
- 所有余额和预算变更写入审计日志。
- 前端运营工作台新增预算管理面板，直接使用这些接口。

## 非目标

本阶段不做以下事项：

- 不实现公司管理员账号、范围授权或操作权限。
- 不实现代理管理、代理分润或代理余额。
- 不实现完整配置中心。
- 不实现平台 MAPI token 授权、自动刷新或同步任务调度。
- 不实现公司余额提现、退款或财务审批流。
- 不引入新的账务流水表；本阶段用审计日志记录调整原因和快照。
- 不删除 `DemoStore`，只避免继续把真实管理能力放进 demo 层。

## 核心规则

公司余额和游戏预算都继续使用整数“厘”保存。前端输入金额使用元字符串，后端转换为厘并拒绝非正数。

公司余额调整只允许正向充值或人工增加余额。本阶段不提供负向扣减入口，避免和后续财务审批、退款、冲正流程混在一起。

游戏预算分配必须在数据库事务内完成：

- 校验游戏存在并读取所属公司。
- 校验分配金额大于 `0`。
- 使用条件更新扣减 `Company.balanceLi`，要求余额大于等于分配金额。
- 增加 `Game.budgetLi`。
- 写入 `AuditLog`。
- 任一步失败时整体回滚。

游戏只能绑定一个公司。创建游戏时 `gameAppId` 必须唯一，后续可更新名称和 `gameSecret`，不允许通过更新接口迁移公司或修改 `gameAppId`。迁移和更换 AppID 涉及历史 ECPM、open_id 和结算归属，不放入本阶段。

`DemoStore.ensureDemoData()` 可以继续保证本地测试公司和测试游戏存在，但正式列表接口必须从真实 Prisma 表读取所有未删除公司和游戏。

## 后端 API

新增管理员资源模块：`apps/api/src/features/admin-resources/`。

所有接口使用现有 `AdminJwtGuard`，本阶段只允许 `SUPER_ADMIN` token 访问。

### 公司列表

`GET /api/admin/companies`

返回未删除公司，按创建时间升序：

- `id`
- `name`
- `balance`
- `createdAt`
- `updatedAt`

### 创建公司

`POST /api/admin/companies`

请求体：

- `name`：必填，去除首尾空白后长度至少 1。

行为：

- 创建公司，初始 `balanceLi=0`。
- 写入 `company.created` 审计日志。
- 返回公司信息。

### 公司余额调整

`POST /api/admin/companies/:companyId/balance-adjustments`

请求体：

- `amountYuan`：必填，元字符串，必须大于 `0`。
- `reason`：可选，去除首尾空白后保存；为空时使用 `manual_adjustment`。

行为：

- 增加 `Company.balanceLi`。
- 写入 `company.balance_adjusted` 审计日志，记录调整金额、调整前余额、调整后余额和原因。
- 返回调整后的公司信息。

### 游戏列表

`GET /api/admin/games`

查询参数：

- `companyId`：可选，按公司筛选。

返回未删除游戏，按创建时间升序：

- `id`
- `companyId`
- `companyName`
- `name`
- `gameAppId`
- `gameSecret`
- `budget`
- `settlementPaused`
- `createdAt`
- `updatedAt`

### 创建游戏

`POST /api/admin/games`

请求体：

- `companyId`：必填。
- `name`：必填。
- `gameAppId`：必填。
- `gameSecret`：必填。

行为：

- 校验公司存在且未删除。
- 创建游戏，初始 `budgetLi=0`、`settlementPaused=false`。
- 如果 `gameAppId` 已存在，返回 `409`。
- 写入 `game.created` 审计日志。
- 返回游戏信息。

### 更新游戏

`PATCH /api/admin/games/:gameId`

请求体至少包含一个字段：

- `name`：可选。
- `gameSecret`：可选。
- `settlementPaused`：可选布尔值。

行为：

- 更新游戏基础信息。
- 不允许修改 `companyId` 或 `gameAppId`。
- 写入 `game.updated` 审计日志，记录修改字段。
- 返回游戏信息。

### 游戏预算分配

`POST /api/admin/games/:gameId/budget-allocations`

请求体：

- `amountYuan`：必填，元字符串，必须大于 `0`。
- `reason`：可选，默认为 `manual_allocation`。

行为：

- 从游戏所属公司余额扣减金额。
- 增加游戏预算。
- 如果公司余额不足，返回 `409`，不修改公司和游戏。
- 分配成功后如果游戏因预算不足暂停，则将 `settlementPaused=false`，让管理员可以继续结算。
- 写入 `game.budget_allocated` 审计日志，记录公司余额前后、游戏预算前后、金额和原因。
- 返回更新后的公司和游戏。

## 前端交互

在现有管理员运营工作台新增“预算管理”面板，先不拆成独立一级页面。

面板展示：

- 公司列表：公司名称、余额。
- 游戏列表：游戏名称、所属公司、`gameAppId`、预算、结算暂停状态。
- 创建公司表单：公司名称。
- 公司充值表单：公司选择、金额、原因。
- 创建游戏表单：公司选择、游戏名称、`gameAppId`、`gameSecret`。
- 游戏预算分配表单：游戏选择、金额、原因。

提交成功后刷新公司和游戏列表，并显示成功提示。余额不足、重复 `gameAppId`、无效金额等错误直接展示后端错误信息。

结算面板继续使用现有接口。预算分配成功后，管理员可以回到结算确认面板预览和确认结算。

## 审计日志

本阶段新增以下审计 action：

- `company.created`
- `company.balance_adjusted`
- `game.created`
- `game.updated`
- `game.budget_allocated`

审计字段：

- `actorType`: `SUPER_ADMIN`
- `actorId`: 管理员用户名
- `targetType`: `company` 或 `game`
- `targetId`: 对应实体 ID
- `metadata`: 金额、余额/预算前后、原因、公司和游戏标识、变更字段

## 错误处理

- 公司不存在：`404`。
- 游戏不存在：`404`。
- 公司已删除或游戏已删除：按不存在处理。
- 金额小于等于 0 或格式非法：`400`。
- 创建游戏时 `gameAppId` 重复：`409`。
- 游戏预算分配时公司余额不足：`409`。
- 管理员登录失效：`401`，前端清理管理员 token。

## 测试策略

服务层测试：

- 创建公司并写审计日志。
- 正向调整公司余额并记录调整前后金额。
- 创建游戏时校验公司存在。
- 创建游戏时处理重复 `gameAppId`。
- 更新游戏时只允许修改名称、密钥和暂停状态。
- 分配预算时扣公司余额、加游戏预算、恢复 `settlementPaused=false` 并写审计日志。
- 公司余额不足时拒绝分配且不修改公司和游戏。

Controller 测试：

- 列表接口返回金额展示结构。
- 创建公司参数校验。
- 公司余额调整参数校验。
- 创建游戏参数校验。
- 游戏预算分配参数校验。
- 所有接口保持 `AdminJwtGuard` 保护。

前端测试：

- 管理员运营工作台渲染预算管理面板。
- 公司和游戏列表能显示余额和预算。
- 提交公司充值调用正确 API 并刷新列表。
- 提交游戏预算分配调用正确 API 并刷新列表。
- 余额不足错误按现有错误提示展示。

最终验证：

- `pnpm --filter api test`
- `pnpm --filter api build`
- `pnpm --filter web test`
- `pnpm --filter web lint`
- `pnpm --filter web build`

## 实施顺序

1. 新增后端管理员资源服务和服务层测试。
2. 新增后端 controller、DTO 校验和 controller 测试。
3. 扩展前端 API 类型和 client。
4. 在管理员运营工作台新增预算管理面板。
5. 跑全量 API/Web 测试和构建。

## 后续扩展

本阶段完成后，可以继续扩展：

- 独立公司/游戏/预算页面。
- 公司管理员权限和数据范围。
- 完整配置中心。
- 平台 token 授权和同步任务。
- 公司余额冲正、审批和独立财务流水。
