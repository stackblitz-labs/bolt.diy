import { Octokit } from '@octokit/rest';
import { GitHubAuthDialog } from '~/components/@settings/tabs/github/components/GitHubAuthDialog';
import type { DeploymentService, BaseRepository, DeploymentConnection } from '~/components/deploy/shared/types';
import { getLocalStorage } from '~/lib/persistence/localStorage';
import type { GitHubRepoInfo } from '~/types/GitHub';

interface GitHubRepository extends BaseRepository {
  name: string;
  description?: string;
  url: string;
  private?: boolean;
  id: number;
  full_name: string;
  clone_url: string;
  default_branch: string;
}

export class GitHubDeploymentService implements DeploymentService<GitHubRepository> {
  getConnection(): DeploymentConnection | null {
    return getLocalStorage('github_connection');
  }

  isConnected(): boolean {
    const connection = this.getConnection();
    return !!(connection?.token && connection?.user);
  }

  async fetchRepositories(token: string): Promise<GitHubRepository[]> {
    const allRepos: GitHubRepoInfo[] = [];

    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await fetch(
        `https://api.github.com/user/repos?sort=updated&per_page=100&page=${page}&affiliation=owner,organization_member`,
        {
          headers: {
            Accept: 'application/vnd.github.v3+json',
            Authorization: `Bearer ${token.trim()}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const repos: GitHubRepoInfo[] = await response.json();

      if (repos.length === 0) {
        hasMore = false;
      } else {
        allRepos.push(...repos);
        page++;

        // Safety limit to prevent infinite loops
        if (page > 10) {
          hasMore = false;
        }
      }
    }

    return allRepos.map((repo) => ({
      name: repo.name,
      description: repo.description || undefined,
      url: repo.html_url,
      private: repo.private,
      id: parseInt(repo.id),
      full_name: repo.full_name,
      clone_url: `https://github.com/${repo.full_name}.git`,
      default_branch: repo.default_branch,
    }));
  }

  async createRepository(name: string, isPrivate: boolean, token: string): Promise<GitHubRepository> {
    const octokit = new Octokit({ auth: token });

    const { data } = await octokit.repos.createForAuthenticatedUser({
      name,
      private: isPrivate,
      auto_init: false,
    });

    return {
      name: data.name,
      description: data.description || undefined,
      url: data.html_url,
      private: data.private,
      id: data.id,
      full_name: data.full_name,
      clone_url: data.clone_url,
      default_branch: data.default_branch || 'main',
    };
  }

  async repositoryExists(name: string, token: string): Promise<GitHubRepository | null> {
    try {
      const connection = this.getConnection();

      if (!connection?.user?.login) {
        return null;
      }

      const octokit = new Octokit({ auth: token });

      const { data } = await octokit.repos.get({
        owner: connection.user.login,
        repo: name,
      });

      return {
        name: data.name,
        description: data.description || undefined,
        url: data.html_url,
        private: data.private,
        id: data.id,
        full_name: data.full_name,
        clone_url: data.clone_url,
        default_branch: data.default_branch || 'main',
      };
    } catch (error: any) {
      if (error.status === 404) {
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

    if (!connection?.user?.login) {
      throw new Error('GitHub user not found');
    }

    // Extract repo name from URL or use the sanitized name
    const repoName = repoUrl.split('/').pop() || '';
    const octokit = new Octokit({ auth: token });

    // Get the default branch
    const { data: repoData } = await octokit.repos.get({
      owner: connection.user.login,
      repo: repoName,
    });

    const defaultBranch = repoData.default_branch || 'main';

    // Get the latest commit SHA for the branch
    let latestCommitSha: string;

    try {
      const { data: refData } = await octokit.git.getRef({
        owner: connection.user.login,
        repo: repoName,
        ref: `heads/${defaultBranch}`,
      });

      latestCommitSha = refData.object.sha;
    } catch (error: any) {
      if (error.status === 404) {
        // Branch doesn't exist, create it with an initial commit
        const { data: blobData } = await octokit.git.createBlob({
          owner: connection.user.login,
          repo: repoName,
          content: btoa('# ' + repoName),
          encoding: 'base64',
        });

        const { data: treeData } = await octokit.git.createTree({
          owner: connection.user.login,
          repo: repoName,
          tree: [
            {
              path: 'README.md',
              mode: '100644',
              type: 'blob',
              sha: blobData.sha,
            },
          ],
        });

        const { data: commitData } = await octokit.git.createCommit({
          owner: connection.user.login,
          repo: repoName,
          message: 'Initial commit',
          tree: treeData.sha,
        });

        await octokit.git.createRef({
          owner: connection.user.login,
          repo: repoName,
          ref: `refs/heads/${defaultBranch}`,
          sha: commitData.sha,
        });

        latestCommitSha = commitData.sha;
      } else {
        throw error;
      }
    }

    // Create blobs for all files
    const fileEntries = Object.entries(files);
    const pushedFiles: Array<{ path: string; size: number }> = [];

    const blobs = await Promise.all(
      fileEntries.map(async ([path, content], index) => {
        onProgress?.(index + 1, fileEntries.length);

        const { data } = await octokit.git.createBlob({
          owner: connection.user.login,
          repo: repoName,
          content: btoa(content),
          encoding: 'base64',
        });

        pushedFiles.push({
          path,
          size: new Blob([content]).size,
        });

        return {
          path,
          mode: '100644' as const,
          type: 'blob' as const,
          sha: data.sha,
        };
      }),
    );

    // Create a new tree with all files
    const { data: newTree } = await octokit.git.createTree({
      owner: connection.user.login,
      repo: repoName,
      base_tree: latestCommitSha,
      tree: blobs,
    });

    // Create a new commit
    const { data: newCommit } = await octokit.git.createCommit({
      owner: connection.user.login,
      repo: repoName,
      message: `Deploy from Bolt.diy`,
      tree: newTree.sha,
      parents: [latestCommitSha],
    });

    // Update the reference
    await octokit.git.updateRef({
      owner: connection.user.login,
      repo: repoName,
      ref: `heads/${defaultBranch}`,
      sha: newCommit.sha,
    });

    return pushedFiles;
  }

  sanitizeRepoName(name: string): string {
    return (
      name
        .toLowerCase()
        .replace(/[\s_]+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 100) || 'my-project'
    );
  }

  getAuthDialogComponent() {
    return GitHubAuthDialog;
  }

  getServiceName(): string {
    return 'GitHub';
  }

  getStorageKey(): string {
    return 'github_connection';
  }
}

export const githubDeploymentService = new GitHubDeploymentService();
