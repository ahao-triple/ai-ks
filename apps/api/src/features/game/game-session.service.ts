import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { KuaishouGameAuthClient } from '../../integrations/kuaishou/kuaishou-game-auth.client';
import { GameDataStore } from '../game-data/game-data.store';

export type CreateGameSessionInput = {
  gameAppId: string;
  jsCode: string;
};

@Injectable()
export class GameSessionService {
  private readonly logger = new Logger(GameSessionService.name);

  constructor(
    private readonly authClient: KuaishouGameAuthClient,
    private readonly gameDataStore: GameDataStore,
  ) {}

  async createSession(input: CreateGameSessionInput) {
    this.logger.log(
      `游戏登录：收到 js_code 换 open_id 请求，gameAppId=${input.gameAppId}。`,
    );

    const game = await this.gameDataStore.findGameByAppId(input.gameAppId);
    if (!game) {
      this.logger.warn(
        `游戏登录：未找到游戏配置，gameAppId=${input.gameAppId}。`,
      );
      throw new NotFoundException(`Game ${input.gameAppId} is not configured`);
    }

    this.logger.log(
      `游戏登录：已找到游戏配置，gameAppId=${game.gameAppId}，gameName=${game.name}。`,
    );

    const session = await this.authClient.exchangeCode({
      gameAppId: game.gameAppId,
      gameSecret: game.gameSecret,
      jsCode: input.jsCode,
    });

    this.logger.log(
      `游戏登录：快手 code2Session 成功，gameAppId=${game.gameAppId}，openId=${session.openId}。`,
    );

    const openIdRecord = await this.gameDataStore.upsertOpenId({
      gameAppId: game.gameAppId,
      openId: session.openId,
      sessionKey: session.sessionKey,
    });

    this.logger.log(
      `游戏登录：open_id 写入完成，gameAppId=${game.gameAppId}，openId=${openIdRecord.openId}，readableId=${openIdRecord.readableId}。`,
    );

    return {
      game: {
        gameAppId: game.gameAppId,
        name: game.name,
      },
      openId: openIdRecord.openId,
      readableId: openIdRecord.readableId,
      source: session.raw,
    };
  }
}
