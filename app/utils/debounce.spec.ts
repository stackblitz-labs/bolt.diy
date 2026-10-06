import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debounce } from './debounce';

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should debounce function calls', () => {
    const func = vi.fn();
    const debouncedFunc = debounce(func, 100);

    debouncedFunc();
    debouncedFunc();
    debouncedFunc();

    expect(func).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);

    expect(func).toHaveBeenCalledTimes(1);
  });

  it('should call function with latest arguments', () => {
    const func = vi.fn();
    const debouncedFunc = debounce(func, 100);

    debouncedFunc('first');
    debouncedFunc('second');
    debouncedFunc('third');

    vi.advanceTimersByTime(100);

    expect(func).toHaveBeenCalledTimes(1);
    expect(func).toHaveBeenCalledWith('third');
  });

  it('should reset timer on each call', () => {
    const func = vi.fn();
    const debouncedFunc = debounce(func, 100);

    debouncedFunc();
    vi.advanceTimersByTime(50);

    debouncedFunc();
    vi.advanceTimersByTime(50);

    expect(func).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);

    expect(func).toHaveBeenCalledTimes(1);
  });

  it('should handle multiple argument types', () => {
    const func = vi.fn();
    const debouncedFunc = debounce(func, 100);

    debouncedFunc(1, 'test', { key: 'value' }, [1, 2, 3]);

    vi.advanceTimersByTime(100);

    expect(func).toHaveBeenCalledWith(1, 'test', { key: 'value' }, [1, 2, 3]);
  });

  it('should work with functions that return values', () => {
    const func = vi.fn(() => 'result');
    const debouncedFunc = debounce(func, 100);

    debouncedFunc();

    vi.advanceTimersByTime(100);

    expect(func).toHaveReturnedWith('result');
  });

  it('should handle rapid successive calls', () => {
    const func = vi.fn();
    const debouncedFunc = debounce(func, 100);

    for (let i = 0; i < 100; i++) {
      debouncedFunc(i);
      vi.advanceTimersByTime(10);
    }

    // Should not have been called yet since we keep resetting
    expect(func).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);

    expect(func).toHaveBeenCalledTimes(1);
    expect(func).toHaveBeenCalledWith(99);
  });

  it('should work with zero delay', () => {
    const func = vi.fn();
    const debouncedFunc = debounce(func, 0);

    debouncedFunc();

    vi.advanceTimersByTime(0);

    expect(func).toHaveBeenCalledTimes(1);
  });
});
