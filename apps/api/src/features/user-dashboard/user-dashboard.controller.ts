import {
  Controller,
  Get,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { z } from 'zod';
import { type AccountPrincipal } from '../account/account-auth.service';
import { AccountJwtGuard } from '../account/account-jwt.guard';
import { CurrentAccount } from '../account/current-account.decorator';
import {
  resolveChinaDayRange,
  resolveDashboardDayRange,
} from '../user/china-day-range';
import { CachedResponseInterceptor } from '../../common/rate-limit/cached-response.interceptor';
import { RateLimitGuard } from '../../common/rate-limit/rate-limit.guard';
import { Throttle } from '../../common/rate-limit/throttle.decorator';
import { UserDashboardService } from './user-dashboard.service';

const querySchema = z.object({
  date: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  gameId: z.string().optional(),
  accountId: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).optional().default(50),
});

// 兼容旧的单日 date 参数（如果传），否则按 start/end 日期范围
function resolveQueryRange(input: {
  date?: string;
  start?: string;
  end?: string;
}) {
  return input.date
    ? resolveChinaDayRange(input.date)
    : resolveDashboardDayRange({ startDay: input.start, endDay: input.end });
}

const STANDARD_THROTTLE = {
  windowMs: 5_000,
  max: 1,
  cacheMs: 60_000,
};

@Controller('users/me/dashboard')
@UseGuards(AccountJwtGuard, RateLimitGuard)
@UseInterceptors(CachedResponseInterceptor)
export class UserDashboardController {
  constructor(private readonly service: UserDashboardService) {}

  @Get('overview')
  @Throttle(STANDARD_THROTTLE)
  async overview(
    @CurrentAccount() account: AccountPrincipal,
    @Query() query: unknown,
  ) {
    const { date, start, end } = querySchema.parse(query ?? {});
    return this.service.getOverview({
      userId: account.id,
      range: resolveQueryRange({ date, start, end }),
    });
  }

  @Get('groups')
  @Throttle(STANDARD_THROTTLE)
  async groups(
    @CurrentAccount() account: AccountPrincipal,
    @Query() query: unknown,
  ) {
    const { date, start, end } = querySchema.parse(query ?? {});
    return this.service.getGameAccountGroups({
      userId: account.id,
      range: resolveQueryRange({ date, start, end }),
    });
  }

  @Get('records')
  @Throttle(STANDARD_THROTTLE)
  async records(
    @CurrentAccount() account: AccountPrincipal,
    @Query() query: unknown,
  ) {
    const { date, start, end, gameId, accountId, limit } = querySchema.parse(
      query ?? {},
    );
    return this.service.listEcpmRecords({
      userId: account.id,
      range: resolveQueryRange({ date, start, end }),
      gameId,
      accountId,
      limit,
    });
  }
}
