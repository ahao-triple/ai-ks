import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { hash } from 'bcryptjs';
import { PrismaService } from '../../common/prisma/prisma.service';
import { generateReadableId } from '../../domain/identity/readable-id';

type AccountPrisma = Pick<
  PrismaService,
  'gameOpenId' | 'rawEcpm' | 'userAccount'
>;

export type RegisterAccountInput = {
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

@Injectable()
export class AccountService {
  constructor(@Inject(PrismaService) private readonly prisma: AccountPrisma) {}

  async register(input: RegisterAccountInput) {
    const user = await this.prisma.userAccount.create({
      data: {
        passwordHash: await hash(input.password, 10),
        readableId: generateReadableId(`user:${input.username}`),
        username: input.username,
      },
    });

    return {
      id: user.id,
      readableId: user.readableId,
      username: user.username,
    };
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

function sum(values: bigint[]) {
  return values.reduce((total, value) => total + value, 0n);
}
