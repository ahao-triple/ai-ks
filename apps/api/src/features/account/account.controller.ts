import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { presentEcpmRow, presentMoneyLi } from '../demo/money-presenter';
import { resolveChinaDayRange } from '../user/china-day-range';
import { AccountService } from './account.service';

const registerSchema = z.object({
  password: z.string().min(6),
  username: z.string().min(3),
});

const loginSchema = registerSchema;

const bindOpenIdSchema = z.object({
  identity: z.string().min(1),
});

@Controller('accounts')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Post('register')
  async register(@Body() body: unknown) {
    const input = registerSchema.parse(body);
    return this.accountService.register(input);
  }

  @Post('login')
  async login(@Body() body: unknown) {
    const input = loginSchema.parse(body);
    return this.accountService.login(input);
  }

  @Post(':userId/open-ids')
  async bindOpenId(@Param('userId') userId: string, @Body() body: unknown) {
    const input = bindOpenIdSchema.parse(body);
    return this.accountService.bindOpenId({
      identity: input.identity,
      userId,
    });
  }

  @Get(':userId/earnings')
  async getEarnings(
    @Param('userId') userId: string,
    @Query('date') date?: string,
  ) {
    const range = resolveChinaDayRange(date);
    const result = await this.accountService.queryEarnings({
      endAt: range.endAt,
      startAt: range.startAt,
      userId,
    });

    return {
      date: range.day,
      openIds: result.openIds,
      rows: result.rows.map((row) =>
        presentEcpmRow({
          configSnapshot: {
            ratioPercent: 50,
          },
          displayAmountLi: row.displayAmountLi,
          eventTime: row.eventTime,
          gameAppId: '',
          openId: row.openId,
          platformEventId: row.platformEventId,
          rawCostLi: row.rawCostLi,
        }),
      ),
      totalDisplayAmount: presentMoneyLi(result.totalDisplayAmountLi),
      totalRawCost: presentMoneyLi(result.totalRawCostLi),
      userId: result.userId,
    };
  }
}
