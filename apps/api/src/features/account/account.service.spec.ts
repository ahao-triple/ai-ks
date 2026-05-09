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

  it('returns a business error when the username already exists', async () => {
    const prisma = createFakePrisma();
    const service = new AccountService(prisma);

    await service.register({
      password: 'secret123',
      username: 'alice',
    });

    await expect(
      service.register({
        password: 'another123',
        username: 'alice',
      }),
    ).rejects.toThrow('用户名已存在，请换一个用户名');
  });

  it('logs in with username and password', async () => {
    const prisma = createFakePrisma();
    const service = new AccountService(prisma);

    const user = await service.register({
      password: 'secret123',
      username: 'alice',
    });

    await expect(
      service.login({
        password: 'wrong123',
        username: 'alice',
      }),
    ).rejects.toThrow('账号或密码错误');

    await expect(
      service.login({
        password: 'secret123',
        username: 'alice',
      }),
    ).resolves.toEqual({
      id: user.id,
      readableId: user.readableId,
      username: 'alice',
    });
  });

  it('binds a user to an active agent during registration', async () => {
    const prisma = createFakePrisma();
    const service = new AccountService(prisma);

    const user = await service.register({
      invitationCode: 'AGENT1',
      password: 'secret123',
      username: 'alice',
    });

    expect(prisma.getUser(user.id)?.currentAgentId).toBe('agent-1');
    expect(await service.getAgentBinding(user.id)).toMatchObject({
      agent: {
        id: 'agent-1',
        invitationCode: 'AGENT1',
        username: 'agent_1',
      },
    });
    expect(prisma.getBindingHistory()).toEqual([
      expect.objectContaining({
        fromAgentId: null,
        source: 'registration_invitation',
        toAgentId: 'agent-1',
        userId: user.id,
      }),
    ]);
  });

  it('changes the current agent by invitation code and records history', async () => {
    const prisma = createFakePrisma();
    const service = new AccountService(prisma);

    const user = await service.register({
      invitationCode: 'AGENT1',
      password: 'secret123',
      username: 'alice',
    });

    const binding = await service.bindAgentByInvitationCode({
      invitationCode: 'AGENT2',
      userId: user.id,
    });

    expect(binding.agent).toMatchObject({
      id: 'agent-2',
      invitationCode: 'AGENT2',
      username: 'agent_2',
    });
    expect(prisma.getUser(user.id)?.currentAgentId).toBe('agent-2');
    expect(prisma.getBindingHistory()).toEqual([
      expect.objectContaining({
        fromAgentId: null,
        source: 'registration_invitation',
        toAgentId: 'agent-1',
        userId: user.id,
      }),
      expect.objectContaining({
        fromAgentId: 'agent-1',
        source: 'user_invitation',
        toAgentId: 'agent-2',
        userId: user.id,
      }),
    ]);
  });
});

type FakeAgent = {
  id: string;
  deletedAt: Date | null;
  enabled: boolean;
  invitationCode: string;
  username: string;
};

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
  const agents = new Map<string, FakeAgent>([
    [
      'agent-1',
      {
        deletedAt: null,
        enabled: true,
        id: 'agent-1',
        invitationCode: 'AGENT1',
        username: 'agent_1',
      },
    ],
    [
      'agent-2',
      {
        deletedAt: null,
        enabled: true,
        id: 'agent-2',
        invitationCode: 'AGENT2',
        username: 'agent_2',
      },
    ],
  ]);
  const agentBindings: any[] = [];
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

  const prisma = {
    agent: {
      findUnique: async ({ where }: any) => {
        if ('invitationCode' in where) {
          return (
            Array.from(agents.values()).find(
              (agent) => agent.invitationCode === where.invitationCode,
            ) ?? null
          );
        }

        return agents.get(where.id) ?? null;
      },
    },
    getBindingHistory: () => agentBindings,
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
        if (
          Array.from(users.values()).some(
            (user) => user.username === data.username,
          )
        ) {
          const error = new Error('Unique constraint failed');
          Object.assign(error, {
            code: 'P2002',
            meta: {
              target: ['username'],
            },
          });
          throw error;
        }

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
      findUnique: async ({ include, where }: any) => {
        const presentUser = (user: FakeUser | null) => {
          if (!user) {
            return null;
          }

          if (include?.currentAgent) {
            return {
              ...user,
              currentAgent: user.currentAgentId
                ? agents.get(user.currentAgentId) ?? null
                : null,
            };
          }

          return user;
        };

        if ('id' in where) {
          return presentUser(users.get(where.id) ?? null);
        }

        if ('username' in where) {
          return presentUser(
            Array.from(users.values()).find(
              (user) => user.username === where.username,
            ) ?? null,
          );
        }

        return null;
      },
      update: async ({ data, where }: any) => {
        const user = users.get(where.id);
        if (!user) {
          throw new Error('user not found');
        }

        const next = { ...user, ...data, updatedAt: new Date() };
        users.set(next.id, next);
        return next;
      },
    },
    userAgentBindingHistory: {
      create: async ({ data }: any) => {
        const binding = {
          createdAt: new Date(),
          id: `binding-${agentBindings.length + 1}`,
          ...data,
        };
        agentBindings.push(binding);
        return binding;
      },
    },
    $transaction: async (callback: any) => callback(prisma),
  } as any;

  return prisma as any;
}
