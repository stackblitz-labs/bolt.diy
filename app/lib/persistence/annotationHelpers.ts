/**
 * Annotation Helper Functions
 *
 * Utilities for managing message annotations during server synchronization.
 * Part of specs/001-project-chat-sync implementation (Phase 2).
 */

import type { Message, JSONValue } from 'ai';
import { PENDING_SYNC_ANNOTATION, SYNC_ERROR_ANNOTATION } from './chatSyncConstants';

/**
 * Local-only annotation types that should not be synced to the server.
 * These annotations are for client-side state management only.
 */
const LOCAL_ONLY_ANNOTATION_TYPES = new Set([PENDING_SYNC_ANNOTATION, SYNC_ERROR_ANNOTATION]);

/**
 * Normalize and filter annotations for server sync.
 * Removes local-only annotations (e.g., pending-sync, sync-error) that should not be persisted to the server.
 *
 * @param annotations - Raw annotations array from AI SDK Message
 * @returns Filtered annotations suitable for server storage
 *
 * @example
 * ```ts
 * const message: Message = {
 *   id: '123',
 *   role: 'user',
 *   content: 'Hello',
 *   annotations: [
 *     { type: 'pending-sync', timestamp: '...' },
 *     { type: 'custom-metadata', foo: 'bar' }
 *   ]
 * };
 *
 * const serverAnnotations = normalizeAnnotationsForServer(message.annotations);
 * // Returns: [{ type: 'custom-metadata', foo: 'bar' }]
 * ```
 */
export function normalizeAnnotationsForServer(annotations: JSONValue[] | undefined): JSONValue[] {
  if (!annotations || !Array.isArray(annotations)) {
    return [];
  }

  return annotations.filter((annotation) => {
    // Filter out local-only annotation types
    if (annotation && typeof annotation === 'object' && 'type' in annotation) {
      const type = (annotation as { type: unknown }).type;

      if (typeof type === 'string' && LOCAL_ONLY_ANNOTATION_TYPES.has(type)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Extract annotations from an AI SDK Message.
 * Handles both experimental_annotations and annotations fields for compatibility.
 *
 * @param message - AI SDK Message object
 * @returns Annotations array or empty array if none exist
 */
export function extractMessageAnnotations(message: Message): JSONValue[] {
  // AI SDK supports both `annotations` and `experimental_annotations`
  const rawAnnotations = (message as any).annotations || (message as any).experimental_annotations || [];

  return Array.isArray(rawAnnotations) ? rawAnnotations : [];
}

/**
 * Check if a message has pending sync status.
 * Used to determine if a message needs to be synced to the server.
 *
 * @param message - AI SDK Message object
 * @returns true if message has pending-sync annotation
 */
export function isMessagePendingSync(message: Message): boolean {
  const annotations = extractMessageAnnotations(message);
  return annotations.some(
    (ann) => ann && typeof ann === 'object' && 'type' in ann && ann.type === PENDING_SYNC_ANNOTATION,
  );
}

/**
 * Add a pending sync annotation to a message.
 * Used when a message is created offline or when server sync fails.
 *
 * @param message - AI SDK Message object to annotate
 * @param errorMessage - Optional error message if this is a retry after failure
 * @returns Modified message with pending-sync annotation
 */
export function addPendingSyncAnnotation(message: Message, errorMessage?: string): Message {
  const existingAnnotations = extractMessageAnnotations(message);

  // Remove any existing pending-sync or sync-error annotations
  const filteredAnnotations = existingAnnotations.filter(
    (ann) =>
      !(
        ann &&
        typeof ann === 'object' &&
        'type' in ann &&
        (ann.type === PENDING_SYNC_ANNOTATION || ann.type === SYNC_ERROR_ANNOTATION)
      ),
  );

  const pendingAnnotation: JSONValue = {
    type: PENDING_SYNC_ANNOTATION,
    timestamp: new Date().toISOString(),
    ...(errorMessage && { lastError: errorMessage }),
  };

  return {
    ...message,
    annotations: [...filteredAnnotations, pendingAnnotation] as JSONValue[],
  };
}

/**
 * Remove pending sync annotation from a message after successful sync.
 *
 * @param message - AI SDK Message object
 * @returns Modified message without pending-sync annotation
 */
export function clearPendingSyncAnnotation(message: Message): Message {
  const existingAnnotations = extractMessageAnnotations(message);

  const clearedAnnotations = existingAnnotations.filter(
    (ann) => !(ann && typeof ann === 'object' && 'type' in ann && ann.type === PENDING_SYNC_ANNOTATION),
  );

  return {
    ...message,
    annotations: clearedAnnotations.length > 0 ? (clearedAnnotations as JSONValue[]) : undefined,
  };
}
