# AI-KS 公司管理员只读权限与数据范围设计

日期：2026-05-09

状态：已按当前讨论确认，等待最终审阅后进入实现计划。

## 背景

当前系统已经有超级管理员运营台、公司和游戏管理、预算分配、结算批次、提现审核、快手 token、ECPM 同步任务和游戏配置页。数据模型里也已经存在 `CompanyAdminScope` 与基础权限 resolver，但管理员登录仍只支持 `SUPER_ADMIN`，后台接口多数还没有按公司或游戏范围收紧。

本阶段补齐公司管理员只读 MVP，让公司管理员能登录同一运营台，只查看超级管理员分配给他的公司和游戏范围内的数据。写操作仍全部保留给超级管理员，避免在权限体系未完全成熟前开放结算、提现审核或配置变更。

## 目标

- 超级管理员可以创建、更新、启用/禁用公司管理员账号。
- 超级管理员可以给公司管理员分配公司和游戏数据范围。
- 公司管理员可以从现有管理员登录入口登录。
- 公司管理员登录后复用现有运营台，只看到授权范围内的数据。
- 公司管理员本阶段只能只读，不能执行任何写操作。
- 后端成为唯一权限边界；前端隐藏或禁用操作只作为体验优化。
- 公司管理员越权访问返回 `403`，并记录审计日志用于排查。

## 非目标

- 不开放公司管理员结算确认权。
- 不开放公司管理员提现审核、打款或失败处理权。
- 不开放公司管理员管理公司、游戏、预算、快手 token、自动同步配置或平台授权。
- 不做复杂权限勾选 UI；本阶段权限码固定为只读集合。
- 不实现公司管理员创建其他公司管理员。
- 不实现代理可见性、代理收益权限或代理管理。
- 不重构现有超级管理员运营台的信息架构。

## 角色与范围

系统继续使用两个后台角色：

- `SUPER_ADMIN`：最高权限，可访问所有公司、游戏和操作。
- `COMPANY_ADMIN`：公司管理员，只能访问被授权游戏对应的数据，本阶段没有写权限。

数据范围第一版按游戏落地。公司管理员只能看到被分配游戏对应的数据；公司只是分组展示和筛选上下文。如果某公司下没有任何授权游戏，该公司不出现在公司管理员的列表里。

`CompanyAdminScope` 保留公司维度，方便展示和后续扩展：

- `companyId` 表示 scope 所属公司。
- `gameIds` 表示该公司下可访问的游戏列表。
- `operationCodes` 表示允许的操作码。本阶段固定写入只读权限码，后续再开放细粒度勾选。

本阶段固定只读权限码：

- `company.read`
- `game.read`
- `settlement.read`
- `withdrawal.read`
- `ecpm.read`
- `audit.read`

所有写接口先统一要求 `SUPER_ADMIN`。即使公司管理员拥有某个只读操作码，也不能通过接口执行写入。

## 后端数据模型

新增 `CompanyAdminAccount` 模型：

- `id`
- `username`
- `passwordHash`
- `displayName`
- `enabled`
- `createdAt`
- `updatedAt`
- `deletedAt`

`username` 必须唯一。禁用或软删除的公司管理员不能登录。

调整 `CompanyAdminScope`：

- 将现有 `principalId` 语义明确为公司管理员账号 ID，建议字段命名为 `companyAdminId`。
- 保留 `companyId`、`gameIds`、`operationCodes`。
- 增加与 `CompanyAdminAccount` 的关系。

如果为了减少迁移风险，也可以在数据库字段层继续使用 `principal_id` 映射，但 Prisma 层应以 `companyAdminId` 暴露，避免继续使用含糊的 `principalId`。

## 登录与 Principal

继续使用现有接口：

`POST /api/admin/auth/login`

登录流程：

1. 先按现有环境变量超级管理员账号校验。
2. 如果不是超级管理员，再查 `CompanyAdminAccount.username`。
3. 校验密码哈希、`enabled=true`、`deletedAt=null`。
4. 登录成功后签发后台 JWT。

返回的 `admin` 结构按角色区分：

超级管理员：

```ts
{
  role: 'SUPER_ADMIN',
  username: string
}
```

公司管理员：

```ts
{
  role: 'COMPANY_ADMIN',
  adminId: string,
  username: string,
  displayName: string
}
```

JWT payload 继续使用 `typ='admin'`，并包含：

- `role`
- `sub`
- `typ`
- `adminId`，仅公司管理员需要

`AdminJwtGuard` 不再只接受 `SUPER_ADMIN`。它验证 token 后把完整 `AdminPrincipal` 注入 request。各业务接口再根据角色和 scope 判断是否允许访问。

## 超管管理接口

新增公司管理员管理接口，全部只允许 `SUPER_ADMIN`：

### 公司管理员列表

`GET /api/admin/company-admins`

返回：

- 账号 ID
- 用户名
- 显示名
- 启用状态
- 授权公司和游戏摘要
- 创建和更新时间

### 创建公司管理员

`POST /api/admin/company-admins`

请求体：

- `username`：必填，去除首尾空白后长度至少 1。
- `displayName`：必填，去除首尾空白后长度至少 1。
- `password`：必填，长度至少 8 个字符。
- `enabled`：可选，默认 `true`。

行为：

- 创建账号并保存密码哈希。
- 用户名重复返回 `409`。
- 写入 `company_admin.created` 审计日志。

### 更新公司管理员

`PATCH /api/admin/company-admins/:adminId`

请求体至少包含一个字段：

- `displayName`
- `enabled`
- `password`

行为：

- 更新显示名、启用状态或重置密码。
- 找不到账号返回 `404`。
- 写入 `company_admin.updated` 审计日志。

### 分配范围

`PUT /api/admin/company-admins/:adminId/scopes`

请求体：

```json
{
  "scopes": [
    {
      "companyId": "company-id",
      "gameIds": ["game-id-1", "game-id-2"]
    }
  ]
}
```

行为：

- 校验公司存在且未删除。
- 校验 `gameIds` 均属于对应公司且未删除。
- 用事务替换该公司管理员现有范围。
- 自动写入固定只读 `operationCodes`。
- 写入 `company_admin.scopes_updated` 审计日志，记录授权摘要。

## 只读接口过滤

已有后台只读接口按角色处理：

- `SUPER_ADMIN`：保持现有行为。
- `COMPANY_ADMIN`：按授权游戏范围过滤结果。

### 公司列表

`GET /api/admin/companies`

公司管理员只返回至少包含一个授权游戏的公司。余额可以展示，但只作为只读信息。

### 游戏列表

`GET /api/admin/games`

公司管理员只返回授权游戏。按 `companyId` 查询时，如果该公司没有授权游戏，返回空列表。

### 结算批次

`GET /api/admin/settlements`

公司管理员只返回授权游戏的结算批次。

`GET /api/admin/settlements/:batchId`

公司管理员只能查看授权游戏的批次详情，否则返回 `403`。

### 提现批次

提现批次本身可能包含多个明细。公司管理员视图只返回与授权游戏相关的只读数据。

第一版规则：

- 列表只返回存在授权游戏相关结算或提现明细的批次。
- 详情只展示授权范围内可判断的明细。
- 如果某批次无法安全判断是否属于授权游戏，宁可不返回，避免泄露其他公司数据。

如果当前提现模型缺少足够的游戏关联字段，本阶段先把公司管理员提现接口限制为返回空列表，并在实现计划中单独列出补字段或关联查询任务。

### ECPM 同步任务

`GET /api/admin/kuaishou/ecpm/jobs`

公司管理员只返回授权游戏 `gameAppId` 对应的同步任务。

手动刷新接口 `POST /api/admin/kuaishou/ecpm/refresh` 对公司管理员返回 `403`。

### 审计日志

`GET /api/admin/audit-logs`

公司管理员只返回能安全归属到授权公司或授权游戏的审计日志。

可安全返回的日志包括：

- `targetType=company` 且公司在授权 scope 内。
- `targetType=game` 且游戏在授权 gameIds 内。
- `metadata` 中明确包含授权 `companyId` 或 `gameId` 的结算、ECPM、预算相关日志。

无法判断归属的日志不返回。

### 快手 token 和配置类接口

公司管理员不可访问快手平台 token、平台授权、游戏配置保存、预算分配、公司充值等配置类接口，统一返回 `403`。

## 写操作权限

本阶段所有写操作只允许超级管理员，包括：

- 创建/更新公司。
- 公司余额调整。
- 创建/更新游戏。
- 游戏预算分配。
- 保存游戏配置。
- 开关自动 ECPM 同步。
- 手动 ECPM 刷新。
- 快手 token 授权、刷新、配置。
- 结算确认。
- 提现审核、打款、关闭、人工处理。
- 公司管理员账号和范围管理。

公司管理员访问这些接口时返回 `403`，错误信息使用统一文案：“无权限访问该操作”。

越权写操作记录审计日志：

- `actorType=COMPANY_ADMIN`
- `actorId=adminId`
- `action=permission.denied`
- `targetType` 和 `targetId` 尽量记录请求资源。
- `metadata` 记录路径、方法、角色和原因，不记录密码、token 或其他敏感字段。

## 前端交互

前端复用现有管理员登录页和运营台。登录成功后根据后端返回的 `admin.role` 调整展示。

公司管理员登录后：

- 顶部显示角色为“公司管理员”。
- 只展示被授权范围内的数据。
- 预算管理、游戏配置、快手 token、手动 ECPM 刷新、自动同步配置保存、结算确认、提现审核和打款等写操作入口隐藏或禁用。
- 结算、提现、ECPM 任务、审计日志以只读列表展示。
- `403` 展示“无权限访问该操作”，不清理登录态。
- `401` 保持现有逻辑，清理登录态并回到登录页。

超级管理员运营台新增“公司管理员”管理区：

- 公司管理员列表：用户名、显示名、启用状态、授权公司/游戏摘要。
- 创建账号表单：用户名、显示名、初始密码。
- 更新账号表单：显示名、启用/禁用、重置密码。
- 分配范围表单：选择公司，再选择该公司下可授权游戏。
- 权限说明：当前仅开放只读权限，结算、提现审核和配置变更仍由超级管理员处理。

前端不把隐藏按钮当作安全边界。所有接口仍以后端角色和 scope 校验为准。

## 错误处理

- 公司管理员账号不存在、禁用或已删除：登录返回 `401`。
- 密码错误：登录返回 `401`。
- 创建公司管理员用户名重复：`409`。
- 分配范围时公司不存在：`404`。
- 分配范围时游戏不存在或不属于该公司：`400`。
- 公司管理员访问未授权只读资源：`403`。
- 公司管理员访问写接口：`403`。
- 管理员登录失效：`401`。

## 审计日志

新增审计 action：

- `company_admin.created`
- `company_admin.updated`
- `company_admin.scopes_updated`
- `permission.denied`

审计原则：

- 超管创建、更新、授权公司管理员必须记录。
- 公司管理员越权访问写接口必须记录。
- 审计 metadata 可记录账号 ID、用户名、授权公司和游戏摘要。
- 审计 metadata 不记录明文密码、JWT、快手 token、支付宝账号全量等敏感信息。

## 测试策略

### 后端测试

- 超级管理员登录保持兼容。
- 公司管理员账号可登录，JWT role 为 `COMPANY_ADMIN`。
- 禁用或删除的公司管理员不能登录。
- 超管可创建公司管理员并写审计日志。
- 超管可更新公司管理员显示名、启用状态和密码。
- 超管可分配公司/游戏范围，且拒绝不属于该公司的游戏。
- 公司管理员访问公司列表时只返回授权公司。
- 公司管理员访问游戏列表时只返回授权游戏。
- 公司管理员访问结算批次列表和详情时只返回授权游戏范围。
- 公司管理员访问 ECPM 任务列表时只返回授权 `gameAppId`。
- 公司管理员访问快手 token、预算分配、游戏配置保存、结算确认、提现审核等写接口返回 `403`。
- 公司管理员越权写访问记录 `permission.denied` 审计日志。

### 前端测试

- 公司管理员登录后进入运营台。
- 顶部显示公司管理员角色。
- 公司管理员看不到超管写操作入口。
- 公司管理员只读列表能渲染授权范围数据。
- `403` 展示无权限提示，不退出登录。
- 超管能看到公司管理员管理区。
- 超管可提交创建账号和授权范围表单。

## 最终验证

- `pnpm --filter api prisma:validate`
- `pnpm --filter api prisma:generate`
- `pnpm --filter api test`
- `pnpm --filter api build`
- `pnpm --filter web test`
- `pnpm --filter web lint`
- `pnpm --filter web build`

## 实施顺序

1. 扩展 Prisma schema，新增公司管理员账号并调整 scope 关系。
2. 实现公司管理员账号密码哈希、登录和 JWT principal。
3. 新增超管公司管理员管理 service/controller。
4. 增加角色与 scope 校验工具，统一写接口超管保护。
5. 按授权范围过滤公司、游戏、结算、ECPM 任务和审计日志。
6. 明确提现只读范围：如果当前模型无法可靠归属游戏，则公司管理员提现列表先返回空列表，并记录后续补强任务。
7. 扩展前端 API 类型和 client。
8. 前端登录态支持 `SUPER_ADMIN` 与 `COMPANY_ADMIN`。
9. 超管运营台增加公司管理员管理区。
10. 公司管理员运营台隐藏或禁用写操作，只展示授权范围只读数据。
11. 补充测试并跑最终验证。

## 后续扩展

- 公司管理员结算确认权限。
- 公司管理员提现审核权限。
- 细粒度权限勾选 UI。
- 公司管理员可见代理身份、代理金额的单独权限。
- 更完整的提现批次到游戏维度归属模型。
- 按公司管理员 scope 返回菜单和操作能力元数据。
