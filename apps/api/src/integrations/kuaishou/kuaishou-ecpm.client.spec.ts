import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { KuaishouEcpmClient } from './kuaishou-ecpm.client';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  jest.restoreAllMocks();
});

describe('KuaishouEcpmClient', () => {
  it('rejects refreshes when real Kuaishou mode is not enabled', async () => {
    const tokenService = createTokenService({
      accessToken: 'db-access-token',
      advertiserId: 'db-advertiser-id',
      source: 'database',
    });
    const client = createClient({
      config: {},
      tokenService,
    });

    await expect(
      client.refresh({
        dataHour: '2026-05-08',
        gameAppId: 'game-1',
        openIds: ['open-1'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tokenService.resolveReportCredentials).not.toHaveBeenCalled();
    expect(globalThis.fetch).toBe(originalFetch);
  });

  it('uses resolved database credentials in real mode', async () => {
    mockEcpmResponse();
    const tokenService = createTokenService({
      accessToken: 'db-access-token',
      advertiserId: 'db-advertiser-id',
      source: 'database',
    });
    const client = createClient({
      config: {
        KUAISHOU_API_MODE: 'real',
      },
      tokenService,
    });

    const result = await client.refresh({
      dataHour: '2026-05-08',
      gameAppId: 'game-1',
      openIds: ['open-1'],
    });

    expect(tokenService.resolveReportCredentials).toHaveBeenCalled();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://ad.e.kuaishou.com/rest/openapi/gw/dsp/v1/report/ecpm_report',
      {
        body: JSON.stringify({
          advertiser_id: 'db-advertiser-id',
          app_id: 'game-1',
          data_hour: '2026-05-08',
          open_id: ['open-1'],
          page: 1,
          page_size: 500,
        }),
        headers: {
          'Access-Token': 'db-access-token',
          'Content-Type': 'application/json',
        },
        method: 'POST',
      },
    );
    expect(result.source).toBe('kuaishou');
    expect(result.rows).toEqual([
      {
        eventTime: new Date('2026-05-08T01:00:00.000Z'),
        openId: 'open-1',
        platformEventId: 'event-1',
        rawCostLi: 2300n,
      },
    ]);
  });

  it('uses env fallback credentials through the token service in real mode', async () => {
    mockEcpmResponse();
    const tokenService = createTokenService({
      accessToken: 'env-access-token',
      advertiserId: 'env-advertiser-id',
      source: 'env',
    });
    const client = createClient({
      config: {
        KUAISHOU_API_MODE: 'real',
      },
      tokenService,
    });

    await client.refresh({
      dataHour: '2026-05-08',
      gameAppId: 'game-1',
      openIds: ['open-1'],
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          advertiser_id: 'env-advertiser-id',
          app_id: 'game-1',
          data_hour: '2026-05-08',
          open_id: ['open-1'],
          page: 1,
          page_size: 500,
        }),
        headers: expect.objectContaining({
          'Access-Token': 'env-access-token',
        }),
      }),
    );
  });

  it('rejects real mode refreshes when no credentials resolve', async () => {
    const tokenService = {
      resolveReportCredentials: jest.fn(async () => {
        throw new Error('Kuaishou access token is not configured');
      }),
    };
    const client = createClient({
      config: {
        KUAISHOU_API_MODE: 'real',
      },
      tokenService,
    });

    await expect(
      client.refresh({
        dataHour: '2026-05-08',
        gameAppId: 'game-1',
        openIds: ['open-1'],
      }),
    ).rejects.toThrow('Kuaishou access token is not configured');
    expect(globalThis.fetch).toBe(originalFetch);
  });

  it('returns a debuggable upstream error when Kuaishou refresh fails', async () => {
    globalThis.fetch = jest.fn(async () => {
      return new Response(
        JSON.stringify({
          code: 401,
          message: 'access token expired',
          request_id: 'req-1',
        }),
        {
          headers: { 'content-type': 'application/json' },
          status: 401,
        },
      );
    }) as typeof fetch;
    const tokenService = createTokenService({
      accessToken: 'db-access-token',
      advertiserId: 'db-advertiser-id',
      source: 'database',
    });
    const client = createClient({
      config: {
        KUAISHOU_API_MODE: 'real',
      },
      tokenService,
    });

    await expect(
      client.refresh({
        dataHour: '2026-05-08',
        gameAppId: 'game-1',
        openIds: ['open-1'],
      }),
    ).rejects.toThrow(BadGatewayException);
    await expect(
      client.refresh({
        dataHour: '2026-05-08',
        gameAppId: 'game-1',
        openIds: ['open-1'],
      }),
    ).rejects.toThrow('快手 ECPM 刷新失败：');
  });
});

function createClient(input: {
  config: Record<string, string | undefined>;
  tokenService: unknown;
}) {
  return new (KuaishouEcpmClient as any)(
    {
      get: (key: string) => input.config[key],
    },
    input.tokenService,
  ) as KuaishouEcpmClient;
}

function createTokenService(credentials: {
  accessToken: string;
  advertiserId: string;
  source: 'database' | 'env';
}) {
  return {
    resolveReportCredentials: jest.fn(async () => credentials),
  };
}

function mockEcpmResponse() {
  globalThis.fetch = jest.fn(async () => {
    return new Response(
      JSON.stringify({
        data: {
          details: [
            {
              cost: '2300',
              event_time: '2026-05-08T01:00:00.000Z',
              id: 'event-1',
              open_id: 'open-1',
            },
          ],
        },
      }),
      {
        headers: { 'content-type': 'application/json' },
        status: 200,
      },
    );
  }) as typeof fetch;
}
