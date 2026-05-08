import { BadRequestException } from '@nestjs/common';
import { KuaishouTokenStatus } from '@prisma/client';
import { KuaishouTokenService } from './kuaishou-token.service';

describe('KuaishouTokenService', () => {
  it('returns unconfigured status when database and env are empty', async () => {
    const { service } = createService();

    await expect(service.getStatus()).resolves.toEqual({
      configured: false,
      source: 'none',
      status: KuaishouTokenStatus.UNCONFIGURED,
    });
  });

  it('returns env status when env fallback exists', async () => {
    const { service } = createService({
      env: {
        KUAISHOU_ACCESS_TOKEN: 'env-access',
        KUAISHOU_ADVERTISER_ID: 'env-advertiser',
      },
    });

    await expect(service.getStatus()).resolves.toMatchObject({
      advertiserId: 'env-advertiser',
      configured: true,
      source: 'env',
      status: KuaishouTokenStatus.ACTIVE,
    });
  });

  it('authorizes with auth_code and stores token expiry dates', async () => {
    const { oauth, prisma, service } = createService();
    oauth.exchangeResult = {
      accessToken: 'access-1',
      accessTokenExpiresIn: 60,
      advertiserId: 'advertiser-1',
      raw: {},
      refreshToken: 'refresh-1',
      refreshTokenExpiresIn: 120,
    };

    const status = await service.authorizeWithAuthCode({
      actor: adminActor,
      appId: 'app-1',
      authCode: 'auth-code-1',
      secret: 'secret-1',
    });

    expect(oauth.lastExchangeInput).toEqual({
      appId: 'app-1',
      authCode: 'auth-code-1',
      secret: 'secret-1',
    });
    expect(prisma.getToken()).toMatchObject({
      accessToken: 'access-1',
      advertiserId: 'advertiser-1',
      appId: 'app-1',
      lastError: null,
      refreshToken: 'refresh-1',
      secret: 'secret-1',
      status: KuaishouTokenStatus.ACTIVE,
    });
    expect(prisma.getToken()?.accessTokenExpiresAt).toEqual(
      new Date('2026-05-08T00:01:00.000Z'),
    );
    expect(prisma.getToken()?.refreshTokenExpiresAt).toEqual(
      new Date('2026-05-08T00:02:00.000Z'),
    );
    expect(status).toMatchObject({
      configured: true,
      source: 'database',
      status: KuaishouTokenStatus.ACTIVE,
    });
  });

  it('stores error status when auth_code authorization fails', async () => {
    const { oauth, prisma, service } = createService();
    oauth.exchangeError = new Error('auth_code invalid');

    await expect(
      service.authorizeWithAuthCode({
        actor: adminActor,
        appId: 'app-1',
        authCode: 'bad-code',
        secret: 'secret-1',
      }),
    ).rejects.toThrow('快手授权失败');
    expect(prisma.getToken()).toMatchObject({
      appId: 'app-1',
      lastError: 'auth_code invalid',
      status: KuaishouTokenStatus.ERROR,
    });
  });

  it('refreshes stored tokens and updates refreshedAt', async () => {
    const { oauth, prisma, service } = createService({
      token: activeToken({
        refreshToken: 'refresh-1',
      }),
    });
    oauth.refreshResult = {
      accessToken: 'access-2',
      accessTokenExpiresIn: 60,
      advertiserId: 'advertiser-2',
      raw: {},
      refreshToken: 'refresh-2',
      refreshTokenExpiresIn: 120,
    };

    const status = await service.refreshStoredToken({ actor: adminActor });

    expect(oauth.lastRefreshInput).toEqual({
      appId: 'app-1',
      refreshToken: 'refresh-1',
      secret: 'secret-1',
    });
    expect(prisma.getToken()).toMatchObject({
      accessToken: 'access-2',
      advertiserId: 'advertiser-2',
      refreshToken: 'refresh-2',
      refreshedAt: now,
      status: KuaishouTokenStatus.ACTIVE,
    });
    expect(status.source).toBe('database');
  });

  it('rejects refresh when no refresh token is stored', async () => {
    const { service } = createService({
      token: activeToken({
        refreshToken: null,
      }),
    });

    await expect(
      service.refreshStoredToken({ actor: adminActor }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('resolves active database credentials before env fallback', async () => {
    const { service } = createService({
      env: {
        KUAISHOU_ACCESS_TOKEN: 'env-access',
        KUAISHOU_ADVERTISER_ID: 'env-advertiser',
      },
      token: activeToken(),
    });

    await expect(service.resolveReportCredentials()).resolves.toEqual({
      accessToken: 'access-1',
      advertiserId: 'advertiser-1',
      source: 'database',
    });
  });

  it('falls back to env when database access token is expired', async () => {
    const { service } = createService({
      env: {
        KUAISHOU_ACCESS_TOKEN: 'env-access',
        KUAISHOU_ADVERTISER_ID: 'env-advertiser',
      },
      token: activeToken({
        accessTokenExpiresAt: new Date('2026-05-07T00:00:00.000Z'),
      }),
    });

    await expect(service.resolveReportCredentials()).resolves.toEqual({
      accessToken: 'env-access',
      advertiserId: 'env-advertiser',
      source: 'env',
    });
  });

  it('auto-refreshes expired database access tokens when refresh token is usable', async () => {
    const { oauth, prisma, service } = createService({
      env: {
        KUAISHOU_ACCESS_TOKEN: 'env-access',
        KUAISHOU_ADVERTISER_ID: 'env-advertiser',
      },
      token: activeToken({
        accessToken: 'expired-access',
        accessTokenExpiresAt: new Date('2026-05-07T00:00:00.000Z'),
        refreshToken: 'refresh-1',
        refreshTokenExpiresAt: new Date('2026-05-09T00:00:00.000Z'),
      }),
    });
    oauth.refreshResult = {
      accessToken: 'access-2',
      accessTokenExpiresIn: 60,
      advertiserId: 'advertiser-2',
      raw: {},
      refreshToken: 'refresh-2',
      refreshTokenExpiresIn: 120,
    };

    await expect(service.resolveReportCredentials()).resolves.toEqual({
      accessToken: 'access-2',
      advertiserId: 'advertiser-2',
      source: 'database',
    });
    expect(oauth.lastRefreshInput).toEqual({
      appId: 'app-1',
      refreshToken: 'refresh-1',
      secret: 'secret-1',
    });
    expect(prisma.getToken()).toMatchObject({
      accessToken: 'access-2',
      advertiserId: 'advertiser-2',
      refreshToken: 'refresh-2',
      refreshedAt: now,
      status: KuaishouTokenStatus.ACTIVE,
    });
  });

  it('does not auto-refresh when the stored refresh token is expired', async () => {
    const { oauth, service } = createService({
      env: {
        KUAISHOU_ACCESS_TOKEN: 'env-access',
        KUAISHOU_ADVERTISER_ID: 'env-advertiser',
      },
      token: activeToken({
        accessTokenExpiresAt: new Date('2026-05-07T00:00:00.000Z'),
        refreshTokenExpiresAt: new Date('2026-05-07T00:00:00.000Z'),
      }),
    });

    await expect(service.resolveReportCredentials()).resolves.toEqual({
      accessToken: 'env-access',
      advertiserId: 'env-advertiser',
      source: 'env',
    });
    expect(oauth.lastRefreshInput).toBeUndefined();
  });

  it('reports expired status when the refresh token has expired', async () => {
    const { service } = createService({
      token: activeToken({
        accessTokenExpiresAt: new Date('2026-05-09T00:00:00.000Z'),
        refreshTokenExpiresAt: new Date('2026-05-07T00:00:00.000Z'),
      }),
    });

    await expect(service.getStatus()).resolves.toMatchObject({
      configured: true,
      source: 'database',
      status: KuaishouTokenStatus.EXPIRED,
    });
  });

  it('marks existing database tokens as error', async () => {
    const { prisma, service } = createService({
      token: activeToken(),
    });

    await service.markTokenError('report failed');

    expect(prisma.getToken()).toMatchObject({
      lastError: 'report failed',
      status: KuaishouTokenStatus.ERROR,
    });
  });

  it('does not expose secret or token values in status output', async () => {
    const { service } = createService({
      token: activeToken(),
    });

    const status = await service.getStatus();

    expect(status).not.toHaveProperty('secret');
    expect(status).not.toHaveProperty('accessToken');
    expect(status).not.toHaveProperty('refreshToken');
  });
});

const now = new Date('2026-05-08T00:00:00.000Z');
const adminActor = {
  role: 'SUPER_ADMIN' as const,
  username: 'admin',
};

type FakeToken = {
  id: string;
  key: string;
  appId: string;
  secret: string;
  advertiserId: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  accessTokenExpiresAt: Date | null;
  refreshTokenExpiresAt: Date | null;
  status: KuaishouTokenStatus;
  lastError: string | null;
  authorizedAt: Date | null;
  refreshedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function activeToken(overrides: Partial<FakeToken> = {}): FakeToken {
  return {
    accessToken: 'access-1',
    accessTokenExpiresAt: new Date('2026-05-09T00:00:00.000Z'),
    advertiserId: 'advertiser-1',
    appId: 'app-1',
    authorizedAt: now,
    createdAt: now,
    id: 'token-1',
    key: 'default',
    lastError: null,
    refreshedAt: null,
    refreshToken: 'refresh-1',
    refreshTokenExpiresAt: new Date('2026-06-07T00:00:00.000Z'),
    secret: 'secret-1',
    status: KuaishouTokenStatus.ACTIVE,
    updatedAt: now,
    ...overrides,
  };
}

function createService({
  env = {},
  token,
}: {
  env?: Record<string, string | undefined>;
  token?: FakeToken;
} = {}) {
  const prisma = createFakePrisma(token);
  const oauth = createFakeOAuthClient();
  const config = {
    get: (key: string) => env[key],
  };
  const service = new KuaishouTokenService(prisma, oauth as any, config, () => now);

  return {
    oauth,
    prisma,
    service,
  };
}

function createFakeOAuthClient() {
  return {
    exchangeError: undefined as Error | undefined,
    exchangeResult: undefined as unknown,
    lastExchangeInput: undefined as unknown,
    lastRefreshInput: undefined as unknown,
    refreshResult: undefined as unknown,
    async exchangeAuthCode(input: unknown) {
      this.lastExchangeInput = input;
      if (this.exchangeError) {
        throw this.exchangeError;
      }

      return this.exchangeResult;
    },
    async refreshAccessToken(input: unknown) {
      this.lastRefreshInput = input;
      return this.refreshResult;
    },
  };
}

function createFakePrisma(initialToken?: FakeToken) {
  let token = initialToken;

  return {
    getToken: () => token,
    kuaishouPlatformToken: {
      findUnique: async ({ where }: any) =>
        where.key === 'default' ? token ?? null : null,
      update: async ({ data, where }: any) => {
        if (!token || where.key !== 'default') {
          throw new Error('token not found');
        }

        token = {
          ...token,
          ...data,
          updatedAt: now,
        };
        return token;
      },
      upsert: async ({ create, update, where }: any) => {
        if (where.key === 'default' && token) {
          token = {
            ...token,
            ...update,
            updatedAt: now,
          };
          return token;
        }

        token = {
          id: 'token-1',
          createdAt: now,
          updatedAt: now,
          ...create,
        };
        return token;
      },
    },
  } as any;
}
