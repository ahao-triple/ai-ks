import { KuaishouEcpmSyncJobStatus } from '@prisma/client';
import {
  KuaishouEcpmSyncJobService,
  presentKuaishouEcpmSyncJob,
} from './kuaishou-ecpm-sync-job.service';

describe('KuaishouEcpmSyncJobService', () => {
  it('starts running sync jobs with actor and request summary', async () => {
    const { prisma, service } = createService();

    const job = await service.startJob({
      actorId: 'admin',
      actorType: 'SUPER_ADMIN',
      dataHour: '2026-05-08',
      endedDataHour: '2026-05-08T02',
      gameAppId: 'game-1',
      lookbackHours: 24,
      requestedOpenIdCount: 2,
      startedDataHour: '2026-05-07T03',
    });

    expect(job).toMatchObject({
      actorId: 'admin',
      actorType: 'SUPER_ADMIN',
      dataHour: '2026-05-08',
      endedDataHour: '2026-05-08T02',
      gameAppId: 'game-1',
      lookbackHours: 24,
      requestedOpenIdCount: 2,
      savedCount: 0,
      startedDataHour: '2026-05-07T03',
      status: KuaishouEcpmSyncJobStatus.RUNNING,
    });
    expect(prisma.rows).toHaveLength(1);
  });

  it('completes sync jobs with source, saved count, and finish time', async () => {
    const { service } = createService();
    const job = await service.startJob(baseStartInput());

    const completed = await service.completeJob({
      jobId: job.id,
      savedCount: 3,
      source: 'kuaishou',
    });

    expect(completed).toMatchObject({
      savedCount: 3,
      source: 'kuaishou',
      status: KuaishouEcpmSyncJobStatus.SUCCEEDED,
      finishedAt: now,
    });
  });

  it('fails sync jobs with an error message and finish time', async () => {
    const { service } = createService();
    const job = await service.startJob(baseStartInput());

    const failed = await service.failJob({
      errorMessage: 'token expired',
      jobId: job.id,
    });

    expect(failed).toMatchObject({
      errorMessage: 'token expired',
      status: KuaishouEcpmSyncJobStatus.FAILED,
      finishedAt: now,
    });
  });

  it('lists recent sync jobs newest first with clamped limits', async () => {
    const { prisma, service } = createService();
    await service.startJob({ ...baseStartInput(), gameAppId: 'game-1' });
    await service.startJob({ ...baseStartInput(), gameAppId: 'game-2' });

    const result = await service.listJobs({
      gameAppIds: undefined,
      limit: 200,
    });

    expect(result).toHaveLength(2);
    expect(result[0].gameAppId).toBe('game-2');
    expect(prisma.lastFindManyArgs).toMatchObject({ take: 100 });
  });

  it('requires an explicit game app id scope when listing jobs', async () => {
    const { service } = createService();

    expect(() => service.listJobs({ limit: 20 } as never)).toThrow(
      'Kuaishou ECPM sync job scope is required',
    );
  });

  it('filters jobs by game app id when listing recent sync jobs', async () => {
    const { prisma, service } = createService();
    await service.startJob({ ...baseStartInput(), gameAppId: 'game-1' });
    await service.startJob({ ...baseStartInput(), gameAppId: 'game-2' });

    const result = await service.listJobs({
      gameAppId: 'game-1',
      gameAppIds: undefined,
      limit: 20,
    });

    expect(result).toHaveLength(1);
    expect(result[0].gameAppId).toBe('game-1');
    expect(prisma.lastFindManyArgs).toMatchObject({
      where: { gameAppId: 'game-1' },
    });
  });

  it('scopes listed jobs to authorized game app ids', async () => {
    const { prisma, service } = createService();
    await service.startJob({ ...baseStartInput(), gameAppId: 'game-1' });
    await service.startJob({ ...baseStartInput(), gameAppId: 'game-2' });
    await service.startJob({ ...baseStartInput(), gameAppId: 'game-3' });

    const result = await service.listJobs({
      gameAppIds: ['game-1', 'game-3'],
      limit: 20,
    });

    expect(result.map((job) => job.gameAppId)).toEqual(['game-3', 'game-1']);
    expect(prisma.lastFindManyArgs).toMatchObject({
      where: { gameAppId: { in: ['game-1', 'game-3'] } },
    });
  });

  it('returns no jobs without querying when a scoped admin has no game app ids', async () => {
    const { prisma, service } = createService();
    await service.startJob({ ...baseStartInput(), gameAppId: 'game-1' });

    const result = await service.listJobs({
      gameAppIds: [],
      limit: 20,
    });

    expect(result).toEqual([]);
    expect(prisma.findManyCallCount).toBe(0);
  });

  it('returns no jobs when explicit game app id is outside scope', async () => {
    const { prisma, service } = createService();
    await service.startJob({ ...baseStartInput(), gameAppId: 'game-1' });

    const result = await service.listJobs({
      gameAppId: 'game-2',
      gameAppIds: ['game-1'],
      limit: 20,
    });

    expect(result).toEqual([]);
    expect(prisma.findManyCallCount).toBe(0);
  });

  it('detects running sync jobs for one game', async () => {
    const { service } = createService();
    await service.startJob({ ...baseStartInput(), gameAppId: 'game-1' });

    await expect(service.hasRunningJob('game-1')).resolves.toBe(true);
    await expect(service.hasRunningJob('game-2')).resolves.toBe(false);
  });

  it('finds one sync job by id for retry decisions', async () => {
    const { service } = createService();
    const job = await service.startJob(baseStartInput());

    await expect(service.findJobById(job.id)).resolves.toMatchObject({
      gameAppId: 'game-1',
      id: job.id,
    });
    await expect(service.findJobById('missing-job')).resolves.toBeNull();
  });

  it('presents job dates as ISO strings', async () => {
    const { service } = createService();
    const job = await service.startJob(baseStartInput());

    expect(presentKuaishouEcpmSyncJob(job)).toEqual({
      actorId: 'admin',
      actorType: 'SUPER_ADMIN',
      createdAt: '2026-05-08T00:00:00.000Z',
      dataHour: '2026-05-08',
      endedDataHour: null,
      errorMessage: null,
      finishedAt: null,
      gameAppId: 'game-1',
      id: 'job-1',
      lookbackHours: null,
      requestedOpenIdCount: 1,
      savedCount: 0,
      source: null,
      startedAt: '2026-05-08T00:00:00.000Z',
      startedDataHour: null,
      status: KuaishouEcpmSyncJobStatus.RUNNING,
      updatedAt: '2026-05-08T00:00:00.000Z',
    });
  });
});

const now = new Date('2026-05-08T00:00:00.000Z');

function baseStartInput() {
  return {
    actorId: 'admin',
    actorType: 'SUPER_ADMIN',
    dataHour: '2026-05-08',
    gameAppId: 'game-1',
    requestedOpenIdCount: 1,
  };
}

function createService() {
  const prisma = createFakePrisma();
  const service = new KuaishouEcpmSyncJobService(prisma, () => now);
  return { prisma, service };
}

function createFakePrisma() {
  const rows: any[] = [];
  let lastFindManyArgs: any;
  let findManyCallCount = 0;

  return {
    get findManyCallCount() {
      return findManyCallCount;
    },
    get lastFindManyArgs() {
      return lastFindManyArgs;
    },
    rows,
    kuaishouEcpmSyncJob: {
      create: async ({ data }: any) => {
        const row = {
          id: `job-${rows.length + 1}`,
          createdAt: new Date(now.getTime() + rows.length * 1000),
          updatedAt: new Date(now.getTime() + rows.length * 1000),
          ...data,
        };
        rows.push(row);
        return row;
      },
      update: async ({ data, where }: any) => {
        const index = rows.findIndex((row) => row.id === where.id);
        if (index === -1) {
          throw new Error('job not found');
        }
        rows[index] = {
          ...rows[index],
          ...data,
          updatedAt: now,
        };
        return rows[index];
      },
      findMany: async (args: any) => {
        findManyCallCount += 1;
        lastFindManyArgs = args;
        return rows
          .slice()
          .filter((row) => {
            const gameAppId = args.where?.gameAppId;
            if (!gameAppId) {
              return true;
            }
            if (typeof gameAppId === 'string') {
              return row.gameAppId === gameAppId;
            }
            return gameAppId.in.includes(row.gameAppId);
          })
          .sort((a, b) =>
            args.orderBy?.createdAt === 'desc'
              ? b.createdAt.getTime() - a.createdAt.getTime()
              : a.createdAt.getTime() - b.createdAt.getTime(),
          )
          .slice(0, args.take);
      },
      findFirst: async ({ where }: any) =>
        rows.find((row) =>
          Object.entries(where).every(([key, value]) => row[key] === value),
        ) ?? null,
      findUnique: async ({ where }: any) =>
        rows.find((row) => row.id === where.id) ?? null,
    },
  } as any;
}
