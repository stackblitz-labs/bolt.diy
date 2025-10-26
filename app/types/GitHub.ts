export interface GitHubUserResponse {
  login: string;
  avatar_url: string;
  html_url: string;
  name: string;
  bio: string;
  public_repos: number;
  followers: number;
  following: number;
  public_gists: number;
  created_at: string;
  updated_at: string;
}

export interface GitLabProjectInfo {
  id: string;
  name: string;
  full_name: string;
  html_url: string;
  description: string;
  stargazers_count: number;
  forks_count: number;
  default_branch: string;
  updated_at: string;
  language: string;
  languages_url: string;
}

export interface GitHubRepoInfo {
  id: string;
  name: string;
  full_name: string;
  html_url: string;
  description: string;
  stargazers_count: number;
  forks_count: number;
  default_branch: string;
  updated_at: string;
  language: string;
  languages_url: string;
  private?: boolean;
  topics?: string[];
  archived?: boolean;
  fork?: boolean;
  size?: number;
  contributors_count?: number;
  branches_count?: number;
  issues_count?: number;
  pull_requests_count?: number;
  license?: {
    name: string;
    spdx_id: string;
  };
}

export interface GitHubContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string;
  type: string;
  content: string;
  encoding: string;
}

export interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
}

export interface GitHubBlobResponse {
  content: string;
  encoding: string;
  sha: string;
  size: number;
  url: string;
}

export interface GitHubOrganization {
  login: string;
  name?: string;
  avatar_url: string;
  description: string;
  html_url: string;
  public_repos?: number;
  followers?: number;
}

export interface GitHubEvent {
  id: string;
  type: string;
  created_at: string;
  repo: {
    name: string;
    url: string;
  };
  payload: {
    action?: string;
    ref?: string;
    ref_type?: string;
    description?: string;
  };
}

export interface GitHubLanguageStats {
  [key: string]: number;
}

export interface GitHubStats {
  repos: GitHubRepoInfo[];
  totalStars: number;
  totalForks: number;
  organizations: GitHubOrganization[];
  recentActivity: GitHubEvent[];
  languages: GitHubLanguageStats;
  totalGists: number;
  publicRepos: number;
  privateRepos: number;
  stars: number;
  forks: number;
  followers: number;
  publicGists: number;
  privateGists: number;
  lastUpdated: string;
  totalBranches?: number;
  totalContributors?: number;
  totalIssues?: number;
  totalPullRequests?: number;
  mostUsedLanguages?: Array<{
    language: string;
    bytes: number;
    repos: number;
  }>;
}

export interface GitHubConnection {
  user: GitHubUserResponse | null;
  token: string;
  tokenType: 'classic' | 'fine-grained';
  stats?: GitHubStats;
  rateLimit?: GitHubRateLimits;
}

export interface GitHubTokenInfo {
  token: string;
  scope: string[];
  avatar_url: string;
  name: string | null;
  created_at: string;
  followers: number;
}

export interface GitHubRateLimits {
  limit: number;
  remaining: number;
  reset: Date;
  used: number;
}

export interface GitHubAuthState {
  username: string;
  tokenInfo: GitHubTokenInfo | null;
  isConnected: boolean;
  isVerifying: boolean;
  isLoadingRepos: boolean;
  rateLimits?: GitHubRateLimits;
}

export interface RepositoryStats {
  totalFiles: number;
  totalSize: number;
  languages: Record<string, number>;
  hasPackageJson: boolean;
  hasDependencies: boolean;
}
