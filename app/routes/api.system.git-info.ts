import { json, type LoaderFunction, type LoaderFunctionArgs } from '@remix-run/cloudflare';

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
  timestamp?: string;
}

// Define context type
interface AppContext {
  env?: {
    GITHUB_ACCESS_TOKEN?: string;
  };
}

interface GitHubRepo {
  name: string;
  full_name: string;
  html_url: string;
  description: string;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  languages_url: string;
}

interface GitHubGist {
  id: string;
  html_url: string;
  description: string;
}

// These values will be replaced at build time
declare const __COMMIT_HASH: string;
declare const __GIT_BRANCH: string;
declare const __GIT_COMMIT_TIME: string;
declare const __GIT_AUTHOR: string;
declare const __GIT_EMAIL: string;
declare const __GIT_REMOTE_URL: string;
declare const __GIT_REPO_NAME: string;

/*
 * Remove unused variable to fix linter error
 * declare const __GIT_REPO_URL: string;
 */

export const loader: LoaderFunction = async ({ request, context }: LoaderFunctionArgs & { context: AppContext }) => {
  console.log('Git info API called with URL:', request.url);

  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  console.log('Git info action:', action);

  if (action === 'getUser' || action === 'getRepos' || action === 'getOrgs' || action === 'getActivity') {
    // Use server-side token instead of client-side token
    const serverGithubToken = process.env.GITHUB_ACCESS_TOKEN || context.env?.GITHUB_ACCESS_TOKEN;
    const cookieToken = request.headers
      .get('Cookie')
      ?.split(';')
      .find((cookie) => cookie.trim().startsWith('githubToken='))
      ?.split('=')[1];

    // Also check for token in Authorization header
    const authHeader = request.headers.get('Authorization');
    const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    const token = serverGithubToken || headerToken || cookieToken;

    console.log(
      'Using GitHub token from:',
      serverGithubToken ? 'server env' : headerToken ? 'auth header' : cookieToken ? 'cookie' : 'none',
    );

    if (!token) {
      console.error('No GitHub token available');
      return json(
        { error: 'No GitHub token available' },
        {
          status: 401,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          },
        },
      );
    }

    try {
      if (action === 'getUser') {
        const response = await fetch('https://api.github.com/user', {
          headers: {
            Accept: 'application/vnd.github.v3+json',
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          console.error('GitHub user API error:', response.status);
          throw new Error(`GitHub API error: ${response.status}`);
        }

        const userData = await response.json();

        return json(
          { user: userData },
          {
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            },
          },
        );
      }

      if (action === 'getRepos') {
        const reposResponse = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
          headers: {
            Accept: 'application/vnd.github.v3+json',
            Authorization: `Bearer ${token}`,
          },
        });

        if (!reposResponse.ok) {
          console.error('GitHub repos API error:', reposResponse.status);
          throw new Error(`GitHub API error: ${reposResponse.status}`);
        }

        const repos = (await reposResponse.json()) as GitHubRepo[];

        // Get user's gists
        const gistsResponse = await fetch('https://api.github.com/gists', {
          headers: {
            Accept: 'application/vnd.github.v3+json',
            Authorization: `Bearer ${token}`,
          },
        });

        const gists = gistsResponse.ok ? ((await gistsResponse.json()) as GitHubGist[]) : [];

        // Calculate language statistics
        const languageStats: Record<string, number> = {};
        let totalStars = 0;
        let totalForks = 0;

        for (const repo of repos) {
          totalStars += repo.stargazers_count || 0;
          totalForks += repo.forks_count || 0;

          if (repo.language && repo.language !== 'null') {
            languageStats[repo.language] = (languageStats[repo.language] || 0) + 1;
          }

          /*
           * Optionally fetch languages for each repo for more accurate stats
           * This is commented out to avoid rate limiting
           *
           * if (repo.languages_url) {
           *   try {
           *     const langResponse = await fetch(repo.languages_url, {
           *       headers: {
           *         Accept: 'application/vnd.github.v3+json',
           *         Authorization: `Bearer ${token}`,
           *       },
           *     });
           *
           *     if (langResponse.ok) {
           *       const languages = await langResponse.json();
           *       Object.keys(languages).forEach(lang => {
           *         languageStats[lang] = (languageStats[lang] || 0) + languages[lang];
           *       });
           *     }
           *   } catch (error) {
           *     console.error(`Error fetching languages for ${repo.name}:`, error);
           *   }
           * }
           */
        }

        return json(
          {
            repos,
            stats: {
              totalStars,
              totalForks,
              languages: languageStats,
              totalGists: gists.length,
            },
          },
          {
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            },
          },
        );
      }

      if (action === 'getOrgs') {
        const response = await fetch('https://api.github.com/user/orgs', {
          headers: {
            Accept: 'application/vnd.github.v3+json',
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          console.error('GitHub orgs API error:', response.status);
          throw new Error(`GitHub API error: ${response.status}`);
        }

        const orgs = await response.json();

        return json(
          { organizations: orgs },
          {
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            },
          },
        );
      }

      if (action === 'getActivity') {
        const username = request.headers
          .get('Cookie')
          ?.split(';')
          .find((cookie) => cookie.trim().startsWith('githubUsername='))
          ?.split('=')[1];

        if (!username) {
          console.error('GitHub username not found in cookies');
          return json(
            { error: 'GitHub username not found in cookies' },
            {
              status: 400,
              headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
              },
            },
          );
        }

        const response = await fetch(`https://api.github.com/users/${username}/events?per_page=30`, {
          headers: {
            Accept: 'application/vnd.github.v3+json',
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          console.error('GitHub activity API error:', response.status);
          throw new Error(`GitHub API error: ${response.status}`);
        }

        const events = await response.json();

        return json(
          { recentActivity: events },
          {
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            },
          },
        );
      }
    } catch (error) {
      console.error('GitHub API error:', error);
      return json(
        { error: error instanceof Error ? error.message : 'Unknown error' },
        {
          status: 500,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          },
        },
      );
    }
  }

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
    timestamp: new Date().toISOString(),
  };

  return json(gitInfo, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    },
  });
};
