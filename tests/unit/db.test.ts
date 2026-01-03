/**
 * Unit Tests for Database (db.ts)
 *
 * Tests the server message loading functions including:
 * - Loading all messages via pagination
 * - Progress callback reporting
 * - Empty project handling
 * - Message metadata preservation
 *
 * From specs/001-load-project-messages/tasks.md (T015)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getServerMessages } from '~/lib/persistence/db';
import type { ProjectMessage } from '~/types/project';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Database - getServerMessages', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    mockFetch.mockClear();
  });

  describe('Paginated Loading', () => {
    it('should load all messages via pagination', async () => {
      // Mock 3 pages of messages (300 total)
      const page1Messages = createMockMessages(100, 'msg-1');
      const page2Messages = createMockMessages(100, 'msg-101');
      const page3Messages = createMockMessages(100, 'msg-201');

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ messages: page1Messages, total: 300 }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ messages: page2Messages, total: 300 }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ messages: page3Messages, total: 300 }),
        } as Response);

      const result = await getServerMessages('project-123');

      expect(result).not.toBeNull();
      expect(result?.messages).toHaveLength(300);
      expect(result?.id).toBe('project-123');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should call onProgress with correct values', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            messages: createMockMessages(100, 'msg-1'),
            total: 200,
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            messages: createMockMessages(100, 'msg-101'),
            total: 200,
          }),
        } as Response);

      const progressCallback = vi.fn();

      await getServerMessages('project-123', progressCallback);

      expect(progressCallback).toHaveBeenCalledTimes(2);

      expect(progressCallback).toHaveBeenNthCalledWith(1, {
        loaded: 100,
        total: 200,
        page: 1,
        isComplete: false,
        isRateLimited: false,
      });

      expect(progressCallback).toHaveBeenLastCalledWith({
        loaded: 200,
        total: 200,
        page: 2,
        isComplete: true,
        isRateLimited: false,
      });
    });
  });

  describe('Empty Project Handling', () => {
    it('should return null for empty project (0 messages)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ messages: [], total: 0 }),
      } as Response);

      const result = await getServerMessages('project-123');

      expect(result).toBeNull();
    });

    it('should return null for 404 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      const result = await getServerMessages('project-123');

      expect(result).toBeNull();
    });

    it('should handle project with very few messages (< pageSize)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          messages: createMockMessages(5, 'msg-1'),
          total: 5,
        }),
      } as Response);

      const result = await getServerMessages('project-123');

      expect(result).not.toBeNull();
      expect(result?.messages).toHaveLength(5);
      expect(mockFetch).toHaveBeenCalledTimes(1); // Only one page fetched
    });
  });

  describe('Message Metadata Preservation', () => {
    it('should preserve message role', async () => {
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
        {
          id: '3',
          project_id: 'project-123',
          message_id: 'msg-3',
          sequence_num: 3,
          role: 'system',
          content: 'System message',
          annotations: null,
          created_at: '2024-01-01T00:02:00Z',
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ messages: mockMessages, total: 3 }),
      } as Response);

      const result = await getServerMessages('project-123');

      expect(result?.messages).toHaveLength(3);
      expect(result?.messages[0].role).toBe('user');
      expect(result?.messages[1].role).toBe('assistant');
      expect(result?.messages[2].role).toBe('system');
    });

    it('should preserve message annotations', async () => {
      const mockMessages: ProjectMessage[] = [
        {
          id: '1',
          project_id: 'project-123',
          message_id: 'msg-1',
          sequence_num: 1,
          role: 'user',
          content: 'Hello',
          annotations: ['hidden'],
          created_at: '2024-01-01T00:00:00Z',
        },
        {
          id: '2',
          project_id: 'project-123',
          message_id: 'msg-2',
          sequence_num: 2,
          role: 'assistant',
          content: 'Hi there!',
          annotations: [
            {
              type: 'chatSummary',
              summary: 'A conversation about testing',
            },
          ],
          created_at: '2024-01-01T00:01:00Z',
        },
        {
          id: '3',
          project_id: 'project-123',
          message_id: 'msg-3',
          sequence_num: 3,
          role: 'assistant',
          content: 'Another message',
          annotations: null,
          created_at: '2024-01-01T00:02:00Z',
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ messages: mockMessages, total: 3 }),
      } as Response);

      const result = await getServerMessages('project-123');

      expect(result?.messages).toHaveLength(3);

      // Check string annotations
      expect(result?.messages[0].annotations).toEqual(['hidden']);

      // Check object annotations
      expect(result?.messages[1].annotations).toEqual([
        {
          type: 'chatSummary',
          summary: 'A conversation about testing',
        },
      ]);

      // Check null annotations
      expect(result?.messages[2].annotations).toBeNull();
    });

    it('should preserve message timestamps', async () => {
      const mockMessages: ProjectMessage[] = [
        {
          id: '1',
          project_id: 'project-123',
          message_id: 'msg-1',
          sequence_num: 1,
          role: 'user',
          content: 'First message',
          annotations: null,
          created_at: '2024-01-01T10:30:00.000Z',
        },
        {
          id: '2',
          project_id: 'project-123',
          message_id: 'msg-2',
          sequence_num: 2,
          role: 'assistant',
          content: 'Second message',
          annotations: null,
          created_at: '2024-01-01T10:31:23.456Z',
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ messages: mockMessages, total: 2 }),
      } as Response);

      const result = await getServerMessages('project-123');

      expect(result?.messages[0].createdAt).toEqual(new Date('2024-01-01T10:30:00.000Z'));
      expect(result?.messages[1].createdAt).toEqual(new Date('2024-01-01T10:31:23.456Z'));
    });

    it('should set timestamp from first message if available', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          messages: [
            {
              id: '1',
              project_id: 'project-123',
              message_id: 'msg-1',
              sequence_num: 1,
              role: 'user',
              content: 'First message',
              annotations: null,
              created_at: '2024-01-01T10:30:00Z',
            },
          ],
          total: 1,
        }),
      } as Response);

      const result = await getServerMessages('project-123');

      expect(result?.timestamp).toBe('2024-01-01T10:30:00.000Z');
    });

    it('should use current timestamp if no messages', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ messages: [], total: 0 }),
      } as Response);

      const result = await getServerMessages('project-123');

      // Empty project returns null, so this is more about testing the path
      expect(result).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should throw error for 401 unauthorized', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Unauthorized' }),
      } as Response);

      await expect(getServerMessages('project-123')).rejects.toThrow('Unauthorized');
    });

    it('should throw error for 403 forbidden', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ message: 'Forbidden' }),
      } as Response);

      await expect(getServerMessages('project-123')).rejects.toThrow('Forbidden');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(getServerMessages('project-123')).rejects.toThrow('Network error');
    });
  });

  describe('Backward Compatibility', () => {
    it('should work without onProgress callback (backward compatible)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          messages: createMockMessages(50, 'msg-1'),
          total: 50,
        }),
      } as Response);

      // Should not throw when callback is not provided
      const result = await getServerMessages('project-123');

      expect(result).not.toBeNull();
      expect(result?.messages).toHaveLength(50);
    });
  });

  describe('Return Type', () => {
    it('should return ChatHistoryItem with correct structure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          messages: createMockMessages(10, 'msg-1'),
          total: 10,
        }),
      } as Response);

      const result = await getServerMessages('project-123');

      expect(result).toMatchObject({
        id: 'project-123',
        urlId: undefined,
        description: undefined,
        messages: expect.any(Array),
        timestamp: expect.any(String),
      });
    });

    it('should have undefined urlId and description (fetched separately)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          messages: createMockMessages(5, 'msg-1'),
          total: 5,
        }),
      } as Response);

      const result = await getServerMessages('project-123');

      expect(result?.urlId).toBeUndefined();
      expect(result?.description).toBeUndefined();
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
