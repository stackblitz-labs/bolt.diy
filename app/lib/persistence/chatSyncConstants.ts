/**
 * Chat Sync Constants
 *
 * Shared configuration for project chat synchronization.
 * Part of specs/001-project-chat-sync implementation.
 */

/**
 * Page size for loading messages from the server.
 * Used for initial load and "Load older messages" pagination.
 */
export const MESSAGE_PAGE_SIZE = 50;

/**
 * Maximum number of messages to load in a single request.
 * Prevents excessive payload sizes.
 */
export const MAX_MESSAGE_LIMIT = 200;

/**
 * Maximum number of pages to load for older messages.
 * Prevents excessive memory usage for very large chat histories.
 * At 50 messages per page, this allows up to 1000 messages (20 pages).
 */
export const MAX_MESSAGE_PAGES = 20;

/**
 * Annotation key for marking messages as pending sync.
 * Messages with this annotation have not been successfully synced to the server.
 */
export const PENDING_SYNC_ANNOTATION = 'pending-sync';

/**
 * Annotation key for sync error state.
 * Indicates that a sync attempt failed for this message.
 */
export const SYNC_ERROR_ANNOTATION = 'sync-error';

/**
 * Default retry delay in milliseconds for background sync.
 */
export const SYNC_RETRY_BASE_DELAY_MS = 1000;

/**
 * Maximum retry delay in milliseconds for exponential backoff.
 */
export const SYNC_RETRY_MAX_DELAY_MS = 30000;

/**
 * Maximum number of retry attempts for background sync.
 */
export const SYNC_MAX_RETRIES = 5;
