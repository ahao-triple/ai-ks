import { Logger } from '@nestjs/common';
import { KuaishouEcpmSchedulerService } from './kuaishou-ecpm-scheduler.service';

describe('KuaishouEcpmSchedulerService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('runs due enabled games with the system actor and advances last and next run times', async () => {
    const dependencies = createDependencies([
      createGame({ ecpmAutoSyncIntervalHours: 5 }),
    ]);
    const service = createService(dependencies);

    await service.runDueSyncsOnce();

    expect(dependencies.prisma.game.findMany).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        ecpmAutoSyncEnabled: true,
        ecpmAutoSyncNextRunAt: { lte: now },
      },
    });
    expect(dependencies.syncJobService.hasRunningJob).toHaveBeenCalledWith(
      'app-1',
    );
    expect(dependencies.rangeSyncService.refreshRange).toHaveBeenCalledWith({
      actorId: 'system',
      actorType: 'SYSTEM',
      gameAppId: 'app-1',
      lookbackHours: 5,
      markTokenError: false,
    });
    expect(dependencies.prisma.game.update).toHaveBeenCalledWith({
      data: {
        ecpmAutoSyncLastRunAt: now,
        ecpmAutoSyncNextRunAt: new Date('2026-05-08T11:20:00.000Z'),
      },
      where: {
        id: 'game-1',
      },
    });
  });

  it('skips refresh when a running job already exists and advances only next run', async () => {
    const dependencies = createDependencies([
      createGame({ ecpmAutoSyncIntervalHours: 5 }),
    ]);
    dependencies.syncJobService.hasRunningJob.mockResolvedValueOnce(true);
    const service = createService(dependencies);

    await service.runDueSyncsOnce();

    expect(dependencies.rangeSyncService.refreshRange).not.toHaveBeenCalled();
    expect(dependencies.prisma.game.update).toHaveBeenCalledWith({
      data: {
        ecpmAutoSyncNextRunAt: new Date('2026-05-08T11:20:00.000Z'),
      },
      where: {
        id: 'game-1',
      },
    });
  });

  it('does not throw when automatic refresh fails and still advances last and next run times', async () => {
    const dependencies = createDependencies([
      createGame({ ecpmAutoSyncIntervalHours: 1 }),
    ]);
    dependencies.rangeSyncService.refreshRange.mockRejectedValueOnce(
      new Error('upstream unavailable'),
    );
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const service = createService(dependencies);

    await expect(service.runDueSyncsOnce()).resolves.toBeUndefined();

    expect(dependencies.prisma.game.update).toHaveBeenCalledWith({
      data: {
        ecpmAutoSyncLastRunAt: now,
        ecpmAutoSyncNextRunAt: new Date('2026-05-08T07:20:00.000Z'),
      },
      where: {
        id: 'game-1',
      },
    });
  });

  it('returns immediately while a run is already active', async () => {
    const findManyGate = createDeferred<Array<ReturnType<typeof createGame>>>();
    const dependencies = createDependencies([
      createGame({ ecpmAutoSyncIntervalHours: 5 }),
    ]);
    dependencies.prisma.game.findMany.mockReturnValueOnce(findManyGate.promise);
    const service = createService(dependencies);

    const activeRun = service.runDueSyncsOnce();
    await service.runDueSyncsOnce();

    expect(dependencies.prisma.game.findMany).toHaveBeenCalledTimes(1);
    expect(dependencies.rangeSyncService.refreshRange).not.toHaveBeenCalled();

    findManyGate.resolve([]);
    await activeRun;
  });
});

const now = new Date('2026-05-08T06:20:00.000Z');

function createService(dependencies: ReturnType<typeof createDependencies>) {
  return new KuaishouEcpmSchedulerService(
    dependencies.prisma as any,
    dependencies.rangeSyncService as any,
    dependencies.syncJobService as any,
    () => now,
  );
}

function createDependencies(games: Array<ReturnType<typeof createGame>>) {
  return {
    prisma: {
      game: {
        findMany: jest.fn(async () => games),
        update: jest.fn(async ({ data, where }) => {
          const game = games.find((candidate) => candidate.id === where.id);
          if (!game) {
            throw new Error('game not found');
          }
          Object.assign(game, data);
          return game;
        }),
      },
    },
    rangeSyncService: {
      refreshRange: jest.fn(async () => undefined),
    },
    syncJobService: {
      hasRunningJob: jest.fn(async () => false),
    },
  };
}

function createGame(
  overrides: Partial<{
    deletedAt: Date | null;
    ecpmAutoSyncEnabled: boolean;
    ecpmAutoSyncIntervalHours: number;
    ecpmAutoSyncLastRunAt: Date | null;
    ecpmAutoSyncNextRunAt: Date;
    gameAppId: string;
    id: string;
  }> = {},
) {
  return {
    deletedAt: null,
    ecpmAutoSyncEnabled: true,
    ecpmAutoSyncIntervalHours: 5,
    ecpmAutoSyncLastRunAt: null,
    ecpmAutoSyncNextRunAt: new Date('2026-05-08T06:00:00.000Z'),
    gameAppId: 'app-1',
    id: 'game-1',
    ...overrides,
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, reject, resolve };
}
