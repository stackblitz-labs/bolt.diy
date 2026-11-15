const DATABASE_NAME = 'boltPlugins';
const DATABASE_VERSION = 1;

export type InstalledPlugin = {
  id: string;
  manifest: unknown;
  source: 'marketplace' | 'local';
  sourceCommit?: string;
  manifestSha256: string;
  packageSha256: string;
  packageBytes: ArrayBuffer;
  enabled: boolean;
  installedAt: string;
  previous?: InstalledPluginVersion;
  configuration: Record<string, string | boolean | number>;
};

export type InstalledPluginVersion = Pick<
  InstalledPlugin,
  'manifest' | 'sourceCommit' | 'manifestSha256' | 'packageSha256' | 'packageBytes'
>;

export type PluginLog = {
  id: string;
  pluginId: string;
  time: string;
  level: 'info' | 'warning' | 'error';
  message: string;
};

let openRequest: Promise<IDBDatabase> | undefined;

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('Plugin storage is not available in this browser.'));
  }

  if (!openRequest) {
    openRequest = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

      request.onupgradeneeded = () => {
        const database = request.result;

        if (!database.objectStoreNames.contains('installed')) {
          database.createObjectStore('installed', { keyPath: 'id' });
        }

        if (!database.objectStoreNames.contains('logs')) {
          const logs = database.createObjectStore('logs', { keyPath: 'id' });
          logs.createIndex('pluginId', 'pluginId');
          logs.createIndex('time', 'time');
        }
      };

      request.onsuccess = () => resolve(request.result);

      request.onerror = () => {
        openRequest = undefined;
        reject(request.error ?? new Error('Could not open plugin storage.'));
      };
      request.onblocked = () => reject(new Error('Plugin storage upgrade is blocked by another tab.'));
    });
  }

  return openRequest;
}

async function runRequest<T>(
  storeName: 'installed' | 'logs',
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const database = await openDatabase();

  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const request = action(transaction.objectStore(storeName));

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Plugin storage request failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Plugin storage transaction was aborted.'));
  });
}

export const pluginDatabase = {
  getAll: () => runRequest<InstalledPlugin[]>('installed', 'readonly', (store) => store.getAll()),
  get: (id: string) => runRequest<InstalledPlugin | undefined>('installed', 'readonly', (store) => store.get(id)),
  put: (plugin: InstalledPlugin) => runRequest<IDBValidKey>('installed', 'readwrite', (store) => store.put(plugin)),
  remove: (id: string) => runRequest<undefined>('installed', 'readwrite', (store) => store.delete(id)),
  logs: (pluginId: string) =>
    runRequest<PluginLog[]>('logs', 'readonly', (store) => store.index('pluginId').getAll(pluginId)),
  putWithLog: (plugin: InstalledPlugin, log: PluginLog) =>
    runMutation(({ installed, logs }) => {
      installed.put(plugin);
      addAndPruneLog(logs, log);
    }),
  removeWithLog: (id: string, log: PluginLog) =>
    runMutation(({ installed, logs }) => {
      installed.delete(id);
      addAndPruneLog(logs, log);
    }),
  addLog: async (log: PluginLog) => {
    const database = await openDatabase();

    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('logs', 'readwrite');
      addAndPruneLog(transaction.objectStore('logs'), log);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Could not save plugin activity.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Plugin activity update was aborted.'));
    });
  },
};

function runMutation(action: (stores: { installed: IDBObjectStore; logs: IDBObjectStore }) => void) {
  return openDatabase().then(
    (database) =>
      new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(['installed', 'logs'], 'readwrite');
        action({ installed: transaction.objectStore('installed'), logs: transaction.objectStore('logs') });
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error('Plugin update failed.'));
        transaction.onabort = () => reject(transaction.error ?? new Error('Plugin update was aborted.'));
      }),
  );
}

function addAndPruneLog(store: IDBObjectStore, log: PluginLog) {
  store.put(log);

  const prune = store.index('time').openCursor(null, 'prev');

  let seen = 0;

  prune.onsuccess = () => {
    const cursor = prune.result;

    if (!cursor) {
      return;
    }

    seen += 1;

    if (seen > 500) {
      cursor.delete();
    }

    cursor.continue();
  };
}
