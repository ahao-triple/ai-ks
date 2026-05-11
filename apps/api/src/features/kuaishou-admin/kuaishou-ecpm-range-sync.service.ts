import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { KuaishouEcpmClient } from '../../integrations/kuaishou/kuaishou-ecpm.client';
import { AuditLogService } from '../audit/audit-log.service';
import { GameDataStore, type EcpmInputRow } from '../game-data/game-data.store';
import { presentEcpmRow } from '../../common/presenters/money-presenter';
import { currentChinaDate } from '../user/china-day-range';
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
  // 中国时区下的目标日期列表（YYYY-MM-DD），按顺序逐天拉取。
  // 不传 = 默认仅拉"当天"一天（绝大多数刷新场景）。
  dataDays?: string[];
  gameAppId: string;
  markTokenError: boolean;
  openIds?: string[];
};

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
// 快手 ECPM 数据源仅保存近 168 小时（7 天）。
const MAX_DATA_DAYS = 7;

@Injectable()
export class KuaishouEcpmRangeSyncService {
  private readonly logger = new Logger('刷新链路:RangeSync');

  constructor(
    private readonly gameDataStore: GameDataStore,
    private readonly ecpmClient: KuaishouEcpmClient,
    private readonly auditLogService: AuditLogService,
    private readonly tokenService: KuaishouTokenService,
    private readonly syncJobService: KuaishouEcpmSyncJobService,
    @Optional()
    @Inject(KUAISHOU_ECPM_RANGE_SYNC_NOW)
    private readonly nowProvider?: () => Date,
  ) {}

  async refreshRange(input: KuaishouEcpmRangeSyncInput) {
    const dataDays =
      input.dataDays && input.dataDays.length > 0
        ? input.dataDays
        : [currentChinaDate(this.now())];
    for (const day of dataDays) {
      if (!DAY_PATTERN.test(day)) {
        throw new BadRequestException(`非法日期格式：${day}（需 YYYY-MM-DD）`);
      }
    }
    if (dataDays.length > MAX_DATA_DAYS) {
      throw new BadRequestException('刷新范围超过 7 天，快手只保留最近 168 小时');
    }
    const startedDataDay = dataDays[0];
    const endedDataDay = dataDays[dataDays.length - 1];
    // openIds undefined / [] => 全游戏（不按 open_id 过滤）
    const requestedOpenIds = input.openIds ?? [];

    const job = await this.syncJobService.startJob({
      actorId: input.actorId,
      actorType: input.actorType,
      dataHour: endedDataDay,
      endedDataHour: endedDataDay,
      gameAppId: input.gameAppId,
      lookbackHours: dataDays.length,
      requestedOpenIdCount: requestedOpenIds.length,
      startedDataHour: startedDataDay,
    });

    const tStart = Date.now();
    this.logger.log(
      `[refreshRange 入口] gameAppId=${input.gameAppId} 天数=${dataDays.length} (${startedDataDay} ~ ${endedDataDay}) openIds数=${requestedOpenIds.length || '0(整游戏)'}`,
    );

    const refreshRows: EcpmInputRow[] = [];
    try {
      for (let i = 0; i < dataDays.length; i += 1) {
        const dataDay = dataDays[i];
        const tDay = Date.now();
        const result = await this.ecpmClient.refresh({
          dataDay,
          gameAppId: input.gameAppId,
          openIds: requestedOpenIds,
        });
        this.logger.log(
          `[天 ${i + 1}/${dataDays.length}] ${dataDay} 拉到 ${result.rows.length} 行 耗时 ${Date.now() - tDay}ms`,
        );
        refreshRows.push(...result.rows);
      }
    } catch (error) {
      this.logger.error(
        `[快手 API 异常] 已累计 ${refreshRows.length} 行 总耗时=${Date.now() - tStart}ms 错误=${error instanceof Error ? error.message : String(error)}`,
      );
      await this.recordRefreshFailure({
        dataDays,
        error,
        input,
        jobId: job.id,
        markTokenError: input.markTokenError,
        requestedOpenIds,
        startedDataDay,
        endedDataDay,
      });
      throw error;
    }

    const tApiDone = Date.now();
    this.logger.log(
      `[快手 API 完成] 累计 ${refreshRows.length} 行 耗时 ${tApiDone - tStart}ms`,
    );

    let savedRows: Awaited<ReturnType<GameDataStore['addEcpmRows']>>;
    const tSave = Date.now();
    try {
      savedRows = await this.gameDataStore.addEcpmRows({
        gameAppId: input.gameAppId,
        rows: refreshRows,
      });
      this.logger.log(
        `[写库完成] 落 ${savedRows.length} 行 耗时 ${Date.now() - tSave}ms`,
      );
    } catch (error) {
      this.logger.error(
        `[写库异常] 总耗时=${Date.now() - tStart}ms 错误=${error instanceof Error ? error.message : String(error)}`,
      );
      await this.recordRefreshFailure({
        dataDays,
        error,
        input,
        jobId: job.id,
        markTokenError: false,
        requestedOpenIds,
        startedDataDay,
        endedDataDay,
      });
      throw error;
    }

    const source = 'kuaishou';
    const completedJob = await this.syncJobService.completeJob({
      jobId: job.id,
      savedCount: savedRows.length,
      source,
    });
    this.logger.log(
      `[refreshRange 出口] gameAppId=${input.gameAppId} savedCount=${savedRows.length} 总耗时=${Date.now() - tStart}ms`,
    );
    try {
      await this.auditLogService.record({
        action: 'kuaishou.ecpm_refreshed',
        actorId: input.actorId,
        actorType: input.actorType,
        metadata: {
          dataDays,
          startedDataDay,
          endedDataDay,
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
    dataDays: string[];
    endedDataDay: string;
    error: unknown;
    input: KuaishouEcpmRangeSyncInput;
    jobId: string;
    markTokenError: boolean;
    requestedOpenIds: string[];
    startedDataDay: string;
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
          dataDays: input.dataDays,
          startedDataDay: input.startedDataDay,
          endedDataDay: input.endedDataDay,
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

// 含今天在内、最近 N 天的日期列表（中国时区 YYYY-MM-DD），按升序。
export function buildRecentDataDays(days: number, now: Date) {
  if (!Number.isInteger(days) || days < 1) {
    throw new BadRequestException('days 必须是正整数');
  }
  const dayMs = 24 * 60 * 60 * 1000;
  const todayChina = currentChinaDate(now);
  // 用"中国时区今天 00:00 UTC"为锚点向前数 N-1 天
  const anchorMs = Date.parse(`${todayChina}T00:00:00+08:00`);
  return Array.from({ length: days }, (_, index) => {
    const targetMs = anchorMs - (days - 1 - index) * dayMs;
    return currentChinaDate(new Date(targetMs));
  });
}

// 起止日期之间的所有 YYYY-MM-DD（含两端）。范围超过 7 天抛 400。
export function buildDataDaysBetween(
  startedDataDay: string,
  endedDataDay: string,
) {
  if (!DAY_PATTERN.test(startedDataDay) || !DAY_PATTERN.test(endedDataDay)) {
    throw new BadRequestException('日期需 YYYY-MM-DD 格式');
  }
  const startMs = Date.parse(`${startedDataDay}T00:00:00+08:00`);
  const endMs = Date.parse(`${endedDataDay}T00:00:00+08:00`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs > endMs) {
    throw new BadRequestException('日期范围无效');
  }
  const dayMs = 24 * 60 * 60 * 1000;
  const count = Math.floor((endMs - startMs) / dayMs) + 1;
  if (count > MAX_DATA_DAYS) {
    throw new BadRequestException('日期范围超过 7 天');
  }
  return Array.from({ length: count }, (_, index) =>
    currentChinaDate(new Date(startMs + index * dayMs)),
  );
}

function readErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'unknown error';
}

function tagAuditLogFailure(
  error: unknown,
  metadata: {
    completedJob: ReturnType<typeof presentKuaishouEcpmSyncJob>;
    savedCount: number;
    source: 'kuaishou';
  },
) {
  const tagged =
    error instanceof Error
      ? (error as Error & {
          auditOnly?: boolean;
          code?: string;
          completedJob?: ReturnType<typeof presentKuaishouEcpmSyncJob>;
          savedCount?: number;
          source?: 'kuaishou';
        })
      : (new Error(readErrorMessage(error)) as Error & {
          auditOnly?: boolean;
          code?: string;
          completedJob?: ReturnType<typeof presentKuaishouEcpmSyncJob>;
          savedCount?: number;
          source?: 'kuaishou';
        });
  tagged.auditOnly = true;
  tagged.code = 'AUDIT_LOG_FAILED';
  tagged.completedJob = metadata.completedJob;
  tagged.savedCount = metadata.savedCount;
  tagged.source = metadata.source;

  return tagged;
}
