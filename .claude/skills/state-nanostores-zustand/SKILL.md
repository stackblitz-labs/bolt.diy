---
name: state-nanostores-zustand
description: Use when working with state management in the website-agent codebase. Covers nanostores atoms/maps for reactive UI state, zustand for complex state, IndexedDB persistence, localStorage, HMR preservation, and store subscription patterns. Triggers include "state management", "nanostore", "zustand", "reactive store", "atom", "map store", "IndexedDB", "persistence", "useChatHistory", "workbenchStore", "chatStore", "filesStore", "subscribe to store", "persist state", "HMR state".
---

# State Management Skill (Nanostores + Zustand)

## Goal

Manage client-side state using the codebase's established patterns: nanostores for reactive UI, zustand for complex state, and IndexedDB/localStorage for persistence.

## State Management Strategy

| Use Case | Technology | Location |
|----------|------------|----------|
| Reactive UI atoms (simple) | Nanostores `atom()` | `app/lib/stores/*.ts` |
| Reactive UI maps (collections) | Nanostores `map()` | `app/lib/stores/*.ts` |
| Complex state with middleware | Zustand | `app/lib/stores/*.ts` |
| Chat history persistence | IndexedDB | `app/lib/persistence/db.ts` |
| Settings/preferences | localStorage | `app/lib/persistence/localStorage.ts` |
| Locked files tracking | localStorage | `app/lib/persistence/lockedFiles.ts` |

## Nanostores Patterns

### Simple Atom (single value)

```typescript
import { atom } from 'nanostores';

// Boolean atom
export const showWorkbench = atom(false);

// Usage in component
import { useStore } from '@nanostores/react';

function MyComponent() {
  const isVisible = useStore(showWorkbench);
  return <div>{isVisible && <Workbench />}</div>;
}

// Update the atom
showWorkbench.set(true);
```

### Map Store (object/record)

```typescript
import { map, type MapStore } from 'nanostores';

export interface FileState {
  type: 'file' | 'folder';
  content?: string;
  isLocked?: boolean;
}

export type FileMap = Record<string, FileState | undefined>;

// Create map store
export const files: MapStore<FileMap> = map({});

// Update single key
files.setKey('/home/project/src/app.ts', { type: 'file', content: '...' });

// Get current value
const currentFiles = files.get();

// Subscribe to changes
const unsubscribe = files.subscribe((value) => {
  console.log('Files changed:', value);
});
```

### Store Class Pattern (WorkbenchStore style)

```typescript
import { atom, map, type MapStore, type WritableAtom } from 'nanostores';

export class WorkbenchStore {
  // Private sub-stores
  #filesStore = new FilesStore(webcontainer);
  #editorStore = new EditorStore(this.#filesStore);

  // Public reactive atoms
  showWorkbench: WritableAtom<boolean> = atom(false);
  currentView: WritableAtom<'code' | 'diff' | 'preview'> = atom('code');
  
  // Public map store
  artifacts: MapStore<Record<string, ArtifactState>> = map({});

  // Getters for nested stores
  get files() {
    return this.#filesStore.files;
  }

  // Methods that update state
  setShowWorkbench(show: boolean) {
    this.showWorkbench.set(show);
  }

  // Async operations
  async saveFile(filePath: string) {
    await this.#filesStore.saveFile(filePath);
    this.unsavedFiles.set(new Set());
  }
}

// Export singleton instance
export const workbenchStore = new WorkbenchStore();
```

## HMR State Preservation

**Critical**: Preserve stores across hot module reload in development:

```typescript
import { atom, map } from 'nanostores';

export class MyStore {
  // Check for existing HMR data
  myAtom: WritableAtom<boolean> = import.meta.hot?.data.myAtom ?? atom(false);
  myMap: MapStore<Record<string, Data>> = import.meta.hot?.data.myMap ?? map({});

  constructor() {
    // Store references for HMR
    if (import.meta.hot) {
      import.meta.hot.data.myAtom = this.myAtom;
      import.meta.hot.data.myMap = this.myMap;
    }
  }
}
```

## React Integration

### useStore Hook

```typescript
import { useStore } from '@nanostores/react';
import { workbenchStore } from '~/lib/stores/workbench';

function WorkbenchPanel() {
  // Subscribe to atom
  const showWorkbench = useStore(workbenchStore.showWorkbench);
  
  // Subscribe to map store
  const files = useStore(workbenchStore.files);
  
  // Subscribe to nested value (computed)
  const currentDoc = useStore(workbenchStore.currentDocument);
  
  return showWorkbench ? <div>...</div> : null;
}
```

### Custom Hooks for Stores

```typescript
// app/lib/hooks/useFiles.ts
import { useStore } from '@nanostores/react';
import { workbenchStore } from '~/lib/stores/workbench';

export function useFiles() {
  const files = useStore(workbenchStore.files);
  
  return {
    files,
    getFile: (path: string) => files[path],
    saveFile: (path: string) => workbenchStore.saveFile(path),
  };
}
```

## IndexedDB Persistence

### Database Setup (db.ts pattern)

```typescript
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('ChatHistory');

export async function openDatabase(): Promise<IDBDatabase | undefined> {
  if (typeof indexedDB === 'undefined') {
    console.error('indexedDB is not available');
    return undefined;
  }

  return new Promise((resolve) => {
    const request = indexedDB.open('boltHistory', 2);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const oldVersion = event.oldVersion;

      // Version 1: Create chats store
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains('chats')) {
          const store = db.createObjectStore('chats', { keyPath: 'id' });
          store.createIndex('id', 'id', { unique: true });
          store.createIndex('urlId', 'urlId', { unique: true });
        }
      }

      // Version 2: Add snapshots store
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains('snapshots')) {
          db.createObjectStore('snapshots', { keyPath: 'chatId' });
        }
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      resolve(undefined);
      logger.error((event.target as IDBOpenDBRequest).error);
    };
  });
}
```

### CRUD Operations

```typescript
// Get all records
export async function getAll(db: IDBDatabase): Promise<ChatHistoryItem[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readonly');
    const store = transaction.objectStore('chats');
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Set/update record
export async function setMessages(
  db: IDBDatabase,
  id: string,
  messages: Message[],
  urlId?: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readwrite');
    const store = transaction.objectStore('chats');

    const request = store.put({
      id,
      messages,
      urlId,
      timestamp: new Date().toISOString(),
    });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Delete record
export async function deleteById(db: IDBDatabase, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readwrite');
    const store = transaction.objectStore('chats');
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
```

### useChatHistory Hook Pattern

```typescript
// app/lib/persistence/useChatHistory.ts
import { useState, useEffect } from 'react';
import { openDatabase, getAll, setMessages, deleteById } from './db';

export interface ChatHistoryItem {
  id: string;
  urlId?: string;
  description?: string;
  messages: Message[];
  timestamp: string;
}

export function useChatHistory() {
  const [db, setDb] = useState<IDBDatabase | null>(null);
  const [ready, setReady] = useState(false);
  const [chats, setChats] = useState<ChatHistoryItem[]>([]);

  // Initialize database
  useEffect(() => {
    openDatabase().then((database) => {
      if (database) {
        setDb(database);
        setReady(true);
      }
    });
  }, []);

  // Load chats when ready
  useEffect(() => {
    if (db && ready) {
      getAll(db).then(setChats);
    }
  }, [db, ready]);

  return {
    ready,
    chats,
    saveChat: async (id: string, messages: Message[]) => {
      if (db) await setMessages(db, id, messages);
    },
    deleteChat: async (id: string) => {
      if (db) await deleteById(db, id);
    },
  };
}
```

## localStorage Patterns

### Settings Persistence

```typescript
// app/lib/persistence/localStorage.ts

export function getLocalStorage<T>(key: string, defaultValue: T): T {
  if (typeof localStorage === 'undefined') {
    return defaultValue;
  }

  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch {
    return defaultValue;
  }
}

export function setLocalStorage<T>(key: string, value: T): void {
  if (typeof localStorage === 'undefined') return;

  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Failed to save ${key} to localStorage`, error);
  }
}
```

### Locked Files Pattern

```typescript
// app/lib/persistence/lockedFiles.ts
const LOCKED_FILES_KEY = 'bolt-locked-files';

export function addLockedFile(filePath: string, chatId: string): void {
  const locked = getLockedFilesForChat(chatId);
  if (!locked.some(f => f.path === filePath)) {
    locked.push({ path: filePath, chatId, isFolder: false });
    setLocalStorage(LOCKED_FILES_KEY, locked);
  }
}

export function getLockedFilesForChat(chatId: string): LockedItem[] {
  const all = getLocalStorage<LockedItem[]>(LOCKED_FILES_KEY, []);
  return all.filter(item => item.chatId === chatId);
}

export function isPathInLockedFolder(path: string, chatId: string): boolean {
  const folders = getLockedFoldersForChat(chatId);
  return folders.some(folder => path.startsWith(folder.path + '/'));
}
```

## Debounced Persistence

For expensive persistence operations:

```typescript
import { createSampler } from '~/utils/sampler';

// Throttle saves to max once per 2 seconds
const throttledSave = createSampler(async (data: Data) => {
  await saveToDatabase(data);
}, 2000);

// In store method
async updateAndPersist(data: Data) {
  this.dataStore.set(data);
  throttledSave(data); // Won't fire more than once per 2s
}
```

## Store Files Reference

| Store | Path | Purpose |
|-------|------|---------|
| `workbenchStore` | `app/lib/stores/workbench.ts` | Main IDE state |
| `filesStore` | `app/lib/stores/files.ts` | File system state |
| `chatStore` | `app/lib/stores/chat.ts` | Chat session state |
| `editorStore` | `app/lib/stores/editor.ts` | CodeMirror state |
| `terminalStore` | `app/lib/stores/terminal.ts` | Terminal sessions |
| `previewsStore` | `app/lib/stores/previews.ts` | Preview iframe state |
| `settingsStore` | `app/lib/stores/settings.ts` | App settings |
| `authStore` | `app/lib/stores/auth.ts` | Authentication state |

## Checklist

- [ ] Use nanostores `atom()` for simple boolean/string/number state
- [ ] Use nanostores `map()` for object/record state
- [ ] Preserve state across HMR with `import.meta.hot.data`
- [ ] Use `useStore()` hook in React components
- [ ] Use IndexedDB for large data (chat history, snapshots)
- [ ] Use localStorage for small preferences/settings
- [ ] Debounce expensive persistence operations
- [ ] Check `typeof localStorage !== 'undefined'` for SSR safety
- [ ] Export singleton store instances
- [ ] Add scoped logger for debugging

## References

- `app/lib/stores/workbench.ts` - Main store class pattern
- `app/lib/stores/files.ts` - File system with WebContainer sync
- `app/lib/persistence/db.ts` - IndexedDB patterns
- `app/lib/persistence/lockedFiles.ts` - localStorage patterns
- `app/lib/persistence/useChatHistory.ts` - React hook for persistence
