/**
 * Info Collection API Routes
 * REST endpoints for session management
 */

import { type ActionFunctionArgs, type LoaderFunctionArgs, json } from '@remix-run/cloudflare';
import { requireSessionOrError } from '~/lib/auth/guards.server';
import { infoCollectionService } from '~/lib/services/infoCollectionService';
import type { InfoCollectionResponse, SessionListResponse } from '~/types/info-collection';

/**
 * GET /api/info-collection - List user sessions
 * GET /api/info-collection?active=true - Get active session
 * GET /api/info-collection?status=completed - Get most recent completed session
 * GET /api/info-collection/:id - Get specific session
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const session = await requireSessionOrError(request);
  const userId = session.user?.id;

  if (!userId) {
    return json({ error: 'User ID not found' }, { status: 400 });
  }

  const url = new URL(request.url);
  const active = url.searchParams.get('active') === 'true';
  const status = url.searchParams.get('status');
  const sessionId = url.pathname.split('/').pop();

  try {
    // Get active session
    if (active) {
      const activeSession = await infoCollectionService.getActiveSession(userId);
      return json<InfoCollectionResponse>({
        success: true,
        session: activeSession || undefined,
      });
    }

    // Get most recent completed session (for gate check)
    if (status === 'completed') {
      const completedSession = await infoCollectionService.getCompletedSession(userId);
      return json<InfoCollectionResponse>({
        success: true,
        session: completedSession || undefined,
      });
    }

    // Get specific session by ID
    if (sessionId && sessionId !== 'info-collection') {
      const targetSession = await infoCollectionService.getSession(sessionId);

      if (!targetSession || targetSession.userId !== userId) {
        return json({ error: 'Session not found' }, { status: 404 });
      }

      return json<InfoCollectionResponse>({
        success: true,
        session: targetSession,
      });
    }

    // List all sessions
    const sessions = await infoCollectionService.getUserSessions(userId);

    return json<SessionListResponse>({
      sessions,
      total: sessions.length,
    });
  } catch (error) {
    console.error('Info collection loader error:', error);
    return json({ error: 'Failed to load sessions' }, { status: 500 });
  }
}

/**
 * POST /api/info-collection - Create new session
 * DELETE /api/info-collection/:id - Delete session
 */
export async function action({ request }: ActionFunctionArgs) {
  const session = await requireSessionOrError(request);
  const userId = session.user?.id;

  if (!userId) {
    return json({ error: 'User ID not found' }, { status: 400 });
  }

  const method = request.method;

  try {
    if (method === 'POST') {
      // Create new session
      const body = (await request.json().catch(() => ({}))) as { chatId?: string };
      const chatId = body.chatId;

      const newSession = await infoCollectionService.createSession(userId, chatId);

      return json<InfoCollectionResponse>({
        success: true,
        session: newSession,
        message: 'Session created successfully',
      });
    }

    if (method === 'DELETE') {
      // Delete session
      const url = new URL(request.url);
      const sessionId = url.pathname.split('/').pop();

      if (!sessionId || sessionId === 'info-collection') {
        return json({ error: 'Session ID required' }, { status: 400 });
      }

      await infoCollectionService.deleteSession(sessionId, userId);

      return json<InfoCollectionResponse>({
        success: true,
        message: 'Session deleted successfully',
      });
    }

    return json({ error: 'Method not allowed' }, { status: 405 });
  } catch (error) {
    console.error('Info collection action error:', error);
    return json({ error: 'Operation failed' }, { status: 500 });
  }
}
