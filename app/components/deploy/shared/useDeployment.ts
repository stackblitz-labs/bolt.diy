import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import type { BaseRepository, DeploymentService, DeploymentState } from './types';
import { logStore } from '~/lib/stores/logs';

export function useDeployment<TRepo extends BaseRepository = BaseRepository>(
  service: DeploymentService<TRepo>,
  isOpen: boolean,
  projectName: string,
) {
  const [state, setState] = useState<DeploymentState>({
    repoName: '',
    isPrivate: false,
    isLoading: false,
    isFetchingRepos: false,
    repoSearchQuery: '',
    showSuccessDialog: false,
    createdRepoUrl: '',
    pushedFiles: [],
    showAuthDialog: false,
  });

  const [user, setUser] = useState<any>(null);
  const [recentRepos, setRecentRepos] = useState<TRepo[]>([]);
  const [filteredRepos, setFilteredRepos] = useState<TRepo[]>([]);

  // Initialize on open
  useEffect(() => {
    if (isOpen) {
      const connection = service.getConnection();
      const sanitizedName = service.sanitizeRepoName(projectName);

      setState((prev) => ({ ...prev, repoName: sanitizedName }));

      if (connection?.user && connection?.token) {
        setUser(connection.user);

        if (connection.token.trim()) {
          fetchRepositories(connection.token);
        }
      }
    }
  }, [isOpen, projectName, service]);

  // Filter repositories based on search query
  useEffect(() => {
    if (recentRepos.length === 0) {
      setFilteredRepos([]);
      return;
    }

    if (!state.repoSearchQuery.trim()) {
      setFilteredRepos(recentRepos);
      return;
    }

    const query = state.repoSearchQuery.toLowerCase().trim();

    const filtered = recentRepos.filter(
      (repo) =>
        repo.name.toLowerCase().includes(query) || (repo.description && repo.description.toLowerCase().includes(query)),
    );

    setFilteredRepos(filtered);
  }, [recentRepos, state.repoSearchQuery]);

  const fetchRepositories = useCallback(
    async (token: string) => {
      if (!token) {
        logStore.logError(`No ${service.getServiceName()} token available`);
        toast.error(`${service.getServiceName()} authentication required`);

        return;
      }

      try {
        setState((prev) => ({ ...prev, isFetchingRepos: true }));

        const repos = await service.fetchRepositories(token);
        setRecentRepos(repos);
      } catch (error) {
        console.error(`Failed to fetch ${service.getServiceName()} repositories:`, error);
        logStore.logError(`Failed to fetch ${service.getServiceName()} repositories`, { error });
        toast.error('Failed to fetch recent repositories');
      } finally {
        setState((prev) => ({ ...prev, isFetchingRepos: false }));
      }
    },
    [service],
  );

  const updateState = useCallback((updates: Partial<DeploymentState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleDeploy = useCallback(
    async (files: Record<string, string>) => {
      const connection = service.getConnection();

      if (!connection?.token || !connection?.user) {
        toast.error(`Please connect your ${service.getServiceName()} account in Settings > Connections first`);
        return { success: false, error: 'Not connected' };
      }

      if (!state.repoName.trim()) {
        toast.error('Repository name is required');
        return { success: false, error: 'Repository name required' };
      }

      setState((prev) => ({ ...prev, isLoading: true }));

      try {
        const sanitizedName = service.sanitizeRepoName(state.repoName);

        // Warn if name was changed
        if (sanitizedName !== state.repoName && sanitizedName !== state.repoName.toLowerCase()) {
          toast.info(
            `Repository name sanitized to "${sanitizedName}" to meet ${service.getServiceName()} requirements`,
          );
        }

        // Check if repository exists
        const existingRepo = await service.repositoryExists(sanitizedName, connection.token);

        let repo: TRepo;

        if (existingRepo) {
          const confirmOverwrite = window.confirm(
            `Repository "${sanitizedName}" already exists. Do you want to update it? This will add or modify files in the repository.`,
          );

          if (!confirmOverwrite) {
            setState((prev) => ({ ...prev, isLoading: false }));
            return { success: false, error: 'User cancelled' };
          }

          repo = existingRepo;
        } else {
          // Create new repository
          repo = await service.createRepository(sanitizedName, state.isPrivate, connection.token);
          toast.success(`Repository "${sanitizedName}" created successfully!`);
        }

        // Push files
        const pushedFiles = await service.pushFiles(repo.url, files, connection.token, (current, total) => {
          // Progress callback - could be used for UI updates
          console.log(`Pushing files: ${current}/${total}`);
        });

        setState((prev) => ({
          ...prev,
          isLoading: false,
          showSuccessDialog: true,
          createdRepoUrl: repo.url,
          pushedFiles,
        }));

        return { success: true, repoUrl: repo.url, pushedFiles };
      } catch (error) {
        console.error('Deployment failed:', error);
        logStore.logError('Deployment failed', { error });

        const errorMessage = error instanceof Error ? error.message : 'Deployment failed';
        toast.error(errorMessage);

        setState((prev) => ({ ...prev, isLoading: false }));

        return { success: false, error: errorMessage };
      }
    },
    [service, state.repoName, state.isPrivate],
  );

  return {
    state,
    user,
    recentRepos: filteredRepos,
    allRepos: recentRepos,
    updateState,
    fetchRepositories,
    handleDeploy,
    isConnected: service.isConnected(),
  };
}
