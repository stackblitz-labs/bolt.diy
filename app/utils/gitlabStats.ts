import type { GitLabProjectInfo, GitLabStats } from '~/types/GitLab';

export function calculateProjectStats(projects: any[]): { projects: GitLabProjectInfo[] } {
  const projectStats = {
    projects: projects.map((project: any) => ({
      id: project.id,
      name: project.name,
      path_with_namespace: project.path_with_namespace,
      description: project.description,
      http_url_to_repo: project.http_url_to_repo,
      star_count: project.star_count || 0,
      forks_count: project.forks_count || 0,
      default_branch: project.default_branch,
      updated_at: project.updated_at,
      visibility: project.visibility,
    })),
  };

  return projectStats;
}

export function calculateStatsSummary(
  projects: GitLabProjectInfo[],
  events: any[],
  groups: any[],
  snippets: any[],
  user: any,
): GitLabStats {
  const totalStars = projects.reduce((sum, p) => sum + (p.star_count || 0), 0);
  const totalForks = projects.reduce((sum, p) => sum + (p.forks_count || 0), 0);
  const privateProjects = projects.filter((p) => p.visibility === 'private').length;

  const recentActivity = events.slice(0, 5).map((event: any) => ({
    id: event.id,
    action_name: event.action_name,
    project_id: event.project_id,
    project: event.project,
    created_at: event.created_at,
  }));

  return {
    projects,
    recentActivity,
    totalSnippets: snippets.length,
    publicProjects: projects.filter((p) => p.visibility === 'public').length,
    privateProjects,
    stars: totalStars,
    forks: totalForks,
    followers: user.followers || 0,
    snippets: snippets.length,
    groups,
    lastUpdated: new Date().toISOString(),
  };
}
