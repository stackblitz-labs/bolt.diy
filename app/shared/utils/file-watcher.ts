import type { WebContainer } from '@webcontainer/api';
import { WORK_DIR } from './constants';

// Global object to track watcher state
const watcherState = {
  fallbackEnabled: tryLoadFallbackState(),
  watchingPaths: new Set<string>(),
  callbacks: new Map<string, Set<() => void>>(),
  pollingInterval: null as NodeJS.Timeout | null,
};

// Try to load the fallback state from localStorage
function tryLoadFallbackState(): boolean {
  try {
    if (typeof localStorage !== 'undefined') {
      const state = localStorage.getItem('bolt-file-watcher-fallback');
      return state === 'true';
    }
  } catch {
    console.warn('[FileWatcher] Failed to load fallback state from localStorage');
  }
  return false;
}

// Save the fallback state to localStorage
function saveFallbackState(state: boolean) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('bolt-file-watcher-fallback', state ? 'true' : 'false');
    }
  } catch {
    console.warn('[FileWatcher] Failed to save fallback state to localStorage');
  }
}

/**
 * Safe file watcher that falls back to polling when native file watching fails
 *
 * @param webcontainer The WebContainer instance
 * @param pattern File pattern to watch
 * @param callback Function to call when files change
 * @returns An object with a close method
 */
export async function safeWatch(webcontainer: WebContainer, pattern: string = '**/*', callback: () => void) {
  // Register the callback
  if (!watcherState.callbacks.has(pattern)) {
    watcherState.callbacks.set(pattern, new Set());
  }

  watcherState.callbacks.get(pattern)!.add(callback);

  // If we're already using fallback mode, don't try native watchers again
  if (watcherState.fallbackEnabled) {
    // Make sure polling is active
    ensurePollingActive();

    // Return a cleanup function
    return {
      close: () => {
        const callbacks = watcherState.callbacks.get(pattern);

        if (callbacks) {
          callbacks.delete(callback);

          if (callbacks.size === 0) {
            watcherState.callbacks.delete(pattern);
          }
        }
      },
    };
  }

  // Try to use native file watching
  try {
    const watcher = await webcontainer.fs.watch(pattern, { persistent: true });
    watcherState.watchingPaths.add(pattern);

    // Use the native watch events
    (watcher as any).addEventListener('change', () => {
      // Call all callbacks for this pattern
      const callbacks = watcherState.callbacks.get(pattern);

      if (callbacks) {
        callbacks.forEach((cb) => cb());
      }
    });

    // Return an object with a close method
    return {
      close: () => {
        try {
          watcher.close();
          watcherState.watchingPaths.delete(pattern);

          const callbacks = watcherState.callbacks.get(pattern);

          if (callbacks) {
            callbacks.delete(callback);

            if (callbacks.size === 0) {
              watcherState.callbacks.delete(pattern);
            }
          }
        } catch (error) {
          console.warn('[FileWatcher] Error closing watcher:', error);
        }
      },
    };
  } catch (error) {
    console.warn('[FileWatcher] Native file watching failed:', error);
    console.info('[FileWatcher] Falling back to polling mechanism for file changes');

    // Switch to fallback mode for all future watches
    watcherState.fallbackEnabled = true;
    saveFallbackState(true);

    // Start polling
    ensurePollingActive();

    // Return a mock watcher object
    return {
      close: () => {
        const callbacks = watcherState.callbacks.get(pattern);

        if (callbacks) {
          callbacks.delete(callback);

          if (callbacks.size === 0) {
            watcherState.callbacks.delete(pattern);
          }
        }

        // If no more callbacks, stop polling
        if (watcherState.callbacks.size === 0 && watcherState.pollingInterval) {
          clearInterval(watcherState.pollingInterval);
          watcherState.pollingInterval = null;
        }
      },
    };
  }
}

// Ensure polling is active
function ensurePollingActive() {
  if (watcherState.pollingInterval) {
    return;
  }

  // Set up a polling interval that calls all callbacks
  watcherState.pollingInterval = setInterval(() => {
    // Call all registered callbacks
    for (const [, callbacks] of watcherState.callbacks.entries()) {
      callbacks.forEach((callback) => callback());
    }
  }, 3000); // Poll every 3 seconds

  // Clean up interval when window unloads
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      if (watcherState.pollingInterval) {
        clearInterval(watcherState.pollingInterval);
        watcherState.pollingInterval = null;
      }
    });
  }
}

// SafeWatchPaths mimics the webcontainer.internal.watchPaths method but with fallback
export function safeWatchPaths(
  webcontainer: WebContainer,
  config: { include: string[]; exclude?: string[]; includeContent?: boolean },
  callback: any,
) {
  // Create a valid mock event to prevent undefined errors
  const createMockEvent = () => ({
    type: 'change',
    path: `${WORK_DIR}/mock-path.txt`,
    buffer: new Uint8Array(0),
  });

  // Start with polling if we already know native watching doesn't work
  if (watcherState.fallbackEnabled) {
    console.info('[FileWatcher] Using fallback polling for watchPaths');
    ensurePollingActive();

    const interval = setInterval(() => {
      // Use our helper to create a valid event
      const mockEvent = createMockEvent();

      // Wrap in the expected structure of nested arrays
      callback([[mockEvent]]);
    }, 3000);

    return {
      close: () => {
        clearInterval(interval);
      },
    };
  }

  // Try native watching
  try {
    return webcontainer.internal.watchPaths(config, callback);
  } catch (error) {
    console.warn('[FileWatcher] Native watchPaths failed:', error);
    console.info('[FileWatcher] Using fallback polling for watchPaths');

    // Mark as using fallback
    watcherState.fallbackEnabled = true;
    saveFallbackState(true);

    // Set up polling
    ensurePollingActive();

    const interval = setInterval(() => {
      // Use our helper to create a valid event
      const mockEvent = createMockEvent();

      // Wrap in the expected structure of nested arrays
      callback([[mockEvent]]);
    }, 3000);

    return {
      close: () => {
        clearInterval(interval);
      },
    };
  }
}
