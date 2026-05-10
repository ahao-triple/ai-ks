import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  type KuaishouEcpmSyncJob,
  KuaishouEcpmSyncJobStatus,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export const KUAISHOU_ECPM_SYNC_JOB_NOW = Symbol(
  'KUAISHOU_ECPM_SYNC_JOB_NOW',
);

type SyncJobPrisma = Pick<PrismaService, 'kuaishouEcpmSyncJob'>;

export type StartKuaishouEcpmSyncJobInput = {
  actorId: string;
  actorType: string;
  dataHour: string;
  endedDataHour?: string;
  gameAppId: string;
  lookbackHours?: number;
  requestedOpenIdCount: number;
  startedDataHour?: string;
};

export type CompleteKuaishouEcpmSyncJobInput = {
  jobId: string;
  savedCount: number;
  source: 'kuaishou';
};

export type FailKuaishouEcpmSyncJobInput = {
  errorMessage: string;
  jobId: string;
};

export type ListKuaishouEcpmSyncJobsInput = {
  gameAppId?: string;
  gameAppIds: string[] | undefined;
  limit?: number;
};

@Injectable()
export class KuaishouEcpmSyncJobService {
  constructor(
    @Inject(PrismaService) private readonly prisma: SyncJobPrisma,
    @Optional()
    @Inject(KUAISHOU_ECPM_SYNC_JOB_NOW)
    private readonly nowProvider?: () => Date,
  ) {}

  startJob(input: StartKuaishouEcpmSyncJobInput) {
    return this.prisma.kuaishouEcpmSyncJob.create({
      data: {
        actorId: input.actorId,
        actorType: input.actorType,
        dataHour: input.dataHour,
        endedDataHour: input.endedDataHour,
        gameAppId: input.gameAppId,
        lookbackHours: input.lookbackHours,
        requestedOpenIdCount: input.requestedOpenIdCount,
        savedCount: 0,
        startedAt: this.now(),
        startedDataHour: input.startedDataHour,
        status: KuaishouEcpmSyncJobStatus.RUNNING,
      },
    });
  }

  completeJob(input: CompleteKuaishouEcpmSyncJobInput) {
    return this.prisma.kuaishouEcpmSyncJob.update({
      data: {
        errorMessage: null,
        finishedAt: this.now(),
        savedCount: input.savedCount,
        source: input.source,
        status: KuaishouEcpmSyncJobStatus.SUCCEEDED,
      },
      where: {
        id: input.jobId,
      },
    });
  }

  failJob(input: FailKuaishouEcpmSyncJobInput) {
    return this.prisma.kuaishouEcpmSyncJob.update({
      data: {
        errorMessage: input.errorMessage,
        finishedAt: this.now(),
        status: KuaishouEcpmSyncJobStatus.FAILED,
      },
      where: {
        id: input.jobId,
      },
    });
  }

  listJobs(input: ListKuaishouEcpmSyncJobsInput) {
    const where = resolveListJobsWhere(input);
    if (where === false) {
      return Promise.resolve([]);
    }

    return this.prisma.kuaishouEcpmSyncJob.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      take: clampLimit(input.limit),
      ...(where ? { where } : {}),
    });
  }

  async hasRunningJob(gameAppId: string): Promise<boolean> {
    const job = await this.prisma.kuaishouEcpmSyncJob.findFirst({
      where: {
        gameAppId,
        status: KuaishouEcpmSyncJobStatus.RUNNING,
      },
    });

    return job !== null;
  }

  findJobById(jobId: string) {
    return this.prisma.kuaishouEcpmSyncJob.findUnique({
      where: {
        id: jobId,
      },
    });
  }

  private now() {
    return this.nowProvider?.() ?? new Date();
  }
}

export function presentKuaishouEcpmSyncJob(job: KuaishouEcpmSyncJob) {
  return {
    actorId: job.actorId,
    actorType: job.actorType,
    createdAt: job.createdAt.toISOString(),
    dataHour: job.dataHour,
    endedDataHour: job.endedDataHour ?? null,
    errorMessage: job.errorMessage ?? null,
    finishedAt: job.finishedAt?.toISOString() ?? null,
    gameAppId: job.gameAppId,
    id: job.id,
    lookbackHours: job.lookbackHours ?? null,
    requestedOpenIdCount: job.requestedOpenIdCount,
    savedCount: job.savedCount,
    source: (job.source ?? null) as 'kuaishou' | null,
    startedAt: job.startedAt.toISOString(),
    startedDataHour: job.startedDataHour ?? null,
    status: job.status,
    updatedAt: job.updatedAt.toISOString(),
  };
}

function clampLimit(limit?: number) {
  if (!Number.isFinite(limit)) {
    return 20;
  }

  return Math.min(Math.max(Math.trunc(limit!), 1), 100);
}

function resolveListJobsWhere(input: ListKuaishouEcpmSyncJobsInput) {
  if (!input || !Object.prototype.hasOwnProperty.call(input, 'gameAppIds')) {
    throw new Error('Kuaishou ECPM sync job scope is required');
  }

  if (input.gameAppIds === undefined) {
    return input.gameAppId ? { gameAppId: input.gameAppId } : undefined;
  }

  if (input.gameAppIds.length === 0) {
    return false;
  }

  if (input.gameAppId) {
    return input.gameAppIds.includes(input.gameAppId)
      ? { gameAppId: input.gameAppId }
      : false;
  }

  return {
    gameAppId: {
      in: input.gameAppIds,
    },
  };
}
