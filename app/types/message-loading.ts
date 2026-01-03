/**
 * Message Loading Types
 *
 * Types for tracking message loading progress and state.
 * From specs/001-load-project-messages/data-model.md
 */

/**
 * Loading phase states for the message loading state machine.
 * Represents the current stage of fetching messages from server/local storage.
 */
export type LoadingPhase =
  | 'idle' // Not loading, no active operation
  | 'server' // Fetching messages from server
  | 'partial' // Some messages loaded, more pages being fetched
  | 'local' // Falling back to IndexedDB local storage
  | 'merging' // Merging server and local messages
  | 'complete' // All messages loaded successfully
  | 'error'; // Failed to load messages

/**
 * State object tracking message loading progress.
 * Used by the UI to show appropriate loading indicators and error states.
 */
export interface MessageLoadingState {
  phase: LoadingPhase;
  loaded: number; // Messages loaded so far
  total: number | null; // Total messages (null if unknown)
  error: string | null; // Error message if phase === 'error'
  isPartial: boolean; // True if some messages couldn't be loaded
  retryCount: number; // Current retry attempt
  lastRetryAt: Date | null; // Timestamp of last retry
}

/**
 * Initial state for message loading.
 * Use this to reset the loading state to its initial values.
 */
export const initialLoadingState: MessageLoadingState = {
  phase: 'idle',
  loaded: 0,
  total: null,
  error: null,
  isPartial: false,
  retryCount: 0,
  lastRetryAt: null,
};

/**
 * Progress callback payload for message loading.
 * Provides real-time updates during pagination.
 */
export interface MessageLoadProgress {
  loaded: number; // Number of messages loaded so far
  total: number; // Total number of messages to load
  page: number; // Current page number being fetched
  isComplete: boolean; // Whether all pages have been fetched
  isRateLimited: boolean; // Whether the fetch is currently rate limited
}

/**
 * Type for progress callback function.
 * Called during pagination to update UI with loading progress.
 */
export type OnProgressCallback = (progress: MessageLoadProgress) => void;

/**
 * Configuration options for the message loader.
 * Controls pagination, retry behavior, and progress reporting.
 */
export interface MessageLoaderOptions {
  pageSize: number; // Messages per page (default: 100)
  maxRetries: number; // Max retry attempts (default: 3)
  baseDelay: number; // Initial backoff delay ms (default: 1000)
  maxDelay: number; // Max backoff delay ms (default: 30000)
  onProgress?: OnProgressCallback; // Optional progress callback
}

/**
 * Default loader options for most use cases.
 * Override these for specific scenarios if needed.
 */
export const defaultLoaderOptions: MessageLoaderOptions = {
  pageSize: 100,
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
};

/**
 * Return type from the message loader.
 * Contains the loaded messages and metadata about the load operation.
 */
export interface MessageLoadResult {
  messages: Message[]; // Loaded messages in AI SDK format
  total: number; // Total number of messages
  source: 'server' | 'local' | 'merged'; // Source of messages
  isPartial: boolean; // True if rate limited before complete
  loadedFromServer: number; // Count from server
  loadedFromLocal: number; // Count from local (if merged)
}

/**
 * Return type from message merge operation.
 * Contains statistics about the merge result.
 */
export interface MergeResult {
  messages: Message[]; // Merged and sorted messages
  serverCount: number; // Number of messages from server
  localOnlyCount: number; // Number of local-only messages
  duplicatesRemoved: number; // Number of duplicate messages removed
}

/**
 * Extended Message interface that includes sequence_num.
 * This is used when messages are loaded from the server with sequence information.
 */
export interface SequencedMessage extends Message {
  sequence_num?: number;
}

// Import Message type from AI SDK for use in our interfaces
import type { Message } from 'ai';
