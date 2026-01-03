/**
 * Unit Tests for Message Loader
 *
 * Tests the paginated message loading functionality including:
 * - Sequential page fetching
 * - Rate limiting with exponential backoff
 * - Partial result handling
 * - Progress callback reporting
 * - Empty response handling
 *
 * From specs/001-load-project-messages/tasks.md (T009)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchMessagePage } from '~/lib/persistence/messageLoader';
import type { ProjectMessage } from '~/types/project';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Helper to create mock Response
function createMockResponse(data: { messages: ProjectMessage[]; total: number } | { message: string }, status: number): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  } as Response;
}

describe('Message Loader', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    mockFetch.mockClear();
    vi.useRealTimers();
  });

  describe('fetchMessagePage', () => {
    it('should fetch a single page of messages successfully', async () => {
      const mockMessages: ProjectMessage[] = [
        {
          id: '1',
          project_id: 'project-123',
          message_id: 'msg-1',
          sequence_num: 1,
          role: 'user',
          content: 'Hello',
          annotations: null,
          created_at: '2024-01-01T00:00:00Z',
        },
        {
          id: '2',
          project_id: 'project-123',
          message_id: 'msg-2',
          sequence_num: 2,
          role: 'assistant',
          content: 'Hi there!',
          annotations: null,
          created_at: '2024-01-01T00:01:00Z',
        },
      ];

      mockFetch.mockResolvedValueOnce(createMockResponse({ messages: mockMessages, total: 10 }, 200));

      const result = await fetchMessagePage('project-123', 0, 2);

      expect(result.messages).toEqual(mockMessages);
      expect(result.total).toBe(10);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/projects/project-123/messages?limit=2&offset=0&order=asc',
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    });

    it('should return empty messages array for 404 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({}),
      } as Response);

      const result = await fetchMessagePage('project-123', 0, 10, 'asc');

      expect(result.messages).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should throw error for non-2xx responses', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ message: 'Unauthorized' }, 401));

      await expect(fetchMessagePage('project-123', 0, 10, 'asc')).rejects.toThrow('Unauthorized');
    });

    it('should throw error for 500 server error', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ message: 'Internal Server Error' }, 500));

      await expect(fetchMessagePage('project-123', 0, 10)).rejects.toThrow('Internal Server Error');
    });
  });

  describe('loadAllMessages integration tests', () => {
    it('should fetch all pages sequentially', async () => {
      // Mock 3 pages of messages (300 total)
      mockFetch
        .mockResolvedValueOnce(createMockResponse({
          messages: createMockMessages(100, 'msg-1'),
          total: 300,
        }, 200))
        .mockResolvedValueOnce(createMockResponse({
          messages: createMockMessages(100, 'msg-101'),
          total: 300,
        }, 200))
        .mockResolvedValueOnce(createMockResponse({
          messages: createMockMessages(100, 'msg-201'),
          total: 300,
        }, 200));

      const { loadAllMessages } = await import('~/lib/persistence/messageLoader');
      const progressCallback = vi.fn();

      const result = await loadAllMessages('project-123', {
        pageSize: 100,
        maxRetries: 3,
        onProgress: progressCallback,
      });

      expect(result.messages).toHaveLength(300);
      expect(result.total).toBe(300);
      expect(result.isPartial).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(3);

      // Verify progress callback was called 3 times (once per page)
      expect(progressCallback).toHaveBeenCalledTimes(3);

      // Verify first progress call
      expect(progressCallback).toHaveBeenNthCalledWith(1, {
        loaded: 100,
        total: 300,
        page: 1,
        isComplete: false,
        isRateLimited: false,
      });

      // Verify last progress call indicates completion
      expect(progressCallback).toHaveBeenLastCalledWith({
        loaded: 300,
        total: 300,
        page: 3,
        isComplete: true,
        isRateLimited: false,
      });
    });

    it('should handle 429 rate limiting with exponential backoff', async () => {
      // First request: rate limited (no json method)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({}),
      } as Response);

      // Retry after backoff: success
      mockFetch.mockResolvedValueOnce(createMockResponse({
        messages: createMockMessages(50, 'msg-1'),
        total: 50,
      }, 200));

      const { loadAllMessages } = await import('~/lib/persistence/messageLoader');
      const progressCallback = vi.fn();

      // Start the load but don't await yet
      const loadPromise = loadAllMessages('project-123', {
        pageSize: 50,
        maxRetries: 3,
        baseDelay: 100,
        maxDelay: 1000,
        onProgress: progressCallback,
      });

      // Fast forward through timers
      await vi.runAllTimersAsync();

      const result = await loadPromise;

      expect(result.messages).toHaveLength(50);
      expect(result.isPartial).toBe(false);

      // Verify rate limited flag in progress callback
      const rateLimitedCall = progressCallback.mock.calls.find((call) => call[0].isRateLimited === true);
      expect(rateLimitedCall).toBeDefined();
    });

    it('should handle empty response (0 messages)', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ messages: [], total: 0 }, 200));

      const { loadAllMessages } = await import('~/lib/persistence/messageLoader');

      const result = await loadAllMessages('project-123', {
        pageSize: 100,
        maxRetries: 3,
      });

      // When total is 0, we should return immediately with no messages
      expect(result.messages).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.isPartial).toBe(false);
    });

    it('should throw non-retryable errors immediately', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ message: 'Unauthorized' }, 401));

      const { loadAllMessages } = await import('~/lib/persistence/messageLoader');

      await expect(
        loadAllMessages('project-123', {
          pageSize: 100,
          maxRetries: 3,
        }),
      ).rejects.toThrow('Unauthorized');

      // Should only make one request, no retries
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});

/**
 * Helper function to create mock messages
 */
function createMockMessages(count: number, idPrefix: string): ProjectMessage[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `db-${idPrefix}-${i}`,
    project_id: 'project-123',
    message_id: `${idPrefix}-${i}`,
    sequence_num: i + 1,
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `Message ${i + 1}`,
    annotations: null,
    created_at: new Date(Date.now() + i * 1000).toISOString(),
  }));
}
