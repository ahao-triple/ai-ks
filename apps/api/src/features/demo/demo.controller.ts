import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DemoStore } from './demo-store';

@Controller()
export class DemoController {
  constructor(
    private readonly configService: ConfigService,
    private readonly demoStore: DemoStore,
  ) {}

  @Get('demo/test-context')
  async getTestContext() {
    const games = await this.demoStore.listGames();
    return {
      games: games.map((game) => ({
        id: game.id,
        companyName: game.companyName,
        gameAppId: game.gameAppId,
        name: game.name,
      })),
      sampleJsCodes: ['mock-js-code-001', 'mock-js-code-002'],
    };
  }

  @Get('integrations/status')
  getIntegrationStatus() {
    const mode = this.configService.get<string>('KUAISHOU_API_MODE') ?? 'mock';

    return {
      kuaishouApiMode: mode === 'real' ? 'real' : 'mock',
      requiredForRealMode: {
        kuaishouAccessToken: Boolean(
          this.configService.get<string>('KUAISHOU_ACCESS_TOKEN'),
        ),
        kuaishouAdvertiserId: Boolean(
          this.configService.get<string>('KUAISHOU_ADVERTISER_ID'),
        ),
      },
      endpoints: {
        code2Session:
          'https://open.kuaishou.com/game/minigame/jscode2session',
        ecpmReport:
          'https://ad.e.kuaishou.com/rest/openapi/gw/dsp/v1/report/ecpm_report',
      },
    };
  }
}
