import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { GameDataStore } from '../game-data/game-data.store';
import { presentEcpmRow, presentMoneyLi } from '../../common/presenters/money-presenter';
import { resolveChinaDayRange } from './china-day-range';

@Controller('user')
export class UserEarningsController {
  constructor(private readonly gameDataStore: GameDataStore) {}

  @Get('earnings')
  async getEarnings(
    @Query('identity') identity?: string,
    @Query('date') date?: string,
  ) {
    if (!identity) {
      throw new BadRequestException('identity 不能为空');
    }

    const range = resolveChinaDayRange(date);
    const result = await this.gameDataStore.queryEarnings({
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
