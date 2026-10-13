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
 */
export function clearAllLocks(): void {
  try {
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
