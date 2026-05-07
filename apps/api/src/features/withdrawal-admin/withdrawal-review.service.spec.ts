import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WithdrawalReviewService } from './withdrawal-review.service';

describe('WithdrawalReviewService', () => {
  it('lists withdrawal batches by status', async () => {
    const prisma = createFakePrisma();
    const service = new WithdrawalReviewService(prisma);

    const result = await service.listBatches({
      status: 'PENDING_REVIEW',
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'batch-1',
      status: 'PENDING_REVIEW',
      totalAmountLi: 3000n,
      userId: 'user-1',
    });
    expect(result[0].details).toHaveLength(1);
  });

  it('approves a pending withdrawal batch and its pending details', async () => {
    const prisma = createFakePrisma();
    const service = new WithdrawalReviewService(prisma);

    const result = await service.approveBatch({
      batchId: 'batch-1',
    });

    expect(result.status).toBe('APPROVED');
    expect(
      result.details.map((detail: { status: string }) => detail.status),
    ).toEqual([
      'APPROVED',
    ]);
    expect(prisma.getBatch('batch-1')?.status).toBe('APPROVED');
  });

  it('rejects approval for missing or non-pending batches', async () => {
    const prisma = createFakePrisma();
    const service = new WithdrawalReviewService(prisma);

    await expect(
      service.approveBatch({
        batchId: 'missing',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    await service.approveBatch({
      batchId: 'batch-1',
    });

    await expect(
      service.approveBatch({
        batchId: 'batch-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

type FakeDetail = {
  id: string;
  batchId: string;
  type: string;
  status: string;
  amountLi: bigint;
  recipientAlipay: string;
  recipientName: string;
};

type FakeBatch = {
  id: string;
  userId: string;
  status: string;
  totalAmountLi: bigint;
  createdAt: Date;
  updatedAt: Date;
  details: FakeDetail[];
};

function createFakePrisma() {
  const batches = new Map<string, FakeBatch>([
    [
      'batch-1',
      {
        id: 'batch-1',
        createdAt: new Date('2026-05-07T01:00:00.000Z'),
        details: [
          {
            id: 'detail-1',
            amountLi: 3000n,
            batchId: 'batch-1',
            recipientAlipay: 'alice@example.com',
            recipientName: 'Alice',
            status: 'PENDING_REVIEW',
            type: 'USER',
          },
        ],
        status: 'PENDING_REVIEW',
        totalAmountLi: 3000n,
        updatedAt: new Date('2026-05-07T01:00:00.000Z'),
        userId: 'user-1',
      },
    ],
    [
      'batch-2',
      {
        id: 'batch-2',
        createdAt: new Date('2026-05-07T02:00:00.000Z'),
        details: [],
        status: 'APPROVED',
        totalAmountLi: 2000n,
        updatedAt: new Date('2026-05-07T02:00:00.000Z'),
        userId: 'user-2',
      },
    ],
  ]);

  const prisma = {
    getBatch: (id: string) => batches.get(id),
    withdrawalBatch: {
      findMany: async ({ orderBy, where }: any) =>
        Array.from(batches.values())
          .filter((batch) => !where?.status || batch.status === where.status)
          .sort((a, b) =>
            orderBy?.createdAt === 'desc'
              ? b.createdAt.getTime() - a.createdAt.getTime()
              : a.createdAt.getTime() - b.createdAt.getTime(),
          ),
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
