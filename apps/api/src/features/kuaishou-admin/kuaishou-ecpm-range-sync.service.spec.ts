import { BadRequestException } from '@nestjs/common';
import {
  buildDataDaysBetween,
  buildRecentDataDays,
  KuaishouEcpmRangeSyncService,
} from './kuaishou-ecpm-range-sync.service';

const now = new Date('2026-05-08T06:20:00.000Z'); // 北京时间 2026-05-08 14:20

describe('KuaishouEcpmRangeSyncService', () => {
  it('默认刷新当天（不传 dataDays/openIds 时，整游戏刷一天）', async () => {
    const dependencies = createDependencies();
    const service = createService(dependencies);

    const result = await service.refreshRange({
      actorId: 'admin',
      actorType: 'SUPER_ADMIN',
      gameAppId: 'game-1',
      markTokenError: true,
    });

    const today = '2026-05-08';
    expect(dependencies.demoStore.listOpenIds).not.toHaveBeenCalled();
    expect(dependencies.ecpmClient.refresh).toHaveBeenCalledTimes(1);
    expect(dependencies.ecpmClient.refresh).toHaveBeenCalledWith({
      dataDay: today,
      gameAppId: 'game-1',
      openIds: [],
    });
    expect(dependencies.syncJobService.startJob).toHaveBeenCalledWith({
      actorId: 'admin',
      actorType: 'SUPER_ADMIN',
      dataHour: today,
      endedDataHour: today,
      gameAppId: 'game-1',
      lookbackHours: 1,
      requestedOpenIdCount: 0,
      startedDataHour: today,
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
        dataDays: [today],
        startedDataDay: today,
        endedDataDay: today,
        jobId: 'job-1',
        requestedOpenIds: [],
        savedCount: 3,
        source: 'kuaishou',
      },
      targetId: 'game-1',
      targetType: 'kuaishou_ecpm_refresh',
    });
    expect(result).toMatchObject({
      requestedOpenIds: [],
      savedCount: 3,
      source: 'kuaishou',
    });
  });

  it('显式传 openIds 时按 open_id 子集刷新', async () => {
    const dependencies = createDependencies();
    const service = createService(dependencies);

    await service.refreshRange({
      actorId: 'admin',
      actorType: 'SUPER_ADMIN',
      gameAppId: 'game-1',
      markTokenError: true,
      openIds: ['open-explicit'],
    });

    expect(dependencies.demoStore.listOpenIds).not.toHaveBeenCalled();
    expect(dependencies.ecpmClient.refresh).toHaveBeenCalledWith({
      dataDay: '2026-05-08',
      gameAppId: 'game-1',
      openIds: ['open-explicit'],
    });
  });

  it('支持显式多天 dataDays，按顺序逐天调用', async () => {
    const dependencies = createDependencies();
    const service = createService(dependencies);
    const dataDays = ['2026-05-06', '2026-05-07', '2026-05-08'];

    await service.refreshRange({
      actorId: 'admin',
      actorType: 'SUPER_ADMIN',
      dataDays,
      gameAppId: 'game-1',
      markTokenError: true,
    });

    expect(dependencies.ecpmClient.refresh).toHaveBeenCalledTimes(3);
    dataDays.forEach((dataDay, index) => {
      expect(dependencies.ecpmClient.refresh).toHaveBeenNthCalledWith(
        index + 1,
        {
          dataDay,
          gameAppId: 'game-1',
          openIds: [],
        },
      );
    });
    expect(dependencies.syncJobService.startJob).toHaveBeenCalledWith(
      expect.objectContaining({
        dataHour: '2026-05-08',
        endedDataHour: '2026-05-08',
        startedDataHour: '2026-05-06',
        lookbackHours: 3,
      }),
    );
  });

  it('拒绝非法日期格式', async () => {
    const service = createService(createDependencies());
    await expect(
      service.refreshRange({
        actorId: 'admin',
        actorType: 'SUPER_ADMIN',
        dataDays: ['not-a-date'],
        gameAppId: 'game-1',
        markTokenError: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('拒绝超过 7 天的范围', async () => {
    const service = createService(createDependencies());
    const dataDays = Array.from({ length: 8 }, (_, i) => `2026-05-0${i + 1}`);
    await expect(
      service.refreshRange({
        actorId: 'admin',
        actorType: 'SUPER_ADMIN',
        dataDays,
        gameAppId: 'game-1',
        markTokenError: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('上游 API 失败 + markTokenError=true 时记录 token 错误', async () => {
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
    expect(dependencies.auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'kuaishou.ecpm_refresh_failed',
        metadata: expect.objectContaining({
          error: 'token expired',
          requestedOpenIds: [],
        }),
      }),
    );
  });

  it('上游 API 失败 + markTokenError=false 时不动 token', async () => {
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
        markTokenError: false,
      }),
    ).rejects.toThrow('token expired');

    expect(dependencies.tokenService.markTokenError).not.toHaveBeenCalled();
  });

  it('写库失败时即使 markTokenError=true 也不动 token', async () => {
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
        markTokenError: true,
      }),
    ).rejects.toThrow('database unavailable');

    expect(dependencies.syncJobService.failJob).toHaveBeenCalledWith({
      errorMessage: 'database unavailable',
      jobId: 'job-1',
    });
    expect(dependencies.tokenService.markTokenError).not.toHaveBeenCalled();
  });

  it('completeJob 失败时不再 failJob 也不动 token', async () => {
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
        markTokenError: true,
      }),
    ).rejects.toThrow('job update failed');

    expect(dependencies.syncJobService.failJob).not.toHaveBeenCalled();
    expect(dependencies.tokenService.markTokenError).not.toHaveBeenCalled();
  });

  it('audit 失败时不动 token，但抛带 auditOnly 标记的错误', async () => {
    const dependencies = createDependencies();
    dependencies.auditLogService.record.mockRejectedValueOnce(
      new Error('audit unavailable'),
    );
    const service = createService(dependencies);

    const refresh = service.refreshRange({
      actorId: 'admin',
      actorType: 'SUPER_ADMIN',
      gameAppId: 'game-1',
      markTokenError: true,
    });

    await expect(refresh).rejects.toMatchObject({
      auditOnly: true,
      code: 'AUDIT_LOG_FAILED',
      savedCount: 3,
      source: 'kuaishou',
    });

    expect(dependencies.syncJobService.failJob).not.toHaveBeenCalled();
    expect(dependencies.tokenService.markTokenError).not.toHaveBeenCalled();
  });
});

describe('buildRecentDataDays', () => {
  it('生成含今天在内的最近 N 天（升序）', () => {
    expect(buildRecentDataDays(3, now)).toEqual([
      '2026-05-06',
      '2026-05-07',
      '2026-05-08',
    ]);
  });
});

describe('buildDataDaysBetween', () => {
  it('生成起止之间的所有 YYYY-MM-DD（含两端）', () => {
    expect(buildDataDaysBetween('2026-05-06', '2026-05-08')).toEqual([
      '2026-05-06',
      '2026-05-07',
      '2026-05-08',
    ]);
  });

  it('超过 7 天抛 BadRequestException', () => {
    expect(() =>
      buildDataDaysBetween('2026-05-01', '2026-05-08'),
    ).toThrow(BadRequestException);
  });
});

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
    configSnapshot: { ratioPercent: 50 },
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
    dataHour: '2026-05-08',
    endedDataHour: '2026-05-08',
    errorMessage: null,
    finishedAt: new Date('2026-05-08T06:01:00.000Z'),
    gameAppId: 'game-1',
    id: 'job-1',
    lookbackHours: 1,
    requestedOpenIdCount: 1,
    savedCount: 3,
    source: 'kuaishou',
    startedAt: new Date('2026-05-08T06:00:00.000Z'),
    startedDataHour: '2026-05-08',
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
