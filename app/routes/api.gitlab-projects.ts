import { json } from '@remix-run/cloudflare';
import { withSecurity } from '~/lib/security';
import type { GitLabProjectInfo } from '~/types/GitLab';

interface GitLabProject {
  id: number;
  name: string;
  path_with_namespace: string;
  description: string;
  web_url: string;
  http_url_to_repo: string;
  star_count: number;
  forks_count: number;
  updated_at: string;
  default_branch: string;
  visibility: string;
}

async function gitlabProjectsLoader({ request }: { request: Request }) {
  try {
    const body: any = await request.json();
    const { token, gitlabUrl = 'https://gitlab.com' } = body;

    if (!token) {
      return json({ error: 'GitLab token is required' }, { status: 400 });
    }

    // Fetch user's projects from GitLab API
    const url = `${gitlabUrl}/api/v4/projects?membership=true&per_page=100&order_by=updated_at&sort=desc`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'User-Agent': 'bolt.diy-app',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return json({ error: 'Invalid GitLab token' }, { status: 401 });
      }

      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('GitLab API error:', response.status, errorText);

      return json(
        {
          error: `GitLab API error: ${response.status}`,
        },
        { status: response.status },
      );
    }

    const projects: GitLabProject[] = await response.json();

    // Transform to our GitLabProjectInfo format
    const transformedProjects: GitLabProjectInfo[] = projects.map((project) => ({
      id: project.id,
      name: project.name,
      path_with_namespace: project.path_with_namespace,
      description: project.description || '',
      http_url_to_repo: project.http_url_to_repo,
      star_count: project.star_count,
      forks_count: project.forks_count,
      updated_at: project.updated_at,
      default_branch: project.default_branch,
      visibility: project.visibility,
    }));

    return json({
      projects: transformedProjects,
      total: transformedProjects.length,
    });
  } catch (error) {
    console.error('Failed to fetch GitLab projects:', error);

    if (error instanceof Error) {
      if (error.message.includes('fetch')) {
        return json(
          {
            error: 'Failed to connect to GitLab. Please check your network connection.',
          },
          { status: 503 },
        );
      }

      return json(
        {
          error: `Failed to fetch projects: ${error.message}`,
        },
        { status: 500 },
      );
    }

    return json(
      {
        error: 'An unexpected error occurred while fetching projects',
      },
      { status: 500 },
    );
  }
}

export const action = withSecurity(gitlabProjectsLoader);
