/**
 * React hook for project management
 *
 * Provides functions to fetch, create, update, and delete projects
 * with proper loading states and error handling.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { Project, ProjectSummary, CreateProjectInput, UpdateProjectInput, ProjectStatus } from '~/types/project';
import { retryProjectFetch } from '~/lib/utils/retry';

interface UseProjectsOptions {
  status?: ProjectStatus;
  limit?: number;
  offset?: number;
}

interface UseProjectsReturn {
  // Data
  projects: ProjectSummary[];
  total: number;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchProjects: (options?: UseProjectsOptions) => Promise<void>;
  createProject: (input: CreateProjectInput) => Promise<Project | null>;
  updateProject: (projectId: string, updates: UpdateProjectInput) => Promise<Project | null>;
  renameProject: (projectId: string, newName: string) => Promise<Project | null>;
  updateProjectStatus: (projectId: string, status: ProjectStatus) => Promise<Project | null>;
  deleteProject: (projectId: string) => Promise<boolean>;
  refetch: () => Promise<void>;

  // Pagination
  nextPage: () => Promise<void>;
  prevPage: () => Promise<void>;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

function areOptionsEqual(a: UseProjectsOptions, b: UseProjectsOptions): boolean {
  return a.status === b.status && a.limit === b.limit && a.offset === b.offset;
}

/**
 * Hook for managing projects with API integration
 */
export function useProjects(initialOptions: UseProjectsOptions = {}): UseProjectsReturn {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [currentOptions, setCurrentOptions] = useState<UseProjectsOptions>(() => initialOptions);

  const currentOptionsRef = useRef<UseProjectsOptions>(currentOptions);
  useEffect(() => {
    currentOptionsRef.current = currentOptions;
  }, [currentOptions]);

  const initialOptionsRef = useRef<UseProjectsOptions>(initialOptions);

  /**
   * Fetch projects from API
   */
  const fetchProjects = useCallback(async (options: UseProjectsOptions = {}) => {
    const mergedOptions = { ...currentOptionsRef.current, ...options };

    if (!areOptionsEqual(currentOptionsRef.current, mergedOptions)) {
      currentOptionsRef.current = mergedOptions;
      setCurrentOptions(mergedOptions);
    }

    setIsLoading(true);
    setError(null);

    try {
      const searchParams = new URLSearchParams();

      if (mergedOptions.status) {
        searchParams.set('status', mergedOptions.status);
      }

      if (mergedOptions.limit) {
        searchParams.set('limit', mergedOptions.limit.toString());
      }

      if (mergedOptions.offset) {
        searchParams.set('offset', mergedOptions.offset.toString());
      }

      const url = `/api/projects${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

      // Use retry fetch for resilience (throws on non-OK responses)
      const response = await retryProjectFetch(url, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = (await response.json()) as { projects?: ProjectSummary[]; total?: number };

      setProjects(data.projects || []);
      setTotal(data.total || 0);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Failed to fetch projects:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Create a new project
   */
  const createProject = useCallback(
    async (input: CreateProjectInput): Promise<Project | null> => {
      setIsLoading(true);
      setError(null);

      try {
        // Use retry fetch for resilience (throws on non-OK responses)
        const response = await retryProjectFetch('/api/projects', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(input),
        });

        const newProject = (await response.json()) as Project;

        // Refresh the projects list
        await fetchProjects(currentOptionsRef.current);

        return newProject;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        setError(errorMessage);
        console.error('Failed to create project:', err);

        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchProjects],
  );

  /**
   * Update an existing project
   */
  const updateProject = useCallback(async (projectId: string, updates: UpdateProjectInput): Promise<Project | null> => {
    setIsLoading(true);
    setError(null);

    try {
      // Use retry fetch for resilience (throws on non-OK responses)
      const response = await retryProjectFetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      const updatedProject = (await response.json()) as Project;

      // Update local state optimistically
      setProjects((prev) =>
        prev.map((project) => (project.id === projectId ? { ...project, ...updatedProject } : project)),
      );

      return updatedProject;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Failed to update project:', err);

      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Update project status
   */
  const updateProjectStatus = useCallback(
    async (projectId: string, status: ProjectStatus): Promise<Project | null> => {
      return await updateProject(projectId, { status });
    },
    [updateProject],
  );

  /**
   * Rename a project (convenience wrapper for updateProject)
   */
  const renameProject = useCallback(
    async (projectId: string, newName: string): Promise<Project | null> => {
      return await updateProject(projectId, { name: newName });
    },
    [updateProject],
  );

  /**
   * Delete a project
   */
  const deleteProject = useCallback(async (projectId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      /*
       * Use retry fetch for resilience (throws on non-OK responses)
       * Note: DELETE returns 204, which retryFetch handles correctly
       */
      await retryProjectFetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      });

      // Remove from local state optimistically
      setProjects((prev) => prev.filter((project) => project.id !== projectId));
      setTotal((prev) => Math.max(0, prev - 1));

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Failed to delete project:', err);

      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Refresh current projects list
   */
  const refetch = useCallback(async () => {
    await fetchProjects(currentOptionsRef.current);
  }, [fetchProjects]);

  /**
   * Pagination helpers
   */
  const nextPage = useCallback(async () => {
    const { offset = 0, limit = 10 } = currentOptionsRef.current;
    await fetchProjects({ offset: offset + limit });
  }, [fetchProjects]);

  const prevPage = useCallback(async () => {
    const { offset = 0, limit = 10 } = currentOptionsRef.current;
    await fetchProjects({ offset: Math.max(0, offset - limit) });
  }, [fetchProjects]);

  const hasNextPage = (currentOptions.offset || 0) + (currentOptions.limit || 10) < total;
  const hasPrevPage = (currentOptions.offset || 0) > 0;

  // Initial fetch (run once; avoid object-literal dependency loops)
  useEffect(() => {
    void fetchProjects(initialOptionsRef.current);
  }, [fetchProjects]);

  return {
    // Data
    projects,
    total,
    isLoading,
    error,

    // Actions
    fetchProjects,
    createProject,
    updateProject,
    renameProject,
    updateProjectStatus,
    deleteProject,
    refetch,

    // Pagination
    nextPage,
    prevPage,
    hasNextPage,
    hasPrevPage,
  };
}
