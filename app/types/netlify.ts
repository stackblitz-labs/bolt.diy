export interface NetlifySite {
  id: string;
  name: string;
  url: string;
  ssl_url?: string;
  admin_url: string;
  screenshot_url?: string;
  created_at: string;
  updated_at: string;
  state?: string;
  branch?: string;
  custom_domain?: string;
  build_settings: {
    provider: string;
    repo_url: string;
    repo_branch?: string;
    cmd: string;
  };
  published_deploy: {
    id?: string;
    published_at: string;
    deploy_time: number;
    state?: string;
    branch?: string;
    commit_ref?: string;
    commit_url?: string;
    error_message?: string;
    framework?: string;
  };
}

export interface NetlifyDeploy {
  id: string;
  site_id: string;
  state: string;
  name: string;
  url: string;
  ssl_url?: string;
  admin_url?: string;
  deploy_url: string;
  deploy_ssl_url?: string;
  screenshot_url?: string;
  branch: string;
  commit_ref?: string;
  commit_url?: string;
  created_at: string;
  updated_at: string;
  published_at?: string;
  title?: string;
  framework?: string;
  error_message?: string;
}

export interface NetlifyBuild {
  id: string;
  deploy_id: string;
  sha?: string;
  done: boolean;
  error?: string;
  created_at: string;
}

export interface NetlifyUser {
  id: string;
  slug: string;
  email: string;
  full_name: string;
  avatar_url: string;
}

export interface NetlifyStats {
  sites: NetlifySite[];
  totalSites: number;
  deploys?: NetlifyDeploy[];
  builds?: NetlifyBuild[];
  lastDeployTime?: string;
  totalDeploys?: number;
  totalBuilds?: number;
}

export interface NetlifyConnection {
  user: NetlifyUser | null;
  token: string;
  stats?: NetlifyStats;
}

export interface NetlifySiteInfo {
  id: string;
  name: string;
  url: string;
  chatId: string;
}
