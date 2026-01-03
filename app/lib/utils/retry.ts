/**
 * Retry utility with exponential backoff
 *
 * Provides configurable retry logic for API calls with exponential backoff,
 * jitter, and maximum retry limits.
 *
 * Phase 8, Task T051 - Retry logic for API calls
 */

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  jitter?: boolean;
  retryCondition?: (error: Error) => boolean;
  onRetry?: (error: Error, attempt: number) => void;
}

/**
 * Default retry options for API calls
 */
const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffFactor: 2,
  jitter: true,
  retryCondition: (error: Error) => {
    // Retry on network errors and 5xx server errors
    const errorMessage = error.message.toLowerCase();

    // Network-related errors
    if (
      errorMessage.includes('network') ||
      errorMessage.includes('fetch') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('failed to fetch')
    ) {
      return true;
    }

    // HTTP status errors that might be temporary
    if (
      errorMessage.includes('500') ||
      errorMessage.includes('502') ||
      errorMessage.includes('503') ||
      errorMessage.includes('504') ||
      errorMessage.includes('internal server error') ||
      errorMessage.includes('bad gateway') ||
      errorMessage.includes('service unavailable') ||
      errorMessage.includes('gateway timeout')
    ) {
      return true;
    }

    // Do not retry on client errors (4xx) except 429 (Too Many Requests)
    if (
      errorMessage.includes('400') ||
      errorMessage.includes('401') ||
      errorMessage.includes('403') ||
      errorMessage.includes('404') ||
      errorMessage.includes('422')
    ) {
      return false;
    }

    // Retry on rate limiting (429)
    if (errorMessage.includes('429') || errorMessage.includes('too many requests')) {
      return true;
    }

    // Default: retry on unknown errors
    return true;
  },
  onRetry: (error: Error, attempt: number) => {
    console.warn(`[Retry] Attempt ${attempt} failed:`, error.message);
  },
};

/**
 * Calculate delay with exponential backoff and optional jitter
 */
function calculateDelay(attempt: number, options: Required<RetryOptions>): number {
  let delay = options.baseDelay * Math.pow(options.backoffFactor, attempt - 1);
  delay = Math.min(delay, options.maxDelay);

  // Add jitter to prevent thundering herd
  if (options.jitter) {
    // Add ±25% random jitter
    const jitterFactor = 0.75 + Math.random() * 0.5; // 0.75 to 1.25
    delay = delay * jitterFactor;
  }

  return Math.floor(delay);
}

/**
 * Sleep for the specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 *
 * @param fn - The function to retry (should return a Promise)
 * @param options - Retry configuration options
 * @returns Promise that resolves with the function result or rejects with the last error
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const mergedOptions = { ...DEFAULT_RETRY_OPTIONS, ...options };

  let lastError: Error;

  for (let attempt = 1; attempt <= mergedOptions.maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on the last attempt
      if (attempt > mergedOptions.maxRetries) {
        break;
      }

      // Check if this error should be retried
      if (!mergedOptions.retryCondition(lastError)) {
        break;
      }

      // Calculate delay and wait
      const delay = calculateDelay(attempt, mergedOptions);

      // Call onRetry callback if provided
      mergedOptions.onRetry(lastError, attempt);

      await sleep(delay);
    }
  }

  // Throw the last error
  throw lastError!;
}

/**
 * Create a retry wrapper for fetch-like functions
 */
export function createRetryFetch(options: RetryOptions = {}) {
  return async function retryFetch(url: string, fetchOptions?: RequestInit): Promise<Response> {
    return withRetry(async () => {
      const response = await fetch(url, {
        credentials: 'same-origin',
        ...fetchOptions,
      });

      // Throw on HTTP errors to trigger retry logic
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }

      return response;
    }, options);
  };
}

/**
 * Retry wrapper specifically for project API calls
 */
export const retryProjectFetch = createRetryFetch({
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 8000,
  retryCondition: (error: Error) => {
    const message = error.message.toLowerCase();

    // Retry on network and server errors
    if (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('connection') ||
      message.includes('timeout') ||
      message.includes('500') ||
      message.includes('502') ||
      message.includes('503') ||
      message.includes('504')
    ) {
      return true;
    }

    // Don't retry on authentication or validation errors
    if (
      message.includes('401') ||
      message.includes('403') ||
      message.includes('404') ||
      message.includes('422') ||
      message.includes('unauthorized') ||
      message.includes('forbidden') ||
      message.includes('not found')
    ) {
      return false;
    }

    // Default: retry
    return true;
  },
  onRetry: (error, attempt) => {
    console.warn(`[ProjectAPI] Retry attempt ${attempt}:`, error.message);

    // Show toast notification on retries (optional)
    if (typeof window !== 'undefined' && attempt > 1) {
      // You could integrate with a toast system here
      console.info(`Retrying project operation... (attempt ${attempt})`);
    }
  },
});
