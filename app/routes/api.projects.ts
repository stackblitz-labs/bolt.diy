/**
 * API route for projects management
 *
 * GET /api/projects - List user's projects
 * POST /api/projects - Create new project
 */

import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node';
import { getSession } from '~/lib/auth/session.server';
import { createProject, getProjectsByUserId } from '~/lib/services/projects.server';
import { PROJECT_ERROR_CODES } from '~/types/project';
import type { CreateProjectInput } from '~/types/project';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('api.projects');

/**
 * GET /api/projects
 *
 * Query parameters:
 * - status?: 'draft' | 'published' | 'archived'
 * - limit?: number (default 10)
 * - offset?: number (default 0)
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const session = await getSession(request);

    if (!session?.user) {
      return json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    const url = new URL(request.url);
    const status = url.searchParams.get('status') as any;
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Validate parameters
    if (status && !['draft', 'published', 'archived'].includes(status)) {
      return json(
        { error: { code: PROJECT_ERROR_CODES.INVALID_INPUT, message: 'Invalid status filter' } },
        { status: 400 },
      );
    }

    if (limit < 1 || limit > 100) {
      return json(
        { error: { code: PROJECT_ERROR_CODES.INVALID_INPUT, message: 'Limit must be between 1 and 100' } },
        { status: 400 },
      );
    }

    if (offset < 0) {
      return json(
        { error: { code: PROJECT_ERROR_CODES.INVALID_INPUT, message: 'Offset must be non-negative' } },
        { status: 400 },
      );
    }

    const result = await getProjectsByUserId(session.user.id, { status, limit, offset });

    logger.info('Projects listed', { userId: session.user.id, count: result.projects.length, total: result.total });

    return json({
      projects: result.projects,
      total: result.total,
      limit,
      offset,
    });
  } catch (error) {
    logger.error('Failed to list projects', { error });

    if (error instanceof Error && error.message.includes('Project limit reached')) {
      return json({ error: { code: PROJECT_ERROR_CODES.LIMIT_REACHED, message: error.message } }, { status: 403 });
    }

    return json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list projects' } }, { status: 500 });
  }
}

/**
 * POST /api/projects
 *
 * Request body:
 * - name: string (required)
 * - description?: string
 * - gmaps_url?: string
 * - address?: object
 */
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Only POST method allowed' } }, { status: 405 });
  }

  try {
    const session = await getSession(request);

    if (!session?.user) {
      return json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    const body = (await request.json()) as {
      name?: unknown;
      description?: unknown;
      gmaps_url?: unknown;
      address?: unknown;
    };

    // Validate required fields
    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      return json(
        { error: { code: PROJECT_ERROR_CODES.INVALID_INPUT, message: 'Project name is required' } },
        { status: 400 },
      );
    }

    if (body.name.length > 255) {
      return json(
        { error: { code: PROJECT_ERROR_CODES.INVALID_INPUT, message: 'Project name must be 255 characters or less' } },
        { status: 400 },
      );
    }

    if (body.description && typeof body.description === 'string' && body.description.length > 1000) {
      return json(
        { error: { code: PROJECT_ERROR_CODES.INVALID_INPUT, message: 'Description must be 1000 characters or less' } },
        { status: 400 },
      );
    }

    const projectInput: CreateProjectInput = {
      name: body.name.trim(),
      description: (typeof body.description === 'string' ? body.description.trim() : undefined) || undefined,
      gmaps_url: (typeof body.gmaps_url === 'string' ? body.gmaps_url.trim() : undefined) || undefined,
      address:
        body.address && typeof body.address === 'object' && body.address !== null && !Array.isArray(body.address)
          ? (body.address as Record<string, unknown>)
          : undefined,
    };

    const project = await createProject(session.user.id, projectInput);

    logger.info('Project created', { userId: session.user.id, projectId: project.id, name: project.name });

    return json(project, { status: 201 });
  } catch (error) {
    logger.error('Failed to create project', { error });

    if (error instanceof Error && error.message.includes('Project limit reached')) {
      return json({ error: { code: PROJECT_ERROR_CODES.LIMIT_REACHED, message: error.message } }, { status: 403 });
    }

    if (error instanceof Error && error.message.includes('Failed to create project')) {
      return json({ error: { code: PROJECT_ERROR_CODES.SAVE_FAILED, message: error.message } }, { status: 400 });
    }

    return json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create project' } }, { status: 500 });
  }
}
