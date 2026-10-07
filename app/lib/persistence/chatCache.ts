import { getMessages, getSnapshot } from './db';
import type { Snapshot } from './types';

type ChatHistoryItem = Awaited<ReturnType<typeof getMessages>>;

const messageCache = new Map<string, Promise<ChatHistoryItem>>();
const snapshotCache = new Map<string, Promise<Snapshot | undefined>>();

/**
 * Prefetch chat messages and snapshot from IndexedDB on hover.
 * This primes the in-memory cache before the user clicks to switch chats.
 */
export function prefetchChat(database: IDBDatabase | undefined, id: string) {
  if (!database || !id) {
    return;
  }

  if (!messageCache.has(id)) {
    messageCache.set(id, getMessages(database, id));
  }

  if (!snapshotCache.has(id)) {
    snapshotCache.set(id, getSnapshot(database, id));
  }
}

/**
 * Get messages, using the cached promise if available from prefetch.
 */
export async function getCachedMessages(database: IDBDatabase, id: string): Promise<ChatHistoryItem> {
  const cached = messageCache.get(id);

  if (cached) {
    return cached;
  }

  const promise = getMessages(database, id);
  messageCache.set(id, promise);

  return promise;
}

/**
 * Get snapshot, using the cached promise if available from prefetch.
 */
export async function getCachedSnapshot(database: IDBDatabase, id: string): Promise<Snapshot | undefined> {
  const cached = snapshotCache.get(id);

  if (cached) {
    return cached;
  }

  const promise = getSnapshot(database, id);
  snapshotCache.set(id, promise);

  return promise;
}

/**
 * Invalidate cache entry when chat or snapshot is saved/updated.
 */
export function invalidateChatCache(id?: string) {
  if (id) {
    messageCache.delete(id);
    snapshotCache.delete(id);
  } else {
    messageCache.clear();
    snapshotCache.clear();
  }
}
