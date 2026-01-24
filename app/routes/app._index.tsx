/**
 * Projects Dashboard
 *
 * Main dashboard showing user's projects with create functionality.
 * This is a protected route that requires authentication.
 *
 * Part of Phase 3 implementation for user project tables feature.
 */

import { json, redirect, type LoaderFunctionArgs, type MetaFunction } from '@remix-run/node';
import { useLoaderData, Link } from '@remix-run/react';
import { ClientOnly } from 'remix-utils/client-only';
import { requireSession } from '~/lib/auth/guards.server';
import { ProjectList } from '~/components/projects/ProjectList';
import { ProjectErrorBoundary } from '~/components/projects/ProjectErrorBoundary';
import { useProjects } from '~/lib/persistence/useProjects';
import { getProjectsByUserId } from '~/lib/services/projects.server';
import { UserMenu } from '~/components/auth/UserMenu';
import { useState } from 'react';
import type { ProjectStatus } from '~/types/project';

export const meta: MetaFunction = () => {
  return [{ title: 'Dashboard - Huskit' }, { name: 'description', content: 'Manage your website projects' }];
};

/**
 * Loader: Require authentication before rendering
 */
export async function loader({ request }: LoaderFunctionArgs) {
  // This will throw a redirect if not authenticated
  const session = await requireSession(request);

  // Check if user has any projects
  const { total } = await getProjectsByUserId(session.user.id, { limit: 1 });

  // If no projects AND this is a fresh login, redirect to create new project page
  const url = new URL(request.url);
  const isFreshLogin = url.searchParams.get('login') === 'true';

  if (total === 0 && isFreshLogin) {
    throw redirect('/app/projects/new');
  }

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
 */
function ProjectsDashboard() {
  const { user } = useLoaderData<typeof loader>();
  const [currentStatusFilter, setCurrentStatusFilter] = useState<ProjectStatus | 'all'>('all');

  const { projects, total, isLoading, error, renameProject, deleteProject, refetch } = useProjects({
    limit: 100, // Show more projects in the dashboard
    status: currentStatusFilter === 'all' ? undefined : currentStatusFilter,
  });

  const handleRenameProject = async (projectId: string, newName: string) => {
    try {
      await renameProject(projectId, newName);
      await refetch();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to rename project';
      throw new Error(errorMessage);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      await deleteProject(projectId);
      await refetch();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete project';
      throw new Error(errorMessage);
    }
  };

  return (
    <div className="min-h-screen bg-[#fcfcfd] dark:bg-gray-950">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-[50] bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-bolt-elements-borderColor h-20 flex items-center px-6 lg:px-12">
        <div className="w-full flex items-center justify-between mx-auto">
          <div className="flex items-center">
            <a href="/" className="flex items-center hover:opacity-80 transition-opacity">
              <img src="/huskIT.svg" alt="HuskIT" className="w-[90px]" />
            </a>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              to="/app/projects/new"
              className="bg-[#1a1b26] hover:bg-black dark:bg-white dark:hover:bg-gray-200 text-white dark:text-black px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm active:scale-95 flex items-center gap-2"
            >
              <div className="i-ph-plus-bold w-3.5 h-3.5" />
              Build New Project
            </Link>
            <div className="h-8 w-px bg-gray-200 dark:bg-gray-700 hidden sm:block mx-2" />
            <ClientOnly>
              {() => (
                <div className="">
                  <UserMenu className="bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3 text-bolt-elements-textPrimary rounded-lg transition-colors" />
                </div>
              )}
            </ClientOnly>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="pt-[calc(var(--header-height)+40px)] pb-24 px-8">
        <div className="mx-auto w-full">
          {/* Welcome Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">User Console</span>
              </div>
              <h1 className="text-5xl font-black text-gray-900 dark:text-white tracking-tighter">My Dashboard</h1>
              <p className="mt-4 text-gray-400 font-medium text-lg max-w-xl leading-relaxed">
                Welcome back, {user.name?.split(' ')[0] || 'User'}. Manage your business presence and build new
                concepts.
              </p>
            </div>

            {/* Quick Stats */}
            <div className="flex items-center gap-4">
              <div className="bg-white dark:bg-gray-900 border border-bolt-elements-borderColor px-6 py-4 rounded-[24px] shadow-sm flex flex-col min-w-[140px]">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Projects</span>
                <span className="text-2xl font-black text-gray-900 dark:text-white">
                  {total} <span className="text-gray-300 text-lg">/ 10</span>
                </span>
              </div>
              <div className="bg-white dark:bg-gray-900 border border-bolt-elements-borderColor px-6 py-4 rounded-[24px] shadow-sm flex flex-col min-w-[140px]">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Status</span>
                <span className="text-lg font-black text-blue-500 flex items-center gap-1.5">
                  <div className="i-ph-airplane-tilt-bold w-4 h-4" />
                  Pro Plan
                </span>
              </div>
            </div>
          </div>

          {/* Projects Body */}
          <div className="animate-in fade-in slide-in-from-bottom-6 duration-700 delay-200 fill-mode-both">
            <ProjectList
              projects={projects}
              isLoading={isLoading}
              error={error}
              onRefresh={refetch}
              onRenameProject={handleRenameProject}
              onDeleteProject={handleDeleteProject}
              currentStatusFilter={currentStatusFilter}
              onStatusFilterChange={setCurrentStatusFilter}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

export default function WorkspaceDashboard() {
  return (
    <ProjectErrorBoundary>
      <ProjectsDashboard />
    </ProjectErrorBoundary>
  );
}
