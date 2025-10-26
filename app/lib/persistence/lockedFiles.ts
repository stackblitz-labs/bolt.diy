import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('LockedFiles');

// Key for storing locked files in localStorage
export const LOCKED_FILES_KEY = 'bolt.lockedFiles';

export interface LockedItem {
  chatId: string; // Chat ID to scope locks to a specific project
  path: string;
  isFolder: boolean; // Indicates if this is a folder lock
}

// In-memory cache for locked items to reduce localStorage reads
let lockedItemsCache: LockedItem[] | null = null;

// Map for faster lookups by chatId and path
const lockedItemsMap = new Map<string, Map<string, LockedItem>>();

// Debounce timer for localStorage writes
let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const SAVE_DEBOUNCE_MS = 300;

/**
 * Get a chat-specific map from the lookup maps
 */
function getChatMap(chatId: string, createIfMissing = false): Map<string, LockedItem> | undefined {
  if (createIfMissing && !lockedItemsMap.has(chatId)) {
    lockedItemsMap.set(chatId, new Map());
  }

  return lockedItemsMap.get(chatId);
}

/**
 * Initialize the in-memory cache and lookup maps
 */
function initializeCache(): LockedItem[] {
  if (lockedItemsCache !== null) {
    return lockedItemsCache;
  }

  try {
    if (typeof localStorage !== 'undefined') {
      const lockedItemsJson = localStorage.getItem(LOCKED_FILES_KEY);

      if (lockedItemsJson) {
        const items = JSON.parse(lockedItemsJson);

        // Handle legacy format (without isFolder property)
        const normalizedItems = items.map((item: any) => ({
          ...item,
          isFolder: item.isFolder !== undefined ? item.isFolder : false,
        }));

        // Update the cache
        lockedItemsCache = normalizedItems;

        // Build the lookup maps
        rebuildLookupMaps(normalizedItems);

        return normalizedItems;
      }
    }

    // Initialize with empty array if no data in localStorage
    lockedItemsCache = [];

    return [];
  } catch (error) {
    logger.error('Failed to initialize locked items cache', error);
    lockedItemsCache = [];

    return [];
  }
}

/**
 * Rebuild the lookup maps from the items array
 */
function rebuildLookupMaps(items: LockedItem[]): void {
  // Clear existing maps
  lockedItemsMap.clear();

  // Build new maps
  for (const item of items) {
    if (!lockedItemsMap.has(item.chatId)) {
      lockedItemsMap.set(item.chatId, new Map());
    }

    const chatMap = lockedItemsMap.get(item.chatId)!;
    chatMap.set(item.path, item);
  }
}

/**
 * Save locked items to localStorage with debouncing
 */
export function saveLockedItems(items: LockedItem[]): void {
  // Update the in-memory cache immediately
  lockedItemsCache = [...items];

  // Rebuild the lookup maps
  rebuildLookupMaps(items);

  // Debounce the localStorage write
  if (saveDebounceTimer) {
    clearTimeout(saveDebounceTimer);
  }

  saveDebounceTimer = setTimeout(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(LOCKED_FILES_KEY, JSON.stringify(items));
        logger.info(`Saved ${items.length} locked items to localStorage`);
      }
    } catch (error) {
      logger.error('Failed to save locked items to localStorage', error);
    }
  }, SAVE_DEBOUNCE_MS);
}

/**
 * Get locked items from cache or localStorage
 */
export function getLockedItems(): LockedItem[] {
  // Use cache if available
  if (lockedItemsCache !== null) {
    return lockedItemsCache;
  }

  // Initialize cache if not yet done
  return initializeCache();
}

/**
 * Add a file or folder to the locked items list
 * @param chatId The chat ID to scope the lock to
 * @param path The path of the file or folder to lock
 * @param isFolder Whether this is a folder lock
 */
export function addLockedItem(chatId: string, path: string, isFolder: boolean = false): void {
  // Ensure cache is initialized
  const lockedItems = getLockedItems();

  // Create the new item
  const newItem = { chatId, path, isFolder };

  // Update the in-memory map directly for faster access
  const chatMap = getChatMap(chatId, true)!;
  chatMap.set(path, newItem);

  // Remove any existing entry for this path in this chat and add the new one
  const filteredItems = lockedItems.filter((item) => !(item.chatId === chatId && item.path === path));
  filteredItems.push(newItem);

  // Save the updated list (this will update the cache and maps)
  saveLockedItems(filteredItems);

  logger.info(`Added locked ${isFolder ? 'folder' : 'file'}: ${path} for chat: ${chatId}`);
}

/**
 * Add a file to the locked items list (for backward compatibility)
 */
export function addLockedFile(chatId: string, filePath: string): void {
  addLockedItem(chatId, filePath);
}

/**
 * Add a folder to the locked items list
 */
export function addLockedFolder(chatId: string, folderPath: string): void {
  addLockedItem(chatId, folderPath);
}

/**
 * Remove an item from the locked items list
 * @param chatId The chat ID the lock belongs to
 * @param path The path of the item to unlock
 */
export function removeLockedItem(chatId: string, path: string): void {
  // Ensure cache is initialized
  const lockedItems = getLockedItems();

  // Update the in-memory map directly for faster access
  const chatMap = getChatMap(chatId);

  if (chatMap) {
    chatMap.delete(path);
  }

  // Filter out the item to remove for this specific chat
  const filteredItems = lockedItems.filter((item) => !(item.chatId === chatId && item.path === path));

  // Save the updated list (this will update the cache and maps)
  saveLockedItems(filteredItems);

  logger.info(`Removed lock for: ${path} in chat: ${chatId}`);
}

/**
 * Remove a file from the locked items list (for backward compatibility)
 */
export function removeLockedFile(chatId: string, filePath: string): void {
  removeLockedItem(chatId, filePath);
}

/**
 * Remove a folder from the locked items list
 */
export function removeLockedFolder(chatId: string, folderPath: string): void {
  removeLockedItem(chatId, folderPath);
}

/**
 * Check if a path is directly locked (not considering parent folders)
 * @param chatId The chat ID to check locks for
 * @param path The path to check
 * @returns Object with locked status, lock mode, and whether it's a folder lock
 */
export function isPathDirectlyLocked(chatId: string, path: string): { locked: boolean; isFolder?: boolean } {
  // Ensure cache is initialized
  getLockedItems();

  // Check the in-memory map for faster lookup
  const chatMap = getChatMap(chatId);

  if (chatMap) {
    const lockedItem = chatMap.get(path);

    if (lockedItem) {
      return { locked: true, isFolder: lockedItem.isFolder };
    }
  }

  return { locked: false };
}

/**
 * Check if a file is locked, either directly or by a parent folder
 * @param chatId The chat ID to check locks for
 * @param filePath The path of the file to check
 * @returns Object with locked status, lock mode, and the path that caused the lock
 */
export function isFileLocked(chatId: string, filePath: string): { locked: boolean; lockedBy?: string } {
  // Ensure cache is initialized
  getLockedItems();

  // Check the in-memory map for direct file lock
  const chatMap = getChatMap(chatId);

  if (chatMap) {
    // First check if the file itself is locked
    const directLock = chatMap.get(filePath);

    if (directLock && !directLock.isFolder) {
      return { locked: true, lockedBy: filePath };
    }
  }

  // Then check if any parent folder is locked
  return checkParentFolderLocks(chatId, filePath);
}

/**
 * Check if a folder is locked
 * @param chatId The chat ID to check locks for
 * @param folderPath The path of the folder to check
 * @returns Object with locked status and lock mode
 */
export function isFolderLocked(chatId: string, folderPath: string): { locked: boolean; lockedBy?: string } {
  // Ensure cache is initialized
  getLockedItems();

  // Check the in-memory map for direct folder lock
  const chatMap = getChatMap(chatId);

  if (chatMap) {
    // First check if the folder itself is locked
    const directLock = chatMap.get(folderPath);

    if (directLock && directLock.isFolder) {
      return { locked: true, lockedBy: folderPath };
    }
  }

  // Then check if any parent folder is locked
  return checkParentFolderLocks(chatId, folderPath);
}

/**
 * Helper function to check if any parent folder of a path is locked
 * @param chatId The chat ID to check locks for
 * @param path The path to check
 * @returns Object with locked status, lock mode, and the folder that caused the lock
 */
function checkParentFolderLocks(chatId: string, path: string): { locked: boolean; lockedBy?: string } {
  const chatMap = getChatMap(chatId);

  if (!chatMap) {
    return { locked: false };
  }

  // Check each parent folder
  const pathParts = path.split('/');
  let currentPath = '';

  for (let i = 0; i < pathParts.length - 1; i++) {
    currentPath = currentPath ? `${currentPath}/${pathParts[i]}` : pathParts[i];

    const folderLock = chatMap.get(currentPath);

    if (folderLock && folderLock.isFolder) {
      return { locked: true, lockedBy: currentPath };
    }
  }

  return { locked: false };
}

/**
 * Get all locked items for a specific chat
 * @param chatId The chat ID to get locks for
 * @returns Array of locked items for the specified chat
 */
export function getLockedItemsForChat(chatId: string): LockedItem[] {
  // Ensure cache is initialized
  const allItems = getLockedItems();

  // Use the chat map if available for faster filtering
  const chatMap = getChatMap(chatId);

  if (chatMap) {
    // Convert the map values to an array
    return Array.from(chatMap.values());
  }

  // Fallback to filtering the full list
  return allItems.filter((item) => item.chatId === chatId);
}

/**
 * Get all locked files for a specific chat (for backward compatibility)
 */
export function getLockedFilesForChat(chatId: string): LockedItem[] {
  // Get all items for this chat
  const chatItems = getLockedItemsForChat(chatId);

  // Filter to only include files
  return chatItems.filter((item) => !item.isFolder);
}

/**
 * Get all locked folders for a specific chat
 */
export function getLockedFoldersForChat(chatId: string): LockedItem[] {
  // Get all items for this chat
  const chatItems = getLockedItemsForChat(chatId);

  // Filter to only include folders
  return chatItems.filter((item) => item.isFolder);
}

/**
 * Check if a path is within a locked folder
 * @param chatId The chat ID to check locks for
 * @param path The path to check
 * @returns Object with locked status, lock mode, and the folder that caused the lock
 */
export function isPathInLockedFolder(chatId: string, path: string): { locked: boolean; lockedBy?: string } {
  // This is already optimized by using checkParentFolderLocks
  return checkParentFolderLocks(chatId, path);
}

/**
 * Migrate legacy locks (without chatId or isFolder) to the new format
 * @param currentChatId The current chat ID to assign to legacy locks
 */
export function migrateLegacyLocks(currentChatId: string): void {
  try {
    // Force a fresh read from localStorage
    clearCache();

    // Get the items directly from localStorage
    if (typeof localStorage !== 'undefined') {
      const lockedItemsJson = localStorage.getItem(LOCKED_FILES_KEY);

      if (lockedItemsJson) {
        const lockedItems = JSON.parse(lockedItemsJson);

        if (Array.isArray(lockedItems)) {
          let hasLegacyItems = false;

          // Check if any locks are in the old format (missing chatId or isFolder)
          const updatedItems = lockedItems.map((item) => {
            const needsUpdate = !item.chatId || item.isFolder === undefined;

            if (needsUpdate) {
              hasLegacyItems = true;
              return {
                ...item,
                chatId: item.chatId || currentChatId,
                isFolder: item.isFolder !== undefined ? item.isFolder : false,
              };
            }

            return item;
          });

          // Only save if we found and updated legacy items
          if (hasLegacyItems) {
            saveLockedItems(updatedItems);
            logger.info(`Migrated ${updatedItems.length} legacy locks to chat ID: ${currentChatId}`);
          }
        }
      }
    }
  } catch (error) {
    logger.error('Failed to migrate legacy locks', error);
  }
}

/**
 * Clear the in-memory cache and force a reload from localStorage on next access
 * This is useful when you suspect the cache might be out of sync with localStorage
 * (e.g., after another tab has modified the locks)
 */
export function clearCache(): void {
  lockedItemsCache = null;
  lockedItemsMap.clear();
  logger.info('Cleared locked items cache');
}

/**
 * Batch operation to lock multiple items at once
 * @param chatId The chat ID to scope the locks to
 * @param items Array of items to lock with their paths, modes, and folder flags
 */
export function batchLockItems(chatId: string, items: Array<{ path: string; isFolder: boolean }>): void {
  if (items.length === 0) {
    return;
  }

  // Ensure cache is initialized
  const lockedItems = getLockedItems();

  // Create a set of paths to lock for faster lookups
  const pathsToLock = new Set(items.map((item) => item.path));

  // Filter out existing items for these paths
  const filteredItems = lockedItems.filter((item) => !(item.chatId === chatId && pathsToLock.has(item.path)));

  // Add all the new items
  const newItems = items.map((item) => ({
    chatId,
    path: item.path,
    isFolder: item.isFolder,
  }));

  // Combine and save
  const updatedItems = [...filteredItems, ...newItems];
  saveLockedItems(updatedItems);

  logger.info(`Batch locked ${items.length} items for chat: ${chatId}`);
}

/**
 * Batch operation to unlock multiple items at once
 * @param chatId The chat ID the locks belong to
 * @param paths Array of paths to unlock
 */
export function batchUnlockItems(chatId: string, paths: string[]): void {
  if (paths.length === 0) {
    return;
  }

  // Ensure cache is initialized
  const lockedItems = getLockedItems();

  // Create a set of paths to unlock for faster lookups
  const pathsToUnlock = new Set(paths);

  // Update the in-memory maps
  const chatMap = getChatMap(chatId);

  if (chatMap) {
    paths.forEach((path) => chatMap.delete(path));
  }

  // Filter out the items to remove
  const filteredItems = lockedItems.filter((item) => !(item.chatId === chatId && pathsToUnlock.has(item.path)));

  // Save the updated list
  saveLockedItems(filteredItems);

  logger.info(`Batch unlocked ${paths.length} items for chat: ${chatId}`);
}

/**
 * Add event listener for storage events to sync cache across tabs
 * This ensures that if locks are modified in another tab, the changes are reflected here
 */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === LOCKED_FILES_KEY) {
      logger.info('Detected localStorage change for locked items, refreshing cache');
      clearCache();
    }
  });
}
