import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { WithdrawalDetailService } from './withdrawal-detail.service';

describe('WithdrawalDetailService', () => {
  it('returns a withdrawal batch with details and related audit logs', async () => {
    const prisma = createFakePrisma();
    const service = new WithdrawalDetailService(prisma);

    const result = await service.getBatchDetail({
      batchId: 'batch-1',
      readScope: superAdminReadScope,
    });

    expect(result.batch).toMatchObject({
      id: 'batch-1',
      status: 'FAILED',
      totalAmountLi: 3000n,
    });
    expect(result.batch.details).toEqual([
      expect.objectContaining({
        errorCode: 'MOCK_PAYMENT_FAILED',
        status: 'FAILED',
      }),
    ]);
    expect(result.auditLogs).toEqual([
      expect.objectContaining({
        action: 'withdrawal.payment_failed',
        targetId: 'batch-1',
      }),
    ]);
  });

  it('rejects missing withdrawal batches', async () => {
    const service = new WithdrawalDetailService(createFakePrisma());

    await expect(
      service.getBatchDetail({
        batchId: 'missing',
        readScope: superAdminReadScope,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects company admins without querying withdrawal batches or audit logs', async () => {
    const prisma = createFakePrisma();
    const service = new WithdrawalDetailService(prisma);

    await expect(
      service.getBatchDetail({
        batchId: 'batch-1',
        readScope: companyAdminReadScope,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.withdrawalBatch.findUnique).not.toHaveBeenCalled();
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
  });
});

const superAdminReadScope = {
  companyIds: undefined,
  gameAppIds: undefined,
  gameIds: undefined,
  isSuperAdmin: true,
};

const companyAdminReadScope = {
  companyIds: ['company-1'],
  gameAppIds: ['game-app-1'],
  gameIds: ['game-1'],
  isSuperAdmin: false,
};

function createFakePrisma() {
  const batch = {
    id: 'batch-1',
    createdAt: new Date('2026-05-07T01:00:00.000Z'),
    details: [
      {
        id: 'detail-1',
        alipayRequestSnapshot: null,
        alipayResponseSnapshot: {
          mode: 'mock',
          status: 'failed',
        },
        amountLi: 3000n,
        batchId: 'batch-1',
        configSnapshot: {
          source: 'account_withdrawal_mvp',
        },
        errorCode: 'MOCK_PAYMENT_FAILED',
        errorMessage: 'Mock payment failed',
        recipientAlipay: 'alice@example.com',
        recipientName: 'Alice',
        status: 'FAILED',
        type: 'USER',
      },
    ],
    status: 'FAILED',
    totalAmountLi: 3000n,
    updatedAt: new Date('2026-05-07T01:30:00.000Z'),
    userId: 'user-1',
  };
  const auditLogs = [
    {
      id: 'audit-1',
      action: 'withdrawal.payment_failed',
      actorId: 'admin',
      actorType: 'SUPER_ADMIN',
      createdAt: new Date('2026-05-07T01:20:00.000Z'),
      metadata: {
        totalAmountLi: '3000',
      },
      targetId: 'batch-1',
      targetType: 'withdrawal_batch',
    },
  ];

  return {
    auditLog: {
      findMany: jest.fn(async ({ where }: any) =>
        auditLogs.filter(
          (row) =>
            row.targetId === where.targetId &&
            row.targetType === where.targetType,
        ),
      ),
    },
    withdrawalBatch: {
      findUnique: jest.fn(async ({ where }: any) =>
        where.id === batch.id ? batch : null,
      ),
    },
  } as any;
}
