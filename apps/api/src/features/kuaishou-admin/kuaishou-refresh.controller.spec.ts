import { KuaishouRefreshController } from './kuaishou-refresh.controller';

describe('KuaishouRefreshController', () => {
  it('records audit metadata after an ECPM refresh succeeds', async () => {
    const dependencies = createDependencies();
    const controller = createController(dependencies);

    const result = await controller.refresh(admin, {
      dataHour: '2026-05-08',
      gameAppId: 'game-1',
      openIds: ['open-1'],
    });

    expect(result).toMatchObject({
      requestedOpenIds: ['open-1'],
      savedCount: 1,
      source: 'kuaishou',
    });
    expect(dependencies.auditLogService.record).toHaveBeenCalledWith({
      action: 'kuaishou.ecpm_refreshed',
      actorId: 'admin',
      actorType: 'SUPER_ADMIN',
      metadata: {
        dataHour: '2026-05-08',
        requestedOpenIds: ['open-1'],
        savedCount: 1,
        source: 'kuaishou',
      },
      targetId: 'game-1',
      targetType: 'kuaishou_ecpm_refresh',
    });
  });

  it('records audit metadata and marks token errors after an ECPM refresh fails', async () => {
    const dependencies = createDependencies();
    dependencies.ecpmClient.refresh.mockRejectedValueOnce(
      new Error('token expired'),
    );
    const controller = createController(dependencies);

    await expect(
      controller.refresh(admin, {
        dataHour: '2026-05-08',
        gameAppId: 'game-1',
        openIds: ['open-1'],
      }),
    ).rejects.toThrow('token expired');

    expect(dependencies.tokenService.markTokenError).toHaveBeenCalledWith(
      'token expired',
    );
    expect(dependencies.auditLogService.record).toHaveBeenCalledWith({
      action: 'kuaishou.ecpm_refresh_failed',
      actorId: 'admin',
      actorType: 'SUPER_ADMIN',
      metadata: {
        dataHour: '2026-05-08',
        error: 'token expired',
        requestedOpenIds: ['open-1'],
      },
      targetId: 'game-1',
      targetType: 'kuaishou_ecpm_refresh',
    });
  });
});

const admin = { role: 'SUPER_ADMIN' as const, username: 'admin' };

function createController(dependencies: ReturnType<typeof createDependencies>) {
  return new (KuaishouRefreshController as any)(
    dependencies.demoStore,
    dependencies.ecpmClient,
    dependencies.auditLogService,
    dependencies.tokenService,
  ) as KuaishouRefreshController;
}

function createDependencies() {
  const savedRow = {
    configSnapshot: {
      ratioPercent: 50,
    },
    displayAmountLi: 1150n,
    eventTime: new Date('2026-05-08T01:00:00.000Z'),
    gameAppId: 'game-1',
    openId: 'open-1',
    platformEventId: 'event-1',
    rawCostLi: 2300n,
  };

  return {
    auditLogService: {
      record: jest.fn(async () => undefined),
    },
    demoStore: {
      addEcpmRows: jest.fn(async () => [savedRow]),
      listOpenIds: jest.fn(async () => [{ openId: 'open-1' }]),
    },
    ecpmClient: {
      refresh: jest.fn(async () => ({
        rows: [
          {
            eventTime: new Date('2026-05-08T01:00:00.000Z'),
            openId: 'open-1',
            platformEventId: 'event-1',
            rawCostLi: 2300n,
          },
        ],
        source: 'kuaishou' as const,
      })),
    },
    tokenService: {
      markTokenError: jest.fn(async () => undefined),
    },
  };
}
