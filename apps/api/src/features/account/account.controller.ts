import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { yuanToLi } from '../../domain/money/amount';
import { AuditLogService } from '../audit/audit-log.service';
import { presentEcpmRow, presentMoneyLi } from '../demo/money-presenter';
import { resolveChinaDayRange } from '../user/china-day-range';
import {
  AccountAuthService,
  type AccountPrincipal,
} from './account-auth.service';
import { AccountJwtGuard } from './account-jwt.guard';
import {
  AccountSettlementService,
  type ConfirmPendingEarningsResult,
} from './account-settlement.service';
import { AccountService } from './account.service';
import {
  AccountWalletService,
  type AccountWithdrawal,
} from './account-wallet.service';
import { CurrentAccount } from './current-account.decorator';

const registerSchema = z.object({
  password: z.string().min(6),
  username: z.string().min(3),
});

const loginSchema = registerSchema;

const bindOpenIdSchema = z.object({
  identity: z.string().min(1),
});

const updateAlipayProfileSchema = z.object({
  alipayAccount: z.string().min(1),
  alipayRealName: z.string().min(1),
});

const requestWithdrawalSchema = z.object({
  amountYuan: z.string().min(1),
});

@Controller('accounts')
export class AccountController {
  constructor(
    private readonly accountAuthService: AccountAuthService,
    private readonly accountSettlementService: AccountSettlementService,
    private readonly accountService: AccountService,
    private readonly accountWalletService: AccountWalletService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Post('register')
  async register(@Body() body: unknown) {
    const input = registerSchema.parse(body);
    const account = await this.accountService.register(input);
    return this.presentAuthenticatedAccount(account);
  }

  @Post('login')
  async login(@Body() body: unknown) {
    const input = loginSchema.parse(body);
    const account = await this.accountService.login(input);
    return this.presentAuthenticatedAccount(account);
  }

  @Get('me')
  @UseGuards(AccountJwtGuard)
  getCurrentAccount(@CurrentAccount() account: AccountPrincipal) {
    return account;
  }

  @Post('me/open-ids')
  @UseGuards(AccountJwtGuard)
  async bindOwnOpenId(
    @CurrentAccount() account: AccountPrincipal,
    @Body() body: unknown,
  ) {
    const input = bindOpenIdSchema.parse(body);
    return this.accountService.bindOpenId({
      identity: input.identity,
      userId: account.id,
    });
  }

  @Get('me/earnings')
  @UseGuards(AccountJwtGuard)
  async getOwnEarnings(
    @CurrentAccount() account: AccountPrincipal,
    @Query('date') date?: string,
  ) {
    return this.presentAccountEarnings(account.id, date);
  }

  @Post('me/settlements/confirm')
  @UseGuards(AccountJwtGuard)
  async confirmOwnPendingEarnings(@CurrentAccount() account: AccountPrincipal) {
    const result = await this.accountSettlementService.confirmPendingEarnings({
      userId: account.id,
    });
    await this.auditLogService.record({
      action: 'account.settlement.confirmed',
      actorId: account.id,
      actorType: 'USER',
      metadata: {
        settledAmountLi: result.settledAmountLi.toString(),
        settledCount: result.settledCount,
      },
      targetId: account.id,
      targetType: 'user_account',
    });

    return presentSettlement(result);
  }

  @Get('me/alipay')
  @UseGuards(AccountJwtGuard)
  getOwnAlipayProfile(@CurrentAccount() account: AccountPrincipal) {
    return this.accountWalletService.getAlipayProfile(account.id);
  }

  @Patch('me/alipay')
  @UseGuards(AccountJwtGuard)
  async updateOwnAlipayProfile(
    @CurrentAccount() account: AccountPrincipal,
    @Body() body: unknown,
  ) {
    const input = updateAlipayProfileSchema.parse(body);
    return this.accountWalletService.updateAlipayProfile({
      alipayAccount: input.alipayAccount,
      alipayRealName: input.alipayRealName,
      userId: account.id,
    });
  }

  @Post('me/withdrawals')
  @UseGuards(AccountJwtGuard)
  async requestOwnWithdrawal(
    @CurrentAccount() account: AccountPrincipal,
    @Body() body: unknown,
  ) {
    const input = requestWithdrawalSchema.parse(body);
    const withdrawal = await this.accountWalletService.requestWithdrawal({
      amountLi: yuanToLi(input.amountYuan),
      userId: account.id,
    });
    await this.auditLogService.record({
      action: 'withdrawal.requested',
      actorId: account.id,
      actorType: 'USER',
      metadata: {
        totalAmountLi: withdrawal.totalAmountLi.toString(),
      },
      targetId: withdrawal.id,
      targetType: 'withdrawal_batch',
    });

    return presentWithdrawal(withdrawal);
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
    return this.presentAccountEarnings(userId, date);
  }

  private async presentAuthenticatedAccount(account: AccountPrincipal) {
    return {
      accessToken: await this.accountAuthService.issueAccessToken(account),
      account,
    };
  }

  private async presentAccountEarnings(userId: string, date?: string) {
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

function presentWithdrawal(withdrawal: AccountWithdrawal) {
  return {
    id: withdrawal.id,
    status: withdrawal.status,
    totalAmount: presentMoneyLi(withdrawal.totalAmountLi),
    userId: withdrawal.userId,
    details: withdrawal.details.map((detail) => ({
      id: detail.id,
      amount: presentMoneyLi(detail.amountLi),
      recipientAlipay: detail.recipientAlipay,
      recipientName: detail.recipientName,
      status: detail.status,
      type: detail.type,
    })),
  };
}

function presentSettlement(result: ConfirmPendingEarningsResult) {
  return {
    settledAmount: presentMoneyLi(result.settledAmountLi),
    settledCount: result.settledCount,
    userId: result.userId,
  };
}
