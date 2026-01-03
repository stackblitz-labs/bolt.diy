/**
 * Project Messages Append API Route
 *
 * POST /api/projects/:id/messages/append
 * Append new chat messages using server-side sequence allocation.
 * Prevents concurrent write conflicts and ensures no message overwrites.
 *
 * Part of specs/001-project-chat-sync (Phase 3, Task T015)
 */

import { json, type ActionFunctionArgs } from '@remix-run/node';
import { auth } from '~/lib/auth/auth.server';
import { appendMessages } from '~/lib/services/projects.server';
import { createScopedLogger } from '~/utils/logger';
import { z } from 'zod';

const logger = createScopedLogger('ProjectMessagesAppendAPI');

/*
 * Request validation schema for append endpoint
 * Note: NO sequence_num - server allocates it
 */
const appendMessagesSchema = z.object({
  messages: z
    .array(
      z.object({
        message_id: z.string().min(1, 'message_id is required'),
        role: z.enum(['user', 'assistant', 'system']),

        // Content can be string (legacy) or structured JSON (AI SDK format)
        content: z.union([z.string(), z.array(z.unknown()), z.record(z.unknown())]),

        // Annotations are optional (client should strip local-only markers before sending)
        annotations: z.array(z.unknown()).optional().nullable(),
        created_at: z.string().datetime().optional(),
      }),
    )
    .min(1, 'At least one message is required'),
});

/**
 * POST /api/projects/:id/messages/append
 *
 * Append new messages to a project using safe server-side sequence allocation.
 *
 * Request Body:
 * - messages: Array of message objects WITHOUT sequence_num
 *
 * Behavior:
 * - Server allocates sequence_num under advisory lock (no conflicts)
 * - Deduplicates by message_id (ON CONFLICT DO NOTHING)
 * - Never overwrites existing messages
 *
 * Returns:
 * - 200: { inserted_count: number } (count of actually inserted messages)
 * - 400: Invalid request body
 * - 401: Unauthorized
 * - 404: Project not found
 */
export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session || !session.user || !session.user.id) {
      return json({ error: 'Authentication required' }, { status: 401 });
    }

    const userId = session.user.id;
    const projectId = params.id;

    if (!projectId) {
      return json({ error: 'Project ID is required' }, { status: 400 });
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, { status: 405 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = appendMessagesSchema.safeParse(body);

    if (!validationResult.success) {
      return json(
        {
          error: 'Invalid request body',
          details: validationResult.error.errors,
        },
        { status: 400 },
      );
    }

    const { messages } = validationResult.data;

    logger.info('Appending messages via API', { projectId, userId, count: messages.length });

    // Convert null annotations to undefined for appendMessages function
    const messagesToAppend = messages.map((msg) => ({
      ...msg,
      annotations: msg.annotations ?? undefined,
    }));

    const result = await appendMessages(projectId, messagesToAppend, userId);

    logger.info('Messages appended via API', {
      projectId,
      insertedCount: result.inserted_count,
      requestCount: messages.length,
    });

    return json(result);
  } catch (error) {
    logger.error('Failed to append messages', { error: String(error), projectId: params.id });

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return json({ error: 'Project not found' }, { status: 404 });
      }
    }

    return json(
      {
        error: 'Failed to append messages',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
