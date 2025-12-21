import type { Message } from 'ai';
import { createScopedLogger } from '~/utils/logger';
import type { ChatHistoryItem } from './useChatHistory';
import type { Snapshot } from './types'; // Import Snapshot type
import type { FileMap } from '~/lib/stores/files';
import { withRetry } from '~/lib/utils/retry';

export interface IChatMetadata {
  gitUrl: string;
  gitBranch?: string;
  netlifySiteId?: string;
}

const logger = createScopedLogger('ChatHistory');

// this is used at the top level and never rejects
export async function openDatabase(): Promise<IDBDatabase | undefined> {
  if (typeof indexedDB === 'undefined') {
    console.error('indexedDB is not available in this environment.');
    return undefined;
  }

  return new Promise((resolve) => {
    const request = indexedDB.open('boltHistory', 2);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const oldVersion = event.oldVersion;

      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains('chats')) {
          const store = db.createObjectStore('chats', { keyPath: 'id' });
          store.createIndex('id', 'id', { unique: true });
          store.createIndex('urlId', 'urlId', { unique: true });
        }
      }

      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains('snapshots')) {
          db.createObjectStore('snapshots', { keyPath: 'chatId' });
        }
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

export async function getAll(db: IDBDatabase): Promise<ChatHistoryItem[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readonly');
    const store = transaction.objectStore('chats');
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result as ChatHistoryItem[]);
    request.onerror = () => reject(request.error);
  });
}

export async function setMessages(
  db: IDBDatabase,
  id: string,
  messages: Message[],
  urlId?: string,
  description?: string,
  timestamp?: string,
  metadata?: IChatMetadata,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readwrite');
    const store = transaction.objectStore('chats');

    if (timestamp && isNaN(Date.parse(timestamp))) {
      reject(new Error('Invalid timestamp'));
      return;
    }

    const request = store.put({
      id,
      messages,
      urlId,
      description,
      timestamp: timestamp ?? new Date().toISOString(),
      metadata,
    });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getMessages(db: IDBDatabase, id: string): Promise<ChatHistoryItem> {
  return (await getMessagesById(db, id)) || (await getMessagesByUrlId(db, id));
}

export async function getMessagesByUrlId(db: IDBDatabase, id: string): Promise<ChatHistoryItem> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readonly');
    const store = transaction.objectStore('chats');
    const index = store.index('urlId');
    const request = index.get(id);

    request.onsuccess = () => resolve(request.result as ChatHistoryItem);
    request.onerror = () => reject(request.error);
  });
}

export async function getMessagesById(db: IDBDatabase, id: string): Promise<ChatHistoryItem> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readonly');
    const store = transaction.objectStore('chats');
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result as ChatHistoryItem);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteById(db: IDBDatabase, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['chats', 'snapshots'], 'readwrite'); // Add snapshots store to transaction
    const chatStore = transaction.objectStore('chats');
    const snapshotStore = transaction.objectStore('snapshots');

    const deleteChatRequest = chatStore.delete(id);
    const deleteSnapshotRequest = snapshotStore.delete(id); // Also delete snapshot

    let chatDeleted = false;
    let snapshotDeleted = false;

    const checkCompletion = () => {
      if (chatDeleted && snapshotDeleted) {
        resolve(undefined);
      }
    };

    deleteChatRequest.onsuccess = () => {
      chatDeleted = true;
      checkCompletion();
    };
    deleteChatRequest.onerror = () => reject(deleteChatRequest.error);

    deleteSnapshotRequest.onsuccess = () => {
      snapshotDeleted = true;
      checkCompletion();
    };

    deleteSnapshotRequest.onerror = (event) => {
      if ((event.target as IDBRequest).error?.name === 'NotFoundError') {
        snapshotDeleted = true;
        checkCompletion();
      } else {
        reject(deleteSnapshotRequest.error);
      }
    };

    transaction.oncomplete = () => {
      // This might resolve before checkCompletion if one operation finishes much faster
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getNextId(db: IDBDatabase): Promise<string> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readonly');
    const store = transaction.objectStore('chats');
    const request = store.getAllKeys();

    request.onsuccess = () => {
      const highestId = request.result.reduce((cur, acc) => Math.max(+cur, +acc), 0);
      resolve(String(+highestId + 1));
    };

    request.onerror = () => reject(request.error);
  });
}

export async function getUrlId(db: IDBDatabase, id: string): Promise<string> {
  const idList = await getUrlIds(db);

  if (!idList.includes(id)) {
    return id;
  } else {
    let i = 2;

    while (idList.includes(`${id}-${i}`)) {
      i++;
    }

    return `${id}-${i}`;
  }
}

async function getUrlIds(db: IDBDatabase): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readonly');
    const store = transaction.objectStore('chats');
    const idList: string[] = [];

    const request = store.openCursor();

    request.onsuccess = (event: Event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;

      if (cursor) {
        idList.push(cursor.value.urlId);
        cursor.continue();
      } else {
        resolve(idList);
      }
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function forkChat(db: IDBDatabase, chatId: string, messageId: string): Promise<string> {
  const chat = await getMessages(db, chatId);

  if (!chat) {
    throw new Error('Chat not found');
  }

  // Find the index of the message to fork at
  const messageIndex = chat.messages.findIndex((msg) => msg.id === messageId);

  if (messageIndex === -1) {
    throw new Error('Message not found');
  }

  // Get messages up to and including the selected message
  const messages = chat.messages.slice(0, messageIndex + 1);

  return createChatFromMessages(db, chat.description ? `${chat.description} (fork)` : 'Forked chat', messages);
}

export async function duplicateChat(db: IDBDatabase, id: string): Promise<string> {
  const chat = await getMessages(db, id);

  if (!chat) {
    throw new Error('Chat not found');
  }

  return createChatFromMessages(db, `${chat.description || 'Chat'} (copy)`, chat.messages);
}

export async function createChatFromMessages(
  db: IDBDatabase,
  description: string,
  messages: Message[],
  metadata?: IChatMetadata,
): Promise<string> {
  const newId = await getNextId(db);
  const newUrlId = await getUrlId(db, newId); // Get a new urlId for the duplicated chat

  await setMessages(
    db,
    newId,
    messages,
    newUrlId, // Use the new urlId
    description,
    undefined, // Use the current timestamp
    metadata,
  );

  return newUrlId; // Return the urlId instead of id for navigation
}

export async function updateChatDescription(db: IDBDatabase, id: string, description: string): Promise<void> {
  const chat = await getMessages(db, id);

  if (!chat) {
    throw new Error('Chat not found');
  }

  if (!description.trim()) {
    throw new Error('Description cannot be empty');
  }

  await setMessages(db, id, chat.messages, chat.urlId, description, chat.timestamp, chat.metadata);
}

export async function updateChatMetadata(
  db: IDBDatabase,
  id: string,
  metadata: IChatMetadata | undefined,
): Promise<void> {
  const chat = await getMessages(db, id);

  if (!chat) {
    throw new Error('Chat not found');
  }

  await setMessages(db, id, chat.messages, chat.urlId, chat.description, chat.timestamp, metadata);
}

export async function getSnapshot(db: IDBDatabase, chatId: string): Promise<Snapshot | undefined> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('snapshots', 'readonly');
    const store = transaction.objectStore('snapshots');
    const request = store.get(chatId);

    request.onsuccess = () => resolve(request.result?.snapshot as Snapshot | undefined);
    request.onerror = () => reject(request.error);
  });
}

export async function setSnapshot(db: IDBDatabase, chatId: string, snapshot: Snapshot): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('snapshots', 'readwrite');
    const store = transaction.objectStore('snapshots');
    const request = store.put({ chatId, snapshot });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteSnapshot(db: IDBDatabase, chatId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('snapshots', 'readwrite');
    const store = transaction.objectStore('snapshots');
    const request = store.delete(chatId);

    request.onsuccess = () => resolve();

    request.onerror = (event) => {
      if ((event.target as IDBRequest).error?.name === 'NotFoundError') {
        resolve();
      } else {
        reject(request.error);
      }
    };
  });
}

/*
 * ============================================================================
 * Server API Functions (Client-side HTTP calls to API routes)
 * ============================================================================
 * These functions make HTTP requests to server API endpoints for syncing
 * chat history with the server when the user is authenticated.
 */

/**
 * Fetch chat messages from the server API
 */
export async function getServerMessages(projectId: string): Promise<ChatHistoryItem | null> {
  try {
    logger.info('Fetching messages from server', { projectId });

    const response = await fetch(`/api/projects/${projectId}/messages`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        logger.info('No messages found for project', { projectId });
        return null;
      }

      const errorData = await response.json().catch(() => ({}) as any);
      throw new Error((errorData as any).message || `Failed to fetch messages: ${response.status}`);
    }

    const data = (await response.json()) as any;

    // Convert API response to ChatHistoryItem format
    const chatHistoryItem: ChatHistoryItem = {
      id: projectId,
      urlId: undefined, // Will be resolved by calling component
      description: undefined, // Project description will be fetched separately
      messages: data.messages.map((msg: any) => ({
        id: msg.message_id,
        role: msg.role,
        content: msg.content,
        createdAt: new Date(msg.created_at),

        // Add any other AI SDK Message fields that might be needed
      })) as Message[],
      timestamp: data.messages.length > 0 ? data.messages[0].created_at : new Date().toISOString(),
    };

    logger.info('Messages fetched successfully', {
      projectId,
      messageCount: chatHistoryItem.messages.length,
    });

    return chatHistoryItem;
  } catch (error) {
    logger.error('Failed to fetch messages from server', {
      error: String(error),
      projectId,
    });
    throw error;
  }
}

/**
 * Save chat messages to the server API
 */
export async function setServerMessages(projectId: string, messages: Message[]): Promise<void> {
  try {
    logger.info('Saving messages to server', { projectId, messageCount: messages.length });

    // Convert AI SDK Message format to API format
    const apiMessages = messages.map((msg, index) => ({
      message_id: msg.id,
      sequence_num: index,
      role: msg.role,
      content: msg.content,
      annotations: [], // TODO: Extract annotations from AI SDK Message if available
      created_at: msg.createdAt?.toISOString() || new Date().toISOString(),
    }));

    const response = await fetch(`/api/projects/${projectId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: apiMessages,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}) as any);
      throw new Error((errorData as any).message || `Failed to save messages: ${response.status}`);
    }

    const data = (await response.json()) as any;

    logger.info('Messages saved successfully', {
      projectId,
      savedCount: data.saved_count,
      requestCount: messages.length,
    });
  } catch (error) {
    logger.error('Failed to save messages to server', {
      error: String(error),
      projectId,
    });
    throw error;
  }
}

/**
 * Utility function to check if the user is authenticated
 * This can be used to determine whether to use server or client storage
 */
export function isUserAuthenticated(): boolean {
  // Check if we're on the server side or if session cookies are present
  if (typeof document === 'undefined') {
    return false; // Server-side rendering - assume no auth
  }

  // Check for Better Auth session cookie
  return document.cookie.includes('better-auth.session_token');
}

/*
 * ============================================================================
 * Server Snapshot Functions (Client-side HTTP calls to API routes)
 * ============================================================================
 * These functions make HTTP requests to server API endpoints for fetching
 * and saving file snapshots when the user is authenticated.
 */

/**
 * Fetch file snapshot from the server API
 */
export async function getServerSnapshot(projectId: string): Promise<Snapshot | null> {
  try {
    logger.info('Fetching snapshot from server', { projectId });

    const snapshotData = await withRetry(
      async () => {
        const response = await fetch(`/api/projects/${projectId}/snapshot`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          if (response.status === 404) {
            logger.info('No snapshot found on server', { projectId });
            return null;
          }

          const errorData = (await response.json().catch(() => ({}))) as any;
          throw new Error(errorData.message || `Failed to fetch snapshot: ${response.status}`);
        }

        return response.json();
      },
      {
        maxRetries: 2, // Fewer retries for snapshot loads
        baseDelay: 500,
        onRetry: (error, attempt) => {
          logger.warn(`Snapshot fetch retry ${attempt} for ${projectId}:`, error.message);
        },
      },
    );

    // If we got null from 404, return null
    if (snapshotData === null) {
      return null;
    }

    // Type guard for snapshot data
    const serverSnapshot = snapshotData as {
      files?: Record<string, unknown>;
      summary?: string;
      created_at?: string;
      updated_at?: string;
    };

    // Transform server response to match Snapshot interface
    const snapshot: Snapshot = {
      chatIndex: '', // Server snapshots don't have chatIndex, set to empty
      files: (serverSnapshot.files as FileMap) || {},
      summary: serverSnapshot.summary,
      created_at: serverSnapshot.created_at,
      updated_at: serverSnapshot.updated_at,
    };

    logger.info('Snapshot fetched from server', {
      projectId,
      filesCount: Object.keys(snapshot.files).length,
      createdAt: snapshot.created_at,
    });

    return snapshot;
  } catch (error) {
    logger.error('Failed to fetch snapshot from server', {
      error: String(error),
      projectId,
    });
    throw error;
  }
}

/**
 * Save file snapshot to the server API
 */
export async function setServerSnapshot(projectId: string, snapshot: Snapshot): Promise<void> {
  try {
    logger.info('Saving snapshot to server', {
      projectId,
      filesCount: Object.keys(snapshot.files).length,
      hasSummary: !!snapshot.summary,
    });

    // Estimate snapshot size before sending
    const snapshotSize = JSON.stringify(snapshot.files).length;
    const sizeInMB = snapshotSize / (1024 * 1024);

    const SNAPSHOT_SIZE_LIMIT_MB = 45;

    if (sizeInMB > SNAPSHOT_SIZE_LIMIT_MB) {
      logger.warn('Snapshot approaching size limit', {
        projectId,
        sizeMB: sizeInMB.toFixed(2),
        limitMB: SNAPSHOT_SIZE_LIMIT_MB,
      });
    }

    const result = await withRetry(
      async () => {
        const response = await fetch(`/api/projects/${projectId}/snapshot`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            files: snapshot.files,
            summary: snapshot.summary,
          }),
        });

        if (!response.ok) {
          const errorData = (await response.json().catch(() => ({}))) as any;

          if (response.status === 413) {
            // Don't retry on payload too large
            throw new Error(errorData.message || 'Snapshot too large. Consider removing large binary files.');
          }

          // Don't retry on client errors (4xx except 429 and 5xx)
          if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            throw new Error(errorData.message || `Failed to save snapshot: ${response.status}`);
          }

          // Retry on server errors and rate limiting
          throw new Error(errorData.message || `Failed to save snapshot: ${response.status}`);
        }

        return response.json();
      },
      {
        maxRetries: 2,
        baseDelay: 1000,
        retryCondition: (error) => {
          const message = error.message.toLowerCase();

          // Don't retry on size limit errors
          if (message.includes('too large') || message.includes('413')) {
            return false;
          }

          // Don't retry on client errors except rate limiting
          if (
            message.includes('400') ||
            message.includes('401') ||
            message.includes('403') ||
            message.includes('404') ||
            message.includes('422')
          ) {
            return false;
          }

          // Retry on server errors and network issues
          return true;
        },
        onRetry: (error, attempt) => {
          logger.warn(`Snapshot save retry ${attempt} for ${projectId}:`, error.message);
        },
      },
    );

    logger.info('Snapshot saved to server', {
      projectId,
      updatedAt: (result as any)?.updated_at,
      filesCount: Object.keys(snapshot.files).length,
    });
  } catch (error) {
    logger.error('Failed to save snapshot to server', {
      error: String(error),
      projectId,
    });
    throw error;
  }
}
