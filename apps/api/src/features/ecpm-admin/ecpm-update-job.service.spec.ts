import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EcpmUpdateJobStatus } from '@prisma/client';
import {
  EcpmUpdateJobService,
  presentEcpmUpdateJob,
} from './ecpm-update-job.service';

describe('EcpmUpdateJobService', () => {
  it('starts an aggregate update job with requested counts', async () => {
    const { prisma, service } = createService();

    const job = await service.startJob({
      ...baseStartInput(),
      requestedGameCount: 3,
      requestedOpenIdCount: 12,
    });

    expect(job).toMatchObject({
      actorId: 'admin',
      actorType: 'SUPER_ADMIN',
      endedDataHour: '2026-05-08T15:00:00+08:00',
      failedCount: 0,
      mode: 'range',
      requestedGameCount: 3,
      requestedOpenIdCount: 12,
      savedCount: 0,
      scopeId: 'company-1',
      scopeType: 'company',
      skippedCount: 0,
      startedDataHour: '2026-05-08T14:00:00+08:00',
      status: EcpmUpdateJobStatus.RUNNING,
    });
    expect(prisma.jobs).toHaveLength(1);
  });

  it('records successful and skipped item rows', async () => {
    const { prisma, service } = createService();
    const job = await service.startJob(baseStartInput());

    const saved = await service.recordItem({
      dataHour: '2026-05-08T14:00:00+08:00',
      gameAppId: 'game-app-1',
      gameId: 'game-1',
      jobId: job.id,
      kuaishouSyncJobId: 'sync-job-1',
      openId: 'open-a',
      savedCount: 4,
      status: 'SUCCEEDED',
      userId: 'user-1',
    });
    const skipped = await service.recordItem({
      dataHour: '2026-05-08T14:00:00+08:00',
      gameAppId: 'game-app-1',
      gameId: 'game-1',
      jobId: job.id,
      openId: 'open-b',
      skipReason: 'open_id is not bound to a user',
      status: 'FAILED',
    });

    expect(saved).toMatchObject({
      gameAppId: 'game-app-1',
      gameId: 'game-1',
      jobId: job.id,
      kuaishouSyncJobId: 'sync-job-1',
      openId: 'open-a',
      savedCount: 4,
      status: EcpmUpdateJobStatus.SUCCEEDED,
      userId: 'user-1',
    });
    expect(skipped).toMatchObject({
      jobId: job.id,
      openId: 'open-b',
      savedCount: 0,
      skipReason: 'open_id is not bound to a user',
      status: EcpmUpdateJobStatus.FAILED,
    });
    expect(prisma.items).toHaveLength(2);
  });

  it('completes a job as SUCCEEDED when no failures exist', async () => {
    const { service } = createService();
    const job = await service.startJob(baseStartInput());
    await service.recordItem({
      dataHour: '2026-05-08T14:00:00+08:00',
      gameId: 'game-1',
      jobId: job.id,
      openId: 'open-a',
      savedCount: 2,
      status: 'SUCCEEDED',
    });
    await service.recordItem({
      dataHour: '2026-05-08T14:00:00+08:00',
      gameId: 'game-1',
      jobId: job.id,
      openId: 'open-b',
      savedCount: 1,
      status: 'PARTIAL',
    });

    const finished = await service.finishJob(job.id);

    expect(finished).toMatchObject({
      failedCount: 0,
      savedCount: 3,
      skippedCount: 0,
      status: EcpmUpdateJobStatus.SUCCEEDED,
    });
    expect(finished.finishedAt).toBeInstanceOf(Date);
  });

  it('completes a job as PARTIAL when failures and saves exist', async () => {
    const { service } = createService();
    const job = await service.startJob(baseStartInput());
    await service.recordItem({
      dataHour: '2026-05-08T14:00:00+08:00',
      gameId: 'game-1',
      jobId: job.id,
      openId: 'open-a',
      savedCount: 2,
      status: 'SUCCEEDED',
    });
    await service.recordItem({
      dataHour: '2026-05-08T14:00:00+08:00',
      errorMessage: 'kuaishou request failed',
      gameId: 'game-1',
      jobId: job.id,
      openId: 'open-b',
      status: 'FAILED',
    });

    const finished = await service.finishJob(job.id);

    expect(finished).toMatchObject({
      failedCount: 1,
      savedCount: 2,
      skippedCount: 0,
      status: EcpmUpdateJobStatus.PARTIAL,
    });
  });

  it('completes a job as FAILED when every item failed or skipped', async () => {
    const { service } = createService();
    const job = await service.startJob(baseStartInput());
    await service.recordItem({
      dataHour: '2026-05-08T14:00:00+08:00',
      errorMessage: 'kuaishou request failed',
      gameId: 'game-1',
      jobId: job.id,
      openId: 'open-a',
      status: 'FAILED',
    });
    await service.recordItem({
      dataHour: '2026-05-08T14:00:00+08:00',
      gameId: 'game-1',
      jobId: job.id,
      openId: 'open-b',
      skipReason: 'open_id is not bound to a user',
      status: 'FAILED',
    });

    const finished = await service.finishJob(job.id);

    expect(finished).toMatchObject({
      failedCount: 1,
      savedCount: 0,
      skippedCount: 1,
      status: EcpmUpdateJobStatus.FAILED,
    });
  });

  it('lists jobs newest first with item counts', async () => {
    const { prisma, service } = createService();
    const olderJob = await service.startJob({
      ...baseStartInput(),
      scopeId: 'game-1',
      scopeType: 'game',
    });
    await service.recordItem({
      dataHour: '2026-05-08T14:00:00+08:00',
      jobId: olderJob.id,
      savedCount: 1,
      status: 'SUCCEEDED',
    });
    const newerJob = await service.startJob({
      ...baseStartInput(),
      scopeId: 'game-2',
      scopeType: 'game',
    });
    await service.recordItem({
      dataHour: '2026-05-08T14:00:00+08:00',
      jobId: newerJob.id,
      status: 'FAILED',
    });
    await service.recordItem({
      dataHour: '2026-05-08T15:00:00+08:00',
      jobId: newerJob.id,
      skipReason: 'missing open_id',
      status: 'FAILED',
    });

    const result = await service.listJobs({ limit: 200 });

    expect(result.jobs.map((listedJob: any) => listedJob.id)).toEqual([
      newerJob.id,
      olderJob.id,
    ]);
    expect(result.jobs.map((listedJob: any) => listedJob.itemCount)).toEqual([
      2,
      1,
    ]);
    expect(prisma.lastFindManyArgs).toMatchObject({
      include: {
        _count: {
          select: {
            items: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    });
  });

  it('returns job details with item rows', async () => {
    const { service } = createService();
    const job = await service.startJob(baseStartInput());
    await service.recordItem({
      dataHour: '2026-05-08T14:00:00+08:00',
      gameId: 'game-1',
      jobId: job.id,
      openId: 'open-a',
      savedCount: 1,
      status: 'SUCCEEDED',
    });
    await service.recordItem({
      dataHour: '2026-05-08T15:00:00+08:00',
      errorMessage: 'timeout',
      gameId: 'game-1',
      jobId: job.id,
      openId: 'open-b',
      status: 'FAILED',
    });

    const detail = await service.findJob(job.id);

    expect(detail).toMatchObject({
      createdAt: '2026-05-08T00:00:00.000Z',
      id: job.id,
      itemCount: 2,
      items: [
        expect.objectContaining({
          createdAt: '2026-05-08T00:00:00.000Z',
          openId: 'open-a',
          savedCount: 1,
          status: EcpmUpdateJobStatus.SUCCEEDED,
        }),
        expect.objectContaining({
          errorMessage: 'timeout',
          openId: 'open-b',
          status: EcpmUpdateJobStatus.FAILED,
        }),
      ],
      status: EcpmUpdateJobStatus.RUNNING,
    });
    await expect(service.findJob('missing-job')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns retryable failed and partial jobs', async () => {
    const { service } = createService();
    const partialJob = await service.startJob({
      ...baseStartInput(),
      scopeId: 'job-partial',
    });
    await service.recordItem({
      dataHour: '2026-05-08T14:00:00+08:00',
      jobId: partialJob.id,
      savedCount: 1,
      status: 'SUCCEEDED',
    });
    await service.recordItem({
      dataHour: '2026-05-08T14:00:00+08:00',
      errorMessage: 'failed',
      jobId: partialJob.id,
      status: 'FAILED',
    });
    await service.finishJob(partialJob.id);
    const failedJob = await service.startJob({
      ...baseStartInput(),
      scopeId: 'job-failed',
    });
    await service.recordItem({
      dataHour: '2026-05-08T14:00:00+08:00',
      errorMessage: 'failed',
      jobId: failedJob.id,
      status: 'FAILED',
    });
    await service.finishJob(failedJob.id);

    await expect(service.findRetryableJob(partialJob.id)).resolves.toMatchObject(
      {
        id: partialJob.id,
        status: EcpmUpdateJobStatus.PARTIAL,
      },
    );
    await expect(service.findRetryableJob(failedJob.id)).resolves.toMatchObject({
      id: failedJob.id,
      status: EcpmUpdateJobStatus.FAILED,
    });
  });

  it('rejects retry lookup for succeeded jobs', async () => {
    const { service } = createService();
    const job = await service.startJob(baseStartInput());
    await service.recordItem({
      dataHour: '2026-05-08T14:00:00+08:00',
      jobId: job.id,
      savedCount: 1,
      status: 'SUCCEEDED',
    });
    await service.finishJob(job.id);

    await expect(service.findRetryableJob(job.id)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.findRetryableJob('missing-job')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('presents job dates as ISO strings', async () => {
    const { service } = createService();
    const job = await service.startJob(baseStartInput());

    expect(presentEcpmUpdateJob(job)).toMatchObject({
      createdAt: '2026-05-08T00:00:00.000Z',
      finishedAt: null,
      id: job.id,
      startedAt: '2026-05-08T00:00:00.000Z',
      updatedAt: '2026-05-08T00:00:00.000Z',
    });
  });
});

const now = new Date('2026-05-08T00:00:00.000Z');

function baseStartInput() {
  return {
    actorId: 'admin',
    actorType: 'SUPER_ADMIN',
    endedDataHour: '2026-05-08T15:00:00+08:00',
    mode: 'range' as const,
    requestedGameCount: 1,
    requestedOpenIdCount: 2,
    scopeId: 'company-1',
    scopeType: 'company' as const,
    startedDataHour: '2026-05-08T14:00:00+08:00',
  };
}

function createService() {
  const prisma = createFakePrisma();
  const service = new EcpmUpdateJobService(prisma);

  return { prisma, service };
}

function createFakePrisma() {
  const jobs: any[] = [];
  const items: any[] = [];
  let lastFindManyArgs: any;

  return {
    get lastFindManyArgs() {
      return lastFindManyArgs;
    },
    items,
    jobs,
    ecpmUpdateJob: {
      create: async ({ data }: any) => {
        const date = new Date(now.getTime() + jobs.length * 1000);
        const row = {
          actorId: data.actorId,
          actorType: data.actorType,
          createdAt: date,
          endedDataHour: data.endedDataHour,
          errorMessage: null,
          failedCount: 0,
          finishedAt: null,
          id: `job-${jobs.length + 1}`,
          mode: data.mode,
          requestedGameCount: data.requestedGameCount,
          requestedOpenIdCount: data.requestedOpenIdCount,
          savedCount: 0,
          scopeId: data.scopeId,
          scopeType: data.scopeType,
          skippedCount: 0,
          startedAt: date,
          startedDataHour: data.startedDataHour,
          status: data.status,
          updatedAt: date,
        };
        jobs.push(row);

        return row;
      },
      findMany: async (args: any) => {
        lastFindManyArgs = args;

        return jobs
          .slice()
          .sort((a, b) =>
            args.orderBy?.createdAt === 'desc'
              ? b.createdAt.getTime() - a.createdAt.getTime()
              : a.createdAt.getTime() - b.createdAt.getTime(),
          )
          .slice(0, args.take)
          .map((job) => withJobIncludes(job, args.include, items));
      },
      findUnique: async (args: any) => {
        const job = jobs.find((row) => row.id === args.where.id);
        if (!job) {
          return null;
        }

        return withJobIncludes(job, args.include, items);
      },
      update: async ({ data, where }: any) => {
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
      },
    },
    ecpmUpdateJobItem: {
      create: async ({ data }: any) => {
        const date = new Date(now.getTime() + items.length * 1000);
        const row = {
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
          userId: data.userId ?? null,
          createdAt: date,
          updatedAt: date,
        };
        items.push(row);

        return row;
      },
    },
  } as any;
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
