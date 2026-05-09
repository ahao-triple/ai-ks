import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  Prisma,
  PrincipalType,
  SettlementBatchStatus,
  SettlementStatus,
  type RawEcpm,
  type SettlementBatch,
  type SettlementBatchItem,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  computeSettlementSplit,
  type SettlementSplitRule,
} from '../../domain/settlement/settlement-split';
import { AdminAccessControlService } from '../admin-auth/admin-access-control.service';
import { type AdminPrincipal } from '../admin-auth/admin-auth.service';
import {
  DEFAULT_PLATFORM_CONFIG,
  PlatformConfigService,
  snapshotPlatformConfig,
  type PlatformBusinessConfig,
} from '../platform-config/platform-config.service';

export type SettlementAdminPrisma = Pick<
  PrismaService,
  | '$transaction'
  | '$queryRaw'
  | 'agent'
  | 'auditLog'
  | 'game'
  | 'rawEcpm'
  | 'settlementBatch'
  | 'userAccount'
>;

export type SettlementRangeInput = {
  endedAt: Date;
  gameId: string;
  startedAt: Date;
  userId?: string;
};

export type ConfirmSettlementInput = SettlementRangeInput & {
  operatorId: string;
  operatorType: PrincipalType;
};

type PendingSettlementRow = RawEcpm & {
  openIdRecord: {
    id: string;
    user?: {
      currentAgent?: {
        id: string;
        parentAgent?: {
          id: string;
        } | null;
        parentAgentId: string | null;
      } | null;
      currentAgentId: string | null;
    } | null;
    userId: string | null;
  } | null;
};

type SettlementItemAllocation = {
  defaultAgentAmountLi: bigint;
  defaultAgentId: string | null;
  directAgentAmountLi: bigint;
  directAgentId: string | null;
  displayAmountLi: bigint;
  feeAmountLi: bigint;
  gameOpenIdId: string;
  openId: string;
  parentAgentAmountLi: bigint;
  parentAgentId: string | null;
  rawEcpmId: string;
  settlementAmountLi: bigint;
  splitSnapshot: Prisma.InputJsonObject;
  userAmountLi: bigint;
  userId: string;
};

type LockedSettlementGame = {
  budgetLi: bigint;
  companyId: string;
  id: string;
};

type LockedOpenId = {
  id: string;
  userId: string | null;
};

export type SettlementPreviewResult = {
  budgetAfterLi: bigint;
  budgetBeforeLi: bigint;
  canConfirm: boolean;
  companyId: string;
  gameId: string;
  settlementAmountLi: bigint;
  settlementCount: number;
  unboundCount: number;
  userCount: number;
};

export type SettlementBatchWithItems = SettlementBatch & {
  items: SettlementBatchItem[];
};

export type ConfirmSettlementResult = {
  batch: SettlementBatchWithItems;
  items: SettlementBatchItem[];
};

export type ListSettlementBatchesInput = {
  admin: AdminPrincipal;
  gameId?: string;
};

export type GetSettlementBatchInput = {
  admin: AdminPrincipal;
  batchId: string;
};

export class BudgetExceededException extends ConflictException {
  constructor() {
    super('Game budget is insufficient');
  }
}

@Injectable()
export class SettlementAdminService {
  constructor(
    @Inject(PrismaService) private readonly prisma: SettlementAdminPrisma,
    private readonly accessControlService: AdminAccessControlService,
    @Optional()
    private readonly platformConfigService?: Pick<
      PlatformConfigService,
      'getConfig'
    >,
  ) {}

  async previewSettlement(
    input: SettlementRangeInput,
  ): Promise<SettlementPreviewResult> {
    this.assertValidRange(input);
    const game = await this.findGameOrThrow(input.gameId);
    const [boundRows, unboundRows] = await Promise.all([
      this.findPendingRows(input, true),
      this.findPendingRows(input, false),
    ]);
    const settlementAmountLi = sumDisplayAmount(boundRows);

    return {
      budgetAfterLi: game.budgetLi - settlementAmountLi,
      budgetBeforeLi: game.budgetLi,
      canConfirm: boundRows.length > 0 && game.budgetLi >= settlementAmountLi,
      companyId: game.companyId,
      gameId: game.id,
      settlementAmountLi,
      settlementCount: boundRows.length,
      unboundCount: unboundRows.length,
      userCount: countUsers(boundRows),
    };
  }

  async confirmSettlement(
    input: ConfirmSettlementInput,
  ): Promise<ConfirmSettlementResult> {
    this.assertValidRange(input);
    const platformConfig = await this.getPlatformConfig();

    try {
      return await this.prisma.$transaction(async (tx) => {
        const service = new SettlementAdminService(
          tx as unknown as SettlementAdminPrisma,
          this.accessControlService,
          this.platformConfigService,
        );
        const lockedGame = await tx.$queryRaw<LockedSettlementGame[]>(
          Prisma.sql`
            SELECT id, company_id AS "companyId", budget_li AS "budgetLi"
            FROM games
            WHERE id = ${input.gameId}
            FOR UPDATE
          `,
        );
        const game = lockedGame[0];
        if (!game) {
          throw new NotFoundException(`Game ${input.gameId} is not found`);
        }

        const boundRows = await service.findPendingRows(input, true);
        const unboundRows = await service.findPendingRows(input, false);

        if (boundRows.length === 0) {
          throw new BadRequestException('No bound pending ECPM rows to settle');
        }

        const settlementAmountLi = sumDisplayAmount(boundRows);
        if (game.budgetLi < settlementAmountLi) {
          throw new SettlementBudgetInsufficientError(
            game.id,
            game.budgetLi,
            settlementAmountLi,
            boundRows.length,
            unboundRows.length,
          );
        }

        this.assertLockedOpenIdsMatch(
          game.id,
          boundRows,
          await lockOpenIds(tx, boundRows),
        );
        const itemAllocations = boundRows.map((row) =>
          createSettlementItemAllocation(row, platformConfig),
        );

        let updatedCount = 0;
        for (const row of boundRows) {
          const updated = await tx.rawEcpm.updateMany({
            data: {
              status: SettlementStatus.SETTLED,
            },
            where: {
              id: row.id,
              openIdRecord: {
                is: {
                  userId: row.openIdRecord?.userId as string,
                },
              },
              openIdRecordId: row.openIdRecordId as string,
              status: SettlementStatus.PENDING,
            },
          });
          updatedCount += updated.count;
        }

        if (updatedCount !== boundRows.length) {
          throw new SettlementConflictError(
            game.id,
            boundRows.length,
            updatedCount,
          );
        }

        const batch = await tx.settlementBatch.create({
          data: {
            budgetAfterLi: game.budgetLi - settlementAmountLi,
            budgetBeforeLi: game.budgetLi,
            companyId: game.companyId,
            configSnapshot: createSettlementConfigSnapshot(platformConfig),
            endedAt: input.endedAt,
            gameId: game.id,
            items: {
              create: itemAllocations,
            },
            operatorId: input.operatorId,
            operatorType: input.operatorType,
            settledAmountLi: settlementAmountLi,
            settledCount: boundRows.length,
            startedAt: input.startedAt,
            status: SettlementBatchStatus.CONFIRMED,
            userCount: countUsers(boundRows),
          },
          include: {
            items: true,
          },
        });

        for (const [userId, amountLi] of sumByUser(itemAllocations)) {
          await tx.userAccount.update({
            data: {
              availableBalanceLi: {
                increment: amountLi,
              },
            },
            where: {
              id: userId,
            },
          });
        }

        let creditedAgentCount = 0;
        const agentTotals = sumByAgent(itemAllocations);
        for (const [agentId, amountLi] of agentTotals) {
          const updatedAgent = await tx.agent.updateMany({
            data: {
              availableBalanceLi: {
                increment: amountLi,
              },
            },
            where: {
              deletedAt: null,
              enabled: true,
              id: agentId,
            },
          });
          creditedAgentCount += updatedAgent.count;
        }
        if (creditedAgentCount !== agentTotals.size) {
          throw new SettlementConflictError(
            game.id,
            agentTotals.size,
            creditedAgentCount,
          );
        }

        const updatedGame = await tx.game.updateMany({
          data: {
            budgetLi: {
              decrement: settlementAmountLi,
            },
            settlementPaused: false,
          },
          where: {
            budgetLi: {
              gte: settlementAmountLi,
            },
            id: game.id,
          },
        });
        if (updatedGame.count !== 1) {
          throw new SettlementBudgetInsufficientError(
            game.id,
            game.budgetLi,
            settlementAmountLi,
            boundRows.length,
            unboundRows.length,
          );
        }

        await tx.auditLog.create({
          data: {
            action: 'settlement.confirmed',
            actorId: input.operatorId,
            actorType: input.operatorType,
            metadata: {
              budgetAfterLi: (game.budgetLi - settlementAmountLi).toString(),
              budgetBeforeLi: game.budgetLi.toString(),
              endedAt: input.endedAt.toISOString(),
              feeAmountLi: sumItemAmount(
                itemAllocations,
                'feeAmountLi',
              ).toString(),
              agentAmountLi: sumAgentAmount(itemAllocations).toString(),
              settledAmountLi: settlementAmountLi.toString(),
              settledCount: boundRows.length,
              startedAt: input.startedAt.toISOString(),
              unboundCount: unboundRows.length,
              userAmountLi: sumItemAmount(
                itemAllocations,
                'userAmountLi',
              ).toString(),
              userCount: countUsers(boundRows),
            },
            targetId: batch.id,
            targetType: 'settlement_batch',
          },
        });

        return {
          batch: batch as SettlementBatchWithItems,
          items: batch.items,
        };
      });
    } catch (error) {
      if (error instanceof SettlementBudgetInsufficientError) {
        await this.persistBudgetInsufficient(input, {
          budgetLi: error.budgetLi,
          gameId: error.gameId,
          requiredLi: error.requiredLi,
          settlementCount: error.settlementCount,
          unboundCount: error.unboundCount,
        });
      }
      if (error instanceof SettlementConflictError) {
        await this.prisma.auditLog.create({
          data: {
            action: 'settlement.conflict',
            actorId: input.operatorId,
            actorType: input.operatorType,
            metadata: {
              expectedCount: error.expectedCount,
              updatedCount: error.updatedCount,
            },
            targetId: error.gameId,
            targetType: 'game',
          },
        });
        throw new ConflictException('Settlement data changed, preview again');
      }
      throw error;
    }
  }

  private assertLockedOpenIdsMatch(
    gameId: string,
    boundRows: PendingSettlementRow[],
    lockedOpenIds: LockedOpenId[],
  ) {
    const lockedById = new Map(lockedOpenIds.map((row) => [row.id, row]));
    for (const row of boundRows) {
      const openIdRecordId = row.openIdRecordId;
      const snapshotUserId = row.openIdRecord?.userId;
      if (
        !openIdRecordId ||
        !snapshotUserId ||
        lockedById.get(openIdRecordId)?.userId !== snapshotUserId
      ) {
        throw new SettlementConflictError(gameId, boundRows.length, 0);
      }
    }
  }

  private async persistBudgetInsufficient(
    input: ConfirmSettlementInput,
    failure: {
      budgetLi: bigint;
      gameId: string;
      requiredLi: bigint;
      settlementCount: number;
      unboundCount: number;
    },
  ): Promise<never> {
    await this.prisma.game.update({
      data: {
        settlementPaused: true,
      },
      where: {
        id: failure.gameId,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        action: 'settlement.budget_insufficient',
        actorId: input.operatorId,
        actorType: input.operatorType,
        metadata: {
          budgetLi: failure.budgetLi.toString(),
          endedAt: input.endedAt.toISOString(),
          requiredLi: failure.requiredLi.toString(),
          settlementCount: failure.settlementCount,
          startedAt: input.startedAt.toISOString(),
          unboundCount: failure.unboundCount,
        },
        targetId: failure.gameId,
        targetType: 'game',
      },
    });
    throw new BudgetExceededException();
  }

  async listBatches(input: ListSettlementBatchesInput) {
    const scope = await this.accessControlService.resolveReadScope(input.admin);
    const scopedGameIds = scope.gameIds ?? [];
    const allowedGameIds = input.gameId
      ? scopedGameIds.includes(input.gameId)
        ? [input.gameId]
        : []
      : scopedGameIds;
    const where = scope.isSuperAdmin
      ? input.gameId
        ? {
            gameId: input.gameId,
          }
        : undefined
      : {
          gameId: {
            in: allowedGameIds,
          },
        };

    return this.prisma.settlementBatch.findMany({
      include: {
        items: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20,
      where,
    }) as Promise<SettlementBatchWithItems[]>;
  }

  async getBatch(input: GetSettlementBatchInput) {
    const scope = await this.accessControlService.resolveReadScope(input.admin);
    const batch = await this.prisma.settlementBatch.findUnique({
      include: {
        items: true,
      },
      where: {
        id: input.batchId,
      },
    });

    if (!batch) {
      throw new NotFoundException(
        `Settlement batch ${input.batchId} is not found`,
      );
    }

    if (!scope.isSuperAdmin && !(scope.gameIds ?? []).includes(batch.gameId)) {
      throw new ForbiddenException('无权限访问该操作');
    }

    return batch as SettlementBatchWithItems;
  }

  private assertValidRange(input: SettlementRangeInput) {
    if (input.startedAt > input.endedAt) {
      throw new BadRequestException('Settlement start time cannot be after end');
    }
  }

  private async findGameOrThrow(gameId: string) {
    const game = await this.prisma.game.findUnique({
      where: {
        id: gameId,
      },
    });

    if (!game) {
      throw new NotFoundException(`Game ${gameId} is not found`);
    }

    return game;
  }

  private getPlatformConfig() {
    return this.platformConfigService?.getConfig() ?? DEFAULT_PLATFORM_CONFIG;
  }

  private findPendingRows(input: SettlementRangeInput, bound: boolean) {
    const baseWhere = {
      eventTime: {
        gte: input.startedAt,
        lte: input.endedAt,
      },
      gameId: input.gameId,
      status: SettlementStatus.PENDING,
    };

    const relationWhere = bound
      ? {
          openIdRecord: {
            is: input.userId
              ? {
                  userId: input.userId,
                }
              : {
                  userId: {
                    not: null,
                  },
                },
          },
        }
      : {
          OR: [
            {
              openIdRecord: {
                is: {
                  userId: null,
                },
              },
            },
            {
              openIdRecordId: null,
            },
          ],
        };

    return this.prisma.rawEcpm.findMany({
      include: {
        openIdRecord: {
          include: {
            user: {
              include: {
                currentAgent: {
                  include: {
                    parentAgent: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        eventTime: 'asc',
      },
      where: {
        ...baseWhere,
        ...relationWhere,
      },
    }) as Promise<PendingSettlementRow[]>;
  }
}

class SettlementConflictError extends Error {
  constructor(
    readonly gameId: string,
    readonly expectedCount: number,
    readonly updatedCount: number,
  ) {
    super('Settlement update count mismatch');
  }
}

class SettlementBudgetInsufficientError extends Error {
  constructor(
    readonly gameId: string,
    readonly budgetLi: bigint,
    readonly requiredLi: bigint,
    readonly settlementCount: number,
    readonly unboundCount: number,
  ) {
    super('Settlement budget insufficient');
  }
}

function createSettlementConfigSnapshot(
  platformConfig: PlatformBusinessConfig,
): Prisma.InputJsonObject {
  return {
    displayAmountBasis: 'raw_ecpm.displayAmountLi',
    settlementRule: snapshotPlatformConfig(platformConfig),
    source: 'admin_settlement_config_v1',
  };
}

function sumDisplayAmount(rows: PendingSettlementRow[]) {
  return rows.reduce((total, row) => total + row.displayAmountLi, 0n);
}

function countUsers(rows: PendingSettlementRow[]) {
  return new Set(rows.map((row) => row.openIdRecord?.userId).filter(Boolean))
    .size;
}

function sumByUser(items: SettlementItemAllocation[]) {
  const totals = new Map<string, bigint>();
  for (const item of items) {
    totals.set(item.userId, (totals.get(item.userId) ?? 0n) + item.userAmountLi);
  }

  return totals;
}

function sumByAgent(items: SettlementItemAllocation[]) {
  const totals = new Map<string, bigint>();
  for (const item of items) {
    addAgentAmount(totals, item.directAgentId, item.directAgentAmountLi);
    addAgentAmount(totals, item.parentAgentId, item.parentAgentAmountLi);
    addAgentAmount(totals, item.defaultAgentId, item.defaultAgentAmountLi);
  }

  return totals;
}

function addAgentAmount(
  totals: Map<string, bigint>,
  agentId: string | null,
  amountLi: bigint,
) {
  if (!agentId || amountLi <= 0n) {
    return;
  }

  totals.set(agentId, (totals.get(agentId) ?? 0n) + amountLi);
}

function sumItemAmount(
  items: SettlementItemAllocation[],
  field: 'feeAmountLi' | 'userAmountLi',
) {
  return items.reduce((total, item) => total + item[field], 0n);
}

function sumAgentAmount(items: SettlementItemAllocation[]) {
  return items.reduce(
    (total, item) =>
      total +
      item.directAgentAmountLi +
      item.parentAgentAmountLi +
      item.defaultAgentAmountLi,
    0n,
  );
}

function createSettlementItemAllocation(
  row: PendingSettlementRow,
  platformConfig: PlatformBusinessConfig,
): SettlementItemAllocation {
  const userId = row.openIdRecord?.userId;
  const gameOpenIdId = row.openIdRecordId;
  if (!userId || !gameOpenIdId) {
    throw new SettlementConflictError(row.gameId, 1, 0);
  }

  const directAgent = row.openIdRecord?.user?.currentAgent ?? null;
  const parentAgent = directAgent?.parentAgent ?? null;
  const split = computeSettlementSplit({
    displayAmountLi: row.displayAmountLi,
    rule: createSplitRule(platformConfig),
  });
  const orphanedDirectAgentAmountLi = directAgent
    ? 0n
    : split.directAgentAmountLi;
  const orphanedParentAgentAmountLi = parentAgent
    ? 0n
    : split.parentAgentAmountLi;
  const defaultAgentAmountLi =
    split.defaultAgentAmountLi +
    orphanedDirectAgentAmountLi +
    orphanedParentAgentAmountLi;
  const defaultAgentId =
    defaultAgentAmountLi > 0n ? platformConfig.defaultAgentId : null;

  return {
    defaultAgentAmountLi,
    defaultAgentId,
    directAgentAmountLi: directAgent ? split.directAgentAmountLi : 0n,
    directAgentId: directAgent?.id ?? null,
    displayAmountLi: row.displayAmountLi,
    feeAmountLi: split.feeAmountLi,
    gameOpenIdId,
    openId: row.openId,
    parentAgentAmountLi: parentAgent ? split.parentAgentAmountLi : 0n,
    parentAgentId: parentAgent?.id ?? null,
    rawEcpmId: row.id,
    settlementAmountLi: split.totalAmountLi,
    splitSnapshot: {
      defaultAgentAmountLi: defaultAgentAmountLi.toString(),
      defaultAgentId,
      directAgentAmountLi: (directAgent ? split.directAgentAmountLi : 0n).toString(),
      directAgentMissingToDefaultLi: orphanedDirectAgentAmountLi.toString(),
      feeAmountLi: split.feeAmountLi.toString(),
      parentAgentAmountLi: (parentAgent ? split.parentAgentAmountLi : 0n).toString(),
      parentAgentMissingToDefaultLi: orphanedParentAgentAmountLi.toString(),
      rule: snapshotPlatformConfig(platformConfig),
      userAmountLi: split.userAmountLi.toString(),
    },
    userAmountLi: split.userAmountLi,
    userId,
  };
}

function createSplitRule(
  platformConfig: PlatformBusinessConfig,
): SettlementSplitRule {
  return {
    defaultAgentRatioPercent: platformConfig.defaultAgentRatioPercent,
    directAgentRatioPercent: platformConfig.directAgentRatioPercent,
    feeRatioPercent: platformConfig.feeRatioPercent,
    parentAgentRatioPercent: platformConfig.parentAgentRatioPercent,
    userRatioPercent: platformConfig.userSettlementRatioPercent,
  };
}

function lockOpenIds(
  tx: Pick<SettlementAdminPrisma, '$queryRaw'>,
  rows: PendingSettlementRow[],
) {
  const openIdRecordIds = rows.map((row) => row.openIdRecordId as string);
  return tx.$queryRaw<LockedOpenId[]>(
    Prisma.sql`
      SELECT id, user_id AS "userId"
      FROM game_open_ids
      WHERE id IN (${Prisma.join(openIdRecordIds)})
      FOR UPDATE
    `,
  );
}
