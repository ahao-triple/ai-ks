import { SetMetadata } from '@nestjs/common';
import { RATE_LIMIT_META, RateLimitOptions } from './rate-limit.guard';

export const Throttle = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_META, options);
