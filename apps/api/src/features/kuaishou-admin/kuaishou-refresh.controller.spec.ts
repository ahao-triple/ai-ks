import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
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

    const result = await controller.jobs(admin, '20', 'game-1');

    expect(dependencies.syncJobService.listJobs).toHaveBeenCalledWith({
      gameAppId: 'game-1',
      gameAppIds: undefined,
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

    const result = await controller.jobs(admin, '200');

    expect(dependencies.syncJobService.listJobs).toHaveBeenCalledWith({
      gameAppId: undefined,
      gameAppIds: undefined,
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

  it('lists only scoped ECPM sync jobs for company admins', async () => {
    const dependencies = createDependencies();
    dependencies.accessControlService.resolveReadScope.mockResolvedValue({
      companyIds: ['company-1'],
      gameAppIds: ['game-1'],
      gameIds: ['game-id-1'],
      isSuperAdmin: false,
    });
    const controller = createController(dependencies);

    await controller.jobs(companyAdmin, '20');

    expect(
      dependencies.accessControlService.resolveReadScope,
    ).toHaveBeenCalledWith(companyAdmin);
    expect(dependencies.syncJobService.listJobs).toHaveBeenCalledWith({
      gameAppId: undefined,
      gameAppIds: ['game-1'],
      limit: 20,
    });
  });

  it('retries failed ECPM sync jobs with their original data-hour range', async () => {
    const dependencies = createDependencies();
    const controller = createController(dependencies);

    const result = await controller.retryJob(admin, 'job-1');

    expect(dependencies.syncJobService.findJobById).toHaveBeenCalledWith(
      'job-1',
    );
    expect(dependencies.rangeSyncService.refreshRange).toHaveBeenCalledWith({
      actorId: 'admin',
      actorType: 'SUPER_ADMIN',
      dataHours: [
        '2026-05-08T12:00:00+08:00',
        '2026-05-08T13:00:00+08:00',
        '2026-05-08T14:00:00+08:00',
      ],
      gameAppId: 'game-1',
      lookbackHours: 3,
      markTokenError: true,
    });
    expect(result).toEqual(refreshResult);
  });

  it('rejects retrying missing ECPM sync jobs', async () => {
    const dependencies = createDependencies();
    dependencies.syncJobService.findJobById.mockResolvedValue(null as any);
    const controller = createController(dependencies);

    await expect(controller.retryJob(admin, 'missing-job')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(dependencies.rangeSyncService.refreshRange).not.toHaveBeenCalled();
  });

  it('rejects retrying successful ECPM sync jobs', async () => {
    const dependencies = createDependencies();
    dependencies.syncJobService.findJobById.mockResolvedValue({
      ...syncJob,
      status: 'SUCCEEDED',
    });
    const controller = createController(dependencies);

    await expect(controller.retryJob(admin, 'job-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(dependencies.rangeSyncService.refreshRange).not.toHaveBeenCalled();
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

const syncJob = {
  actorId: 'admin',
  actorType: 'SUPER_ADMIN',
  createdAt: new Date('2026-05-08T00:00:00.000Z'),
  dataHour: '2026-05-08T14:00:00+08:00',
  endedDataHour: '2026-05-08T14:00:00+08:00',
  errorMessage: 'token expired',
  finishedAt: new Date('2026-05-08T00:01:00.000Z'),
  gameAppId: 'game-1',
  id: 'job-1',
  lookbackHours: 3,
  requestedOpenIdCount: 1,
  savedCount: 0,
  source: null,
  startedAt: new Date('2026-05-08T00:00:00.000Z'),
  startedDataHour: '2026-05-08T12:00:00+08:00',
  status: 'FAILED',
  updatedAt: new Date('2026-05-08T00:01:00.000Z'),
};

function createController(dependencies: ReturnType<typeof createDependencies>) {
  return new (KuaishouRefreshController as any)(
    dependencies.rangeSyncService,
    dependencies.syncJobService,
    dependencies.accessControlService,
  ) as KuaishouRefreshController;
}

function createDependencies() {
  return {
    rangeSyncService: {
      refreshRange: jest.fn(async () => refreshResult),
    },
    syncJobService: {
      findJobById: jest.fn(async () => syncJob),
      listJobs: jest.fn(async () => [
        {
          ...syncJob,
          errorMessage: null,
          lookbackHours: 1,
          savedCount: 1,
          source: 'kuaishou',
          startedDataHour: '2026-05-08T14:00:00+08:00',
          status: 'SUCCEEDED',
        },
      ]),
    },
    accessControlService: {
      resolveReadScope: jest.fn(async (): Promise<any> => ({
        companyIds: undefined,
        gameAppIds: undefined,
        gameIds: undefined,
        isSuperAdmin: true,
      })),
    },
  };
}
