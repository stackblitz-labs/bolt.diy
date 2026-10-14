import { getMessages, getSnapshot } from './db';
import type { Snapshot } from './types';

type ChatHistoryItem = Awaited<ReturnType<typeof getMessages>>;

const messageCache = new Map<string, Promise<ChatHistoryItem>>();
const snapshotCache = new Map<string, Promise<Snapshot | undefined>>();

function cacheRead<T>(cache: Map<string, Promise<T>>, id: string, read: () => Promise<T>): Promise<T> {
  const cached = cache.get(id);

  if (cached) {
    return cached;
  }

  const promise = read();
  cache.set(id, promise);

  void promise.catch(() => {
    // An older read may reject after invalidation and a replacement read.
    if (cache.get(id) === promise) {
      cache.delete(id);
    }
  });

  return promise;
}

/**
 * Prefetch chat messages and snapshot from IndexedDB on hover.
 * This primes the in-memory cache before the user clicks to switch chats.
 */
export function prefetchChat(database: IDBDatabase | undefined, id: string) {
  if (!database || !id) {
    return;
  }

  const messages = cacheRead(messageCache, id, () => getMessages(database, id));

  void messages
    .then((chat) => {
      if (chat && !snapshotCache.has(chat.id)) {
        cacheRead(snapshotCache, chat.id, () => getSnapshot(database, chat.id));
      }
    })
    .catch(() => undefined);
}

/**
 * Get messages, using the cached promise if available from prefetch.
 */
export async function getCachedMessages(database: IDBDatabase, id: string): Promise<ChatHistoryItem> {
  return cacheRead(messageCache, id, () => getMessages(database, id));
}

/**
 * Get snapshot, using the cached promise if available from prefetch.
 */
export async function getCachedSnapshot(database: IDBDatabase, id: string): Promise<Snapshot | undefined> {
  return cacheRead(snapshotCache, id, () => getSnapshot(database, id));
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
