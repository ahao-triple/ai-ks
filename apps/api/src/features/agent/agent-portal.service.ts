import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  type Agent,
  PrincipalType,
  type SettlementBatchItem,
  type WithdrawalBatch,
  type WithdrawalDetail,
  WithdrawalDetailStatus,
  WithdrawalDetailType,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  DEFAULT_PLATFORM_CONFIG,
  PlatformConfigService,
} from '../platform-config/platform-config.service';

export type AgentPortalPrisma = Pick<
  PrismaService,
  | '$transaction'
  | 'agent'
  | 'settlementBatchItem'
  | 'userAccount'
  | 'withdrawalBatch'
>;

export type AgentEarningRole =
  | 'DIRECT_AGENT'
  | 'PARENT_AGENT'
  | 'DEFAULT_AGENT';

export type AgentEarningRow = {
  amountLi: bigint;
  batchId: string;
  createdAt: Date;
  id: string;
  itemId: string;
  openId: string;
  rawEcpmId: string;
  role: AgentEarningRole;
  settlementAmountLi: bigint;
  userId: string;
};

export type AgentEarningsResult = {
  rows: AgentEarningRow[];
  totalAmountLi: bigint;
};

export type AgentUserRelation = 'CHILD_AGENT' | 'DIRECT';

export type AgentUserRow = {
  createdAt: Date;
  currentAgentId: string;
  currentAgentInvitationCode: string;
  currentAgentUsername: string;
  id: string;
  readableId: string;
  relation: AgentUserRelation;
  username: string;
};

export type AgentUsersResult = {
  rows: AgentUserRow[];
  totalCount: number;
};

export type UpdateAgentOwnAlipayProfileInput = {
  agentId: string;
  alipayAccount: string;
  alipayRealName: string;
};

export type RequestAgentOwnWithdrawalInput = {
  agentId: string;
  amountLi: bigint;
};

export type AgentWithdrawalBatch = WithdrawalBatch & {
  details: WithdrawalDetail[];
};

type SettlementItemWithBatch = SettlementBatchItem & {
  batch: {
    createdAt: Date;
    id: string;
  };
};

@Injectable()
export class AgentPortalService {
  constructor(
    @Inject(PrismaService) private readonly prisma: AgentPortalPrisma,
    @Optional()
    @Inject(PlatformConfigService)
    private readonly platformConfigService?: Pick<
      PlatformConfigService,
      'getConfig'
    >,
  ) {}

  async getProfile(agentId: string): Promise<Agent> {
    return findActiveAgent(this.prisma, agentId);
  }

  async listEarnings(agentId: string): Promise<AgentEarningsResult> {
    const items = (await this.prisma.settlementBatchItem.findMany({
      include: {
        batch: {
          select: {
            createdAt: true,
            id: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      where: {
        OR: [
          {
            directAgentId: agentId,
          },
          {
            parentAgentId: agentId,
          },
          {
            defaultAgentId: agentId,
          },
        ],
      },
    })) as SettlementItemWithBatch[];

    const rows = items.flatMap((item) => presentEarningRows(item, agentId));
    const totalAmountLi = rows.reduce(
      (total, row) => total + row.amountLi,
      0n,
    );

    return {
      rows,
      totalAmountLi,
    };
  }

  async listUsers(agentId: string): Promise<AgentUsersResult> {
    await findActiveAgent(this.prisma, agentId);
    const users = (await this.prisma.userAccount.findMany({
      include: {
        currentAgent: {
          select: {
            id: true,
            invitationCode: true,
            parentAgentId: true,
            username: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      where: {
        deletedAt: null,
        OR: [
          {
            currentAgentId: agentId,
          },
          {
            currentAgent: {
              parentAgentId: agentId,
            },
          },
        ],
      },
    })) as Array<{
      createdAt: Date;
      currentAgent: {
        id: string;
        invitationCode: string;
        parentAgentId: string | null;
        username: string;
      } | null;
      currentAgentId: string | null;
      id: string;
      readableId: string;
      username: string;
    }>;

    const rows = users.flatMap((user) => {
      if (!user.currentAgent || !user.currentAgentId) {
        return [];
      }

      return [
        {
          createdAt: user.createdAt,
          currentAgentId: user.currentAgentId,
          currentAgentInvitationCode: user.currentAgent.invitationCode,
          currentAgentUsername: user.currentAgent.username,
          id: user.id,
          readableId: user.readableId,
          relation:
            user.currentAgentId === agentId
              ? ('DIRECT' as const)
              : ('CHILD_AGENT' as const),
          username: user.username,
        },
      ];
    });

    return {
      rows,
      totalCount: rows.length,
    };
  }

  async getAlipayProfile(agentId: string) {
    const agent = await findActiveAgent(this.prisma, agentId);

    return {
      alipayAccount: agent.alipayAccount,
      alipayRealName: agent.alipayRealName,
    };
  }

  async updateAlipayProfile(input: UpdateAgentOwnAlipayProfileInput) {
    const agent = await findActiveAgent(this.prisma, input.agentId);

    const updated = await this.prisma.agent.update({
      data: {
        alipayAccount: input.alipayAccount,
        alipayRealName: input.alipayRealName,
      },
      where: {
        id: agent.id,
      },
    });

    return {
      alipayAccount: updated.alipayAccount,
      alipayRealName: updated.alipayRealName,
    };
  }

  async requestWithdrawal(
    input: RequestAgentOwnWithdrawalInput,
  ): Promise<AgentWithdrawalBatch> {
    if (input.amountLi <= 0n) {
      throw new BadRequestException('提现金额必须大于 0');
    }

    const agent = await findActiveAgent(this.prisma, input.agentId);
    if (!agent.alipayAccount || !agent.alipayRealName) {
      throw new BadRequestException('请先维护代理支付宝收款信息');
    }

    const recipientAlipay = agent.alipayAccount;
    const recipientName = agent.alipayRealName;
    const platformConfig =
      (await this.platformConfigService?.getConfig()) ??
      DEFAULT_PLATFORM_CONFIG;
    if (input.amountLi < platformConfig.minWithdrawalLi) {
      throw new BadRequestException('提现金额低于最低提现金额');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.agent.updateMany({
        data: {
          availableBalanceLi: {
            decrement: input.amountLi,
          },
          frozenBalanceLi: {
            increment: input.amountLi,
          },
        },
        where: {
          availableBalanceLi: {
            gte: input.amountLi,
          },
          deletedAt: null,
          enabled: true,
          id: agent.id,
        },
      });
      if (updated.count !== 1) {
        throw new BadRequestException('代理可提现余额不足');
      }

      return (await tx.withdrawalBatch.create({
        data: {
          details: {
            create: [
              {
                amountLi: input.amountLi,
                configSnapshot: {
                  minWithdrawalLi: platformConfig.minWithdrawalLi.toString(),
                  source: 'agent_portal_withdrawal_v1',
                },
                recipientAlipay,
                recipientName,
                status: WithdrawalDetailStatus.PENDING_REVIEW,
                type: WithdrawalDetailType.AGENT,
              },
            ],
          },
          ownerId: agent.id,
          ownerType: PrincipalType.AGENT,
          status: 'PENDING_REVIEW',
          totalAmountLi: input.amountLi,
          userId: null,
        },
        include: {
          details: true,
        },
      })) as AgentWithdrawalBatch;
    });
  }

  async listWithdrawals(agentId: string): Promise<AgentWithdrawalBatch[]> {
    await findActiveAgent(this.prisma, agentId);

    return this.prisma.withdrawalBatch.findMany({
      include: {
        details: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      where: {
        ownerId: agentId,
        ownerType: PrincipalType.AGENT,
      },
    }) as Promise<AgentWithdrawalBatch[]>;
  }
}

async function findActiveAgent(
  prisma: Pick<AgentPortalPrisma, 'agent'>,
  agentId: string,
): Promise<Agent> {
  const agent = await prisma.agent.findUnique({
    where: {
      id: agentId,
    },
  });

  if (!agent || agent.deletedAt !== null || !agent.enabled) {
    throw new NotFoundException('代理账号不存在或已停用');
  }

  return agent;
}

function presentEarningRows(
  item: SettlementItemWithBatch,
  agentId: string,
): AgentEarningRow[] {
  const rows: AgentEarningRow[] = [];
  appendRoleRow(rows, item, agentId, {
    agentId: item.directAgentId,
    amountLi: item.directAgentAmountLi,
    role: 'DIRECT_AGENT',
  });
  appendRoleRow(rows, item, agentId, {
    agentId: item.parentAgentId,
    amountLi: item.parentAgentAmountLi,
    role: 'PARENT_AGENT',
  });
  appendRoleRow(rows, item, agentId, {
    agentId: item.defaultAgentId,
    amountLi: item.defaultAgentAmountLi,
    role: 'DEFAULT_AGENT',
  });

  return rows;
}

function appendRoleRow(
  rows: AgentEarningRow[],
  item: SettlementItemWithBatch,
  agentId: string,
  roleInput: {
    agentId: string | null;
    amountLi: bigint;
    role: AgentEarningRole;
  },
) {
  if (roleInput.agentId !== agentId || roleInput.amountLi <= 0n) {
    return;
  }

  rows.push({
    amountLi: roleInput.amountLi,
    batchId: item.batchId ?? item.batch.id,
    createdAt: item.createdAt,
    id: `${item.id}:${roleInput.role}`,
    itemId: item.id,
    openId: item.openId,
    rawEcpmId: item.rawEcpmId,
    role: roleInput.role,
    settlementAmountLi: item.settlementAmountLi,
    userId: item.userId,
  });
}
