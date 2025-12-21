/**
 * Project Messages API Route
 *
 * Handles chat messages CRUD operations for a specific project.
 * GET /api/projects/:id/messages - Retrieve paginated chat messages
 * POST /api/projects/:id/messages - Save or update chat messages
 */

import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node';
import { auth } from '~/lib/auth/auth.server';
import { getMessagesByProjectId, saveMessages } from '~/lib/services/projects.server';
import { createScopedLogger } from '~/utils/logger';
import { z } from 'zod';

const logger = createScopedLogger('ProjectMessagesAPI');

// Request validation schemas
const saveMessagesSchema = z.object({
  messages: z.array(
    z.object({
      message_id: z.string(),
      sequence_num: z.number(),
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string(),
      annotations: z.array(z.any()).optional(),
      created_at: z.string().optional(),
    }),
  ),
});

/**
 * GET /api/projects/:id/messages
 *
 * Retrieve paginated chat messages for a project.
 *
 * Query Parameters:
 * - limit: Number of messages to return (default: 50, max: 100)
 * - offset: Number of messages to skip (default: 0)
 * - order: Sort order by sequence number - 'asc' or 'desc' (default: 'asc')
 *
 * Returns:
 * - 200: { messages: ProjectMessage[], total: number }
 * - 401: Unauthorized
 * - 404: Project not found
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
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

    // Parse query parameters
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 100);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10) || 0;
    const order = (url.searchParams.get('order') || 'asc') as 'asc' | 'desc';

    logger.info('Fetching messages', { projectId, userId, limit, offset, order });

    const result = await getMessagesByProjectId(
      projectId,
      {
        limit,
        offset,
        order,
      },
      userId,
    );

    logger.info('Messages retrieved', {
      projectId,
      count: result.messages.length,
      total: result.total,
    });

    return json(result);
  } catch (error) {
    logger.error('Failed to fetch messages', { error: String(error), projectId: params.id });

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return json({ error: 'Project not found' }, { status: 404 });
      }
    }

    return json(
      {
        error: 'Failed to fetch messages',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/projects/:id/messages
 *
 * Save or update chat messages for a project.
 * Performs bulk upsert based on (project_id, sequence_num) unique constraint.
 *
 * Request Body:
 * - messages: Array of ProjectMessage objects without id/project_id
 *
 * Returns:
 * - 200: { saved_count: number }
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
    const validationResult = saveMessagesSchema.safeParse(body);

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

    if (messages.length === 0) {
      return json({ error: 'At least one message is required' }, { status: 400 });
    }

    logger.info('Saving messages', { projectId, userId, count: messages.length });

    const result = await saveMessages(projectId, messages, userId);

    logger.info('Messages saved', {
      projectId,
      savedCount: result.saved_count,
      requestCount: messages.length,
    });

    return json(result);
  } catch (error) {
    logger.error('Failed to save messages', { error: String(error), projectId: params.id });

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return json({ error: 'Project not found' }, { status: 404 });
      }
    }

    return json(
      {
        error: 'Failed to save messages',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
