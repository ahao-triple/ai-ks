# AI-KS 快手平台授权与同步状态设计

日期：2026-05-08

状态：已按当前讨论确认，进入实施计划。

## 目标

本阶段实现快手平台 Marketing API token 的后台维护 MVP，让 ECPM 刷新不再主要依赖 `.env` 中手工填入的 `KUAISHOU_ACCESS_TOKEN`。

当前系统已经可以手动刷新 ECPM，但真实模式下 `KuaishouEcpmClient` 只读取 `.env` 的 `KUAISHOU_ACCESS_TOKEN` 和 `KUAISHOU_ADVERTISER_ID`。这不符合已确认的产品规则：平台 MAPI token 是全局配置，由超级管理员授权、刷新和排查异常。

本阶段补齐：

- 超级管理员查看快手平台授权状态。
- 超级管理员填写 `appId`、`secret` 和 `authCode` 换取 token。
- 超级管理员手动刷新 token。
- ECPM client 在真实模式下优先使用数据库保存的有效 token。
- 手动 ECPM 刷新成功或失败都写审计日志。
- token 授权或刷新失败时保存错误状态，前端可见。
- 前端运营工作台新增“平台授权”面板。

## 外部接口事实

快手小游戏 DSP IAA 文档说明：

- 通过 `auth_code` 获取 token：`POST https://ad.e.kuaishou.com/rest/openapi/oauth2/authorize/access_token`，JSON 请求。
- 刷新 token：`POST https://ad.e.kuaishou.com/rest/openapi/oauth2/authorize/refresh_token`，JSON 请求。
- `auth_code` 有效期 10 分钟且只能使用一次。
- `access_token` 有效期约 1 天；`refresh_token` 有效期约 30 天。
- 每次刷新会返回新的 `access_token` 和 `refresh_token`。

本阶段实现以这些接口事实为准，并保留 `.env` access token 作为数据库 token 缺失时的本地兜底。

## 非目标

本阶段不做以下事项：

- 不做自动定时同步任务。
- 不做全量同步队列、任务重试队列或任务历史表。
- 不支持多个平台 token。
- 不做 OAuth 授权跳转页生成。
- 不加密数据库中的 token 字段；后续生产化再接密钥管理。
- 不实现配置中心。
- 不改 ECPM 报表保存规则和金额展示规则。

## 数据模型

新增枚举 `KuaishouTokenStatus`：

- `UNCONFIGURED`：没有可用 token。
- `ACTIVE`：有 token 且未过期。
- `EXPIRED`：access token 已过期，或 refresh token 已过期。
- `ERROR`：最近一次授权、刷新或 ECPM 调用失败。

新增模型 `KuaishouPlatformToken`，作为全局单例记录：

- `id`
- `key`：唯一，固定为 `default`。
- `appId`
- `secret`
- `advertiserId`
- `accessToken`
- `refreshToken`
- `accessTokenExpiresAt`
- `refreshTokenExpiresAt`
- `status`
- `lastError`
- `authorizedAt`
- `refreshedAt`
- `createdAt`
- `updatedAt`

本阶段只使用 `key='default'` 的一行记录。

## 后端 API

继续使用 `apps/api/src/features/kuaishou-admin/`，所有接口用现有 `AdminJwtGuard` 保护。

### 查看授权状态

`GET /api/admin/kuaishou/token`

返回：

- `configured`
- `status`
- `appId`
- `advertiserId`
- `accessTokenExpiresAt`
- `refreshTokenExpiresAt`
- `authorizedAt`
- `refreshedAt`
- `lastError`

不返回 `secret`、`accessToken` 或 `refreshToken`。

如果没有数据库 token，但 `.env` 中存在 `KUAISHOU_ACCESS_TOKEN` 和 `KUAISHOU_ADVERTISER_ID`，返回 `configured=true`、`status=ACTIVE`、`source=env`，并提示这是本地兜底配置。

### auth_code 授权

`POST /api/admin/kuaishou/token/authorize`

请求体：

- `appId`：必填。
- `secret`：必填。
- `authCode`：必填。

行为：

- 调快手 access token 接口。
- 保存 `accessToken`、`refreshToken`、`advertiserId` 和过期时间。
- `status=ACTIVE`，清空 `lastError`。
- 写审计日志 `kuaishou.token_authorized`。
- 返回授权状态。

如果快手接口返回失败：

- 保存或更新 `status=ERROR` 和 `lastError`。
- 写审计日志 `kuaishou.token_authorize_failed`。
- 返回 `502`，提示快手授权失败。

### 手动刷新 token

`POST /api/admin/kuaishou/token/refresh`

行为：

- 读取数据库中的 `refreshToken`、`appId`、`secret`。
- 如果缺少 refresh token，返回 `400`。
- 调快手 refresh token 接口。
- 保存新的 access token、refresh token 和过期时间。
- `status=ACTIVE`，清空 `lastError`。
- 写审计日志 `kuaishou.token_refreshed`。
- 返回授权状态。

如果快手接口返回失败：

- 更新 `status=ERROR` 和 `lastError`。
- 写审计日志 `kuaishou.token_refresh_failed`。
- 返回 `502`。

### 手动 ECPM 刷新审计

现有 `POST /api/admin/kuaishou/ecpm/refresh` 增强：

- 成功写 `kuaishou.ecpm_refreshed`，记录游戏、请求 open_id 数量、写入数量和来源。
- 失败写 `kuaishou.ecpm_refresh_failed`，记录游戏、错误信息和请求参数摘要。
- 如果失败时当前使用数据库 token，则把 token 状态标记为 `ERROR`。

## ECPM Client

真实模式下的 token 解析顺序：

1. 查询 `KuaishouPlatformToken(key='default')`。
2. 如果记录存在、`status=ACTIVE`、`accessToken` 和 `advertiserId` 存在，且 `accessTokenExpiresAt` 没有过期，则使用数据库 token。
3. 如果数据库 token 不可用，再尝试 `.env` 中的 `KUAISHOU_ACCESS_TOKEN` 和 `KUAISHOU_ADVERTISER_ID`。
4. 如果都不可用，抛出错误并让 controller 写失败审计。

mock 模式保持现状，不需要 token。

## 前端交互

在管理员运营工作台新增“平台授权”面板，靠近“快手 ECPM”面板。

面板展示：

- 当前状态。
- token 来源：数据库或 `.env`。
- `appId`。
- `advertiserId`。
- access token 过期时间。
- refresh token 过期时间。
- 最近错误。

表单：

- `appId`
- `secret`
- `authCode`
- “提交授权”按钮。
- “刷新 token”按钮。

提交授权成功后清空 `authCode`，刷新 token 成功后更新状态。所有错误走现有错误提示。

## 审计日志

新增 action：

- `kuaishou.token_authorized`
- `kuaishou.token_authorize_failed`
- `kuaishou.token_refreshed`
- `kuaishou.token_refresh_failed`
- `kuaishou.ecpm_refreshed`
- `kuaishou.ecpm_refresh_failed`

审计字段：

- `actorType`: `SUPER_ADMIN`
- `actorId`: 管理员用户名
- `targetType`: `kuaishou_platform_token` 或 `kuaishou_ecpm_refresh`
- `targetId`: `default` 或游戏 ID/AppID
- `metadata`: 状态、过期时间、广告主 ID、请求数量、写入数量、错误摘要

## 错误处理

- 参数缺失：`400`。
- 无 refresh token：`400`。
- 快手接口失败：`502`。
- token 过期或不可用：ECPM 刷新返回错误，并写失败审计。
- 管理员登录失效：`401`，前端清理管理员 token。

## 测试策略

Prisma 验证：

- 更新 schema 后运行 `pnpm --filter api prisma:generate` 和 `pnpm --filter api prisma:validate`。

服务层测试：

- auth_code 授权成功时保存 token 和过期时间。
- 授权失败时保存 `ERROR` 和 `lastError`。
- refresh token 成功时替换旧 token。
- refresh token 缺失时拒绝。
- token 状态接口不泄露 secret/accessToken/refreshToken。
- ECPM client 优先使用数据库 token。
- 数据库 token 过期时回退 `.env`。

Controller 测试：

- token status 返回展示结构。
- authorize 参数校验。
- refresh 调用当前管理员并写审计。
- ECPM refresh 成功和失败写审计。

前端测试：

- API client 方法路径、token 和 body。
- 运营工作台渲染平台授权面板。
- 授权表单和刷新按钮调用正确回调。
- App 进入管理员后加载 token 状态。

最终验证：

- `pnpm --filter api prisma:generate`
- `pnpm --filter api prisma:validate`
- `pnpm --filter api test`
- `pnpm --filter api build`
- `pnpm --filter web test`
- `pnpm --filter web lint`
- `pnpm --filter web build`

## 实施顺序

1. 扩展 Prisma schema，生成 Prisma client。
2. 新增快手 OAuth client 和 token service。
3. 新增 token admin controller，并增强 ECPM refresh controller 审计。
4. 修改 ECPM client 优先读取数据库 token。
5. 扩展前端 API 类型和 client。
6. 新增平台授权面板并接入 App state/actions。
7. 跑全量验证。

## 后续扩展

本阶段完成后，可以继续做：

- 自动定时刷新 token。
- 定时 ECPM 同步任务。
- 同步任务历史和重试。
- token 加密存储。
- 授权 URL 生成和回调页面。
