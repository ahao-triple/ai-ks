import { BadRequestException } from '@nestjs/common';
import { KuaishouTokenStatus } from '@prisma/client';
import { KuaishouTokenController } from './kuaishou-token.controller';

describe('KuaishouTokenController', () => {
  it('presents token status without secret or token values', async () => {
    const service = createService();
    const controller = new KuaishouTokenController(service);

    const result = await controller.status();

    expect(result).toEqual({
      accessTokenExpiresAt: '2026-05-09T00:00:00.000Z',
      advertiserId: 'advertiser-1',
      appId: 'app-1',
      authorizedAt: '2026-05-08T00:00:00.000Z',
      configured: true,
      lastError: null,
      refreshTokenExpiresAt: '2026-06-07T00:00:00.000Z',
      refreshedAt: null,
      source: 'database',
      status: KuaishouTokenStatus.ACTIVE,
    });
    expect(result).not.toHaveProperty('secret');
    expect(result).not.toHaveProperty('accessToken');
    expect(result).not.toHaveProperty('refreshToken');
  });

  it('authorizes with trimmed fields and current admin', async () => {
    const service = createService();
    const controller = new KuaishouTokenController(service);

    await controller.authorize(admin, {
      appId: ' app-1 ',
      authCode: ' auth-code-1 ',
      secret: ' secret-1 ',
    });

    expect(service.lastAuthorizeInput).toEqual({
      actor: admin,
      appId: 'app-1',
      authCode: 'auth-code-1',
      secret: 'secret-1',
    });
  });

  it('refreshes with current admin', async () => {
    const service = createService();
    const controller = new KuaishouTokenController(service);

    await controller.refresh(admin);

    expect(service.lastRefreshInput).toEqual({
      actor: admin,
    });
  });

  it('rejects invalid authorize bodies', async () => {
    const controller = new KuaishouTokenController(createService());

    await expect(
      controller.authorize(admin, {
        appId: 'app-1',
        authCode: '  ',
        secret: 'secret-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

const admin = {
  role: 'SUPER_ADMIN' as const,
  username: 'admin',
};

function createService() {
  const status = {
    accessTokenExpiresAt: new Date('2026-05-09T00:00:00.000Z'),
    advertiserId: 'advertiser-1',
    appId: 'app-1',
    authorizedAt: new Date('2026-05-08T00:00:00.000Z'),
    configured: true,
    lastError: null,
    refreshTokenExpiresAt: new Date('2026-06-07T00:00:00.000Z'),
    refreshedAt: null,
    source: 'database' as const,
    status: KuaishouTokenStatus.ACTIVE,
  };

  return {
    lastAuthorizeInput: undefined as unknown,
    lastRefreshInput: undefined as unknown,
    authorizeWithAuthCode: async function (input: unknown) {
      this.lastAuthorizeInput = input;
      return status;
    },
    getStatus: async () => status,
    refreshStoredToken: async function (input: unknown) {
      this.lastRefreshInput = input;
      return status;
    },
  } as any;
}
