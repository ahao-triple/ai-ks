# 游戏端登录 API 对接文档

更新日期：2026-05-10

本文档只面向游戏端登录对接。当前游戏端只需要把快手小游戏登录得到的 `js_code` 发给 AI-KS，换取并写入 `open_id`。用户注册、收益查询、提现、后台结算等流程不需要游戏端对接。

## 1. 接入目标

游戏端完成一件事：

```text
快手小游戏登录 code -> AI-KS API -> 快手 open_id / AI-KS readableId
```

AI-KS 后续会用这个 `open_id` 做 ECPM 同步、用户绑定、收益和结算核对。

## 2. Base URL

API 统一前缀为 `/api`。

服务器直连示例：

```text
http://<server-host>:8007/api
```

如果游戏页面和 AI-KS Web 同源，并且 Web 进程或 Nginx 已把 `/api` 反向代理到 API，可以使用：

```text
/api
```

注意：如果游戏运行在玩家手机、快手容器或你自己的电脑浏览器里，`localhost` 指的是运行游戏的设备本机，不是服务器。远程联调时不要把游戏端 API 地址写成 `http://localhost:8007/api`，应改成服务器公网地址或同源 `/api`。

## 3. 后台前置配置

调用登录接口前，后台需要先完成：

1. 超级管理员创建游戏。
2. 填写游戏的 `game_app_id`。
3. 填写游戏的 `game_secret`。
4. 如果是真实快手联调，服务器 `.env` 设置 `KUAISHOU_API_MODE=real`。

游戏端只传 `gameAppId` 和 `jsCode`，不要把 `gameSecret` 放到游戏客户端。

## 4. 健康检查

### `GET /health`

用于确认 API 服务可访问。

完整地址示例：

```text
GET http://<server-host>:8007/api/health
```

响应示例：

```json
{
  "status": "ok",
  "service": "ai-ks-api"
}
```

## 5. 登录换 open_id

### `POST /game/sessions`

游戏端拿到快手登录 `js_code` 后调用该接口。

完整地址示例：

```text
POST http://<server-host>:8007/api/game/sessions
```

请求头：

```http
Content-Type: application/json
```

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
| `gameAppId` | string | 是 | 后台配置的快手小游戏 app id |
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
| `game.gameAppId` | 后台配置的游戏 app id |
| `game.name` | 后台配置的游戏名称 |
| `openId` | 快手 open_id，后续收益和结算使用的核心标识 |
| `readableId` | AI-KS 生成的可读 ID，方便人工排查和页面绑定 |
| `source` | 快手原始响应；mock 模式下是模拟信息 |

## 6. 游戏端示例

快手小游戏侧伪代码：

```js
const API_BASE_URL = 'http://<server-host>:8007/api';
const GAME_APP_ID = 'ks-game-app-id';

ks.login({
  success: async ({ code }) => {
    const response = await fetch(`${API_BASE_URL}/game/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        gameAppId: GAME_APP_ID,
        jsCode: code,
      }),
    });

    const payload = await response.json();

    if (!response.ok) {
      console.error('AI-KS login failed', payload);
      return;
    }

    console.log('AI-KS open_id', payload.openId);
    console.log('AI-KS readableId', payload.readableId);
  },
  fail: (error) => {
    console.error('ks.login failed', error);
  },
});
```

## 7. mock 和 real 模式

### mock 模式

服务器 `.env`：

```env
KUAISHOU_API_MODE=mock
```

适合普通接口联调。后端不会请求真实快手接口，会根据 `gameAppId + jsCode` 生成稳定的模拟 `openId`。

### real 模式

服务器 `.env`：

```env
KUAISHOU_API_MODE=real
```

后端会请求快手接口：

```text
https://open.kuaishou.com/game/minigame/jscode2session
```

此时后台配置的 `game_app_id`、`game_secret` 必须和游戏端拿到的 `js_code` 属于同一个快手小游戏。

## 8. 常见错误

接口错误格式：

```json
{
  "statusCode": 404,
  "error": "Error",
  "message": "Game ks-game-app-id is not configured"
}
```

常见情况：

| 状态码 | message | 处理 |
| --- | --- | --- |
| `400` | `参数错误：gameAppId、jsCode` | 检查请求体字段名是否正确，值是否为空 |
| `404` | `Game <gameAppId> is not configured` | 先在后台创建游戏，并确认 `game_app_id` 一致 |
| `500` | `服务器开小差了，请稍后重试` | real 模式下检查快手 app id、secret、js_code 是否匹配 |
| 浏览器报 `ERR_CONNECTION_REFUSED` | 请求地址连不上 | 检查游戏端 API 地址，不要把远程服务器写成 `localhost` |

## 9. curl 联调

健康检查：

```bash
curl http://127.0.0.1:8007/api/health
```

登录换 open_id：

```bash
curl -X POST http://127.0.0.1:8007/api/game/sessions \
  -H 'Content-Type: application/json' \
  --data '{"gameAppId":"ks-game-app-id","jsCode":"mock-js-code-001"}'
```

远程服务器测试时，把 `127.0.0.1` 换成服务器公网 IP 或域名。

## 10. 最小验收

游戏端接入完成只需要确认：

1. `GET /api/health` 返回 `status=ok`。
2. `POST /api/game/sessions` 返回 `openId`。
3. `POST /api/game/sessions` 返回 `readableId`。
4. 后台“联调”或“总览”里能看到该 open_id。
