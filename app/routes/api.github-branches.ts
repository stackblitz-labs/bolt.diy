import { json } from '@remix-run/cloudflare';
import { getApiKeysFromCookie } from '~/lib/api/cookies';
import { withSecurity } from '~/lib/security';

interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
}

interface BranchInfo {
  name: string;
  sha: string;
  protected: boolean;
  isDefault: boolean;
}

async function githubBranchesLoader({ request, context }: { request: Request; context: any }) {
  try {
    let owner: string;
    let repo: string;
    let githubToken: string;

    if (request.method === 'POST') {
      // Handle POST request with token in body (from BranchSelector)
      const body: any = await request.json();
      owner = body.owner;
      repo = body.repo;
      githubToken = body.token;

      if (!owner || !repo) {
        return json({ error: 'Owner and repo parameters are required' }, { status: 400 });
      }

      if (!githubToken) {
        return json({ error: 'GitHub token is required' }, { status: 400 });
      }
    } else {
      // Handle GET request with params and cookie token (backwards compatibility)
      const url = new URL(request.url);
      owner = url.searchParams.get('owner') || '';
      repo = url.searchParams.get('repo') || '';

      if (!owner || !repo) {
        return json({ error: 'Owner and repo parameters are required' }, { status: 400 });
      }

      // Get API keys from cookies (server-side only)
      const cookieHeader = request.headers.get('Cookie');
      const apiKeys = getApiKeysFromCookie(cookieHeader);

      // Try to get GitHub token from various sources
      githubToken =
        apiKeys.GITHUB_API_KEY ||
        apiKeys.VITE_GITHUB_ACCESS_TOKEN ||
        context?.cloudflare?.env?.GITHUB_TOKEN ||
        context?.cloudflare?.env?.VITE_GITHUB_ACCESS_TOKEN ||
        process.env.GITHUB_TOKEN ||
        process.env.VITE_GITHUB_ACCESS_TOKEN ||
        '';
    }

    if (!githubToken) {
      return json({ error: 'GitHub token not found' }, { status: 401 });
    }

    // First, get repository info to know the default branch
    const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        Authorization: `Bearer ${githubToken}`,
        'User-Agent': 'bolt.diy-app',
      },
    });

    if (!repoResponse.ok) {
      if (repoResponse.status === 404) {
        return json({ error: 'Repository not found' }, { status: 404 });
      }

      if (repoResponse.status === 401) {
        return json({ error: 'Invalid GitHub token' }, { status: 401 });
      }

      throw new Error(`GitHub API error: ${repoResponse.status}`);
    }

    const repoInfo: any = await repoResponse.json();
    const defaultBranch = repoInfo.default_branch;

    // Fetch branches
    const branchesResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches?per_page=100`, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        Authorization: `Bearer ${githubToken}`,
        'User-Agent': 'bolt.diy-app',
      },
    });

    if (!branchesResponse.ok) {
      throw new Error(`Failed to fetch branches: ${branchesResponse.status}`);
    }

    const branches: GitHubBranch[] = await branchesResponse.json();

    // Transform to our format
    const transformedBranches: BranchInfo[] = branches.map((branch) => ({
      name: branch.name,
      sha: branch.commit.sha,
      protected: branch.protected,
      isDefault: branch.name === defaultBranch,
    }));

    // Sort branches with default branch first, then alphabetically
    transformedBranches.sort((a, b) => {
      if (a.isDefault) {
        return -1;
      }

      if (b.isDefault) {
        return 1;
      }

      return a.name.localeCompare(b.name);
    });

    return json({
      branches: transformedBranches,
      defaultBranch,
      total: transformedBranches.length,
    });
  } catch (error) {
    console.error('Failed to fetch GitHub branches:', error);

    if (error instanceof Error) {
      if (error.message.includes('fetch')) {
        return json(
          {
            error: 'Failed to connect to GitHub. Please check your network connection.',
          },
          { status: 503 },
        );
      }

      return json(
        {
          error: `Failed to fetch branches: ${error.message}`,
        },
        { status: 500 },
      );
    }

    return json(
      {
        error: 'An unexpected error occurred while fetching branches',
      },
      { status: 500 },
    );
  }
}

export const loader = withSecurity(githubBranchesLoader);
export const action = withSecurity(githubBranchesLoader);
