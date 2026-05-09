# AI-KS API 数据库 Schema 启动自检设计

## 背景

本阶段开发中出现过一次明确的运行时故障：代码和 Prisma Client 已经包含新的游戏 ECPM 自动同步字段，但 `.env` 指向的 PostgreSQL 数据库尚未执行 schema 同步。API 可以启动，直到接口访问 `games.ecpm_auto_sync_enabled` 等新列时才返回 500。

这类问题不应该等到用户打开页面后才暴露。API 启动时应尽早检查当前数据库是否满足代码所需的最小 schema，并在不匹配时给出可执行的修复提示。

## 目标

- API 启动时检查数据库 schema 是否包含当前代码必需的表和字段。
- 如果 schema 落后，API 启动失败，不继续提供业务接口。
- 错误信息明确列出缺失项，并提示修复命令。
- 只检查，不自动修改数据库。
- 默认开启检查，允许通过环境变量在测试或特殊场景关闭。
- 覆盖自动 ECPM 同步新增字段，防止同类问题再次以 500 形式暴露。

## 非目标

- 不在 API 启动时自动执行 `prisma db push` 或迁移。
- 不替代正式迁移流程或数据库变更审批。
- 不做完整 Prisma schema diff。
- 不检查字段类型、索引、外键、默认值的全量一致性。
- 不把 health check 变成数据库迁移工具。

## 策略

采用 **启动阻断式只读检查**：

1. API 启动时连接数据库。
2. 查询 PostgreSQL `information_schema.columns`，读取当前 schema 下的表和列。
3. 与代码中维护的必需 schema 清单比较。
4. 如有缺失，抛出明确错误，Nest 启动失败。
5. 如检查通过，继续正常启动。

这个策略符合当前选择：数据库变更仍由管理员或开发者手动执行，API 只负责尽早发现不匹配。

## 组件设计

### `PrismaSchemaGuard`

新增一个小型启动守卫，放在 `apps/api/src/common/prisma/` 下，职责只包含 schema 检查。

实现接口：

```ts
export class PrismaSchemaGuard {
  constructor(private readonly prisma: PrismaSchemaGuardPrisma) {}

  async assertSchemaReady(): Promise<void> {}
}
```

`PrismaSchemaGuardPrisma` 只需要 `$queryRaw` 能力，便于单元测试使用 fake Prisma。

### 必需 schema 清单

在守卫模块内维护一个显式清单，而不是运行时解析 `schema.prisma`。

第一版必须包含这次已造成故障的新增字段：

- `games.ecpm_auto_sync_enabled`
- `games.ecpm_auto_sync_interval_hours`
- `games.ecpm_auto_sync_next_run_at`
- `games.ecpm_auto_sync_last_run_at`
- `kuaishou_ecpm_sync_jobs.lookback_hours`
- `kuaishou_ecpm_sync_jobs.started_data_hour`
- `kuaishou_ecpm_sync_jobs.ended_data_hour`

清单可以逐步扩展。它不是完整迁移系统，而是保护最容易导致启动后 500 的关键列。

### 启动接入

在 `PrismaService.onModuleInit()` 中执行：

1. 根据现有 `shouldConnectPrismaOnBoot()` 判断是否主动 `$connect()`。
2. 根据新增 `shouldCheckPrismaSchemaOnBoot()` 判断是否执行 schema 检查。
3. 默认执行 schema 检查。

启动检查会自然触发数据库连接。如果数据库不可达，API 启动失败。这和“启动前发现不可服务状态”的目标一致。

### 环境开关

新增环境变量：

```env
PRISMA_SCHEMA_CHECK_ON_BOOT=true
```

默认值为开启。只有设置为字符串 `false` 时关闭检查。

用途：

- 单元测试中避免连接真实数据库。
- 特殊维护场景临时跳过启动检查。

现有 `PRISMA_CONNECT_ON_BOOT` 仍保留原语义，不改变。

## 错误信息

schema 不匹配时抛出的错误应包含：

- 固定标题：`Database schema is out of sync with Prisma schema`
- 缺失项列表，例如：
  - `games.ecpm_auto_sync_enabled`
  - `kuaishou_ecpm_sync_jobs.lookback_hours`
- 修复命令：
  - `pnpm --filter api prisma:push`
- 说明：
  - API 不会自动修改数据库。
  - 请确认 `.env` 中的 `DATABASE_URL` 指向正确环境后再执行同步命令。

错误信息不打印数据库密码。第一版只打印缺失项和修复命令，不解析或展示连接串。

## 数据流

启动流程：

1. `NestFactory` 创建应用。
2. `PrismaService.onModuleInit()` 运行。
3. `PrismaSchemaGuard.assertSchemaReady()` 查询当前数据库字段。
4. 检查通过后其他模块继续初始化。
5. 检查失败时抛错，API 启动失败，开发者根据日志同步数据库。

## 测试计划

### 单元测试

新增 `prisma-schema-guard.spec.ts`：

- schema 完整时不抛错。
- 缺 `games.ecpm_auto_sync_enabled` 时抛错，并包含缺失项和修复命令。
- 多个缺失字段时一次性列出全部缺失项。

新增或扩展启动开关测试：

- `shouldCheckPrismaSchemaOnBoot({}) === true`
- `shouldCheckPrismaSchemaOnBoot({ PRISMA_SCHEMA_CHECK_ON_BOOT: 'false' }) === false`
- 其他值保持开启。

### 集成边界

`PrismaService` 单元测试应验证：

- 开关开启时调用 schema guard。
- 开关关闭时不调用 schema guard。
- schema guard 抛错时错误向上传播，启动失败。

不需要在单测中连接真实数据库。

### 手动验证

开发环境执行：

```bash
pnpm --filter api prisma:validate
pnpm --filter api test
pnpm --filter api build
```

如果需要模拟真实缺字段，可在临时数据库中删除一列后启动 API，确认启动失败并输出修复命令。不要在共享数据库上做破坏性模拟。

## 运维说明

更新 `docs/runbook/env-runtime.md`，补充：

- API 和 Web 都依赖根目录 `.env`。
- schema 变更后需要执行 `pnpm --filter api prisma:push`。
- 如果 API 启动时报 schema out of sync，先确认 `.env` 的 `DATABASE_URL`，再执行同步命令。
- `PRISMA_SCHEMA_CHECK_ON_BOOT=false` 只用于测试或临时维护，不建议常规开发关闭。

## 风险与取舍

- 只检查关键字段，不能发现所有 schema 差异。这是刻意取舍：用小成本挡住最常见的运行时 500。
- 默认检查会让数据库不可达时启动失败。当前项目依赖数据库提供核心能力，失败早于失败晚更可控。
- 手动执行 `prisma:push` 仍需谨慎确认 `.env` 指向的数据库，避免对错误环境同步。

## 验收标准

- 缺少必需字段时 API 启动失败，错误信息包含缺失字段和修复命令。
- 数据库 schema 完整时 API 正常启动。
- `PRISMA_SCHEMA_CHECK_ON_BOOT=false` 可跳过 schema 检查。
- 现有 API 测试和构建通过。
