import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type ConfigReader = Pick<ConfigService, 'get'>;

export type KuaishouGameSessionInput = {
  gameAppId: string;
  gameSecret: string;
  jsCode: string;
};

export type KuaishouGameSessionResult = {
  openId: string;
  sessionKey?: string;
  unionId?: string;
  raw: unknown;
};

@Injectable()
export class KuaishouGameAuthClient {
  constructor(@Inject(ConfigService) private readonly configService: ConfigReader) {}

  async exchangeCode(
    input: KuaishouGameSessionInput,
  ): Promise<KuaishouGameSessionResult> {
    if (this.getMode() !== 'real') {
      return this.createMockSession(input);
    }

    const url = new URL('https://open.kuaishou.com/game/minigame/jscode2session');
    url.searchParams.set('app_id', input.gameAppId);
    url.searchParams.set('app_secret', input.gameSecret);
    url.searchParams.set('js_code', input.jsCode);
    url.searchParams.set('grant_type', 'authorization_code');

    const response = await fetch(url);
    const payload = (await response.json()) as Record<string, unknown>;
    const openId = readString(payload, 'open_id') ?? readString(payload, 'openId');

    if (!response.ok || !openId) {
      throw new Error(`Kuaishou code2Session failed: ${JSON.stringify(payload)}`);
    }

    return {
      openId,
      sessionKey:
        readString(payload, 'session_key') ?? readString(payload, 'sessionKey'),
      unionId: readString(payload, 'union_id') ?? readString(payload, 'unionId'),
      raw: payload,
    };
  }

  private getMode(): 'mock' | 'real' {
    return this.configService.get<string>('KUAISHOU_API_MODE') === 'real'
      ? 'real'
      : 'mock';
  }

  private createMockSession(
    input: KuaishouGameSessionInput,
  ): KuaishouGameSessionResult {
    const digest = createHash('sha1')
      .update(`${input.gameAppId}:${input.jsCode}`)
      .digest('hex')
      .slice(0, 16);

    return {
      openId: `mock_open_${digest}`,
      sessionKey: `mock_session_${digest.slice(0, 10)}`,
      raw: {
        mode: 'mock',
        js_code: input.jsCode,
      },
    };
  }
}

function readString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
