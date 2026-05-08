import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { KuaishouRefreshController } from './kuaishou-refresh.controller';

describe('KuaishouRefreshController', () => {
  it('delegates manual lookback refresh to the range sync service', async () => {
    const dependencies = createDependencies();
    const controller = createController(dependencies);

    const result = await controller.refresh(admin, {
      gameAppId: 'game-1',
      lookbackHours: 3,
      openIds: ['open-1', 'open-2'],
    });

    expect(dependencies.rangeSyncService.refreshRange).toHaveBeenCalledWith({
      actorId: 'admin',
      actorType: 'SUPER_ADMIN',
      gameAppId: 'game-1',
      lookbackHours: 3,
      markTokenError: true,
      openIds: ['open-1', 'open-2'],
    });
    expect(result).toEqual(refreshResult);
  });

  it('rejects company admins before refreshing ECPM', async () => {
    const dependencies = createDependencies();
    const controller = createController(dependencies);

    await expect(
      controller.refresh(companyAdmin, {
        gameAppId: 'game-1',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(dependencies.rangeSyncService.refreshRange).not.toHaveBeenCalled();
  });

  it('defaults missing lookbackHours to 1 when delegating refresh', async () => {
    const dependencies = createDependencies();
    const controller = createController(dependencies);

    await controller.refresh(admin, {
      gameAppId: 'game-1',
    });

    expect(dependencies.rangeSyncService.refreshRange).toHaveBeenCalledWith({
      actorId: 'admin',
      actorType: 'SUPER_ADMIN',
      gameAppId: 'game-1',
      lookbackHours: 1,
      markTokenError: true,
      openIds: undefined,
    });
  });

  it('rejects legacy dataHour requests instead of silently ignoring them', async () => {
    const dependencies = createDependencies();
    const controller = createController(dependencies);

    await expect(
      controller.refresh(admin, {
        dataHour: '2026-05-08',
        gameAppId: 'game-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(dependencies.rangeSyncService.refreshRange).not.toHaveBeenCalled();
  });

  it('lists recent ECPM sync jobs filtered by gameAppId', async () => {
    const dependencies = createDependencies();
    const controller = createController(dependencies);

    const result = await controller.jobs('20', 'game-1');

    expect(dependencies.syncJobService.listJobs).toHaveBeenCalledWith({
      gameAppId: 'game-1',
      limit: 20,
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

  it('lists recent ECPM sync jobs with a clamped limit', async () => {
    const dependencies = createDependencies();
    const controller = createController(dependencies);

    const result = await controller.jobs('200');

    expect(dependencies.syncJobService.listJobs).toHaveBeenCalledWith({
      gameAppId: undefined,
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

const companyAdmin = {
  adminId: 'company-admin-1',
  displayName: 'Company Admin',
  role: 'COMPANY_ADMIN' as const,
  username: 'company_admin',
};

const refreshResult = {
  job: {
    id: 'job-1',
    savedCount: 1,
    status: 'SUCCEEDED',
  },
  requestedOpenIds: ['open-1'],
  rows: [],
  savedCount: 1,
  source: 'kuaishou' as const,
};

function createController(dependencies: ReturnType<typeof createDependencies>) {
  return new (KuaishouRefreshController as any)(
    dependencies.rangeSyncService,
    dependencies.syncJobService,
  ) as KuaishouRefreshController;
}

function createDependencies() {
  const syncJob = {
    actorId: 'admin',
    actorType: 'SUPER_ADMIN',
    createdAt: new Date('2026-05-08T00:00:00.000Z'),
    dataHour: '2026-05-08T14:00:00+08:00',
    endedDataHour: '2026-05-08T14:00:00+08:00',
    errorMessage: null,
    finishedAt: new Date('2026-05-08T00:01:00.000Z'),
    gameAppId: 'game-1',
    id: 'job-1',
    lookbackHours: 1,
    requestedOpenIdCount: 1,
    savedCount: 1,
    source: 'kuaishou',
    startedAt: new Date('2026-05-08T00:00:00.000Z'),
    startedDataHour: '2026-05-08T14:00:00+08:00',
    status: 'SUCCEEDED',
    updatedAt: new Date('2026-05-08T00:01:00.000Z'),
  };

  return {
    rangeSyncService: {
      refreshRange: jest.fn(async () => refreshResult),
    },
    syncJobService: {
      listJobs: jest.fn(async () => [syncJob]),
    },
  };
}
