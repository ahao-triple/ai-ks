import { BadRequestException } from '@nestjs/common';
import { AdminResourcesController } from './admin-resources.controller';

describe('AdminResourcesController', () => {
  it('presents company lists with money values', async () => {
    const service = createService();
    const controller = new AdminResourcesController(service);

    await expect(controller.listCompanies()).resolves.toEqual({
      companies: [
        {
          balance: {
            li: '12345',
            yuan: '12.35',
          },
          createdAt: '2026-05-08T01:00:00.000Z',
          id: 'company-1',
          name: 'Acme Studio',
          updatedAt: '2026-05-08T01:30:00.000Z',
        },
      ],
    });
  });

  it('creates a company with trimmed input and current admin', async () => {
    const service = createService();
    const controller = new AdminResourcesController(service);

    const result = await controller.createCompany(admin, {
      name: '  New Studio  ',
    });

    expect(result.company.name).toBe('New Studio');
    expect(service.lastCreateCompanyInput).toEqual({
      actor: admin,
      name: 'New Studio',
    });
  });

  it('adjusts company balance with yuan conversion and default reason', async () => {
    const service = createService();
    const controller = new AdminResourcesController(service);

    await controller.adjustCompanyBalance(admin, 'company-1', {
      amountYuan: ' 10.25 ',
      reason: '   ',
    });

    expect(service.lastAdjustCompanyBalanceInput).toEqual({
      actor: admin,
      amountLi: 10250n,
      companyId: 'company-1',
      reason: 'manual_adjustment',
    });
  });

  it('presents game lists with company, budget, and paused status', async () => {
    const service = createService();
    const controller = new AdminResourcesController(service);

    const result = await controller.listGames({
      companyId: ' company-1 ',
    });

    expect(result).toEqual({
      games: [
        {
          budget: {
            li: '6000',
            yuan: '6.00',
          },
          companyId: 'company-1',
          companyName: 'Acme Studio',
          createdAt: '2026-05-08T02:00:00.000Z',
          gameAppId: 'ks_game_001',
          gameSecret: 'secret-1',
          id: 'game-1',
          name: 'Runner',
          settlementPaused: true,
          updatedAt: '2026-05-08T02:30:00.000Z',
        },
      ],
    });
    expect(service.lastListGamesInput).toEqual({
      companyId: 'company-1',
    });
  });

  it('creates a game with trimmed fields and current admin', async () => {
    const service = createService();
    const controller = new AdminResourcesController(service);

    await controller.createGame(admin, {
      companyId: ' company-1 ',
      gameAppId: ' ks_game_002 ',
      gameSecret: ' secret-2 ',
      name: ' Runner 2 ',
    });

    expect(service.lastCreateGameInput).toEqual({
      actor: admin,
      companyId: 'company-1',
      gameAppId: 'ks_game_002',
      gameSecret: 'secret-2',
      name: 'Runner 2',
    });
  });

  it('rejects empty game update bodies', async () => {
    const controller = new AdminResourcesController(createService());

    await expect(controller.updateGame(admin, 'game-1', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      controller.updateGame(admin, 'game-1', {
        name: '   ',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updates a game with trimmed optional fields', async () => {
    const service = createService();
    const controller = new AdminResourcesController(service);

    await controller.updateGame(admin, ' game-1 ', {
      gameSecret: ' secret-2 ',
      name: ' Runner Pro ',
      settlementPaused: false,
    });

    expect(service.lastUpdateGameInput).toEqual({
      actor: admin,
      gameId: 'game-1',
      gameSecret: 'secret-2',
      name: 'Runner Pro',
      settlementPaused: false,
    });
  });

  it('allocates game budget with yuan conversion and default reason', async () => {
    const service = createService();
    const controller = new AdminResourcesController(service);

    const result = await controller.allocateGameBudget(admin, ' game-1 ', {
      amountYuan: '30.00',
      reason: '',
    });

    expect(service.lastAllocateGameBudgetInput).toEqual({
      actor: admin,
      amountLi: 30000n,
      gameId: 'game-1',
      reason: 'manual_allocation',
    });
    expect(result.company.balance.yuan).toBe('9.35');
    expect(result.game.budget.yuan).toBe('6.00');
  });

  it('rejects invalid positive amount inputs', async () => {
    const controller = new AdminResourcesController(createService());

    await expect(
      controller.adjustCompanyBalance(admin, 'company-1', {
        amountYuan: '0',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      controller.allocateGameBudget(admin, 'game-1', {
        amountYuan: '-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

const admin = {
  role: 'SUPER_ADMIN' as const,
  username: 'admin',
};

function createService() {
  const company = {
    id: 'company-1',
    balanceLi: 12345n,
    createdAt: new Date('2026-05-08T01:00:00.000Z'),
    deletedAt: null,
    name: 'Acme Studio',
    updatedAt: new Date('2026-05-08T01:30:00.000Z'),
  };
  const game = {
    id: 'game-1',
    budgetLi: 6000n,
    companyId: 'company-1',
    company,
    createdAt: new Date('2026-05-08T02:00:00.000Z'),
    deletedAt: null,
    gameAppId: 'ks_game_001',
    gameSecret: 'secret-1',
    name: 'Runner',
    settlementPaused: true,
    updatedAt: new Date('2026-05-08T02:30:00.000Z'),
  };

  return {
    lastAdjustCompanyBalanceInput: undefined as unknown,
    lastAllocateGameBudgetInput: undefined as unknown,
    lastCreateCompanyInput: undefined as unknown,
    lastCreateGameInput: undefined as unknown,
    lastListGamesInput: undefined as unknown,
    lastUpdateGameInput: undefined as unknown,
    listCompanies: async () => [company],
    createCompany: async function (input: unknown) {
      this.lastCreateCompanyInput = input;
      return {
        ...company,
        name: (input as { name: string }).name,
      };
    },
    adjustCompanyBalance: async function (input: unknown) {
      this.lastAdjustCompanyBalanceInput = input;
      return company;
    },
    listGames: async function (input: unknown) {
      this.lastListGamesInput = input;
      return [game];
    },
    createGame: async function (input: unknown) {
      this.lastCreateGameInput = input;
      return {
        ...game,
        ...(input as object),
      };
    },
    updateGame: async function (input: unknown) {
      this.lastUpdateGameInput = input;
      return {
        ...game,
        ...(input as object),
      };
    },
    allocateGameBudget: async function (input: unknown) {
      this.lastAllocateGameBudgetInput = input;
      return {
        company: {
          ...company,
          balanceLi: 9350n,
        },
        game,
      };
    },
  } as any;
}
