import { useCallback, useEffect, useReducer, useRef } from 'react';
import {
  initialThrottleState,
  shouldThrottle,
  throttleReducer,
  type ThrottleAction,
  type ThrottleState,
} from './throttleState';

export type ThrottleOptions = {
  windowMs: number;
  toastDurationMs?: number;
};

export type ThrottledRefresh<T> = {
  data: T | null;
  loading: boolean;
  toast: ThrottleState<T>['toast'];
  refresh: () => Promise<void>;
  startAuto: (intervalMs: number) => void;
  stopAuto: () => void;
};

export function useThrottledRefresh<T>(
  fetcher: () => Promise<T>,
  options: ThrottleOptions,
): ThrottledRefresh<T> {
  const [state, dispatch] = useReducer(
    throttleReducer<T> as (s: ThrottleState<T>, a: ThrottleAction<T>) => ThrottleState<T>,
    initialThrottleState<T>(),
  );
  const lastFetchAtRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    if (!state.toast) return;
    const t = setTimeout(
      () => dispatch({ type: 'toast-clear' }),
      options.toastDurationMs ?? 1500,
    );
    return () => clearTimeout(t);
  }, [state.toast, options.toastDurationMs]);

  const refresh = useCallback(async () => {
    const now = Date.now();
    if (shouldThrottle(now, lastFetchAtRef.current, options.windowMs)) {
      dispatch({ type: 'idle-hit' });
      return;
    }
    lastFetchAtRef.current = now;
    dispatch({ type: 'request-start', now });
    try {
      const data = await fetcherRef.current();
      dispatch({ type: 'request-success', data });
    } catch {
      dispatch({ type: 'request-failure' });
    }
  }, [options.windowMs]);

  const stopAuto = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startAuto = useCallback(
    (intervalMs: number) => {
      stopAuto();
      intervalRef.current = setInterval(() => {
        void refresh();
      }, intervalMs);
    },
    [refresh, stopAuto],
  );

  useEffect(() => () => stopAuto(), [stopAuto]);

  return {
    data: state.data,
    loading: state.loading,
    toast: state.toast,
    refresh,
    startAuto,
    stopAuto,
  };
}
