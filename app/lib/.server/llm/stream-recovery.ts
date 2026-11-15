import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('stream-recovery');

export interface StreamRecoveryOptions {
  maxRetries?: number;
  timeout?: number;
  onTimeout?: () => void;
  onRecovery?: () => void;
}

export class StreamRecoveryManager {
  private _retryCount = 0;
  private _timeoutHandle: NodeJS.Timeout | null = null;
  private _lastActivity: number = Date.now();
  private _isActive = true;

  constructor(private _options: StreamRecoveryOptions = {}) {
    this._options = {
      maxRetries: 3,
      timeout: 30000, // 30 seconds default
      ..._options,
    };
  }

  startMonitoring() {
    this._resetTimeout();
  }

  updateActivity() {
    this._lastActivity = Date.now();
    this._resetTimeout();
  }

  private _resetTimeout() {
    if (this._timeoutHandle) {
      clearTimeout(this._timeoutHandle);
    }

    if (!this._isActive) {
      return;
    }

    this._timeoutHandle = setTimeout(() => {
      if (this._isActive) {
        logger.warn('Stream timeout detected');
        this._handleTimeout();
      }
    }, this._options.timeout);
  }

  private _handleTimeout() {
    if (this._retryCount >= (this._options.maxRetries || 3)) {
      logger.error('Max retries reached for stream recovery');
      this.stop();

      return;
    }

    this._retryCount++;
    logger.info(`Attempting stream recovery (attempt ${this._retryCount})`);

    if (this._options.onTimeout) {
      this._options.onTimeout();
    }

    // Reset monitoring after recovery attempt
    this._resetTimeout();

    if (this._options.onRecovery) {
      this._options.onRecovery();
    }
  }

  stop() {
    this._isActive = false;

    if (this._timeoutHandle) {
      clearTimeout(this._timeoutHandle);
      this._timeoutHandle = null;
    }
  }

  getStatus() {
    return {
      isActive: this._isActive,
      retryCount: this._retryCount,
      lastActivity: this._lastActivity,
      timeSinceLastActivity: Date.now() - this._lastActivity,
    };
  }
}
