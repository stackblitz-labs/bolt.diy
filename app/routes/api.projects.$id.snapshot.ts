/**
 * Project Snapshot API Route
 *
 * Handles file snapshot operations for a specific project.
 * GET /api/projects/:id/snapshot - Retrieve current file snapshot
 * PUT /api/projects/:id/snapshot - Save or update file snapshot
 */

import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node';
import { auth } from '~/lib/auth/auth.server';
import { getSnapshotByProjectId, saveSnapshot } from '~/lib/services/projects.server';
import { createScopedLogger } from '~/utils/logger';
import { z } from 'zod';

const logger = createScopedLogger('ProjectSnapshotAPI');

// File and Folder schemas for proper validation
const fileSchema = z.object({
  type: z.literal('file'),
  content: z.string(),
  isBinary: z.boolean(),
  isLocked: z.boolean().optional(),
  lockedByFolder: z.string().optional(),
});

const folderSchema = z.object({
  type: z.literal('folder'),
  isLocked: z.boolean().optional(),
  lockedByFolder: z.string().optional(),
});

// Request validation schemas
const saveSnapshotSchema = z.object({
  files: z.record(z.union([fileSchema, folderSchema])), // FileMap structure
  summary: z.string().optional(),
});

/**
 * GET /api/projects/:id/snapshot
 *
 * Retrieve the current file snapshot for a project.
 *
 * Returns:
 * - 200: ProjectSnapshot object
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

    logger.info('Fetching snapshot', { projectId, userId });

    const snapshot = await getSnapshotByProjectId(projectId, userId);

    if (!snapshot) {
      // Return 404 when no snapshot exists
      return json({ error: 'Snapshot not found' }, { status: 404 });
    }

    logger.info('Snapshot retrieved', {
      projectId,
      filesCount: Object.keys(snapshot.files).length,
      createdAt: snapshot.created_at,
      updatedAt: snapshot.updated_at,
    });

    return json(snapshot);
  } catch (error) {
    logger.error('Failed to fetch snapshot', { error: String(error), projectId: params.id });

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return json({ error: 'Project not found' }, { status: 404 });
      }
    }

    return json(
      {
        error: 'Failed to fetch snapshot',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/projects/:id/snapshot
 *
 * Save or update the file snapshot for a project.
 * Performs upsert operation (one snapshot per project).
 *
 * Request Body:
 * - files: FileMap object with file paths as keys
 * - summary: Optional summary of changes
 *
 * Returns:
 * - 200: { updated_at: string }
 * - 400: Invalid request body
 * - 401: Unauthorized
 * - 404: Project not found
 * - 413: Snapshot too large (>50MB)
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

    if (request.method !== 'PUT') {
      return json({ error: 'Method not allowed' }, { status: 405 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = saveSnapshotSchema.safeParse(body);

    if (!validationResult.success) {
      return json(
        {
          error: 'Invalid request body',
          details: validationResult.error.errors,
        },
        { status: 400 },
      );
    }

    const { files, summary } = validationResult.data;

    // Validate files object is not empty
    if (!files || Object.keys(files).length === 0) {
      return json({ error: 'Files object is required and cannot be empty' }, { status: 400 });
    }

    // Estimate snapshot size and validate against limit
    const snapshotSize = JSON.stringify(files).length;
    const sizeInMB = snapshotSize / (1024 * 1024);

    if (sizeInMB > 50) {
      return json(
        {
          error: 'Snapshot too large',
          message: `Snapshot size is ${sizeInMB.toFixed(2)}MB. Maximum allowed size is 50MB.`,
        },
        { status: 413 },
      );
    }

    logger.info('Saving snapshot', {
      projectId,
      userId,
      filesCount: Object.keys(files).length,
      sizeMB: sizeInMB.toFixed(2),
      hasSummary: !!summary,
    });

    const result = await saveSnapshot(projectId, { files, summary }, userId);

    logger.info('Snapshot saved', {
      projectId,
      updatedAt: result.updated_at,
      filesCount: Object.keys(files).length,
    });

    return json(result);
  } catch (error) {
    logger.error('Failed to save snapshot', { error: String(error), projectId: params.id });

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return json({ error: 'Project not found' }, { status: 404 });
      }

      if (error.message.includes('too large')) {
        return json(
          {
            error: 'Snapshot too large',
            message: error.message,
          },
          { status: 413 },
        );
      }
    }

    return json(
      {
        error: 'Failed to save snapshot',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
