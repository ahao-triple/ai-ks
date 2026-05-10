import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { yuanToLi } from '../../domain/money/amount';
import { presentMoneyLi } from '../../common/presenters/money-presenter';
import {
  AgentAuthService,
  type AgentPrincipal,
} from './agent-auth.service';
import { AgentJwtGuard } from './agent-jwt.guard';
import {
  AgentPortalService,
  type AgentEarningsResult,
  type AgentUsersResult,
  type AgentWithdrawalBatch,
} from './agent-portal.service';
import { CurrentAgent } from './current-agent.decorator';

const idSchema = z.string().trim().min(1);

const loginSchema = z.object({
  password: idSchema,
  username: idSchema,
});

const updateAlipayProfileSchema = z.object({
  alipayAccount: idSchema,
  alipayRealName: idSchema,
});

const requestWithdrawalSchema = z.object({
  amountYuan: idSchema,
});

@Controller('agents')
export class AgentController {
  constructor(
    private readonly agentAuthService: AgentAuthService,
    private readonly agentPortalService: AgentPortalService,
  ) {}

  @Post('login')
  login(@Body() body: unknown) {
    const input = parseBody(loginSchema, body, '代理登录信息不完整');

    return this.agentAuthService.login(input);
  }

  @Get('me')
  @UseGuards(AgentJwtGuard)
  async getOwnProfile(@CurrentAgent() agent: AgentPrincipal) {
    const profile = await this.agentPortalService.getProfile(agent.id);

    return presentAgentProfile(profile);
  }

  @Get('me/earnings')
  @UseGuards(AgentJwtGuard)
  async listOwnEarnings(@CurrentAgent() agent: AgentPrincipal) {
    const earnings = await this.agentPortalService.listEarnings(agent.id);

    return presentAgentEarnings(earnings);
  }

  @Get('me/users')
  @UseGuards(AgentJwtGuard)
  async listOwnUsers(@CurrentAgent() agent: AgentPrincipal) {
    const result = await this.agentPortalService.listUsers(agent.id);

    return presentAgentUsers(result);
  }

  @Get('me/alipay')
  @UseGuards(AgentJwtGuard)
  getOwnAlipayProfile(@CurrentAgent() agent: AgentPrincipal) {
    return this.agentPortalService.getAlipayProfile(agent.id);
  }

  @Patch('me/alipay')
  @UseGuards(AgentJwtGuard)
  updateOwnAlipayProfile(
    @CurrentAgent() agent: AgentPrincipal,
    @Body() body: unknown,
  ) {
    const input = parseBody(
      updateAlipayProfileSchema,
      body,
      '代理支付宝信息不完整',
    );

    return this.agentPortalService.updateAlipayProfile({
      agentId: agent.id,
      alipayAccount: input.alipayAccount,
      alipayRealName: input.alipayRealName,
    });
  }

  @Get('me/withdrawals')
  @UseGuards(AgentJwtGuard)
  async listOwnWithdrawals(@CurrentAgent() agent: AgentPrincipal) {
    const withdrawals = await this.agentPortalService.listWithdrawals(agent.id);

    return {
      batches: withdrawals.map(presentWithdrawalBatch),
    };
  }

  @Post('me/withdrawals')
  @UseGuards(AgentJwtGuard)
  async requestOwnWithdrawal(
    @CurrentAgent() agent: AgentPrincipal,
    @Body() body: unknown,
  ) {
    const input = parseBody(
      requestWithdrawalSchema,
      body,
      '代理提现信息不完整',
    );
    const withdrawal = await this.agentPortalService.requestWithdrawal({
      agentId: agent.id,
      amountLi: parsePositiveAmountLi(input.amountYuan),
    });

    return presentWithdrawalBatch(withdrawal);
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

function parsePositiveAmountLi(value: string) {
  try {
    const amountLi = yuanToLi(value);
    if (amountLi <= 0n) {
      throw new BadRequestException('提现金额必须大于 0');
    }

    return amountLi;
  } catch (error) {
    if (error instanceof BadRequestException) {
      throw error;
    }

    throw new BadRequestException('提现金额格式不正确');
  }
}

function presentAgentProfile(agent: {
  alipayAccount: string | null;
  alipayRealName: string | null;
  availableBalanceLi: bigint;
  frozenBalanceLi: bigint;
  id: string;
  invitationCode: string;
  username: string;
}) {
  return {
    alipayAccount: agent.alipayAccount,
    alipayRealName: agent.alipayRealName,
    availableBalance: presentMoneyLi(agent.availableBalanceLi),
    frozenBalance: presentMoneyLi(agent.frozenBalanceLi),
    id: agent.id,
    invitationCode: agent.invitationCode,
    username: agent.username,
  };
}

function presentAgentEarnings(result: AgentEarningsResult) {
  return {
    rows: result.rows.map((row) => ({
      amount: presentMoneyLi(row.amountLi),
      batchId: row.batchId,
      createdAt: row.createdAt.toISOString(),
      id: row.id,
      itemId: row.itemId,
      openId: row.openId,
      rawEcpmId: row.rawEcpmId,
      role: row.role,
      settlementAmount: presentMoneyLi(row.settlementAmountLi),
      userId: row.userId,
    })),
    totalAmount: presentMoneyLi(result.totalAmountLi),
  };
}

function presentAgentUsers(result: AgentUsersResult) {
  return {
    rows: result.rows.map((row) => ({
      createdAt: row.createdAt.toISOString(),
      currentAgentId: row.currentAgentId,
      currentAgentInvitationCode: row.currentAgentInvitationCode,
      currentAgentUsername: row.currentAgentUsername,
      id: row.id,
      readableId: row.readableId,
      relation: row.relation,
      username: row.username,
    })),
    totalCount: result.totalCount,
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
