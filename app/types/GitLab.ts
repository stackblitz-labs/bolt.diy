// GitLab API Response Types
export interface GitLabUserResponse {
  id: number;
  username: string;
  name: string;
  avatar_url: string;
  web_url: string;
  created_at: string;
  bio: string;
  public_repos: number;
  followers: number;
  following: number;
}

export interface GitLabProjectInfo {
  id: number;
  name: string;
  path_with_namespace: string;
  description: string;
  http_url_to_repo: string;
  star_count: number;
  forks_count: number;
  updated_at: string;
  default_branch: string;
  visibility: string;
}

export interface GitLabGroupInfo {
  id: number;
  name: string;
  web_url: string;
  avatar_url: string;
}

export interface GitLabEvent {
  id: number;
  action_name: string;
  project_id: number;
  project: {
    name: string;
    path_with_namespace: string;
  };
  created_at: string;
}

export interface GitLabStats {
  projects: GitLabProjectInfo[];
  recentActivity: GitLabEvent[];
  totalSnippets: number;
  publicProjects: number;
  privateProjects: number;
  stars: number;
  forks: number;
  followers: number;
  snippets: number;
  groups: GitLabGroupInfo[];
  lastUpdated: string;
}

export interface GitLabConnection {
  user: GitLabUserResponse | null;
  token: string;
  tokenType: 'personal-access-token' | 'oauth';
  stats?: GitLabStats;
  rateLimit?: {
    limit: number;
    remaining: number;
    reset: number;
  };
  gitlabUrl?: string;
}

export interface GitLabProjectResponse {
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
  owner: {
    id: number;
    username: string;
    name: string;
  };
}

export interface GitLabCommitAction {
  action: 'create' | 'update' | 'delete';
  file_path: string;
  content?: string;
  encoding?: 'text' | 'base64';
}

export interface GitLabCommitRequest {
  branch: string;
  commit_message: string;
  actions: GitLabCommitAction[];
}
