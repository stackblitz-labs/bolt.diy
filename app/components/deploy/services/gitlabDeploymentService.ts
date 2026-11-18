import { GitLabAuthDialog } from '~/components/@settings/tabs/gitlab/components/GitLabAuthDialog';
import type { DeploymentService, BaseRepository, DeploymentConnection } from '~/components/deploy/shared/types';
import { getLocalStorage } from '~/lib/persistence/localStorage';
import { GitLabApiService } from '~/lib/services/gitlabApiService';

interface GitLabRepository extends BaseRepository {
  name: string;
  description?: string;
  url: string;
  visibility?: string;
  id: number;
  path_with_namespace: string;
  http_url_to_repo: string;
  default_branch: string;
}

export class GitLabDeploymentService implements DeploymentService<GitLabRepository> {
  getConnection(): DeploymentConnection | null {
    return getLocalStorage('gitlab_connection');
  }

  isConnected(): boolean {
    const connection = this.getConnection();
    return !!(connection?.token && connection?.user);
  }

  async fetchRepositories(token: string): Promise<GitLabRepository[]> {
    const connection = this.getConnection();
    const gitlabUrl = connection?.gitlabUrl || 'https://gitlab.com';
    const apiService = new GitLabApiService(token, gitlabUrl);

    const projects = await apiService.getProjects();

    return projects.map((project) => ({
      name: project.name,
      description: project.description || undefined,
      url: project.http_url_to_repo,
      visibility: project.visibility,
      id: project.id,
      path_with_namespace: project.path_with_namespace,
      http_url_to_repo: project.http_url_to_repo,
      default_branch: project.default_branch,
    }));
  }

  async createRepository(name: string, isPrivate: boolean, token: string): Promise<GitLabRepository> {
    const connection = this.getConnection();
    const gitlabUrl = connection?.gitlabUrl || 'https://gitlab.com';

    /*
     * GitLab's createProjectWithFiles will create the project
     * We'll create an empty project first, then push files separately
     */
    const response = await fetch(`${gitlabUrl}/api/v4/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PRIVATE-TOKEN': token,
      },
      body: JSON.stringify({
        name,
        visibility: isPrivate ? 'private' : 'public',
        initialize_with_readme: false,
      }),
    });

    if (!response.ok) {
      const error: any = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || `Failed to create GitLab project: ${response.statusText}`);
    }

    const project: any = await response.json();

    return {
      name: project.name,
      description: project.description || undefined,
      url: project.http_url_to_repo,
      visibility: project.visibility,
      id: project.id,
      path_with_namespace: project.path_with_namespace,
      http_url_to_repo: project.http_url_to_repo,
      default_branch: project.default_branch || 'main',
    };
  }

  async repositoryExists(name: string, token: string): Promise<GitLabRepository | null> {
    try {
      const connection = this.getConnection();

      if (!connection?.user?.username) {
        return null;
      }

      const gitlabUrl = connection.gitlabUrl || 'https://gitlab.com';
      const apiService = new GitLabApiService(token, gitlabUrl);

      const projectPath = `${connection.user.username}/${name}`;
      const project = await apiService.getProjectByPath(projectPath);

      if (!project) {
        return null;
      }

      return {
        name: project.name,
        description: project.description || undefined,
        url: project.http_url_to_repo,
        visibility: project.visibility,
        id: project.id,
        path_with_namespace: project.path_with_namespace,
        http_url_to_repo: project.http_url_to_repo,
        default_branch: project.default_branch,
      };
    } catch (error: any) {
      if (error.message?.includes('404') || error.message?.includes('not found')) {
        return null;
      }

      throw error;
    }
  }

  async pushFiles(
    repoUrl: string,
    files: Record<string, string>,
    token: string,
    onProgress?: (current: number, total: number) => void,
  ): Promise<Array<{ path: string; size: number }>> {
    const connection = this.getConnection();

    if (!connection?.user?.username) {
      throw new Error('GitLab user not found');
    }

    const gitlabUrl = connection.gitlabUrl || 'https://gitlab.com';
    const apiService = new GitLabApiService(token, gitlabUrl);

    /*
     * Extract project ID from the repo URL or get it from the existing project
     * The repoUrl is the http_url_to_repo, we need to find the project
     */
    const repoName = repoUrl.split('/').pop()?.replace('.git', '') || '';
    const projectPath = `${connection.user.username}/${repoName}`;

    const project = await apiService.getProjectByPath(projectPath);

    if (!project) {
      throw new Error(`Project ${projectPath} not found`);
    }

    // Use the GitLab API service's updateProjectWithFiles method
    await apiService.updateProjectWithFiles(project.id, files);

    // Build the list of pushed files
    const pushedFiles = Object.entries(files).map(([path, content]) => ({
      path,
      size: new TextEncoder().encode(content).length,
    }));

    // Report progress
    onProgress?.(pushedFiles.length, pushedFiles.length);

    return pushedFiles;
  }

  sanitizeRepoName(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9-_.]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();
  }

  getAuthDialogComponent() {
    return GitLabAuthDialog;
  }

  getServiceName(): string {
    return 'GitLab';
  }

  getStorageKey(): string {
    return 'gitlab_connection';
  }

  /**
   * Update project visibility (public/private)
   */
  async updateProjectVisibility(projectId: number, isPrivate: boolean, token: string): Promise<void> {
    const connection = this.getConnection();
    const gitlabUrl = connection?.gitlabUrl || 'https://gitlab.com';
    const apiService = new GitLabApiService(token, gitlabUrl);

    await apiService.updateProjectVisibility(projectId, isPrivate ? 'private' : 'public');
  }
}

export const gitlabDeploymentService = new GitLabDeploymentService();
