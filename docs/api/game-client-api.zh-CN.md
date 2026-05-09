# 游戏端 API 对接文档

更新日期：2026-05-10

本文档面向快手小游戏或游戏前端/服务端开发，说明游戏端需要调用的 AI-KS API。后台管理、结算审核、快手授权和提现审核接口不在本文档范围内。

## 1. 基础约定

### 1.1 Base URL

API 服务统一前缀为 `/api`。

本地或服务器直连示例：

```text
http://<api-host>:8007/api
```

PM2 Web 静态服务或反向代理部署时，游戏页面同源访问可使用：

```text
/api
```

如果游戏页面运行在用户浏览器、手机或快手环境里，`localhost` 指的是用户设备本机，不是服务器。远程联调时不要把浏览器侧 API 地址写成 `http://localhost:8007/api`，除非浏览器也运行在服务器本机。

### 1.2 请求格式

除健康检查外，默认使用 JSON：

```http
Content-Type: application/json
```

需要登录态的接口使用 Bearer Token：

```http
Authorization: Bearer <accessToken>
```

### 1.3 通用错误格式

接口错误统一返回：

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "参数错误：username、password"
}
```

常见状态码：

| 状态码 | 含义 |
| --- | --- |
| `400` | 参数错误、金额不合法、余额不足、未维护支付宝信息等 |
| `401` | 用户登录态无效或账号密码错误 |
| `404` | 游戏、用户、open_id、代理邀请码不存在 |
| `409` | 用户名等唯一字段重复 |
| `500` | 服务端异常，真实快手接口失败也可能暂时表现为 500 |

### 1.4 金额格式

金额字段统一返回对象：

```json
{
  "li": "12345",
  "yuan": "12.35"
}
```

说明：

- `li` 是字符串形式的最小记账单位，`1000 li = 1 元`，前端计算建议使用它。
- `yuan` 是展示用金额字符串，保留到分。

## 2. 推荐接入流程

1. 游戏端调用快手登录能力拿到一次性 `js_code`。
2. 游戏端调用 `POST /game/sessions`，把 `gameAppId` 和 `jsCode` 发给 AI-KS。
3. AI-KS 使用后台配置的 `gameSecret` 向快手换取 `open_id`，并保存 open_id 记录。
4. 用户注册或登录 AI-KS 账号。
5. 用户调用 `POST /accounts/me/open-ids`，把第 2 步返回的 `openId` 或 `readableId` 绑定到自己的账号。
6. 用户查询收益、维护支付宝信息、提交提现。

ECPM 收益不是游戏端上报。AI-KS 后台会通过快手接口按游戏和 open_id 拉取 ECPM，结算后进入用户余额。

## 3. 健康检查

### `GET /health`

用于确认 API 服务是否可访问。

响应示例：

```json
{
  "status": "ok",
  "service": "ai-ks-api"
}
```

## 4. 游戏登录换 open_id

### `POST /game/sessions`

把游戏侧拿到的快手 `js_code` 交给后端换取 open_id。

前置条件：

- 超级管理员已在后台创建游戏。
- 游戏的 `game_app_id` 和 `game_secret` 已配置。
- `.env` 中 `KUAISHOU_API_MODE=real` 时会请求真实快手接口；`mock` 时返回稳定模拟 open_id。

请求体：

```json
{
  "gameAppId": "ks-game-app-id",
  "jsCode": "code-from-kuaishou-login"
}
```

字段说明：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `gameAppId` | string | 是 | 后台“游戏”里配置的快手小游戏 app id |
| `jsCode` | string | 是 | 快手小游戏登录得到的一次性 code |

响应示例：

```json
{
  "game": {
    "gameAppId": "ks-game-app-id",
    "name": "示例小游戏"
  },
  "openId": "open_id_from_kuaishou",
  "readableId": "GAME001",
  "source": {
    "open_id": "open_id_from_kuaishou",
    "session_key": "session_key_from_kuaishou"
  }
}
```

字段说明：

| 字段 | 说明 |
| --- | --- |
| `openId` | 快手 open_id，真实业务主标识 |
| `readableId` | AI-KS 生成的可读 ID，可用于人工排查和绑定 |
| `source` | 快手原始响应；mock 模式下为 `{ "mode": "mock", "js_code": "..." }` |

常见错误：

| 状态码 | message | 处理 |
| --- | --- | --- |
| `400` | `参数错误：gameAppId、jsCode` | 检查请求体字段名和非空值 |
| `404` | `Game <gameAppId> is not configured` | 先在后台创建并配置游戏 |
| `500` | `服务器开小差了，请稍后重试` | real 模式下重点检查快手 app id、secret、js_code 是否匹配 |

小游戏侧伪代码：

```js
ks.login({
  success: async ({ code }) => {
    const response = await fetch(`${API_BASE_URL}/game/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gameAppId: 'ks-game-app-id',
        jsCode: code,
      }),
    });

    const session = await response.json();
    // 保存 session.openId 或 session.readableId，后续绑定用户账号。
  },
});
```

## 5. 用户账号

### `POST /accounts/register`

注册用户账号。注册时可以填写代理邀请码。

请求体：

```json
{
  "username": "alice",
  "password": "secret123",
  "invitationCode": "AGENT001"
}
```

字段说明：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `username` | string | 是 | 最少 3 个字符 |
| `password` | string | 是 | 最少 6 个字符 |
| `invitationCode` | string | 否 | 代理邀请码；不存在或停用会返回 404 |

响应示例：

```json
{
  "accessToken": "<jwt-token>",
  "account": {
    "id": "user_cm...",
    "readableId": "USER001",
    "username": "alice"
  }
}
```

常见错误：

| 状态码 | message | 处理 |
| --- | --- | --- |
| `400` | `参数错误：username、password` | 检查字段长度 |
| `404` | `代理邀请码不存在或已停用` | 让用户换有效邀请码，或不传邀请码 |
| `409` | `用户名已存在，请换一个用户名` | 换用户名 |

### `POST /accounts/login`

用户登录。

请求体：

```json
{
  "username": "alice",
  "password": "secret123"
}
```

响应同注册接口。

常见错误：

| 状态码 | message |
| --- | --- |
| `401` | `账号或密码错误` |

### `GET /accounts/me`

获取当前登录用户。

请求头：

```http
Authorization: Bearer <accessToken>
```

响应示例：

```json
{
  "id": "user_cm...",
  "readableId": "USER001",
  "username": "alice"
}
```

## 6. 绑定 open_id

### `POST /accounts/me/open-ids`

把游戏登录产生的 open_id 或 readableId 绑定到当前用户。

请求头：

```http
Authorization: Bearer <accessToken>
```

请求体：

```json
{
  "identity": "open_id_from_kuaishou"
}
```

`identity` 可以传：

- `POST /game/sessions` 返回的 `openId`。
- `POST /game/sessions` 返回的 `readableId`。

响应示例：

```json
{
  "openId": "open_id_from_kuaishou",
  "readableId": "GAME001",
  "userId": "user_cm..."
}
```

常见错误：

| 状态码 | message | 处理 |
| --- | --- | --- |
| `401` | `登录已失效，请重新登录` | 重新登录 |
| `404` | `Open id <identity> is not found` | 先调用 `/game/sessions` 生成 open_id 记录 |

## 7. 代理归属

### `GET /accounts/me/agent-binding`

查询当前用户绑定的代理。

请求头：

```http
Authorization: Bearer <accessToken>
```

响应示例：

```json
{
  "agent": {
    "id": "agent_cm...",
    "invitationCode": "AGENT001",
    "parentAgentId": null,
    "username": "agent-a"
  }
}
```

未绑定代理时：

```json
{
  "agent": null
}
```

### `PATCH /accounts/me/agent-binding`

通过代理邀请码绑定或换绑代理。

请求头：

```http
Authorization: Bearer <accessToken>
```

请求体：

```json
{
  "invitationCode": "AGENT001"
}
```

响应示例：

```json
{
  "agent": {
    "id": "agent_cm...",
    "invitationCode": "AGENT001",
    "parentAgentId": null,
    "username": "agent-a"
  }
}
```

说明：

- 换绑只影响后续新结算。
- 已生成的历史结算和提现批次不会回改。

## 8. 收益查询

### `GET /accounts/me/earnings?date=YYYY-MM-DD`

查询当前用户指定自然日的 ECPM 收益。

请求头：

```http
Authorization: Bearer <accessToken>
```

查询参数：

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `date` | 否 | 中国时区自然日，格式 `YYYY-MM-DD`。不传则默认当天 |

响应示例：

```json
{
  "date": "2026-05-10",
  "openIds": ["open_id_from_kuaishou"],
  "rows": [
    {
      "platformEventId": "event-001",
      "gameAppId": "",
      "openId": "open_id_from_kuaishou",
      "rawCost": {
        "li": "12345",
        "yuan": "12.35"
      },
      "displayAmount": {
        "li": "6173",
        "yuan": "6.17"
      },
      "eventTime": "2026-05-10T02:30:00.000Z",
      "configSnapshot": {
        "ratioPercent": 50
      }
    }
  ],
  "totalDisplayAmount": {
    "li": "6173",
    "yuan": "6.17"
  },
  "totalRawCost": {
    "li": "12345",
    "yuan": "12.35"
  },
  "userId": "user_cm..."
}
```

说明：

- `rows` 来自后台同步到的快手 ECPM 明细。
- 没有绑定 open_id 或当天没有 ECPM 时，`rows` 为空，合计金额为 0。
- `eventTime` 是 ISO 时间，前端展示时可转为本地或中国时区。

## 9. 支付宝和提现

### `GET /accounts/me/alipay`

查询当前用户支付宝收款信息。

请求头：

```http
Authorization: Bearer <accessToken>
```

响应示例：

```json
{
  "alipayAccount": "alice@example.com",
  "alipayRealName": "张三"
}
```

未维护时两个字段可能为 `null`。

### `PATCH /accounts/me/alipay`

维护当前用户支付宝收款信息。

请求头：

```http
Authorization: Bearer <accessToken>
```

请求体：

```json
{
  "alipayAccount": "alice@example.com",
  "alipayRealName": "张三"
}
```

响应同查询接口。

### `POST /accounts/me/withdrawals`

当前用户提交提现申请。

请求头：

```http
Authorization: Bearer <accessToken>
```

请求体：

```json
{
  "amountYuan": "10.00"
}
```

字段说明：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `amountYuan` | string | 是 | 提现金额，单位元；最多 3 位小数，必须大于 0 |

响应示例：

```json
{
  "id": "withdrawal_cm...",
  "status": "PENDING_REVIEW",
  "totalAmount": {
    "li": "10000",
    "yuan": "10.00"
  },
  "userId": "user_cm...",
  "details": [
    {
      "id": "withdrawal_detail_cm...",
      "amount": {
        "li": "10000",
        "yuan": "10.00"
      },
      "recipientAlipay": "alice@example.com",
      "recipientName": "张三",
      "status": "PENDING_REVIEW",
      "type": "USER"
    }
  ]
}
```

常见错误：

| 状态码 | message | 处理 |
| --- | --- | --- |
| `400` | `请先维护支付宝收款信息` | 先调用 `PATCH /accounts/me/alipay` |
| `400` | `提现金额低于最低提现金额` | 按后台配置的最低提现金额提示用户 |
| `400` | `可提现余额不足` | 刷新用户余额/收益状态 |
| `400` | `提现金额必须大于 0` | 检查输入金额 |

## 10. 游客和兼容接口

这些接口不要求登录，适合临时联调或旧页面兼容。新游戏端优先使用第 5 至第 9 节的登录态接口。

### `GET /user/earnings?identity=<openId或readableId>&date=YYYY-MM-DD`

按 open_id 或 readableId 查询收益。

响应字段：

- `identity`
- `openId`
- `readableId`
- `date`
- `totalRawCost`
- `totalDisplayAmount`
- `rows`

### `POST /accounts/:userId/open-ids`

按用户 ID 绑定 open_id。新游戏端不建议使用，推荐使用 `POST /accounts/me/open-ids`。

请求体：

```json
{
  "identity": "open_id_or_readable_id"
}
```

### `GET /accounts/:userId/earnings?date=YYYY-MM-DD`

按用户 ID 查询收益。新游戏端不建议使用，推荐使用 `GET /accounts/me/earnings`。

## 11. 最小联调清单

游戏端联调时至少确认：

1. `GET /health` 返回 `status=ok`。
2. 后台已创建游戏，且 `gameAppId` 与游戏端一致。
3. `POST /game/sessions` 能返回 `openId` 和 `readableId`。
4. 用户能注册或登录并拿到 `accessToken`。
5. `POST /accounts/me/open-ids` 能把 open_id 绑定到用户。
6. 后台同步 ECPM 后，`GET /accounts/me/earnings` 能看到明细或合计。
7. 如需提现，先维护支付宝，再提交提现申请。

## 12. curl 示例

健康检查：

```bash
curl http://127.0.0.1:8007/api/health
```

游戏登录换 open_id：

```bash
curl -X POST http://127.0.0.1:8007/api/game/sessions \
  -H 'Content-Type: application/json' \
  --data '{"gameAppId":"ks-game-app-id","jsCode":"mock-js-code-001"}'
```

用户登录：

```bash
curl -X POST http://127.0.0.1:8007/api/accounts/login \
  -H 'Content-Type: application/json' \
  --data '{"username":"alice","password":"secret123"}'
```

绑定 open_id：

```bash
curl -X POST http://127.0.0.1:8007/api/accounts/me/open-ids \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  --data '{"identity":"GAME001"}'
```

查询收益：

```bash
curl 'http://127.0.0.1:8007/api/accounts/me/earnings?date=2026-05-10' \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```
