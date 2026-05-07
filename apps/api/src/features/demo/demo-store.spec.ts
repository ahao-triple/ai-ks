import { DemoStore } from './demo-store';

describe('DemoStore', () => {
  it('persists the local login, ecpm refresh, and user query loop', async () => {
    const prisma = createFakePrisma();
    const firstStore = new DemoStore(prisma);
    const secondStore = new DemoStore(prisma);

    const [game] = await firstStore.listGames();
    const session = await firstStore.upsertOpenId({
      gameAppId: game.gameAppId,
      openId: 'mock_open_001',
      sessionKey: 'session_001',
    });

    await firstStore.addEcpmRows({
      gameAppId: game.gameAppId,
      rows: [
        {
          platformEventId: 'evt_001',
          openId: 'mock_open_001',
          rawCostLi: 10000n,
          eventTime: new Date('2026-05-07T03:00:00.000Z'),
        },
      ],
    });

    const result = await secondStore.queryEarnings({
      identity: session.readableId,
      startAt: new Date('2026-05-07T00:00:00.000Z'),
      endAt: new Date('2026-05-08T00:00:00.000Z'),
    });

    expect(session.readableId).toHaveLength(7);
    expect(result.openId).toBe('mock_open_001');
    expect(result.totalRawCostLi).toBe(10000n);
    expect(result.totalDisplayAmountLi).toBe(5000n);
    expect(result.rows).toHaveLength(1);
  });
});

type FakeCompany = {
  id: string;
  name: string;
  balanceLi: bigint;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type FakeGame = {
  id: string;
  companyId: string;
  name: string;
  gameAppId: string;
  gameSecret: string;
  budgetLi: bigint;
  settlementPaused: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  company?: FakeCompany;
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
  status: 'PENDING';
  configSnapshot: unknown;
  createdAt: Date;
};

function createFakePrisma() {
  const companies = new Map<string, FakeCompany>();
  const games = new Map<string, FakeGame>();
  const openIds = new Map<string, FakeOpenId>();
  const rawEcpms = new Map<string, FakeRawEcpm>();

  const withCompany = (game: FakeGame) => ({
    ...game,
    company: companies.get(game.companyId),
  });

  return {
    company: {
      upsert: async ({ create, update, where }: any) => {
        const existing = companies.get(where.id);
        const next = existing
          ? { ...existing, ...update, updatedAt: new Date() }
          : { ...create, createdAt: new Date(), updatedAt: new Date() };
        companies.set(where.id, next);
        return next;
      },
    },
    game: {
      findMany: async () => Array.from(games.values()).map(withCompany),
      findUnique: async ({ where }: any) => {
        const game = Array.from(games.values()).find(
          (item) => item.gameAppId === where.gameAppId,
        );
        return game ? withCompany(game) : null;
      },
      upsert: async ({ create, update, where }: any) => {
        const existing = Array.from(games.values()).find(
          (item) => item.gameAppId === where.gameAppId,
        );
        const next = existing
          ? { ...existing, ...update, updatedAt: new Date() }
          : { ...create, createdAt: new Date(), updatedAt: new Date() };
        games.set(next.id, next);
        return next;
      },
    },
    gameOpenId: {
      findMany: async ({ where }: any) =>
        Array.from(openIds.values()).filter((item) => item.gameId === where.gameId),
      findUnique: async ({ where }: any) =>
        Array.from(openIds.values()).find(
          (item) =>
            item.openId === where.openId || item.readableId === where.readableId,
        ) ?? null,
      upsert: async ({ create, update, where }: any) => {
        const existing = openIds.get(where.openId);
        const next = existing
          ? { ...existing, ...update, updatedAt: new Date() }
          : { ...create, createdAt: new Date(), updatedAt: new Date() };
        openIds.set(next.openId, next);
        return next;
      },
    },
    rawEcpm: {
      findMany: async ({ where }: any) =>
        Array.from(rawEcpms.values()).filter(
          (item) =>
            item.openId === where.openId &&
            item.eventTime >= where.eventTime.gte &&
            item.eventTime < where.eventTime.lt,
        ),
      upsert: async ({ create, update, where }: any) => {
        const key = `${where.gameId_platformEventId.gameId}:${where.gameId_platformEventId.platformEventId}`;
        const existing = rawEcpms.get(key);
        const next = existing
          ? { ...existing, ...update }
          : { ...create, id: `raw-${rawEcpms.size + 1}`, createdAt: new Date() };
        rawEcpms.set(key, next);
        return next;
      },
    },
  } as any;
}
