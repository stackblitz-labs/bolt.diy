/**
 * Message Sync State Management
 *
 * Tracks sync state for project chat messages, including pending messages,
 * sync errors, and retry state. Part of specs/001-project-chat-sync (Phase 4).
 */

import type { ChatSyncState, SyncStatus } from './messageSyncTypes';
import type { Message } from 'ai';
import { extractMessageAnnotations, isMessagePendingSync } from './annotationHelpers';
import { PENDING_SYNC_ANNOTATION } from './chatSyncConstants';

/**
 * In-memory store for pending message IDs per project.
 * In production, this could be persisted to IndexedDB for durability.
 */
const pendingMessageIdsStore = new Map<string, Set<string>>();

/**
 * In-memory store for sync errors per project.
 */
const syncErrorsStore = new Map<string, { error: string; timestamp: string }>();

/**
 * Get the set of pending message IDs for a project.
 */
export function getPendingMessageIds(projectId: string): Set<string> {
  if (!pendingMessageIdsStore.has(projectId)) {
    pendingMessageIdsStore.set(projectId, new Set());
  }
  return pendingMessageIdsStore.get(projectId)!;
}

/**
 * Add a message ID to the pending set for a project.
 */
export function markMessageAsPending(projectId: string, messageId: string): void {
  const pendingSet = getPendingMessageIds(projectId);
  pendingSet.add(messageId);
}

/**
 * Remove a message ID from the pending set for a project.
 */
export function markMessageAsSynced(projectId: string, messageId: string): void {
  const pendingSet = getPendingMessageIds(projectId);
  pendingSet.delete(messageId);
}

/**
 * Clear all pending message IDs for a project.
 */
export function clearPendingMessages(projectId: string): void {
  pendingMessageIdsStore.set(projectId, new Set());
  syncErrorsStore.delete(projectId);
}

/**
 * Get the count of pending messages for a project.
 */
export function getPendingMessageCount(projectId: string): number {
  return getPendingMessageIds(projectId).size;
}

/**
 * Set a sync error for a project.
 */
export function setSyncError(projectId: string, error: string): void {
  syncErrorsStore.set(projectId, {
    error,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Clear sync error for a project.
 */
export function clearSyncError(projectId: string): void {
  syncErrorsStore.delete(projectId);
}

/**
 * Get the sync error for a project (if any).
 */
export function getSyncError(projectId: string): { error: string; timestamp: string } | undefined {
  return syncErrorsStore.get(projectId);
}

/**
 * Compute the overall sync state for a project.
 *
 * @param projectId - Project ID to compute state for
 * @param isAuthenticated - Whether the user is authenticated
 * @param isSyncing - Whether a sync operation is in progress
 * @returns The current sync state
 */
export function computeSyncState(
  projectId: string | undefined,
  isAuthenticated: boolean,
  isSyncing: boolean,
): ChatSyncState {
  // If no project ID, we can't determine state
  if (!projectId) {
    return isAuthenticated ? 'synced' : 'signed-out';
  }

  // If syncing, return syncing state
  if (isSyncing) {
    return 'syncing';
  }

  // If not authenticated, user is signed out
  if (!isAuthenticated) {
    return 'signed-out';
  }

  // If there are pending messages, state is pending
  const pendingCount = getPendingMessageCount(projectId);
  if (pendingCount > 0) {
    return 'pending';
  }

  // If there's a sync error, state is error
  const syncError = getSyncError(projectId);
  if (syncError) {
    return 'error';
  }

  // Otherwise, synced
  return 'synced';
}

/**
 * Compute detailed sync status for UI display.
 *
 * @param projectId - Project ID to compute status for
 * @param isAuthenticated - Whether the user is authenticated
 * @param isSyncing - Whether a sync operation is in progress
 * @returns Detailed sync status
 */
export function computeSyncStatus(
  projectId: string | undefined,
  isAuthenticated: boolean,
  isSyncing: boolean,
): SyncStatus {
  const state = computeSyncState(projectId, isAuthenticated, isSyncing);
  const pendingCount = projectId ? getPendingMessageCount(projectId) : 0;
  const syncError = projectId ? getSyncError(projectId) : undefined;

  return {
    state,
    pendingCount,
    lastErrorAt: syncError?.timestamp,
    lastError: syncError?.error,
  };
}

/**
 * Filter messages to find which ones are pending sync.
 *
 * @param messages - Array of messages to check
 * @returns Array of message IDs that are pending sync
 */
export function extractPendingMessageIds(messages: Message[]): string[] {
  return messages.filter(isMessagePendingSync).map((m) => m.id);
}

/**
 * Mark all messages in a list as pending sync.
 *
 * @param projectId - Project ID
 * @param messages - Messages to mark as pending
 */
export function markMessagesAsPending(projectId: string, messages: Message[]): void {
  const pendingIds = extractPendingMessageIds(messages);

  for (const messageId of pendingIds) {
    markMessageAsPending(projectId, messageId);
  }
}

/**
 * Initialize pending message tracking from a list of messages.
 * Called when loading messages to restore state.
 *
 * @param projectId - Project ID
 * @param messages - Messages to scan for pending markers
 */
export function initializePendingMessagesFromStore(projectId: string, messages: Message[]): void {
  clearPendingMessages(projectId);
  markMessagesAsPending(projectId, messages);
}
