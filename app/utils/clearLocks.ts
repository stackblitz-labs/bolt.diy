/**
 * Utility to clear all file locks for the current chat
 * This is useful when files remain locked after an AI response error
 */

import { workbenchStore } from '~/lib/stores/workbench';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('ClearLocks');

/**
 * Clear all file locks for the current chat
 * Can be called from browser console: window.clearAllLocks()
 *
 * @throws Will log error to console if workbench store is not initialized
 */
export function clearAllLocks(): void {
  try {
    // Verify workbench store is initialized
    if (!workbenchStore || typeof workbenchStore.clearAllLocks !== 'function') {
      logger.error('Workbench store not initialized or clearAllLocks method not available');
      console.error('❌ Cannot clear locks: Workbench store not ready. Please wait for the app to fully load.');

      return;
    }

    workbenchStore.clearAllLocks();
    logger.info('Successfully cleared all file locks');
    console.log('✅ All file locks have been cleared. You can now edit files.');
  } catch (error) {
    logger.error('Failed to clear locks', error);
    console.error('❌ Failed to clear locks:', error);
  }
}

// Expose to window for easy console access
if (typeof window !== 'undefined') {
  (window as any).clearAllLocks = clearAllLocks;
  console.info('💡 Tip: If files are locked, run clearAllLocks() in the console');
}
