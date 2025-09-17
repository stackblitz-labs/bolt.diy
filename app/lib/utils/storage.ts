import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('StorageUtils');

/**
 * Safe localStorage operations with error handling and fallbacks
 */
export class SafeStorage {
  private static _isAvailable(): boolean {
    try {
      if (typeof window === 'undefined') {
        return false;
      }

      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Safely get an item from localStorage with fallback
   */
  static getItem(key: string, fallback: string | null = null): string | null {
    try {
      if (!this._isAvailable()) {
        return fallback;
      }

      return localStorage.getItem(key) ?? fallback;
    } catch (error) {
      logger.warn(`Failed to get localStorage item '${key}':`, error);
      return fallback;
    }
  }

  /**
   * Safely set an item in localStorage with error handling
   */
  static setItem(key: string, value: string): boolean {
    try {
      if (!this._isAvailable()) {
        return false;
      }

      localStorage.setItem(key, value);

      return true;
    } catch (error) {
      logger.warn(`Failed to set localStorage item '${key}':`, error);

      // Attempt to clear storage if quota exceeded
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        this._clearStaleData();

        // Retry once after clearing
        try {
          localStorage.setItem(key, value);
          return true;
        } catch {
          logger.error(`Failed to set localStorage item '${key}' even after clearing storage`);
        }
      }

      return false;
    }
  }

  /**
   * Safely parse JSON from localStorage with fallback
   */
  static getJSON<T>(key: string, fallback: T): T {
    try {
      const item = this.getItem(key);

      if (item === null) {
        return fallback;
      }

      return JSON.parse(item) as T;
    } catch (error) {
      logger.warn(`Failed to parse JSON from localStorage item '${key}':`, error);
      return fallback;
    }
  }

  /**
   * Safely set JSON in localStorage
   */
  static setJSON(key: string, value: any): boolean {
    try {
      return this.setItem(key, JSON.stringify(value));
    } catch (error) {
      logger.warn(`Failed to stringify and set localStorage item '${key}':`, error);
      return false;
    }
  }

  /**
   * Remove an item from localStorage safely
   */
  static removeItem(key: string): boolean {
    try {
      if (!this._isAvailable()) {
        return false;
      }

      localStorage.removeItem(key);

      return true;
    } catch (error) {
      logger.warn(`Failed to remove localStorage item '${key}':`, error);
      return false;
    }
  }

  /**
   * Clear stale data from localStorage to free up space
   */
  private static _clearStaleData(): void {
    try {
      if (!this._isAvailable()) {
        return;
      }

      const keysToCheck = Object.keys(localStorage);
      const staleKeys: string[] = [];

      // Remove old chat histories (keep only recent ones)
      const chatKeys = keysToCheck.filter((key) => key.startsWith('chat_'));

      if (chatKeys.length > 10) {
        // Sort by timestamp and remove oldest
        const sortedChatKeys = chatKeys.sort().slice(0, -10);
        staleKeys.push(...sortedChatKeys);
      }

      // Remove old log entries
      const logKeys = keysToCheck.filter((key) => key.startsWith('log_'));

      if (logKeys.length > 5) {
        const sortedLogKeys = logKeys.sort().slice(0, -5);
        staleKeys.push(...sortedLogKeys);
      }

      // Remove temporary/debug keys
      const tempKeys = keysToCheck.filter(
        (key) => key.startsWith('temp_') || key.startsWith('debug_') || key.startsWith('__storage_test__'),
      );
      staleKeys.push(...tempKeys);

      // Remove identified stale keys
      staleKeys.forEach((key) => {
        try {
          localStorage.removeItem(key);
        } catch (error) {
          logger.warn(`Failed to remove stale key '${key}':`, error);
        }
      });

      if (staleKeys.length > 0) {
        logger.info(`Cleared ${staleKeys.length} stale localStorage items to free up space`);
      }
    } catch (error) {
      logger.error('Failed to clear stale data from localStorage:', error);
    }
  }

  /**
   * Check localStorage health and perform cleanup if needed
   */
  static healthCheck(): { available: boolean; issues: string[] } {
    const issues: string[] = [];

    if (!this._isAvailable()) {
      issues.push('localStorage is not available');
      return { available: false, issues };
    }

    try {
      // Test write/read operations
      const testKey = '__health_check__';
      const testValue = Date.now().toString();

      if (!this.setItem(testKey, testValue)) {
        issues.push('Cannot write to localStorage');
      } else {
        const retrieved = this.getItem(testKey);

        if (retrieved !== testValue) {
          issues.push('localStorage read/write mismatch');
        }

        this.removeItem(testKey);
      }

      // Check for quota issues
      try {
        const usage = JSON.stringify(localStorage).length;
        const quotaWarningThreshold = 4 * 1024 * 1024; // 4MB warning threshold

        if (usage > quotaWarningThreshold) {
          issues.push(`localStorage usage high: ${Math.round(usage / 1024)}KB`);
        }
      } catch {
        issues.push('Cannot calculate localStorage usage');
      }
    } catch (error) {
      issues.push(`localStorage health check failed: ${error}`);
    }

    return { available: true, issues };
  }
}

/**
 * Initialize storage health monitoring
 */
export function initializeStorageMonitoring(): void {
  if (typeof window === 'undefined') {
    return;
  }

  // Perform initial health check
  const health = SafeStorage.healthCheck();

  if (health.issues.length > 0) {
    logger.warn('localStorage health issues detected:', health.issues);
  }

  // Monitor for storage events (other tabs clearing storage)
  window.addEventListener('storage', (event) => {
    if (event.key === null) {
      // All storage was cleared
      logger.info('localStorage was cleared by another tab/window');
    } else {
      logger.debug(`localStorage key '${event.key}' was modified by another tab/window`);
    }
  });

  // Periodic health check (every 5 minutes)
  setInterval(
    () => {
      const health = SafeStorage.healthCheck();

      if (health.issues.length > 0) {
        logger.warn('Periodic localStorage health check found issues:', health.issues);
      }
    },
    5 * 60 * 1000,
  );
}
