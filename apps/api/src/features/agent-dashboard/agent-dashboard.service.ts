import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LI_PER_YUAN } from '../../domain/money/amount';

export type Range = { startAt: Date; endAt: Date };

export type AgentDashboardOverview = {
  invitationCode: string;
  directUserCount: number;
  todayTotalAmountYuan: number;
  myShareTodayYuan: number;
};

export type AgentDashboardUserRow = {
  userId: string;
  readableId: string;
  todayAmountYuan: number;
  todayEcpmCount: number;
  totalAmountYuan: number;
  registeredAt: Date;
  lastActiveAt: Date | null;
};

type DashboardPrisma = {
  agent: {
    findUnique(args: {
      where: { id: string };
    }): Promise<{
      id: string;
      invitationCode: string;
    } | null>;
  };
  userAccount: {
    findMany(args: {
      where: { currentAgentId: string; deletedAt: null };
    }): Promise<
      Array<{
        id: string;
        readableId: string;
        currentAgentId: string | null;
        createdAt: Date;
      }>
    >;
  };
  gameOpenId: {
    findMany(args: {
      where: { userId: { in: string[] } };
    }): Promise<Array<{ id: string; userId: string | null }>>;
  };
  rawEcpm: {
    findMany(args: {
      where: {
        openIdRecordId?: { in: string[] };
        eventTime?: { gte: Date; lt: Date };
      };
      orderBy?: { eventTime: 'asc' | 'desc' };
    }): Promise<
      Array<{
        id: string;
        openIdRecordId: string | null;
        rawCostLi: bigint;
        displayAmountLi: bigint;
        eventTime: Date;
      }>
    >;
  };
  platformConfig: {
    findUnique(args: { where: { key: string } }): Promise<
      | {
          directAgentRatioPercent: number;
        }
      | null
    >;
  };
};

@Injectable()
export class AgentDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(input: {
    agentId: string;
    range: Range;
  }): Promise<AgentDashboardOverview> {
    const prisma = this.prisma as unknown as DashboardPrisma;

    const agent = await prisma.agent.findUnique({ where: { id: input.agentId } });
    if (!agent) {
      throw new Error(`Agent ${input.agentId} not found`);
    }

    const users = await prisma.userAccount.findMany({
      where: { currentAgentId: input.agentId, deletedAt: null },
    });
    const userIds = users.map((u) => u.id);

    let todayTotalLi = 0n;
    if (userIds.length > 0) {
      const openIds = await prisma.gameOpenId.findMany({
        where: { userId: { in: userIds } },
      });
      const openIdRecordIds = openIds.map((o) => o.id);
      if (openIdRecordIds.length > 0) {
        const todayRecords = await prisma.rawEcpm.findMany({
          where: {
            openIdRecordId: { in: openIdRecordIds },
            eventTime: { gte: input.range.startAt, lt: input.range.endAt },
          },
        });
        todayTotalLi = todayRecords.reduce(
          (sum, r) => sum + r.displayAmountLi,
          0n,
        );
      }
    }

    const config = await prisma.platformConfig.findUnique({
      where: { key: 'default' },
    });
    const directRatio = config?.directAgentRatioPercent ?? 0;

    const todayTotalAmountYuan = Number(todayTotalLi) / LI_PER_YUAN;
    const myShareTodayYuan = (todayTotalAmountYuan * directRatio) / 100;

    return {
      invitationCode: agent.invitationCode,
      directUserCount: users.length,
      todayTotalAmountYuan,
      myShareTodayYuan,
    };
  }

  async listUnderUsers(input: {
    agentId: string;
    range: Range;
  }): Promise<AgentDashboardUserRow[]> {
    const prisma = this.prisma as unknown as DashboardPrisma;

    const users = await prisma.userAccount.findMany({
      where: { currentAgentId: input.agentId, deletedAt: null },
    });
    if (users.length === 0) return [];

    const userIds = users.map((u) => u.id);
    const openIds = await prisma.gameOpenId.findMany({
      where: { userId: { in: userIds } },
    });

    const accountsByUserId = new Map<string, string[]>();
    for (const o of openIds) {
      if (!o.userId) continue;
      const list = accountsByUserId.get(o.userId) ?? [];
      list.push(o.id);
      accountsByUserId.set(o.userId, list);
    }

    const allRecordsAcrossUsers =
      openIds.length === 0
        ? []
        : await prisma.rawEcpm.findMany({
            where: { openIdRecordId: { in: openIds.map((o) => o.id) } },
            orderBy: { eventTime: 'desc' },
          });

    return users
      .map((user) => {
        const accountIds = accountsByUserId.get(user.id) ?? [];
        const accountIdSet = new Set(accountIds);
        const userRecords = allRecordsAcrossUsers.filter(
          (r) => r.openIdRecordId && accountIdSet.has(r.openIdRecordId),
        );
        const todayRecords = userRecords.filter(
          (r) =>
            r.eventTime >= input.range.startAt &&
            r.eventTime < input.range.endAt,
        );
        const todayAmountLi = todayRecords.reduce(
          (sum, r) => sum + r.displayAmountLi,
          0n,
        );
        const totalAmountLi = userRecords.reduce(
          (sum, r) => sum + r.displayAmountLi,
          0n,
        );
        const lastActiveAt = userRecords[0]?.eventTime ?? null;

        return {
          userId: user.id,
          readableId: user.readableId,
          todayAmountYuan: Number(todayAmountLi) / LI_PER_YUAN,
          todayEcpmCount: todayRecords.length,
          totalAmountYuan: Number(totalAmountLi) / LI_PER_YUAN,
          registeredAt: user.createdAt,
          lastActiveAt,
        };
      })
      .sort((a, b) => b.todayAmountYuan - a.todayAmountYuan);
  }
}
