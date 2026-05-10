import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { summarizeKuaishouPayload } from './kuaishou-error-message';

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
    this.assertRealMode();

    const url = new URL('https://open.kuaishou.com/game/minigame/jscode2session');
    url.searchParams.set('app_id', input.gameAppId);
    url.searchParams.set('app_secret', input.gameSecret);
    url.searchParams.set('js_code', input.jsCode);
    url.searchParams.set('grant_type', 'authorization_code');

    const response = await fetch(url);
    const payload = (await response.json()) as Record<string, unknown>;
    const openId = readString(payload, 'open_id') ?? readString(payload, 'openId');

    if (!response.ok || !openId) {
      throw new BadGatewayException(
        `快手 code2Session 失败：${summarizeKuaishouPayload(payload)}`,
      );
    }

    return {
      openId,
      sessionKey:
        readString(payload, 'session_key') ?? readString(payload, 'sessionKey'),
      unionId: readString(payload, 'union_id') ?? readString(payload, 'unionId'),
      raw: payload,
    };
  }

  private assertRealMode() {
    if (this.configService.get<string>('KUAISHOU_API_MODE') !== 'real') {
      throw new BadRequestException(
        'KUAISHOU_API_MODE 必须配置为 real 后才能调用快手 code2Session',
      );
    }
  }
}

function readString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
