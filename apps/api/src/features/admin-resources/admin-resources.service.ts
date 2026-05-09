import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { type Company, type Game, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AdminAccessControlService } from '../admin-auth/admin-access-control.service';
import { type AdminPrincipal } from '../admin-auth/admin-auth.service';

type AdminResourcesPrisma = Pick<
  PrismaService,
  '$transaction' | 'auditLog' | 'company' | 'game'
>;

export type AdminActor = {
  role: 'SUPER_ADMIN';
  username: string;
};

export type CreateCompanyInput = {
  actor: AdminActor;
  name: string;
};

export type AdjustCompanyBalanceInput = {
  actor: AdminActor;
  amountLi: bigint;
  companyId: string;
  reason?: string;
};

export type ListGamesInput = {
  admin: AdminPrincipal;
  companyId?: string;
};

export type ListCompaniesInput = {
  admin: AdminPrincipal;
};

export type CreateGameInput = {
  actor: AdminActor;
  companyId: string;
  gameAppId: string;
  gameSecret: string;
  name: string;
};

export type UpdateGameInput = {
  actor: AdminActor;
  ecpmAutoSyncEnabled?: boolean;
  ecpmAutoSyncIntervalHours?: number;
  gameId: string;
  gameSecret?: string;
  name?: string;
  settlementPaused?: boolean;
};

export type AllocateGameBudgetInput = {
  actor: AdminActor;
  amountLi: bigint;
  gameId: string;
  reason?: string;
};

export type GameWithCompany = Game & {
  company: Company | null;
};

export type AllocateGameBudgetResult = {
  company: Company;
  game: GameWithCompany;
};

export const ADMIN_RESOURCES_NOW = Symbol('ADMIN_RESOURCES_NOW');

const ALLOWED_ECPM_SYNC_INTERVAL_HOURS = new Set([1, 3, 6, 12, 24]);

@Injectable()
export class AdminResourcesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: AdminResourcesPrisma,
    private readonly accessControlService: AdminAccessControlService,
    @Optional()
    @Inject(ADMIN_RESOURCES_NOW)
    private readonly nowProvider: () => Date = () => new Date(),
  ) {}

  async listCompanies(input: ListCompaniesInput) {
    const scope = await this.accessControlService.resolveReadScope(input.admin);
    const where = scope.isSuperAdmin
      ? {
          deletedAt: null,
        }
      : {
          deletedAt: null,
          games: {
            some: {
              deletedAt: null,
              id: {
                in: scope.gameIds ?? [],
              },
            },
          },
          id: {
            in: scope.companyIds ?? [],
          },
        };

    return this.prisma.company.findMany({
      orderBy: {
        createdAt: 'asc',
      },
      where,
    });
  }

  async createCompany(input: CreateCompanyInput) {
    const company = await this.prisma.company.create({
      data: {
        balanceLi: 0n,
        name: input.name,
      },
    });

    await this.recordAudit(input.actor, {
      action: 'company.created',
      metadata: {
        balanceLi: company.balanceLi.toString(),
        name: company.name,
      },
      targetId: company.id,
      targetType: 'company',
    });

    return company;
  }

  async adjustCompanyBalance(input: AdjustCompanyBalanceInput) {
    this.assertPositiveAmount(input.amountLi);

    return this.prisma.$transaction(async (tx) => {
      const company = await findActiveCompany(tx, input.companyId);
      const balanceBeforeLi = company.balanceLi;
      const updated = await tx.company.update({
        data: {
          balanceLi: {
            increment: input.amountLi,
          },
        },
        where: {
          id: input.companyId,
        },
      });

      await this.recordAudit(input.actor, {
        action: 'company.balance_adjusted',
        metadata: {
          amountLi: input.amountLi.toString(),
          balanceAfterLi: updated.balanceLi.toString(),
          balanceBeforeLi: balanceBeforeLi.toString(),
          reason: input.reason ?? 'manual_adjustment',
        },
        targetId: updated.id,
        targetType: 'company',
      }, tx);

      return updated;
    });
  }

  async listGames(input: ListGamesInput) {
    const scope = await this.accessControlService.resolveReadScope(input.admin);
    const where = scope.isSuperAdmin
      ? {
          ...(input.companyId ? { companyId: input.companyId } : {}),
          deletedAt: null,
        }
      : {
          ...(input.companyId ? { companyId: input.companyId } : {}),
          deletedAt: null,
          id: {
            in: scope.gameIds ?? [],
          },
        };

    return this.prisma.game.findMany({
      include: {
        company: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
      where,
    });
  }

  async createGame(input: CreateGameInput) {
    await findActiveCompany(this.prisma, input.companyId);

    try {
      const game = await this.prisma.game.create({
        data: {
          budgetLi: 0n,
          companyId: input.companyId,
          gameAppId: input.gameAppId,
          gameSecret: input.gameSecret,
          name: input.name,
          settlementPaused: false,
        },
      });

      await this.recordAudit(input.actor, {
        action: 'game.created',
        metadata: {
          companyId: game.companyId,
          gameAppId: game.gameAppId,
          name: game.name,
        },
        targetId: game.id,
        targetType: 'game',
      });

      return game;
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('游戏 AppID 已存在');
      }

      throw error;
    }
  }

  async updateGame(input: UpdateGameInput) {
    const changedFields = collectChangedFields(input);
    if (changedFields.length === 0) {
      throw new BadRequestException('至少提供一个可更新字段');
    }
    if (
      input.ecpmAutoSyncIntervalHours !== undefined &&
      !ALLOWED_ECPM_SYNC_INTERVAL_HOURS.has(input.ecpmAutoSyncIntervalHours)
    ) {
      throw new BadRequestException('不支持的 ECPM 自动同步频率');
    }

    const currentGame = await findActiveGame(this.prisma, input.gameId);
    const data: Prisma.GameUpdateInput = {};
    if (input.name !== undefined) {
      data.name = input.name;
    }
    if (input.gameSecret !== undefined) {
      data.gameSecret = input.gameSecret;
    }
    if (input.settlementPaused !== undefined) {
      data.settlementPaused = input.settlementPaused;
    }
    if (input.ecpmAutoSyncIntervalHours !== undefined) {
      data.ecpmAutoSyncIntervalHours = input.ecpmAutoSyncIntervalHours;
    }
    if (input.ecpmAutoSyncEnabled !== undefined) {
      data.ecpmAutoSyncEnabled = input.ecpmAutoSyncEnabled;
      data.ecpmAutoSyncNextRunAt = input.ecpmAutoSyncEnabled
        ? currentGame.ecpmAutoSyncEnabled
          ? currentGame.ecpmAutoSyncNextRunAt
          : this.nowProvider()
        : null;
    }

    const game = await this.prisma.game.update({
      data,
      where: {
        id: input.gameId,
      },
    });

    await this.recordAudit(input.actor, {
      action: 'game.updated',
      metadata: {
        changedFields,
      },
      targetId: game.id,
      targetType: 'game',
    });

    return game;
  }

  async allocateGameBudget(
    input: AllocateGameBudgetInput,
  ): Promise<AllocateGameBudgetResult> {
    this.assertPositiveAmount(input.amountLi);

    return this.prisma.$transaction(async (tx) => {
      const game = await findActiveGame(tx, input.gameId);
      const company = await findActiveCompany(tx, game.companyId);
      const companyBalanceBeforeLi = company.balanceLi;
      const gameBudgetBeforeLi = game.budgetLi;

      const debited = await tx.company.updateMany({
        data: {
          balanceLi: {
            decrement: input.amountLi,
          },
        },
        where: {
          balanceLi: {
            gte: input.amountLi,
          },
          deletedAt: null,
          id: company.id,
        },
      });

      if (debited.count !== 1) {
        throw new ConflictException('公司余额不足，无法分配游戏预算');
      }

      const updatedGame = await tx.game.update({
        data: {
          budgetLi: {
            increment: input.amountLi,
          },
          settlementPaused: false,
        },
        include: {
          company: true,
        },
        where: {
          id: game.id,
        },
      });
      const updatedCompany = updatedGame.company;
      if (!updatedCompany) {
        throw new NotFoundException(`Company ${game.companyId} is not found`);
      }

      await this.recordAudit(input.actor, {
        action: 'game.budget_allocated',
        metadata: {
          amountLi: input.amountLi.toString(),
          companyBalanceAfterLi: updatedCompany.balanceLi.toString(),
          companyBalanceBeforeLi: companyBalanceBeforeLi.toString(),
          gameBudgetAfterLi: updatedGame.budgetLi.toString(),
          gameBudgetBeforeLi: gameBudgetBeforeLi.toString(),
          reason: input.reason ?? 'manual_allocation',
        },
        targetId: updatedGame.id,
        targetType: 'game',
      }, tx);

      return {
        company: updatedCompany,
        game: updatedGame,
      };
    });
  }

  private assertPositiveAmount(amountLi: bigint) {
    if (amountLi <= 0n) {
      throw new BadRequestException('金额必须大于 0');
    }
  }

  private recordAudit(
    actor: AdminActor,
    input: {
      action: string;
      metadata: Prisma.InputJsonObject;
      targetId: string;
      targetType: string;
    },
    prisma: Pick<AdminResourcesPrisma, 'auditLog'> = this.prisma,
  ) {
    return prisma.auditLog.create({
      data: {
        action: input.action,
        actorId: actor.username,
        actorType: actor.role,
        metadata: input.metadata,
        targetId: input.targetId,
        targetType: input.targetType,
      },
    });
  }
}

async function findActiveCompany(
  prisma: Pick<AdminResourcesPrisma, 'company'>,
  companyId: string,
) {
  const company = await prisma.company.findUnique({
    where: {
      id: companyId,
    },
  });

  if (!company || company.deletedAt) {
    throw new NotFoundException(`Company ${companyId} is not found`);
  }

  return company;
}

async function findActiveGame(
  prisma: Pick<AdminResourcesPrisma, 'game'>,
  gameId: string,
) {
  const game = await prisma.game.findUnique({
    include: {
      company: true,
    },
    where: {
      id: gameId,
    },
  });

  if (!game || game.deletedAt) {
    throw new NotFoundException(`Game ${gameId} is not found`);
  }

  return game;
}

function collectChangedFields(input: UpdateGameInput) {
  return [
    input.name !== undefined ? 'name' : undefined,
    input.gameSecret !== undefined ? 'gameSecret' : undefined,
    input.settlementPaused !== undefined ? 'settlementPaused' : undefined,
    input.ecpmAutoSyncEnabled !== undefined
      ? 'ecpmAutoSyncEnabled'
      : undefined,
    input.ecpmAutoSyncIntervalHours !== undefined
      ? 'ecpmAutoSyncIntervalHours'
      : undefined,
  ].filter((field): field is string => Boolean(field));
}

function isUniqueConstraintError(error: unknown) {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === 'P2002'
  );
}
