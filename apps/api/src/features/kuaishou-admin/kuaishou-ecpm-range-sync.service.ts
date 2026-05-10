import {
  BadRequestException,
  Inject,
  Injectable,
  Optional,
} from '@nestjs/common';
import { KuaishouEcpmClient } from '../../integrations/kuaishou/kuaishou-ecpm.client';
import { AuditLogService } from '../audit/audit-log.service';
import { DemoStore, type DemoEcpmInputRow } from '../demo/demo-store';
import { presentEcpmRow } from '../demo/money-presenter';
import {
  KuaishouEcpmSyncJobService,
  presentKuaishouEcpmSyncJob,
} from './kuaishou-ecpm-sync-job.service';
import { KuaishouTokenService } from './kuaishou-token.service';

export const KUAISHOU_ECPM_RANGE_SYNC_NOW = Symbol(
  'KUAISHOU_ECPM_RANGE_SYNC_NOW',
);

export type KuaishouEcpmRangeSyncInput = {
  actorId: string;
  actorType: string;
  dataHours?: string[];
  gameAppId: string;
  lookbackHours: number;
  markTokenError: boolean;
  openIds?: string[];
};

const ALLOWED_LOOKBACK_HOURS = new Set([1, 3, 6, 12, 24]);
const CHINA_TIMEZONE_OFFSET_MS = 8 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

@Injectable()
export class KuaishouEcpmRangeSyncService {
  constructor(
    private readonly demoStore: DemoStore,
    private readonly ecpmClient: KuaishouEcpmClient,
    private readonly auditLogService: AuditLogService,
    private readonly tokenService: KuaishouTokenService,
    private readonly syncJobService: KuaishouEcpmSyncJobService,
    @Optional()
    @Inject(KUAISHOU_ECPM_RANGE_SYNC_NOW)
    private readonly nowProvider?: () => Date,
  ) {}

  async refreshRange(input: KuaishouEcpmRangeSyncInput) {
    if (!ALLOWED_LOOKBACK_HOURS.has(input.lookbackHours)) {
      throw new BadRequestException('Unsupported lookbackHours');
    }

    const dataHours =
      input.dataHours && input.dataHours.length > 0
        ? input.dataHours
        : buildRecentDataHours(input.lookbackHours, this.now());
    const startedDataHour = dataHours[0];
    const endedDataHour = dataHours[dataHours.length - 1];
    const requestedOpenIds = input.openIds !== undefined
      ? input.openIds
      : (await this.demoStore.listOpenIds(input.gameAppId)).map(
          (record) => record.openId,
        );
    const job = await this.syncJobService.startJob({
      actorId: input.actorId,
      actorType: input.actorType,
      dataHour: endedDataHour,
      endedDataHour,
      gameAppId: input.gameAppId,
      lookbackHours: input.lookbackHours,
      requestedOpenIdCount: requestedOpenIds.length,
      startedDataHour,
    });

    const refreshRows: DemoEcpmInputRow[] = [];
    const sources: Array<'mock' | 'kuaishou'> = [];
    try {
      for (const dataHour of dataHours) {
        const result = await this.ecpmClient.refresh({
          dataHour,
          gameAppId: input.gameAppId,
          openIds: requestedOpenIds,
        });
        refreshRows.push(...result.rows);
        sources.push(result.source);
      }
    } catch (error) {
      await this.recordRefreshFailure({
        dataHours,
        error,
        input,
        jobId: job.id,
        markTokenError: input.markTokenError,
        requestedOpenIds,
        startedDataHour,
        endedDataHour,
      });
      throw error;
    }

    let savedRows: Awaited<ReturnType<DemoStore['addEcpmRows']>>;
    try {
      savedRows = await this.demoStore.addEcpmRows({
        gameAppId: input.gameAppId,
        rows: refreshRows,
      });
    } catch (error) {
      await this.recordRefreshFailure({
        dataHours,
        error,
        input,
        jobId: job.id,
        markTokenError: false,
        requestedOpenIds,
        startedDataHour,
        endedDataHour,
      });
      throw error;
    }

    const source = sources.includes('kuaishou') ? 'kuaishou' : 'mock';
    const completedJob = await this.syncJobService.completeJob({
      jobId: job.id,
      savedCount: savedRows.length,
      source,
    });
    try {
      await this.auditLogService.record({
        action: 'kuaishou.ecpm_refreshed',
        actorId: input.actorId,
        actorType: input.actorType,
        metadata: {
          dataHours,
          startedDataHour,
          endedDataHour,
          lookbackHours: input.lookbackHours,
          jobId: job.id,
          requestedOpenIds,
          savedCount: savedRows.length,
          source,
        },
        targetId: input.gameAppId,
        targetType: 'kuaishou_ecpm_refresh',
      });
    } catch (error) {
      throw tagAuditLogFailure(error, {
        completedJob: presentKuaishouEcpmSyncJob(completedJob),
        savedCount: savedRows.length,
        source,
      });
    }

    return {
      job: presentKuaishouEcpmSyncJob(completedJob),
      requestedOpenIds,
      rows: savedRows.map(presentEcpmRow),
      savedCount: savedRows.length,
      source,
    };
  }

  private now() {
    return this.nowProvider?.() ?? new Date();
  }

  private async recordRefreshFailure(input: {
    dataHours: string[];
    endedDataHour: string;
    error: unknown;
    input: KuaishouEcpmRangeSyncInput;
    jobId: string;
    markTokenError: boolean;
    requestedOpenIds: string[];
    startedDataHour: string;
  }) {
    const message = readErrorMessage(input.error);
    try {
      await this.syncJobService.failJob({
        errorMessage: message,
        jobId: input.jobId,
      });
      if (input.markTokenError) {
        await this.tokenService.markTokenError(message);
      }
      await this.auditLogService.record({
        action: 'kuaishou.ecpm_refresh_failed',
        actorId: input.input.actorId,
        actorType: input.input.actorType,
        metadata: {
          dataHours: input.dataHours,
          startedDataHour: input.startedDataHour,
          endedDataHour: input.endedDataHour,
          lookbackHours: input.input.lookbackHours,
          error: message,
          jobId: input.jobId,
          requestedOpenIds: input.requestedOpenIds,
        },
        targetId: input.input.gameAppId,
        targetType: 'kuaishou_ecpm_refresh',
      });
    } catch {
      // Preserve the original upstream or save error for callers.
    }
  }
}

export function buildRecentDataHours(lookbackHours: number, now: Date) {
  const chinaNowMs = now.getTime() + CHINA_TIMEZONE_OFFSET_MS;
  const flooredChinaHourMs = Math.floor(chinaNowMs / HOUR_MS) * HOUR_MS;

  return Array.from({ length: lookbackHours }, (_, index) => {
    const hourMs = flooredChinaHourMs - (lookbackHours - 1 - index) * HOUR_MS;
    return formatChinaDataHour(hourMs);
  });
}

export function buildDataHoursBetween(
  startedDataHour: string,
  endedDataHour: string,
) {
  const startMs = Date.parse(startedDataHour);
  const endMs = Date.parse(endedDataHour);
  if (
    !Number.isFinite(startMs) ||
    !Number.isFinite(endMs) ||
    startMs > endMs
  ) {
    throw new BadRequestException('Invalid ECPM retry data-hour range');
  }

  const count = Math.floor((endMs - startMs) / HOUR_MS) + 1;
  if (count > 24) {
    throw new BadRequestException('ECPM retry data-hour range is too large');
  }

  return Array.from({ length: count }, (_, index) =>
    formatChinaDataHour(startMs + index * HOUR_MS + CHINA_TIMEZONE_OFFSET_MS),
  );
}

function formatChinaDataHour(chinaHourMs: number) {
  const date = new Date(chinaHourMs);
  const year = date.getUTCFullYear();
  const month = pad2(date.getUTCMonth() + 1);
  const day = pad2(date.getUTCDate());
  const hour = pad2(date.getUTCHours());

  return `${year}-${month}-${day}T${hour}:00:00+08:00`;
}

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function readErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'unknown error';
}

function tagAuditLogFailure(
  error: unknown,
  metadata: {
    completedJob: ReturnType<typeof presentKuaishouEcpmSyncJob>;
    savedCount: number;
    source: 'mock' | 'kuaishou';
  },
) {
  const tagged =
    error instanceof Error
      ? (error as Error & {
          auditOnly?: boolean;
          code?: string;
          completedJob?: ReturnType<typeof presentKuaishouEcpmSyncJob>;
          savedCount?: number;
          source?: 'mock' | 'kuaishou';
        })
      : (new Error(readErrorMessage(error)) as Error & {
          auditOnly?: boolean;
          code?: string;
          completedJob?: ReturnType<typeof presentKuaishouEcpmSyncJob>;
          savedCount?: number;
          source?: 'mock' | 'kuaishou';
        });
  tagged.auditOnly = true;
  tagged.code = 'AUDIT_LOG_FAILED';
  tagged.completedJob = metadata.completedJob;
  tagged.savedCount = metadata.savedCount;
  tagged.source = metadata.source;

  return tagged;
}
