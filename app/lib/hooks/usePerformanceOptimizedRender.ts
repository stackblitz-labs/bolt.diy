/**
 * Performance-optimized rendering hooks
 * Based on Claude.dev's findings about React re-renders
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { throttleToFrame } from '~/lib/performance/streaming-optimizer';

/**
 * Memoize component that only re-renders when specific deps change
 * Claude.dev found 6,900 hooks re-running on every keystroke
 */
export function useStableCallback<T extends (...args: any[]) => any>(callback: T, deps: any[]): T {
  const ref = useRef<T>(callback);

  useEffect(() => {
    ref.current = callback;
  }, deps);

  return useCallback((...args: any[]) => ref.current(...args), []) as T;
}

/**
 * Throttle state updates to frame rate
 * Useful for inputs, sliders, etc.
 */
export function useThrottledState<T>(initialValue: T): [T, (value: T) => void] {
  const [state, setState] = useState<T>(initialValue);
  const throttledSetState = useMemo(() => throttleToFrame(setState), []);

  return [state, throttledSetState];
}

/**
 * Only re-render when value actually changes (deep equality)
 */
export function useDeepMemo<T>(factory: () => T, deps: any[]): T {
  const ref = useRef<{ value: T; deps: any[] } | undefined>(undefined);

  if (!ref.current || !depsEqual(ref.current.deps, deps)) {
    ref.current = {
      value: factory(),
      deps,
    };
  }

  return ref.current.value;
}

function depsEqual(a: any[], b: any[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  return a.every((val, i) => Object.is(val, b[i]));
}

/**
 * Debounce a callback with cleanup
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(callback: T, delay: number): [T, () => void] {
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const debouncedCallback = useCallback(
    (...args: any[]) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay],
  ) as T;

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  useEffect(() => {
    return cancel;
  }, [cancel]);

  return [debouncedCallback, cancel];
}

/**
 * Track component render count (dev only)
 */
export function useRenderCount(componentName: string) {
  const renderCount = useRef(0);

  useEffect(() => {
    renderCount.current++;

    if (import.meta.env.DEV) {
      console.log(`[RENDER] ${componentName} rendered ${renderCount.current} times`);
    }
  });

  return renderCount.current;
}

/**
 * Measure render performance
 */
export function useRenderPerformance(componentName: string) {
  const renderStartRef = useRef(0);

  // Start timing
  renderStartRef.current = performance.now();

  useEffect(() => {
    const renderTime = performance.now() - renderStartRef.current;

    if (import.meta.env.DEV && renderTime > 16.67) {
      console.warn(`[PERF] Slow render: ${componentName} took ${renderTime.toFixed(2)}ms`);
    }
  });
}

/**
 * Prevent unnecessary re-renders by keeping component mounted
 * Claude.dev kept composer mounted between conversations
 */
export function useKeepMounted() {
  const [shouldRender, setShouldRender] = useState(true);

  const hideInsteadOfUnmount = useCallback((hide: boolean) => {
    // Don't unmount, just hide with CSS
    setShouldRender(!hide);
  }, []);

  return {
    shouldRender,
    hideInsteadOfUnmount,
    style: shouldRender ? {} : { display: 'none' },
  };
}

/**
 * Lazy load component with prefetch support
 */
export function useLazyWithPrefetch<T>(importer: () => Promise<{ default: T }>, shouldPrefetch: boolean = false) {
  const [component, setComponent] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    if (component) {
      return component;
    }

    setIsLoading(true);

    try {
      const module = await importer();
      setComponent(module.default);

      return module.default;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [importer, component]);

  useEffect(() => {
    if (shouldPrefetch) {
      // Use requestIdleCallback for low-priority prefetch
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => load());
      } else {
        setTimeout(() => load(), 1);
      }
    }
  }, [shouldPrefetch, load]);

  return { component, isLoading, error, load };
}

/**
 * Virtualized list hook for long lists
 * Only renders visible items
 */
export function useVirtualizedList<T>(items: T[], containerHeight: number, itemHeight: number, overscan: number = 3) {
  const [scrollTop, setScrollTop] = useState(0);

  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(items.length, Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan);

    return { startIndex, endIndex };
  }, [scrollTop, items.length, containerHeight, itemHeight, overscan]);

  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.startIndex, visibleRange.endIndex).map((item, index) => ({
      item,
      index: visibleRange.startIndex + index,
      style: {
        position: 'absolute' as const,
        top: (visibleRange.startIndex + index) * itemHeight,
        height: itemHeight,
      },
    }));
  }, [items, visibleRange, itemHeight]);

  const totalHeight = items.length * itemHeight;

  const onScroll = useCallback((event: React.UIEvent<HTMLElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  return {
    visibleItems,
    totalHeight,
    onScroll,
  };
}
