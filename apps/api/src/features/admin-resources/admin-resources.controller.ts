import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { yuanToLi } from '../../domain/money/amount';
import {
  type AdminPrincipal,
  requireSuperAdminPrincipal,
} from '../admin-auth/admin-auth.service';
import { AdminJwtGuard } from '../admin-auth/admin-jwt.guard';
import { CurrentAdmin } from '../admin-auth/current-admin.decorator';
import { SuperAdminGuard } from '../admin-auth/super-admin.guard';
import { presentMoneyLi } from '../../common/presenters/money-presenter';
import {
  AdminResourcesService,
  type AgentWithdrawalBatch,
  type AgentWithParent,
  type GameWithCompany,
} from './admin-resources.service';

const idSchema = z.string().trim().min(1);
const amountSchema = z.string().trim().min(1);
const reasonSchema = z.string().optional();

const createCompanySchema = z.object({
  name: idSchema,
});

const createAgentSchema = z.object({
  invitationCode: idSchema,
  parentAgentId: idSchema.optional().nullable(),
  password: z.string().min(8),
  username: idSchema,
});

const updateAgentAlipaySchema = z.object({
  alipayAccount: idSchema,
  alipayRealName: idSchema,
});

const requestAgentWithdrawalSchema = z.object({
  amountYuan: amountSchema,
});

const adjustCompanyBalanceSchema = z.object({
  amountYuan: amountSchema,
  reason: reasonSchema,
});

const gameListQuerySchema = z.object({
  companyId: idSchema.optional(),
});

const createGameSchema = z.object({
  companyId: idSchema,
  gameAppId: idSchema,
  gameSecret: idSchema,
  name: idSchema,
});

const ecpmAutoSyncIntervalSchema = z.union([
  z.literal(1),
  z.literal(3),
  z.literal(6),
  z.literal(12),
  z.literal(24),
]);

const updateGameSchema = z.object({
  ecpmAutoSyncEnabled: z.boolean().optional(),
  ecpmAutoSyncIntervalHours: ecpmAutoSyncIntervalSchema.optional(),
  gameSecret: idSchema.optional(),
  name: idSchema.optional(),
  settlementPaused: z.boolean().optional(),
});

const allocateGameBudgetSchema = z.object({
  amountYuan: amountSchema,
  reason: reasonSchema,
});

const clearOperationalDataSchema = z.object({
  confirmation: z.literal('CLEAR_OPERATIONAL_DATA'),
});

@Controller()
@UseGuards(AdminJwtGuard)
export class AdminResourcesController {
  constructor(private readonly adminResourcesService: AdminResourcesService) {}

  @Get('admin/companies')
  async listCompanies(@CurrentAdmin() admin: AdminPrincipal) {
    const companies = await this.adminResourcesService.listCompanies({
      admin,
    });

    return {
      companies: companies.map(presentCompany),
    };
  }

  @Post('admin/companies')
  @UseGuards(SuperAdminGuard)
  async createCompany(
    @CurrentAdmin() admin: AdminPrincipal,
    @Body() body: unknown,
  ) {
    const input = parseBody(createCompanySchema, body, 'Company input is invalid');
    const company = await this.adminResourcesService.createCompany({
      actor: requireSuperAdminPrincipal(admin),
      name: input.name,
    });

    return {
      company: presentCompany(company),
    };
  }

  @Post('admin/companies/:companyId/balance-adjustments')
  @UseGuards(SuperAdminGuard)
  async adjustCompanyBalance(
    @CurrentAdmin() admin: AdminPrincipal,
    @Param('companyId') companyId: string,
    @Body() body: unknown,
  ) {
    const input = parseBody(
      adjustCompanyBalanceSchema,
      body,
      'Company balance adjustment is invalid',
    );
    const company = await this.adminResourcesService.adjustCompanyBalance({
      actor: requireSuperAdminPrincipal(admin),
      amountLi: parsePositiveAmountLi(input.amountYuan),
      companyId: parseId(companyId, 'Company id is invalid'),
      reason: normalizeReason(input.reason, 'manual_adjustment'),
    });

    return {
      company: presentCompany(company),
    };
  }

  @Get('admin/agents')
  @UseGuards(SuperAdminGuard)
  async listAgents() {
    const agents = await this.adminResourcesService.listAgents();

    return {
      agents: agents.map(presentAgent),
    };
  }

  @Post('admin/agents')
  @UseGuards(SuperAdminGuard)
  async createAgent(
    @CurrentAdmin() admin: AdminPrincipal,
    @Body() body: unknown,
  ) {
    const input = parseBody(createAgentSchema, body, 'Agent input is invalid');
    const agent = await this.adminResourcesService.createAgent({
      actor: requireSuperAdminPrincipal(admin),
      invitationCode: input.invitationCode,
      parentAgentId: input.parentAgentId,
      password: input.password,
      username: input.username,
    });

    return {
      agent: presentAgent(agent),
    };
  }

  @Patch('admin/agents/:agentId/alipay')
  @UseGuards(SuperAdminGuard)
  async updateAgentAlipay(
    @CurrentAdmin() admin: AdminPrincipal,
    @Param('agentId') agentId: string,
    @Body() body: unknown,
  ) {
    const input = parseBody(
      updateAgentAlipaySchema,
      body,
      'Agent alipay input is invalid',
    );
    const agent = await this.adminResourcesService.updateAgentAlipayProfile({
      actor: requireSuperAdminPrincipal(admin),
      agentId: parseId(agentId, 'Agent id is invalid'),
      alipayAccount: input.alipayAccount,
      alipayRealName: input.alipayRealName,
    });

    return {
      agent: presentAgent({
        ...agent,
        parentAgent: null,
      }),
    };
  }

  @Post('admin/agents/:agentId/withdrawals')
  @UseGuards(SuperAdminGuard)
  async requestAgentWithdrawal(
    @CurrentAdmin() admin: AdminPrincipal,
    @Param('agentId') agentId: string,
    @Body() body: unknown,
  ) {
    const input = parseBody(
      requestAgentWithdrawalSchema,
      body,
      'Agent withdrawal input is invalid',
    );
    const withdrawal = await this.adminResourcesService.requestAgentWithdrawal({
      actor: requireSuperAdminPrincipal(admin),
      agentId: parseId(agentId, 'Agent id is invalid'),
      amountLi: parsePositiveAmountLi(input.amountYuan),
    });

    return presentWithdrawalBatch(withdrawal);
  }

  @Get('admin/games')
  async listGames(@CurrentAdmin() admin: AdminPrincipal, @Query() query: unknown) {
    const input = parseBody(
      gameListQuerySchema,
      query ?? {},
      'Game list query is invalid',
    );
    const games = await this.adminResourcesService.listGames({
      admin,
      companyId: input.companyId,
    });

    return {
      games: games.map(presentGame),
    };
  }

  @Post('admin/games')
  @UseGuards(SuperAdminGuard)
  async createGame(
    @CurrentAdmin() admin: AdminPrincipal,
    @Body() body: unknown,
  ) {
    const input = parseBody(createGameSchema, body, 'Game input is invalid');
    const game = await this.adminResourcesService.createGame({
      actor: requireSuperAdminPrincipal(admin),
      companyId: input.companyId,
      gameAppId: input.gameAppId,
      gameSecret: input.gameSecret,
      name: input.name,
    });

    return {
      game: presentGame(game),
    };
  }

  @Patch('admin/games/:gameId')
  @UseGuards(SuperAdminGuard)
  async updateGame(
    @CurrentAdmin() admin: AdminPrincipal,
    @Param('gameId') gameId: string,
    @Body() body: unknown,
  ) {
    const input = parseBody(updateGameSchema, body, 'Game update is invalid');
    if (
      input.name === undefined &&
      input.gameSecret === undefined &&
      input.settlementPaused === undefined &&
      input.ecpmAutoSyncEnabled === undefined &&
      input.ecpmAutoSyncIntervalHours === undefined
    ) {
      throw new BadRequestException('Game update is invalid');
    }

    const game = await this.adminResourcesService.updateGame({
      actor: requireSuperAdminPrincipal(admin),
      ecpmAutoSyncEnabled: input.ecpmAutoSyncEnabled,
      ecpmAutoSyncIntervalHours: input.ecpmAutoSyncIntervalHours,
      gameId: parseId(gameId, 'Game id is invalid'),
      gameSecret: input.gameSecret,
      name: input.name,
      settlementPaused: input.settlementPaused,
    });

    return {
      game: presentGame(game),
    };
  }

  @Post('admin/games/:gameId/budget-allocations')
  @UseGuards(SuperAdminGuard)
  async allocateGameBudget(
    @CurrentAdmin() admin: AdminPrincipal,
    @Param('gameId') gameId: string,
    @Body() body: unknown,
  ) {
    const input = parseBody(
      allocateGameBudgetSchema,
      body,
      'Game budget allocation is invalid',
    );
    const result = await this.adminResourcesService.allocateGameBudget({
      actor: requireSuperAdminPrincipal(admin),
      amountLi: parsePositiveAmountLi(input.amountYuan),
      gameId: parseId(gameId, 'Game id is invalid'),
      reason: normalizeReason(input.reason, 'manual_allocation'),
    });

    return {
      company: presentCompany(result.company),
      game: presentGame(result.game),
    };
  }

  @Post('admin/system/operational-data/clear')
  @UseGuards(SuperAdminGuard)
  async clearOperationalData(
    @CurrentAdmin() admin: AdminPrincipal,
    @Body() body: unknown,
  ) {
    parseBody(
      clearOperationalDataSchema,
      body,
      'Clear confirmation is invalid',
    );
    await this.adminResourcesService.clearOperationalData({
      actor: requireSuperAdminPrincipal(admin),
    });

    return {
      success: true,
    };
  }
}

function parseBody<T extends z.ZodTypeAny>(
  schema: T,
  body: unknown,
  message: string,
): z.infer<T> {
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) {
    throw new BadRequestException(message);
  }

  return parsed.data;
}

function parseId(value: string, message: string) {
  const parsed = idSchema.safeParse(value);
  if (!parsed.success) {
    throw new BadRequestException(message);
  }

  return parsed.data;
}

function parsePositiveAmountLi(value: string) {
  try {
    const amountLi = yuanToLi(value);
    if (amountLi <= 0n) {
      throw new BadRequestException('Amount must be greater than zero');
    }

    return amountLi;
  } catch (error) {
    if (error instanceof BadRequestException) {
      throw error;
    }

    throw new BadRequestException('Amount is invalid');
  }
}

function normalizeReason(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function presentCompany(company: {
  balanceLi: bigint;
  createdAt: Date;
  id: string;
  name: string;
  updatedAt: Date;
}) {
  return {
    balance: presentMoneyLi(company.balanceLi),
    createdAt: company.createdAt.toISOString(),
    id: company.id,
    name: company.name,
    updatedAt: company.updatedAt.toISOString(),
  };
}

function presentAgent(agent: AgentWithParent) {
  return {
    alipayAccount: agent.alipayAccount,
    alipayRealName: agent.alipayRealName,
    availableBalance: presentMoneyLi(agent.availableBalanceLi),
    createdAt: agent.createdAt.toISOString(),
    enabled: agent.enabled,
    frozenBalance: presentMoneyLi(agent.frozenBalanceLi),
    id: agent.id,
    invitationCode: agent.invitationCode,
    parentAgent: agent.parentAgent,
    parentAgentId: agent.parentAgentId,
    username: agent.username,
  };
}

function presentWithdrawalBatch(batch: AgentWithdrawalBatch) {
  return {
    createdAt: batch.createdAt.toISOString(),
    details: batch.details.map((detail) => ({
      amount: presentMoneyLi(detail.amountLi),
      alipayRequestSnapshot: detail.alipayRequestSnapshot,
      alipayResponseSnapshot: detail.alipayResponseSnapshot,
      errorCode: detail.errorCode,
      errorMessage: detail.errorMessage,
      id: detail.id,
      recipientAlipay: detail.recipientAlipay,
      recipientName: detail.recipientName,
      status: detail.status,
      type: detail.type,
    })),
    id: batch.id,
    ownerId: batch.ownerId,
    ownerType: batch.ownerType,
    status: batch.status,
    totalAmount: presentMoneyLi(batch.totalAmountLi),
    updatedAt: batch.updatedAt.toISOString(),
    userId: batch.userId,
  };
}

function presentGame(
  game: {
    budgetLi: bigint;
    companyId: string;
    createdAt: Date;
    ecpmAutoSyncEnabled: boolean;
    ecpmAutoSyncIntervalHours: number;
    ecpmAutoSyncLastRunAt: Date | null;
    ecpmAutoSyncNextRunAt: Date | null;
    gameAppId: string;
    gameSecret: string;
    id: string;
    name: string;
    settlementPaused: boolean;
    updatedAt: Date;
  } & Partial<Pick<GameWithCompany, 'company'>>,
) {
  return {
    budget: presentMoneyLi(game.budgetLi),
    companyId: game.companyId,
    companyName: game.company?.name ?? '',
    createdAt: game.createdAt.toISOString(),
    ecpmAutoSyncEnabled: game.ecpmAutoSyncEnabled,
    ecpmAutoSyncIntervalHours: game.ecpmAutoSyncIntervalHours,
    ecpmAutoSyncLastRunAt: game.ecpmAutoSyncLastRunAt?.toISOString() ?? null,
    ecpmAutoSyncNextRunAt: game.ecpmAutoSyncNextRunAt?.toISOString() ?? null,
    gameAppId: game.gameAppId,
    gameSecret: game.gameSecret,
    id: game.id,
    name: game.name,
    settlementPaused: game.settlementPaused,
    updatedAt: game.updatedAt.toISOString(),
  };
}
