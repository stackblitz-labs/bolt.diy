import { json, type LoaderFunction } from '@remix-run/cloudflare';

interface GitInfo {
  local: {
    commitHash: string;
    branch: string;
    commitTime: string;
    author: string;
    email: string;
    remoteUrl: string;
    repoName: string;
  };
  github?: {
    currentRepo?: {
      fullName: string;
      defaultBranch: string;
      stars: number;
      forks: number;
      openIssues?: number;
    };
  };
  isForked?: boolean;
}

// These values will be replaced at build time
declare const __COMMIT_HASH: string;
declare const __GIT_BRANCH: string;
declare const __GIT_COMMIT_TIME: string;
declare const __GIT_AUTHOR: string;
declare const __GIT_EMAIL: string;
declare const __GIT_REMOTE_URL: string;
declare const __GIT_REPO_NAME: string;

export const loader: LoaderFunction = async () => {
  const gitInfo: GitInfo = {
    local: {
      commitHash: typeof __COMMIT_HASH !== 'undefined' ? __COMMIT_HASH : 'development',
      branch: typeof __GIT_BRANCH !== 'undefined' ? __GIT_BRANCH : 'main',
      commitTime: typeof __GIT_COMMIT_TIME !== 'undefined' ? __GIT_COMMIT_TIME : new Date().toISOString(),
      author: typeof __GIT_AUTHOR !== 'undefined' ? __GIT_AUTHOR : 'development',
      email: typeof __GIT_EMAIL !== 'undefined' ? __GIT_EMAIL : 'development@local',
      remoteUrl: typeof __GIT_REMOTE_URL !== 'undefined' ? __GIT_REMOTE_URL : 'local',
      repoName: typeof __GIT_REPO_NAME !== 'undefined' ? __GIT_REPO_NAME : 'bolt.diy',
    },
  };

  return json(gitInfo);
};
