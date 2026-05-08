import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PrincipalType,
  SettlementBatchStatus,
  SettlementStatus,
  type Prisma,
  type RawEcpm,
  type SettlementBatch,
  type SettlementBatchItem,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export type SettlementAdminPrisma = Pick<
  PrismaService,
  | '$transaction'
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
    userId: string | null;
  } | null;
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

export class BudgetExceededException extends ConflictException {
  constructor() {
    super('Game budget is insufficient');
  }
}

@Injectable()
export class SettlementAdminService {
  constructor(
    @Inject(PrismaService) private readonly prisma: SettlementAdminPrisma,
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

    const game = await this.findGameOrThrow(input.gameId);
    const boundRows = await this.findPendingRows(input, true);
    const unboundRows = await this.findPendingRows(input, false);

    if (boundRows.length === 0) {
      throw new BadRequestException('No bound pending ECPM rows to settle');
    }

    const settlementAmountLi = sumDisplayAmount(boundRows);
    if (game.budgetLi < settlementAmountLi) {
      await this.persistBudgetInsufficient(input, {
        budgetLi: game.budgetLi,
        gameId: game.id,
        requiredLi: settlementAmountLi,
        settlementCount: boundRows.length,
        unboundCount: unboundRows.length,
      });
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const service = new SettlementAdminService(
          tx as unknown as SettlementAdminPrisma,
        );
        const game = await service.findGameOrThrow(input.gameId);
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
            configSnapshot: createSettlementConfigSnapshot(),
            endedAt: input.endedAt,
            gameId: game.id,
            items: {
              create: boundRows.map((row) => ({
                displayAmountLi: row.displayAmountLi,
                gameOpenIdId: row.openIdRecordId as string,
                openId: row.openId,
                rawEcpmId: row.id,
                settlementAmountLi: row.displayAmountLi,
                userId: row.openIdRecord?.userId as string,
              })),
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

        for (const [userId, amountLi] of sumByUser(boundRows)) {
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
              settledAmountLi: settlementAmountLi.toString(),
              settledCount: boundRows.length,
              startedAt: input.startedAt.toISOString(),
              unboundCount: unboundRows.length,
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

  listBatches(input: { gameId?: string } = {}) {
    return this.prisma.settlementBatch.findMany({
      include: {
        items: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20,
      where: input.gameId
        ? {
            gameId: input.gameId,
          }
        : undefined,
    }) as Promise<SettlementBatchWithItems[]>;
  }

  async getBatch(batchId: string) {
    const batch = await this.prisma.settlementBatch.findUnique({
      include: {
        items: true,
      },
      where: {
        id: batchId,
      },
    });

    if (!batch) {
      throw new NotFoundException(`Settlement batch ${batchId} is not found`);
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
        openIdRecord: true,
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

function createSettlementConfigSnapshot(): Prisma.InputJsonObject {
  return {
    displayAmountBasis: 'raw_ecpm.displayAmountLi',
    source: 'admin_settlement_mvp',
  };
}

function sumDisplayAmount(rows: PendingSettlementRow[]) {
  return rows.reduce((total, row) => total + row.displayAmountLi, 0n);
}

function countUsers(rows: PendingSettlementRow[]) {
  return new Set(rows.map((row) => row.openIdRecord?.userId).filter(Boolean))
    .size;
}

function sumByUser(rows: PendingSettlementRow[]) {
  const totals = new Map<string, bigint>();
  for (const row of rows) {
    const userId = row.openIdRecord?.userId;
    if (!userId) {
      continue;
    }
    totals.set(userId, (totals.get(userId) ?? 0n) + row.displayAmountLi);
  }

  return totals;
}
