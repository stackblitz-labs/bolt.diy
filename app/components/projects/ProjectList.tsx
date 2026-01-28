/**
 * Project List Component
 *
 * Displays a list of user's projects with status badges, message counts,
 * and navigation actions.
 */

import React, { useState } from 'react';
import { useNavigate } from '@remix-run/react';
import type { ProjectSummary, ProjectStatus } from '~/types/project';
import { Button } from '~/components/ui/Button';
import { classNames } from '~/utils/classNames';

interface ProjectListProps {
  /**
   * List of projects to display
   */
  projects: ProjectSummary[];

  /**
   * Whether the data is loading
   */
  isLoading?: boolean;

  /**
   * Error message to display
   */
  error?: string | null;

  /**
   * Callback to refresh the list
   */
  onRefresh?: () => void;

  /**
   * Total number of projects (for pagination info)
   */
  total?: number;

  /**
   * Callback to rename a project
   */
  onRenameProject?: (projectId: string, newName: string) => Promise<void>;

  /**
   * Callback to delete a project
   */
  onDeleteProject?: (projectId: string) => Promise<void>;

  /**
   * Callback to change project status
   */
  onStatusChangeProject?: (projectId: string, status: ProjectStatus) => Promise<void>;

  /**
   * Current status filter
   */
  currentStatusFilter?: ProjectStatus | 'all';

  /**
   * Callback to change status filter
   */
  onStatusFilterChange?: (status: ProjectStatus | 'all') => void;
}

/**
 * Status badge component
 */

/**
 * Project actions dropdown component
 */
function ProjectActions({
  project,
  onRename,
  onDelete,
  onStatusChange,
}: {
  project: ProjectSummary;
  onRename?: (projectId: string, newName: string) => Promise<void>;
  onDelete?: (projectId: string) => Promise<void>;
  onStatusChange?: (projectId: string, status: ProjectStatus) => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [newName, setNewName] = useState(project.name);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isChangingStatus, setIsChangingStatus] = useState(false);

  const handleRename = async () => {
    if (!onRename || !newName.trim() || newName.trim() === project.name) {
      setShowRenameModal(false);
      return;
    }

    setIsRenaming(true);

    try {
      await onRename(project.id, newName.trim());
      setShowRenameModal(false);
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to rename project:', error);
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete || isDeleting) {
      return;
    }

    setIsDeleting(true);

    try {
      await onDelete(project.id);
      setShowDeleteModal(false);
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to delete project:', error);

      // Close modal on error to prevent repeated API calls
      setShowDeleteModal(false);
      setIsOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleStatusChange = async (newStatus: ProjectStatus) => {
    if (!onStatusChange || newStatus === project.status) {
      return;
    }

    setIsChangingStatus(true);

    try {
      await onStatusChange(project.id, newStatus);
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to change project status:', error);
    } finally {
      setIsChangingStatus(false);
    }
  };

  return (
    <>
      <div className="relative">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none"
          title="Project actions"
        >
          <div className="i-ph-dots-three-vertical-bold w-5 h-5 text-gray-400" />
        </button>

        {isOpen && (
          <div className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-gray-950 border border-bolt-elements-borderColor rounded-2xl shadow-xl z-20 overflow-hidden">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowRenameModal(true);
                setIsOpen(false);
              }}
              className="w-full px-4 py-3 text-left text-sm text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive flex items-center transition-colors"
            >
              <div className="i-ph-pencil-simple-bold w-4 h-4 mr-3 text-gray-400" />
              Rename
            </button>

            {/* Divider */}
            {onStatusChange && <div className="h-px bg-bolt-elements-borderColor" />}

            {/* Status change options */}
            {onStatusChange && project.status !== 'published' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleStatusChange('published');
                }}
                disabled={isChangingStatus}
                className="w-full px-4 py-3 text-left text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 flex items-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <div className="i-ph-check-circle-bold w-4 h-4 mr-3" />
                {isChangingStatus ? 'Publishing...' : 'Publish'}
              </button>
            )}

            {onStatusChange && project.status !== 'archived' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleStatusChange('archived');
                }}
                disabled={isChangingStatus}
                className="w-full px-4 py-3 text-left text-sm text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 flex items-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <div className="i-ph-archive-bold w-4 h-4 mr-3" />
                {isChangingStatus ? 'Archiving...' : 'Archive'}
              </button>
            )}

            {onStatusChange && project.status !== 'draft' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleStatusChange('draft');
                }}
                disabled={isChangingStatus}
                className="w-full px-4 py-3 text-left text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900/20 flex items-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <div className="i-ph-note-pencil-bold w-4 h-4 mr-3" />
                {isChangingStatus ? 'Setting to Draft...' : 'Set to Draft'}
              </button>
            )}

            {/* Divider */}
            <div className="h-px bg-bolt-elements-borderColor" />

            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteModal(true);
                setIsOpen(false);
              }}
              className="w-full px-4 py-3 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center transition-colors"
            >
              <div className="i-ph-trash-bold w-4 h-4 mr-3" />
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Rename Modal */}
      {showRenameModal && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100]"
          onClick={(e) => {
            e.stopPropagation();

            if (e.target === e.currentTarget) {
              setShowRenameModal(false);
              setNewName(project.name);
            }
          }}
        >
          <div
            className="bg-white dark:bg-gray-950 border border-bolt-elements-borderColor rounded-3xl p-8 w-[400px] max-w-full mx-4 shadow-2xl animate-in fade-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-black text-bolt-elements-textPrimary mb-2 tracking-tight">Rename Project</h3>
            <p className="text-sm text-bolt-elements-textSecondary mb-6">Give your project a new descriptive name.</p>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleRename();
                }

                if (e.key === 'Escape') {
                  setShowRenameModal(false);
                  setNewName(project.name);
                }
              }}
              placeholder="Enter new project name"
              className="w-full px-4 py-3.5 border border-bolt-elements-borderColor rounded-xl bg-white dark:bg-gray-900 text-bolt-elements-textPrimary focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 mb-6 transition-all"
              maxLength={255}
              autoFocus
            />
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowRenameModal(false);
                  setNewName(project.name);
                }}
                className="px-6 py-2.5 text-sm font-bold text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors"
                disabled={isRenaming}
              >
                Cancel
              </button>
              <button
                onClick={handleRename}
                disabled={!newName.trim() || newName.trim() === project.name || isRenaming}
                className="px-6 py-2.5 text-sm font-bold bg-[#1a1b26] text-white rounded-xl hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 shadow-lg"
              >
                {isRenaming ? 'Renaming...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100]"
          onClick={(e) => {
            e.stopPropagation();

            if (e.target === e.currentTarget) {
              setShowDeleteModal(false);
            }
          }}
        >
          <div
            className="bg-white dark:bg-gray-950 border border-bolt-elements-borderColor rounded-3xl p-8 w-[400px] max-w-full mx-4 shadow-2xl animate-in fade-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center mb-4 text-red-500">
              <div className="i-ph-warning-circle-fill text-3xl mr-3" />
              <h3 className="text-xl font-black tracking-tight">Delete Project</h3>
            </div>
            <p className="text-bolt-elements-textSecondary mb-4 leading-relaxed">
              Are you sure you want to delete{' '}
              <span className="font-bold text-bolt-elements-textPrimary">"{project.name}"</span>?
            </p>
            <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border border-red-100 dark:border-red-900/20 mb-8">
              <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                This action cannot be undone. All data, messages, and code associated with this project will be
                permanently removed.
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-6 py-2.5 text-sm font-bold text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-6 py-2.5 text-sm font-bold bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 shadow-lg"
              >
                {isDeleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Project card component
 */
type ProjectCardVariant = 'featured' | 'grid';

function ProjectCard({
  project,
  onClick,
  onRename,
  onDelete,
  onStatusChange,
  variant = 'grid',
}: {
  project: ProjectSummary;
  onClick: () => void;
  onRename?: (projectId: string, newName: string) => Promise<void>;
  onDelete?: (projectId: string) => Promise<void>;
  onStatusChange?: (projectId: string, status: ProjectStatus) => Promise<void>;
  variant?: ProjectCardVariant;
}) {
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffSeconds = Math.floor(diffMs / 1000);
      const diffMinutes = Math.floor(diffSeconds / 60);
      const diffHours = Math.floor(diffMinutes / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffSeconds < 60) {
        return 'just now';
      } else if (diffMinutes < 60) {
        return `${diffMinutes}m ago`;
      } else if (diffHours < 24) {
        return `${diffHours}h ago`;
      } else if (diffDays === 1) {
        return 'Yesterday';
      } else if (diffDays < 7) {
        return `${diffDays} days ago`;
      } else {
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
        });
      }
    } catch {
      return 'Unknown date';
    }
  };

  const placeholderImages = [
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=800', // Restaurant
    'https://images.unsplash.com/photo-1544148103-0773bf10d330?auto=format&fit=crop&q=80&w=800', // Bar
    'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&q=80&w=800', // Fine dining
    'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=800', // Pizza
  ];

  const projectImage =
    placeholderImages[
      Math.abs(project.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % placeholderImages.length
    ];

  if (variant === 'featured') {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-[32px] overflow-hidden shadow-sm border border-bolt-elements-borderColor flex flex-col lg:flex-row min-h-[450px]">
        <div className="lg:w-3/5 relative min-h-[300px]">
          <img src={projectImage} alt={project.name} className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute top-6 left-6">
            <span className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 text-gray-900 dark:text-white shadow-sm border border-white/20">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
              Live Now
            </span>
          </div>
        </div>
        <div className="lg:w-2/5 p-10 flex flex-col justify-center relative">
          <div className="absolute top-8 right-8">
            <ProjectActions project={project} onRename={onRename} onDelete={onDelete} onStatusChange={onStatusChange} />
          </div>
          <div className="flex items-center gap-2 mb-3">
            <div className="i-ph-star-fill w-3.5 h-3.5 text-blue-500" />
            <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Primary Business</span>
          </div>
          <h3 className="text-4xl font-black text-gray-900 dark:text-white mb-4 tracking-tight leading-tight">
            {project.name}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-8 leading-relaxed text-sm">
            Your business's digital presence is performing well. Update your content or track recent visits.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={onClick}
              className="bg-[#1a1b26] hover:bg-black text-white px-8 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 group"
            >
              <div className="i-ph-eye-bold w-5 h-5 group-hover:scale-110 transition-transform" />
              View Live Site
            </button>
            <button
              onClick={onClick}
              className="bg-white hover:bg-gray-50 text-gray-900 border border-gray-100 px-8 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95 group"
            >
              <div className="i-ph-pencil-simple-bold w-5 h-5 group-hover:scale-110 transition-transform" />
              Edit Content
            </button>
          </div>
          <div className="mt-10 pt-8 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-[11px] text-gray-400 font-bold uppercase tracking-wider">
            <div className="flex items-center gap-2">
              <div className="i-ph-clock-bold w-3.5 h-3.5 text-gray-300" />
              Last edited {formatDate(project.updated_at)}
            </div>
            <div className="flex items-center gap-2">
              <div className="i-ph-chart-bar-bold w-3.5 h-3.5 text-gray-300" />
              1.2k visits this week
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-white dark:bg-gray-900 rounded-[24px] overflow-hidden border border-bolt-elements-borderColor shadow-sm hover:shadow-xl transition-all group flex flex-col cursor-pointer hover:-translate-y-1 duration-300"
      onClick={onClick}
    >
      <div className="aspect-[4/3] relative overflow-hidden">
        <img
          src={projectImage}
          alt={project.name}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
        <div className="absolute top-4 right-4">
          <span
            className={classNames(
              'px-3 py-1 rounded-lg text-[10px] font-bold uppercase shadow-sm backdrop-blur-md',
              project.status === 'published' ? 'bg-white/90 text-blue-600' : 'bg-yellow-400 text-gray-900',
            )}
          >
            {project.status === 'published' ? 'Published' : 'Draft'}
          </span>
        </div>
      </div>
      <div className="p-6 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-3 mb-1">
          <h4 className="font-bold text-gray-900 dark:text-white truncate text-xl tracking-tight">{project.name}</h4>
          <ProjectActions project={project} onRename={onRename} onDelete={onDelete} onStatusChange={onStatusChange} />
        </div>
        <p className="text-gray-400 text-xs font-medium mb-6 uppercase tracking-wide">
          Business Concept • {project.status === 'published' ? 'Multi Page' : 'Draft'}
        </p>

        <div className="mt-auto flex items-center justify-between text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-5">
          <div className="flex items-center gap-1.5">
            <div className="i-ph-clock-bold w-3.5 h-3.5 text-gray-300" />
            Edited {formatDate(project.updated_at)}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="flex-1 bg-white hover:bg-gray-50 text-gray-900 border border-gray-100 py-3 rounded-xl font-bold text-xs transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm"
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
          >
            <div className="i-ph-pencil-simple-bold w-4 h-4 text-gray-400" />
            {project.status === 'published' ? 'Edit' : 'Continue Editing'}
          </button>
          {project.status === 'published' && (
            <button
              className="bg-[#1a1b26] hover:bg-black text-white p-3 rounded-xl transition-all active:scale-95 shadow-md group"
              onClick={(e) => {
                e.stopPropagation();
                onClick();
              }}
            >
              <div className="i-ph-export-bold w-4 h-4 group-hover:scale-110 transition-transform" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Status filter component
 */
function StatusFilter({
  currentStatus,
  onStatusChange,
}: {
  currentStatus?: ProjectStatus | 'all';
  onStatusChange?: (status: ProjectStatus | 'all') => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const statusOptions = [
    { value: 'all', label: 'All Projects', icon: 'i-ph-folder-bold' },
    { value: 'draft', label: 'Draft', icon: 'i-ph-note-pencil-bold' },
    { value: 'published', label: 'Published', icon: 'i-ph-check-circle-bold' },
    { value: 'archived', label: 'Archived', icon: 'i-ph-archive-bold' },
  ] as const;

  const selectedOption = statusOptions.find((option) => option.value === currentStatus) || statusOptions[0];

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="flex items-center space-x-2 px-5 py-2.5 bg-white dark:bg-gray-900 border border-bolt-elements-borderColor rounded-full hover:bg-bolt-elements-item-backgroundActive transition-all shadow-sm focus:outline-none"
      >
        <div className={classNames('w-4 h-4 text-gray-400', selectedOption.icon)} />
        <span className="text-sm font-bold text-bolt-elements-textPrimary tracking-tight">{selectedOption.label}</span>
        <div
          className={classNames(
            'w-4 h-4 text-gray-300 transition-transform duration-300',
            isOpen ? 'rotate-180' : '',
            'i-ph-caret-down-bold',
          )}
        />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full right-0 mt-2 w-52 bg-white dark:bg-gray-950 border border-bolt-elements-borderColor rounded-2xl shadow-xl z-20 overflow-hidden">
            {statusOptions.map((option) => (
              <button
                key={option.value}
                onClick={(e) => {
                  e.stopPropagation();
                  onStatusChange?.(option.value);
                  setIsOpen(false);
                }}
                className={classNames(
                  'w-full px-5 py-4 text-left text-sm flex items-center space-x-3 hover:bg-bolt-elements-item-backgroundActive transition-colors',
                  currentStatus === option.value
                    ? 'bg-bolt-elements-item-backgroundActive text-bolt-elements-textPrimary'
                    : 'text-bolt-elements-textPrimary',
                )}
              >
                <div
                  className={classNames(
                    'w-4 h-4',
                    option.icon,
                    currentStatus === option.value ? 'text-blue-500' : 'text-gray-400',
                  )}
                />
                <span className={classNames('font-semibold', currentStatus === option.value ? 'text-blue-500' : '')}>
                  {option.label}
                </span>
                {currentStatus === option.value && <div className="i-ph-check-bold w-4 h-4 ml-auto text-blue-500" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function ProjectList({
  projects,
  isLoading = false,
  error = null,
  onRefresh,
  onRenameProject,
  onDeleteProject,
  onStatusChangeProject,
  currentStatusFilter = 'all',
  onStatusFilterChange,
}: ProjectListProps) {
  const navigate = useNavigate();

  const handleProjectClick = (project: ProjectSummary) => {
    if (project.url_id) {
      navigate(`/chat/${project.url_id}`);
    } else {
      navigate(`/chat/${project.id}`);
    }
  };

  // Loading state
  if (isLoading && projects.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <div className="col-span-full h-[450px] rounded-[32px] bg-white dark:bg-gray-950 border border-bolt-elements-borderColor animate-pulse" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="aspect-[4/5] rounded-[24px] bg-white dark:bg-gray-950 border border-bolt-elements-borderColor animate-pulse"
          />
        ))}
      </div>
    );
  }

  // Error state
  if (error && projects.length === 0) {
    return (
      <div className="text-center py-24 bg-white dark:bg-gray-950 rounded-[40px] border border-bolt-elements-borderColor shadow-sm">
        <div className="i-ph-warning-circle-bold text-red-500 text-6xl mx-auto mb-6" />
        <h3 className="text-2xl font-black text-bolt-elements-textPrimary mb-3 tracking-tight">Something went wrong</h3>
        <p className="text-bolt-elements-textSecondary mb-8 max-w-md mx-auto">{error}</p>
        {onRefresh && (
          <Button onClick={onRefresh} variant="outline" className="rounded-2xl px-8 py-6 font-bold">
            <div className="i-ph-arrow-clockwise-bold w-5 h-5 mr-2" />
            Try Again
          </Button>
        )}
      </div>
    );
  }

  // Logic to separate projects
  const sortedProjects = projects
    .slice()
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  const featuredProject = sortedProjects[0];
  const otherProjects = sortedProjects.slice(1);

  return (
    <div className="space-y-24">
      {/* Featured Section */}
      {featuredProject && currentStatusFilter === 'all' && (
        <section>
          <div className="flex items-center gap-3 mb-8">
            <div className="i-ph-star-fill w-6 h-6 text-blue-500" />
            <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-[0.2em]">
              Featured Live Project
            </h3>
          </div>
          <ProjectCard
            project={featuredProject}
            onClick={() => handleProjectClick(featuredProject)}
            onRename={onRenameProject}
            onDelete={onDeleteProject}
            onStatusChange={onStatusChangeProject}
            variant="featured"
          />
        </section>
      )}

      {/* Grid Section */}
      <section>
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
            <div className="i-ph-grid-four-bold w-6 h-6 text-gray-400" />
            <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-[0.2em]">
              {currentStatusFilter === 'all' ? 'All Projects' : `${currentStatusFilter} Projects`}
            </h3>
          </div>
          <StatusFilter currentStatus={currentStatusFilter} onStatusChange={onStatusFilterChange} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {/* Action Card: Start New Project */}
          <button
            onClick={() => navigate('/app/projects/new')}
            className="group min-h-[400px] h-full bg-white dark:bg-gray-900 rounded-[28px] border-2 border-dashed border-gray-100 dark:border-gray-800 flex flex-col items-center justify-center p-10 space-y-6 hover:border-blue-500/50 hover:bg-blue-50/10 transition-all cursor-pointer shadow-sm hover:shadow-xl duration-300"
          >
            <div className="w-16 h-16 rounded-full border-2 border-gray-50 dark:border-gray-800 flex items-center justify-center bg-white dark:bg-gray-800 shadow-soft transition-all duration-500 group-hover:scale-110 group-hover:bg-blue-500 group-hover:border-blue-500">
              <div className="i-ph-plus-bold w-8 h-8 text-blue-500 transition-colors duration-500 group-hover:text-white" />
            </div>
            <div className="text-center">
              <h4 className="font-black text-gray-900 dark:text-white text-xl tracking-tight mb-2">
                Start New Project
              </h4>
              <p className="text-xs text-gray-400 font-medium max-w-[200px] mx-auto leading-relaxed">
                Build a website for another business concept in minutes.
              </p>
            </div>
          </button>

          {/* Actual Project Cards */}
          {(currentStatusFilter === 'all' ? otherProjects : sortedProjects).map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onClick={() => handleProjectClick(project)}
              onRename={onRenameProject}
              onDelete={onDeleteProject}
              onStatusChange={onStatusChangeProject}
              variant="grid"
            />
          ))}
        </div>
      </section>

      {/* Resources Section */}
      <section className="pt-20 border-t border-gray-100 dark:border-gray-800">
        <h3 className="text-xl font-black text-gray-900 dark:text-white mb-10 tracking-tight">Resources for You</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <a
            className="flex items-center gap-6 p-8 rounded-[32px] bg-white dark:bg-gray-900 border border-bolt-elements-borderColor hover:border-blue-500/30 hover:shadow-xl transition-all duration-300 group"
            href="/docs"
          >
            <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0 text-blue-600 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
              <div className="i-ph-graduation-cap-bold w-7 h-7" />
            </div>
            <div>
              <h4 className="font-bold text-gray-900 dark:text-white text-lg mb-1 tracking-tight">Tutorials</h4>
              <p className="text-sm text-gray-400 font-medium">Learn how to customize your site efficiently.</p>
            </div>
          </a>

          <a
            className="flex items-center gap-6 p-8 rounded-[32px] bg-white dark:bg-gray-900 border border-bolt-elements-borderColor hover:border-purple-500/30 hover:shadow-xl transition-all duration-300 group"
            href="/docs/seo"
          >
            <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0 text-purple-600 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
              <div className="i-ph-trend-up-bold w-7 h-7" />
            </div>
            <div>
              <h4 className="font-bold text-gray-900 dark:text-white text-lg mb-1 tracking-tight">SEO Guide</h4>
              <p className="text-sm text-gray-400 font-medium">Tips to rank higher on Google Search.</p>
            </div>
          </a>

          <a
            className="flex items-center gap-6 p-8 rounded-[32px] bg-white dark:bg-gray-900 border border-bolt-elements-borderColor hover:border-yellow-500/30 hover:shadow-xl transition-all duration-300 group"
            href="/docs/domains"
          >
            <div className="w-14 h-14 rounded-2xl bg-yellow-50 dark:bg-yellow-900/30 flex items-center justify-center flex-shrink-0 text-yellow-600 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
              <div className="i-ph-globe-hemisphere-west-bold w-7 h-7" />
            </div>
            <div>
              <h4 className="font-bold text-gray-900 dark:text-white text-lg mb-1 tracking-tight">Domain Setup</h4>
              <p className="text-sm text-gray-400 font-medium">Connect your custom domain name easily.</p>
            </div>
          </a>
        </div>
      </section>
    </div>
  );
}
