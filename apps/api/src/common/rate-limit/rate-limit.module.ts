import { Global, Module } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CachedResponseInterceptor } from './cached-response.interceptor';
import { RateLimitGuard } from './rate-limit.guard';

@Global()
@Module({
  providers: [Reflector, RateLimitGuard, CachedResponseInterceptor],
  exports: [RateLimitGuard, CachedResponseInterceptor],
})
export class RateLimitModule {}
