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
import { ProjectCardSkeleton } from '~/components/ui/LoadingSkeletons';
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
   * Current offset in pagination
   */
  offset?: number;

  /**
   * Whether this is the first page
   */
  isFirstPage?: boolean;

  /**
   * Whether there are more projects available
   */
  hasNextPage?: boolean;

  /**
   * Callback to load next page
   */
  onNextPage?: () => void;

  /**
   * Callback to load previous page
   */
  onPrevPage?: () => void;

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
function StatusBadge({ status }: { status: ProjectStatus }) {
  const getStatusConfig = (status: ProjectStatus) => {
    switch (status) {
      case 'draft':
        return {
          className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
          label: 'Draft',
          icon: 'i-ph-note-pencil',
        };
      case 'published':
        return {
          className: 'bg-green-100 text-green-700 dark:bg-green-800 dark:text-green-300',
          label: 'Published',
          icon: 'i-ph-check-circle',
        };
      case 'archived':
        return {
          className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-800 dark:text-yellow-300',
          label: 'Archived',
          icon: 'i-ph-archive',
        };
      default:
        return {
          className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
          label: status,
          icon: 'i-ph-circle',
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <span
      className={classNames(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        config.className,
      )}
    >
      <div className={classNames('w-3 h-3 mr-1', config.icon)} />
      {config.label}
    </span>
  );
}

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
    if (!onDelete) {
      return;
    }

    setIsDeleting(true);

    try {
      await onDelete(project.id);
      setShowDeleteModal(false);
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to delete project:', error);
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
          className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title="Project actions"
        >
          <div className="i-ph-dots-three-vertical w-4 h-4 text-bolt-elements-textTertiary" />
        </button>

        {isOpen && (
          <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-950 border border-bolt-elements-borderColor rounded-md shadow-lg z-10">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowRenameModal(true);
                setIsOpen(false);
              }}
              className="w-full px-3 py-2 text-left text-sm text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive flex items-center"
            >
              <div className="i-ph-pencil-simple w-4 h-4 mr-2" />
              Rename
            </button>

            {/* Divider */}
            {onStatusChange && (
              <div className="h-px bg-bolt-elements-borderColor my-1" />
            )}

            {/* Status change options */}
            {onStatusChange && project.status !== 'published' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleStatusChange('published');
                }}
                disabled={isChangingStatus}
                className="w-full px-3 py-2 text-left text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="i-ph-check-circle w-4 h-4 mr-2" />
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
                className="w-full px-3 py-2 text-left text-sm text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="i-ph-archive w-4 h-4 mr-2" />
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
                className="w-full px-3 py-2 text-left text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900/20 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="i-ph-note-pencil w-4 h-4 mr-2" />
                {isChangingStatus ? 'Setting to Draft...' : 'Set to Draft'}
              </button>
            )}

            {/* Divider */}
            <div className="h-px bg-bolt-elements-borderColor my-1" />

            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteModal(true);
                setIsOpen(false);
              }}
              className="w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center"
            >
              <div className="i-ph-trash w-4 h-4 mr-2" />
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Rename Modal */}
      {showRenameModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={(e) => {
            e.stopPropagation();

            if (e.target === e.currentTarget) {
              setShowRenameModal(false);
              setNewName(project.name);
            }
          }}
        >
          <div
            className="bg-white dark:bg-gray-950 border border-bolt-elements-borderColor rounded-lg p-6 w-96 max-w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-medium text-bolt-elements-textPrimary mb-4">Rename Project</h3>
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
              className="w-full px-3 py-2 border border-bolt-elements-borderColor rounded-md bg-white dark:bg-gray-800 text-bolt-elements-textPrimary focus:outline-none focus:ring-2 focus:ring-bolt-elements-focusRing mb-4"
              maxLength={255}
              autoFocus
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowRenameModal(false);
                  setNewName(project.name);
                }}
                className="px-4 py-2 text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary"
                disabled={isRenaming}
              >
                Cancel
              </button>
              <button
                onClick={handleRename}
                disabled={!newName.trim() || newName.trim() === project.name || isRenaming}
                className="px-4 py-2 text-sm bg-bolt-elements-button-primaryBg text-bolt-elements-button-primaryText rounded-md hover:bg-bolt-elements-button-primaryBgHover disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRenaming ? 'Renaming...' : 'Rename'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={(e) => {
            e.stopPropagation();

            if (e.target === e.currentTarget) {
              setShowDeleteModal(false);
            }
          }}
        >
          <div
            className="bg-white dark:bg-gray-950 border border-bolt-elements-borderColor rounded-lg p-6 w-96 max-w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center mb-4">
              <div className="i-ph-warning-circle text-red-500 text-2xl mr-3" />
              <h3 className="text-lg font-medium text-bolt-elements-textPrimary">Delete Project</h3>
            </div>
            <p className="text-bolt-elements-textSecondary mb-2">Are you sure you want to delete "{project.name}"?</p>
            <p className="text-sm text-bolt-elements-textTertiary mb-6">
              This action cannot be undone and will permanently delete all messages, code, and data associated with this
              project.
            </p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? 'Deleting...' : 'Delete Project'}
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
function ProjectCard({
  project,
  onClick,
  onRename,
  onDelete,
  onStatusChange,
}: {
  project: ProjectSummary;
  onClick: () => void;
  onRename?: (projectId: string, newName: string) => Promise<void>;
  onDelete?: (projectId: string) => Promise<void>;
  onStatusChange?: (projectId: string, status: ProjectStatus) => Promise<void>;
}) {
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        return 'Today';
      } else if (diffDays === 1) {
        return 'Yesterday';
      } else if (diffDays < 7) {
        return `${diffDays} days ago`;
      } else if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
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

  return (
    <div
      className="bg-white dark:bg-gray-950 border border-bolt-elements-borderColor rounded-lg p-4 hover:border-bolt-elements-item-backgroundAccent transition-colors cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-medium text-bolt-elements-textPrimary truncate">{project.name}</h3>
          {project.description && (
            <p className="text-sm text-bolt-elements-textSecondary mt-1 line-clamp-2">{project.description}</p>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <StatusBadge status={project.status} />
          <ProjectActions project={project} onRename={onRename} onDelete={onDelete} onStatusChange={onStatusChange} />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-bolt-elements-textTertiary">
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <div className="i-ph-chat-text w-4 h-4 mr-1" />
            {project.message_count} message{project.message_count !== 1 ? 's' : ''}
          </div>
          {project.has_snapshot && (
            <div className="flex items-center">
              <div className="i-ph-code w-4 h-4 mr-1" />
              Has code
            </div>
          )}
        </div>
        <div className="flex items-center">
          <div className="i-ph-clock w-4 h-4 mr-1" />
          {formatDate(project.updated_at)}
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
    { value: 'all', label: 'All Projects', icon: 'i-ph-folder' },
    { value: 'draft', label: 'Draft', icon: 'i-ph-note-pencil' },
    { value: 'published', label: 'Published', icon: 'i-ph-check-circle' },
    { value: 'archived', label: 'Archived', icon: 'i-ph-archive' },
  ] as const;

  const selectedOption = statusOptions.find(option => option.value === currentStatus) || statusOptions[0];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-4 py-2 bg-white dark:bg-gray-950 border border-bolt-elements-borderColor rounded-md hover:bg-bolt-elements-item-backgroundActive transition-colors"
      >
        <div className={classNames('w-4 h-4', selectedOption.icon)} />
        <span className="text-sm font-medium text-bolt-elements-textPrimary">
          {selectedOption.label}
        </span>
        <div className={classNames('w-4 h-4 transition-transform', isOpen ? 'rotate-180' : '', 'i-ph-caret-down')} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-gray-950 border border-bolt-elements-borderColor rounded-md shadow-lg z-20">
            {statusOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onStatusChange?.(option.value);
                  setIsOpen(false);
                }}
                className={classNames(
                  'w-full px-3 py-2 text-left text-sm flex items-center space-x-2 hover:bg-bolt-elements-item-backgroundActive transition-colors',
                  currentStatus === option.value
                    ? 'bg-bolt-elements-item-backgroundActive text-bolt-elements-textPrimary'
                    : 'text-bolt-elements-textPrimary'
                )}
              >
                <div className={classNames('w-4 h-4', option.icon)} />
                <span>{option.label}</span>
                {currentStatus === option.value && (
                  <div className="i-ph-check w-4 h-4 ml-auto text-bolt-elements-focusRing" />
                )}
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
  total = 0,
  offset = 0,
  isFirstPage = true,
  hasNextPage = false,
  onNextPage,
  onPrevPage,
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
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <ProjectCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  // Error state
  if (error && projects.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="i-ph-warning-circle text-red-500 text-5xl mx-auto mb-4" />
        <h3 className="text-lg font-medium text-bolt-elements-textPrimary mb-2">Failed to load projects</h3>
        <p className="text-bolt-elements-textSecondary mb-4">{error}</p>
        {onRefresh && (
          <Button onClick={onRefresh} variant="outline">
            <div className="i-ph-arrow-clockwise w-4 h-4 mr-2" />
            Try Again
          </Button>
        )}
      </div>
    );
  }

  // Empty state
  if (projects.length === 0 && !isLoading) {
    const isFilterActive = currentStatusFilter !== 'all';

    return (
      <div className="text-center py-12">
        <div className={classNames(
          isFilterActive
            ? 'i-ph-funnel text-bolt-elements-textTertiary text-5xl mx-auto mb-4'
            : 'i-ph-folder-open text-bolt-elements-textTertiary text-5xl mx-auto mb-4'
        )} />
        <h3 className="text-lg font-medium text-bolt-elements-textPrimary mb-2">
          {isFilterActive ? `No ${currentStatusFilter} projects` : 'No projects yet'}
        </h3>
        <p className="text-bolt-elements-textSecondary mb-4">
          {isFilterActive
            ? `No projects with status "${currentStatusFilter}" found. Try changing the filter or create a new project.`
            : 'Create your first project to get started with your website.'
          }
        </p>
        {!isFilterActive && (
          <p className="text-sm text-bolt-elements-textTertiary">You can create up to 10 projects.</p>
        )}
        {isFilterActive && onStatusFilterChange && (
          <Button
            onClick={() => onStatusFilterChange('all')}
            variant="outline"
            className="mt-4"
          >
            Show All Projects
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with status filter and pagination */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {/* Status filter */}
          <StatusFilter
            currentStatus={currentStatusFilter}
            onStatusChange={onStatusFilterChange}
          />

          {/* Project count info */}
          {(total > 0 || !isFirstPage || hasNextPage) && (
            <div className="text-sm text-bolt-elements-textTertiary">
              {total > 0 && (
                <span>
                  Showing {offset + 1} to {Math.min(offset + projects.length, total)} of {total} projects
                </span>
              )}
            </div>
          )}
        </div>

        {/* Pagination controls */}
        <div className="flex items-center space-x-2">
          <Button onClick={onPrevPage} disabled={isFirstPage || isLoading} variant="outline" size="sm">
            <div className="i-ph-caret-left w-4 h-4" />
          </Button>
          <Button onClick={onNextPage} disabled={!hasNextPage || isLoading} variant="outline" size="sm">
            <div className="i-ph-caret-right w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Projects list */}
      <div className="space-y-4">
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            onClick={() => handleProjectClick(project)}
            onRename={onRenameProject}
            onDelete={onDeleteProject}
            onStatusChange={onStatusChangeProject}
          />
        ))}
      </div>

      {/* Loading more indicator */}
      {isLoading && projects.length > 0 && (
        <div className="text-center py-4">
          <div className="i-ph-spinner-gap-bold animate-spin text-bolt-elements-textTertiary text-2xl mx-auto" />
          <p className="text-sm text-bolt-elements-textTertiary mt-2">Loading more projects...</p>
        </div>
      )}

      {/* Retry button on error with existing projects */}
      {error && projects.length > 0 && onRefresh && (
        <div className="text-center py-4">
          <p className="text-sm text-red-500 mb-2">{error}</p>
          <Button onClick={onRefresh} variant="outline" size="sm">
            <div className="i-ph-arrow-clockwise w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      )}
    </div>
  );
}
