import { Controller, Get, Query } from '@nestjs/common';
import { DemoStore } from '../demo/demo-store';
import { presentEcpmRow, presentMoneyLi } from '../demo/money-presenter';
import { resolveChinaDayRange } from './china-day-range';

@Controller('user')
export class UserEarningsController {
  constructor(private readonly demoStore: DemoStore) {}

  @Get('earnings')
  getEarnings(@Query('identity') identity?: string, @Query('date') date?: string) {
    if (!identity) {
      throw new Error('identity is required');
    }

    const range = resolveChinaDayRange(date);
    const result = this.demoStore.queryEarnings({
      identity,
      startAt: range.startAt,
      endAt: range.endAt,
    });

    return {
      identity: result.identity,
      openId: result.openId,
      readableId: result.readableId,
      date: range.day,
      totalRawCost: presentMoneyLi(result.totalRawCostLi),
      totalDisplayAmount: presentMoneyLi(result.totalDisplayAmountLi),
      rows: result.rows.map(presentEcpmRow),
    };
  }
}
