import { Injectable, NotFoundException } from '@nestjs/common';
import { KuaishouGameAuthClient } from '../../integrations/kuaishou/kuaishou-game-auth.client';
import { DemoStore } from '../demo/demo-store';

export type CreateGameSessionInput = {
  gameAppId: string;
  jsCode: string;
};

@Injectable()
export class GameSessionService {
  constructor(
    private readonly authClient: KuaishouGameAuthClient,
    private readonly demoStore: DemoStore,
  ) {}

  async createSession(input: CreateGameSessionInput) {
    const game = await this.demoStore.findGameByAppId(input.gameAppId);
    if (!game) {
      throw new NotFoundException(`Game ${input.gameAppId} is not configured`);
    }

    const session = await this.authClient.exchangeCode({
      gameAppId: game.gameAppId,
      gameSecret: game.gameSecret,
      jsCode: input.jsCode,
    });
    const openIdRecord = await this.demoStore.upsertOpenId({
      gameAppId: game.gameAppId,
      openId: session.openId,
      sessionKey: session.sessionKey,
    });

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
