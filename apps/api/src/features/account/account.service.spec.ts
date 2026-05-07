import { AccountService } from './account.service';

describe('AccountService', () => {
  it('registers a user, binds an open_id, and aggregates earnings by account', async () => {
    const prisma = createFakePrisma();
    const service = new AccountService(prisma);

    const user = await service.register({
      password: 'secret123',
      username: 'alice',
    });
    await service.bindOpenId({
      identity: 'GAME001',
      userId: user.id,
    });

    const result = await service.queryEarnings({
      endAt: new Date('2026-05-08T00:00:00.000Z'),
      startAt: new Date('2026-05-07T00:00:00.000Z'),
      userId: user.id,
    });

    expect(user.readableId).toHaveLength(7);
    expect(prisma.getUser(user.id)?.passwordHash).not.toBe('secret123');
    expect(prisma.getOpenId('open_a')?.userId).toBe(user.id);
    expect(result.totalDisplayAmountLi).toBe(3000n);
    expect(result.openIds).toEqual(['open_a']);
    expect(result.rows).toHaveLength(1);
  });
});

type FakeUser = {
  id: string;
  username: string;
  passwordHash: string;
  readableId: string;
  currentAgentId: string | null;
  alipayAccount: string | null;
  alipayRealName: string | null;
  availableBalanceLi: bigint;
  frozenBalanceLi: bigint;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type FakeOpenId = {
  id: string;
  gameId: string;
  userId: string | null;
  openId: string;
  readableId: string;
  createdAt: Date;
  updatedAt: Date;
};

type FakeRawEcpm = {
  id: string;
  gameId: string;
  openIdRecordId: string | null;
  platformEventId: string;
  openId: string;
  rawCostLi: bigint;
  displayAmountLi: bigint;
  eventTime: Date;
  createdAt: Date;
};

function createFakePrisma() {
  const users = new Map<string, FakeUser>();
  const openIds = new Map<string, FakeOpenId>([
    [
      'open_a',
      {
        id: 'open-id-1',
        createdAt: new Date('2026-05-07T01:00:00.000Z'),
        gameId: 'game-1',
        openId: 'open_a',
        readableId: 'GAME001',
        updatedAt: new Date('2026-05-07T01:00:00.000Z'),
        userId: null,
      },
    ],
  ]);
  const rawEcpms: FakeRawEcpm[] = [
    {
      id: 'raw-1',
      createdAt: new Date('2026-05-07T03:00:00.000Z'),
      displayAmountLi: 3000n,
      eventTime: new Date('2026-05-07T03:00:00.000Z'),
      gameId: 'game-1',
      openId: 'open_a',
      openIdRecordId: 'open-id-1',
      platformEventId: 'evt-1',
      rawCostLi: 6000n,
    },
  ];

  return {
    getOpenId: (openId: string) => openIds.get(openId),
    getUser: (id: string) => users.get(id),
    gameOpenId: {
      findMany: async ({ where }: any) =>
        Array.from(openIds.values()).filter((item) => item.userId === where.userId),
      findUnique: async ({ where }: any) =>
        Array.from(openIds.values()).find(
          (item) =>
            item.openId === where.openId || item.readableId === where.readableId,
        ) ?? null,
      update: async ({ data, where }: any) => {
        const existing = Array.from(openIds.values()).find(
          (item) =>
            item.openId === where.openId || item.readableId === where.readableId,
        );
        if (!existing) {
          throw new Error('open_id not found');
        }

        const next = { ...existing, ...data, updatedAt: new Date() };
        openIds.set(next.openId, next);
        return next;
      },
    },
    rawEcpm: {
      findMany: async ({ where }: any) =>
        rawEcpms.filter(
          (item) =>
            where.openId.in.includes(item.openId) &&
            item.eventTime >= where.eventTime.gte &&
            item.eventTime < where.eventTime.lt,
        ),
    },
    userAccount: {
      create: async ({ data }: any) => {
        const user = {
          id: `user-${users.size + 1}`,
          alipayAccount: null,
          alipayRealName: null,
          availableBalanceLi: 0n,
          createdAt: new Date(),
          currentAgentId: null,
          deletedAt: null,
          frozenBalanceLi: 0n,
          updatedAt: new Date(),
          ...data,
        };
        users.set(user.id, user);
        return user;
      },
      findUnique: async ({ where }: any) => users.get(where.id) ?? null,
    },
  } as any;
}
