/**
 * Projects Service
 *
 * Business logic for managing user website projects, chat messages, and file snapshots.
 * Provides CRUD operations with proper authentication and authorization.
 */

import type {
  Project,
  ProjectMessage,
  ProjectSnapshot,
  CreateProjectInput,
  UpdateProjectInput,
  ProjectSummary,
  ProjectWithDetails,
  MessagesListResponse,
  SaveSnapshotRequest,
  SaveSnapshotResponse,
  SaveMessagesResponse,
} from '~/types/project';
import { createScopedLogger } from '~/utils/logger';
import { createUserSupabaseClient, createAdminSupabaseClient } from '~/lib/db/supabase.server';
import { SupabaseRlsError } from '~/lib/errors/supabase-error';
import { PROJECT_ERROR_CODES } from '~/types/project';

const logger = createScopedLogger('ProjectsService');

/**
 * Wrapper to handle Supabase and RLS errors consistently across service functions
 */
function handleSupabaseError(error: unknown, context: string, userId?: string): never {
  logger.error(`${context} failed`, { userId, error });

  if (error instanceof SupabaseRlsError) {
    // Map SupabaseRlsError to project error codes
    switch (error.code) {
      case 'RLS_CONTEXT_SET_FAILED':
      case 'RLS_CONTEXT_NOT_SET':
      case 'RLS_CONTEXT_VERIFICATION_FAILED':
        throw new Error(`${PROJECT_ERROR_CODES.RLS_CONTEXT_FAILED}: Authentication context failed. Please try again.`);
      case 'INVALID_USER_ID':
        throw new Error(`${PROJECT_ERROR_CODES.INVALID_INPUT}: Invalid user authentication.`);
      default:
        throw new Error(`${PROJECT_ERROR_CODES.DATABASE_UNAUTHORIZED}: Database access denied.`);
    }
  }

  // Handle other Supabase errors
  if (error && typeof error === 'object' && 'code' in error) {
    const supabaseError = error as any;

    switch (supabaseError.code) {
      case 'PGRST301':
      case '42501':
        throw new Error(`${PROJECT_ERROR_CODES.DATABASE_UNAUTHORIZED}: Permission denied.`);
      case '08006':
      case '08001':
        throw new Error(`${PROJECT_ERROR_CODES.SERVICE_UNAVAILABLE}: Database connection failed.`);
      default:
        throw new Error(`${PROJECT_ERROR_CODES.SAVE_FAILED}: Database operation failed.`);
    }
  }

  // Generic error - re-throw as-is if it already has our error code format
  if (error instanceof Error && error.message.includes(':')) {
    throw error;
  }

  // Wrap unknown errors
  throw new Error(`${PROJECT_ERROR_CODES.SAVE_FAILED}: ${error instanceof Error ? error.message : 'Unknown error'}`);
}

/*
 * ============================================================================
 * Project CRUD Operations
 * ============================================================================
 */

/**
 * Create a new project for the authenticated user
 */
export async function createProject(userId: string, input: CreateProjectInput): Promise<Project> {
  logger.info('Creating project', { userId, name: input.name });

  try {
    const supabase = await createUserSupabaseClient(userId);

    // Check project count limit (soft limit of 10)
    const { count: existingCount } = await supabase.from('projects').select('*', { count: 'exact', head: true });

    if (existingCount && existingCount >= 10) {
      throw new Error(
        `${PROJECT_ERROR_CODES.LIMIT_REACHED}: Project limit reached. Maximum 10 projects allowed per user.`,
      );
    }

    // Generate unique URL-friendly identifier
    const urlId = await generateUniqueUrlId(supabase, input.name);

    // Prepare project data with optional business_profile
    const projectData: Record<string, unknown> = {
      user_id: userId,
      name: input.name,
      description: input.description || null,
      status: 'draft' as const,
      url_id: urlId,
    };

    // Add business_profile if provided (from crawler integration)
    if (input.businessProfile) {
      logger.info('Including business profile in project creation', {
        sessionId: input.session_id,
        hasCrawledData: !!input.businessProfile.crawled_data,
        hasGeneratedContent: !!input.businessProfile.generated_content,
        mode: 'full-crawler',
      });
      projectData.business_profile = input.businessProfile;
    } else {
      // Manual fallback mode - project created with basic data only
      logger.info('Creating project in manual fallback mode', {
        sessionId: input.session_id,
        mode: 'manual-fallback',
      });
    }

    // Insert project
    const { data: project, error } = await supabase.from('projects').insert(projectData).select().single();

    if (error) {
      logger.error('Failed to create project', { error, userId, input });
      throw new Error(`${PROJECT_ERROR_CODES.SAVE_FAILED}: Failed to create project: ${error.message}`);
    }

    logger.info('Project created successfully', { projectId: project.id, userId, urlId });

    return project;
  } catch (error) {
    handleSupabaseError(error, 'createProject', userId);
  }

  // This line is unreachable but satisfies the linter
  throw new Error('Unreachable');
}

/**
 * Generate a unique URL-friendly identifier for a project
 */
async function generateUniqueUrlId(
  supabase: Awaited<ReturnType<typeof createUserSupabaseClient>>,
  name: string,
): Promise<string> {
  // Create base slug from name
  const baseSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50); // Limit length

  let attempts = 0;
  const maxAttempts = 100;

  // Add random suffix if base exists, otherwise try base first
  while (attempts < maxAttempts) {
    const suffix = attempts > 0 ? `-${Math.random().toString(36).substring(2, 8)}` : '';
    const candidate = `${baseSlug}${suffix}`;

    const { data: existing } = await supabase.from('projects').select('id').eq('url_id', candidate).single();

    if (!existing) {
      return candidate;
    }

    attempts++;
  }

  // Fallback to random string if all attempts fail
  throw new Error('Unable to generate unique project URL ID');
}

/**
 * Get project by URL-friendly identifier
 */
export async function getProjectByUrlId(urlId: string, userId: string): Promise<Project | null> {
  logger.info('Getting project by URL ID', { urlId, userId });

  try {
    const supabase = await createUserSupabaseClient(userId);

    const { data: project, error } = await supabase.from('projects').select('*').eq('url_id', urlId).single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Project not found
        return null;
      }

      logger.error('Failed to get project by URL ID', { error, urlId, userId });
      throw new Error(`${PROJECT_ERROR_CODES.SAVE_FAILED}: Failed to get project: ${error.message}`);
    }

    return project;
  } catch (error) {
    handleSupabaseError(error, 'getProjectByUrlId', userId);
  }

  // This line is unreachable but satisfies the linter
  throw new Error('Unreachable');
}

/**
 * Get projects list for the authenticated user
 */
export async function getProjectsByUserId(
  userId: string,
  options: {
    status?: Project['status'];
    limit?: number;
    offset?: number;
  } = {},
): Promise<{ projects: ProjectSummary[]; total: number }> {
  logger.info('Getting projects', { userId, ...options });

  const supabase = await createUserSupabaseClient(userId);

  // Build query with optional status filter
  let query = supabase.from('projects').select(`
      id,
      name,
      description,
      status,
      url_id,
      updated_at
    `);

  // Add status filter if specified
  if (options.status) {
    query = query.eq('status', options.status);
  }

  // Get total count with matching filter logic
  let countQuery = supabase.from('projects').select('*', { count: 'exact', head: true }).eq('user_id', userId);

  if (options.status) {
    countQuery = countQuery.eq('status', options.status);
  }

  const { count: total } = await countQuery;

  // Apply pagination and ordering
  query = query
    .order('updated_at', { ascending: false })
    .range(options.offset || 0, (options.offset || 0) + (options.limit || 10) - 1);

  const { data: projects, error } = await query;

  if (error) {
    logger.error('Failed to get projects', { error, userId, options });
    throw new Error(`Failed to get projects: ${error.message}`);
  }

  // Batch query: Get all message counts at once
  const projectIds = (projects || []).map((p) => p.id);
  const { data: messageCounts } = await supabase
    .from('project_messages')
    .select('project_id', { count: 'exact' })
    .in('project_id', projectIds);

  const { data: snapshots } = await supabase
    .from('project_snapshots')
    .select('project_id')
    .in('project_id', projectIds);

  // Create efficient lookup structures
  const messageCountMap = new Map(
    (messageCounts || []).reduce((acc: [string, number][], msg) => {
      const count = acc.find(([id]) => id === msg.project_id)?.[1] || 0;
      acc.push([msg.project_id, count + 1]);

      return acc;
    }, []),
  );

  const snapshotMap = new Set((snapshots || []).map((s) => s.project_id));

  // Combine data without additional queries
  const projectsWithSummary: ProjectSummary[] = (projects || []).map((project) => ({
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status,
    url_id: project.url_id,
    updated_at: project.updated_at,
    message_count: messageCountMap.get(project.id) || 0,
    has_snapshot: snapshotMap.has(project.id),
  }));

  return {
    projects: projectsWithSummary,
    total: total || 0,
  };
}

/**
 * Get single project by ID with full details
 */
export async function getProjectById(projectId: string, userId: string): Promise<ProjectWithDetails | null> {
  logger.info('Getting project', { projectId, userId });

  const supabase = await createUserSupabaseClient(userId);

  // Get project with tenant and business profile data
  const { data: project, error } = await supabase
    .from('projects')
    .select(
      `
      *,
      tenant:tenants (
        business_profiles (
          gmaps_url,
          address,
          contact_info
        )
      )
    `,
    )
    .eq('id', projectId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Project not found
      return null;
    }

    logger.error('Failed to get project', { error, projectId, userId });
    throw new Error(`Failed to get project: ${error.message}`);
  }

  // Prefer projects.business_profile (crawler payload) if present,
  // otherwise fall back to tenant business_profiles join
  const projectWithDetails: ProjectWithDetails = {
    ...project,
    business_profile: project.business_profile || project.tenant?.business_profiles?.[0] || null,
  };

  // Remove the nested tenant data to avoid circular references
  delete (projectWithDetails as any).tenant;

  return projectWithDetails;
}

/**
 * Update project metadata
 */
export async function updateProject(projectId: string, userId: string, updates: UpdateProjectInput): Promise<Project> {
  logger.info('Updating project', { projectId, userId, ...updates });

  try {
    const supabase = await createUserSupabaseClient(userId);

    // Add updated_at timestamp
    const updateData = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    const { data: project, error } = await supabase
      .from('projects')
      .update(updateData)
      .eq('id', projectId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new Error(`${PROJECT_ERROR_CODES.NOT_FOUND}: Project not found`);
      }

      logger.error('Failed to update project', { error, projectId, userId, updates });
      throw new Error(`${PROJECT_ERROR_CODES.SAVE_FAILED}: Failed to update project: ${error.message}`);
    }

    return project;
  } catch (error) {
    handleSupabaseError(error, 'updateProject', userId);
  }

  // This line is unreachable but satisfies the linter
  throw new Error('Unreachable');
}

/**
 * Delete project and all associated data
 */
export async function deleteProject(projectId: string, userId: string): Promise<boolean> {
  logger.info('Deleting project', { projectId, userId });

  const supabase = await createUserSupabaseClient(userId);

  const { error } = await supabase.from('projects').delete().eq('id', projectId);

  if (error) {
    if (error.code === 'PGRST116') {
      return false; // Project not found
    }

    logger.error('Failed to delete project', { error, projectId, userId });
    throw new Error(`Failed to delete project: ${error.message}`);
  }

  return true;
}

/*
 * ============================================================================
 * Chat Messages Operations
 * ============================================================================
 */

/**
 * Get chat messages for a project
 */
export async function getMessagesByProjectId(
  projectId: string,
  options: {
    limit?: number;
    offset?: number;
    order?: 'asc' | 'desc';
  } = {},
  userId?: string,
): Promise<MessagesListResponse> {
  logger.info('Getting messages', { projectId, ...options, userId });

  if (!userId) {
    throw SupabaseRlsError.invalidUserId();
  }

  const supabase = await createUserSupabaseClient(userId); // Set userId for RLS context

  // Get total count first
  const { count: total } = await supabase
    .from('project_messages')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId);

  // Build query with pagination and ordering
  let query = supabase
    .from('project_messages')
    .select('*')
    .eq('project_id', projectId)
    .range(options.offset || 0, (options.offset || 0) + (options.limit || 50) - 1);

  // Apply ordering (default to ascending sequence for chat order)
  const sortOrder = options.order || 'asc';
  query = query.order('sequence_num', { ascending: sortOrder === 'asc' });

  const { data: messages, error } = await query;

  if (error) {
    logger.error('Failed to get messages', { error, projectId, options });
    throw new Error(`Failed to get messages: ${error.message}`);
  }

  return {
    messages: messages || [],
    total: total || 0,
  };
}

/**
 * Save chat messages for a project
 *
 * ⚠️ IMPORTANT: This function uses bulk upsert with `onConflict: 'project_id,sequence_num'`.
 * This can cause silent overwrites if two concurrent sessions generate the same sequence_num
 * for different message_id values.
 *
 * For safe concurrent writes, prefer the append-only endpoint (POST /api/projects/:id/messages/append)
 * which is implemented in Phase 3 of the project-chat-sync feature.
 *
 * This function preserves message_id uniqueness when messages are deduplicated by the caller,
 * but does NOT enforce it during upsert. The database has a unique constraint on
 * (project_id, message_id) which will cause an error if violated, but the sequence_num
 * conflict resolution happens first and can overwrite different messages.
 *
 * @see specs/001-project-chat-sync/research.md for details on concurrent write issues
 */
export async function saveMessages(
  projectId: string,
  messages: Partial<ProjectMessage>[],
  userId?: string,
): Promise<SaveMessagesResponse> {
  logger.info('Saving messages', { projectId, count: messages.length, userId });

  if (!userId) {
    throw SupabaseRlsError.invalidUserId();
  }

  const supabase = await createUserSupabaseClient(userId); // Set userId for RLS context

  // Prepare messages for upsert
  const messagesToUpsert = messages.map((message) => ({
    project_id: projectId,
    message_id: message.message_id,
    sequence_num: message.sequence_num,
    role: message.role,
    content: message.content,
    annotations: message.annotations || [],
    created_at: message.created_at || new Date().toISOString(),
  }));

  // Perform bulk upsert using PostgreSQL ON CONFLICT
  const { data: savedMessages, error } = await supabase
    .from('project_messages')
    .upsert(messagesToUpsert, {
      onConflict: 'project_id,sequence_num',
      ignoreDuplicates: false, // This will update existing rows
    })
    .select('id');

  if (error) {
    logger.error('Failed to save messages', { error, projectId, count: messages.length });
    throw new Error(`Failed to save messages: ${error.message}`);
  }

  const savedCount = savedMessages?.length || 0;
  logger.info('Messages saved successfully', { projectId, savedCount });

  return {
    saved_count: savedCount,
  };
}

/**
 * Append new chat messages for a project using server-side sequence allocation
 *
 * This is the recommended method for writing messages as it:
 * - Prevents concurrent session conflicts by allocating sequence_num on the server
 * - Deduplicates by message_id to prevent duplicate inserts
 * - Never overwrites existing messages (append-only)
 *
 * Uses the database function `append_project_messages` which employs advisory locks
 * to serialize sequence allocation per project.
 *
 * @param projectId - UUID of the project
 * @param messages - Array of messages WITHOUT sequence_num (server will allocate)
 * @param userId - User ID for authentication/authorization
 * @returns Object with inserted_count (number of messages actually inserted)
 *
 * @see specs/001-project-chat-sync/data-model.md for detailed behavior
 */
export async function appendMessages(
  projectId: string,
  messages: Array<{
    message_id: string;
    role: 'user' | 'assistant' | 'system';
    content: any;
    annotations?: any[];
    created_at?: string;
  }>,
  userId?: string,
): Promise<{ inserted_count: number }> {
  logger.info('Appending messages', { projectId, count: messages.length, userId });

  if (!userId) {
    throw SupabaseRlsError.invalidUserId();
  }

  const supabase = await createUserSupabaseClient(userId);

  // Verify project ownership via RLS (will fail if user doesn't own project)
  const { data: project } = await supabase.from('projects').select('id').eq('id', projectId).single();

  if (!project) {
    throw new Error(`${PROJECT_ERROR_CODES.NOT_FOUND}: Project not found or access denied`);
  }

  // Call the database function to append messages with server-side sequence allocation
  const { data, error } = await supabase.rpc('append_project_messages', {
    p_project_id: projectId,
    p_messages: messages,
  });

  if (error) {
    logger.error('Failed to append messages', { error, projectId, count: messages.length });
    throw new Error(`Failed to append messages: ${error.message}`);
  }

  const insertedCount = data?.inserted_count || 0;
  logger.info('Messages appended successfully', { projectId, insertedCount, requestCount: messages.length });

  return {
    inserted_count: insertedCount,
  };
}

/**
 * Get recent chat messages for a project (newest first)
 *
 * This is optimized for the "reopen project" use case where we want to show
 * the most recent conversation first, then allow loading older messages on demand.
 *
 * @param projectId - UUID of the project
 * @param options - Pagination options (limit defaults to MESSAGE_PAGE_SIZE from constants)
 * @param userId - User ID for authentication/authorization
 * @returns Recent messages in descending sequence order + total count
 *
 * @see specs/001-project-chat-sync/plan.md for load strategy details
 */
export async function getRecentMessages(
  projectId: string,
  options: {
    limit?: number;
    offset?: number;
  } = {},
  userId?: string,
): Promise<MessagesListResponse> {
  logger.info('Getting recent messages', { projectId, ...options, userId });

  if (!userId) {
    throw SupabaseRlsError.invalidUserId();
  }

  const supabase = await createUserSupabaseClient(userId);

  // Get total count first
  const { count: total } = await supabase
    .from('project_messages')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId);

  // Build query with pagination - order by sequence_num DESC (newest first)
  const limit = options.limit || 50; // Use MESSAGE_PAGE_SIZE constant in actual usage
  const offset = options.offset || 0;

  const { data: messages, error } = await supabase
    .from('project_messages')
    .select('*')
    .eq('project_id', projectId)
    .order('sequence_num', { ascending: false }) // DESC for recent-first
    .range(offset, offset + limit - 1);

  if (error) {
    logger.error('Failed to get recent messages', { error, projectId, options });
    throw new Error(`Failed to get recent messages: ${error.message}`);
  }

  logger.info('Recent messages retrieved', {
    projectId,
    count: messages?.length || 0,
    total: total || 0,
  });

  return {
    messages: messages || [],
    total: total || 0,
  };
}

/**
 * Delete all chat messages for a project
 *
 * Permanently removes all messages associated with a project.
 * This action is irreversible and should be used with caution.
 *
 * @param projectId - UUID of the project
 * @param userId - User ID for authentication/authorization
 * @returns Object with deleted_count (number of messages deleted)
 *
 * @see specs/001-project-chat-sync/tasks.md (T056)
 */
export async function deleteMessages(projectId: string, userId?: string): Promise<{ deleted_count: number }> {
  logger.info('Deleting messages', { projectId, userId });

  if (!userId) {
    throw SupabaseRlsError.invalidUserId();
  }

  const supabase = await createUserSupabaseClient(userId);

  // Verify project ownership via RLS (will fail if user doesn't own project)
  const { data: project } = await supabase.from('projects').select('id').eq('id', projectId).single();

  if (!project) {
    throw new Error(`${PROJECT_ERROR_CODES.NOT_FOUND}: Project not found or access denied`);
  }

  // Delete all messages for the project
  const { data: deletedMessages, error } = await supabase
    .from('project_messages')
    .delete()
    .eq('project_id', projectId)
    .select('id');

  if (error) {
    logger.error('Failed to delete messages', { error, projectId });
    throw new Error(`Failed to delete messages: ${error.message}`);
  }

  const deletedCount = deletedMessages?.length || 0;
  logger.info('Messages deleted successfully', { projectId, deletedCount });

  return {
    deleted_count: deletedCount,
  };
}

/*
 * ============================================================================
 * File Snapshot Operations
 * ============================================================================
 */

/**
 * Get file snapshot for a project
 */
export async function getSnapshotByProjectId(projectId: string, userId?: string): Promise<ProjectSnapshot | null> {
  logger.info('Getting snapshot', { projectId, userId });

  if (!userId) {
    throw SupabaseRlsError.invalidUserId();
  }

  const supabase = await createUserSupabaseClient(userId);

  /*
   * RLS policies enforce ownership - no manual JOIN needed
   * The createUserSupabaseClient() sets app.current_user_id which RLS uses
   */
  const { data: snapshot, error } = await supabase
    .from('project_snapshots')
    .select('*')
    .eq('project_id', projectId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Snapshot not found
      return null;
    }

    logger.error('Failed to get snapshot', { error, projectId });
    throw new Error(`Failed to get snapshot: ${error.message}`);
  }

  return snapshot;
}

/**
 * Save file snapshot for a project
 */
export async function saveSnapshot(
  projectId: string,
  input: SaveSnapshotRequest,
  userId?: string,
): Promise<SaveSnapshotResponse> {
  logger.info('Saving snapshot', { projectId, userId, filesCount: Object.keys(input.files).length });

  if (!userId) {
    throw SupabaseRlsError.invalidUserId();
  }

  const supabase = await createUserSupabaseClient(userId);

  // Verify project ownership if userId provided
  if (userId) {
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();

    if (projectError || !project) {
      throw new Error('Project not found or access denied');
    }
  }

  // Validate snapshot size (50MB limit, warn at 45MB)
  const snapshotSize = JSON.stringify(input.files).length;
  const sizeInMB = snapshotSize / (1024 * 1024);

  if (sizeInMB > 50) {
    throw new Error('Snapshot too large. Maximum size is 50MB.');
  }

  if (sizeInMB > 45) {
    logger.warn('Snapshot approaching size limit', {
      projectId,
      sizeMB: sizeInMB.toFixed(2),
    });
  }

  // Prepare snapshot data
  const snapshotData = {
    project_id: projectId,
    files: input.files,
    summary: input.summary || null,
    updated_at: new Date().toISOString(),
  };

  // Upsert snapshot (one per project)
  const { data: savedSnapshot, error } = await supabase
    .from('project_snapshots')
    .upsert(snapshotData, {
      onConflict: 'project_id',
      ignoreDuplicates: false, // This will update existing row
    })
    .select('updated_at')
    .single();

  if (error) {
    logger.error('Failed to save snapshot', { error, projectId, size: snapshotSize });
    throw new Error(`Failed to save snapshot: ${error.message}`);
  }

  const updatedAt = savedSnapshot?.updated_at || new Date().toISOString();
  logger.info('Snapshot saved successfully', {
    projectId,
    sizeMB: sizeInMB.toFixed(2),
    updatedAt,
  });

  return {
    updated_at: updatedAt,
  };
}

/**
 * Generate deployment package (ZIP) for a project
 */
export async function generateDeploymentPackage(projectId: string): Promise<Buffer> {
  logger.info('Generating deployment package', { projectId });

  const supabase = await createAdminSupabaseClient(); // Admin client for deployment package generation

  // Get the project snapshot
  const { data: snapshot, error } = await supabase
    .from('project_snapshots')
    .select('files, summary, updated_at')
    .eq('project_id', projectId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new Error('No snapshot found for this project. Generate some code first.');
    }

    logger.error('Failed to get snapshot for deployment', { error, projectId });
    throw new Error(`Failed to get snapshot: ${error.message}`);
  }

  if (!snapshot || !snapshot.files || Object.keys(snapshot.files).length === 0) {
    throw new Error('No files found in snapshot for deployment.');
  }

  try {
    // Dynamic import of JSZip to avoid bundling issues
    const jsZip = (await import('jszip')).default;
    const zip = new jsZip();

    // Add files to ZIP
    const files = snapshot.files;
    let fileCount = 0;
    let totalSize = 0;

    for (const [filePath, fileInfo] of Object.entries(files)) {
      if (
        fileInfo &&
        typeof fileInfo === 'object' &&
        'type' in fileInfo &&
        fileInfo.type === 'file' &&
        filePath !== '/'
      ) {
        // Convert relative paths to proper ZIP structure
        let zipPath = filePath;

        // Remove leading slash if present
        if (zipPath.startsWith('/')) {
          zipPath = zipPath.substring(1);
        }

        // Skip empty paths
        if (!zipPath) {
          continue;
        }

        try {
          // Add file to ZIP
          const file = fileInfo as any; // Type assertion to access content property

          if (typeof file.content === 'string') {
            zip.file(zipPath, file.content);
            totalSize += file.content.length;
          } else if (Buffer.isBuffer(file.content)) {
            zip.file(zipPath, file.content);
            totalSize += file.content.length;
          } else if (file.content instanceof Uint8Array) {
            zip.file(zipPath, file.content);
            totalSize += file.content.length;
          } else {
            // Convert other content types to string
            const contentStr = String(file.content || '');
            zip.file(zipPath, contentStr);
            totalSize += contentStr.length;
          }

          fileCount++;
        } catch (fileError) {
          logger.warn('Failed to add file to ZIP', {
            filePath,
            error: String(fileError),
          });

          // Continue with other files
        }
      }
    }

    // Generate ZIP buffer
    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 6,
      },
    });

    logger.info('Deployment package generated successfully', {
      projectId,
      fileCount,
      totalSize,
      zipSize: zipBuffer.length,
      snapshotUpdatedAt: snapshot.updated_at,
    });

    return zipBuffer;
  } catch (zipError) {
    logger.error('Failed to generate ZIP', {
      error: String(zipError),
      projectId,
      fileCount: Object.keys(snapshot.files).length,
    });
    throw new Error(
      `Failed to generate deployment package: ${zipError instanceof Error ? zipError.message : 'Unknown error'}`,
    );
  }
}
