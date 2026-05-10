import { KuaishouGameAuthClient } from './kuaishou-game-auth.client';

describe('KuaishouGameAuthClient', () => {
  it('rejects code exchange when real Kuaishou mode is not enabled', async () => {
    const client = new KuaishouGameAuthClient({
      get: () => undefined,
    });

    await expect(
      client.exchangeCode({
        gameAppId: 'game-app',
        gameSecret: 'game-secret',
        jsCode: 'real-js-code',
      }),
    ).rejects.toThrow('KUAISHOU_API_MODE must be real');
  });
});
