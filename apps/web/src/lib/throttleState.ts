export type ThrottleToastKind = 'success' | 'idle-hit' | 'error';

export type ThrottleToast = {
  kind: ThrottleToastKind;
  message: string;
};

export type ThrottleState<T> = {
  data: T | null;
  loading: boolean;
  toast: ThrottleToast | null;
  lastFetchAt: number;
};

export type ThrottleAction<T> =
  | { type: 'request-start'; now: number }
  | { type: 'request-success'; data: T }
  | { type: 'request-failure' }
  | { type: 'idle-hit' }
  | { type: 'toast-clear' };

export function initialThrottleState<T>(): ThrottleState<T> {
  return { data: null, loading: false, toast: null, lastFetchAt: 0 };
}

export function throttleReducer<T>(
  state: ThrottleState<T>,
  action: ThrottleAction<T>,
): ThrottleState<T> {
  switch (action.type) {
    case 'request-start':
      return { ...state, loading: true, lastFetchAt: action.now };
    case 'request-success':
      return {
        data: action.data,
        loading: false,
        toast: { kind: 'success', message: '✓ 已刷新' },
        lastFetchAt: state.lastFetchAt,
      };
    case 'request-failure':
      return {
        ...state,
        loading: false,
        toast: { kind: 'error', message: '⚠ 刷新失败，稍后再试' },
      };
    case 'idle-hit':
      return {
        ...state,
        toast: { kind: 'idle-hit', message: '✓ 数据已是最新' },
      };
    case 'toast-clear':
      return { ...state, toast: null };
  }
}

export function shouldThrottle(
  now: number,
  lastFetchAt: number,
  windowMs: number,
): boolean {
  if (lastFetchAt === 0) return false;
  return now - lastFetchAt < windowMs;
}
