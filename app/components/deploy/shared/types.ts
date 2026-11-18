// Shared types for deployment dialogs

export interface BaseRepository {
  name: string;
  description?: string;
  url: string;
  visibility?: string;
  private?: boolean;
}

export interface DeploymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  files: Record<string, string>;
}

export interface DeploymentState {
  repoName: string;
  isPrivate: boolean;
  isLoading: boolean;
  isFetchingRepos: boolean;
  repoSearchQuery: string;
  showSuccessDialog: boolean;
  createdRepoUrl: string;
  pushedFiles: Array<{ path: string; size: number }>;
  showAuthDialog: boolean;
}

export interface DeploymentConnection {
  token: string;
  user: any;
  [key: string]: any;
}

export interface DeploymentService<TRepo extends BaseRepository = BaseRepository> {
  // Connection
  getConnection: () => DeploymentConnection | null;
  isConnected: () => boolean;

  // Repository operations
  fetchRepositories: (token: string) => Promise<TRepo[]>;
  createRepository: (name: string, isPrivate: boolean, token: string) => Promise<TRepo>;
  repositoryExists: (name: string, token: string) => Promise<TRepo | null>;

  // File operations
  pushFiles: (
    repoUrl: string,
    files: Record<string, string>,
    token: string,
    onProgress?: (current: number, total: number) => void,
  ) => Promise<Array<{ path: string; size: number }>>;

  // Utility
  sanitizeRepoName: (name: string) => string;
  getAuthDialogComponent: () => React.ComponentType<any>;
  getServiceName: () => string;
  getStorageKey: () => string;
}

export interface DeploymentResult {
  success: boolean;
  repoUrl?: string;
  pushedFiles?: Array<{ path: string; size: number }>;
  error?: string;
}
