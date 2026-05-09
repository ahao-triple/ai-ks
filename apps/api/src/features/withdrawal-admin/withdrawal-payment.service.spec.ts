import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WithdrawalPaymentService } from './withdrawal-payment.service';

describe('WithdrawalPaymentService', () => {
  it('marks an approved withdrawal batch and its approved details as paid', async () => {
    const prisma = createFakePrisma();
    const service = new WithdrawalPaymentService(prisma);

    const result = await service.payBatch({
      batchId: 'batch-1',
    });

    expect(result.status).toBe('PAID');
    expect(result.details).toEqual([
      expect.objectContaining({
        alipayResponseSnapshot: {
          mode: 'mock',
          status: 'success',
        },
        status: 'PAID',
      }),
    ]);
    expect(prisma.getBatch('batch-1')?.status).toBe('PAID');
  });

  it('rejects payment for missing or non-approved batches', async () => {
    const prisma = createFakePrisma();
    const service = new WithdrawalPaymentService(prisma);

    await expect(
      service.payBatch({
        batchId: 'missing',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    await expect(
      service.payBatch({
        batchId: 'batch-2',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('marks an approved withdrawal batch and its details as failed in mock failure mode', async () => {
    const prisma = createFakePrisma();
    const service = new WithdrawalPaymentService(prisma);

    const result = await service.payBatch({
      batchId: 'batch-1',
      mockResult: 'failed',
    });

    expect(result.status).toBe('FAILED');
    expect(result.details).toEqual([
      expect.objectContaining({
        alipayResponseSnapshot: {
          mode: 'mock',
          status: 'failed',
        },
        errorCode: 'MOCK_PAYMENT_FAILED',
        errorMessage: 'Mock payment failed',
        status: 'FAILED',
      }),
    ]);
  });

  it('closes a failed batch and refunds frozen balance to available balance', async () => {
    const prisma = createFakePrisma();
    const service = new WithdrawalPaymentService(prisma);
    await service.payBatch({
      batchId: 'batch-1',
      mockResult: 'failed',
    });

    const result = await service.closeFailedBatch({
      batchId: 'batch-1',
    });

    expect(result.status).toBe('CLOSED');
    expect(result.details.map((detail: { status: string }) => detail.status)).toEqual([
      'CLOSED',
    ]);
    expect(prisma.getUser('user-1')).toMatchObject({
      availableBalanceLi: 3000n,
      frozenBalanceLi: 0n,
    });
  });

  it('closes a failed agent batch and refunds the agent frozen balance', async () => {
    const prisma = createFakePrisma();
    const service = new WithdrawalPaymentService(prisma);
    await service.payBatch({
      batchId: 'batch-agent-1',
      mockResult: 'failed',
    });

    const result = await service.closeFailedBatch({
      batchId: 'batch-agent-1',
    });

    expect(result.status).toBe('CLOSED');
    expect(prisma.getAgent('agent-1')).toMatchObject({
      availableBalanceLi: 3000n,
      frozenBalanceLi: 0n,
    });
  });
});

type FakeAgent = {
  id: string;
  availableBalanceLi: bigint;
  frozenBalanceLi: bigint;
};

type FakeUser = {
  id: string;
  availableBalanceLi: bigint;
  frozenBalanceLi: bigint;
};

type FakeDetail = {
  id: string;
  batchId: string;
  type: string;
  status: string;
  amountLi: bigint;
  recipientAlipay: string;
  recipientName: string;
  alipayResponseSnapshot: unknown;
  errorCode: string | null;
  errorMessage: string | null;
};

type FakeBatch = {
  id: string;
  ownerId: string | null;
  ownerType: string;
  userId: string | null;
  status: string;
  totalAmountLi: bigint;
  createdAt: Date;
  updatedAt: Date;
  details: FakeDetail[];
};

function createFakePrisma() {
  const agents = new Map<string, FakeAgent>([
    [
      'agent-1',
      {
        id: 'agent-1',
        availableBalanceLi: 0n,
        frozenBalanceLi: 3000n,
      },
    ],
  ]);
  const users = new Map<string, FakeUser>([
    [
      'user-1',
      {
        id: 'user-1',
        availableBalanceLi: 0n,
        frozenBalanceLi: 3000n,
      },
    ],
  ]);
  const batches = new Map<string, FakeBatch>([
    [
      'batch-1',
      {
        id: 'batch-1',
        createdAt: new Date('2026-05-07T01:00:00.000Z'),
        details: [
          {
            id: 'detail-1',
            alipayResponseSnapshot: null,
            amountLi: 3000n,
            batchId: 'batch-1',
            errorCode: null,
            errorMessage: null,
            recipientAlipay: 'alice@example.com',
            recipientName: 'Alice',
            status: 'APPROVED',
            type: 'USER',
          },
        ],
        status: 'APPROVED',
        totalAmountLi: 3000n,
        updatedAt: new Date('2026-05-07T01:00:00.000Z'),
        ownerId: 'user-1',
        ownerType: 'USER',
        userId: 'user-1',
      },
    ],
    [
      'batch-agent-1',
      {
        id: 'batch-agent-1',
        createdAt: new Date('2026-05-07T01:30:00.000Z'),
        details: [
          {
            id: 'detail-agent-1',
            alipayResponseSnapshot: null,
            amountLi: 3000n,
            batchId: 'batch-agent-1',
            errorCode: null,
            errorMessage: null,
            recipientAlipay: 'agent@example.com',
            recipientName: 'Agent One',
            status: 'APPROVED',
            type: 'AGENT',
          },
        ],
        ownerId: 'agent-1',
        ownerType: 'AGENT',
        status: 'APPROVED',
        totalAmountLi: 3000n,
        updatedAt: new Date('2026-05-07T01:30:00.000Z'),
        userId: null,
      },
    ],
    [
      'batch-2',
      {
        id: 'batch-2',
        createdAt: new Date('2026-05-07T02:00:00.000Z'),
        details: [],
        status: 'PENDING_REVIEW',
        totalAmountLi: 2000n,
        updatedAt: new Date('2026-05-07T02:00:00.000Z'),
        ownerId: 'user-2',
        ownerType: 'USER',
        userId: 'user-2',
      },
    ],
  ]);

  const prisma = {
    getAgent: (id: string) => agents.get(id),
    getBatch: (id: string) => batches.get(id),
    getUser: (id: string) => users.get(id),
    agent: {
      updateMany: async ({ data, where }: any) => {
        const agent = agents.get(where.id);
        if (!agent || agent.frozenBalanceLi < where.frozenBalanceLi.gte) {
          return {
            count: 0,
          };
        }

        agents.set(agent.id, {
          ...agent,
          availableBalanceLi:
            agent.availableBalanceLi + data.availableBalanceLi.increment,
          frozenBalanceLi:
            agent.frozenBalanceLi - data.frozenBalanceLi.decrement,
        });

        return {
          count: 1,
        };
      },
    },
    userAccount: {
      updateMany: async ({ data, where }: any) => {
        const user = users.get(where.id);
        if (!user || user.frozenBalanceLi < where.frozenBalanceLi.gte) {
          return {
            count: 0,
          };
        }

        users.set(user.id, {
          ...user,
          availableBalanceLi:
            user.availableBalanceLi + data.availableBalanceLi.increment,
          frozenBalanceLi: user.frozenBalanceLi - data.frozenBalanceLi.decrement,
        });

        return {
          count: 1,
        };
      },
    },
    withdrawalBatch: {
      findUnique: async ({ where }: any) => batches.get(where.id) ?? null,
      update: async ({ data, where }: any) => {
        const batch = batches.get(where.id);
        if (!batch) {
          throw new Error('batch not found');
        }

        const next = {
          ...batch,
          status: data.status,
          updatedAt: new Date(),
        };
        batches.set(next.id, next);
        return next;
      },
    },
    withdrawalDetail: {
      updateMany: async ({ data, where }: any) => {
        const batch = batches.get(where.batchId);
        if (!batch) {
          return {
            count: 0,
          };
        }

        let count = 0;
        batch.details = batch.details.map((detail) => {
          if (detail.status !== where.status) {
            return detail;
          }

          count += 1;
          return {
            ...detail,
            alipayResponseSnapshot: data.alipayResponseSnapshot,
            errorCode: data.errorCode ?? detail.errorCode,
            errorMessage: data.errorMessage ?? detail.errorMessage,
            status: data.status,
          };
        });

        return {
          count,
        };
      },
    },
    $transaction: async (callback: any) => callback(prisma),
  } as any;

  return prisma;
}
