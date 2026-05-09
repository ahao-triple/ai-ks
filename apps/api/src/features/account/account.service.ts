import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { compare, hash } from 'bcryptjs';
import { PrismaService } from '../../common/prisma/prisma.service';
import { generateReadableId } from '../../domain/identity/readable-id';

type AccountPrisma = Pick<
  PrismaService,
  | '$transaction'
  | 'agent'
  | 'gameOpenId'
  | 'rawEcpm'
  | 'userAccount'
  | 'userAgentBindingHistory'
>;

export type RegisterAccountInput = {
  invitationCode?: string | null;
  username: string;
  password: string;
};

export type LoginAccountInput = {
  username: string;
  password: string;
};

export type BindOpenIdInput = {
  userId: string;
  identity: string;
};

export type QueryAccountEarningsInput = {
  userId: string;
  startAt: Date;
  endAt: Date;
};

export type BindAgentByInvitationCodeInput = {
  invitationCode: string;
  userId: string;
};

@Injectable()
export class AccountService {
  constructor(@Inject(PrismaService) private readonly prisma: AccountPrisma) {}

  async register(input: RegisterAccountInput) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const invitationCode = input.invitationCode?.trim() || '';
        const agent = invitationCode
          ? await findActiveAgentByInvitationCode(tx, invitationCode)
          : null;
        const user = await tx.userAccount.create({
          data: {
            currentAgentId: agent?.id ?? null,
            passwordHash: await hash(input.password, 10),
            readableId: generateReadableId(`user:${input.username}`),
            username: input.username,
          },
        });

        if (agent) {
          await tx.userAgentBindingHistory.create({
            data: {
              fromAgentId: null,
              source: 'registration_invitation',
              toAgentId: agent.id,
              userId: user.id,
            },
          });
        }

        return presentAccount(user);
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('用户名已存在，请换一个用户名');
      }

      throw error;
    }
  }

  async login(input: LoginAccountInput) {
    const user = await this.prisma.userAccount.findUnique({
      where: {
        username: input.username,
      },
    });

    if (!user || !(await compare(input.password, user.passwordHash))) {
      throw new UnauthorizedException('账号或密码错误');
    }

    return {
      ...presentAccount(user),
    };
  }

  async getAgentBinding(userId: string) {
    const user = (await this.prisma.userAccount.findUnique({
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
      where: {
        id: userId,
      },
    })) as {
      currentAgent?: {
        id: string;
        invitationCode: string;
        parentAgentId: string | null;
        username: string;
      } | null;
    } | null;
    if (!user) {
      throw new NotFoundException(`User ${userId} is not found`);
    }

    return {
      agent: user.currentAgent ? presentAgentBinding(user.currentAgent) : null,
    };
  }

  async bindAgentByInvitationCode(input: BindAgentByInvitationCodeInput) {
    const invitationCode = input.invitationCode.trim();
    if (!invitationCode) {
      throw new BadRequestException('请输入代理邀请码');
    }

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.userAccount.findUnique({
        where: {
          id: input.userId,
        },
      });
      if (!user) {
        throw new NotFoundException(`User ${input.userId} is not found`);
      }

      const agent = await findActiveAgentByInvitationCode(tx, invitationCode);
      if (user.currentAgentId !== agent.id) {
        await tx.userAccount.update({
          data: {
            currentAgentId: agent.id,
          },
          where: {
            id: user.id,
          },
        });
        await tx.userAgentBindingHistory.create({
          data: {
            fromAgentId: user.currentAgentId,
            source: 'user_invitation',
            toAgentId: agent.id,
            userId: user.id,
          },
        });
      }

      return {
        agent: presentAgentBinding(agent),
      };
    });
  }

  async bindOpenId(input: BindOpenIdInput) {
    const user = await this.prisma.userAccount.findUnique({
      where: {
        id: input.userId,
      },
    });
    if (!user) {
      throw new NotFoundException(`User ${input.userId} is not found`);
    }

    const openIdRecord = await this.findOpenIdByIdentity(input.identity);
    if (!openIdRecord) {
      throw new NotFoundException(`Open id ${input.identity} is not found`);
    }

    const updatedRecord = await this.prisma.gameOpenId.update({
      data: {
        userId: user.id,
      },
      where: {
        openId: openIdRecord.openId,
      },
    });

    return {
      openId: updatedRecord.openId,
      readableId: updatedRecord.readableId,
      userId: updatedRecord.userId,
    };
  }

  async queryEarnings(input: QueryAccountEarningsInput) {
    const user = await this.prisma.userAccount.findUnique({
      where: {
        id: input.userId,
      },
    });
    if (!user) {
      throw new NotFoundException(`User ${input.userId} is not found`);
    }

    const openIdRecords = await this.prisma.gameOpenId.findMany({
      orderBy: {
        createdAt: 'asc',
      },
      where: {
        userId: user.id,
      },
    });
    const openIds = openIdRecords.map((record) => record.openId);

    if (openIds.length === 0) {
      return {
        openIds,
        rows: [],
        totalDisplayAmountLi: 0n,
        totalRawCostLi: 0n,
        userId: user.id,
      };
    }

    const rows = await this.prisma.rawEcpm.findMany({
      orderBy: {
        eventTime: 'asc',
      },
      where: {
        eventTime: {
          gte: input.startAt,
          lt: input.endAt,
        },
        openId: {
          in: openIds,
        },
      },
    });

    return {
      openIds,
      rows,
      totalDisplayAmountLi: sum(rows.map((row) => row.displayAmountLi)),
      totalRawCostLi: sum(rows.map((row) => row.rawCostLi)),
      userId: user.id,
    };
  }

  private async findOpenIdByIdentity(identity: string) {
    const byOpenId = await this.prisma.gameOpenId.findUnique({
      where: {
        openId: identity,
      },
    });
    if (byOpenId) {
      return byOpenId;
    }

    return this.prisma.gameOpenId.findUnique({
      where: {
        readableId: identity,
      },
    });
  }
}

function presentAccount(user: {
  id: string;
  readableId: string;
  username: string;
}) {
  return {
    id: user.id,
    readableId: user.readableId,
    username: user.username,
  };
}

function presentAgentBinding(agent: {
  id: string;
  invitationCode: string;
  parentAgentId?: string | null;
  username: string;
}) {
  return {
    id: agent.id,
    invitationCode: agent.invitationCode,
    parentAgentId: agent.parentAgentId ?? null,
    username: agent.username,
  };
}

async function findActiveAgentByInvitationCode(
  prisma: Pick<AccountPrisma, 'agent'>,
  invitationCode: string,
) {
  const agent = await prisma.agent.findUnique({
    where: {
      invitationCode,
    },
  });

  if (!agent || agent.deletedAt !== null || !agent.enabled) {
    throw new NotFoundException('代理邀请码不存在或已停用');
  }

  return agent;
}

function sum(values: bigint[]) {
  return values.reduce((total, value) => total + value, 0n);
}

function isUniqueConstraintError(error: unknown) {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === 'P2002'
  );
}
