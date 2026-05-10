import {
  BadRequestException,
  Inject,
  Injectable,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import {
  buildDataHoursBetween,
  buildRecentDataHours,
  KuaishouEcpmRangeSyncService,
} from '../kuaishou-admin/kuaishou-ecpm-range-sync.service';
import {
  EcpmUpdateJobService,
  presentEcpmUpdateJob,
} from './ecpm-update-job.service';

export const ECPM_UPDATE_RANGE_NOW = Symbol('ECPM_UPDATE_RANGE_NOW');

export type EcpmUpdateRequest = {
  endedDataHour?: string | null;
  mode: 'latest' | 'range';
  scopeId: string;
  scopeType: 'company' | 'game' | 'open_id' | 'user';
  startedDataHour?: string | null;
};

type EcpmUpdateActor = {
  actorId: string;
  actorType: string;
};

type EcpmUpdateRangePrisma = Pick<PrismaService, 'game' | 'gameOpenId'>;

type GameRecord = {
  gameAppId: string;
  id: string;
};

type GameOpenIdRecord = {
  game?: GameRecord | null;
  gameId?: string;
  openId: string;
  userId?: string | null;
};

type GameWithOpenIds = GameRecord & {
  openIds?: GameOpenIdRecord[];
};

type ResolvedOpenId = {
  openId: string;
  userId?: string | null;
};

type ResolvedGameBatch = {
  gameAppId: string;
  gameId: string;
  openIds: ResolvedOpenId[];
};

const DATA_HOUR_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?\+08:00$/;

@Injectable()
export class EcpmUpdateRangeService {
  constructor(
    @Inject(PrismaService) private readonly prisma: EcpmUpdateRangePrisma,
    private readonly rangeSyncService: KuaishouEcpmRangeSyncService,
    private readonly updateJobService: EcpmUpdateJobService,
    private readonly auditLogService: AuditLogService,
    @Optional()
    @Inject(ECPM_UPDATE_RANGE_NOW)
    private readonly nowProvider?: () => Date,
  ) {}

  async update(input: EcpmUpdateRequest & EcpmUpdateActor) {
    const dataHours = this.resolveDataHours(input);
    const startedDataHour = dataHours[0];
    const endedDataHour = dataHours[dataHours.length - 1];
    const batches = await this.resolveBatches(input);
    const requestedOpenIdCount = batches.reduce(
      (total, batch) => total + batch.openIds.length,
      0,
    );
    const aggregateJob = await this.updateJobService.startJob({
      actorId: input.actorId,
      actorType: input.actorType,
      endedDataHour,
      mode: input.mode,
      requestedGameCount: batches.length,
      requestedOpenIdCount,
      scopeId: input.scopeId,
      scopeType: input.scopeType,
      startedDataHour,
    });

    if (requestedOpenIdCount === 0) {
      await this.updateJobService.recordItem({
        dataHour: endedDataHour,
        jobId: aggregateJob.id,
        skipReason: 'NO_OPEN_IDS',
        status: 'SUCCEEDED',
      });
    } else {
      for (const batch of batches) {
        await this.refreshBatch({
          actor: input,
          batch,
          dataHours,
          endedDataHour,
          jobId: aggregateJob.id,
        });
      }
    }

    const finishedJob = presentEcpmUpdateJob(
      await this.updateJobService.finishJob(aggregateJob.id),
    );
    try {
      await this.auditLogService.record({
        action: 'ecpm.update_finished',
        actorId: input.actorId,
        actorType: input.actorType,
        metadata: {
          endedDataHour,
          failedCount: finishedJob.failedCount,
          jobId: finishedJob.id,
          mode: input.mode,
          requestedGameCount: finishedJob.requestedGameCount,
          requestedOpenIdCount: finishedJob.requestedOpenIdCount,
          savedCount: finishedJob.savedCount,
          scopeId: input.scopeId,
          scopeType: input.scopeType,
          skippedCount: finishedJob.skippedCount,
          startedDataHour,
        },
        targetId: finishedJob.id,
        targetType: 'ecpm_update_job',
      });
    } catch {
      // The aggregate work is already finished; preserve that result.
    }

    return finishedJob;
  }

  async retry(jobId: string, actor: EcpmUpdateActor) {
    const job = await this.updateJobService.findRetryableJob(jobId);

    return this.update({
      actorId: actor.actorId,
      actorType: actor.actorType,
      endedDataHour: job.endedDataHour,
      mode: 'range',
      scopeId: job.scopeId,
      scopeType: job.scopeType,
      startedDataHour: job.startedDataHour,
    });
  }

  private async refreshBatch(input: {
    actor: EcpmUpdateActor;
    batch: ResolvedGameBatch;
    dataHours: string[];
    endedDataHour: string;
    jobId: string;
  }) {
    try {
      const result = await this.rangeSyncService.refreshRange({
        actorId: input.actor.actorId,
        actorType: input.actor.actorType,
        dataHours: input.dataHours,
        gameAppId: input.batch.gameAppId,
        lookbackHours: resolveDelegatedLookbackHours(input.dataHours.length),
        markTokenError: true,
        openIds: input.batch.openIds.map((record) => record.openId),
      });
      await this.updateJobService.recordItem({
        dataHour: input.endedDataHour,
        gameAppId: input.batch.gameAppId,
        gameId: input.batch.gameId,
        jobId: input.jobId,
        kuaishouSyncJobId: result.job.id,
        openId: singleOpenId(input.batch),
        savedCount: result.savedCount,
        status: resolveSuccessfulItemStatus(result.job.status),
        userId: singleUserId(input.batch),
      });
    } catch (error) {
      await this.updateJobService.recordItem({
        dataHour: input.endedDataHour,
        errorMessage: readErrorMessage(error),
        gameAppId: input.batch.gameAppId,
        gameId: input.batch.gameId,
        jobId: input.jobId,
        kuaishouSyncJobId: readAuditOnlySyncJobId(error),
        openId: singleOpenId(input.batch),
        savedCount: readAuditOnlySavedCount(error),
        status: isAuditOnlyFailure(error)
          ? readAuditOnlyItemStatus(error)
          : 'FAILED',
        userId: singleUserId(input.batch),
      });
    }
  }

  private resolveDataHours(input: EcpmUpdateRequest) {
    if (input.mode === 'latest') {
      return [buildRecentDataHours(1, this.now())[0]];
    }

    if (!input.startedDataHour || !input.endedDataHour) {
      throw new BadRequestException(
        'startedDataHour and endedDataHour are required for range ECPM updates',
      );
    }
    assertValidChinaDataHour(input.startedDataHour);
    assertValidChinaDataHour(input.endedDataHour);

    return buildDataHoursBetween(input.startedDataHour, input.endedDataHour);
  }

  private async resolveBatches(input: EcpmUpdateRequest) {
    switch (input.scopeType) {
      case 'company':
        return this.resolveCompanyBatches(input.scopeId);
      case 'game':
        return this.resolveGameBatches(input.scopeId);
      case 'open_id':
        return this.resolveOpenIdBatches(input.scopeId);
      case 'user':
        return this.resolveUserBatches(input.scopeId);
    }
  }

  private async resolveCompanyBatches(companyId: string) {
    const games = (await this.prisma.game.findMany({
      include: {
        openIds: {
          orderBy: {
            createdAt: 'asc',
          },
          select: {
            openId: true,
            userId: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      where: {
        companyId,
        deletedAt: null,
        openIds: {
          some: {},
        },
      },
    })) as GameWithOpenIds[];

    return games.map(gameToBatch).filter(hasOpenIds);
  }

  private async resolveGameBatches(gameId: string) {
    const game = (await this.prisma.game.findFirst({
      include: {
        openIds: {
          orderBy: {
            createdAt: 'asc',
          },
          select: {
            openId: true,
            userId: true,
          },
        },
      },
      where: {
        deletedAt: null,
        id: gameId,
        openIds: {
          some: {},
        },
      },
    })) as GameWithOpenIds | null;

    return game ? [gameToBatch(game)].filter(hasOpenIds) : [];
  }

  private async resolveUserBatches(userId: string) {
    const records = (await this.prisma.gameOpenId.findMany({
      include: {
        game: {
          select: {
            gameAppId: true,
            id: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      where: {
        game: {
          deletedAt: null,
        },
        userId,
      },
    })) as GameOpenIdRecord[];

    return groupOpenIdsByGame(records);
  }

  private async resolveOpenIdBatches(openId: string) {
    const record = (await this.prisma.gameOpenId.findFirst({
      include: {
        game: {
          select: {
            gameAppId: true,
            id: true,
          },
        },
      },
      where: {
        game: {
          deletedAt: null,
        },
        openId,
      },
    })) as GameOpenIdRecord | null;

    return record ? groupOpenIdsByGame([record]) : [];
  }

  private now() {
    return this.nowProvider?.() ?? new Date();
  }
}

function gameToBatch(game: GameWithOpenIds): ResolvedGameBatch {
  return {
    gameAppId: game.gameAppId,
    gameId: game.id,
    openIds: (game.openIds ?? []).map((record) => ({
      openId: record.openId,
      userId: record.userId,
    })),
  };
}

function groupOpenIdsByGame(records: GameOpenIdRecord[]) {
  const batches = new Map<string, ResolvedGameBatch>();
  for (const record of records) {
    if (!record.game) {
      continue;
    }
    const existing = batches.get(record.game.id);
    if (existing) {
      existing.openIds.push({
        openId: record.openId,
        userId: record.userId,
      });
      continue;
    }

    batches.set(record.game.id, {
      gameAppId: record.game.gameAppId,
      gameId: record.game.id,
      openIds: [
        {
          openId: record.openId,
          userId: record.userId,
        },
      ],
    });
  }

  return Array.from(batches.values()).filter(hasOpenIds);
}

function hasOpenIds(batch: ResolvedGameBatch) {
  return batch.openIds.length > 0;
}

function singleOpenId(batch: ResolvedGameBatch) {
  return batch.openIds.length === 1 ? batch.openIds[0].openId : undefined;
}

function singleUserId(batch: ResolvedGameBatch) {
  const userIds = Array.from(
    new Set(
      batch.openIds
        .map((record) => record.userId)
        .filter((userId): userId is string => Boolean(userId)),
    ),
  );

  return userIds.length === 1 ? userIds[0] : undefined;
}

function resolveDelegatedLookbackHours(dataHourCount: number) {
  if (dataHourCount <= 1) {
    return 1;
  }
  if (dataHourCount <= 5) {
    return 5;
  }
  if (dataHourCount <= 24) {
    return 24;
  }
  if (dataHourCount <= 72) {
    return 72;
  }

  return 168;
}

function resolveSuccessfulItemStatus(status: string) {
  return status === 'PARTIAL' ? 'PARTIAL' : 'SUCCEEDED';
}

function readErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'unknown error';
}

function assertValidChinaDataHour(value: string) {
  const match = DATA_HOUR_PATTERN.exec(value);
  if (!match) {
    throw new BadRequestException('Invalid ECPM update data-hour range');
  }

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, ms] =
    match;
  if (minuteText !== '00' || secondText !== '00' || Number(ms ?? 0) !== 0) {
    throw new BadRequestException('Invalid ECPM update data-hour range');
  }

  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const date = new Date(Date.UTC(year, month - 1, day, hour));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour
  ) {
    throw new BadRequestException('Invalid ECPM update data-hour range');
  }
}

function isAuditOnlyFailure(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const taggedError = error as { auditOnly?: unknown; code?: unknown };

  return (
    taggedError.auditOnly === true && taggedError.code === 'AUDIT_LOG_FAILED'
  );
}

function readAuditOnlySyncJobId(error: unknown) {
  if (!isAuditOnlyFailure(error)) {
    return undefined;
  }

  const completedJob = (error as { completedJob?: { id?: unknown } })
    .completedJob;

  return typeof completedJob?.id === 'string' ? completedJob.id : undefined;
}

function readAuditOnlySavedCount(error: unknown) {
  if (!isAuditOnlyFailure(error)) {
    return undefined;
  }

  const savedCount = (error as { savedCount?: unknown }).savedCount;

  return typeof savedCount === 'number' ? savedCount : 0;
}

function readAuditOnlyItemStatus(error: unknown) {
  if (!isAuditOnlyFailure(error)) {
    return 'FAILED';
  }

  const status = (error as { completedJob?: { status?: unknown } })
    .completedJob?.status;

  return typeof status === 'string'
    ? resolveSuccessfulItemStatus(status)
    : 'SUCCEEDED';
}
