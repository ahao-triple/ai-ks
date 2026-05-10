import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type EcpmUpdateJob,
  type EcpmUpdateJobItem,
  EcpmUpdateJobStatus,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export type EcpmUpdateScopeType = 'company' | 'game' | 'open_id' | 'user';
export type EcpmUpdateMode = 'latest' | 'range';

export type StartEcpmUpdateJobInput = {
  actorId: string;
  actorType: string;
  endedDataHour: string;
  mode: EcpmUpdateMode;
  requestedGameCount: number;
  requestedOpenIdCount: number;
  scopeId: string;
  scopeType: EcpmUpdateScopeType;
  startedDataHour: string;
};

export type RecordEcpmUpdateJobItemInput = {
  dataHour: string;
  errorMessage?: string;
  gameAppId?: string;
  gameId?: string;
  jobId: string;
  kuaishouSyncJobId?: string;
  openId?: string;
  savedCount?: number;
  skipReason?: string;
  status: 'FAILED' | 'PARTIAL' | 'SUCCEEDED';
  userId?: string;
};

type EcpmUpdateJobPrisma = Pick<
  PrismaService,
  'ecpmUpdateJob' | 'ecpmUpdateJobItem'
>;

type ListEcpmUpdateJobsInput = {
  limit?: number;
};

type EcpmUpdateJobWithRelations = EcpmUpdateJob & {
  _count?: {
    items?: number;
  };
  items?: EcpmUpdateJobItem[];
};

@Injectable()
export class EcpmUpdateJobService {
  constructor(
    @Inject(PrismaService) private readonly prisma: EcpmUpdateJobPrisma,
  ) {}

  startJob(input: StartEcpmUpdateJobInput) {
    return this.prisma.ecpmUpdateJob.create({
      data: {
        actorId: input.actorId,
        actorType: input.actorType,
        endedDataHour: input.endedDataHour,
        failedCount: 0,
        mode: input.mode,
        requestedGameCount: input.requestedGameCount,
        requestedOpenIdCount: input.requestedOpenIdCount,
        savedCount: 0,
        scopeId: input.scopeId,
        scopeType: input.scopeType,
        skippedCount: 0,
        startedDataHour: input.startedDataHour,
        status: EcpmUpdateJobStatus.RUNNING,
      },
    });
  }

  recordItem(input: RecordEcpmUpdateJobItemInput) {
    return this.prisma.ecpmUpdateJobItem.create({
      data: {
        dataHour: input.dataHour,
        errorMessage: input.errorMessage,
        gameAppId: input.gameAppId,
        gameId: input.gameId,
        jobId: input.jobId,
        kuaishouSyncJobId: input.kuaishouSyncJobId,
        openId: input.openId,
        savedCount: input.savedCount ?? 0,
        skipReason: input.skipReason,
        status: input.status,
        userId: input.userId,
      },
    });
  }

  async finishJob(jobId: string) {
    const job = await this.prisma.ecpmUpdateJob.findUnique({
      include: {
        items: true,
      },
      where: {
        id: jobId,
      },
    });
    if (!job) {
      throw new NotFoundException('ECPM update job not found');
    }

    const summary = summarizeEcpmUpdateJobItems(job.items);

    return this.prisma.ecpmUpdateJob.update({
      data: {
        failedCount: summary.failedCount,
        finishedAt: new Date(),
        savedCount: summary.savedCount,
        skippedCount: summary.skippedCount,
        status: summary.status,
      },
      where: {
        id: jobId,
      },
    });
  }

  async listJobs(input: ListEcpmUpdateJobsInput = {}) {
    const jobs = await this.prisma.ecpmUpdateJob.findMany({
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
      take: clampLimit(input.limit),
    });

    return {
      jobs: jobs.map((job) => presentEcpmUpdateJob(job)),
    };
  }

  async findJob(jobId: string) {
    const job = await this.prisma.ecpmUpdateJob.findUnique({
      include: {
        items: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
      where: {
        id: jobId,
      },
    });
    if (!job) {
      throw new NotFoundException('ECPM update job not found');
    }

    return presentEcpmUpdateJob(job);
  }

  async findRetryableJob(jobId: string) {
    const job = await this.prisma.ecpmUpdateJob.findUnique({
      include: {
        _count: {
          select: {
            items: true,
          },
        },
      },
      where: {
        id: jobId,
      },
    });
    if (!job) {
      throw new NotFoundException('ECPM update job not found');
    }
    if (
      job.status !== EcpmUpdateJobStatus.FAILED &&
      job.status !== EcpmUpdateJobStatus.PARTIAL
    ) {
      throw new BadRequestException(
        'Only failed or partial ECPM update jobs can be retried',
      );
    }

    return presentEcpmUpdateJob(job);
  }
}

export function presentEcpmUpdateJob(job: EcpmUpdateJobWithRelations) {
  const itemCount = resolveItemCount(job);

  return {
    actorId: job.actorId,
    actorType: job.actorType,
    createdAt: job.createdAt.toISOString(),
    endedDataHour: job.endedDataHour,
    errorMessage: job.errorMessage ?? null,
    failedCount: job.failedCount,
    finishedAt: job.finishedAt?.toISOString() ?? null,
    id: job.id,
    ...(itemCount === undefined ? {} : { itemCount }),
    ...(job.items ? { items: job.items.map(presentEcpmUpdateJobItem) } : {}),
    mode: job.mode as EcpmUpdateMode,
    requestedGameCount: job.requestedGameCount,
    requestedOpenIdCount: job.requestedOpenIdCount,
    savedCount: job.savedCount,
    scopeId: job.scopeId,
    scopeType: job.scopeType as EcpmUpdateScopeType,
    skippedCount: job.skippedCount,
    startedAt: job.startedAt.toISOString(),
    startedDataHour: job.startedDataHour,
    status: job.status,
    updatedAt: job.updatedAt.toISOString(),
  };
}

function presentEcpmUpdateJobItem(item: EcpmUpdateJobItem) {
  return {
    createdAt: item.createdAt.toISOString(),
    dataHour: item.dataHour,
    errorMessage: item.errorMessage ?? null,
    gameAppId: item.gameAppId ?? null,
    gameId: item.gameId ?? null,
    id: item.id,
    jobId: item.jobId,
    kuaishouSyncJobId: item.kuaishouSyncJobId ?? null,
    openId: item.openId ?? null,
    savedCount: item.savedCount,
    skipReason: item.skipReason ?? null,
    status: item.status,
    updatedAt: item.updatedAt.toISOString(),
    userId: item.userId ?? null,
  };
}

function summarizeEcpmUpdateJobItems(items: EcpmUpdateJobItem[]) {
  const savedCount = items.reduce(
    (total, item) => total + (item.savedCount ?? 0),
    0,
  );
  const skippedCount = items.filter((item) => hasSkipReason(item)).length;
  const failedCount = items.filter(
    (item) => item.status === EcpmUpdateJobStatus.FAILED && !hasSkipReason(item),
  ).length;
  const hasPartialItem = items.some(
    (item) => item.status === EcpmUpdateJobStatus.PARTIAL,
  );

  if (hasPartialItem) {
    return {
      failedCount,
      savedCount,
      skippedCount,
      status: EcpmUpdateJobStatus.PARTIAL,
    };
  }

  if (failedCount > 0) {
    return {
      failedCount,
      savedCount,
      skippedCount,
      status:
        savedCount > 0
          ? EcpmUpdateJobStatus.PARTIAL
          : EcpmUpdateJobStatus.FAILED,
    };
  }

  return {
    failedCount,
    savedCount,
    skippedCount,
    status: EcpmUpdateJobStatus.SUCCEEDED,
  };
}

function hasSkipReason(item: EcpmUpdateJobItem) {
  return item.skipReason !== null && item.skipReason !== undefined;
}

function resolveItemCount(job: EcpmUpdateJobWithRelations) {
  if (job._count?.items !== undefined) {
    return job._count.items;
  }

  return job.items?.length;
}

function clampLimit(limit?: number) {
  if (!Number.isFinite(limit)) {
    return 20;
  }

  return Math.min(Math.max(Math.trunc(limit!), 1), 100);
}
