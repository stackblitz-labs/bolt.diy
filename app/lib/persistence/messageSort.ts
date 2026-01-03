/**
 * Message Sorting Utility
 *
 * Functions for sorting messages by sequence number and timestamps.
 * From specs/001-load-project-messages/data-model.md
 */

import type { Message } from 'ai';

/**
 * Extended Message interface that includes sequence_num.
 * This is used when messages are loaded from the server with sequence information.
 */
export interface SequencedMessage extends Message {
  sequence_num?: number;
}

/**
 * Compare two messages for sorting by sequence number.
 *
 * Primary sort: sequence_num (ascending)
 * Secondary sort: createdAt timestamp (ascending) for ties
 *
 * @param a - First message
 * @param b - Second message
 * @returns Negative if a < b, positive if a > b, 0 if equal
 */
function compareMessages(a: SequencedMessage, b: SequencedMessage): number {
  // Primary sort by sequence_num
  const aSeq = a.sequence_num ?? Number.MAX_SAFE_INTEGER;
  const bSeq = b.sequence_num ?? Number.MAX_SAFE_INTEGER;

  if (aSeq !== bSeq) {
    return aSeq - bSeq;
  }

  // Secondary sort by createdAt timestamp for messages with same sequence
  const aTime = new Date(a.createdAt ?? 0).getTime();
  const bTime = new Date(b.createdAt ?? 0).getTime();

  return aTime - bTime;
}

/**
 * Sort messages by sequence number and timestamp.
 *
 * Messages without sequence_num are placed at the end.
 * Messages with the same sequence_num are sorted by createdAt.
 *
 * @param messages - Array of messages to sort
 * @returns New array with messages sorted in ascending order
 *
 * @example
 * ```ts
 * const messages = [
 *   { id: '3', sequence_num: 3, createdAt: '2024-01-03' },
 *   { id: '1', sequence_num: 1, createdAt: '2024-01-01' },
 *   { id: '2', sequence_num: 2, createdAt: '2024-01-02' },
 * ];
 *
 * const sorted = sortMessagesBySequence(messages);
 * // [{ id: '1', sequence_num: 1 }, { id: '2', sequence_num: 2 }, { id: '3', sequence_num: 3 }]
 * ```
 */
export function sortMessagesBySequence(messages: SequencedMessage[]): SequencedMessage[] {
  // Create a copy to avoid mutating the original array
  return [...messages].sort(compareMessages);
}

/**
 * Sort standard AI SDK Messages by createdAt timestamp.
 *
 * This is used when sequence_num is not available.
 *
 * @param messages - Array of messages to sort
 * @returns New array with messages sorted by createdAt ascending
 */
export function sortMessagesByTimestamp(messages: Message[]): Message[] {
  return [...messages].sort((a, b) => {
    const aTime = new Date(a.createdAt ?? 0).getTime();
    const bTime = new Date(b.createdAt ?? 0).getTime();

    return aTime - bTime;
  });
}

/**
 * Assign sequence numbers to messages that don't have them.
 *
 * Messages without sequence_num are assigned values starting from maxSequence + 1.
 *
 * @param messages - Array of messages (may have missing sequence_num)
 * @returns Array with all messages having sequence_num assigned
 */
export function assignSequenceNumbers(messages: SequencedMessage[]): SequencedMessage[] {
  // Find the maximum sequence number
  const maxSequence = messages.reduce((max, msg) => {
    return Math.max(max, msg.sequence_num ?? 0);
  }, 0);

  // Assign sequence numbers to messages that don't have them
  let nextSequence = maxSequence + 1;

  return messages.map((msg) => {
    if (msg.sequence_num === undefined) {
      return { ...msg, sequence_num: nextSequence++ };
    }

    return msg;
  });
}

/**
 * Check if messages are already sorted.
 *
 * @param messages - Array of messages to check
 * @returns True if messages are sorted by sequence_num
 */
export function isSortedBySequence(messages: SequencedMessage[]): boolean {
  for (let i = 1; i < messages.length; i++) {
    if (compareMessages(messages[i - 1], messages[i]) > 0) {
      return false;
    }
  }
  return true;
}

/**
 * Stable sort that maintains relative order of equal elements.
 *
 * @param messages - Array of messages to sort
 * @returns New array with stable-sorted messages
 */
export function stableSortMessages(messages: SequencedMessage[]): SequencedMessage[] {
  // Create indexed array for stable sort
  const indexed = messages.map((msg, index) => ({ msg, index }));

  // Sort by sequence, then by original index for stability
  indexed.sort((a, b) => {
    const cmp = compareMessages(a.msg, b.msg);

    if (cmp !== 0) {
      return cmp;
    }

    return a.index - b.index;
  });

  // Extract sorted messages
  return indexed.map((item) => item.msg);
}
