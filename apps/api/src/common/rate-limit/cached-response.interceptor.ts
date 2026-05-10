import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { RATE_LIMIT_META, RateLimitOptions } from './rate-limit.guard';

type CacheEntry = { value: unknown; expiresAt: number };

@Injectable()
export class CachedResponseInterceptor implements NestInterceptor {
  private readonly cache = new Map<string, CacheEntry>();
  constructor(private readonly reflector: Reflector) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const opts = this.reflector.get<RateLimitOptions | undefined>(
      RATE_LIMIT_META,
      ctx.getHandler(),
    );
    if (!opts) return next.handle();

    const req = ctx.switchToHttp().getRequest<{
      account?: { id?: string };
      user?: { id?: string };
      agent?: { id?: string };
      admin?: { id?: string };
      ip?: string;
      route?: { path?: string };
      url?: string;
      method?: string;
      rateLimitHit?: boolean;
    }>();
    const res = ctx
      .switchToHttp()
      .getResponse<{ setHeader: (name: string, value: string) => void }>();
    const principalId =
      req?.account?.id ??
      req?.user?.id ??
      req?.agent?.id ??
      req?.admin?.id ??
      req?.ip ??
      'anon';
    const route = req?.route?.path ?? req?.url ?? 'unknown';
    // cache key 必须区分 query，否则不同筛选条件会互相命中彼此的缓存
    const queryStr =
      typeof req?.url === 'string' && req.url.includes('?')
        ? req.url.slice(req.url.indexOf('?'))
        : '';
    const key = `${principalId}:${route}:${req?.method ?? 'GET'}${queryStr}`;
    const now = Date.now();

    if (req.rateLimitHit) {
      const cached = this.cache.get(key);
      if (cached && cached.expiresAt > now) {
        res.setHeader('X-Cache-Hit', 'true');
        return of(cached.value);
      }
    }

    return next.handle().pipe(
      tap((value) => {
        this.cache.set(key, { value, expiresAt: now + opts.cacheMs });
      }),
    );
  }
}
