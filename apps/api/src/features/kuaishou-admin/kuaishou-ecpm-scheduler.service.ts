import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { KuaishouEcpmRangeSyncService } from './kuaishou-ecpm-range-sync.service';
import { KuaishouEcpmSyncJobService } from './kuaishou-ecpm-sync-job.service';

export const KUAISHOU_ECPM_SCHEDULER_NOW = Symbol(
  'KUAISHOU_ECPM_SCHEDULER_NOW',
);

const SCHEDULER_INTERVAL_MS = 60_000;
const HOUR_MS = 60 * 60 * 1000;

type EcpmSchedulerPrisma = Pick<PrismaService, 'game'>;
type SchedulerTimer = ReturnType<typeof setInterval> & {
  unref?: () => void;
};

@Injectable()
export class KuaishouEcpmSchedulerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(KuaishouEcpmSchedulerService.name);
  private isRunning = false;
  private timer?: SchedulerTimer;

  constructor(
    @Inject(PrismaService) private readonly prisma: EcpmSchedulerPrisma,
    private readonly rangeSyncService: KuaishouEcpmRangeSyncService,
    private readonly syncJobService: KuaishouEcpmSyncJobService,
    @Optional()
    @Inject(KUAISHOU_ECPM_SCHEDULER_NOW)
    private readonly nowProvider?: () => Date,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.runDueSyncsOnce().catch((error) => {
        this.logger.warn(
          `Automatic Kuaishou ECPM scheduler run failed: ${readErrorMessage(
            error,
          )}`,
          error instanceof Error ? error.stack : undefined,
        );
      });
    }, SCHEDULER_INTERVAL_MS) as SchedulerTimer;
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  async runDueSyncsOnce() {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    try {
      const now = this.now();
      const games = await this.prisma.game.findMany({
        where: {
          deletedAt: null,
          ecpmAutoSyncEnabled: true,
          ecpmAutoSyncNextRunAt: { lte: now },
        },
      });

      for (const game of games) {
        const nextRunAt = new Date(
          now.getTime() + game.ecpmAutoSyncIntervalHours * HOUR_MS,
        );
        const hasRunningJob = await this.syncJobService.hasRunningJob(
          game.gameAppId,
        );

        if (hasRunningJob) {
          await this.prisma.game.update({
            data: {
              ecpmAutoSyncNextRunAt: nextRunAt,
            },
            where: {
              id: game.id,
            },
          });
          continue;
        }

        try {
          // 定时同步：只刷"当天"。ecpmAutoSyncIntervalHours 字段仅用作触发间隔，
          // 不再决定回看窗口（快手 API 现按天颗粒拉取）。
          await this.rangeSyncService.refreshRange({
            actorId: 'system',
            actorType: 'SYSTEM',
            gameAppId: game.gameAppId,
            markTokenError: false,
          });
        } catch (error) {
          this.logger.warn(
            `Automatic Kuaishou ECPM sync failed for game ${
              game.gameAppId
            }: ${readErrorMessage(error)}`,
            error instanceof Error ? error.stack : undefined,
          );
        }

        await this.prisma.game.update({
          data: {
            ecpmAutoSyncLastRunAt: now,
            ecpmAutoSyncNextRunAt: nextRunAt,
          },
          where: {
            id: game.id,
          },
        });
      }
    } finally {
      this.isRunning = false;
    }
  }

  private now() {
    return this.nowProvider?.() ?? new Date();
  }
}

function readErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'unknown error';
}
