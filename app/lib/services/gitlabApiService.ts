import type {
  GitLabUserResponse,
  GitLabProjectInfo,
  GitLabEvent,
  GitLabGroupInfo,
  GitLabProjectResponse,
  GitLabCommitRequest,
} from '~/types/GitLab';

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class GitLabCache {
  private _cache = new Map<string, CacheEntry<any>>();

  set<T>(key: string, data: T, duration = CACHE_DURATION): void {
    const timestamp = Date.now();
    this._cache.set(key, {
      data,
      timestamp,
      expiresAt: timestamp + duration,
    });
  }

  get<T>(key: string): T | null {
    const entry = this._cache.get(key);

    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this._cache.delete(key);
      return null;
    }

    return entry.data;
  }

  clear(): void {
    this._cache.clear();
  }

  isExpired(key: string): boolean {
    const entry = this._cache.get(key);
    return !entry || Date.now() > entry.expiresAt;
  }
}

const gitlabCache = new GitLabCache();

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Don't retry on client errors (4xx) except 429 (rate limit)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        return response;
      }

      // Retry on server errors (5xx) and rate limits
      if (response.status >= 500 || response.status === 429) {
        if (attempt === maxRetries) {
          return response;
        }

        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      return response;
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxRetries) {
        throw lastError;
      }

      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

export class GitLabApiService {
  private _baseUrl: string;
  private _token: string;

  constructor(token: string, baseUrl = 'https://gitlab.com') {
    this._token = token;
    this._baseUrl = baseUrl;
  }

  private get _headers() {
    // Log token format for debugging
    console.log('GitLab API token info:', {
      tokenLength: this._token.length,
      tokenPrefix: this._token.substring(0, 10) + '...',
      tokenType: this._token.startsWith('glpat-') ? 'personal-access-token' : 'unknown',
    });

    return {
      'Content-Type': 'application/json',
      'PRIVATE-TOKEN': this._token,
    };
  }

  private async _request(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this._baseUrl}/api/v4${endpoint}`;
    return fetchWithRetry(url, {
      ...options,
      headers: {
        ...this._headers,
        ...options.headers,
      },
    });
  }

  async getUser(): Promise<GitLabUserResponse> {
    const response = await this._request('/user');

    if (!response.ok) {
      let errorMessage = `Failed to fetch user: ${response.status}`;

      // Provide more specific error messages based on status code
      if (response.status === 401) {
        errorMessage =
          '401 Unauthorized: Invalid or expired GitLab access token. Please check your token and ensure it has the required scopes (api, read_repository).';
      } else if (response.status === 403) {
        errorMessage = '403 Forbidden: GitLab access token does not have sufficient permissions.';
      } else if (response.status === 404) {
        errorMessage = '404 Not Found: GitLab API endpoint not found. Please check your GitLab URL configuration.';
      } else if (response.status === 429) {
        errorMessage = '429 Too Many Requests: GitLab API rate limit exceeded. Please try again later.';
      }

      // Try to get more details from response body
      try {
        const errorData = (await response.json()) as any;

        if (errorData.message) {
          errorMessage += ` Details: ${errorData.message}`;
        }
      } catch {
        // If we can't parse the error response, continue with the default message
      }

      throw new Error(errorMessage);
    }

    const user: GitLabUserResponse = await response.json();

    // Get rate limit information from headers if available
    const rateLimit = {
      limit: parseInt(response.headers.get('ratelimit-limit') || '0'),
      remaining: parseInt(response.headers.get('ratelimit-remaining') || '0'),
      reset: parseInt(response.headers.get('ratelimit-reset') || '0'),
    };

    // Handle different avatar URL fields that GitLab might return
    const processedUser = {
      ...user,
      avatar_url: user.avatar_url || (user as any).avatarUrl || (user as any).profile_image_url || null,
    };

    return { ...processedUser, rateLimit } as GitLabUserResponse & { rateLimit: typeof rateLimit };
  }

  async getProjects(membership = true, minAccessLevel = 20, perPage = 50): Promise<GitLabProjectInfo[]> {
    const cacheKey = `projects_${this._token}_${membership}_${minAccessLevel}`;
    const cached = gitlabCache.get<GitLabProjectInfo[]>(cacheKey);

    if (cached) {
      return cached;
    }

    let allProjects: any[] = [];
    let page = 1;
    const maxPages = 10; // Limit to prevent excessive API calls

    while (page <= maxPages) {
      const response = await this._request(
        `/projects?membership=${membership}&min_access_level=${minAccessLevel}&per_page=${perPage}&page=${page}&order_by=updated_at&sort=desc`,
      );

      if (!response.ok) {
        let errorMessage = `Failed to fetch projects: ${response.status} ${response.statusText}`;

        try {
          const errorData = await response.json();
          console.error('GitLab projects API error:', errorData);
          errorMessage = `Failed to fetch projects: ${JSON.stringify(errorData)}`;
        } catch (parseError) {
          console.error('Could not parse GitLab error response:', parseError);
        }
        throw new Error(errorMessage);
      }

      const projects: any[] = await response.json();

      if (projects.length === 0) {
        break;
      }

      allProjects = [...allProjects, ...projects];

      // Break if we have enough projects for initial load
      if (allProjects.length >= 100) {
        break;
      }

      page++;
    }

    // Transform to our interface
    const transformedProjects: GitLabProjectInfo[] = allProjects.map((project: any) => ({
      id: project.id,
      name: project.name,
      path_with_namespace: project.path_with_namespace,
      description: project.description,
      http_url_to_repo: project.http_url_to_repo,
      star_count: project.star_count,
      forks_count: project.forks_count,
      default_branch: project.default_branch,
      updated_at: project.updated_at,
      visibility: project.visibility,
    }));

    gitlabCache.set(cacheKey, transformedProjects);

    return transformedProjects;
  }

  async getEvents(perPage = 10): Promise<GitLabEvent[]> {
    const response = await this._request(`/events?per_page=${perPage}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch events: ${response.statusText}`);
    }

    const events: any[] = await response.json();

    return events.slice(0, 5).map((event: any) => ({
      id: event.id,
      action_name: event.action_name,
      project_id: event.project_id,
      project: event.project,
      created_at: event.created_at,
    }));
  }

  async getGroups(minAccessLevel = 10): Promise<GitLabGroupInfo[]> {
    const response = await this._request(`/groups?min_access_level=${minAccessLevel}`);

    if (response.ok) {
      return await response.json();
    }

    return [];
  }

  async getSnippets(): Promise<any[]> {
    const response = await this._request('/snippets');

    if (response.ok) {
      return await response.json();
    }

    return [];
  }

  async createProject(name: string, isPrivate: boolean = false): Promise<GitLabProjectResponse> {
    // Sanitize project name to ensure it's valid for GitLab
    const sanitizedName = name
      .replace(/[^a-zA-Z0-9-_.]/g, '-') // Replace invalid chars with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
      .toLowerCase();

    const response = await this._request('/projects', {
      method: 'POST',
      body: JSON.stringify({
        name: sanitizedName,
        path: sanitizedName, // Explicitly set path to match name
        visibility: isPrivate ? 'private' : 'public',
        initialize_with_readme: false, // Don't initialize with README to avoid conflicts
        default_branch: 'main', // Explicitly set default branch
        description: `Project created from Bolt.diy`,
      }),
    });

    if (!response.ok) {
      let errorMessage = `Failed to create project: ${response.status} ${response.statusText}`;

      try {
        const errorData = (await response.json()) as any;

        if (errorData.message) {
          if (typeof errorData.message === 'object') {
            // Handle validation errors
            const messages = Object.entries(errorData.message as Record<string, any>)
              .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
              .join('; ');
            errorMessage = `Failed to create project: ${messages}`;
          } else {
            errorMessage = `Failed to create project: ${errorData.message}`;
          }
        }
      } catch (parseError) {
        console.error('Could not parse error response:', parseError);
      }

      throw new Error(errorMessage);
    }

    return await response.json();
  }

  async getProject(owner: string, name: string): Promise<GitLabProjectResponse | null> {
    const response = await this._request(`/projects/${encodeURIComponent(`${owner}/${name}`)}`);

    if (response.ok) {
      return await response.json();
    }

    return null;
  }

  async createBranch(projectId: number, branchName: string, ref: string): Promise<any> {
    const response = await this._request(`/projects/${projectId}/repository/branches`, {
      method: 'POST',
      body: JSON.stringify({
        branch: branchName,
        ref,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create branch: ${response.statusText}`);
    }

    return await response.json();
  }

  async commitFiles(projectId: number, commitRequest: GitLabCommitRequest): Promise<any> {
    const response = await this._request(`/projects/${projectId}/repository/commits`, {
      method: 'POST',
      body: JSON.stringify(commitRequest),
    });

    if (!response.ok) {
      let errorMessage = `Failed to commit files: ${response.status} ${response.statusText}`;

      try {
        const errorData = (await response.json()) as { message?: string; error?: string };

        if (errorData.message) {
          errorMessage = errorData.message;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch {
        // If JSON parsing fails, keep the default error message
      }

      throw new Error(errorMessage);
    }

    return await response.json();
  }

  async getFile(projectId: number, filePath: string, ref: string): Promise<Response> {
    return this._request(`/projects/${projectId}/repository/files/${encodeURIComponent(filePath)}?ref=${ref}`);
  }

  async getProjectByPath(projectPath: string): Promise<GitLabProjectResponse | null> {
    try {
      // Double encode the project path as GitLab API requires it
      const encodedPath = encodeURIComponent(projectPath);
      const response = await this._request(`/projects/${encodedPath}`);

      if (response.ok) {
        return await response.json();
      }

      if (response.status === 404) {
        console.log(`Project not found: ${projectPath}`);
        return null;
      }

      const errorText = await response.text();
      console.error(`Failed to fetch project ${projectPath}:`, response.status, errorText);
      throw new Error(`Failed to fetch project: ${response.status} ${response.statusText}`);
    } catch (error) {
      if (error instanceof Error && (error.message.includes('404') || error.message.includes('Not Found'))) {
        return null;
      }

      throw error;
    }
  }

  async updateProjectVisibility(projectId: number, visibility: 'public' | 'private'): Promise<void> {
    const response = await this._request(`/projects/${projectId}`, {
      method: 'PUT',
      body: JSON.stringify({ visibility }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update project visibility: ${response.status} ${response.statusText}`);
    }
  }

  async createProjectWithFiles(
    name: string,
    isPrivate: boolean,
    files: Record<string, string>,
  ): Promise<GitLabProjectResponse> {
    // Create the project first
    const project = await this.createProject(name, isPrivate);

    // If we have files to commit, commit them
    if (Object.keys(files).length > 0) {
      // Wait a moment for the project to be fully created
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const actions = Object.entries(files).map(([filePath, content]) => ({
        action: 'create' as const,
        file_path: filePath,
        content,
      }));

      const commitRequest: GitLabCommitRequest = {
        branch: 'main',
        commit_message: 'Initial commit from Bolt.diy',
        actions,
      };

      try {
        await this.commitFiles(project.id, commitRequest);
      } catch (error) {
        console.error('Failed to commit files to new project:', error);

        /*
         * Don't throw the error, as the project was created successfully
         * The user can still access it and add files manually
         */
      }
    }

    return project;
  }

  async updateProjectWithFiles(projectId: number, files: Record<string, string>): Promise<void> {
    if (Object.keys(files).length === 0) {
      return;
    }

    // For existing projects, we need to determine which files exist and which are new
    const actions = Object.entries(files).map(([filePath, content]) => ({
      action: 'create' as const, // Start with create, we'll handle conflicts in the API response
      file_path: filePath,
      content,
    }));

    const commitRequest: GitLabCommitRequest = {
      branch: 'main',
      commit_message: 'Update from Bolt.diy',
      actions,
    };

    try {
      await this.commitFiles(projectId, commitRequest);
    } catch (error) {
      // If we get file conflicts, retry with update actions
      if (error instanceof Error && error.message.includes('already exists')) {
        const updateActions = Object.entries(files).map(([filePath, content]) => ({
          action: 'update' as const,
          file_path: filePath,
          content,
        }));

        const updateCommitRequest: GitLabCommitRequest = {
          branch: 'main',
          commit_message: 'Update from Bolt.diy',
          actions: updateActions,
        };

        await this.commitFiles(projectId, updateCommitRequest);
      } else {
        throw error;
      }
    }
  }
}

export { gitlabCache };
