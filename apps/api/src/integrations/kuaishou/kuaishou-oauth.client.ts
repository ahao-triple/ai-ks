import { Injectable } from '@nestjs/common';

const ACCESS_TOKEN_URL =
  'https://ad.e.kuaishou.com/rest/openapi/oauth2/authorize/access_token';
const REFRESH_TOKEN_URL =
  'https://ad.e.kuaishou.com/rest/openapi/oauth2/authorize/refresh_token';

export type KuaishouOAuthTokenResult = {
  accessToken: string;
  accessTokenExpiresIn: number;
  advertiserId?: string;
  raw: unknown;
  refreshToken: string;
  refreshTokenExpiresIn: number;
};

export type KuaishouExchangeAuthCodeInput = {
  appId: string;
  authCode: string;
  secret: string;
};

export type KuaishouRefreshAccessTokenInput = {
  appId: string;
  refreshToken: string;
  secret: string;
};

@Injectable()
export class KuaishouOAuthClient {
  exchangeAuthCode(input: KuaishouExchangeAuthCodeInput) {
    return requestToken(ACCESS_TOKEN_URL, {
      app_id: input.appId,
      auth_code: input.authCode,
      secret: input.secret,
    });
  }

  refreshAccessToken(input: KuaishouRefreshAccessTokenInput) {
    return requestToken(REFRESH_TOKEN_URL, {
      app_id: input.appId,
      refresh_token: input.refreshToken,
      secret: input.secret,
    });
  }
}

async function requestToken(
  url: string,
  body: Record<string, string>,
): Promise<KuaishouOAuthTokenResult> {
  const response = await fetch(url, {
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
  const payload = (await response.json()) as Record<string, unknown>;
  const code = readNumber(payload, 'code');
  const message = readString(payload, 'message') ?? 'Kuaishou OAuth failed';

  if (!response.ok || code !== 0) {
    throw new Error(message);
  }

  const data = readRecord(payload, 'data');
  const accessToken = data ? readString(data, 'access_token') : undefined;
  const refreshToken = data ? readString(data, 'refresh_token') : undefined;
  const accessTokenExpiresIn = data
    ? readNumber(data, 'access_token_expires_in')
    : undefined;
  const refreshTokenExpiresIn = data
    ? readNumber(data, 'refresh_token_expires_in')
    : undefined;

  if (
    !accessToken ||
    !refreshToken ||
    accessTokenExpiresIn === undefined ||
    refreshTokenExpiresIn === undefined
  ) {
    throw new Error('Kuaishou OAuth response missing token fields');
  }

  // 快手 OAuth 偶尔会在 advertiser_id 上返 0（IAA 类应用无 DSP 账户绑定），
  // 这种值传给 ECPM 接口会被拒（"advertiser_id 或 agent_id 缺失"），按未提供处理。
  const rawAdvertiserId = data
    ? readString(data, 'advertiser_id') ??
      readNumber(data, 'advertiser_id')?.toString()
    : undefined;
  const advertiserId =
    rawAdvertiserId && rawAdvertiserId !== '0' ? rawAdvertiserId : undefined;

  return {
    accessToken,
    accessTokenExpiresIn,
    advertiserId,
    raw: payload,
    refreshToken,
    refreshTokenExpiresIn,
  };
}

function readRecord(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : undefined;
}

function readString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  if (typeof value === 'string') {
    return value;
  }

  return undefined;
}

function readNumber(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && /^\d+$/.test(value)) {
    return Number(value);
  }

  return undefined;
}
