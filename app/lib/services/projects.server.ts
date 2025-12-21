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
import { createUserSupabaseClient } from '~/lib/db/supabase.server';

const logger = createScopedLogger('ProjectsService');

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

  const supabase = await createUserSupabaseClient(userId);

  // Check project count limit (soft limit of 10)
  const { count: existingCount } = await supabase.from('projects').select('*', { count: 'exact', head: true });

  if (existingCount && existingCount >= 10) {
    throw new Error('Project limit reached. Maximum 10 projects allowed per user.');
  }

  // Generate unique URL-friendly identifier
  const supabaseClient = await supabase;
  const urlId = await generateUniqueUrlId(supabaseClient, input.name);

  // Prepare project data
  const projectData = {
    user_id: userId,
    name: input.name,
    description: input.description || null,
    status: 'draft' as const,
    url_id: urlId,
  };

  // Insert project
  const { data: project, error } = await supabase.from('projects').insert(projectData).select().single();

  if (error) {
    logger.error('Failed to create project', { error, userId, input });
    throw new Error(`Failed to create project: ${error.message}`);
  }

  logger.info('Project created successfully', { projectId: project.id, userId, urlId });

  return project;
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

  let urlId = baseSlug;
  let attempts = 0;
  const maxAttempts = 100;

  // Add random suffix if base exists, otherwise try base first
  while (attempts < maxAttempts) {
    const suffix = attempts > 0 ? `-${Math.random().toString(36).substring(2, 8)}` : '';
    const candidate = `${urlId}${suffix}`;

    const { data: existing } = await supabase.from('projects').select('id').eq('url_id', candidate).single();

    if (!existing) {
      return candidate;
    }

    urlId = candidate;
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

  const supabase = await createUserSupabaseClient(userId);

  const { data: project, error } = await supabase.from('projects').select('*').eq('url_id', urlId).single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Project not found
      return null;
    }

    logger.error('Failed to get project by URL ID', { error, urlId, userId });
    throw new Error(`Failed to get project: ${error.message}`);
  }

  return project;
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

  // Get total count
  const { count: total } = await supabase
    .from('projects')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq(options.status ? 'status' : 'user_id', options.status || userId);

  // Apply pagination and ordering
  query = query
    .order('updated_at', { ascending: false })
    .range(options.offset || 0, (options.offset || 0) + (options.limit || 10) - 1);

  const { data: projects, error } = await query;

  if (error) {
    logger.error('Failed to get projects', { error, userId, options });
    throw new Error(`Failed to get projects: ${error.message}`);
  }

  // Get additional summary data (message counts, snapshot status)
  const projectsWithSummary: ProjectSummary[] = await Promise.all(
    (projects || []).map(async (project) => {
      // Get message count
      const { count: messageCount } = await supabase
        .from('project_messages')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', project.id);

      // Check if snapshot exists
      const { data: snapshot } = await supabase
        .from('project_snapshots')
        .select('id')
        .eq('project_id', project.id)
        .single();

      return {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        url_id: project.url_id,
        updated_at: project.updated_at,
        message_count: messageCount || 0,
        has_snapshot: !!snapshot,
      };
    }),
  );

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

  // Transform the nested business_profile data to match the expected format
  const projectWithDetails: ProjectWithDetails = {
    ...project,
    business_profile: project.tenant?.business_profiles?.[0] || null,
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
      throw new Error('Project not found');
    }

    logger.error('Failed to update project', { error, projectId, userId, updates });
    throw new Error(`Failed to update project: ${error.message}`);
  }

  return project;
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
): Promise<MessagesListResponse> {
  logger.info('Getting messages', { projectId, ...options });

  const supabase = await createUserSupabaseClient(''); // No userId needed for messages with RLS

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
 */
export async function saveMessages(
  projectId: string,
  messages: Partial<ProjectMessage>[],
): Promise<SaveMessagesResponse> {
  logger.info('Saving messages', { projectId, count: messages.length });

  const supabase = await createUserSupabaseClient(''); // No userId needed for messages with RLS

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

/*
 * ============================================================================
 * File Snapshot Operations
 * ============================================================================
 */

/**
 * Get file snapshot for a project
 */
export async function getSnapshotByProjectId(projectId: string): Promise<ProjectSnapshot | null> {
  logger.info('Getting snapshot', { projectId });

  const supabase = await createUserSupabaseClient(''); // No userId needed for snapshots with RLS

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
export async function saveSnapshot(projectId: string, input: SaveSnapshotRequest): Promise<SaveSnapshotResponse> {
  logger.info('Saving snapshot', { projectId, filesCount: Object.keys(input.files).length });

  const supabase = await createUserSupabaseClient(''); // No userId needed for snapshots with RLS

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

  const supabase = await createUserSupabaseClient(''); // No userId needed for snapshots with RLS

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
    const JSZipClass = (await import('jszip')).default;
    const zip = new JSZipClass();

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
