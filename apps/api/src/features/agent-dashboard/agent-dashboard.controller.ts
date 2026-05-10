import {
  Controller,
  Get,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { z } from 'zod';
import { type AgentPrincipal } from '../agent/agent-auth.service';
import { AgentJwtGuard } from '../agent/agent-jwt.guard';
import { CurrentAgent } from '../agent/current-agent.decorator';
import { resolveDashboardRange } from '../user/china-day-range';
import { CachedResponseInterceptor } from '../../common/rate-limit/cached-response.interceptor';
import { RateLimitGuard } from '../../common/rate-limit/rate-limit.guard';
import { Throttle } from '../../common/rate-limit/throttle.decorator';
import { AgentDashboardService } from './agent-dashboard.service';

const querySchema = z.object({
  range: z
    .enum(['today', 'yesterday', 'last3', 'last7'])
    .optional()
    .default('today'),
});

const STANDARD_THROTTLE = {
  windowMs: 5_000,
  max: 1,
  cacheMs: 60_000,
};

@Controller('agents/me/dashboard')
@UseGuards(AgentJwtGuard, RateLimitGuard)
@UseInterceptors(CachedResponseInterceptor)
export class AgentDashboardController {
  constructor(private readonly service: AgentDashboardService) {}

  @Get('overview')
  @Throttle(STANDARD_THROTTLE)
  async overview(
    @CurrentAgent() agent: AgentPrincipal,
    @Query() query: unknown,
  ) {
    const { range } = querySchema.parse(query ?? {});
    return this.service.getOverview({
      agentId: agent.id,
      range: resolveDashboardRange(range),
    });
  }

  @Get('users')
  @Throttle(STANDARD_THROTTLE)
  async users(
    @CurrentAgent() agent: AgentPrincipal,
    @Query() query: unknown,
  ) {
    const { range } = querySchema.parse(query ?? {});
    return this.service.listUnderUsers({
      agentId: agent.id,
      range: resolveDashboardRange(range),
    });
  }
}
