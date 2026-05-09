# AI-KS 项目结构和业务链路地图

更新日期：2026-05-10

本文档用于快速理解当前代码组织、主要模块和业务闭环。功能完成度以 `docs/PROJECT_STATUS.zh-CN.md` 为准。

## 1. 仓库结构

```text
.
├── apps
│   ├── api                 # NestJS API 服务
│   └── web                 # React + Vite 前端
├── docs
│   ├── PROJECT_STATUS.zh-CN.md
│   ├── PROJECT_MAP.zh-CN.md
│   ├── runbook             # 当前运行和真实联调手册
│   └── archive             # 历史规格和阶段计划
├── old                     # 旧项目源码，仅作历史参考
├── scripts                 # 仓库级脚本
└── package.json            # pnpm workspace 入口
```

## 2. 后端地图

后端入口：

- `apps/api/src/main.ts`
- `apps/api/src/app.module.ts`
- `apps/api/prisma/schema.prisma`

共享基础设施：

- `common/env`：端口、环境变量、workspace `.env` 读取。
- `common/errors`：API 异常过滤。
- `common/prisma`：PrismaService、schema 启动检查。
- `domain/authz`：公司管理员范围权限。
- `domain/config`：平台配置解析。
- `domain/money`：金额展示和计算策略。
- `domain/settlement`：结算分账计算。
- `domain/identity`：可读 ID 生成。

主要业务模块：

- `features/admin-auth`：超级管理员和公司管理员登录、JWT、守卫。
- `features/company-admin`：公司管理员账号和 scope 管理。
- `features/admin-resources`：公司、游戏、预算、代理、清空测试数据。
- `features/platform-config`：展示金额比例、分账比例、最低提现金额。
- `features/agent`：代理登录、代理工作台、代理收益、代理提现、名下用户。
- `features/account`：用户注册登录、open_id 绑定、代理归属、支付宝、提现。
- `features/game`：游戏端 `js_code` 换取 open_id。
- `features/kuaishou-admin`：快手授权、token、ECPM 同步、任务历史和重试。
- `features/settlement-admin`：结算预览、确认、批次和明细。
- `features/withdrawal-admin`：提现批次、审核、模拟打款、失败关闭。
- `features/audit`：审计日志。
- `features/business-closure`：真实数据测试前闭环核对。
- `features/demo`：demo 上下文和测试数据辅助。
- `features/user`：游客收益查询。

## 3. 前端地图

前端入口：

- `apps/web/src/main.tsx`
- `apps/web/src/App.tsx`
- `apps/web/src/styles.css`

页面：

- `LoginPage.tsx`：用户、管理员、代理登录入口。
- `GuestQueryPage.tsx`：游客收益查询。
- `AccountWorkspace.tsx`：用户收益、open_id、代理归属、支付宝、提现。
- `AgentWorkspace.tsx`：代理资料、收益、名下用户、提现。
- `OperationsWorkspace.tsx`：超级管理员和公司管理员运营台。

前端支撑：

- `lib/api.ts`：基础请求封装和错误处理。
- `lib/aiKsApi.ts`：业务 API 客户端。
- `lib/auth.ts`：本地 token 存取。
- `lib/operationsOverview.ts`：运营总览聚合口径。
- `types/api.ts`：前端 API 类型。
- `components/ui`：Button、Dialog、Panel、StatusBadge 等基础组件。
- `components/domain`：ECPM、审计、提现等领域表格。

## 4. 超级管理员业务闭环

最小闭环顺序：

1. 登录超级管理员。
2. 清空测试数据，保留超级管理员。
3. 配置展示金额比例、用户/代理/默认代理/手续费比例和最低提现金额。
4. 创建代理，必要时设置默认代理。
5. 创建公司，充值公司余额。
6. 创建游戏，配置 `game_app_id` 和 `game_secret`。
7. 给游戏分配预算。
8. 用户注册或换绑代理邀请码。
9. 游戏端登录写入 open_id 并绑定用户。
10. 快手授权并同步 ECPM。
11. 刷新“真实数据闭环核对”，处理阻塞项。
12. 预览结算，确认入账。
13. 用户和代理发起提现。
14. 管理员审核提现，模拟打款成功或失败关闭。

## 5. 当前角色边界

超级管理员：

- 可以管理公司、游戏、预算、代理、平台配置、快手授权、结算、提现、审计、清空数据。
- 可以查看“真实数据闭环核对”。

公司管理员：

- 当前是只读 MVP，按授权范围查看公司和游戏相关数据。
- 细粒度写权限属于后续增强。

代理：

- 可以登录代理端，查看邀请码、余额、收益、名下用户。
- 可以维护支付宝资料并提交本人提现。

用户：

- 可以注册、登录、绑定 open_id、查询收益、维护支付宝、提交提现。
- 可以注册时填写代理邀请码，也可以登录后换绑代理。

游客：

- 可以通过 open_id 或可读 ID 查询收益。

## 6. 关键验证命令

```bash
pnpm --filter api test
pnpm --filter api build
pnpm --filter api prisma:validate
pnpm --filter web test
pnpm --filter web lint
pnpm --filter web build
```

## 7. 文档入口

- 当前状态：`docs/PROJECT_STATUS.zh-CN.md`
- 项目地图：`docs/PROJECT_MAP.zh-CN.md`
- 运行环境：`docs/runbook/env-runtime.md`
- 真实联调：`docs/runbook/real-flow-debugging.zh-CN.md`
- 历史归档：`docs/archive/README.md`
