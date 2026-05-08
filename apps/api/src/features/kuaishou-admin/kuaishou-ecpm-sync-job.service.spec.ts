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
      gameAppId: 'game-1',
      requestedOpenIdCount: 2,
    });

    expect(job).toMatchObject({
      actorId: 'admin',
      actorType: 'SUPER_ADMIN',
      dataHour: '2026-05-08',
      gameAppId: 'game-1',
      requestedOpenIdCount: 2,
      savedCount: 0,
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
    const { service } = createService();
    await service.startJob({ ...baseStartInput(), gameAppId: 'game-1' });
    await service.startJob({ ...baseStartInput(), gameAppId: 'game-2' });

    const result = await service.listJobs({ limit: 200 });

    expect(result).toHaveLength(2);
    expect(result[0].gameAppId).toBe('game-2');
  });

  it('presents job dates as ISO strings', async () => {
    const { service } = createService();
    const job = await service.startJob(baseStartInput());

    expect(presentKuaishouEcpmSyncJob(job)).toEqual({
      actorId: 'admin',
      actorType: 'SUPER_ADMIN',
      createdAt: '2026-05-08T00:00:00.000Z',
      dataHour: '2026-05-08',
      errorMessage: null,
      finishedAt: null,
      gameAppId: 'game-1',
      id: 'job-1',
      requestedOpenIdCount: 1,
      savedCount: 0,
      source: null,
      startedAt: '2026-05-08T00:00:00.000Z',
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

  return {
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
      findMany: async ({ orderBy, take }: any) =>
        rows
          .slice()
          .sort((a, b) =>
            orderBy?.createdAt === 'desc'
              ? b.createdAt.getTime() - a.createdAt.getTime()
              : a.createdAt.getTime() - b.createdAt.getTime(),
          )
          .slice(0, take),
    },
  } as any;
}
