import { KuaishouGameAuthClient } from './kuaishou-game-auth.client';

describe('KuaishouGameAuthClient', () => {
  it('returns deterministic mock open_id values for local testing', async () => {
    const client = new KuaishouGameAuthClient({
      get: (key: string) => (key === 'KUAISHOU_API_MODE' ? 'mock' : undefined),
    });

    const result = await client.exchangeCode({
      gameAppId: 'demo-game-app',
      gameSecret: 'demo-secret',
      jsCode: 'mock-js-code-001',
    });

    expect(result.openId).toMatch(/^mock_open_/);
    expect(result.openId).toBe(
      (
        await client.exchangeCode({
          gameAppId: 'demo-game-app',
          gameSecret: 'demo-secret',
          jsCode: 'mock-js-code-001',
        })
      ).openId,
    );
  });
});
