import { describe, expect, it } from 'vitest';
import {
  initialThrottleState,
  shouldThrottle,
  throttleReducer,
} from './throttleState';

describe('shouldThrottle', () => {
  it('窗口内：返回 true', () => {
    expect(shouldThrottle(1000, 500, 1000)).toBe(true);
  });

  it('窗口外：返回 false', () => {
    expect(shouldThrottle(2000, 500, 1000)).toBe(false);
  });

  it('lastFetchAt = 0 时（首次）：返回 false', () => {
    expect(shouldThrottle(100, 0, 1000)).toBe(false);
  });
});

describe('throttleReducer', () => {
  type Data = { value: number };

  it('request-start 切换 loading=true 并记录时间', () => {
    const state = throttleReducer<Data>(initialThrottleState<Data>(), {
      type: 'request-start',
      now: 12345,
    });
    expect(state.loading).toBe(true);
    expect(state.lastFetchAt).toBe(12345);
  });

  it('request-success 写入 data 并显示成功 toast', () => {
    const start = throttleReducer<Data>(initialThrottleState<Data>(), {
      type: 'request-start',
      now: 100,
    });
    const next = throttleReducer<Data>(start, {
      type: 'request-success',
      data: { value: 42 },
    });
    expect(next.data).toEqual({ value: 42 });
    expect(next.loading).toBe(false);
    expect(next.toast).toEqual({ kind: 'success', message: '✓ 已刷新' });
    expect(next.lastFetchAt).toBe(100);
  });

  it('request-failure 显示错误 toast，loading=false', () => {
    const start = throttleReducer<Data>(initialThrottleState<Data>(), {
      type: 'request-start',
      now: 100,
    });
    const next = throttleReducer<Data>(start, { type: 'request-failure' });
    expect(next.loading).toBe(false);
    expect(next.toast?.kind).toBe('error');
  });

  it('idle-hit 显示 idle toast，不影响 lastFetchAt 与 data', () => {
    const seeded = throttleReducer<Data>(
      throttleReducer<Data>(initialThrottleState<Data>(), {
        type: 'request-start',
        now: 100,
      }),
      { type: 'request-success', data: { value: 7 } },
    );
    const next = throttleReducer<Data>(seeded, { type: 'idle-hit' });
    expect(next.toast).toEqual({
      kind: 'idle-hit',
      message: '✓ 数据已是最新',
    });
    expect(next.data).toEqual({ value: 7 });
    expect(next.lastFetchAt).toBe(100);
  });

  it('toast-clear 清空 toast 但保留 data', () => {
    const seeded = throttleReducer<Data>(
      throttleReducer<Data>(initialThrottleState<Data>(), {
        type: 'request-start',
        now: 100,
      }),
      { type: 'request-success', data: { value: 7 } },
    );
    const next = throttleReducer<Data>(seeded, { type: 'toast-clear' });
    expect(next.toast).toBeNull();
    expect(next.data).toEqual({ value: 7 });
  });
});
