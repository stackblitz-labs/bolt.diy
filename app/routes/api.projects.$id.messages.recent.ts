/**
 * Project Recent Messages API Route
 *
 * GET /api/projects/:id/messages/recent
 * Retrieve recent chat messages in descending sequence order (newest first).
 * Optimized for the "reopen project" use case.
 *
 * Part of specs/001-project-chat-sync (Phase 3, Task T016)
 */

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { auth } from '~/lib/auth/auth.server';
import { getRecentMessages } from '~/lib/services/projects.server';
import { createScopedLogger } from '~/utils/logger';
import { MESSAGE_PAGE_SIZE, MAX_MESSAGE_LIMIT } from '~/lib/persistence/chatSyncConstants';

const logger = createScopedLogger('ProjectRecentMessagesAPI');

/**
 * GET /api/projects/:id/messages/recent
 *
 * Retrieve recent chat messages for a project in descending sequence order.
 *
 * Query Parameters:
 * - limit: Number of messages to return (default: MESSAGE_PAGE_SIZE, max: MAX_MESSAGE_LIMIT)
 * - offset: Number of messages to skip (default: 0)
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
    const limit = Math.min(
      parseInt(url.searchParams.get('limit') || String(MESSAGE_PAGE_SIZE), 10) || MESSAGE_PAGE_SIZE,
      MAX_MESSAGE_LIMIT,
    );
    const offset = parseInt(url.searchParams.get('offset') || '0', 10) || 0;

    logger.info('Fetching recent messages', { projectId, userId, limit, offset });

    const result = await getRecentMessages(
      projectId,
      {
        limit,
        offset,
      },
      userId,
    );

    logger.info('Recent messages retrieved', {
      projectId,
      count: result.messages.length,
      total: result.total,
    });

    return json(result);
  } catch (error) {
    logger.error('Failed to fetch recent messages', { error: String(error), projectId: params.id });

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return json({ error: 'Project not found' }, { status: 404 });
      }
    }

    return json(
      {
        error: 'Failed to fetch recent messages',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
