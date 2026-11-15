import type { GitHubStats } from '~/types/GitHub';

export function calculateStatsSummary(stats: GitHubStats): GitHubStats {
  return {
    ...stats,

    // Add any calculated fields that might be missing
  };
}
