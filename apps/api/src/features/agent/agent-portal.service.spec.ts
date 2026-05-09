import { BadRequestException } from '@nestjs/common';
import {
  AgentPortalService,
  type AgentPortalPrisma,
} from './agent-portal.service';

describe('AgentPortalService', () => {
  it('returns profile balances and settlement earnings for the signed-in agent', async () => {
    const prisma = createFakePrisma();
    const service = new AgentPortalService(prisma);

    await expect(service.getProfile('agent-1')).resolves.toMatchObject({
      availableBalanceLi: 5000n,
      frozenBalanceLi: 0n,
      id: 'agent-1',
      username: 'agent_1',
    });

    const earnings = await service.listEarnings('agent-1');

    expect(earnings.totalAmountLi).toBe(600n);
    expect(earnings.rows).toEqual([
      expect.objectContaining({
        amountLi: 300n,
        batchId: 'batch-1',
        role: 'DIRECT_AGENT',
      }),
      expect.objectContaining({
        amountLi: 200n,
        batchId: 'batch-1',
        role: 'PARENT_AGENT',
      }),
      expect.objectContaining({
        amountLi: 100n,
        batchId: 'batch-2',
        role: 'DEFAULT_AGENT',
      }),
    ]);
  });

  it('updates alipay, requests withdrawal, and lists own withdrawal batches', async () => {
    const prisma = createFakePrisma();
    const service = new AgentPortalService(prisma, {
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
    });

    await service.updateAlipayProfile({
      agentId: 'agent-1',
      alipayAccount: 'agent@example.com',
      alipayRealName: 'Agent One',
    });
    const withdrawal = await service.requestWithdrawal({
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
      userId: null,
    });
    await expect(service.listWithdrawals('agent-1')).resolves.toEqual([
      withdrawal,
    ]);
  });

  it('rejects withdrawals below minimum or without alipay profile', async () => {
    const prisma = createFakePrisma();
    const service = new AgentPortalService(prisma, {
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
    });

    await expect(
      service.requestWithdrawal({
        agentId: 'agent-1',
        amountLi: 500n,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lists direct users and child-agent users for the signed-in agent', async () => {
    const prisma = createFakePrisma();
    const service = new AgentPortalService(prisma);

    const result = await service.listUsers('agent-1');

    expect(result.rows).toEqual([
      expect.objectContaining({
        currentAgentId: 'agent-1',
        relation: 'DIRECT',
        username: 'direct_user',
      }),
      expect.objectContaining({
        currentAgentId: 'agent-2',
        relation: 'CHILD_AGENT',
        username: 'child_agent_user',
      }),
    ]);
    expect(result.totalCount).toBe(2);
  });
});

type FakeAgent = {
  id: string;
  alipayAccount: string | null;
  alipayRealName: string | null;
  availableBalanceLi: bigint;
  deletedAt: Date | null;
  enabled: boolean;
  frozenBalanceLi: bigint;
  invitationCode: string;
  parentAgentId: string | null;
  username: string;
};

type FakeUser = {
  id: string;
  createdAt: Date;
  currentAgentId: string | null;
  deletedAt: Date | null;
  readableId: string;
  username: string;
};

type FakeWithdrawalBatch = {
  id: string;
  createdAt: Date;
  details: any[];
  ownerId: string | null;
  ownerType: string;
  status: string;
  totalAmountLi: bigint;
  updatedAt: Date;
  userId: string | null;
};

function createFakePrisma(): AgentPortalPrisma & {
  getAgent(id: string): FakeAgent | undefined;
} {
  const agents = new Map<string, FakeAgent>([
    [
      'agent-1',
      {
        alipayAccount: null,
        alipayRealName: null,
        availableBalanceLi: 5000n,
        deletedAt: null,
        enabled: true,
        frozenBalanceLi: 0n,
        id: 'agent-1',
        invitationCode: 'AGENT1',
        parentAgentId: null,
        username: 'agent_1',
      },
    ],
    [
      'agent-2',
      {
        alipayAccount: null,
        alipayRealName: null,
        availableBalanceLi: 0n,
        deletedAt: null,
        enabled: true,
        frozenBalanceLi: 0n,
        id: 'agent-2',
        invitationCode: 'AGENT2',
        parentAgentId: 'agent-1',
        username: 'agent_2',
      },
    ],
  ]);
  const users = new Map<string, FakeUser>([
    [
      'user-1',
      {
        createdAt: new Date('2026-05-09T04:00:00.000Z'),
        currentAgentId: 'agent-1',
        deletedAt: null,
        id: 'user-1',
        readableId: 'USER001',
        username: 'direct_user',
      },
    ],
    [
      'user-2',
      {
        createdAt: new Date('2026-05-09T04:01:00.000Z'),
        currentAgentId: 'agent-2',
        deletedAt: null,
        id: 'user-2',
        readableId: 'USER002',
        username: 'child_agent_user',
      },
    ],
    [
      'user-3',
      {
        createdAt: new Date('2026-05-09T04:02:00.000Z'),
        currentAgentId: null,
        deletedAt: null,
        id: 'user-3',
        readableId: 'USER003',
        username: 'unbound_user',
      },
    ],
  ]);
  const withdrawals: FakeWithdrawalBatch[] = [];

  const prisma = {
    $transaction: async (callback: any) => callback(prisma),
    agent: {
      findUnique: async ({ where }: any) => agents.get(where.id) ?? null,
      update: async ({ data, where }: any) => {
        const agent = agents.get(where.id);
        if (!agent) throw new Error('agent not found');
        const next = { ...agent, ...data };
        agents.set(next.id, next);
        return next;
      },
      updateMany: async ({ data, where }: any) => {
        const agent = agents.get(where.id);
        if (
          !agent ||
          !agent.enabled ||
          agent.deletedAt !== null ||
          agent.availableBalanceLi < where.availableBalanceLi.gte
        ) {
          return { count: 0 };
        }
        agents.set(agent.id, {
          ...agent,
          availableBalanceLi:
            agent.availableBalanceLi - data.availableBalanceLi.decrement,
          frozenBalanceLi:
            agent.frozenBalanceLi + data.frozenBalanceLi.increment,
        });
        return { count: 1 };
      },
    } as any,
    getAgent: (id: string) => agents.get(id),
    settlementBatchItem: {
      findMany: async () => [
        {
          batch: { createdAt: new Date('2026-05-09T01:00:00.000Z'), id: 'batch-1' },
          createdAt: new Date('2026-05-09T01:01:00.000Z'),
          defaultAgentAmountLi: 0n,
          defaultAgentId: null,
          directAgentAmountLi: 300n,
          directAgentId: 'agent-1',
          id: 'item-1',
          openId: 'open-1',
          parentAgentAmountLi: 0n,
          parentAgentId: null,
          rawEcpmId: 'raw-1',
          settlementAmountLi: 3000n,
          userId: 'user-1',
        },
        {
          batch: { createdAt: new Date('2026-05-09T01:00:00.000Z'), id: 'batch-1' },
          createdAt: new Date('2026-05-09T01:02:00.000Z'),
          defaultAgentAmountLi: 0n,
          defaultAgentId: null,
          directAgentAmountLi: 0n,
          directAgentId: null,
          id: 'item-2',
          openId: 'open-2',
          parentAgentAmountLi: 200n,
          parentAgentId: 'agent-1',
          rawEcpmId: 'raw-2',
          settlementAmountLi: 2000n,
          userId: 'user-2',
        },
        {
          batch: { createdAt: new Date('2026-05-09T02:00:00.000Z'), id: 'batch-2' },
          createdAt: new Date('2026-05-09T02:01:00.000Z'),
          defaultAgentAmountLi: 100n,
          defaultAgentId: 'agent-1',
          directAgentAmountLi: 0n,
          directAgentId: null,
          id: 'item-3',
          openId: 'open-3',
          parentAgentAmountLi: 0n,
          parentAgentId: null,
          rawEcpmId: 'raw-3',
          settlementAmountLi: 1000n,
          userId: 'user-3',
        },
      ],
    } as any,
    withdrawalBatch: {
      create: async ({ data }: any) => {
        const batch = {
          createdAt: new Date('2026-05-09T03:00:00.000Z'),
          details: data.details.create,
          id: 'withdrawal-1',
          ownerId: data.ownerId,
          ownerType: data.ownerType,
          status: data.status,
          totalAmountLi: data.totalAmountLi,
          updatedAt: new Date('2026-05-09T03:00:00.000Z'),
          userId: data.userId,
        };
        withdrawals.unshift(batch);
        return batch;
      },
      findMany: async ({ where }: any) =>
        withdrawals.filter(
          (batch) =>
            batch.ownerType === where.ownerType && batch.ownerId === where.ownerId,
        ),
    } as any,
    userAccount: {
      findMany: async () =>
        Array.from(users.values())
          .filter((user) => {
            const currentAgent = user.currentAgentId
              ? agents.get(user.currentAgentId)
              : null;
            return (
              user.deletedAt === null &&
              (user.currentAgentId === 'agent-1' ||
                currentAgent?.parentAgentId === 'agent-1')
            );
          })
          .map((user) => ({
            ...user,
            currentAgent: user.currentAgentId
              ? agents.get(user.currentAgentId) ?? null
              : null,
          })),
    } as any,
  } as AgentPortalPrisma & {
    getAgent(id: string): FakeAgent | undefined;
  };

  return prisma;
}
