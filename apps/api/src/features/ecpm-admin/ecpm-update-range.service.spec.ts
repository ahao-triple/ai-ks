import { BadRequestException } from '@nestjs/common';
import { EcpmUpdateJobStatus } from '@prisma/client';
import { AuditLogService } from '../audit/audit-log.service';
import { KuaishouEcpmRangeSyncService } from '../kuaishou-admin/kuaishou-ecpm-range-sync.service';
import { EcpmUpdateJobService } from './ecpm-update-job.service';
import { EcpmUpdateRangeService } from './ecpm-update-range.service';

describe('EcpmUpdateRangeService', () => {
  it('updates the latest hour for a company by grouping open_ids by game', async () => {
    const { rangeSyncService, service } = createService();

    const job = await service.update({
      actorId: 'admin',
      actorType: 'SUPER_ADMIN',
      mode: 'latest',
      scopeId: 'company-1',
      scopeType: 'company',
    });

    expect(rangeSyncService.refreshRange).toHaveBeenCalledTimes(2);
    expect(rangeSyncService.refreshRange).toHaveBeenNthCalledWith(1, {
      actorId: 'admin',
      actorType: 'SUPER_ADMIN',
      dataHours: ['2026-05-08T14:00:00+08:00'],
      gameAppId: 'game-app-1',
      lookbackHours: 1,
      markTokenError: true,
      openIds: ['open-a', 'open-b'],
    });
    expect(rangeSyncService.refreshRange).toHaveBeenNthCalledWith(2, {
      actorId: 'admin',
      actorType: 'SUPER_ADMIN',
      dataHours: ['2026-05-08T14:00:00+08:00'],
      gameAppId: 'game-app-2',
      lookbackHours: 1,
      markTokenError: true,
      openIds: ['open-c'],
    });
    expect(job).toMatchObject({
      endedDataHour: '2026-05-08T14:00:00+08:00',
      failedCount: 0,
      mode: 'latest',
      requestedGameCount: 2,
      requestedOpenIdCount: 3,
      savedCount: 6,
      scopeId: 'company-1',
      scopeType: 'company',
      skippedCount: 0,
      startedDataHour: '2026-05-08T14:00:00+08:00',
      status: EcpmUpdateJobStatus.SUCCEEDED,
    });
  });

  it('updates an explicit hour range for one game', async () => {
    const { rangeSyncService, service } = createService();

    const job = await service.update({
      ...baseActor(),
      endedDataHour: '2026-05-08T15:00:00+08:00',
      mode: 'range',
      scopeId: 'game-1',
      scopeType: 'game',
      startedDataHour: '2026-05-08T13:00:00+08:00',
    });

    expect(rangeSyncService.refreshRange).toHaveBeenCalledTimes(1);
    expect(rangeSyncService.refreshRange).toHaveBeenCalledWith({
      actorId: 'admin',
      actorType: 'SUPER_ADMIN',
      dataHours: [
        '2026-05-08T13:00:00+08:00',
        '2026-05-08T14:00:00+08:00',
        '2026-05-08T15:00:00+08:00',
      ],
      gameAppId: 'game-app-1',
      lookbackHours: 3,
      markTokenError: true,
      openIds: ['open-a', 'open-b'],
    });
    expect(job).toMatchObject({
      endedDataHour: '2026-05-08T15:00:00+08:00',
      requestedGameCount: 1,
      requestedOpenIdCount: 2,
      savedCount: 3,
      startedDataHour: '2026-05-08T13:00:00+08:00',
      status: EcpmUpdateJobStatus.SUCCEEDED,
    });
  });

  it('updates all open_ids bound to a user grouped by game', async () => {
    const { rangeSyncService, service } = createService();

    const job = await service.update({
      ...baseActor(),
      mode: 'latest',
      scopeId: 'user-1',
      scopeType: 'user',
    });

    expect(rangeSyncService.refreshRange).toHaveBeenCalledTimes(2);
    expect(rangeSyncService.refreshRange).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        gameAppId: 'game-app-1',
        openIds: ['open-a'],
      }),
    );
    expect(rangeSyncService.refreshRange).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        gameAppId: 'game-app-2',
        openIds: ['open-c'],
      }),
    );
    expect(job).toMatchObject({
      requestedGameCount: 2,
      requestedOpenIdCount: 2,
      status: EcpmUpdateJobStatus.SUCCEEDED,
    });
  });

  it('updates one open_id only', async () => {
    const { prisma, rangeSyncService, service } = createService();

    const job = await service.update({
      ...baseActor(),
      mode: 'latest',
      scopeId: 'open-c',
      scopeType: 'open_id',
    });

    expect(rangeSyncService.refreshRange).toHaveBeenCalledTimes(1);
    expect(rangeSyncService.refreshRange).toHaveBeenCalledWith(
      expect.objectContaining({
        gameAppId: 'game-app-2',
        openIds: ['open-c'],
      }),
    );
    expect(prisma.items[0]).toMatchObject({
      gameAppId: 'game-app-2',
      gameId: 'game-2',
      kuaishouSyncJobId: 'sync-job-1',
      openId: 'open-c',
      status: EcpmUpdateJobStatus.SUCCEEDED,
      userId: 'user-1',
    });
    expect(job).toMatchObject({
      requestedGameCount: 1,
      requestedOpenIdCount: 1,
      savedCount: 3,
      status: EcpmUpdateJobStatus.SUCCEEDED,
    });
  });

  it('records a skipped report when the resolved range has no open_ids', async () => {
    const { prisma, rangeSyncService, service } = createService();

    const job = await service.update({
      ...baseActor(),
      mode: 'latest',
      scopeId: 'company-empty',
      scopeType: 'company',
    });

    expect(rangeSyncService.refreshRange).not.toHaveBeenCalled();
    expect(prisma.items).toHaveLength(1);
    expect(prisma.items[0]).toMatchObject({
      dataHour: '2026-05-08T14:00:00+08:00',
      jobId: job.id,
      savedCount: 0,
      skipReason: 'NO_OPEN_IDS',
      status: EcpmUpdateJobStatus.SUCCEEDED,
    });
    expect(prisma.items[0].errorMessage).toBeNull();
    expect(job).toMatchObject({
      failedCount: 0,
      requestedGameCount: 0,
      requestedOpenIdCount: 0,
      skippedCount: 1,
      status: EcpmUpdateJobStatus.SUCCEEDED,
    });
  });

  it('rejects ranges longer than 24 hours', async () => {
    const { prisma, rangeSyncService, service } = createService();

    await expect(
      service.update({
        ...baseActor(),
        endedDataHour: '2026-05-08T00:00:00+08:00',
        mode: 'range',
        scopeId: 'game-1',
        scopeType: 'game',
        startedDataHour: '2026-05-07T00:00:00+08:00',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(rangeSyncService.refreshRange).not.toHaveBeenCalled();
    expect(prisma.jobs).toHaveLength(0);
    expect(prisma.items).toHaveLength(0);
  });

  it('rejects invalid calendar data-hour range values', async () => {
    const { prisma, rangeSyncService, service } = createService();

    await expect(
      service.update({
        ...baseActor(),
        endedDataHour: '2026-03-02T01:00:00+08:00',
        mode: 'range',
        scopeId: 'game-1',
        scopeType: 'game',
        startedDataHour: '2026-02-30T00:00:00+08:00',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(rangeSyncService.refreshRange).not.toHaveBeenCalled();
    expect(prisma.jobs).toHaveLength(0);
    expect(prisma.items).toHaveLength(0);
  });

  it('rejects non-hour data-hour range values', async () => {
    const { prisma, rangeSyncService, service } = createService();

    await expect(
      service.update({
        ...baseActor(),
        endedDataHour: '2026-05-08T14:00:00+08:00',
        mode: 'range',
        scopeId: 'game-1',
        scopeType: 'game',
        startedDataHour: '2026-05-08T13:30:00+08:00',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(rangeSyncService.refreshRange).not.toHaveBeenCalled();
    expect(prisma.jobs).toHaveLength(0);
    expect(prisma.items).toHaveLength(0);
  });

  it('rejects non-China-offset data-hour range values', async () => {
    const { prisma, rangeSyncService, service } = createService();

    await expect(
      service.update({
        ...baseActor(),
        endedDataHour: '2026-05-08T14:00:00+08:00',
        mode: 'range',
        scopeId: 'game-1',
        scopeType: 'game',
        startedDataHour: '2026-05-08T05:00:00Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(rangeSyncService.refreshRange).not.toHaveBeenCalled();
    expect(prisma.jobs).toHaveLength(0);
    expect(prisma.items).toHaveLength(0);
  });

  it('finishes a company job as partial when one game refresh fails', async () => {
    const { prisma, rangeSyncService, service } = createService();
    rangeSyncService.refreshRange
      .mockResolvedValueOnce(syncResult('sync-job-ok', 4))
      .mockRejectedValueOnce(new Error('kuaishou timeout'));

    const job = await service.update({
      ...baseActor(),
      mode: 'latest',
      scopeId: 'company-1',
      scopeType: 'company',
    });

    expect(rangeSyncService.refreshRange).toHaveBeenCalledTimes(2);
    expect(prisma.items).toHaveLength(2);
    expect(prisma.items[0]).toMatchObject({
      errorMessage: null,
      gameId: 'game-1',
      savedCount: 4,
      status: EcpmUpdateJobStatus.SUCCEEDED,
    });
    expect(prisma.items[1]).toMatchObject({
      errorMessage: 'kuaishou timeout',
      gameId: 'game-2',
      savedCount: 0,
      skipReason: null,
      status: EcpmUpdateJobStatus.FAILED,
    });
    expect(job).toMatchObject({
      failedCount: 1,
      savedCount: 4,
      skippedCount: 0,
      status: EcpmUpdateJobStatus.PARTIAL,
    });
  });

  it('does not record a hard failed item for delegated audit-only failures', async () => {
    const { prisma, rangeSyncService, service } = createService();
    const error = new Error('kuaishou audit unavailable') as Error & {
      auditOnly: boolean;
    };
    error.auditOnly = true;
    rangeSyncService.refreshRange.mockRejectedValueOnce(error);

    const job = await service.update({
      ...baseActor(),
      mode: 'latest',
      scopeId: 'game-1',
      scopeType: 'game',
    });

    expect(prisma.items).toHaveLength(1);
    expect(prisma.items[0]).toMatchObject({
      errorMessage: 'kuaishou audit unavailable',
      gameId: 'game-1',
      savedCount: 0,
      skipReason: null,
      status: EcpmUpdateJobStatus.SUCCEEDED,
    });
    expect(job).toMatchObject({
      failedCount: 0,
      status: EcpmUpdateJobStatus.SUCCEEDED,
    });
  });

  it('records an audit log with scope, hours, counts, and job id', async () => {
    const { auditLogService, service } = createService();

    const job = await service.update({
      ...baseActor(),
      endedDataHour: '2026-05-08T15:00:00+08:00',
      mode: 'range',
      scopeId: 'game-1',
      scopeType: 'game',
      startedDataHour: '2026-05-08T13:00:00+08:00',
    });

    expect(auditLogService.record).toHaveBeenCalledWith({
      action: 'ecpm.update_finished',
      actorId: 'admin',
      actorType: 'SUPER_ADMIN',
      metadata: {
        endedDataHour: '2026-05-08T15:00:00+08:00',
        failedCount: 0,
        jobId: job.id,
        mode: 'range',
        requestedGameCount: 1,
        requestedOpenIdCount: 2,
        savedCount: 3,
        scopeId: 'game-1',
        scopeType: 'game',
        skippedCount: 0,
        startedDataHour: '2026-05-08T13:00:00+08:00',
      },
      targetId: job.id,
      targetType: 'ecpm_update_job',
    });
  });

  it('returns the finished job when final aggregate audit logging fails', async () => {
    const { auditLogService, service } = createService();
    auditLogService.record.mockRejectedValueOnce(
      new Error('audit database unavailable'),
    );

    const job = await service.update({
      ...baseActor(),
      mode: 'latest',
      scopeId: 'game-1',
      scopeType: 'game',
    });

    expect(auditLogService.record).toHaveBeenCalledTimes(1);
    expect(job).toMatchObject({
      failedCount: 0,
      requestedGameCount: 1,
      requestedOpenIdCount: 2,
      savedCount: 3,
      status: EcpmUpdateJobStatus.SUCCEEDED,
    });
  });

  it('retries a failed aggregate job with the original scope and hour range', async () => {
    const { prisma, rangeSyncService, service } = createService();
    rangeSyncService.refreshRange
      .mockRejectedValueOnce(new Error('first game failed'))
      .mockRejectedValueOnce(new Error('second game failed'));
    const failedJob = await service.update({
      ...baseActor(),
      endedDataHour: '2026-05-08T15:00:00+08:00',
      mode: 'range',
      scopeId: 'company-1',
      scopeType: 'company',
      startedDataHour: '2026-05-08T13:00:00+08:00',
    });
    rangeSyncService.refreshRange.mockClear();
    rangeSyncService.refreshRange.mockResolvedValue(syncResult('sync-retry', 2));

    const retryJob = await service.retry(failedJob.id, {
      actorId: 'admin-retry',
      actorType: 'SUPER_ADMIN',
    });

    expect(failedJob).toMatchObject({
      failedCount: 2,
      status: EcpmUpdateJobStatus.FAILED,
    });
    expect(rangeSyncService.refreshRange).toHaveBeenCalledTimes(2);
    expect(rangeSyncService.refreshRange).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        actorId: 'admin-retry',
        dataHours: [
          '2026-05-08T13:00:00+08:00',
          '2026-05-08T14:00:00+08:00',
          '2026-05-08T15:00:00+08:00',
        ],
        gameAppId: 'game-app-1',
        openIds: ['open-a', 'open-b'],
      }),
    );
    expect(retryJob).toMatchObject({
      actorId: 'admin-retry',
      mode: 'range',
      scopeId: 'company-1',
      scopeType: 'company',
      startedDataHour: '2026-05-08T13:00:00+08:00',
      status: EcpmUpdateJobStatus.SUCCEEDED,
    });
    expect(prisma.jobs).toHaveLength(2);
  });
});

const now = new Date('2026-05-08T06:20:00.000Z');

function baseActor() {
  return {
    actorId: 'admin',
    actorType: 'SUPER_ADMIN',
  };
}

function createService() {
  const prisma = createFakePrisma();
  const rangeSyncService = {
    refreshRange: jest.fn(async () => syncResult()),
  };
  const updateJobService = new EcpmUpdateJobService(prisma);
  const auditLogService = {
    record: jest.fn(async (input) => ({ id: 'audit-1', ...input })),
  };
  const service = new EcpmUpdateRangeService(
    prisma,
    rangeSyncService as unknown as KuaishouEcpmRangeSyncService,
    updateJobService,
    auditLogService as unknown as AuditLogService,
    () => now,
  );

  return {
    auditLogService,
    prisma,
    rangeSyncService,
    service,
  };
}

function syncResult(jobId = 'sync-job-1', savedCount = 3) {
  return {
    job: {
      id: jobId,
      status: 'SUCCEEDED',
    },
    requestedOpenIds: [],
    rows: [],
    savedCount,
    source: 'mock',
  };
}

function createFakePrisma() {
  const games = [
    gameRecord('game-1', 'company-1', 'game-app-1'),
    gameRecord('game-2', 'company-1', 'game-app-2'),
    gameRecord('game-3', 'company-empty', 'game-app-3'),
    {
      ...gameRecord('game-deleted', 'company-1', 'game-app-deleted'),
      deletedAt: new Date('2026-05-01T00:00:00.000Z'),
    },
  ];
  const openIds = [
    openIdRecord('open-id-1', 'game-1', 'open-a', 'user-1'),
    openIdRecord('open-id-2', 'game-1', 'open-b', 'user-2'),
    openIdRecord('open-id-3', 'game-2', 'open-c', 'user-1'),
    openIdRecord('open-id-deleted', 'game-deleted', 'open-deleted', 'user-1'),
  ];
  const jobs: any[] = [];
  const items: any[] = [];

  const prisma = {
    games,
    items,
    jobs,
    ecpmUpdateJob: {
      create: jest.fn(async ({ data }: any) => {
        const date = new Date(now.getTime() + jobs.length * 1000);
        const row = {
          actorId: data.actorId,
          actorType: data.actorType,
          createdAt: date,
          endedDataHour: data.endedDataHour,
          errorMessage: null,
          failedCount: data.failedCount ?? 0,
          finishedAt: null,
          id: `job-${jobs.length + 1}`,
          mode: data.mode,
          requestedGameCount: data.requestedGameCount,
          requestedOpenIdCount: data.requestedOpenIdCount,
          savedCount: data.savedCount ?? 0,
          scopeId: data.scopeId,
          scopeType: data.scopeType,
          skippedCount: data.skippedCount ?? 0,
          startedAt: date,
          startedDataHour: data.startedDataHour,
          status: data.status,
          updatedAt: date,
        };
        jobs.push(row);

        return row;
      }),
      findUnique: jest.fn(async (args: any) => {
        const job = jobs.find((row) => row.id === args.where.id);
        if (!job) {
          return null;
        }

        return withJobIncludes(job, args.include, items);
      }),
      update: jest.fn(async ({ data, where }: any) => {
        const index = jobs.findIndex((row) => row.id === where.id);
        if (index === -1) {
          throw new Error('job not found');
        }
        jobs[index] = {
          ...jobs[index],
          ...data,
          updatedAt: now,
        };

        return jobs[index];
      }),
    },
    ecpmUpdateJobItem: {
      create: jest.fn(async ({ data }: any) => {
        const date = new Date(now.getTime() + items.length * 1000);
        const row = {
          createdAt: date,
          dataHour: data.dataHour,
          errorMessage: data.errorMessage ?? null,
          gameAppId: data.gameAppId ?? null,
          gameId: data.gameId ?? null,
          id: `item-${items.length + 1}`,
          jobId: data.jobId,
          kuaishouSyncJobId: data.kuaishouSyncJobId ?? null,
          openId: data.openId ?? null,
          savedCount: data.savedCount ?? 0,
          skipReason: data.skipReason ?? null,
          status: data.status,
          updatedAt: date,
          userId: data.userId ?? null,
        };
        items.push(row);

        return row;
      }),
    },
    game: {
      findFirst: jest.fn(async (args: any) => {
        const game = games.find(
          (row) =>
            matchesValue(row.id, args.where?.id) &&
            matchesValue(row.deletedAt, args.where?.deletedAt),
        );

        return game ? withGameIncludes(game, args.include, openIds) : null;
      }),
      findMany: jest.fn(async (args: any) =>
        games
          .filter(
            (game) =>
              matchesValue(game.companyId, args.where?.companyId) &&
              matchesValue(game.deletedAt, args.where?.deletedAt),
          )
          .map((game) => withGameIncludes(game, args.include, openIds)),
      ),
    },
    gameOpenId: {
      findFirst: jest.fn(async (args: any) => {
        const record = openIds.find(
          (row) =>
            matchesValue(row.openId, args.where?.openId) &&
            matchesGameRelation(row.gameId, args.where?.game, games),
        );

        return record ? withOpenIdIncludes(record, args.include, games) : null;
      }),
      findMany: jest.fn(async (args: any) =>
        openIds
          .filter(
            (row) =>
              matchesValue(row.userId, args.where?.userId) &&
              matchesGameRelation(row.gameId, args.where?.game, games),
          )
          .map((row) => withOpenIdIncludes(row, args.include, games)),
      ),
    },
  };

  return prisma as any;
}

function gameRecord(id: string, companyId: string, gameAppId: string) {
  return {
    companyId,
    deletedAt: null,
    gameAppId,
    id,
    name: `${id} name`,
  };
}

function openIdRecord(
  id: string,
  gameId: string,
  openId: string,
  userId: string | null,
) {
  return {
    createdAt: now,
    gameId,
    id,
    openId,
    userId,
  };
}

function withGameIncludes(game: any, include: any, openIds: any[]) {
  if (!include?.openIds) {
    return { ...game };
  }

  return {
    ...game,
    openIds: openIds.filter((row) => row.gameId === game.id),
  };
}

function withOpenIdIncludes(record: any, include: any, games: any[]) {
  if (!include?.game) {
    return { ...record };
  }

  return {
    ...record,
    game: games.find((game) => game.id === record.gameId) ?? null,
  };
}

function withJobIncludes(job: any, include: any, items: any[]) {
  const includedJob = { ...job };

  if (include?._count) {
    includedJob._count = {
      items: items.filter((item) => item.jobId === job.id).length,
    };
  }

  if (include?.items) {
    includedJob.items = items
      .filter((item) => item.jobId === job.id)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  return includedJob;
}

function matchesValue(actual: unknown, expected: unknown) {
  if (expected === undefined) {
    return true;
  }

  return actual === expected;
}

function matchesGameRelation(
  gameId: string,
  where: { deletedAt?: Date | null } | undefined,
  games: any[],
) {
  if (!where) {
    return true;
  }

  const game = games.find((row) => row.id === gameId);
  if (!game) {
    return false;
  }

  return matchesValue(game.deletedAt, where.deletedAt);
}
