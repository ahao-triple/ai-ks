import { KuaishouOAuthClient } from './kuaishou-oauth.client';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  jest.restoreAllMocks();
});

describe('KuaishouOAuthClient', () => {
  it('exchanges auth_code with the Kuaishou access token endpoint', async () => {
    mockJsonResponse({
      code: 0,
      message: 'OK',
      data: tokenPayload(),
    });
    const client = new KuaishouOAuthClient();

    const result = await client.exchangeAuthCode({
      appId: '123',
      authCode: 'auth-code-1',
      secret: 'secret-1',
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://ad.e.kuaishou.com/rest/openapi/oauth2/authorize/access_token',
      {
        body: JSON.stringify({
          app_id: '123',
          auth_code: 'auth-code-1',
          secret: 'secret-1',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      },
    );
    expect(result).toMatchObject({
      accessToken: 'access-1',
      accessTokenExpiresIn: 86400,
      advertiserId: '456',
      refreshToken: 'refresh-1',
      refreshTokenExpiresIn: 2592000,
    });
  });

  it('refreshes access tokens with the Kuaishou refresh token endpoint', async () => {
    mockJsonResponse({
      code: 0,
      message: 'OK',
      data: tokenPayload({
        access_token: 'access-2',
        refresh_token: 'refresh-2',
      }),
    });
    const client = new KuaishouOAuthClient();

    const result = await client.refreshAccessToken({
      appId: '123',
      refreshToken: 'refresh-1',
      secret: 'secret-1',
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://ad.e.kuaishou.com/rest/openapi/oauth2/authorize/refresh_token',
      {
        body: JSON.stringify({
          app_id: '123',
          refresh_token: 'refresh-1',
          secret: 'secret-1',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      },
    );
    expect(result.accessToken).toBe('access-2');
    expect(result.refreshToken).toBe('refresh-2');
  });

  it('rejects failed Kuaishou responses with their message', async () => {
    mockJsonResponse({
      code: 1001,
      message: 'auth_code invalid',
      data: {},
    });
    const client = new KuaishouOAuthClient();

    await expect(
      client.exchangeAuthCode({
        appId: '123',
        authCode: 'bad-code',
        secret: 'secret-1',
      }),
    ).rejects.toThrow('auth_code invalid');
  });

  it('rejects successful responses missing required token fields', async () => {
    mockJsonResponse({
      code: 0,
      message: 'OK',
      data: {
        access_token: 'access-1',
      },
    });
    const client = new KuaishouOAuthClient();

    await expect(
      client.refreshAccessToken({
        appId: '123',
        refreshToken: 'refresh-1',
        secret: 'secret-1',
      }),
    ).rejects.toThrow('missing token fields');
  });
});

function tokenPayload(overrides: Record<string, unknown> = {}) {
  return {
    access_token: 'access-1',
    access_token_expires_in: 86400,
    advertiser_id: 456,
    refresh_token: 'refresh-1',
    refresh_token_expires_in: 2592000,
    ...overrides,
  };
}

function mockJsonResponse(payload: unknown) {
  globalThis.fetch = jest.fn(async () => {
    return new Response(JSON.stringify(payload), {
      headers: { 'content-type': 'application/json' },
      status: 200,
    });
  }) as typeof fetch;
}
