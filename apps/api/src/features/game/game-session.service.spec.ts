import { Logger } from '@nestjs/common';
import { GameSessionService } from './game-session.service';

describe('GameSessionService', () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('writes Chinese logs for the game login exchange without secrets', async () => {
    const service = new GameSessionService(
      {
        exchangeCode: async () => ({
          openId: 'open-001',
          sessionKey: 'secret-session-key',
          raw: {
            mode: 'mock',
          },
        }),
      } as any,
      {
        findGameByAppId: async () => ({
          gameAppId: 'ks-game-001',
          gameSecret: 'secret-game-key',
          name: '测试游戏',
        }),
        upsertOpenId: async () => ({
          openId: 'open-001',
          readableId: 'GAME001',
        }),
      } as any,
    );

    await service.createSession({
      gameAppId: 'ks-game-001',
      jsCode: 'code-001',
    });

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('游戏登录：收到 js_code 换 open_id 请求'),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('游戏登录：已找到游戏配置'),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('游戏登录：open_id 写入完成'),
    );

    const logText = logSpy.mock.calls.map((call) => call.join(' ')).join('\n');
    expect(logText).not.toContain('secret-game-key');
    expect(logText).not.toContain('secret-session-key');
  });
});
