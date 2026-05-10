import { Global, Module } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitGuard } from './rate-limit.guard';

@Global()
@Module({
  providers: [Reflector, RateLimitGuard],
  exports: [RateLimitGuard],
})
export class RateLimitModule {}
