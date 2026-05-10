# AI-KS 项目入口

AI-KS 是一个用于快手小游戏收益联调、结算和提现验证的全栈项目。当前代码层面已经具备真实数据测试前的业务闭环：超级管理员可以创建公司、游戏、预算、代理和配置；用户可以绑定代理和 open_id；ECPM 可以写入并进入结算；结算会扣预算并给用户、代理入账；提现可走审核流程。

## 当前状态

优先阅读：

- [项目状态与功能清单](docs/PROJECT_STATUS.zh-CN.md)
- [项目结构和业务链路地图](docs/PROJECT_MAP.zh-CN.md)
- [游戏端 API 对接文档](docs/api/game-client-api.zh-CN.md)
- [真实流程联调 Runbook](docs/runbook/real-flow-debugging.zh-CN.md)
- [运行环境说明](docs/runbook/env-runtime.md)

历史设计和阶段计划已经归档到 [docs/archive](docs/archive/README.md)，不再代表当前实现状态。

## 快速启动

首次运行先准备环境文件：

```bash
cp .env.example .env
```

常用命令：

```bash
pnpm install
pnpm dev
```

也可以分别启动：

```bash
pnpm dev:api
pnpm dev:web
```

当前本地常用地址以 `.env` 为准。本轮调试使用：

- 前端：`http://127.0.0.1:8012/`
- API：`http://127.0.0.1:8007/api`

默认超级管理员账号来自 `.env`：

- 用户名：`admin`
- 密码：`admin123456`

## 验证命令

```bash
pnpm --filter api test
pnpm --filter api build
pnpm --filter api prisma:validate
pnpm --filter web test
pnpm --filter web lint
pnpm --filter web build
```

最近一次验证结果记录在 [docs/PROJECT_STATUS.zh-CN.md](docs/PROJECT_STATUS.zh-CN.md)。

## 真实数据测试前的最小顺序

1. 超级管理员登录。
2. 在“配置”页确认展示金额比例、分账比例、最低提现金额。
3. 在“代理”页创建代理；需要默认代理时，把代理 ID 写入“配置”页。
4. 在“预算”页创建公司、充值公司余额、创建游戏、分配游戏预算。
5. 用户注册或登录后绑定代理邀请码。
6. 在“联调”页用真实 `js_code` 换取 open_id。
7. 在“授权”页完成快手授权。
8. 在“联调”页或游戏配置中刷新 ECPM。
9. 在“总览”页刷新“真实数据闭环核对”，处理所有阻塞项。
10. 需要验证业务闭环时，再进入“结算”和“提现”页跑完整流程。

详细步骤见 [真实流程联调 Runbook](docs/runbook/real-flow-debugging.zh-CN.md)。

## 远程测试部署

远程服务器首次部署建议按这个顺序执行：

```bash
pnpm install --frozen-lockfile
cp .env.example .env
pnpm --filter api prisma:generate
pnpm --filter api prisma:push
pnpm --filter api build
pnpm --filter web build
```

然后在 `.env` 中确认：

- `DATABASE_URL` 指向远程测试数据库。
- `JWT_SECRET`、`ADMIN_JWT_SECRET`、`AGENT_JWT_SECRET` 已替换为随机长密钥。
- `VITE_API_BASE_URL` 远程访问时不要写成浏览器本机的 `localhost`；使用 `/api` 并由 Vite dev proxy 或反向代理转发，或写成远程 API 的公网地址。
- 真实快手联调时设置 `KUAISHOU_API_MODE=real`，并保持 `KUAISHOU_TOKEN_ENCRYPTION_KEY` 稳定。

测试环境临时运行可以启动 API，再让 Vite 对外监听：

```bash
pnpm --filter api start
pnpm --filter web dev -- --host 0.0.0.0
```

生产式静态部署时，先执行 `pnpm --filter web build`，再把 `apps/web/dist` 交给 Nginx 等静态服务，并把 `/api` 反向代理到 API 服务。

### PM2 一步启动

仓库已提供 `ecosystem.config.cjs`。构建完成后，在服务器执行：

```bash
pnpm pm2:start
pm2 save
```

它会启动两个进程：

- `ai-ks-api`：运行 `apps/api/dist/main.js`。
- `ai-ks-web`：托管 `apps/web/dist`，并把 `/api` 代理到 `API_PROXY_ORIGIN`；未配置时默认跟随 `API_PORT`，即 `http://127.0.0.1:<API_PORT>`。

更新代码后重新构建并重启：

```bash
pnpm install --frozen-lockfile
pnpm prisma:generate
pnpm build
pnpm pm2:restart
```

如果服务器没装 PM2，先执行：

```bash
npm install -g pm2
```

## 目录说明

- `apps/api`：NestJS API 服务、Prisma schema、后端测试。
- `apps/web`：React + Vite 前端、页面、组件、前端测试。
- `docs`：当前状态、运行手册、真实联调手册、归档文档。
- `scripts`：仓库级辅助脚本。
- `old`：旧项目源码，仅作历史参考，不参与当前运行闭环。

## 当前边界

已完成的是“真实游戏和快手数据测试前的代码闭环”。尚未完成生产级外部闭环：

- 真实快手数据尚未完成现场联调验证。
- 支付宝真实打款未接入，当前仅覆盖平台内提现审核和状态流转。
- 高级策略、财务报表、导出、备份恢复、上线治理仍属于后续工作。
