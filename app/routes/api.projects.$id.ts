/**
 * API route for individual project operations
 *
 * GET /api/projects/:id - Get project details
 * PATCH /api/projects/:id - Update project
 * DELETE /api/projects/:id - Delete project
 */

import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node';
import { getSession } from '~/lib/auth/session.server';
import { getProjectById, updateProject, deleteProject } from '~/lib/services/projects.server';
import { PROJECT_ERROR_CODES, PROJECT_STATUS_VALUES } from '~/types/project';
import type { UpdateProjectInput, ProjectStatus } from '~/types/project';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('api.projects.$id');

/**
 * GET /api/projects/:id
 *
 * Returns project details including business profile information
 */
export async function loader({ params, request }: LoaderFunctionArgs) {
  try {
    const projectId = params.id;

    if (!projectId) {
      return json(
        { error: { code: PROJECT_ERROR_CODES.INVALID_INPUT, message: 'Project ID is required' } },
        { status: 400 },
      );
    }

    const session = await getSession(request);

    if (!session?.user) {
      return json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    const project = await getProjectById(projectId, session.user.id);

    if (!project) {
      return json({ error: { code: PROJECT_ERROR_CODES.NOT_FOUND, message: 'Project not found' } }, { status: 404 });
    }

    logger.info('Project retrieved', { userId: session.user.id, projectId });

    return json(project);
  } catch (error) {
    logger.error('Failed to get project', { error, projectId: params.id });

    return json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get project' } }, { status: 500 });
  }
}

/**
 * PATCH /api/projects/:id
 * DELETE /api/projects/:id
 */
export async function action({ params, request }: ActionFunctionArgs) {
  const projectId = params.id;

  if (!projectId) {
    return json(
      { error: { code: PROJECT_ERROR_CODES.INVALID_INPUT, message: 'Project ID is required' } },
      { status: 400 },
    );
  }

  const session = await getSession(request);

  if (!session?.user) {
    return json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
  }

  const method = request.method;

  try {
    switch (method) {
      case 'PATCH':
        return await handlePatch(projectId, session.user.id, request);
      case 'DELETE':
        return await handleDelete(projectId, session.user.id);
      default:
        return json(
          { error: { code: 'METHOD_NOT_ALLOWED', message: 'Only PATCH and DELETE methods allowed' } },
          { status: 405 },
        );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    logger.error(`Failed to ${method.toLowerCase()} project`, {
      error: message,
      stack,
      projectId,
    });

    if (error instanceof Error && error.message.includes('not found')) {
      return json({ error: { code: PROJECT_ERROR_CODES.NOT_FOUND, message: 'Project not found' } }, { status: 404 });
    }

    return json(
      { error: { code: 'INTERNAL_ERROR', message: `Failed to ${method.toLowerCase()} project: ${message}` } },
      { status: 500 },
    );
  }
}

/**
 * Handle PATCH request - update project
 */
async function handlePatch(projectId: string, userId: string, request: Request) {
  const body = (await request.json()) as {
    name?: unknown;
    description?: unknown;
    status?: unknown;
  };

  // Validate update fields
  const updates: UpdateProjectInput = {};

  if (body.name !== undefined) {
    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      return json(
        { error: { code: PROJECT_ERROR_CODES.INVALID_INPUT, message: 'Project name cannot be empty' } },
        { status: 400 },
      );
    }

    if (body.name.length > 255) {
      return json(
        { error: { code: PROJECT_ERROR_CODES.INVALID_INPUT, message: 'Project name must be 255 characters or less' } },
        { status: 400 },
      );
    }

    updates.name = body.name.trim();
  }

  if (body.description !== undefined) {
    if (body.description !== null && typeof body.description === 'string' && body.description.length > 1000) {
      return json(
        { error: { code: PROJECT_ERROR_CODES.INVALID_INPUT, message: 'Description must be 1000 characters or less' } },
        { status: 400 },
      );
    }

    updates.description = (typeof body.description === 'string' ? body.description.trim() : undefined) || undefined;
  }

  if (body.status !== undefined) {
    if (!PROJECT_STATUS_VALUES.includes(body.status as ProjectStatus)) {
      return json(
        { error: { code: PROJECT_ERROR_CODES.INVALID_INPUT, message: 'Invalid status value' } },
        { status: 400 },
      );
    }

    updates.status = body.status as ProjectStatus;
  }

  if (Object.keys(updates).length === 0) {
    return json(
      { error: { code: PROJECT_ERROR_CODES.INVALID_INPUT, message: 'No valid update fields provided' } },
      { status: 400 },
    );
  }

  const updatedProject = await updateProject(projectId, userId, updates);

  logger.info('Project updated', { userId, projectId, updates });

  return json(updatedProject);
}

/**
 * Handle DELETE request - delete project
 */
async function handleDelete(projectId: string, userId: string) {
  const success = await deleteProject(projectId, userId);

  if (!success) {
    return json({ error: { code: PROJECT_ERROR_CODES.NOT_FOUND, message: 'Project not found' } }, { status: 404 });
  }

  logger.info('Project deleted', { userId, projectId });

  // Return proper 204 No Content response (no body)
  return new Response(null, { status: 204 });
}
