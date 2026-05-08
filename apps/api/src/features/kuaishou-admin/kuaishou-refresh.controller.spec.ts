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
      job: expect.objectContaining({
        id: 'job-1',
        savedCount: 1,
        status: 'SUCCEEDED',
      }),
      requestedOpenIds: ['open-1'],
      savedCount: 1,
      source: 'kuaishou',
    });
    expect(dependencies.syncJobService.startJob).toHaveBeenCalledWith({
      actorId: 'admin',
      actorType: 'SUPER_ADMIN',
      dataHour: '2026-05-08',
      gameAppId: 'game-1',
      requestedOpenIdCount: 1,
    });
    expect(dependencies.syncJobService.completeJob).toHaveBeenCalledWith({
      jobId: 'job-1',
      savedCount: 1,
      source: 'kuaishou',
    });
    expect(dependencies.auditLogService.record).toHaveBeenCalledWith({
      action: 'kuaishou.ecpm_refreshed',
      actorId: 'admin',
      actorType: 'SUPER_ADMIN',
      metadata: {
        dataHour: '2026-05-08',
        jobId: 'job-1',
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
    expect(dependencies.syncJobService.failJob).toHaveBeenCalledWith({
      errorMessage: 'token expired',
      jobId: 'job-1',
    });
    expect(dependencies.auditLogService.record).toHaveBeenCalledWith({
      action: 'kuaishou.ecpm_refresh_failed',
      actorId: 'admin',
      actorType: 'SUPER_ADMIN',
      metadata: {
        dataHour: '2026-05-08',
        error: 'token expired',
        jobId: 'job-1',
        requestedOpenIds: ['open-1'],
      },
      targetId: 'game-1',
      targetType: 'kuaishou_ecpm_refresh',
    });
  });

  it('lists recent ECPM sync jobs with a clamped limit', async () => {
    const dependencies = createDependencies();
    const controller = createController(dependencies);

    const result = await controller.jobs('200');

    expect(dependencies.syncJobService.listJobs).toHaveBeenCalledWith({
      limit: 100,
    });
    expect(result).toEqual({
      jobs: [
        expect.objectContaining({
          id: 'job-1',
          status: 'SUCCEEDED',
        }),
      ],
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
    dependencies.syncJobService,
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
  const syncJob = {
    actorId: 'admin',
    actorType: 'SUPER_ADMIN',
    createdAt: new Date('2026-05-08T00:00:00.000Z'),
    dataHour: '2026-05-08',
    errorMessage: null,
    finishedAt: new Date('2026-05-08T00:01:00.000Z'),
    gameAppId: 'game-1',
    id: 'job-1',
    requestedOpenIdCount: 1,
    savedCount: 1,
    source: 'kuaishou',
    startedAt: new Date('2026-05-08T00:00:00.000Z'),
    status: 'SUCCEEDED',
    updatedAt: new Date('2026-05-08T00:01:00.000Z'),
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
    syncJobService: {
      completeJob: jest.fn(async () => syncJob),
      failJob: jest.fn(async () => ({
        ...syncJob,
        errorMessage: 'token expired',
        status: 'FAILED',
      })),
      listJobs: jest.fn(async () => [syncJob]),
      startJob: jest.fn(async () => ({
        ...syncJob,
        savedCount: 0,
        status: 'RUNNING',
      })),
    },
  };
}
