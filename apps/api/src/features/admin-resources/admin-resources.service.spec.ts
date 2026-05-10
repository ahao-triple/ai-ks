import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { type AdminPrincipal } from '../admin-auth/admin-auth.service';
import { AdminResourcesService } from './admin-resources.service';

describe('AdminResourcesService', () => {
  it('keeps super admin company and game list filters unchanged', async () => {
    const prisma = createFakePrisma();
    const service = new AdminResourcesService(prisma, createAccessControl());

    await service.listCompanies({
      admin: adminActor,
    });
    await service.listGames({
      admin: adminActor,
      companyId: 'company-1',
    });

    expect(prisma.lastCompanyFindManyArgs).toEqual({
      orderBy: {
        createdAt: 'asc',
      },
      where: {
        deletedAt: null,
      },
    });
    expect(prisma.lastGameFindManyArgs).toMatchObject({
      where: {
        companyId: 'company-1',
        deletedAt: null,
      },
    });
  });

  it('filters company admin companies and games by resolved read scope', async () => {
    const prisma = createFakePrisma();
    const accessControl = createAccessControl({
      companyIds: ['company-1', 'company-2'],
      gameAppIds: ['ks_game_001'],
      gameIds: ['game-1'],
      isSuperAdmin: false,
    });
    const service = new AdminResourcesService(prisma, accessControl);
    const companyAdmin = createCompanyAdmin();

    await service.listCompanies({
      admin: companyAdmin,
    });
    await service.listGames({
      admin: companyAdmin,
      companyId: 'company-1',
    });

    expect(accessControl.resolveReadScope).toHaveBeenCalledWith(companyAdmin);
    expect(prisma.lastCompanyFindManyArgs).toEqual({
      orderBy: {
        createdAt: 'asc',
      },
      where: {
        deletedAt: null,
        games: {
          some: {
            deletedAt: null,
            id: {
              in: ['game-1'],
            },
          },
        },
        id: {
          in: ['company-1', 'company-2'],
        },
      },
    });
    expect(prisma.lastGameFindManyArgs).toMatchObject({
      where: {
        companyId: 'company-1',
        deletedAt: null,
        id: {
          in: ['game-1'],
        },
      },
    });
  });

  it('clears operational data while preserving companies, games, and admin records', async () => {
    const prisma = createFakePrisma();
    const service = new AdminResourcesService(prisma, createAccessControl());

    await service.clearOperationalData({
      actor: adminActor,
    });

    expect(prisma.executedSql).toHaveLength(1);
    expect(prisma.executedSql[0]).toContain('TRUNCATE TABLE');
    expect(prisma.executedSql[0]).toContain('raw_ecpms');
    expect(prisma.executedSql[0]).toContain('game_open_ids');
    expect(prisma.executedSql[0]).toContain('user_accounts');
    expect(prisma.executedSql[0]).toContain('agents');
    expect(prisma.executedSql[0]).toContain('platform_configs');
    expect(prisma.executedSql[0]).toContain('kuaishou_platform_tokens');
    expect(prisma.executedSql[0]).toContain('ecpm_update_jobs');
    expect(prisma.executedSql[0]).toContain('RESTART IDENTITY CASCADE');
    expect(prisma.executedSql[0]).not.toContain('companies');
    expect(prisma.executedSql[0]).not.toContain('games');
    expect(prisma.executedSql[0]).not.toContain('company_admin_accounts');
    expect(prisma.executedSql[0]).not.toContain('company_admin_scopes');
  });

  it('creates a company with zero balance and writes an audit log', async () => {
    const prisma = createFakePrisma();
    const service = new AdminResourcesService(prisma, createAccessControl());

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

  it('creates and lists agents with balance fields', async () => {
    const prisma = createFakePrisma();
    const service = new AdminResourcesService(prisma, createAccessControl());

    const agent = await service.createAgent({
      actor: adminActor,
      invitationCode: 'DEFAULT_AGENT',
      password: 'agent-pass-123',
      username: 'default_agent',
    });

    await expect(service.listAgents()).resolves.toEqual([agent]);
    expect(agent).toMatchObject({
      availableBalanceLi: 0n,
      frozenBalanceLi: 0n,
      invitationCode: 'DEFAULT_AGENT',
      username: 'default_agent',
    });
    expect(agent.passwordHash).not.toBe('agent-pass-123');
    expect(prisma.auditLogs).toEqual([
      expect.objectContaining({
        action: 'agent.created',
        targetId: agent.id,
        targetType: 'agent',
      }),
    ]);
  });

  it('updates agent alipay profile and requests an agent withdrawal', async () => {
    const prisma = createFakePrisma({
      agents: [
        {
          availableBalanceLi: 5000n,
          id: 'agent-1',
          invitationCode: 'AGENT1',
          passwordHash: 'hash',
          username: 'agent_1',
        },
      ],
    });
    const service = new AdminResourcesService(
      prisma,
      createAccessControl(),
      undefined,
      {
        getConfig: jest.fn(async () => ({
          defaultAgentId: null,
          defaultAgentRatioPercent: 0,
          directAgentRatioPercent: 0,
          displayRatioPercent: 50,
          feeRatioPercent: 0,
          minWithdrawalLi: 1000n,
          parentAgentRatioPercent: 0,
          userSettlementRatioPercent: 100,
        })),
      } as any,
    );

    await service.updateAgentAlipayProfile({
      actor: adminActor,
      agentId: 'agent-1',
      alipayAccount: 'agent@example.com',
      alipayRealName: 'Agent One',
    });
    const withdrawal = await service.requestAgentWithdrawal({
      actor: adminActor,
      agentId: 'agent-1',
      amountLi: 3000n,
    });

    expect(prisma.getAgent('agent-1')).toMatchObject({
      alipayAccount: 'agent@example.com',
      alipayRealName: 'Agent One',
      availableBalanceLi: 2000n,
      frozenBalanceLi: 3000n,
    });
    expect(withdrawal).toMatchObject({
      ownerId: 'agent-1',
      ownerType: 'AGENT',
      status: 'PENDING_REVIEW',
      totalAmountLi: 3000n,
      userId: null,
    });
    expect(withdrawal.details[0]).toMatchObject({
      amountLi: 3000n,
      recipientAlipay: 'agent@example.com',
      recipientName: 'Agent One',
      status: 'PENDING_REVIEW',
      type: 'AGENT',
    });
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
    const service = new AdminResourcesService(prisma, createAccessControl());

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
    const service = new AdminResourcesService(
      createFakePrisma(),
      createAccessControl(),
    );

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
    const service = new AdminResourcesService(prisma, createAccessControl());

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
      ecpmAutoSyncEnabled: false,
      ecpmAutoSyncIntervalHours: 3,
      ecpmAutoSyncLastRunAt: null,
      ecpmAutoSyncNextRunAt: null,
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
    const service = new AdminResourcesService(prisma, createAccessControl());

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
    const service = new AdminResourcesService(prisma, createAccessControl());

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

  it('enables game ECPM auto sync immediately with default next run time', async () => {
    const now = new Date('2026-05-08T05:00:00.000Z');
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
          settlementPaused: false,
        },
      ],
    });
    const service = new AdminResourcesService(
      prisma,
      createAccessControl(),
      () => now,
    );

    const game = await service.updateGame({
      actor: adminActor,
      ecpmAutoSyncEnabled: true,
      ecpmAutoSyncIntervalHours: 3,
      gameId: 'game-1',
    });

    expect(game).toMatchObject({
      ecpmAutoSyncEnabled: true,
      ecpmAutoSyncIntervalHours: 3,
      ecpmAutoSyncNextRunAt: now,
    });
    expect(prisma.getGame('game-1')).toMatchObject({
      ecpmAutoSyncEnabled: true,
      ecpmAutoSyncIntervalHours: 3,
      ecpmAutoSyncNextRunAt: now,
    });
    expect(prisma.auditLogs).toEqual([
      expect.objectContaining({
        action: 'game.updated',
        metadata: {
          changedFields: ['ecpmAutoSyncEnabled', 'ecpmAutoSyncIntervalHours'],
        },
      }),
    ]);
  });

  it('keeps next run when enabling already enabled game ECPM auto sync', async () => {
    const nextRunAt = new Date('2026-05-08T06:00:00.000Z');
    const nowProvider = jest.fn(() => new Date('2026-05-08T07:00:00.000Z'));
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
          companyId: 'company-1',
          ecpmAutoSyncEnabled: true,
          ecpmAutoSyncIntervalHours: 3,
          ecpmAutoSyncNextRunAt: nextRunAt,
          gameAppId: 'ks_game_001',
          gameSecret: 'secret-1',
          name: 'Runner',
        },
      ],
    });
    const service = new AdminResourcesService(
      prisma,
      createAccessControl(),
      nowProvider,
    );

    const game = await service.updateGame({
      actor: adminActor,
      ecpmAutoSyncEnabled: true,
      gameId: 'game-1',
    });

    expect(game).toMatchObject({
      ecpmAutoSyncEnabled: true,
      ecpmAutoSyncNextRunAt: nextRunAt,
    });
    expect(prisma.getGame('game-1')?.ecpmAutoSyncNextRunAt).toBe(nextRunAt);
    expect(nowProvider).not.toHaveBeenCalled();
  });

  it('keeps next run when updating only game ECPM auto sync interval', async () => {
    const nextRunAt = new Date('2026-05-08T06:00:00.000Z');
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
          companyId: 'company-1',
          ecpmAutoSyncEnabled: true,
          ecpmAutoSyncIntervalHours: 3,
          ecpmAutoSyncNextRunAt: nextRunAt,
          gameAppId: 'ks_game_001',
          gameSecret: 'secret-1',
          name: 'Runner',
        },
      ],
    });
    const service = new AdminResourcesService(prisma, createAccessControl());

    const game = await service.updateGame({
      actor: adminActor,
      ecpmAutoSyncIntervalHours: 6,
      gameId: 'game-1',
    });

    expect(game).toMatchObject({
      ecpmAutoSyncEnabled: true,
      ecpmAutoSyncIntervalHours: 6,
      ecpmAutoSyncNextRunAt: nextRunAt,
    });
    expect(prisma.auditLogs).toEqual([
      expect.objectContaining({
        action: 'game.updated',
        metadata: {
          changedFields: ['ecpmAutoSyncIntervalHours'],
        },
      }),
    ]);
  });

  it('rejects unsupported ECPM auto sync frequencies', async () => {
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
          companyId: 'company-1',
          gameAppId: 'ks_game_001',
          gameSecret: 'secret-1',
          name: 'Runner',
        },
      ],
    });
    const service = new AdminResourcesService(prisma, createAccessControl());

    await expect(
      service.updateGame({
        actor: adminActor,
        ecpmAutoSyncIntervalHours: 2,
        gameId: 'game-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('clears next run when disabling game ECPM auto sync', async () => {
    const nextRunAt = new Date('2026-05-08T06:00:00.000Z');
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
          companyId: 'company-1',
          ecpmAutoSyncEnabled: true,
          ecpmAutoSyncIntervalHours: 6,
          ecpmAutoSyncNextRunAt: nextRunAt,
          gameAppId: 'ks_game_001',
          gameSecret: 'secret-1',
          name: 'Runner',
        },
      ],
    });
    const service = new AdminResourcesService(prisma, createAccessControl());

    const game = await service.updateGame({
      actor: adminActor,
      ecpmAutoSyncEnabled: false,
      gameId: 'game-1',
    });

    expect(game).toMatchObject({
      ecpmAutoSyncEnabled: false,
      ecpmAutoSyncNextRunAt: null,
    });
    expect(prisma.getGame('game-1')?.ecpmAutoSyncNextRunAt).toBeNull();
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
    const service = new AdminResourcesService(prisma, createAccessControl());

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
    const service = new AdminResourcesService(prisma, createAccessControl());

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
    const service = new AdminResourcesService(
      createFakePrisma(),
      createAccessControl(),
    );

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

function createCompanyAdmin(): AdminPrincipal {
  return {
    adminId: 'company-admin-1',
    displayName: 'Company Admin',
    role: 'COMPANY_ADMIN',
    username: 'company_admin',
  };
}

function createAccessControl(
  scope = {
    companyIds: undefined,
    gameAppIds: undefined,
    gameIds: undefined,
    isSuperAdmin: true,
  } as any,
): any {
  return {
    resolveReadScope: jest.fn(async () => scope),
  } as any;
}

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
  ecpmAutoSyncEnabled: boolean;
  ecpmAutoSyncIntervalHours: number;
  ecpmAutoSyncLastRunAt: Date | null;
  ecpmAutoSyncNextRunAt: Date | null;
  gameAppId: string;
  gameSecret: string;
  name: string;
  settlementPaused: boolean;
  createdAt: Date;
  deletedAt: Date | null;
  updatedAt: Date;
};

type FakeAgent = {
  id: string;
  alipayAccount: string | null;
  alipayRealName: string | null;
  availableBalanceLi: bigint;
  createdAt: Date;
  deletedAt: Date | null;
  enabled: boolean;
  frozenBalanceLi: bigint;
  invitationCode: string;
  parentAgentId: string | null;
  passwordHash: string;
  updatedAt: Date;
  username: string;
};

type FakeWithdrawalDetail = {
  id: string;
  amountLi: bigint;
  batchId: string;
  recipientAlipay: string;
  recipientName: string;
  status: string;
  type: string;
};

type FakeWithdrawalBatch = {
  id: string;
  createdAt: Date;
  details: FakeWithdrawalDetail[];
  ownerId: string | null;
  ownerType: string;
  status: string;
  totalAmountLi: bigint;
  updatedAt: Date;
  userId: string | null;
};

type FakePrismaSeed = {
  agents?: Array<
    Partial<FakeAgent> &
      Pick<FakeAgent, 'id' | 'invitationCode' | 'passwordHash' | 'username'>
  >;
  companies?: Array<Partial<FakeCompany> & Pick<FakeCompany, 'id' | 'name'>>;
  games?: Array<
    Partial<FakeGame> &
      Pick<FakeGame, 'companyId' | 'gameAppId' | 'gameSecret' | 'id' | 'name'>
  >;
};

function createFakePrisma(seed: FakePrismaSeed = {}) {
  const agents = new Map<string, FakeAgent>();
  const batches = new Map<string, FakeWithdrawalBatch>();
  const companies = new Map<string, FakeCompany>();
  const games = new Map<string, FakeGame>();
  const auditLogs: unknown[] = [];
  const executedSql: string[] = [];
  let companySequence = 1;
  let agentSequence = 1;
  let batchSequence = 1;
  let gameSequence = 1;
  let lastCompanyFindManyArgs: unknown;
  let lastGameFindManyArgs: unknown;

  for (const agent of seed.agents ?? []) {
    agents.set(agent.id, {
      alipayAccount: agent.alipayAccount ?? null,
      alipayRealName: agent.alipayRealName ?? null,
      availableBalanceLi: agent.availableBalanceLi ?? 0n,
      createdAt: agent.createdAt ?? new Date('2026-05-08T00:30:00.000Z'),
      deletedAt: agent.deletedAt ?? null,
      enabled: agent.enabled ?? true,
      frozenBalanceLi: agent.frozenBalanceLi ?? 0n,
      id: agent.id,
      invitationCode: agent.invitationCode,
      parentAgentId: agent.parentAgentId ?? null,
      passwordHash: agent.passwordHash,
      updatedAt: agent.updatedAt ?? new Date('2026-05-08T00:30:00.000Z'),
      username: agent.username,
    });
    agentSequence += 1;
  }

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
      ecpmAutoSyncEnabled: game.ecpmAutoSyncEnabled ?? false,
      ecpmAutoSyncIntervalHours: game.ecpmAutoSyncIntervalHours ?? 3,
      ecpmAutoSyncLastRunAt: game.ecpmAutoSyncLastRunAt ?? null,
      ecpmAutoSyncNextRunAt: game.ecpmAutoSyncNextRunAt ?? null,
      gameAppId: game.gameAppId,
      gameSecret: game.gameSecret,
      id: game.id,
      name: game.name,
      settlementPaused: game.settlementPaused ?? false,
      updatedAt: game.updatedAt ?? new Date('2026-05-08T02:00:00.000Z'),
    });
    gameSequence += 1;
  }

  const withParentAgent = (agent: FakeAgent) => ({
    ...agent,
    parentAgent: agent.parentAgentId
      ? (agents.get(agent.parentAgentId) ?? null)
      : null,
  });

  const prisma = {
    auditLogs,
    executedSql,
    get lastCompanyFindManyArgs() {
      return lastCompanyFindManyArgs;
    },
    get lastGameFindManyArgs() {
      return lastGameFindManyArgs;
    },
    getCompany: (id: string) => companies.get(id),
    getGame: (id: string) => games.get(id),
    getAgent: (id: string) => agents.get(id),
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
    agent: {
      create: async ({ data, include }: any) => {
        if (
          Array.from(agents.values()).some(
            (agent) =>
              agent.username === data.username ||
              agent.invitationCode === data.invitationCode,
          )
        ) {
          const error = new Error('Unique constraint failed');
          Object.assign(error, {
            code: 'P2002',
          });
          throw error;
        }

        const agent: FakeAgent = {
          alipayAccount: null,
          alipayRealName: null,
          availableBalanceLi: 0n,
          createdAt: new Date('2026-05-08T00:30:00.000Z'),
          deletedAt: null,
          enabled: true,
          frozenBalanceLi: 0n,
          id: data.id ?? `agent-${agentSequence++}`,
          invitationCode: data.invitationCode,
          parentAgentId: data.parentAgentId ?? null,
          passwordHash: data.passwordHash,
          updatedAt: new Date('2026-05-08T00:30:00.000Z'),
          username: data.username,
        };
        agents.set(agent.id, agent);
        return include?.parentAgent ? withParentAgent(agent) : agent;
      },
	      findMany: async ({ include }: any = {}) =>
	        Array.from(agents.values())
	          .filter((agent) => agent.deletedAt === null)
	          .map((agent) => (include?.parentAgent ? withParentAgent(agent) : agent)),
	      findUnique: async ({ where }: any) => agents.get(where.id) ?? null,
	      update: async ({ data, where }: any) => {
	        const agent = agents.get(where.id);
	        if (!agent) {
	          throw new Error('agent not found');
	        }
	        const next = {
	          ...agent,
	          ...data,
	          updatedAt: new Date('2026-05-08T04:00:00.000Z'),
	        };
	        agents.set(next.id, next);
	        return next;
	      },
	      updateMany: async ({ data, where }: any) => {
	        const agent = agents.get(where.id);
	        if (
	          !agent ||
	          agent.deletedAt !== where.deletedAt ||
	          agent.enabled !== where.enabled ||
	          agent.availableBalanceLi < where.availableBalanceLi.gte
	        ) {
	          return {
	            count: 0,
	          };
	        }
	        agents.set(agent.id, {
	          ...agent,
	          availableBalanceLi:
	            agent.availableBalanceLi - data.availableBalanceLi.decrement,
	          frozenBalanceLi:
	            agent.frozenBalanceLi + data.frozenBalanceLi.increment,
	          updatedAt: new Date('2026-05-08T04:00:00.000Z'),
	        });
	        return {
	          count: 1,
	        };
	      },
	    },
	    withdrawalBatch: {
	      create: async ({ data }: any) => {
	        const batch: FakeWithdrawalBatch = {
	          createdAt: new Date('2026-05-08T05:00:00.000Z'),
	          details: data.details.create.map((detail: any, index: number) => ({
	            ...detail,
	            batchId: `withdrawal-${batchSequence}`,
	            id: `withdrawal-detail-${index + 1}`,
	          })),
	          id: `withdrawal-${batchSequence++}`,
	          ownerId: data.ownerId ?? null,
	          ownerType: data.ownerType,
	          status: data.status,
	          totalAmountLi: data.totalAmountLi,
	          updatedAt: new Date('2026-05-08T05:00:00.000Z'),
	          userId: data.userId ?? null,
	        };
	        batches.set(batch.id, batch);
	        return batch;
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
      findMany: async (args: any = {}) => {
        lastCompanyFindManyArgs = args;
        return Array.from(companies.values());
      },
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
          ecpmAutoSyncEnabled: data.ecpmAutoSyncEnabled ?? false,
          ecpmAutoSyncIntervalHours: data.ecpmAutoSyncIntervalHours ?? 3,
          ecpmAutoSyncLastRunAt: data.ecpmAutoSyncLastRunAt ?? null,
          ecpmAutoSyncNextRunAt: data.ecpmAutoSyncNextRunAt ?? null,
          gameAppId: data.gameAppId,
          gameSecret: data.gameSecret,
          name: data.name,
          settlementPaused: data.settlementPaused ?? false,
          updatedAt: new Date('2026-05-08T02:00:00.000Z'),
        };
        games.set(game.id, game);
        return game;
      },
      findMany: async (args: any = {}) => {
        lastGameFindManyArgs = args;
        const where = args.where;
        return Array.from(games.values())
          .filter((game) => game.deletedAt === (where?.deletedAt ?? null))
          .filter((game) => !where?.companyId || game.companyId === where.companyId)
          .filter((game) => !where?.id?.in || where.id.in.includes(game.id))
          .map((game) => ({
            ...game,
            company: companies.get(game.companyId) ?? null,
          }));
      },
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
    $executeRawUnsafe: async (sql: string) => {
      executedSql.push(sql);
      return 0;
    },
    $transaction: async (callback: any) => callback(prisma),
  } as any;

  return prisma;
}
