/**
 * Stream Recovery Module
 * Handles stream failures and provides automatic recovery mechanisms
 * Fixes chat conversation hanging issues
 * Author: Keoma Wright
 */

import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('stream-recovery');

export interface StreamRecoveryOptions {
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
  onRetry?: (attempt: number) => void;
  onTimeout?: () => void;
  onError?: (error: any) => void;
}

export class StreamRecoveryManager {
  private _retryCount = 0;
  private _timeoutHandle: NodeJS.Timeout | null = null;
  private _lastActivity: number = Date.now();
  private _isActive = true;

  constructor(private _options: StreamRecoveryOptions = {}) {
    this._options = {
      maxRetries: 3,
      retryDelay: 1000,
      timeout: 30000, // 30 seconds default timeout
      ..._options,
    };
  }

  /**
   * Start monitoring the stream for inactivity
   */
  startMonitoring() {
    this._resetTimeout();
  }

  /**
   * Reset the timeout when activity is detected
   */
  recordActivity() {
    this._lastActivity = Date.now();
    this._resetTimeout();
  }

  /**
   * Reset the timeout timer
   */
  private _resetTimeout() {
    if (this._timeoutHandle) {
      clearTimeout(this._timeoutHandle);
    }

    if (!this._isActive) {
      return;
    }

    this._timeoutHandle = setTimeout(() => {
      const inactiveTime = Date.now() - this._lastActivity;
      logger.warn(`Stream timeout detected after ${inactiveTime}ms of inactivity`);

      if (this._options.onTimeout) {
        this._options.onTimeout();
      }

      this._handleTimeout();
    }, this._options.timeout!);
  }

  /**
   * Handle stream timeout
   */
  private _handleTimeout() {
    logger.error('Stream timeout - attempting recovery');

    // Signal that recovery is needed
    this.attemptRecovery();
  }

  /**
   * Attempt to recover from a stream failure
   */
  async attemptRecovery(): Promise<boolean> {
    if (this._retryCount >= this._options.maxRetries!) {
      logger.error(`Max retries (${this._options.maxRetries}) reached - cannot recover`);
      return false;
    }

    this._retryCount++;
    logger.info(`Attempting recovery (attempt ${this._retryCount}/${this._options.maxRetries})`);

    if (this._options.onRetry) {
      this._options.onRetry(this._retryCount);
    }

    // Wait before retrying
    await new Promise((resolve) => setTimeout(resolve, this._options.retryDelay! * this._retryCount));

    // Reset activity tracking
    this.recordActivity();

    return true;
  }

  /**
   * Handle stream errors with recovery
   */
  async handleError(error: any): Promise<boolean> {
    logger.error('Stream error detected:', error);

    if (this._options.onError) {
      this._options.onError(error);
    }

    // Check if error is recoverable
    if (this._isRecoverableError(error)) {
      return await this.attemptRecovery();
    }

    logger.error('Non-recoverable error - cannot continue');

    return false;
  }

  /**
   * Check if an error is recoverable
   */
  private _isRecoverableError(error: any): boolean {
    const errorMessage = error?.message || error?.toString() || '';

    // List of recoverable error patterns
    const recoverablePatterns = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'socket hang up',
      'network',
      'timeout',
      'abort',
      'EPIPE',
      '502',
      '503',
      '504',
      'rate limit',
    ];

    return recoverablePatterns.some((pattern) => errorMessage.toLowerCase().includes(pattern.toLowerCase()));
  }

  /**
   * Stop monitoring and cleanup
   */
  stop() {
    this._isActive = false;

    if (this._timeoutHandle) {
      clearTimeout(this._timeoutHandle);
      this._timeoutHandle = null;
    }
  }

  /**
   * Reset the recovery manager
   */
  reset() {
    this._retryCount = 0;
    this._lastActivity = Date.now();
    this._isActive = true;
    this._resetTimeout();
  }
}

/**
 * Create a wrapped stream with recovery capabilities
 */
export function createRecoverableStream<T>(
  streamFactory: () => Promise<ReadableStream<T>>,
  options?: StreamRecoveryOptions,
): ReadableStream<T> {
  const recovery = new StreamRecoveryManager(options);
  let currentStream: ReadableStream<T> | null = null;
  let reader: ReadableStreamDefaultReader<T> | null = null;

  return new ReadableStream<T>({
    async start(controller) {
      recovery.startMonitoring();

      try {
        currentStream = await streamFactory();
        reader = currentStream.getReader();
      } catch (error) {
        logger.error('Failed to create initial stream:', error);

        const canRecover = await recovery.handleError(error);

        if (canRecover) {
          // Retry creating the stream
          currentStream = await streamFactory();
          reader = currentStream.getReader();
        } else {
          controller.error(error);
          return;
        }
      }
    },

    async pull(controller) {
      if (!reader) {
        controller.error(new Error('No reader available'));
        return;
      }

      try {
        const { done, value } = await reader.read();

        if (done) {
          controller.close();
          recovery.stop();

          return;
        }

        // Record activity to reset timeout
        recovery.recordActivity();
        controller.enqueue(value);
      } catch (error) {
        logger.error('Error reading from stream:', error);

        const canRecover = await recovery.handleError(error);

        if (canRecover) {
          // Try to recreate the stream
          try {
            if (reader) {
              reader.releaseLock();
            }

            currentStream = await streamFactory();
            reader = currentStream.getReader();

            // Continue reading
            await this.pull!(controller);
          } catch (retryError) {
            logger.error('Recovery failed:', retryError);
            controller.error(retryError);
            recovery.stop();
          }
        } else {
          controller.error(error);
          recovery.stop();
        }
      }
    },

    cancel() {
      recovery.stop();

      if (reader) {
        reader.releaseLock();
      }
    },
  });
}
