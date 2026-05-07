import { BadRequestException } from '@nestjs/common';
import { AccountWalletService } from './account-wallet.service';

describe('AccountWalletService', () => {
  it('updates and reads account alipay profile', async () => {
    const prisma = createFakePrisma();
    const service = new AccountWalletService(prisma);

    await service.updateAlipayProfile({
      alipayAccount: 'alice@example.com',
      alipayRealName: 'Alice',
      userId: 'user-1',
    });

    await expect(service.getAlipayProfile('user-1')).resolves.toEqual({
      alipayAccount: 'alice@example.com',
      alipayRealName: 'Alice',
    });
  });

  it('rejects withdrawals before alipay profile is configured', async () => {
    const prisma = createFakePrisma();
    const service = new AccountWalletService(prisma);

    await expect(
      service.requestWithdrawal({
        amountLi: 1000n,
        userId: 'user-1',
      }),
    ).rejects.toThrow('请先维护支付宝收款信息');
  });

  it('rejects withdrawals when available balance is insufficient', async () => {
    const prisma = createFakePrisma();
    const service = new AccountWalletService(prisma);
    await service.updateAlipayProfile({
      alipayAccount: 'alice@example.com',
      alipayRealName: 'Alice',
      userId: 'user-1',
    });

    await expect(
      service.requestWithdrawal({
        amountLi: 6000n,
        userId: 'user-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('freezes balance and creates a pending user withdrawal detail', async () => {
    const prisma = createFakePrisma();
    const service = new AccountWalletService(prisma);
    await service.updateAlipayProfile({
      alipayAccount: 'alice@example.com',
      alipayRealName: 'Alice',
      userId: 'user-1',
    });

    const result = await service.requestWithdrawal({
      amountLi: 3000n,
      userId: 'user-1',
    });

    expect(prisma.getUser('user-1')).toMatchObject({
      availableBalanceLi: 2000n,
      frozenBalanceLi: 3000n,
    });
    expect(result).toMatchObject({
      status: 'PENDING_REVIEW',
      totalAmountLi: 3000n,
      userId: 'user-1',
    });
    expect(result.details).toEqual([
      expect.objectContaining({
        amountLi: 3000n,
        recipientAlipay: 'alice@example.com',
        recipientName: 'Alice',
        status: 'PENDING_REVIEW',
        type: 'USER',
      }),
    ]);
  });
});

type FakeUser = {
  id: string;
  alipayAccount: string | null;
  alipayRealName: string | null;
  availableBalanceLi: bigint;
  frozenBalanceLi: bigint;
};

function createFakePrisma() {
  const users = new Map<string, FakeUser>([
    [
      'user-1',
      {
        id: 'user-1',
        alipayAccount: null,
        alipayRealName: null,
        availableBalanceLi: 5000n,
        frozenBalanceLi: 0n,
      },
    ],
  ]);
  const batches: unknown[] = [];

  const prisma = {
    getUser: (id: string) => users.get(id),
    userAccount: {
      findUnique: async ({ where }: any) => users.get(where.id) ?? null,
      update: async ({ data, where }: any) => {
        const user = users.get(where.id);
        if (!user) {
          throw new Error('user not found');
        }

        const next = {
          ...user,
          ...data,
        };
        users.set(next.id, next);
        return next;
      },
      updateMany: async ({ data, where }: any) => {
        const user = users.get(where.id);
        if (!user || user.availableBalanceLi < where.availableBalanceLi.gte) {
          return {
            count: 0,
          };
        }

        users.set(user.id, {
          ...user,
          availableBalanceLi:
            user.availableBalanceLi - data.availableBalanceLi.decrement,
          frozenBalanceLi: user.frozenBalanceLi + data.frozenBalanceLi.increment,
        });
        return {
          count: 1,
        };
      },
    },
    withdrawalBatch: {
      create: async ({ data }: any) => {
        const batch = {
          id: `batch-${batches.length + 1}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
          details: {
            id: `detail-${batches.length + 1}`,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...data.details.create[0],
          },
        };
        batches.push(batch);
        return {
          ...batch,
          details: [batch.details],
        };
      },
    },
    $transaction: async (callback: any) => callback(prisma),
  } as any;

  return prisma;
}
