import { BadRequestException } from '@nestjs/common';
import {
  buildRecentDataHours,
  KuaishouEcpmRangeSyncService,
} from './kuaishou-ecpm-range-sync.service';

describe('KuaishouEcpmRangeSyncService', () => {
  it('splits lookback 5 into hourly China dataHour points and saves combined rows', async () => {
    const dependencies = createDependencies();
    const service = createService(dependencies);

    const result = await service.refreshRange({
      actorId: 'admin',
      actorType: 'SUPER_ADMIN',
      gameAppId: 'game-1',
      lookbackHours: 5,
      markTokenError: true,
    });

    const dataHours = [
      '2026-05-08T10:00:00+08:00',
      '2026-05-08T11:00:00+08:00',
      '2026-05-08T12:00:00+08:00',
      '2026-05-08T13:00:00+08:00',
      '2026-05-08T14:00:00+08:00',
    ];
    expect(buildRecentDataHours(5, now)).toEqual(dataHours);
    expect(dependencies.ecpmClient.refresh).toHaveBeenCalledTimes(5);
    dataHours.forEach((dataHour, index) => {
      expect(dependencies.ecpmClient.refresh).toHaveBeenNthCalledWith(index + 1, {
        dataHour,
        gameAppId: 'game-1',
        openIds: ['open-1'],
      });
    });
    expect(dependencies.syncJobService.startJob).toHaveBeenCalledWith({
      actorId: 'admin',
      actorType: 'SUPER_ADMIN',
      dataHour: dataHours[4],
      endedDataHour: dataHours[4],
      gameAppId: 'game-1',
      lookbackHours: 5,
      requestedOpenIdCount: 1,
      startedDataHour: dataHours[0],
    });
    expect(dependencies.demoStore.addEcpmRows).toHaveBeenCalledWith({
      gameAppId: 'game-1',
      rows: [
        expect.objectContaining({ platformEventId: 'event-1' }),
        expect.objectContaining({ platformEventId: 'event-2' }),
        expect.objectContaining({ platformEventId: 'event-3' }),
        expect.objectContaining({ platformEventId: 'event-4' }),
        expect.objectContaining({ platformEventId: 'event-5' }),
      ],
    });
    expect(dependencies.syncJobService.completeJob).toHaveBeenCalledWith({
      jobId: 'job-1',
      savedCount: 3,
      source: 'kuaishou',
    });
    expect(dependencies.auditLogService.record).toHaveBeenCalledWith({
      action: 'kuaishou.ecpm_refreshed',
      actorId: 'admin',
      actorType: 'SUPER_ADMIN',
      metadata: {
        dataHours,
        startedDataHour: dataHours[0],
        endedDataHour: dataHours[4],
        lookbackHours: 5,
        jobId: 'job-1',
        requestedOpenIds: ['open-1'],
        savedCount: 3,
        source: 'kuaishou',
      },
      targetId: 'game-1',
      targetType: 'kuaishou_ecpm_refresh',
    });
    expect(result).toMatchObject({
      job: expect.objectContaining({
        id: 'job-1',
        savedCount: 3,
        status: 'SUCCEEDED',
      }),
      requestedOpenIds: ['open-1'],
      savedCount: 3,
      source: 'kuaishou',
    });
    expect(result.rows).toHaveLength(3);
  });

  it('uses explicit openIds when provided and does not list known openIds', async () => {
    const dependencies = createDependencies();
    const service = createService(dependencies);

    await service.refreshRange({
      actorId: 'admin',
      actorType: 'SUPER_ADMIN',
      gameAppId: 'game-1',
      lookbackHours: 1,
      markTokenError: true,
      openIds: ['open-explicit'],
    });

    expect(dependencies.demoStore.listOpenIds).not.toHaveBeenCalled();
    expect(dependencies.ecpmClient.refresh).toHaveBeenCalledWith({
      dataHour: '2026-05-08T14:00:00+08:00',
      gameAppId: 'game-1',
      openIds: ['open-explicit'],
    });
  });

  it('uses explicit data hours when retrying a failed sync job', async () => {
    const dependencies = createDependencies();
    const service = createService(dependencies);
    const dataHours = [
      '2026-05-08T09:00:00+08:00',
      '2026-05-08T10:00:00+08:00',
    ];

    await service.refreshRange({
      actorId: 'admin',
      actorType: 'SUPER_ADMIN',
      dataHours,
      gameAppId: 'game-1',
      lookbackHours: 5,
      markTokenError: true,
    });

    expect(dependencies.ecpmClient.refresh).toHaveBeenCalledTimes(2);
    expect(dependencies.ecpmClient.refresh).toHaveBeenNthCalledWith(1, {
      dataHour: dataHours[0],
      gameAppId: 'game-1',
      openIds: ['open-1'],
    });
    expect(dependencies.ecpmClient.refresh).toHaveBeenNthCalledWith(2, {
      dataHour: dataHours[1],
      gameAppId: 'game-1',
      openIds: ['open-1'],
    });
    expect(dependencies.syncJobService.startJob).toHaveBeenCalledWith({
      actorId: 'admin',
      actorType: 'SUPER_ADMIN',
      dataHour: dataHours[1],
      endedDataHour: dataHours[1],
      gameAppId: 'game-1',
      lookbackHours: 5,
      requestedOpenIdCount: 1,
      startedDataHour: dataHours[0],
    });
    expect(dependencies.auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          dataHours,
          endedDataHour: dataHours[1],
          startedDataHour: dataHours[0],
        }),
      }),
    );
  });

  it('uses explicit empty openIds and does not list known openIds', async () => {
    const dependencies = createDependencies();
    const service = createService(dependencies);

    const result = await service.refreshRange({
      actorId: 'admin',
      actorType: 'SUPER_ADMIN',
      gameAppId: 'game-1',
      lookbackHours: 1,
      markTokenError: true,
      openIds: [],
    });

    expect(dependencies.demoStore.listOpenIds).not.toHaveBeenCalled();
    expect(dependencies.syncJobService.startJob).toHaveBeenCalledWith({
      actorId: 'admin',
      actorType: 'SUPER_ADMIN',
      dataHour: '2026-05-08T14:00:00+08:00',
      endedDataHour: '2026-05-08T14:00:00+08:00',
      gameAppId: 'game-1',
      lookbackHours: 1,
      requestedOpenIdCount: 0,
      startedDataHour: '2026-05-08T14:00:00+08:00',
    });
    expect(dependencies.ecpmClient.refresh).toHaveBeenCalledWith({
      dataHour: '2026-05-08T14:00:00+08:00',
      gameAppId: 'game-1',
      openIds: [],
    });
    expect(result.requestedOpenIds).toEqual([]);
  });

  it('rejects unsupported lookback hours', async () => {
    const service = createService(createDependencies());

    await expect(
      service.refreshRange({
        actorId: 'admin',
        actorType: 'SUPER_ADMIN',
        gameAppId: 'game-1',
        lookbackHours: 2,
        markTokenError: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('fails job and marks token errors when upstream refresh fails and markTokenError is true', async () => {
    const dependencies = createDependencies();
    dependencies.ecpmClient.refresh.mockRejectedValueOnce(
      new Error('token expired'),
    );
    const service = createService(dependencies);

    await expect(
      service.refreshRange({
        actorId: 'admin',
        actorType: 'SUPER_ADMIN',
        gameAppId: 'game-1',
        lookbackHours: 1,
        markTokenError: true,
      }),
    ).rejects.toThrow('token expired');

    expect(dependencies.syncJobService.failJob).toHaveBeenCalledWith({
      errorMessage: 'token expired',
      jobId: 'job-1',
    });
    expect(dependencies.tokenService.markTokenError).toHaveBeenCalledWith(
      'token expired',
    );
    expect(dependencies.auditLogService.record).toHaveBeenCalledWith({
      action: 'kuaishou.ecpm_refresh_failed',
      actorId: 'admin',
      actorType: 'SUPER_ADMIN',
      metadata: expect.objectContaining({
        dataHours: ['2026-05-08T14:00:00+08:00'],
        error: 'token expired',
        jobId: 'job-1',
        requestedOpenIds: ['open-1'],
      }),
      targetId: 'game-1',
      targetType: 'kuaishou_ecpm_refresh',
    });
  });

  it('fails job without marking token errors when upstream refresh fails and markTokenError is false', async () => {
    const dependencies = createDependencies();
    dependencies.ecpmClient.refresh.mockRejectedValueOnce(
      new Error('token expired'),
    );
    const service = createService(dependencies);

    await expect(
      service.refreshRange({
        actorId: 'system',
        actorType: 'system',
        gameAppId: 'game-1',
        lookbackHours: 1,
        markTokenError: false,
      }),
    ).rejects.toThrow('token expired');

    expect(dependencies.syncJobService.failJob).toHaveBeenCalledWith({
      errorMessage: 'token expired',
      jobId: 'job-1',
    });
    expect(dependencies.tokenService.markTokenError).not.toHaveBeenCalled();
    expect(dependencies.auditLogService.record).toHaveBeenCalledWith({
      action: 'kuaishou.ecpm_refresh_failed',
      actorId: 'system',
      actorType: 'system',
      metadata: expect.objectContaining({
        dataHours: ['2026-05-08T14:00:00+08:00'],
        error: 'token expired',
        jobId: 'job-1',
        requestedOpenIds: ['open-1'],
      }),
      targetId: 'game-1',
      targetType: 'kuaishou_ecpm_refresh',
    });
  });

  it('fails job without marking token errors when save fails and markTokenError is false', async () => {
    const dependencies = createDependencies();
    dependencies.demoStore.addEcpmRows.mockRejectedValueOnce(
      new Error('database unavailable'),
    );
    const service = createService(dependencies);

    await expect(
      service.refreshRange({
        actorId: 'system',
        actorType: 'system',
        gameAppId: 'game-1',
        lookbackHours: 1,
        markTokenError: false,
      }),
    ).rejects.toThrow('database unavailable');

    expect(dependencies.syncJobService.failJob).toHaveBeenCalledWith({
      errorMessage: 'database unavailable',
      jobId: 'job-1',
    });
    expect(dependencies.tokenService.markTokenError).not.toHaveBeenCalled();
    expect(dependencies.auditLogService.record).toHaveBeenCalledWith({
      action: 'kuaishou.ecpm_refresh_failed',
      actorId: 'system',
      actorType: 'system',
      metadata: expect.objectContaining({
        dataHours: ['2026-05-08T14:00:00+08:00'],
        error: 'database unavailable',
        jobId: 'job-1',
        requestedOpenIds: ['open-1'],
      }),
      targetId: 'game-1',
      targetType: 'kuaishou_ecpm_refresh',
    });
  });

  it('does not mark token errors when save fails even if markTokenError is true', async () => {
    const dependencies = createDependencies();
    dependencies.demoStore.addEcpmRows.mockRejectedValueOnce(
      new Error('database unavailable'),
    );
    const service = createService(dependencies);

    await expect(
      service.refreshRange({
        actorId: 'admin',
        actorType: 'SUPER_ADMIN',
        gameAppId: 'game-1',
        lookbackHours: 1,
        markTokenError: true,
      }),
    ).rejects.toThrow('database unavailable');

    expect(dependencies.syncJobService.failJob).toHaveBeenCalledWith({
      errorMessage: 'database unavailable',
      jobId: 'job-1',
    });
    expect(dependencies.tokenService.markTokenError).not.toHaveBeenCalled();
    expect(dependencies.auditLogService.record).toHaveBeenCalledWith({
      action: 'kuaishou.ecpm_refresh_failed',
      actorId: 'admin',
      actorType: 'SUPER_ADMIN',
      metadata: expect.objectContaining({
        dataHours: ['2026-05-08T14:00:00+08:00'],
        error: 'database unavailable',
        jobId: 'job-1',
        requestedOpenIds: ['open-1'],
      }),
      targetId: 'game-1',
      targetType: 'kuaishou_ecpm_refresh',
    });
  });

  it('does not fail job or mark token errors when job completion fails after rows are saved', async () => {
    const dependencies = createDependencies();
    dependencies.syncJobService.completeJob.mockRejectedValueOnce(
      new Error('job update failed'),
    );
    const service = createService(dependencies);

    await expect(
      service.refreshRange({
        actorId: 'admin',
        actorType: 'SUPER_ADMIN',
        gameAppId: 'game-1',
        lookbackHours: 1,
        markTokenError: true,
      }),
    ).rejects.toThrow('job update failed');

    expect(dependencies.demoStore.addEcpmRows).toHaveBeenCalledWith({
      gameAppId: 'game-1',
      rows: [expect.objectContaining({ platformEventId: 'event-1' })],
    });
    expect(dependencies.syncJobService.failJob).not.toHaveBeenCalled();
    expect(dependencies.tokenService.markTokenError).not.toHaveBeenCalled();
    expect(dependencies.auditLogService.record).not.toHaveBeenCalled();
  });

  it('does not fail job or mark token errors when success audit fails after rows are saved', async () => {
    const dependencies = createDependencies();
    dependencies.auditLogService.record.mockRejectedValueOnce(
      new Error('audit unavailable'),
    );
    const service = createService(dependencies);

    const refresh = service.refreshRange({
      actorId: 'admin',
      actorType: 'SUPER_ADMIN',
      gameAppId: 'game-1',
      lookbackHours: 1,
      markTokenError: true,
    });

    await expect(refresh).rejects.toThrow('audit unavailable');
    await expect(refresh).rejects.toMatchObject({
      auditOnly: true,
      code: 'AUDIT_LOG_FAILED',
      completedJob: expect.objectContaining({
        id: 'job-1',
        savedCount: 3,
        status: 'SUCCEEDED',
      }),
      message: 'audit unavailable',
      savedCount: 3,
      source: 'kuaishou',
    });

    expect(dependencies.demoStore.addEcpmRows).toHaveBeenCalled();
    expect(dependencies.syncJobService.completeJob).toHaveBeenCalledWith({
      jobId: 'job-1',
      savedCount: 3,
      source: 'kuaishou',
    });
    expect(dependencies.syncJobService.failJob).not.toHaveBeenCalled();
    expect(dependencies.tokenService.markTokenError).not.toHaveBeenCalled();
  });
});

const now = new Date('2026-05-08T06:20:00.000Z');

function createService(dependencies: ReturnType<typeof createDependencies>) {
  return new (KuaishouEcpmRangeSyncService as any)(
    dependencies.demoStore,
    dependencies.ecpmClient,
    dependencies.auditLogService,
    dependencies.tokenService,
    dependencies.syncJobService,
    () => now,
  ) as KuaishouEcpmRangeSyncService;
}

function createDependencies() {
  const savedRows = [1, 2, 3].map((index) => ({
    configSnapshot: {
      ratioPercent: 50,
    },
    displayAmountLi: BigInt(1000 + index),
    eventTime: new Date(`2026-05-08T0${index}:00:00.000Z`),
    gameAppId: 'game-1',
    openId: 'open-1',
    platformEventId: `event-${index}`,
    rawCostLi: BigInt(2000 + index),
  }));
  const completedJob = {
    actorId: 'admin',
    actorType: 'SUPER_ADMIN',
    createdAt: new Date('2026-05-08T06:00:00.000Z'),
    dataHour: '2026-05-08T14:00:00+08:00',
    endedDataHour: '2026-05-08T14:00:00+08:00',
    errorMessage: null,
    finishedAt: new Date('2026-05-08T06:01:00.000Z'),
    gameAppId: 'game-1',
    id: 'job-1',
    lookbackHours: 1,
    requestedOpenIdCount: 1,
    savedCount: 3,
    source: 'kuaishou',
    startedAt: new Date('2026-05-08T06:00:00.000Z'),
    startedDataHour: '2026-05-08T14:00:00+08:00',
    status: 'SUCCEEDED',
    updatedAt: new Date('2026-05-08T06:01:00.000Z'),
  };
  let refreshCount = 0;

  return {
    auditLogService: {
      record: jest.fn(async () => undefined),
    },
    demoStore: {
      addEcpmRows: jest.fn(async () => savedRows),
      listOpenIds: jest.fn(async () => [{ openId: 'open-1' }]),
    },
    ecpmClient: {
      refresh: jest.fn(async () => {
        refreshCount += 1;
        return {
          rows: [
            {
              eventTime: new Date(`2026-05-08T0${refreshCount}:00:00.000Z`),
              openId: 'open-1',
              platformEventId: `event-${refreshCount}`,
              rawCostLi: BigInt(2000 + refreshCount),
            },
          ],
          source: 'kuaishou' as const,
        };
      }),
    },
    syncJobService: {
      completeJob: jest.fn(async () => completedJob),
      failJob: jest.fn(async () => ({
        ...completedJob,
        errorMessage: 'token expired',
        status: 'FAILED',
      })),
      startJob: jest.fn(async () => ({
        ...completedJob,
        savedCount: 0,
        status: 'RUNNING',
      })),
    },
    tokenService: {
      markTokenError: jest.fn(async () => undefined),
    },
  };
}
