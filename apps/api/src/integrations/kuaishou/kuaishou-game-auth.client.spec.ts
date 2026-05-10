import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { KuaishouGameAuthClient } from './kuaishou-game-auth.client';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  jest.restoreAllMocks();
});

describe('KuaishouGameAuthClient', () => {
  it('rejects code exchange when real Kuaishou mode is not enabled', async () => {
    const client = new KuaishouGameAuthClient({
      get: () => undefined,
    });

    await expect(
      client.exchangeCode({
        gameAppId: 'game-app',
        gameSecret: 'game-secret',
        jsCode: 'real-js-code',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns a debuggable upstream error when code exchange fails', async () => {
    globalThis.fetch = jest.fn(async () => {
      return new Response(
        JSON.stringify({
          error: 'invalid js_code',
        }),
        {
          headers: { 'content-type': 'application/json' },
          status: 400,
        },
      );
    }) as typeof fetch;
    const client = new KuaishouGameAuthClient({
      get: () => 'real',
    });

    await expect(
      client.exchangeCode({
        gameAppId: 'game-app',
        gameSecret: 'game-secret',
        jsCode: 'bad-js-code',
      }),
    ).rejects.toThrow(BadGatewayException);
    await expect(
      client.exchangeCode({
        gameAppId: 'game-app',
        gameSecret: 'game-secret',
        jsCode: 'bad-js-code',
      }),
    ).rejects.toThrow('快手 code2Session 失败：');
  });
});
