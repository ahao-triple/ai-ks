import {
  Controller,
  Get,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { z } from 'zod';
import { AdminJwtGuard } from '../admin-auth/admin-jwt.guard';
import { SuperAdminGuard } from '../admin-auth/super-admin.guard';
import { resolveChinaDayRange } from '../user/china-day-range';
import { CachedResponseInterceptor } from '../../common/rate-limit/cached-response.interceptor';
import { RateLimitGuard } from '../../common/rate-limit/rate-limit.guard';
import { Throttle } from '../../common/rate-limit/throttle.decorator';
import { SuperAdminDashboardService } from './super-admin-dashboard.service';

const dateOnly = z.object({ date: z.string().optional() });

const STANDARD_THROTTLE = {
  windowMs: 5_000,
  max: 1,
  cacheMs: 60_000,
};

@Controller('admin/dashboard')
@UseGuards(AdminJwtGuard, SuperAdminGuard, RateLimitGuard)
@UseInterceptors(CachedResponseInterceptor)
export class SuperAdminDashboardController {
  constructor(private readonly service: SuperAdminDashboardService) {}

  @Get('overview')
  @Throttle(STANDARD_THROTTLE)
  async overview(@Query() query: unknown) {
    const { date } = dateOnly.parse(query ?? {});
    return this.service.getOverview({ range: resolveChinaDayRange(date) });
  }

  @Get('companies')
  @Throttle(STANDARD_THROTTLE)
  async companies(@Query() query: unknown) {
    const { date } = dateOnly.parse(query ?? {});
    return this.service.getCompanyDistribution({
      range: resolveChinaDayRange(date),
    });
  }

  @Get('anomalies')
  @Throttle(STANDARD_THROTTLE)
  async anomalies() {
    return this.service.getAnomalies();
  }
}
