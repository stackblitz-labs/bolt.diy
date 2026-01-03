/**
 * Exponential Backoff Utility
 *
 * Provides exponential backoff with jitter for rate limiting and retry scenarios.
 * From specs/001-load-project-messages/research.md
 */

/**
 * Configuration for exponential backoff calculation.
 */
export interface BackoffConfig {
  baseDelay: number; // Initial delay in milliseconds (default: 1000)
  maxDelay: number; // Maximum delay cap in milliseconds (default: 30000)
  jitterFactor: number; // Random factor 0-1 for jitter (default: 0.1 = ±10%)
}

/**
 * Default backoff configuration.
 * Suitable for most API retry scenarios.
 */
export const defaultBackoffConfig: BackoffConfig = {
  baseDelay: 1000,
  maxDelay: 30000,
  jitterFactor: 0.1,
};

/**
 * Calculate exponential backoff delay with jitter.
 *
 * This implements the standard exponential backoff algorithm with jitter
 * to prevent thundering herd problems when multiple clients retry simultaneously.
 *
 * Formula: delay = min(baseDelay * 2^attempt, maxDelay) + jitter
 *
 * @param attempt - The retry attempt number (0-based)
 * @param config - Backoff configuration options
 * @returns Delay in milliseconds
 *
 * @example
 * ```ts
 * // First retry: ~1000ms
 * calculateBackoff(0, defaultBackoffConfig);
 *
 * // Second retry: ~2000ms
 * calculateBackoff(1, defaultBackoffConfig);
 *
 * // Third retry: ~4000ms
 * calculateBackoff(2, defaultBackoffConfig);
 * ```
 */
export function calculateBackoff(attempt: number, config: BackoffConfig = defaultBackoffConfig): number {
  // Calculate exponential delay: baseDelay * 2^attempt
  const exponentialDelay = config.baseDelay * Math.pow(2, attempt);

  // Cap the delay at maxDelay to prevent excessive waits
  const cappedDelay = Math.min(exponentialDelay, config.maxDelay);

  /*
   * Add jitter to prevent thundering herd
   * Jitter is ±jitterFactor of the capped delay
   */
  const jitterRange = cappedDelay * config.jitterFactor;
  const jitter = (Math.random() * 2 - 1) * jitterRange; // Random value in [-jitterRange, +jitterRange]

  return Math.floor(cappedDelay + jitter);
}

/**
 * Calculate delay and return a Promise that resolves after that time.
 * Useful for async/await retry loops.
 *
 * @param attempt - The retry attempt number (0-based)
 * @param config - Backoff configuration options
 * @returns Promise that resolves after the calculated delay
 *
 * @example
 * ```ts
 * for (let attempt = 0; attempt < maxRetries; attempt++) {
 *   try {
 *     return await fetchData();
 *   } catch (error) {
 *     if (attempt < maxRetries - 1) {
 *       await backoff(attempt); // Wait before retry
 *     }
 *   }
 * }
 * ```
 */
export async function backoff(attempt: number, config: BackoffConfig = defaultBackoffConfig): Promise<void> {
  const delay = calculateBackoff(attempt, config);
  await sleep(delay);
}

/**
 * Sleep for the specified duration.
 *
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after the specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if an HTTP error should trigger a retry based on status code.
 *
 * @param status - HTTP status code
 * @returns True if the status code indicates a retryable error
 */
export function isRetryableStatus(status: number): boolean {
  // Retry on rate limiting (429)
  if (status === 429) {
    return true;
  }

  // Retry on server errors (5xx)
  if (status >= 500 && status < 600) {
    return true;
  }

  // Retry on request timeout (408)
  if (status === 408) {
    return true;
  }

  // Do not retry on client errors (4xx except 429 and 408)
  return false;
}
