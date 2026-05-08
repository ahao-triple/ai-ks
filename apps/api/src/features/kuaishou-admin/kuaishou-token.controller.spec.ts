import { BadRequestException } from '@nestjs/common';
import { KuaishouTokenStatus } from '@prisma/client';
import { KuaishouTokenController } from './kuaishou-token.controller';

describe('KuaishouTokenController', () => {
  it('presents token status without secret or token values', async () => {
    const service = createService();
    const auditLogService = createAuditLogService();
    const controller = new KuaishouTokenController(service, auditLogService);

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
    const auditLogService = createAuditLogService();
    const controller = new KuaishouTokenController(service, auditLogService);

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
    expect(auditLogService.record).toHaveBeenCalledWith({
      action: 'kuaishou.token_authorized',
      actorId: 'admin',
      actorType: 'SUPER_ADMIN',
      metadata: {
        accessTokenExpiresAt: '2026-05-09T00:00:00.000Z',
        advertiserId: 'advertiser-1',
        appId: 'app-1',
        refreshTokenExpiresAt: '2026-06-07T00:00:00.000Z',
        status: KuaishouTokenStatus.ACTIVE,
      },
      targetId: 'default',
      targetType: 'kuaishou_platform_token',
    });
  });

  it('refreshes with current admin', async () => {
    const service = createService();
    const auditLogService = createAuditLogService();
    const controller = new KuaishouTokenController(service, auditLogService);

    await controller.refresh(admin);

    expect(service.lastRefreshInput).toEqual({
      actor: admin,
    });
    expect(auditLogService.record).toHaveBeenCalledWith({
      action: 'kuaishou.token_refreshed',
      actorId: 'admin',
      actorType: 'SUPER_ADMIN',
      metadata: {
        accessTokenExpiresAt: '2026-05-09T00:00:00.000Z',
        advertiserId: 'advertiser-1',
        appId: 'app-1',
        refreshTokenExpiresAt: '2026-06-07T00:00:00.000Z',
        status: KuaishouTokenStatus.ACTIVE,
      },
      targetId: 'default',
      targetType: 'kuaishou_platform_token',
    });
  });

  it('rejects invalid authorize bodies', async () => {
    const controller = new KuaishouTokenController(
      createService(),
      createAuditLogService(),
    );

    await expect(
      controller.authorize(admin, {
        appId: 'app-1',
        authCode: '  ',
        secret: 'secret-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('records failed authorization audits without leaking submitted secrets', async () => {
    const service = createService();
    service.authorizeError = new Error('auth_code invalid');
    const auditLogService = createAuditLogService();
    const controller = new KuaishouTokenController(service, auditLogService);

    await expect(
      controller.authorize(admin, {
        appId: 'app-1',
        authCode: 'auth-code-1',
        secret: 'secret-1',
      }),
    ).rejects.toThrow('auth_code invalid');

    expect(auditLogService.record).toHaveBeenCalledWith({
      action: 'kuaishou.token_authorize_failed',
      actorId: 'admin',
      actorType: 'SUPER_ADMIN',
      metadata: {
        appId: 'app-1',
        error: 'auth_code invalid',
      },
      targetId: 'default',
      targetType: 'kuaishou_platform_token',
    });
    expect(auditLogService.lastRecord).not.toMatchObject({
      metadata: expect.objectContaining({
        authCode: expect.anything(),
        secret: expect.anything(),
      }),
    });
  });

  it('records failed refresh audits', async () => {
    const service = createService();
    service.refreshError = new Error('refresh token invalid');
    const auditLogService = createAuditLogService();
    const controller = new KuaishouTokenController(service, auditLogService);

    await expect(controller.refresh(admin)).rejects.toThrow(
      'refresh token invalid',
    );

    expect(auditLogService.record).toHaveBeenCalledWith({
      action: 'kuaishou.token_refresh_failed',
      actorId: 'admin',
      actorType: 'SUPER_ADMIN',
      metadata: {
        error: 'refresh token invalid',
      },
      targetId: 'default',
      targetType: 'kuaishou_platform_token',
    });
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
    authorizeError: undefined as Error | undefined,
    lastAuthorizeInput: undefined as unknown,
    lastRefreshInput: undefined as unknown,
    refreshError: undefined as Error | undefined,
    authorizeWithAuthCode: async function (input: unknown) {
      this.lastAuthorizeInput = input;
      if (this.authorizeError) {
        throw this.authorizeError;
      }

      return status;
    },
    getStatus: async () => status,
    refreshStoredToken: async function (input: unknown) {
      this.lastRefreshInput = input;
      if (this.refreshError) {
        throw this.refreshError;
      }

      return status;
    },
  } as any;
}

function createAuditLogService() {
  return {
    lastRecord: undefined as unknown,
    record: jest.fn(async function (input: unknown) {
      this.lastRecord = input;
      return undefined;
    }),
  } as any;
}
