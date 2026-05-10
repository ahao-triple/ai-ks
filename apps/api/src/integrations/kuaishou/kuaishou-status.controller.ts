import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Controller('integrations')
export class KuaishouStatusController {
  constructor(private readonly configService: ConfigService) {}

  @Get('status')
  getIntegrationStatus() {
    const realModeEnabled =
      this.configService.get<string>('KUAISHOU_API_MODE') === 'real';

    return {
      kuaishouApiMode: realModeEnabled ? 'real' : 'unconfigured',
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
