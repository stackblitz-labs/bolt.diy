import type { ActionFunctionArgs, LoaderFunction } from '@remix-run/cloudflare';
import { json } from '@remix-run/cloudflare';

// These are injected by Vite at build time
declare const __APP_VERSION: string;
declare const __PKG_NAME: string;
declare const __PKG_DESCRIPTION: string;
declare const __PKG_LICENSE: string;
declare const __PKG_DEPENDENCIES: Record<string, string>;
declare const __PKG_DEV_DEPENDENCIES: Record<string, string>;
declare const __PKG_PEER_DEPENDENCIES: Record<string, string>;
declare const __PKG_OPTIONAL_DEPENDENCIES: Record<string, string>;
declare const __COMMIT_HASH: string;
declare const __GIT_BRANCH: string;
declare const __GIT_COMMIT_TIME: string;
declare const __GIT_AUTHOR: string;
declare const __GIT_EMAIL: string;
declare const __GIT_REMOTE_URL: string;
declare const __GIT_REPO_NAME: string;

const getGitInfo = () => {
  return {
    commitHash: __COMMIT_HASH || 'unknown',
    branch: __GIT_BRANCH || 'unknown',
    commitTime: __GIT_COMMIT_TIME || 'unknown',
    author: __GIT_AUTHOR || 'unknown',
    email: __GIT_EMAIL || 'unknown',
    remoteUrl: __GIT_REMOTE_URL || 'unknown',
    repoName: __GIT_REPO_NAME || 'unknown',
  };
};

const formatDependencies = (
  deps: Record<string, string>,
  type: 'production' | 'development' | 'peer' | 'optional',
): Array<{ name: string; version: string; type: string }> => {
  return Object.entries(deps || {}).map(([name, version]) => ({
    name,
    version: version.replace(/^\^|~/, ''),
    type,
  }));
};

const getAppResponse = () => {
  const gitInfo = getGitInfo();

  return {
    name: __PKG_NAME || 'bolt.diy',
    version: __APP_VERSION || '0.1.0',
    description: __PKG_DESCRIPTION || 'A DIY LLM interface',
    license: __PKG_LICENSE || 'MIT',
    environment: 'cloudflare',
    gitInfo,
    timestamp: new Date().toISOString(),
    runtimeInfo: {
      nodeVersion: 'cloudflare',
    },
    dependencies: {
      production: formatDependencies(__PKG_DEPENDENCIES, 'production'),
      development: formatDependencies(__PKG_DEV_DEPENDENCIES, 'development'),
      peer: formatDependencies(__PKG_PEER_DEPENDENCIES, 'peer'),
      optional: formatDependencies(__PKG_OPTIONAL_DEPENDENCIES, 'optional'),
    },
  };
};

export const loader: LoaderFunction = async ({ request: _request }) => {
  try {
    return json(getAppResponse());
  } catch (error) {
    console.error('Failed to get webapp info:', error);
    return json(
      {
        name: 'bolt.diy',
        version: '0.0.0',
        description: 'Error fetching app info',
        license: 'MIT',
        environment: 'error',
        gitInfo: {
          commitHash: 'error',
          branch: 'unknown',
          commitTime: 'unknown',
          author: 'unknown',
          email: 'unknown',
          remoteUrl: 'unknown',
          repoName: 'unknown',
        },
        timestamp: new Date().toISOString(),
        runtimeInfo: { nodeVersion: 'unknown' },
        dependencies: {
          production: [],
          development: [],
          peer: [],
          optional: [],
        },
      },
      { status: 500 },
    );
  }
};

export const action = async ({ request: _request }: ActionFunctionArgs) => {
  try {
    return json(getAppResponse());
  } catch (error) {
    console.error('Failed to get webapp info:', error);
    return json(
      {
        name: 'bolt.diy',
        version: '0.0.0',
        description: 'Error fetching app info',
        license: 'MIT',
        environment: 'error',
        gitInfo: {
          commitHash: 'error',
          branch: 'unknown',
          commitTime: 'unknown',
          author: 'unknown',
          email: 'unknown',
          remoteUrl: 'unknown',
          repoName: 'unknown',
        },
        timestamp: new Date().toISOString(),
        runtimeInfo: { nodeVersion: 'unknown' },
        dependencies: {
          production: [],
          development: [],
          peer: [],
          optional: [],
        },
      },
      { status: 500 },
    );
  }
};
