/**
 * Message Sync Types
 *
 * Type definitions for project chat synchronization state.
 * Part of specs/001-project-chat-sync implementation.
 */

/**
 * Sync state for a project's chat history.
 */
export type ChatSyncState =
  | 'synced' // All messages successfully synced to server
  | 'syncing' // Background sync in progress
  | 'pending' // Messages waiting to be synced
  | 'error' // Sync failed, retry available
  | 'signed-out'; // User not authenticated, local-only mode

/**
 * Pending sync annotation for individual messages.
 * Stored in message.annotations array when a message hasn't been synced to server.
 */
export interface PendingSyncAnnotation {
  type: 'pending-sync';
  timestamp: string; // ISO 8601 timestamp when message was created locally
  retryCount?: number; // Number of failed sync attempts
  lastError?: string; // Last sync error message
}

/**
 * Sync error annotation for individual messages.
 * Stored in message.annotations array when sync fails.
 */
export interface SyncErrorAnnotation {
  type: 'sync-error';
  error: string;
  timestamp: string; // ISO 8601 timestamp when error occurred
}

/**
 * Helper type to check if message has pending sync annotation.
 */
export interface MessageWithPendingSync {
  id: string;
  annotations?: Array<PendingSyncAnnotation | SyncErrorAnnotation | unknown>;
}

/**
 * Pagination metadata for message loading.
 */
export interface MessagePaginationMeta {
  total: number; // Total messages available on server
  loaded: number; // Number of messages currently loaded
  hasOlder: boolean; // Whether older messages are available to load
  hasNewer?: boolean; // Whether newer messages are available (for future use)
}

/**
 * Result from loading a page of messages.
 */
export interface MessagePageResult {
  messages: any[]; // AI SDK message array
  total: number; // Total messages available
}

/**
 * Sync status for tracking pending messages.
 */
export interface SyncStatus {
  state: ChatSyncState;
  pendingCount: number; // Number of messages pending sync
  lastSyncAt?: string; // ISO 8601 timestamp of last successful sync
  lastErrorAt?: string; // ISO 8601 timestamp of last sync error
  lastError?: string; // Last error message
}
