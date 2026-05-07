import { AccountSettlementService } from './account-settlement.service';

describe('AccountSettlementService', () => {
  it('credits pending display amounts for bound open_ids into available balance', async () => {
    const prisma = createFakePrisma();
    const service = new AccountSettlementService(prisma);

    const result = await service.confirmPendingEarnings({
      userId: 'user-1',
    });

    expect(result).toEqual({
      settledAmountLi: 4300n,
      settledCount: 2,
      userId: 'user-1',
    });
    expect(prisma.getUser('user-1')?.availableBalanceLi).toBe(4300n);
    expect(prisma.getRawEcpmStatuses()).toEqual([
      ['raw-1', 'SETTLED'],
      ['raw-2', 'SETTLED'],
      ['raw-3', 'PENDING'],
      ['raw-4', 'SETTLED'],
    ]);
  });

  it('does not credit already settled or unbound rows twice', async () => {
    const prisma = createFakePrisma();
    const service = new AccountSettlementService(prisma);

    await service.confirmPendingEarnings({
      userId: 'user-1',
    });
    const result = await service.confirmPendingEarnings({
      userId: 'user-1',
    });

    expect(result).toEqual({
      settledAmountLi: 0n,
      settledCount: 0,
      userId: 'user-1',
    });
    expect(prisma.getUser('user-1')?.availableBalanceLi).toBe(4300n);
  });
});

type FakeUser = {
  id: string;
  availableBalanceLi: bigint;
};

type FakeOpenId = {
  id: string;
  openId: string;
  userId: string | null;
};

type FakeRawEcpm = {
  id: string;
  displayAmountLi: bigint;
  openId: string;
  status: string;
};

function createFakePrisma() {
  const users = new Map<string, FakeUser>([
    [
      'user-1',
      {
        id: 'user-1',
        availableBalanceLi: 0n,
      },
    ],
  ]);
  const openIds: FakeOpenId[] = [
    {
      id: 'open-id-1',
      openId: 'open-a',
      userId: 'user-1',
    },
    {
      id: 'open-id-2',
      openId: 'open-b',
      userId: 'user-1',
    },
  ];
  const rawEcpms: FakeRawEcpm[] = [
    {
      id: 'raw-1',
      displayAmountLi: 3000n,
      openId: 'open-a',
      status: 'PENDING',
    },
    {
      id: 'raw-2',
      displayAmountLi: 1300n,
      openId: 'open-b',
      status: 'PENDING',
    },
    {
      id: 'raw-3',
      displayAmountLi: 9000n,
      openId: 'unbound-open',
      status: 'PENDING',
    },
    {
      id: 'raw-4',
      displayAmountLi: 2000n,
      openId: 'open-a',
      status: 'SETTLED',
    },
  ];

  const prisma = {
    getRawEcpmStatuses: () =>
      rawEcpms.map((row) => [row.id, row.status] as const),
    getUser: (id: string) => users.get(id),
    gameOpenId: {
      findMany: async ({ where }: any) =>
        openIds.filter((record) => record.userId === where.userId),
    },
    rawEcpm: {
      findMany: async ({ where }: any) =>
        rawEcpms.filter(
          (row) =>
            where.openId.in.includes(row.openId) &&
            row.status === where.status,
        ),
      updateMany: async ({ data, where }: any) => {
        let count = 0;
        for (const row of rawEcpms) {
          if (where.id.in.includes(row.id) && row.status === where.status) {
            row.status = data.status;
            count += 1;
          }
        }

        return {
          count,
        };
      },
    },
    userAccount: {
      update: async ({ data, where }: any) => {
        const user = users.get(where.id);
        if (!user) {
          throw new Error('user not found');
        }

        user.availableBalanceLi += data.availableBalanceLi.increment;
        return user;
      },
    },
    $transaction: async (callback: any) => callback(prisma),
  } as any;

  return prisma;
}
