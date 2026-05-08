# AI-KS 管理员结算与预算闭环设计

日期：2026-05-08

状态：已按当前讨论确认，等待最终审阅后进入实现计划。

## 目标

本阶段实现“管理员确认结算 + 游戏预算扣减 + 结算快照留痕”的后端与前端闭环。

当前系统已经能同步或生成 `RawEcpm`，用户也能绑定 `open_id`、维护支付宝和发起提现，但用户余额入账仍是简化版：用户自己点击确认结算，系统直接把待结算收益转为可提现余额。这个流程不符合已确认的产品规则。

本阶段把结算确认权收回到管理员侧：收益同步后保持待结算，超级管理员按游戏、日期范围和可选用户预览并确认结算。确认成功后，系统在同一个事务内扣减游戏预算、生成结算批次、把收益入账到用户余额、标记 ECPM 已结算，并写审计日志。

## 非目标

本阶段不做以下事项：

- 不实现公司管理员结算授权。
- 不实现完整配置中心。
- 不实现代理分润、手续费拆分或代理余额。
- 不做支付宝打款流程改造。
- 不做复杂补结算任务队列。
- 不做预算充值和游戏预算分配页面。

这些能力依赖本阶段的结算批次和预算扣减基础，后续单独设计。

## 核心规则

`RawEcpm` 继续作为收益来源记录。每条记录保存快手原始金额 `rawCostLi` 和用户侧展示金额 `displayAmountLi`。本阶段的结算金额直接使用 `displayAmountLi`，配置快照写明来源为 `raw_ecpm.displayAmountLi`。

只有已绑定用户的 `RawEcpm` 可以结算。未绑定 `open_id` 的收益仍保持 `PENDING`，预览接口返回 `unboundCount`，让管理员知道存在未绑定收益。

结算以游戏预算为硬约束。确认结算前，系统汇总目标范围内所有可结算记录的 `displayAmountLi`。如果游戏 `budgetLi` 足够，则全量结算；如果预算不足，则不做部分结算，保持收益记录和用户余额不变，把游戏标记为 `settlementPaused=true`，并返回预算不足错误。

同一条 `RawEcpm` 只能进入一个成功结算批次。结算确认必须在事务内重新查询和锁定待结算数据，不信任前端预览结果。

## 数据模型

新增 `SettlementBatch`，记录一次管理员结算操作：

- `id`
- `gameId`
- `companyId`
- `operatorType`
- `operatorId`
- `status`
- `startedAt`
- `endedAt`
- `settledAmountLi`
- `settledCount`
- `userCount`
- `budgetBeforeLi`
- `budgetAfterLi`
- `configSnapshot`
- `createdAt`

新增 `SettlementBatchItem`，记录批次明细：

- `id`
- `batchId`
- `rawEcpmId`
- `userId`
- `gameOpenIdId`
- `openId`
- `displayAmountLi`
- `settlementAmountLi`
- `createdAt`

继续使用现有字段：

- `RawEcpm.status`
  - `PENDING -> SETTLED`
  - 预算不足时保持 `PENDING`
- `Game.budgetLi`
  - 结算成功时扣减
- `Game.settlementPaused`
  - 预算不足时设为 `true`
  - 预算补足并成功结算后设为 `false`
- `UserAccount.availableBalanceLi`
  - 结算成功时增加
- `AuditLog`
  - 记录结算成功、预算不足暂停、结算数据变化等动作

建议给 `SettlementBatchItem.rawEcpmId` 加唯一约束，防止同一条收益重复进入多个批次。

## 后端 API

新增模块路径：`apps/api/src/features/settlement-admin/`。

### 预览结算

`GET /api/admin/settlements/preview`

参数：

- `gameId`：必填。
- `startDate`：必填，日期字符串。
- `endDate`：必填，日期字符串。
- `userId`：可选。

行为：

- 校验日期范围。
- 查询指定游戏和日期范围内的 `PENDING` 收益。
- 只统计已绑定用户的收益。
- 返回待结算金额、记录数、用户数、未绑定记录数、当前游戏预算、结算后预算余额、是否预算不足。
- 不修改任何数据。

### 确认结算

`POST /api/admin/settlements/confirm`

参数同预览接口。

行为：

- 后端重新查询目标范围内的待结算收益。
- 如果没有可结算收益，返回 400。
- 如果预算不足，事务内把游戏标记为暂停，写审计日志，返回 409。
- 如果预算足够，在事务内：
  - 创建 `SettlementBatch`。
  - 创建 `SettlementBatchItem`。
  - 扣减 `Game.budgetLi`。
  - 把相关 `RawEcpm.status` 更新为 `SETTLED`。
  - 按用户汇总增加 `UserAccount.availableBalanceLi`。
  - 将 `Game.settlementPaused` 设为 `false`。
  - 写审计日志。

并发保护：

- 事务内更新 `RawEcpm` 时必须限定 `status=PENDING`。
- 如果实际更新数量与批次明细数量不一致，回滚并返回 409，提示“结算数据已变化，请重新预览”。

### 结算批次列表

`GET /api/admin/settlements`

返回最近结算批次，支持按 `gameId`、状态和日期范围筛选。前端先展示最近数据即可。

### 结算批次详情

`GET /api/admin/settlements/:batchId`

返回批次基础信息和明细，用于审计和问题排查。

## 前端交互

在现有管理员运营工作台新增“结算确认”面板，不单独新建一级页面。

面板内容：

- 游戏选择。
- 日期范围输入，默认当天。
- 可选用户 ID 输入。
- “预览结算”按钮。
- 预览结果：待结算金额、记录数、用户数、未绑定记录数、当前预算、结算后预算。
- 预算不足时显示告警，禁用“确认结算”。
- 预算足够且有可结算记录时允许“确认结算”。
- 最近结算批次列表。

用户工作台调整：

- 移除或隐藏当前“确认结算”按钮。
- 用户只能查询收益、绑定 ID、维护支付宝、提交提现。
- 用户余额入账只来自管理员结算成功后的结果。

## 权限边界

本阶段只允许超级管理员结算，复用现有 `AdminJwtGuard`。

公司管理员授权结算不在本阶段实现。服务层和数据模型保留 `operatorType`、`operatorId`、`companyId`、`gameId` 等字段，后续接入 `CompanyAdminScope` 时可以增加数据范围和操作权限判断。

前端展示入口不是安全边界。所有结算接口以后端 JWT 和后续权限校验为准。

## 错误处理

- 游戏不存在：404。
- 日期范围无效：400。
- 没有可结算收益：预览返回 `settledCount=0`；确认返回 400。
- 预算不足：确认返回 409，不部分结算，游戏进入暂停状态。
- 并发确认或数据变化：确认返回 409，提示重新预览。
- 未绑定收益：不作为错误，预览返回 `unboundCount`。
- 管理员登录失效：401，前端清理管理员 token。
- 后续公司管理员无权限：403，本阶段暂不开放。

## 审计日志

结算成功写入 `AuditLog`：

- `actorType`: `SUPER_ADMIN`
- `actorId`: 管理员用户名
- `action`: `settlement.confirmed`
- `targetType`: `SettlementBatch`
- `targetId`: 批次 ID
- `metadata`: 游戏、公司、金额、数量、预算前后、日期范围、用户数

预算不足写入 `AuditLog`：

- `action`: `settlement.budget_insufficient`
- `targetType`: `Game`
- `targetId`: 游戏 ID
- `metadata`: 需要金额、当前预算、日期范围、待结算数量

并发数据变化可以写入 `settlement.conflict`，用于排查重复操作。

## 测试策略

服务层单元测试：

- 预算足够时创建批次、扣预算、用户入账、ECPM 变 `SETTLED`。
- 预算不足时不改 ECPM 和用户余额，游戏标记暂停。
- 未绑定 `open_id` 不结算。
- 并发状态变化时拒绝。
- 无待结算记录时拒绝确认。
- 预算补足后再次确认成功，并恢复 `settlementPaused=false`。

Controller 测试：

- preview 参数校验。
- confirm 成功结构。
- confirm 预算不足错误。
- admin guard 仍保护接口。

Prisma 验证：

- 更新 schema 后运行 `pnpm --filter api prisma:validate`。
- 生成 Prisma Client 后运行 `pnpm --filter api prisma:generate`。

前端测试：

- 管理员工作台渲染结算确认面板。
- 预算不足时确认按钮禁用。
- 预览成功后显示预算前后和待结算数量。
- 用户工作台不再渲染“确认结算”按钮。

最终验证：

- `pnpm --filter api test`
- `pnpm --filter api prisma:validate`
- `pnpm --filter web test`
- `pnpm --filter web build`

## 实施顺序

1. 扩展 Prisma schema，新增结算批次和明细。
2. 实现纯服务层预览和确认逻辑。
3. 接入管理员 controller 和 DTO 校验。
4. 调整用户确认结算入口。
5. 扩展管理员运营前端。
6. 增加测试和浏览器 QA。

## 后续扩展

本阶段完成后，可以在同一模型上继续扩展：

- 公司管理员结算授权。
- 公司余额充值和游戏预算分配。
- 代理分润和手续费明细。
- 配置中心接入结算比例和快照。
- 预算不足后的补结算流程。
