import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AdminResourcesController } from './admin-resources.controller';

describe('AdminResourcesController', () => {
  it('presents company lists with money values', async () => {
    const service = createService();
    const controller = new AdminResourcesController(service);

    await expect(controller.listCompanies(admin)).resolves.toEqual({
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
    expect(service.lastListCompaniesInput).toEqual({
      admin,
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

    const result = await controller.listGames(admin, {
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
          ecpmAutoSyncEnabled: false,
          ecpmAutoSyncIntervalHours: 3,
          ecpmAutoSyncLastRunAt: null,
          ecpmAutoSyncNextRunAt: null,
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
      admin,
      companyId: 'company-1',
    });
  });

  it('presents game ECPM auto sync timestamps as ISO strings', async () => {
    const service = createService({
      game: {
        ecpmAutoSyncEnabled: true,
        ecpmAutoSyncLastRunAt: new Date('2026-05-08T03:00:00.000Z'),
        ecpmAutoSyncNextRunAt: new Date('2026-05-08T06:00:00.000Z'),
      },
    });
    const controller = new AdminResourcesController(service);

    const result = await controller.listGames(admin, {});

    expect(result.games[0]).toMatchObject({
      ecpmAutoSyncEnabled: true,
      ecpmAutoSyncLastRunAt: '2026-05-08T03:00:00.000Z',
      ecpmAutoSyncNextRunAt: '2026-05-08T06:00:00.000Z',
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
      ecpmAutoSyncEnabled: undefined,
      ecpmAutoSyncIntervalHours: undefined,
      gameId: 'game-1',
      gameSecret: 'secret-2',
      name: 'Runner Pro',
      settlementPaused: false,
    });
  });

  it('updates game ECPM auto sync config with allowed frequency presets', async () => {
    const service = createService();
    const controller = new AdminResourcesController(service);

    await controller.updateGame(admin, ' game-1 ', {
      ecpmAutoSyncEnabled: true,
      ecpmAutoSyncIntervalHours: 6,
    });

    expect(service.lastUpdateGameInput).toEqual({
      actor: admin,
      ecpmAutoSyncEnabled: true,
      ecpmAutoSyncIntervalHours: 6,
      gameId: 'game-1',
      gameSecret: undefined,
      name: undefined,
      settlementPaused: undefined,
    });
  });

  it('rejects invalid game ECPM auto sync frequency input', async () => {
    const controller = new AdminResourcesController(createService());

    await expect(
      controller.updateGame(admin, 'game-1', {
        ecpmAutoSyncIntervalHours: 2,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
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

  it('clears operational data when confirmation phrase is provided', async () => {
    const service = createService();
    const controller = new AdminResourcesController(service);

    await expect(
      controller.clearOperationalData(admin, {
        confirmation: 'CLEAR_OPERATIONAL_DATA',
      }),
    ).resolves.toEqual({
      success: true,
    });
    expect(service.lastClearOperationalDataInput).toEqual({
      actor: admin,
    });
  });

  it('rejects operational data clear when confirmation phrase is invalid', async () => {
    const controller = new AdminResourcesController(createService());

    await expect(
      controller.clearOperationalData(admin, {
        confirmation: 'RESET_TEST_DATA',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('direct write method calls still reject company admins', async () => {
    const service = createService();
    const controller = new AdminResourcesController(service);
    const companyAdmin = {
      adminId: 'company-admin-1',
      displayName: 'Company Admin',
      role: 'COMPANY_ADMIN' as const,
      username: 'company_admin',
    };

    await expect(
      controller.createCompany(companyAdmin, {
        name: 'New Studio',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      controller.createGame(companyAdmin, {
        companyId: 'company-1',
        gameAppId: 'ks_game_002',
        gameSecret: 'secret-2',
        name: 'Runner 2',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      controller.updateGame(companyAdmin, 'game-1', {
        name: 'Runner Pro',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      controller.allocateGameBudget(companyAdmin, 'game-1', {
        amountYuan: '1.00',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      controller.adjustCompanyBalance(companyAdmin, 'company-1', {
        amountYuan: '1.00',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      controller.clearOperationalData(companyAdmin, {
        confirmation: 'CLEAR_OPERATIONAL_DATA',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(service.lastCreateCompanyInput).toBeUndefined();
    expect(service.lastCreateGameInput).toBeUndefined();
    expect(service.lastUpdateGameInput).toBeUndefined();
    expect(service.lastAllocateGameBudgetInput).toBeUndefined();
    expect(service.lastAdjustCompanyBalanceInput).toBeUndefined();
    expect(service.lastClearOperationalDataInput).toBeUndefined();
  });
});

const admin = {
  role: 'SUPER_ADMIN' as const,
  username: 'admin',
};

function createService(options: { game?: Record<string, unknown> } = {}) {
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
    ecpmAutoSyncEnabled: false,
    ecpmAutoSyncIntervalHours: 3,
    ecpmAutoSyncLastRunAt: null,
    ecpmAutoSyncNextRunAt: null,
    gameAppId: 'ks_game_001',
    gameSecret: 'secret-1',
    name: 'Runner',
    settlementPaused: true,
    updatedAt: new Date('2026-05-08T02:30:00.000Z'),
    ...options.game,
  };

  return {
    lastAdjustCompanyBalanceInput: undefined as unknown,
    lastAllocateGameBudgetInput: undefined as unknown,
    lastClearOperationalDataInput: undefined as unknown,
    lastCreateCompanyInput: undefined as unknown,
    lastCreateGameInput: undefined as unknown,
    lastListCompaniesInput: undefined as unknown,
    lastListGamesInput: undefined as unknown,
    lastUpdateGameInput: undefined as unknown,
    listCompanies: async function (input: unknown) {
      this.lastListCompaniesInput = input;
      return [company];
    },
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
    clearOperationalData: async function (input: unknown) {
      this.lastClearOperationalDataInput = input;
    },
  } as any;
}
