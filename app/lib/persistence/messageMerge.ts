/**
 * Message Merge Module
 *
 * Merges server and local messages, deduplicating by message_id.
 * Server messages take precedence; local-only messages are appended.
 *
 * From specs/001-load-project-messages/tasks.md (T025)
 */

import type { Message } from 'ai';
import type { MergeResult, SequencedMessage } from '~/types/message-loading';
import { createScopedLogger } from '~/utils/logger';
import { isMessageEmpty } from './messageValidation';

const logger = createScopedLogger('MessageMerge');

/**
 * Merge server and local messages.
 *
 * Deduplicates by message_id (UUID), with server messages taking precedence.
 * Local-only messages not found on server are appended at the end.
 * Result is sorted by sequence_num, with local-only messages assigned new sequence numbers.
 *
 * @param serverMessages - Messages from the server (source of truth)
 * @param localMessages - Messages from IndexedDB local cache
 * @returns Merge result with merged messages and statistics
 *
 * @example
 * ```ts
 * const server = [
 *   { id: 'msg-1', sequence_num: 1, role: 'user', content: 'Hello' },
 *   { id: 'msg-2', sequence_num: 2, role: 'assistant', content: 'Hi' }
 * ];
 *
 * const local = [
 *   { id: 'msg-1', sequence_num: 1, role: 'user', content: 'Hello' },
 *   { id: 'msg-3', sequence_num: 3, role: 'user', content: 'New local message' }
 * ];
 *
 * const result = mergeMessages(server, local);
 * // result.messages = [
 * //   { id: 'msg-1', sequence_num: 1, ... },
 * //   { id: 'msg-2', sequence_num: 2, ... },
 * //   { id: 'msg-3', sequence_num: 3, ... }  // Local-only appended
 * // ]
 * // result.serverCount = 2
 * // result.localOnlyCount = 1
 * // result.duplicatesRemoved = 1
 * ```
 */
export function mergeMessages(serverMessages: Message[], localMessages: Message[]): MergeResult {
  logger.debug('Merging messages', {
    serverCount: serverMessages.length,
    localCount: localMessages.length,
  });

  // Filter out messages with empty content from both sources before merging
  const validServerMessages = serverMessages.filter((msg) => !isMessageEmpty(msg));
  const validLocalMessages = localMessages.filter((msg) => !isMessageEmpty(msg));

  if (validServerMessages.length < serverMessages.length) {
    logger.warn('Filtered out empty server messages', {
      total: serverMessages.length,
      valid: validServerMessages.length,
      filtered: serverMessages.length - validServerMessages.length,
    });
  }

  if (validLocalMessages.length < localMessages.length) {
    logger.warn('Filtered out empty local messages', {
      total: localMessages.length,
      valid: validLocalMessages.length,
      filtered: localMessages.length - validLocalMessages.length,
    });
  }

  // Build Set of server message IDs for O(1) lookup
  const serverMessageIds = new Set(validServerMessages.map((msg) => msg.id));

  // Filter local messages that are not in server set (local-only)
  const localOnlyMessages = validLocalMessages.filter((msg) => !serverMessageIds.has(msg.id));

  logger.debug('Local-only messages found', {
    count: localOnlyMessages.length,
    messageIds: localOnlyMessages.map((msg) => msg.id),
  });

  // Find maximum sequence_num from server messages
  const maxServerSequence = validServerMessages.reduce((max, msg) => {
    const seq = (msg as SequencedMessage).sequence_num ?? 0;
    return Math.max(max, seq);
  }, 0);

  // Assign sequence_num to local-only messages (max + 1 + index)
  const localOnlyWithSequence = localOnlyMessages.map((msg, index) => ({
    ...msg,
    sequence_num: maxServerSequence + 1 + index,
  }));

  // Concatenate: server messages + local-only messages
  const merged = [...validServerMessages, ...localOnlyWithSequence] as SequencedMessage[];

  // Sort merged result by sequence_num
  const sortedMerged = merged.sort((a, b) => {
    const aSeq = a.sequence_num ?? Number.MAX_SAFE_INTEGER;
    const bSeq = b.sequence_num ?? Number.MAX_SAFE_INTEGER;

    if (aSeq !== bSeq) {
      return aSeq - bSeq;
    }

    // Secondary sort by createdAt for ties
    const aTime = new Date(a.createdAt ?? 0).getTime();
    const bTime = new Date(b.createdAt ?? 0).getTime();

    return aTime - bTime;
  });

  const result: MergeResult = {
    messages: sortedMerged,
    serverCount: validServerMessages.length,
    localOnlyCount: localOnlyMessages.length,
    duplicatesRemoved: validLocalMessages.length - localOnlyMessages.length,
  };

  logger.info('Messages merged successfully', {
    serverCount: result.serverCount,
    localOnlyCount: result.localOnlyCount,
    duplicatesRemoved: result.duplicatesRemoved,
    totalMerged: result.messages.length,
  });

  return result;
}

// Re-export isMessageHidden from messageValidation to avoid ambiguity
export { isMessageHidden } from './messageValidation';
