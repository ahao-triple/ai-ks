import { DemoStore } from './demo-store';

describe('DemoStore', () => {
  it('supports the local login, ecpm refresh, and user query loop', () => {
    const store = new DemoStore();
    const session = store.upsertOpenId({
      gameAppId: 'demo_ks_game',
      openId: 'mock_open_001',
      sessionKey: 'session_001',
    });

    store.addEcpmRows({
      gameAppId: 'demo_ks_game',
      rows: [
        {
          platformEventId: 'evt_001',
          openId: 'mock_open_001',
          rawCostLi: 10000n,
          eventTime: new Date('2026-05-07T03:00:00.000Z'),
        },
      ],
    });

    const result = store.queryEarnings({
      identity: session.openId,
      startAt: new Date('2026-05-07T00:00:00.000Z'),
      endAt: new Date('2026-05-08T00:00:00.000Z'),
    });

    expect(session.readableId).toHaveLength(7);
    expect(result.totalRawCostLi).toBe(10000n);
    expect(result.totalDisplayAmountLi).toBe(5000n);
    expect(result.rows).toHaveLength(1);
  });
});
