/**
 * Message Validation Utility
 *
 * Type guards and validation functions for AI SDK Message objects.
 * From specs/001-load-project-messages/data-model.md
 */

import type { Message } from 'ai';

/**
 * Valid message roles according to AI SDK.
 */
export const VALID_ROLES = ['user', 'assistant', 'system'] as const;

/**
 * Type guard to check if a value is a valid Message.
 *
 * This validates that an unknown value has the required fields
 * and correct types for an AI SDK Message object.
 *
 * @param msg - The value to check
 * @returns True if the value is a valid Message
 *
 * @example
 * ```ts
 * const unknownValue: unknown = getSomeData();
 *
 * if (isValidMessage(unknownValue)) {
 *   // TypeScript now knows unknownValue is a Message
 *   console.log(unknownValue.role); // string
 *   console.log(unknownValue.content); // string
 * }
 * ```
 */
export function isValidMessage(msg: unknown): msg is Message {
  // Must be an object and not null
  if (typeof msg !== 'object' || msg === null) {
    return false;
  }

  // Check for required field: id (string)
  if (!('id' in msg) || typeof (msg as any).id !== 'string') {
    return false;
  }

  // Check for required field: role (one of VALID_ROLES)
  if (!('role' in msg) || typeof (msg as any).role !== 'string') {
    return false;
  }

  if (!VALID_ROLES.includes((msg as any).role as 'user' | 'assistant' | 'system')) {
    return false;
  }

  // Check for required field: content (string or array for multimodal)
  if (!('content' in msg)) {
    return false;
  }

  const content = (msg as any).content;

  // Content can be a string or an array (for multimodal messages)
  if (typeof content !== 'string' && !Array.isArray(content)) {
    return false;
  }

  return true;
}

/**
 * Validate an array of messages and filter out invalid ones.
 *
 * @param messages - Array of potential messages
 * @returns Array of valid Message objects
 *
 * @example
 * ```ts
 * const rawData = getMessagesFromAPI();
 * const validMessages = validateMessages(rawData);
 * console.log(`Loaded ${validMessages.length} valid messages`);
 * ```
 */
export function validateMessages(messages: unknown[]): Message[] {
  return messages.filter((msg): msg is Message => isValidMessage(msg));
}

/**
 * Check if a message has a valid role.
 *
 * @param role - The role to check
 * @returns True if the role is valid
 */
export function isValidRole(role: string): role is 'user' | 'assistant' | 'system' {
  return VALID_ROLES.includes(role as 'user' | 'assistant' | 'system');
}

/**
 * Check if message content is empty or whitespace only.
 *
 * @param msg - The message to check
 * @returns True if the message has no meaningful content
 */
export function isMessageEmpty(msg: Message): boolean {
  const content = msg.content;

  if (typeof content === 'string') {
    return content.trim().length === 0;
  }

  /*
   * For multimodal content (array), check if all parts are empty
   * Type assertion needed because AI SDK Message content is a union type
   */
  if (Array.isArray(content)) {
    return (content as unknown[]).length === 0;
  }

  return true;
}

/**
 * Filter out hidden/no-store messages that shouldn't be displayed.
 *
 * These are messages with annotations like ['hidden'] or ['no-store']
 * that are used for internal state management.
 *
 * @param msg - The message to check
 * @returns True if the message should be hidden from UI
 */
export function isMessageHidden(msg: Message): boolean {
  if (!msg.annotations || !Array.isArray(msg.annotations)) {
    return false;
  }

  return msg.annotations.some((annotation) => {
    if (typeof annotation === 'string') {
      return annotation === 'hidden' || annotation === 'no-store';
    }

    if (typeof annotation === 'object' && annotation !== null) {
      const obj = annotation as Record<string, unknown>;
      return obj.type === 'hidden' || obj.type === 'no-store';
    }

    return false;
  });
}

/**
 * Get a safe message ID, falling back to a generated ID if missing.
 *
 * @param msg - The message
 * @returns A valid message ID string
 */
export function getSafeMessageId(msg: Message): string {
  return msg.id || `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
