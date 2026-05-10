import { firstValueFrom, of } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { CachedResponseInterceptor } from './cached-response.interceptor';

function ctxFor(userId: string, route: string, hit = false) {
  const req: Record<string, unknown> = {
    user: { id: userId },
    route: { path: route },
    method: 'GET',
    rateLimitHit: hit,
  };
  const res = { setHeader: jest.fn() };
  return {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    getHandler: () => () => undefined,
    getClass: () => class {},
    res,
  };
}

describe('CachedResponseInterceptor', () => {
  let reflector: Reflector;
  let interceptor: CachedResponseInterceptor;

  beforeEach(() => {
    reflector = new Reflector();
    jest
      .spyOn(reflector, 'get')
      .mockReturnValue({ windowMs: 1000, max: 2, cacheMs: 60_000 });
    interceptor = new CachedResponseInterceptor(reflector);
  });

  it('未触限：透传响应并写入缓存', async () => {
    const ctx = ctxFor('u1', '/api/x') as never;
    const res = await firstValueFrom(
      interceptor.intercept(ctx, { handle: () => of({ data: 'fresh' }) }),
    );
    expect(res).toEqual({ data: 'fresh' });
  });

  it('已触限且有缓存：返回缓存并打 X-Cache-Hit 头', async () => {
    const okCtx = ctxFor('u1', '/api/x');
    await firstValueFrom(
      interceptor.intercept(okCtx as never, {
        handle: () => of({ data: 'fresh' }),
      }),
    );

    const hitCtx = ctxFor('u1', '/api/x', true);
    const res = await firstValueFrom(
      interceptor.intercept(hitCtx as never, {
        handle: () => of({ data: 'should-not-emit' }),
      }),
    );
    expect(res).toEqual({ data: 'fresh' });
    expect(hitCtx.res.setHeader).toHaveBeenCalledWith('X-Cache-Hit', 'true');
  });

  it('未配置 Throttle 元数据：不参与缓存与限流，直接透传', async () => {
    jest.spyOn(reflector, 'get').mockReturnValueOnce(undefined);
    const ctx = ctxFor('u2', '/api/free');
    const res = await firstValueFrom(
      interceptor.intercept(ctx as never, {
        handle: () => of({ data: 'live' }),
      }),
    );
    expect(res).toEqual({ data: 'live' });
  });

  it('已触限但无缓存：仍调用 handler 并填充缓存', async () => {
    const ctx = ctxFor('u3', '/api/y', true);
    const res = await firstValueFrom(
      interceptor.intercept(ctx as never, {
        handle: () => of({ data: 'first' }),
      }),
    );
    expect(res).toEqual({ data: 'first' });
  });

  it('缓存超过 cacheMs 后视为失效，重新调用 handler', async () => {
    jest.useFakeTimers();
    jest
      .spyOn(reflector, 'get')
      .mockReturnValue({ windowMs: 1000, max: 2, cacheMs: 1000 });
    interceptor = new CachedResponseInterceptor(reflector);

    const okCtx = ctxFor('u4', '/api/z');
    await firstValueFrom(
      interceptor.intercept(okCtx as never, {
        handle: () => of({ data: 'old' }),
      }),
    );
    jest.advanceTimersByTime(1500);
    const hitCtx = ctxFor('u4', '/api/z', true);
    const res = await firstValueFrom(
      interceptor.intercept(hitCtx as never, {
        handle: () => of({ data: 'new' }),
      }),
    );
    expect(res).toEqual({ data: 'new' });
    jest.useRealTimers();
  });
});
