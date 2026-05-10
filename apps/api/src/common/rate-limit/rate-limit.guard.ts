import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const RATE_LIMIT_META = 'rate-limit-options';

export type RateLimitOptions = {
  windowMs: number;
  max: number;
  cacheMs: number;
};

type Bucket = { count: number; windowStart: number };

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const opts = this.reflector.get<RateLimitOptions | undefined>(
      RATE_LIMIT_META,
      ctx.getHandler(),
    );
    if (!opts) return true;

    const req = ctx.switchToHttp().getRequest();
    const key = this.bucketKey(req);
    const now = Date.now();
    const bucket = this.buckets.get(key) ?? { count: 0, windowStart: now };

    if (now - bucket.windowStart > opts.windowMs) {
      bucket.count = 0;
      bucket.windowStart = now;
    }
    bucket.count += 1;
    this.buckets.set(key, bucket);

    if (bucket.count > opts.max) {
      req.rateLimitHit = true;
    }
    return true;
  }

  private bucketKey(req: any): string {
    const principalId = req?.user?.id ?? req?.ip ?? 'anon';
    const route = req?.route?.path ?? req?.url ?? 'unknown';
    return `${principalId}:${route}:${req?.method ?? 'GET'}`;
  }
}
