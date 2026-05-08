import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AdminResourcesService } from './admin-resources.service';

describe('AdminResourcesService', () => {
  it('creates a company with zero balance and writes an audit log', async () => {
    const prisma = createFakePrisma();
    const service = new AdminResourcesService(prisma);

    const company = await service.createCompany({
      actor: adminActor,
      name: 'Acme Studio',
    });

    expect(company).toMatchObject({
      balanceLi: 0n,
      id: 'company-1',
      name: 'Acme Studio',
    });
    expect(prisma.auditLogs).toEqual([
      expect.objectContaining({
        action: 'company.created',
        actorId: 'admin',
        actorType: 'SUPER_ADMIN',
        targetId: 'company-1',
        targetType: 'company',
      }),
    ]);
  });

  it('adds positive company balance and records before and after amounts', async () => {
    const prisma = createFakePrisma({
      companies: [
        {
          id: 'company-1',
          balanceLi: 1000n,
          name: 'Acme Studio',
        },
      ],
    });
    const service = new AdminResourcesService(prisma);

    const company = await service.adjustCompanyBalance({
      actor: adminActor,
      amountLi: 2500n,
      companyId: 'company-1',
      reason: 'launch budget',
    });

    expect(company.balanceLi).toBe(3500n);
    expect(prisma.getCompany('company-1')?.balanceLi).toBe(3500n);
    expect(prisma.auditLogs).toEqual([
      expect.objectContaining({
        action: 'company.balance_adjusted',
        metadata: {
          amountLi: '2500',
          balanceAfterLi: '3500',
          balanceBeforeLi: '1000',
          reason: 'launch budget',
        },
      }),
    ]);
  });

  it('rejects non-positive company balance adjustments', async () => {
    const service = new AdminResourcesService(createFakePrisma());

    await expect(
      service.adjustCompanyBalance({
        actor: adminActor,
        amountLi: 0n,
        companyId: 'company-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a game for an existing company and writes an audit log', async () => {
    const prisma = createFakePrisma({
      companies: [
        {
          id: 'company-1',
          balanceLi: 0n,
          name: 'Acme Studio',
        },
      ],
    });
    const service = new AdminResourcesService(prisma);

    const game = await service.createGame({
      actor: adminActor,
      companyId: 'company-1',
      gameAppId: 'ks_game_001',
      gameSecret: 'secret-1',
      name: 'Runner',
    });

    expect(game).toMatchObject({
      budgetLi: 0n,
      companyId: 'company-1',
      gameAppId: 'ks_game_001',
      gameSecret: 'secret-1',
      id: 'game-1',
      name: 'Runner',
      settlementPaused: false,
    });
    expect(prisma.auditLogs).toEqual([
      expect.objectContaining({
        action: 'game.created',
        targetId: 'game-1',
        targetType: 'game',
      }),
    ]);
  });

  it('rejects duplicate game app ids with a conflict error', async () => {
    const prisma = createFakePrisma({
      companies: [
        {
          id: 'company-1',
          balanceLi: 0n,
          name: 'Acme Studio',
        },
      ],
      games: [
        {
          id: 'game-1',
          budgetLi: 0n,
          companyId: 'company-1',
          gameAppId: 'ks_game_001',
          gameSecret: 'secret-1',
          name: 'Runner',
          settlementPaused: false,
        },
      ],
    });
    const service = new AdminResourcesService(prisma);

    await expect(
      service.createGame({
        actor: adminActor,
        companyId: 'company-1',
        gameAppId: 'ks_game_001',
        gameSecret: 'secret-2',
        name: 'Shooter',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('updates only allowed game fields and records changed keys', async () => {
    const prisma = createFakePrisma({
      companies: [
        {
          id: 'company-1',
          balanceLi: 0n,
          name: 'Acme Studio',
        },
      ],
      games: [
        {
          id: 'game-1',
          budgetLi: 1000n,
          companyId: 'company-1',
          gameAppId: 'ks_game_001',
          gameSecret: 'secret-1',
          name: 'Runner',
          settlementPaused: true,
        },
      ],
    });
    const service = new AdminResourcesService(prisma);

    const game = await service.updateGame({
      actor: adminActor,
      gameId: 'game-1',
      gameSecret: 'secret-2',
      name: 'Runner Pro',
      settlementPaused: false,
    });

    expect(game).toMatchObject({
      budgetLi: 1000n,
      companyId: 'company-1',
      gameAppId: 'ks_game_001',
      gameSecret: 'secret-2',
      name: 'Runner Pro',
      settlementPaused: false,
    });
    expect(prisma.auditLogs).toEqual([
      expect.objectContaining({
        action: 'game.updated',
        metadata: {
          changedFields: ['name', 'gameSecret', 'settlementPaused'],
        },
      }),
    ]);
  });

  it('allocates company balance into game budget transactionally', async () => {
    const prisma = createFakePrisma({
      companies: [
        {
          id: 'company-1',
          balanceLi: 5000n,
          name: 'Acme Studio',
        },
      ],
      games: [
        {
          id: 'game-1',
          budgetLi: 1000n,
          companyId: 'company-1',
          gameAppId: 'ks_game_001',
          gameSecret: 'secret-1',
          name: 'Runner',
          settlementPaused: true,
        },
      ],
    });
    const service = new AdminResourcesService(prisma);

    const result = await service.allocateGameBudget({
      actor: adminActor,
      amountLi: 3000n,
      gameId: 'game-1',
      reason: 'settlement restart',
    });

    expect(result.company.balanceLi).toBe(2000n);
    expect(result.game).toMatchObject({
      budgetLi: 4000n,
      settlementPaused: false,
    });
    expect(prisma.getCompany('company-1')?.balanceLi).toBe(2000n);
    expect(prisma.getGame('game-1')?.budgetLi).toBe(4000n);
    expect(prisma.auditLogs).toEqual([
      expect.objectContaining({
        action: 'game.budget_allocated',
        metadata: {
          amountLi: '3000',
          companyBalanceAfterLi: '2000',
          companyBalanceBeforeLi: '5000',
          gameBudgetAfterLi: '4000',
          gameBudgetBeforeLi: '1000',
          reason: 'settlement restart',
        },
      }),
    ]);
  });

  it('rejects budget allocation when company balance is insufficient', async () => {
    const prisma = createFakePrisma({
      companies: [
        {
          id: 'company-1',
          balanceLi: 2000n,
          name: 'Acme Studio',
        },
      ],
      games: [
        {
          id: 'game-1',
          budgetLi: 1000n,
          companyId: 'company-1',
          gameAppId: 'ks_game_001',
          gameSecret: 'secret-1',
          name: 'Runner',
          settlementPaused: true,
        },
      ],
    });
    const service = new AdminResourcesService(prisma);

    await expect(
      service.allocateGameBudget({
        actor: adminActor,
        amountLi: 3000n,
        gameId: 'game-1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.getCompany('company-1')?.balanceLi).toBe(2000n);
    expect(prisma.getGame('game-1')?.budgetLi).toBe(1000n);
    expect(prisma.auditLogs).toEqual([]);
  });

  it('rejects missing companies and games', async () => {
    const service = new AdminResourcesService(createFakePrisma());

    await expect(
      service.createGame({
        actor: adminActor,
        companyId: 'missing-company',
        gameAppId: 'ks_game_001',
        gameSecret: 'secret-1',
        name: 'Runner',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.updateGame({
        actor: adminActor,
        gameId: 'missing-game',
        name: 'Runner Pro',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

const adminActor = {
  role: 'SUPER_ADMIN' as const,
  username: 'admin',
};

type FakeCompany = {
  id: string;
  balanceLi: bigint;
  name: string;
  createdAt: Date;
  deletedAt: Date | null;
  updatedAt: Date;
};

type FakeGame = {
  id: string;
  budgetLi: bigint;
  companyId: string;
  gameAppId: string;
  gameSecret: string;
  name: string;
  settlementPaused: boolean;
  createdAt: Date;
  deletedAt: Date | null;
  updatedAt: Date;
};

type FakePrismaSeed = {
  companies?: Array<Partial<FakeCompany> & Pick<FakeCompany, 'id' | 'name'>>;
  games?: Array<
    Partial<FakeGame> &
      Pick<FakeGame, 'companyId' | 'gameAppId' | 'gameSecret' | 'id' | 'name'>
  >;
};

function createFakePrisma(seed: FakePrismaSeed = {}) {
  const companies = new Map<string, FakeCompany>();
  const games = new Map<string, FakeGame>();
  const auditLogs: unknown[] = [];
  let companySequence = 1;
  let gameSequence = 1;

  for (const company of seed.companies ?? []) {
    companies.set(company.id, {
      balanceLi: company.balanceLi ?? 0n,
      createdAt: company.createdAt ?? new Date('2026-05-08T01:00:00.000Z'),
      deletedAt: company.deletedAt ?? null,
      id: company.id,
      name: company.name,
      updatedAt: company.updatedAt ?? new Date('2026-05-08T01:00:00.000Z'),
    });
    companySequence += 1;
  }

  for (const game of seed.games ?? []) {
    games.set(game.id, {
      budgetLi: game.budgetLi ?? 0n,
      companyId: game.companyId,
      createdAt: game.createdAt ?? new Date('2026-05-08T02:00:00.000Z'),
      deletedAt: game.deletedAt ?? null,
      gameAppId: game.gameAppId,
      gameSecret: game.gameSecret,
      id: game.id,
      name: game.name,
      settlementPaused: game.settlementPaused ?? false,
      updatedAt: game.updatedAt ?? new Date('2026-05-08T02:00:00.000Z'),
    });
    gameSequence += 1;
  }

  const prisma = {
    auditLogs,
    getCompany: (id: string) => companies.get(id),
    getGame: (id: string) => games.get(id),
    auditLog: {
      create: async ({ data }: any) => {
        const row = {
          id: `audit-${auditLogs.length + 1}`,
          createdAt: new Date('2026-05-08T03:00:00.000Z'),
          ...data,
        };
        auditLogs.push(row);
        return row;
      },
    },
    company: {
      create: async ({ data }: any) => {
        const company = {
          id: data.id ?? `company-${companySequence++}`,
          balanceLi: data.balanceLi ?? 0n,
          createdAt: new Date('2026-05-08T01:00:00.000Z'),
          deletedAt: null,
          name: data.name,
          updatedAt: new Date('2026-05-08T01:00:00.000Z'),
        };
        companies.set(company.id, company);
        return company;
      },
      findMany: async () => Array.from(companies.values()),
      findUnique: async ({ where }: any) => {
        if ('id' in where) {
          const company = companies.get(where.id);
          return company && company.deletedAt === where.deletedAt
            ? company
            : company ?? null;
        }

        return null;
      },
      update: async ({ data, where }: any) => {
        const company = companies.get(where.id);
        if (!company || company.deletedAt) {
          throw new Error('company not found');
        }

        const next = {
          ...company,
          balanceLi:
            data.balanceLi?.increment === undefined
              ? company.balanceLi
              : company.balanceLi + data.balanceLi.increment,
          updatedAt: new Date('2026-05-08T04:00:00.000Z'),
        };
        companies.set(next.id, next);
        return next;
      },
      updateMany: async ({ data, where }: any) => {
        const company = companies.get(where.id);
        if (
          !company ||
          company.deletedAt !== where.deletedAt ||
          company.balanceLi < where.balanceLi.gte
        ) {
          return {
            count: 0,
          };
        }

        companies.set(company.id, {
          ...company,
          balanceLi: company.balanceLi - data.balanceLi.decrement,
          updatedAt: new Date('2026-05-08T04:00:00.000Z'),
        });
        return {
          count: 1,
        };
      },
    },
    game: {
      create: async ({ data }: any) => {
        if (
          Array.from(games.values()).some(
            (game) => game.gameAppId === data.gameAppId,
          )
        ) {
          const error = new Error('Unique constraint failed');
          Object.assign(error, {
            code: 'P2002',
          });
          throw error;
        }

        const game = {
          id: data.id ?? `game-${gameSequence++}`,
          budgetLi: data.budgetLi ?? 0n,
          companyId: data.companyId,
          createdAt: new Date('2026-05-08T02:00:00.000Z'),
          deletedAt: null,
          gameAppId: data.gameAppId,
          gameSecret: data.gameSecret,
          name: data.name,
          settlementPaused: data.settlementPaused ?? false,
          updatedAt: new Date('2026-05-08T02:00:00.000Z'),
        };
        games.set(game.id, game);
        return game;
      },
      findMany: async ({ where }: any = {}) =>
        Array.from(games.values())
          .filter((game) => game.deletedAt === (where?.deletedAt ?? null))
          .filter((game) => !where?.companyId || game.companyId === where.companyId)
          .map((game) => ({
            ...game,
            company: companies.get(game.companyId) ?? null,
          })),
      findUnique: async ({ include, where }: any) => {
        const game = games.get(where.id);
        if (!game || game.deletedAt !== (where.deletedAt ?? null)) {
          return null;
        }

        return include?.company
          ? {
              ...game,
              company: companies.get(game.companyId) ?? null,
            }
          : game;
      },
      update: async ({ data, include, where }: any) => {
        const game = games.get(where.id);
        if (!game || game.deletedAt) {
          throw new Error('game not found');
        }

        const next = {
          ...game,
          ...data,
          budgetLi:
            data.budgetLi?.increment === undefined
              ? game.budgetLi
              : game.budgetLi + data.budgetLi.increment,
          updatedAt: new Date('2026-05-08T04:00:00.000Z'),
        };
        games.set(next.id, next);
        return include?.company
          ? {
              ...next,
              company: companies.get(next.companyId) ?? null,
            }
          : next;
      },
    },
    $transaction: async (callback: any) => callback(prisma),
  } as any;

  return prisma;
}
