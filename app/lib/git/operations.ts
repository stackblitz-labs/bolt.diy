import { toast } from 'react-toastify';
import { ensureEncryption, lookupSavedPassword } from '~/lib/auth';
import { Octokit, type RestEndpointMethodTypes } from '@octokit/rest';
import axios from 'axios';
import { extractRelativePath } from '~/utils/diff';
import type { FileMap } from '~/lib/stores/files';

export const handleGitPush = async (provider: 'github' | 'gitlab', getFiles: FileMap) => {
  const repoName = prompt(
    `Please enter a name for your new ${provider === 'github' ? 'GitHub' : 'GitLab'} repository:`,
    'bolt-generated-project',
  );

  if (!repoName) {
    toast.error('Repository name is required');
    return;
  }

  if (!(await ensureEncryption())) {
    toast.error('Failed to initialize secure storage');
    return;
  }

  const auth = await lookupSavedPassword(`${provider}.com`);
  const files = getFiles;

  if (auth?.username && auth?.password) {
    if (provider === 'github') {
      await pushToGitHub(repoName, auth.username, auth.password, files);
    } else {
      await pushToGitLab(repoName, auth.username, auth.password, files);
    }
  } else {
    toast.info(`Please set up your ${provider === 'github' ? 'GitHub' : 'GitLab'} credentials in the Connections tab`);
  }
};

export const checkGitCredentials = async (): Promise<{ github: boolean; gitlab: boolean }> => {
  const githubAuth = await lookupSavedPassword('github.com');
  const gitlabAuth = await lookupSavedPassword('gitlab.com');

  return {
    github: !!(githubAuth?.username && githubAuth?.password),
    gitlab: !!(gitlabAuth?.username && gitlabAuth?.password),
  };
};

const pushToGitHub = async (repoName: string, username: string, token: string, files: FileMap) => {
  try {
    const octokit = new Octokit({
      auth: token,
      headers: {
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    let repo: RestEndpointMethodTypes['repos']['get']['response']['data'];

    try {
      const resp = await octokit.repos.get({ owner: username, repo: repoName });
      repo = resp.data;
    } catch (error: any) {
      if (error.status === 404) {
        const shouldCreate = confirm(`Repository "${repoName}" doesn't exist. Would you like to create it?`);

        if (!shouldCreate) {
          throw new Error('Repository creation cancelled');
        }

        const { data: newRepo } = await octokit.repos.createForAuthenticatedUser({
          name: repoName,
          private: false,
          auto_init: true,
        });
        repo = newRepo;
      } else {
        throw error;
      }
    }

    if (!files || Object.keys(files).length === 0) {
      throw new Error('No files found to push');
    }

    const blobs = await Promise.all(
      Object.entries(files).map(async ([filePath, dirent]) => {
        if (dirent?.type === 'file' && dirent.content) {
          const { data: blob } = await octokit.git.createBlob({
            owner: repo.owner.login,
            repo: repo.name,
            content: Buffer.from(dirent.content).toString('base64'),
            encoding: 'base64',
          });
          return { path: extractRelativePath(filePath), sha: blob.sha };
        }

        return null;
      }),
    );

    const validBlobs = blobs.filter(Boolean);

    if (validBlobs.length === 0) {
      throw new Error('No valid files to push');
    }

    const { data: ref } = await octokit.git.getRef({
      owner: repo.owner.login,
      repo: repo.name,
      ref: `heads/${repo.default_branch || 'main'}`,
    });
    const latestCommitSha = ref.object.sha;

    const { data: newTree } = await octokit.git.createTree({
      owner: repo.owner.login,
      repo: repo.name,
      base_tree: latestCommitSha,
      tree: validBlobs.map((blob) => ({
        path: blob!.path,
        mode: '100644',
        type: 'blob',
        sha: blob!.sha,
      })),
    });

    const { data: newCommit } = await octokit.git.createCommit({
      owner: repo.owner.login,
      repo: repo.name,
      message: 'Initial commit from your app',
      tree: newTree.sha,
      parents: [latestCommitSha],
    });

    await octokit.git.updateRef({
      owner: repo.owner.login,
      repo: repo.name,
      ref: `heads/${repo.default_branch || 'main'}`,
      sha: newCommit.sha,
    });

    toast.success(`Repository created and code pushed: ${repo.html_url}`);

    return repo.html_url;
  } catch (error) {
    console.error('Error pushing to GitHub:', error);

    if (error instanceof Error) {
      if (error.message === 'Repository creation cancelled') {
        throw error;
      }

      if ('status' in error && error.status === 401) {
        toast.error('Authentication failed. Please check your GitHub token in the Connections tab.');
      } else {
        toast.error('Failed to push to GitHub. Please try again.');
      }
    }

    throw error;
  }
};

const pushToGitLab = async (repoName: string, username: string, token: string, files: FileMap) => {
  try {
    const gitlab = axios.create({
      baseURL: 'https://gitlab.com/api/v4',
      headers: {
        'PRIVATE-TOKEN': token,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    let project: { id: any; default_branch: any; web_url: any };

    gitlab.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          throw new Error('Authentication failed');
        } else if (error.response?.status === 404) {
          const shouldCreate = confirm(`Repository "${repoName}" doesn't exist. Would you like to create it?`);

          if (!shouldCreate) {
            throw new Error('Repository creation cancelled');
          }

          const { data } = await gitlab.post('/projects', {
            name: repoName,
            visibility: 'public',
            initialize_with_readme: true,
          });
          project = data;
        } else {
          throw new Error(error.response?.data?.message || error.message);
        }
      },
    );

    try {
      const { data } = await gitlab.get(`/projects/${username}/${repoName}`);
      project = data;
    } catch (error: any) {}

    if (!files || Object.keys(files).length === 0) {
      throw new Error('No files found to push');
    }

    const actions = await Promise.all(
      Object.entries(files)
        .filter((entry) => {
          const [, dirent] = entry;
          return dirent?.type === 'file' && typeof dirent?.content === 'string';
        })
        .map(async ([filePath, dirent]) => {
          const relativePath = extractRelativePath(filePath);

          try {
            await axios.get(`/projects/${project.id}/repository/files/${encodeURIComponent(relativePath)}`, {
              params: { ref: project.default_branch || 'main' },
              baseURL: 'https://gitlab.com/api/v4',
              headers: {
                'PRIVATE-TOKEN': token,
                'Content-Type': 'application/json',
              },
            });

            return {
              action: 'update',
              file_path: relativePath,
              content: dirent.content,
            };
          } catch (error) {
            console.error('File on gitlab', error);
            return {
              action: 'create',
              file_path: relativePath,
              content: dirent.content,
            };
          }
        }),
    );

    if (actions.length === 0) {
      throw new Error('No valid files to push');
    }

    await gitlab.post(`/projects/${project.id}/repository/commits`, {
      branch: project.default_branch || 'main',
      commit_message: 'Initial commit from your app',
      actions,
    });

    toast.success(`Repository created and code pushed: ${project.web_url}`);

    return project.web_url;
  } catch (error) {
    console.error('Error pushing to GitLab:', error);

    if (error instanceof Error) {
      if (error.message === 'Repository creation cancelled') {
        throw error;
      }

      if (error.message === 'Authentication failed') {
        toast.error('Authentication failed. Please check your GitLab token in the Connections tab.');
      } else {
        toast.error(`Failed to push to GitLab: ${error.message}`);
      }
    } else {
      toast.error('Failed to push to GitLab. Please try again.');
    }

    throw error;
  }
};
