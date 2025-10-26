import { useState, useEffect } from 'react';

/**
 * Hook to initialize and provide access to the IndexedDB database
 */
export function useIndexedDB() {
  const [db, setDb] = useState<IDBDatabase | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const initDB = async () => {
      try {
        setIsLoading(true);

        const request = indexedDB.open('boltDB', 1);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;

          // Create object stores if they don't exist
          if (!db.objectStoreNames.contains('chats')) {
            const chatStore = db.createObjectStore('chats', { keyPath: 'id' });
            chatStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          }

          if (!db.objectStoreNames.contains('settings')) {
            db.createObjectStore('settings', { keyPath: 'key' });
          }
        };

        request.onsuccess = (event) => {
          const database = (event.target as IDBOpenDBRequest).result;
          setDb(database);
          setIsLoading(false);
        };

        request.onerror = (event) => {
          setError(new Error(`Database error: ${(event.target as IDBOpenDBRequest).error?.message}`));
          setIsLoading(false);
        };
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error initializing database'));
        setIsLoading(false);
      }
    };

    initDB();

    return () => {
      if (db) {
        db.close();
      }
    };
  }, []);

  return { db, isLoading, error };
}
