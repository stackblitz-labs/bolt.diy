import { createScopedLogger } from '~/utils/logger';
import type { ChatHistoryItem } from './useChatHistory';
import { authStore } from '~/lib/stores/auth';

export interface IUserChatMetadata {
  userId: string;
  gitUrl?: string;
  gitBranch?: string;
  netlifySiteId?: string;
}

const logger = createScopedLogger('UserChatHistory');

/**
 * Open user-specific database
 */
export async function openUserDatabase(): Promise<IDBDatabase | undefined> {
  if (typeof indexedDB === 'undefined') {
    console.error('indexedDB is not available in this environment.');
    return undefined;
  }

  const authState = authStore.get();

  if (!authState.user?.id) {
    console.error('No authenticated user found.');
    return undefined;
  }

  // Use user-specific database name
  const dbName = `boltHistory_${authState.user.id}`;

  return new Promise((resolve) => {
    const request = indexedDB.open(dbName, 1);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('chats')) {
        const store = db.createObjectStore('chats', { keyPath: 'id' });
        store.createIndex('id', 'id', { unique: true });
        store.createIndex('urlId', 'urlId', { unique: true });
        store.createIndex('userId', 'userId', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }

      if (!db.objectStoreNames.contains('snapshots')) {
        db.createObjectStore('snapshots', { keyPath: 'chatId' });
      }

      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }

      if (!db.objectStoreNames.contains('workspaces')) {
        const workspaceStore = db.createObjectStore('workspaces', { keyPath: 'id' });
        workspaceStore.createIndex('name', 'name', { unique: false });
        workspaceStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = (event: Event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event: Event) => {
      resolve(undefined);
      logger.error((event.target as IDBOpenDBRequest).error);
    };
  });
}

/**
 * Get all chats for current user
 */
export async function getUserChats(db: IDBDatabase): Promise<ChatHistoryItem[]> {
  const authState = authStore.get();

  if (!authState.user?.id) {
    return [];
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readonly');
    const store = transaction.objectStore('chats');
    const request = store.getAll();

    request.onsuccess = () => {
      // Filter by userId and sort by timestamp
      const chats = (request.result as ChatHistoryItem[]).sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );

      resolve(chats);
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Save user-specific settings
 */
export async function saveUserSetting(db: IDBDatabase, key: string, value: any): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('settings', 'readwrite');
    const store = transaction.objectStore('settings');

    const request = store.put({ key, value, updatedAt: new Date().toISOString() });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Load user-specific settings
 */
export async function loadUserSetting(db: IDBDatabase, key: string): Promise<any | null> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('settings', 'readonly');
    const store = transaction.objectStore('settings');
    const request = store.get(key);

    request.onsuccess = () => {
      const result = request.result;
      resolve(result ? result.value : null);
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Create a workspace for the user
 */
export interface Workspace {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  lastAccessed?: string;
  files?: Record<string, any>;
}

export async function createWorkspace(db: IDBDatabase, workspace: Omit<Workspace, 'id'>): Promise<string> {
  const authState = authStore.get();

  if (!authState.user?.id) {
    throw new Error('No authenticated user');
  }

  const workspaceId = `workspace_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction('workspaces', 'readwrite');
    const store = transaction.objectStore('workspaces');

    const fullWorkspace: Workspace = {
      id: workspaceId,
      ...workspace,
    };

    const request = store.add(fullWorkspace);

    request.onsuccess = () => resolve(workspaceId);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get user workspaces
 */
export async function getUserWorkspaces(db: IDBDatabase): Promise<Workspace[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('workspaces', 'readonly');
    const store = transaction.objectStore('workspaces');
    const request = store.getAll();

    request.onsuccess = () => {
      const workspaces = (request.result as Workspace[]).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      resolve(workspaces);
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete a workspace
 */
export async function deleteWorkspace(db: IDBDatabase, workspaceId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('workspaces', 'readwrite');
    const store = transaction.objectStore('workspaces');
    const request = store.delete(workspaceId);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get user statistics
 */
export async function getUserStats(db: IDBDatabase): Promise<{
  totalChats: number;
  totalWorkspaces: number;
  lastActivity?: string;
  storageUsed?: number;
}> {
  try {
    const [chats, workspaces] = await Promise.all([getUserChats(db), getUserWorkspaces(db)]);

    // Calculate last activity
    let lastActivity: string | undefined;

    const allTimestamps = [
      ...chats.map((c) => c.timestamp),
      ...workspaces.map((w) => w.lastAccessed || w.createdAt),
    ].filter(Boolean);

    if (allTimestamps.length > 0) {
      lastActivity = allTimestamps.sort().reverse()[0];
    }

    return {
      totalChats: chats.length,
      totalWorkspaces: workspaces.length,
      lastActivity,
    };
  } catch (error) {
    logger.error('Failed to get user stats:', error);
    return {
      totalChats: 0,
      totalWorkspaces: 0,
    };
  }
}
