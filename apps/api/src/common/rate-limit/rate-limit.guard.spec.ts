import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitGuard, RATE_LIMIT_META, RateLimitOptions } from './rate-limit.guard';

function ctxFor(userId: string, route: string): ExecutionContext {
  const req: any = { user: { id: userId }, route: { path: route }, method: 'GET' };
  return {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => ({}) }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as any;
}

describe('RateLimitGuard', () => {
  const opts: RateLimitOptions = { windowMs: 1000, max: 2, cacheMs: 60_000 };
  let reflector: Reflector;
  let guard: RateLimitGuard;

  beforeEach(() => {
    reflector = new Reflector();
    jest.spyOn(reflector, 'get').mockReturnValue(opts);
    guard = new RateLimitGuard(reflector);
  });

  it('放行未触限请求', () => {
    const ctx = ctxFor('u1', '/api/users/me/dashboard');
    expect(guard.canActivate(ctx)).toBe(true);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('超出限频时设置 cache-hit 标记并放行（不抛 429）', () => {
    const ctx = ctxFor('u2', '/api/users/me/dashboard');
    guard.canActivate(ctx);
    guard.canActivate(ctx);
    const req = ctx.switchToHttp().getRequest();
    expect(guard.canActivate(ctx)).toBe(true);
    expect(req.rateLimitHit).toBe(true);
  });

  it('窗口过期后重置计数', () => {
    jest.useFakeTimers();
    const ctx = ctxFor('u3', '/api/users/me/dashboard');
    guard.canActivate(ctx);
    guard.canActivate(ctx);
    jest.advanceTimersByTime(1100);
    const req = ctx.switchToHttp().getRequest();
    guard.canActivate(ctx);
    expect(req.rateLimitHit).toBeUndefined();
    jest.useRealTimers();
  });

  it('未配置 Throttle 元数据时直接放行', () => {
    jest.spyOn(reflector, 'get').mockReturnValueOnce(undefined);
    const ctx = ctxFor('u4', '/api/some-path');
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
