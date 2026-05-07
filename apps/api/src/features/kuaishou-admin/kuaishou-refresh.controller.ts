import { Body, Controller, Post } from '@nestjs/common';
import { z } from 'zod';
import { KuaishouEcpmClient } from '../../integrations/kuaishou/kuaishou-ecpm.client';
import { DemoStore } from '../demo/demo-store';
import { presentEcpmRow } from '../demo/money-presenter';

const refreshEcpmSchema = z.object({
  dataHour: z.string().min(1).optional(),
  gameAppId: z.string().min(1),
  openIds: z.array(z.string().min(1)).optional(),
});

@Controller('admin/kuaishou')
export class KuaishouRefreshController {
  constructor(
    private readonly demoStore: DemoStore,
    private readonly ecpmClient: KuaishouEcpmClient,
  ) {}

  @Post('ecpm/refresh')
  async refresh(@Body() body: unknown) {
    const input = refreshEcpmSchema.parse(body);
    const knownOpenIds = (await this.demoStore.listOpenIds(input.gameAppId)).map(
      (record) => record.openId,
    );
    const openIds = input.openIds?.length ? input.openIds : knownOpenIds;
    const refreshResult = await this.ecpmClient.refresh({
      gameAppId: input.gameAppId,
      dataHour: input.dataHour ?? currentChinaDate(),
      openIds,
    });
    const savedRows = await this.demoStore.addEcpmRows({
      gameAppId: input.gameAppId,
      rows: refreshResult.rows,
    });

    return {
      source: refreshResult.source,
      requestedOpenIds: openIds,
      savedCount: savedRows.length,
      rows: savedRows.map(presentEcpmRow),
    };
  }
}

function currentChinaDate() {
  return new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
  }).format(new Date());
}
