import {
  getLockedItems,
  isFileLocked as isFileLockedInternal,
  isFolderLocked as isFolderLockedInternal,
  isPathInLockedFolder,
} from '~/lib/persistence/lockedFiles';
import { createScopedLogger } from './logger';

const logger = createScopedLogger('FileLocks');

/**
 * Get the current chat ID from the URL
 * @returns The current chat ID or a default value if not found
 */
export function getCurrentChatId(): string {
  try {
    if (typeof window !== 'undefined') {
      // Extract chat ID from URL (format: /chat/123)
      const match = window.location.pathname.match(/\/chat\/([^/]+)/);

      if (match && match[1]) {
        return match[1];
      }
    }

    // Return a default chat ID if none is found
    return 'default';
  } catch (error) {
    logger.error('Failed to get current chat ID', error);
    return 'default';
  }
}

/**
 * Check if a file is locked directly from localStorage
 * This avoids circular dependencies between components and stores
 * @param filePath The path of the file to check
 * @param chatId Optional chat ID (will be extracted from URL if not provided)
 */
export function isFileLocked(filePath: string, chatId?: string): { locked: boolean; lockedBy?: string } {
  try {
    const currentChatId = chatId || getCurrentChatId();

    // Use the internal function from lockedFiles.ts
    const result = isFileLockedInternal(currentChatId, filePath);

    // If the file itself is not locked, check if it's in a locked folder
    if (!result.locked) {
      const folderLockResult = isPathInLockedFolder(currentChatId, filePath);

      if (folderLockResult.locked) {
        return folderLockResult;
      }
    }

    return result;
  } catch (error) {
    logger.error('Failed to check if file is locked', error);
    return { locked: false };
  }
}

/**
 * Check if a folder is locked directly from localStorage
 * This avoids circular dependencies between components and stores
 * @param folderPath The path of the folder to check
 * @param chatId Optional chat ID (will be extracted from URL if not provided)
 */
export function isFolderLocked(folderPath: string, chatId?: string): { locked: boolean; lockedBy?: string } {
  try {
    const currentChatId = chatId || getCurrentChatId();

    // Use the internal function from lockedFiles.ts
    return isFolderLockedInternal(currentChatId, folderPath);
  } catch (error) {
    logger.error('Failed to check if folder is locked', error);
    return { locked: false };
  }
}

/**
 * Check if any files are locked in the current chat
 * @param chatId Optional chat ID (will be extracted from URL if not provided)
 * @returns True if any files or folders are locked
 */
export function hasLockedItems(chatId?: string): boolean {
  try {
    const currentChatId = chatId || getCurrentChatId();
    const lockedItems = getLockedItems();

    return lockedItems.some((item) => item.chatId === currentChatId);
  } catch (error) {
    logger.error('Failed to check for locked items', error);
    return false;
  }
}
