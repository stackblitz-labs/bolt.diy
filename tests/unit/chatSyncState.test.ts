/**
 * Unit Tests for Message Sync State Management
 *
 * Tests sync state tracking, pending message management, and state computation.
 * From specs/001-project-chat-sync/tasks.md (T041)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Message } from 'ai';
import {
  getPendingMessageIds,
  markMessageAsPending,
  markMessageAsSynced,
  clearPendingMessages,
  getPendingMessageCount,
  setSyncError,
  clearSyncError,
  getSyncError,
  computeSyncState,
  computeSyncStatus,
  extractPendingMessageIds,
  markMessagesAsPending,
  initializePendingMessagesFromStore,
} from '~/lib/persistence/messageSyncState';
import { addPendingSyncAnnotation } from '~/lib/persistence/annotationHelpers';

describe('Message Sync State', () => {
  const projectId = 'test-project-id';

  beforeEach(() => {
    // Clear all state before each test
    clearPendingMessages(projectId);
  });

  afterEach(() => {
    // Cleanup after each test
    clearPendingMessages(projectId);
  });

  describe('Pending message tracking', () => {
    it('should start with no pending messages', () => {
      const pendingIds = getPendingMessageIds(projectId);
      expect(pendingIds.size).toBe(0);
      expect(getPendingMessageCount(projectId)).toBe(0);
    });

    it('should mark a message as pending', () => {
      markMessageAsPending(projectId, 'msg-1');
      const pendingIds = getPendingMessageIds(projectId);

      expect(pendingIds.has('msg-1')).toBe(true);
      expect(getPendingMessageCount(projectId)).toBe(1);
    });

    it('should mark multiple messages as pending', () => {
      markMessageAsPending(projectId, 'msg-1');
      markMessageAsPending(projectId, 'msg-2');
      markMessageAsPending(projectId, 'msg-3');

      expect(getPendingMessageCount(projectId)).toBe(3);
    });

    it('should mark a message as synced (remove from pending)', () => {
      markMessageAsPending(projectId, 'msg-1');
      markMessageAsPending(projectId, 'msg-2');

      markMessageAsSynced(projectId, 'msg-1');

      expect(getPendingMessageCount(projectId)).toBe(1);
      expect(getPendingMessageIds(projectId).has('msg-1')).toBe(false);
      expect(getPendingMessageIds(projectId).has('msg-2')).toBe(true);
    });

    it('should clear all pending messages', () => {
      markMessageAsPending(projectId, 'msg-1');
      markMessageAsPending(projectId, 'msg-2');
      markMessageAsPending(projectId, 'msg-3');

      clearPendingMessages(projectId);

      expect(getPendingMessageCount(projectId)).toBe(0);
      expect(getSyncError(projectId)).toBeUndefined();
    });

    it('should handle multiple projects independently', () => {
      const project1 = 'project-1';
      const project2 = 'project-2';

      markMessageAsPending(project1, 'msg-1');
      markMessageAsPending(project2, 'msg-2');

      expect(getPendingMessageCount(project1)).toBe(1);
      expect(getPendingMessageCount(project2)).toBe(1);

      clearPendingMessages(project1);

      expect(getPendingMessageCount(project1)).toBe(0);
      expect(getPendingMessageCount(project2)).toBe(1); // Unaffected
    });
  });

  describe('Sync error tracking', () => {
    it('should set sync error', () => {
      setSyncError(projectId, 'Network error');

      const error = getSyncError(projectId);
      expect(error).toBeDefined();
      expect(error?.error).toBe('Network error');
      expect(error?.timestamp).toBeDefined();
    });

    it('should clear sync error', () => {
      setSyncError(projectId, 'Network error');
      clearSyncError(projectId);

      const error = getSyncError(projectId);
      expect(error).toBeUndefined();
    });

    it('should update error on setSyncError call', () => {
      setSyncError(projectId, 'Error 1');
      setSyncError(projectId, 'Error 2');

      const error = getSyncError(projectId);
      expect(error?.error).toBe('Error 2');
    });
  });

  describe('Sync state computation', () => {
    it('should return signed-out when not authenticated', () => {
      const state = computeSyncState(projectId, false, false);
      expect(state).toBe('signed-out');
    });

    it('should return syncing when syncing', () => {
      const state = computeSyncState(projectId, true, true);
      expect(state).toBe('syncing');
    });

    it('should return pending when there are pending messages', () => {
      markMessageAsPending(projectId, 'msg-1');

      const state = computeSyncState(projectId, true, false);
      expect(state).toBe('pending');
    });

    it('should return error when there is a sync error', () => {
      setSyncError(projectId, 'Sync failed');

      const state = computeSyncState(projectId, true, false);
      expect(state).toBe('error');
    });

    it('should return synced when authenticated and no pending/error', () => {
      const state = computeSyncState(projectId, true, false);
      expect(state).toBe('synced');
    });

    it('should prioritize syncing state over others', () => {
      markMessageAsPending(projectId, 'msg-1');
      setSyncError(projectId, 'Error');

      const state = computeSyncState(projectId, true, true);
      expect(state).toBe('syncing'); // Syncing takes priority
    });

    it('should prioritize pending over error', () => {
      markMessageAsPending(projectId, 'msg-1');
      setSyncError(projectId, 'Error');

      const state = computeSyncState(projectId, true, false);
      expect(state).toBe('pending'); // Pending takes priority over error
    });
  });

  describe('Sync status computation', () => {
    it('should return complete status object', () => {
      markMessageAsPending(projectId, 'msg-1');
      markMessageAsPending(projectId, 'msg-2');
      setSyncError(projectId, 'Network error');

      const status = computeSyncStatus(projectId, true, false);

      expect(status.state).toBe('pending');
      expect(status.pendingCount).toBe(2);
      expect(status.lastError).toBe('Network error');
      expect(status.lastErrorAt).toBeDefined();
    });

    it('should return zero pending count when no messages', () => {
      const status = computeSyncStatus(projectId, true, false);

      expect(status.pendingCount).toBe(0);
      expect(status.lastErrorAt).toBeUndefined();
      expect(status.lastError).toBeUndefined();
    });

    it('should handle undefined projectId', () => {
      const status = computeSyncStatus(undefined, true, false);

      expect(status.state).toBe('synced');
      expect(status.pendingCount).toBe(0);
    });
  });

  describe('Extract pending message IDs from messages', () => {
    it('should extract IDs from messages with pending annotation', () => {
      const messages: Message[] = [
        { id: 'msg-1', role: 'user', content: 'Hello', createdAt: new Date() },
        addPendingSyncAnnotation({ id: 'msg-2', role: 'user', content: 'World', createdAt: new Date() }),
        { id: 'msg-3', role: 'assistant', content: 'Hi', createdAt: new Date() },
      ];

      const pendingIds = extractPendingMessageIds(messages);

      expect(pendingIds).toEqual(['msg-2']);
      expect(pendingIds).not.toContain('msg-1');
      expect(pendingIds).not.toContain('msg-3');
    });

    it('should return empty array when no pending messages', () => {
      const messages: Message[] = [
        { id: 'msg-1', role: 'user', content: 'Hello', createdAt: new Date() },
        { id: 'msg-2', role: 'assistant', content: 'Hi', createdAt: new Date() },
      ];

      const pendingIds = extractPendingMessageIds(messages);
      expect(pendingIds).toEqual([]);
    });

    it('should handle empty message array', () => {
      const pendingIds = extractPendingMessageIds([]);
      expect(pendingIds).toEqual([]);
    });
  });

  describe('Mark multiple messages as pending', () => {
    it('should mark all pending messages from list', () => {
      const messages: Message[] = [
        { id: 'msg-1', role: 'user', content: 'Hello', createdAt: new Date() },
        addPendingSyncAnnotation({ id: 'msg-2', role: 'user', content: 'World', createdAt: new Date() }),
        addPendingSyncAnnotation({ id: 'msg-3', role: 'assistant', content: 'Hi', createdAt: new Date() }),
      ];

      markMessagesAsPending(projectId, messages);

      expect(getPendingMessageCount(projectId)).toBe(2);
      expect(getPendingMessageIds(projectId).has('msg-2')).toBe(true);
      expect(getPendingMessageIds(projectId).has('msg-3')).toBe(true);
      expect(getPendingMessageIds(projectId).has('msg-1')).toBe(false);
    });
  });

  describe('Initialize pending messages from store', () => {
    it('should initialize pending state from message annotations', () => {
      const messages: Message[] = [
        addPendingSyncAnnotation({ id: 'msg-1', role: 'user', content: 'Hello', createdAt: new Date() }),
        addPendingSyncAnnotation({ id: 'msg-2', role: 'user', content: 'World', createdAt: new Date() }),
        { id: 'msg-3', role: 'assistant', content: 'Hi', createdAt: new Date() },
      ];

      initializePendingMessagesFromStore(projectId, messages);

      expect(getPendingMessageCount(projectId)).toBe(2);
      expect(getPendingMessageIds(projectId).has('msg-1')).toBe(true);
      expect(getPendingMessageIds(projectId).has('msg-2')).toBe(true);
      expect(getPendingMessageIds(projectId).has('msg-3')).toBe(false);
    });

    it('should clear existing state before initializing', () => {
      // Set initial state
      markMessageAsPending(projectId, 'old-msg-1');

      // Initialize with new messages
      const messages: Message[] = [
        addPendingSyncAnnotation({ id: 'msg-1', role: 'user', content: 'Hello', createdAt: new Date() }),
      ];

      initializePendingMessagesFromStore(projectId, messages);

      // Old message should be gone
      expect(getPendingMessageIds(projectId).has('old-msg-1')).toBe(false);
      expect(getPendingMessageIds(projectId).has('msg-1')).toBe(true);
      expect(getPendingMessageCount(projectId)).toBe(1);
    });

    it('should handle empty message list', () => {
      markMessageAsPending(projectId, 'msg-1');

      initializePendingMessagesFromStore(projectId, []);

      expect(getPendingMessageCount(projectId)).toBe(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle marking already pending message', () => {
      markMessageAsPending(projectId, 'msg-1');
      markMessageAsPending(projectId, 'msg-1'); // Mark again

      expect(getPendingMessageCount(projectId)).toBe(1); // Not duplicated
    });

    it('should handle marking synced message as synced again', () => {
      markMessageAsPending(projectId, 'msg-1');
      markMessageAsSynced(projectId, 'msg-1');
      markMessageAsSynced(projectId, 'msg-1'); // Sync again

      expect(getPendingMessageCount(projectId)).toBe(0); // No error
    });

    it('should clear error when clearing pending messages', () => {
      markMessageAsPending(projectId, 'msg-1');
      setSyncError(projectId, 'Error');

      clearPendingMessages(projectId);

      expect(getSyncError(projectId)).toBeUndefined();
    });
  });
});
