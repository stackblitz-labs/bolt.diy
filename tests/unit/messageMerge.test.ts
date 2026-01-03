/**
 * Unit Tests for Message Merge
 *
 * Tests the message merging functionality including:
 * - Server-only messages returned unchanged
 * - Local-only messages appended
 * - Duplicates removed by message_id
 * - Merged result sorted by sequence_num
 * - Local-only get correct sequence_num assigned
 *
 * From specs/001-load-project-messages/tasks.md (T029)
 */

import { describe, it, expect } from 'vitest';
import { mergeMessages } from '~/lib/persistence/messageMerge';
import type { Message } from 'ai';
import type { SequencedMessage } from '~/types/message-loading';
import { vi } from 'vitest';

// Mock logger
vi.mock('~/utils/logger', () => ({
  createScopedLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('Message Merge', () => {
  const createMessage = (id: string, sequenceNum: number, role: 'user' | 'assistant' = 'user'): SequencedMessage => ({
    id,
    role,
    content: `Message ${id}`,
    createdAt: new Date(Date.now() + sequenceNum * 1000) as any, // Use 'as any' for createdAt to bypass Date type check
    sequence_num: sequenceNum,
  });

  describe('Server-only messages', () => {
    it('should return server-only messages unchanged', () => {
      const serverMessages = [
        createMessage('msg-1', 1, 'user'),
        createMessage('msg-2', 2, 'assistant'),
        createMessage('msg-3', 3, 'user'),
      ];

      const result = mergeMessages(serverMessages, []);

      expect(result.messages).toHaveLength(3);
      expect(result.serverCount).toBe(3);
      expect(result.localOnlyCount).toBe(0);
      expect(result.duplicatesRemoved).toBe(0);
    });
  });

  describe('Local-only messages', () => {
    it('should return all local messages when server is empty', () => {
      const localMessages = [
        createMessage('msg-1', 1, 'user'),
        createMessage('msg-2', 2, 'assistant'),
      ];

      const result = mergeMessages([], localMessages);

      expect(result.messages).toHaveLength(2);
      expect(result.serverCount).toBe(0);
      expect(result.localOnlyCount).toBe(2);
      expect(result.duplicatesRemoved).toBe(0);
    });
  });

  describe('Duplicates removed', () => {
    it('should remove duplicates by message_id', () => {
      const serverMessages = [
        createMessage('msg-1', 1, 'user'),
        createMessage('msg-2', 2, 'assistant'),
      ];

      const localMessages = [
        createMessage('msg-1', 1, 'user'), // Duplicate
        createMessage('msg-3', 3, 'user'), // Local-only
      ];

      const result = mergeMessages(serverMessages, localMessages);

      expect(result.messages).toHaveLength(3);
      expect(result.serverCount).toBe(2);
      expect(result.localOnlyCount).toBe(1);
      expect(result.duplicatesRemoved).toBe(1);

      // Check that msg-1 appears only once (from server)
      const msg1Count = result.messages.filter((m) => m.id === 'msg-1').length;
      expect(msg1Count).toBe(1);

      // Check that msg-3 (local-only) is included
      expect(result.messages.some((m) => m.id === 'msg-3')).toBe(true);
    });

    it('should prioritize server version when message_id exists in both', () => {
      // Phase 2 requirement: server messages take precedence for deduplication
      const serverMessages = [
        createMessage('msg-1', 1, 'user'),
      ];

      const localMessages = [
        createMessage('msg-1', 99, 'user'), // Same message_id, different sequence_num
      ];

      const result = mergeMessages(serverMessages, localMessages);

      expect(result.messages).toHaveLength(1);
      expect(result.duplicatesRemoved).toBe(1);

      // Server version should be kept (sequence_num 1, not 99)
      const msg = result.messages[0] as Message & { sequence_num?: number };
      expect(msg.id).toBe('msg-1');
      expect(msg.sequence_num).toBe(1);
    });

    it('should handle multiple duplicates across server and local', () => {
      // Phase 2 requirement: dedupe by message_id preserves uniqueness
      const serverMessages = [
        createMessage('msg-1', 1, 'user'),
        createMessage('msg-2', 2, 'assistant'),
        createMessage('msg-3', 3, 'user'),
      ];

      const localMessages = [
        createMessage('msg-1', 1, 'user'), // Duplicate
        createMessage('msg-2', 2, 'assistant'), // Duplicate
        createMessage('msg-4', 4, 'user'), // Local-only
      ];

      const result = mergeMessages(serverMessages, localMessages);

      expect(result.messages).toHaveLength(4); // 3 server + 1 local-only
      expect(result.duplicatesRemoved).toBe(2);

      // Each message_id should appear exactly once
      const messageIds = result.messages.map((m) => m.id);
      const uniqueIds = new Set(messageIds);
      expect(uniqueIds.size).toBe(messageIds.length); // No duplicates
    });
  });

  describe('Sorted by sequence_num', () => {
    it('should sort merged result by sequence_num', () => {
      const serverMessages = [
        createMessage('msg-1', 1, 'user'),
        createMessage('msg-3', 3, 'assistant'),
      ];

      const localMessages = [
        createMessage('msg-2', 2, 'user'), // Local-only
      ];

      const result = mergeMessages(serverMessages, localMessages);

      expect(result.messages).toHaveLength(3);

      // Check that messages are sorted correctly
      // msg-1 has sequence_num 1, msg-3 has sequence_num 3, msg-2 (local-only) gets sequence_num 4
      const sequencedMessages = result.messages as Array<Message & { sequence_num?: number }>;

      const msg1Seq = sequencedMessages.find((m) => m.id === 'msg-1')?.sequence_num;
      const msg3Seq = sequencedMessages.find((m) => m.id === 'msg-3')?.sequence_num;
      const msg2Seq = sequencedMessages.find((m) => m.id === 'msg-2')?.sequence_num;

      expect(msg1Seq).toBe(1);
      expect(msg3Seq).toBe(3);
      expect(msg2Seq).toBe(4); // Local-only gets max server seq (3) + 1 = 4

      // Verify order in the array (should be sorted by sequence_num)
      expect(result.messages[0].id).toBe('msg-1'); // sequence_num: 1
      expect(result.messages[1].id).toBe('msg-3'); // sequence_num: 3
      expect(result.messages[2].id).toBe('msg-2'); // sequence_num: 4 (local-only)
    });
  });

  describe('Local-only sequence_num assignment', () => {
    it('should assign correct sequence_num to local-only messages', () => {
      const serverMessages = [
        createMessage('msg-1', 1, 'user'),
        createMessage('msg-2', 5, 'assistant'), // Max sequence_num is 5
      ];

      const localMessages = [
        createMessage('msg-3', 100, 'user'), // Local-only
        createMessage('msg-4', 200, 'user'), // Local-only
      ];

      const result = mergeMessages(serverMessages, localMessages);

      expect(result.messages).toHaveLength(4);

      // Local-only messages should get sequence_num = maxServerSeq + 1 + index
      // maxServerSeq = 5, so msg-3 gets 6, msg-4 gets 7
      const sequencedMessages = result.messages as Array<Message & { sequence_num?: number }>;

      const msg3 = sequencedMessages.find((m) => m.id === 'msg-3');
      const msg4 = sequencedMessages.find((m) => m.id === 'msg-4');

      expect(msg3?.sequence_num).toBe(6);
      expect(msg4?.sequence_num).toBe(7);
    });
  });

  describe('Empty inputs', () => {
    it('should handle empty server and empty local', () => {
      const result = mergeMessages([], []);

      expect(result.messages).toHaveLength(0);
      expect(result.serverCount).toBe(0);
      expect(result.localOnlyCount).toBe(0);
      expect(result.duplicatesRemoved).toBe(0);
    });

    it('should handle empty local with non-empty server', () => {
      const serverMessages = [
        createMessage('msg-1', 1, 'user'),
        createMessage('msg-2', 2, 'assistant'),
      ];

      const result = mergeMessages(serverMessages, []);

      expect(result.messages).toHaveLength(2);
      expect(result.serverCount).toBe(2);
      expect(result.localOnlyCount).toBe(0);
    });

    it('should handle empty server with non-empty local', () => {
      const localMessages = [
        createMessage('msg-1', 1, 'user'),
        createMessage('msg-2', 2, 'assistant'),
      ];

      const result = mergeMessages([], localMessages);

      expect(result.messages).toHaveLength(2);
      expect(result.serverCount).toBe(0);
      expect(result.localOnlyCount).toBe(2);
    });
  });

  describe('Complex merge scenarios', () => {
    it('should handle multiple local-only messages', () => {
      const serverMessages = [
        createMessage('msg-1', 1, 'user'),
        createMessage('msg-2', 2, 'assistant'),
        createMessage('msg-3', 3, 'user'),
      ];

      const localMessages = [
        createMessage('msg-1', 1, 'user'), // Duplicate
        createMessage('msg-4', 10, 'user'), // Local-only
        createMessage('msg-5', 20, 'assistant'), // Local-only
        createMessage('msg-2', 2, 'assistant'), // Duplicate
        createMessage('msg-6', 30, 'user'), // Local-only
      ];

      const result = mergeMessages(serverMessages, localMessages);

      // 3 server + 3 local-only = 6 total
      expect(result.messages).toHaveLength(6);
      expect(result.serverCount).toBe(3);
      expect(result.localOnlyCount).toBe(3);
      expect(result.duplicatesRemoved).toBe(2); // msg-1 and msg-2 duplicates
    });

    it('should preserve message order with ties', () => {
      const serverMessages = [
        createMessage('msg-1', 1, 'user'),
        createMessage('msg-2', 1, 'assistant'), // Same sequence_num
      ];

      const localMessages = [
        createMessage('msg-3', 2, 'user'),
      ];

      const result = mergeMessages(serverMessages, localMessages);

      expect(result.messages).toHaveLength(3);
      // First two have same sequence_num, sorted by createdAt
      expect(result.messages[0].id).toBe('msg-1');
      expect(result.messages[1].id).toBe('msg-2');
      expect(result.messages[2].id).toBe('msg-3'); // Local-only gets sequence_num 2
    });
  });

  describe('Return type', () => {
    it('should return correct MergeResult structure', () => {
      const serverMessages = [createMessage('msg-1', 1, 'user')];
      const localMessages = [createMessage('msg-2', 2, 'user')];

      const result = mergeMessages(serverMessages, localMessages);

      expect(result).toHaveProperty('messages');
      expect(result).toHaveProperty('serverCount');
      expect(result).toHaveProperty('localOnlyCount');
      expect(result).toHaveProperty('duplicatesRemoved');
      expect(Array.isArray(result.messages)).toBe(true);
      expect(typeof result.serverCount).toBe('number');
      expect(typeof result.localOnlyCount).toBe('number');
      expect(typeof result.duplicatesRemoved).toBe('number');
    });
  });
});
