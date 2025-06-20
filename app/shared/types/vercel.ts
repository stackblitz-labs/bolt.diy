export interface VercelUser {
  user: any;
  id: string;
  username: string;
  email: string;
  name: string;
  avatar?: string;
}

export interface VercelProject {
  createdAt: string | number | Date;
  targets: any;
  id: string;
  name: string;
  framework?: string;
  latestDeployments?: Array<{
    id: string;
    url: string;
    created: number;
    state: string;
  }>;
}

export interface VercelStats {
  projects: VercelProject[];
  totalProjects: number;
}

export interface VercelConnection {
  user: VercelUser | null;
  token: string;
  stats?: VercelStats;
}

export interface VercelProjectInfo {
  id: string;
  name: string;
  url: string;
  chatId: string;
}
