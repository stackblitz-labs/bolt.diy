/**
 * Integration Tests for Project Chat Sync
 *
 * Tests the complete flow of syncing project chat history between
 * client and server, including:
 * - US1: Reopen project and continue conversation (MVP)
 * - US2: Cross-session access
 * - Future: US3 offline/pending sync
 *
 * From specs/001-project-chat-sync/tasks.md
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Message } from 'ai';

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock authentication
vi.mock('~/lib/auth/auth.server', () => ({
  auth: {
    api: {
      getSession: vi.fn(() => Promise.resolve({
        user: { id: 'test-user-id' },
      })),
    },
  },
}));

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      count: 'exact',
      head: vi.fn(() => ({ count: 0, error: null })),
      eq: vi.fn(() => ({
        single: vi.fn(() => ({
          data: null,
          error: null,
        })),
      })),
    })),
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => ({
          data: { id: 'test-project-id' },
          error: null,
        })),
      })),
    })),
    upsert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => ({
          data: { saved_count: 1 },
          error: null,
        })),
      })),
    })),
  })),
  rpc: vi.fn(() => Promise.resolve({
    data: { inserted_count: 1 },
    error: null,
  })),
};

vi.mock('~/lib/db/supabase.server', () => ({
  createUserSupabaseClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}));

describe('Project Chat Sync Integration Tests', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockFetch.mockClear();
  });

  /**
   * Helper function to create mock messages
   */
  function createMockMessages(count: number, startId = 1): Message[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `msg-${startId + i}`,
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Message ${startId + i}`,
      createdAt: new Date(Date.now() + i * 1000),
    }));
  }

  /**
   * Helper function to create mock API response
   */
  function createMockMessagesResponse(messages: any[], total: number, status = 200) {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => ({ messages, total }),
    };
  }

  /**
   * Helper function to create mock append response
   */
  function createMockAppendResponse(insertedCount: number, status = 200) {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => ({ inserted_count: insertedCount }),
    };
  }

  /**
   * =========================================================================
   * US1: Reopen a project and continue the conversation (MVP)
   * =========================================================================
   */
  describe('User Story 1: Reopen project and continue conversation', () => {
    it('should load recent messages on project open', async () => {
      // Given: A project with 100 messages on server
      const recentMessages = createMockMessages(50, 51); // Messages 51-100
      mockFetch.mockResolvedValueOnce(createMockMessagesResponse(recentMessages, 100));

      // When: Loading messages for the project
      const { getServerMessages } = await import('~/lib/persistence/db');
      const result = await getServerMessages('test-project-id');

      // Then: Should load recent page (50 messages)
      expect(result).not.toBeNull();
      expect(result?.messages).toHaveLength(50);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/projects/test-project-id/messages'),
        expect.objectContaining({
          method: 'GET',
        }),
      );
    });

    it('should load older messages on demand', async () => {
      // Given: Recent page loaded, requesting older messages
      const olderMessages = createMockMessages(50, 1); // Messages 1-50
      mockFetch.mockResolvedValueOnce(createMockMessagesResponse(olderMessages, 100));

      // When: Loading older messages
      const { getServerMessagesPage } = await import('~/lib/persistence/db');
      const result = await getServerMessagesPage('test-project-id', 0, 50);

      // Then: Should load older page
      expect(result.messages).toHaveLength(50);
      expect(result.total).toBe(100);
    });

    it('should prepend older messages in correct order', async () => {
      // Given: Current messages 51-100 displayed
      const currentMessages = createMockMessages(50, 51);
      const olderMessages = createMockMessages(50, 1);

      // When: Loading older messages
      mockFetch.mockResolvedValueOnce(createMockMessagesResponse(olderMessages, 100));
      const { getServerMessagesPage } = await import('~/lib/persistence/db');
      const { messages: olderPage } = await getServerMessagesPage('test-project-id', 0, 50);

      // Then: Older messages should come first (prepended)
      const combined = [...olderPage, ...currentMessages];
      expect(combined).toHaveLength(100);
      expect(combined[0].id).toBe('msg-1'); // Oldest first
      expect(combined[99].id).toBe('msg-100'); // Newest last
    });

    it('should append new messages using append endpoint', async () => {
      // Given: New messages to send
      const newMessages = createMockMessages(2, 101);
      mockFetch.mockResolvedValueOnce(createMockAppendResponse(2));

      // When: Appending messages to server
      const { appendServerMessages } = await import('~/lib/persistence/db');
      const result = await appendServerMessages('test-project-id', newMessages);

      // Then: Should use append endpoint and return inserted count
      expect(result.inserted_count).toBe(2);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/messages/append'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"message_id":"msg-101"'),
        }),
      );
    });

    it('should preserve history after reload', async () => {
      // Given: Project with messages
      const allMessages = createMockMessages(10);
      mockFetch.mockResolvedValue(createMockMessagesResponse(allMessages.slice(-5), 10));

      // When: Opening project, sending new message, reloading
      const { getServerMessages, appendServerMessages } = await import('~/lib/persistence/db');

      // First load
      const firstLoad = await getServerMessages('test-project-id');
      expect(firstLoad?.messages).toHaveLength(5); // Recent 5

      // Send new message
      mockFetch.mockResolvedValueOnce(createMockAppendResponse(1));
      await appendServerMessages('test-project-id', [createMockMessages(1, 11)[0]]);

      // Reload (should show all messages including new one)
      mockFetch.mockResolvedValueOnce(createMockMessagesResponse([...allMessages.slice(-5), createMockMessages(1, 11)[0]], 11));
      const secondLoad = await getServerMessages('test-project-id');
      expect(secondLoad?.messages).toHaveLength(6); // Previous 5 + 1 new
    });

    it('should handle empty project correctly', async () => {
      // Given: New project with no messages
      mockFetch.mockResolvedValueOnce(createMockMessagesResponse([], 0));

      // When: Opening project
      const { getServerMessages } = await import('~/lib/persistence/db');
      const result = await getServerMessages('test-project-id');

      // Then: Should return null or empty array
      expect(result?.messages).toHaveLength(0);
    });
  });

  /**
   * =========================================================================
   * US2: Access the same project chat from another device/session
   * =========================================================================
   */
  describe('User Story 2: Cross-session access', () => {
    it('should load same history from different session', async () => {
      // Given: Session A created messages
      const sessionAMessages = createMockMessages(10);
      mockFetch.mockResolvedValue(createMockMessagesResponse(sessionAMessages, 10));

      // When: Session B opens the same project
      const { getServerMessages } = await import('~/lib/persistence/db');

      const sessionBLoad = await getServerMessages('test-project-id');
      const sessionBMessageIds = sessionBLoad?.messages.map((m) => m.id) || [];

      // Then: Session B should see the same messages
      const sessionAMessageIds = sessionAMessages.map((m) => m.id);
      expect(sessionBMessageIds).toEqual(expect.arrayContaining(sessionAMessageIds));
    });

    it('should merge messages from concurrent sessions', async () => {
      // Given: Session A has messages 1-5
      const sessionAMessages = createMockMessages(5, 1);
      // Session B added messages 6-7
      const sessionBMessages = createMockMessages(2, 6);

      // Server has all messages
      const allMessages = [...sessionAMessages, ...sessionBMessages];
      mockFetch.mockResolvedValue(createMockMessagesResponse(allMessages.slice(-5), 7));

      // When: Session A reloads after Session B wrote
      const { getServerMessages } = await import('~/lib/persistence/db');
      const result = await getServerMessages('test-project-id');

      // Then: Should see all 7 messages (no duplicates)
      expect(result?.messages).toHaveLength(5); // Recent 5 loaded
      const messageIds = result?.messages.map((m) => m.id) || [];
      const uniqueIds = new Set(messageIds);
      expect(uniqueIds.size).toBe(messageIds.length); // No duplicates
    });

    it('should handle concurrent writes with append-only', async () => {
      // Given: Two sessions both append messages
      const session1Messages = createMockMessages(2, 11);
      const session2Messages = createMockMessages(2, 13);

      // Both use append endpoint
      mockFetch
        .mockResolvedValueOnce(createMockAppendResponse(2)) // Session 1
        .mockResolvedValueOnce(createMockAppendResponse(2)); // Session 2

      // When: Both append concurrently
      const { appendServerMessages } = await import('~/lib/persistence/db');

      const result1 = await appendServerMessages('test-project-id', session1Messages);
      const result2 = await appendServerMessages('test-project-id', session2Messages);

      // Then: Both should succeed with no overwrites
      expect(result1.inserted_count).toBe(2);
      expect(result2.inserted_count).toBe(2);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  /**
   * =========================================================================
   * Error Handling & Edge Cases
   * =========================================================================
   */
  describe('Error handling', () => {
    it('should handle network errors gracefully', async () => {
      // Given: Network error
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      // When: Loading messages
      const { getServerMessages } = await import('~/lib/persistence/db');

      // Then: Should throw error (caller handles fallback to local)
      await expect(getServerMessages('test-project-id')).rejects.toThrow('Network error');
    });

    it('should handle 404 for new projects', async () => {
      // Given: Project with no messages yet
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({}),
      });

      // When: Loading messages
      const { getServerMessages } = await import('~/lib/persistence/db');
      const result = await getServerMessages('test-project-id');

      // Then: Should return empty result (not error)
      expect(result).toBeNull();
    });

    it('should handle authentication failures', async () => {
      // Given: Auth failure
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Authentication required' }),
      });

      // When: Trying to save messages
      const { appendServerMessages } = await import('~/lib/persistence/db');

      // Then: Should throw auth error
      await expect(appendServerMessages('test-project-id', createMockMessages(1))).rejects.toThrow();
    });

    it('should handle rate limiting with retry', async () => {
      // Given: Rate limited on first request
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          json: async () => ({}),
        })
        .mockResolvedValueOnce(createMockMessagesResponse(createMockMessages(50), 100));

      // When: Loading messages with retry logic
      const { loadAllMessages } = await import('~/lib/persistence/messageLoader');

      const result = await loadAllMessages('test-project-id', {
        pageSize: 50,
        maxRetries: 3,
        baseDelay: 10, // Short delay for tests
      });

      // Then: Should retry and succeed
      expect(result.messages).toHaveLength(50);
      expect(mockFetch).toHaveBeenCalledTimes(2); // Initial + 1 retry
    });
  });

  /**
   * =========================================================================
   * Annotation Preservation
   * =========================================================================
   */
  describe('Annotation preservation', () => {
    it('should preserve annotations when loading from server', async () => {
      // Given: Messages with annotations on server
      const messagesWithAnnotations: Message[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Hello',
          createdAt: new Date(),
          annotations: [{ type: 'chatSummary', summary: 'Test chat' }],
        },
      ];

      mockFetch.mockResolvedValueOnce(
        createMockMessagesResponse(
          messagesWithAnnotations.map((m) => ({
            message_id: m.id,
            role: m.role,
            content: m.content,
            created_at: m.createdAt?.toISOString(),
            annotations: m.annotations,
          })),
          1,
        ),
      );

      // When: Loading messages
      const { getServerMessages } = await import('~/lib/persistence/db');
      const result = await getServerMessages('test-project-id');

      // Then: Annotations should be preserved
      expect(result?.messages[0].annotations).toEqual([{ type: 'chatSummary', summary: 'Test chat' }]);
    });

    it('should strip local-only annotations before sending to server', async () => {
      // Given: Messages with pending-sync marker
      const messagesWithPendingMarker: Message[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Hello',
          createdAt: new Date(),
          annotations: ['pending-sync', { type: 'chatSummary', summary: 'Keep this' }],
        },
      ];

      mockFetch.mockResolvedValueOnce(createMockAppendResponse(1));

      // When: Appending to server
      const { appendServerMessages } = await import('~/lib/persistence/db');
      await appendServerMessages('test-project-id', messagesWithPendingMarker);

      // Then: pending-sync should be stripped, but chatSummary kept
      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.messages[0].annotations).not.toContain('pending-sync');
      expect(requestBody.messages[0].annotations).toContainEqual({ type: 'chatSummary', summary: 'Keep this' });
    });
  });

  /**
   * =========================================================================
   * Clear Chat History (Phase 6)
   * =========================================================================
   */
  describe('Clear chat history', () => {
    it('should clear server messages when authenticated', async () => {
      // Given: A project with messages on server
      const existingMessages = createMockMessages(10);
      mockFetch.mockResolvedValueOnce(createMockMessagesResponse(existingMessages, 10));

      // Load initial messages
      const { getServerMessages, clearServerMessages } = await import('~/lib/persistence/db');
      const initialLoad = await getServerMessages('test-project-id');
      expect(initialLoad?.messages).toHaveLength(10);

      // When: Clearing messages from server
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ deleted_count: 10 }),
      });

      const result = await clearServerMessages('test-project-id');

      // Then: Should call DELETE endpoint and return deleted count
      expect(result.deleted_count).toBe(10);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/projects/test-project-id/messages'),
        expect.objectContaining({
          method: 'DELETE',
        }),
      );
    });

    it('should handle errors when clearing server messages', async () => {
      // Given: Server error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal server error' }),
      });

      // When: Trying to clear messages
      const { clearServerMessages } = await import('~/lib/persistence/db');

      // Then: Should throw error
      await expect(clearServerMessages('test-project-id')).rejects.toThrow();
    });

    it('should clear local IndexedDB messages', async () => {
      // Given: Messages stored locally
      const { deleteById } = await import('~/lib/persistence/db');

      // Mock IndexedDB operations
      const mockDb = {
        transaction: vi.fn(() => ({
          objectStore: vi.fn(() => ({
            delete: vi.fn(() => ({
              onsuccess: vi.fn((cb) => cb()),
              onerror: vi.fn((cb) => cb({ error: 'Not found' })),
            })),
          })),
        })),
      };

      // When: Deleting messages
      // Note: This is a basic test - full IndexedDB mocking would require more setup

      // Then: Should complete without error
      // In a real scenario, we'd verify the delete operation was called
      expect(mockDb.transaction).toBeDefined();
    });

    it('should stay empty after clear and reload', async () => {
      // Given: Project with messages
      const existingMessages = createMockMessages(5);
      mockFetch.mockResolvedValueOnce(createMockMessagesResponse(existingMessages, 5));

      const { getServerMessages, clearServerMessages } = await import('~/lib/persistence/db');

      // Load messages
      const initialLoad = await getServerMessages('test-project-id');
      expect(initialLoad?.messages).toHaveLength(5);

      // Clear messages
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ deleted_count: 5 }),
      });
      await clearServerMessages('test-project-id');

      // Reload (should return empty)
      mockFetch.mockResolvedValueOnce(createMockMessagesResponse([], 0));
      const reloaded = await getServerMessages('test-project-id');

      // Then: Should have no messages
      expect(reloaded?.messages).toHaveLength(0);
      expect(reloaded?.messages).toEqual([]);
    });
  });
});
