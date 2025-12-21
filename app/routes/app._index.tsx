/**
 * Projects Dashboard
 *
 * Main dashboard showing user's projects with create functionality.
 * This is a protected route that requires authentication.
 *
 * Part of Phase 3 implementation for user project tables feature.
 */

import { json, type LoaderFunctionArgs, type MetaFunction } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { requireSession } from '~/lib/auth/guards.server';
import { ProjectList } from '~/components/projects/ProjectList';
import { CreateProjectDialog } from '~/components/projects/CreateProjectDialog';
import { ProjectErrorBoundary } from '~/components/projects/ProjectErrorBoundary';
import { useProjects } from '~/lib/persistence/useProjects';
import { useState } from 'react';
import { classNames } from '~/utils/classNames';

export const meta: MetaFunction = () => {
  return [{ title: 'Projects - Huskit' }, { name: 'description', content: 'Manage your website projects' }];
};

/**
 * Loader: Require authentication before rendering
 *
 * This route is protected - unauthenticated users will be redirected to login
 * with a returnTo parameter to come back here after authentication.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  // This will throw a redirect if not authenticated
  const session = await requireSession(request);

  return json({
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image,
    },
  });
}

/**
 * Projects Dashboard Component
 *
 * Shows user's projects and allows creating new ones.
 */
function ProjectsDashboard() {
  const { user } = useLoaderData<typeof loader>();
  const {
    projects,
    total,
    isLoading,
    error,
    createProject,
    renameProject,
    deleteProject,
    refetch,
    hasNextPage,
    nextPage,
    prevPage,
  } = useProjects({ limit: 10 });

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreateProject = async (input: { name: string; description?: string; gmaps_url?: string }) => {
    setIsCreating(true);
    setCreateError(null);

    try {
      await createProject(input);
      setIsCreateDialogOpen(false);
      await refetch();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRenameProject = async (projectId: string, newName: string) => {
    try {
      await renameProject(projectId, newName);
      await refetch();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to rename project';

      // Let the ProjectActions component handle the error display
      throw new Error(errorMessage);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      await deleteProject(projectId);
      await refetch();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete project';

      // Let the ProjectActions component handle the error display
      throw new Error(errorMessage);
    }
  };

  return (
    <div className="min-h-screen bg-bolt-elements-bg-depth-1">
      {/* Header */}
      <div className="border-b border-bolt-elements-borderColor bg-white dark:bg-gray-950">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-bolt-elements-textPrimary">Your Projects</h1>
              <p className="mt-1 text-bolt-elements-textSecondary">Create and manage your website projects</p>
            </div>
            <button
              onClick={() => {
                if (total < 10) {
                  setIsCreateDialogOpen(true);
                }
              }}
              disabled={total >= 10}
              className={classNames(
                'inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-bolt-elements-ring transition-colors',
                total >= 10
                  ? 'border-bolt-elements-borderColor text-bolt-elements-textTertiary bg-bolt-elements-background-depth-2 cursor-not-allowed'
                  : 'border-transparent text-white bg-bolt-elements-item-backgroundAccent hover:bg-bolt-elements-button-primary-backgroundHover',
              )}
              title={total >= 10 ? 'Maximum project limit reached (10 projects)' : 'Create a new project'}
            >
              <div className={total >= 10 ? 'i-ph-lock w-4 h-4 mr-2' : 'i-ph-plus-bold w-4 h-4 mr-2'} />
              {total >= 10 ? 'Limit Reached' : 'New Project'}
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* User info summary */}
        <div className="mb-8 p-4 bg-white dark:bg-gray-950 border border-bolt-elements-borderColor rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              {user.image && <img src={user.image} alt={user.name || user.email} className="w-12 h-12 rounded-full" />}
              <div>
                <h2 className="text-lg font-medium text-bolt-elements-textPrimary">{user.name || 'Welcome back'}</h2>
                <p className="text-sm text-bolt-elements-textSecondary">{user.email}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-bolt-elements-textPrimary">{total}</p>
              <p className="text-sm text-bolt-elements-textSecondary">of 10 projects</p>
            </div>
          </div>

          {/* Progress indicator */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-bolt-elements-textSecondary">Project Usage</span>
              <span className={total >= 10 ? 'text-red-600 font-medium' : 'text-bolt-elements-textSecondary'}>
                {total}/10 used
              </span>
            </div>
            <div className="w-full bg-bolt-elements-borderColor rounded-full h-2">
              <div
                className={classNames(
                  'h-2 rounded-full transition-all duration-300',
                  total >= 10 ? 'bg-red-500' : total >= 8 ? 'bg-yellow-500' : 'bg-bolt-elements-item-backgroundAccent',
                )}
                style={{ width: `${Math.min((total / 10) * 100, 100)}%` }}
              />
            </div>
            {total >= 8 && (
              <div
                className={classNames(
                  'text-xs p-2 rounded-md',
                  total >= 10
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-yellow-50 text-yellow-700 border border-yellow-200',
                )}
              >
                {total >= 10
                  ? "You've reached the maximum number of projects. Delete some projects to create new ones."
                  : `You have ${10 - total} project${10 - total === 1 ? '' : 's'} remaining. Consider upgrading your plan for more projects.`}
              </div>
            )}
          </div>
        </div>

        {/* Projects list */}
        <ProjectList
          projects={projects}
          isLoading={isLoading}
          error={error}
          onRefresh={refetch}
          total={total}
          hasNextPage={hasNextPage}
          onNextPage={nextPage}
          onPrevPage={prevPage}
          onRenameProject={handleRenameProject}
          onDeleteProject={handleDeleteProject}
        />
      </div>

      {/* Create Project Dialog */}
      <CreateProjectDialog
        isOpen={isCreateDialogOpen}
        onClose={() => {
          setIsCreateDialogOpen(false);
          setCreateError(null);
        }}
        onCreateProject={handleCreateProject}
        isLoading={isCreating}
        error={createError}
      />
    </div>
  );
}

/**
 * Export the dashboard as default
 *
 * This is a protected route that shows the user's projects.
 * Wrapped with ProjectErrorBoundary to catch and handle project-related errors.
 */
export default function WorkspaceDashboard() {
  return (
    <ProjectErrorBoundary>
      <ProjectsDashboard />
    </ProjectErrorBoundary>
  );
}
