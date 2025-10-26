import * as Dialog from '@radix-ui/react-dialog';
import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';
import { classNames } from '~/utils/classNames';
import { getLocalStorage } from '~/lib/persistence/localStorage';
import type { GitLabUserResponse, GitLabProjectInfo } from '~/types/GitLab';
import { logStore } from '~/lib/stores/logs';
import { chatId } from '~/lib/persistence/useChatHistory';
import { useStore } from '@nanostores/react';
import { GitLabApiService } from '~/lib/services/gitlabApiService';
import { SearchInput, EmptyState, StatusIndicator, Badge } from '~/components/ui';
import { formatSize } from '~/utils/formatSize';
import { GitLabAuthDialog } from '~/components/@settings/tabs/gitlab/components/GitLabAuthDialog';

interface GitLabDeploymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  files: Record<string, string>;
}

export function GitLabDeploymentDialog({ isOpen, onClose, projectName, files }: GitLabDeploymentDialogProps) {
  const [repoName, setRepoName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<GitLabUserResponse | null>(null);
  const [recentRepos, setRecentRepos] = useState<GitLabProjectInfo[]>([]);
  const [filteredRepos, setFilteredRepos] = useState<GitLabProjectInfo[]>([]);
  const [repoSearchQuery, setRepoSearchQuery] = useState('');
  const [isFetchingRepos, setIsFetchingRepos] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [createdRepoUrl, setCreatedRepoUrl] = useState('');
  const [pushedFiles, setPushedFiles] = useState<{ path: string; size: number }[]>([]);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const currentChatId = useStore(chatId);

  // Load GitLab connection on mount
  useEffect(() => {
    if (isOpen) {
      const connection = getLocalStorage('gitlab_connection');

      // Set a default repository name based on the project name
      setRepoName(projectName.replace(/\s+/g, '-').toLowerCase());

      if (connection?.user && connection?.token) {
        setUser(connection.user);

        // Only fetch if we have both user and token
        if (connection.token.trim()) {
          fetchRecentRepos(connection.token, connection.gitlabUrl || 'https://gitlab.com');
        }
      }
    }
  }, [isOpen, projectName]);

  // Filter repositories based on search query
  useEffect(() => {
    if (recentRepos.length === 0) {
      setFilteredRepos([]);
      return;
    }

    if (!repoSearchQuery.trim()) {
      setFilteredRepos(recentRepos);
      return;
    }

    const query = repoSearchQuery.toLowerCase().trim();
    const filtered = recentRepos.filter(
      (repo) =>
        repo.name.toLowerCase().includes(query) || (repo.description && repo.description.toLowerCase().includes(query)),
    );

    setFilteredRepos(filtered);
  }, [recentRepos, repoSearchQuery]);

  const fetchRecentRepos = async (token: string, gitlabUrl = 'https://gitlab.com') => {
    if (!token) {
      logStore.logError('No GitLab token available');
      toast.error('GitLab authentication required');

      return;
    }

    try {
      setIsFetchingRepos(true);

      const apiService = new GitLabApiService(token, gitlabUrl);
      const repos = await apiService.getProjects();
      setRecentRepos(repos);
    } catch (error) {
      console.error('Failed to fetch GitLab repositories:', error);
      logStore.logError('Failed to fetch GitLab repositories', { error });
      toast.error('Failed to fetch recent repositories');
    } finally {
      setIsFetchingRepos(false);
    }
  };

  // Function to create a new repository or push to an existing one
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const connection = getLocalStorage('gitlab_connection');

    if (!connection?.token || !connection?.user) {
      toast.error('Please connect your GitLab account in Settings > Connections first');
      return;
    }

    if (!repoName.trim()) {
      toast.error('Repository name is required');
      return;
    }

    setIsLoading(true);

    // Sanitize repository name to match what the API will create
    const sanitizedRepoName = repoName
      .replace(/[^a-zA-Z0-9-_.]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();

    try {
      const gitlabUrl = connection.gitlabUrl || 'https://gitlab.com';
      const apiService = new GitLabApiService(connection.token, gitlabUrl);

      // Warn user if repository name was changed
      if (sanitizedRepoName !== repoName && sanitizedRepoName !== repoName.toLowerCase()) {
        toast.info(`Repository name sanitized to "${sanitizedRepoName}" to meet GitLab requirements`);
      }

      // Check if project exists using the sanitized name
      const projectPath = `${connection.user.username}/${sanitizedRepoName}`;
      const existingProject = await apiService.getProjectByPath(projectPath);
      const projectExists = existingProject !== null;

      if (projectExists && existingProject) {
        // Confirm overwrite
        const visibilityChange =
          existingProject.visibility !== (isPrivate ? 'private' : 'public')
            ? `\n\nThis will also change the repository from ${existingProject.visibility} to ${isPrivate ? 'private' : 'public'}.`
            : '';

        const confirmOverwrite = window.confirm(
          `Repository "${sanitizedRepoName}" already exists. Do you want to update it? This will add or modify files in the repository.${visibilityChange}`,
        );

        if (!confirmOverwrite) {
          setIsLoading(false);
          return;
        }

        // Update visibility if needed
        if (existingProject.visibility !== (isPrivate ? 'private' : 'public')) {
          toast.info('Updating repository visibility...');
          await apiService.updateProjectVisibility(existingProject.id, isPrivate ? 'private' : 'public');
        }

        // Update project with files
        toast.info('Uploading files to existing repository...');
        await apiService.updateProjectWithFiles(existingProject.id, files);
        setCreatedRepoUrl(existingProject.http_url_to_repo);
        toast.success('Repository updated successfully!');
      } else {
        // Create new project with files
        toast.info('Creating new repository...');

        const newProject = await apiService.createProjectWithFiles(sanitizedRepoName, isPrivate, files);
        setCreatedRepoUrl(newProject.http_url_to_repo);
        toast.success('Repository created successfully!');
      }

      // Set pushed files for display
      const fileList = Object.entries(files).map(([filePath, content]) => ({
        path: filePath,
        size: new TextEncoder().encode(content).length,
      }));

      setPushedFiles(fileList);
      setShowSuccessDialog(true);

      // Save repository info
      localStorage.setItem(
        `gitlab-repo-${currentChatId}`,
        JSON.stringify({
          owner: connection.user.username,
          name: sanitizedRepoName,
          url: createdRepoUrl,
        }),
      );

      logStore.logInfo('GitLab deployment completed successfully', {
        type: 'system',
        message: `Successfully deployed ${fileList.length} files to ${projectExists ? 'existing' : 'new'} GitLab repository: ${projectPath}`,
        repoName: sanitizedRepoName,
        projectPath,
        filesCount: fileList.length,
        isNewProject: !projectExists,
      });
    } catch (error) {
      console.error('Error pushing to GitLab:', error);

      logStore.logError('GitLab deployment failed', {
        error,
        repoName: sanitizedRepoName,
        projectPath: `${connection.user.username}/${sanitizedRepoName}`,
      });

      // Provide specific error messages based on error type
      let errorMessage = 'Failed to push to GitLab';

      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase();

        if (errorMsg.includes('404') || errorMsg.includes('not found')) {
          errorMessage =
            'Repository or GitLab instance not found. Please check your GitLab URL and repository permissions.';
        } else if (errorMsg.includes('401') || errorMsg.includes('unauthorized')) {
          errorMessage = 'GitLab authentication failed. Please check your access token and permissions.';
        } else if (errorMsg.includes('403') || errorMsg.includes('forbidden')) {
          errorMessage =
            'Access denied. Your GitLab token may not have sufficient permissions to create/modify repositories.';
        } else if (errorMsg.includes('network') || errorMsg.includes('fetch')) {
          errorMessage = 'Network error. Please check your internet connection and try again.';
        } else if (errorMsg.includes('timeout')) {
          errorMessage = 'Request timed out. Please try again or check your connection.';
        } else if (errorMsg.includes('rate limit')) {
          errorMessage = 'GitLab API rate limit exceeded. Please wait a moment and try again.';
        } else {
          errorMessage = `GitLab error: ${error.message}`;
        }
      }

      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setRepoName('');
    setIsPrivate(false);
    setShowSuccessDialog(false);
    setCreatedRepoUrl('');
    onClose();
  };

  const handleAuthDialogClose = () => {
    setShowAuthDialog(false);

    // Refresh user data after auth
    const connection = getLocalStorage('gitlab_connection');

    if (connection?.user && connection?.token) {
      setUser(connection.user);
      fetchRecentRepos(connection.token, connection.gitlabUrl || 'https://gitlab.com');
    }
  };

  // Success Dialog
  if (showSuccessDialog) {
    return (
      <Dialog.Root open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999]" />
          <div className="fixed inset-0 flex items-center justify-center z-[9999]">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="w-[90vw] md:w-[600px] max-h-[85vh] overflow-y-auto"
            >
              <Dialog.Content
                className="bg-white dark:bg-bolt-elements-background-depth-1 rounded-lg border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor-dark shadow-xl"
                aria-describedby="success-dialog-description"
              >
                <Dialog.Title className="sr-only">Successfully pushed to GitLab</Dialog.Title>
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center text-green-500">
                        <div className="i-ph:check-circle w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary-dark">
                          Successfully pushed to GitLab
                        </h3>
                        <p
                          id="success-dialog-description"
                          className="text-sm text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary-dark"
                        >
                          Your code is now available on GitLab
                        </p>
                      </div>
                    </div>
                    <Dialog.Close asChild>
                      <button
                        onClick={handleClose}
                        className="p-2 rounded-lg transition-all duration-200 ease-in-out bg-transparent text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary dark:text-bolt-elements-textTertiary-dark dark:hover:text-bolt-elements-textPrimary-dark hover:bg-bolt-elements-background-depth-2 dark:hover:bg-bolt-elements-background-depth-3 focus:outline-none focus:ring-2 focus:ring-bolt-elements-borderColor dark:focus:ring-bolt-elements-borderColor-dark"
                      >
                        <span className="i-ph:x block w-5 h-5" aria-hidden="true" />
                        <span className="sr-only">Close dialog</span>
                      </button>
                    </Dialog.Close>
                  </div>

                  <div className="bg-bolt-elements-background-depth-2 dark:bg-bolt-elements-background-depth-3 rounded-lg p-4 text-left border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor-dark">
                    <p className="text-sm font-medium text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary-dark mb-2 flex items-center gap-2">
                      <span className="i-ph:gitlab-logo w-4 h-4 text-orange-500" />
                      Repository URL
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-sm bg-bolt-elements-background-depth-1 dark:bg-bolt-elements-background-depth-4 px-3 py-2 rounded border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor-dark text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary-dark font-mono">
                        {createdRepoUrl}
                      </code>
                      <motion.button
                        onClick={() => {
                          navigator.clipboard.writeText(createdRepoUrl);
                          toast.success('URL copied to clipboard');
                        }}
                        className="p-2 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary dark:text-bolt-elements-textSecondary-dark dark:hover:text-bolt-elements-textPrimary-dark bg-bolt-elements-background-depth-1 dark:bg-bolt-elements-background-depth-4 rounded-lg border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor-dark"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <div className="i-ph:copy w-4 h-4" />
                      </motion.button>
                    </div>
                  </div>

                  <div className="bg-bolt-elements-background-depth-2 dark:bg-bolt-elements-background-depth-3 rounded-lg p-4 border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor-dark">
                    <p className="text-sm font-medium text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary-dark mb-2 flex items-center gap-2">
                      <span className="i-ph:files w-4 h-4 text-purple-500" />
                      Pushed Files ({pushedFiles.length})
                    </p>
                    <div className="max-h-[200px] overflow-y-auto custom-scrollbar pr-2">
                      {pushedFiles.slice(0, 100).map((file) => (
                        <div
                          key={file.path}
                          className="flex items-center justify-between py-1.5 text-sm text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary-dark border-b border-bolt-elements-borderColor/30 dark:border-bolt-elements-borderColor-dark/30 last:border-0"
                        >
                          <span className="font-mono truncate flex-1 text-xs">{file.path}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-bolt-elements-background-depth-3 dark:bg-bolt-elements-background-depth-4 text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary-dark ml-2">
                            {formatSize(file.size)}
                          </span>
                        </div>
                      ))}
                      {pushedFiles.length > 100 && (
                        <div className="py-2 text-center text-xs text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary-dark">
                          +{pushedFiles.length - 100} more files
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <motion.a
                      href={createdRepoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-lg bg-orange-500 text-white hover:bg-orange-600 text-sm inline-flex items-center gap-2"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="i-ph:gitlab-logo w-4 h-4" />
                      View Repository
                    </motion.a>
                    <motion.button
                      onClick={() => {
                        navigator.clipboard.writeText(createdRepoUrl);
                        toast.success('URL copied to clipboard');
                      }}
                      className="px-4 py-2 rounded-lg bg-bolt-elements-background-depth-2 dark:bg-bolt-elements-background-depth-3 text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary-dark hover:bg-bolt-elements-background-depth-3 dark:hover:bg-bolt-elements-background-depth-4 text-sm inline-flex items-center gap-2 border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor-dark"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="i-ph:copy w-4 h-4" />
                      Copy URL
                    </motion.button>
                    <motion.button
                      onClick={handleClose}
                      className="px-4 py-2 rounded-lg bg-bolt-elements-background-depth-2 dark:bg-bolt-elements-background-depth-3 text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary-dark hover:bg-bolt-elements-background-depth-3 dark:hover:bg-bolt-elements-background-depth-4 text-sm border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor-dark"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      Close
                    </motion.button>
                  </div>
                </div>
              </Dialog.Content>
            </motion.div>
          </div>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }

  if (!user) {
    return (
      <Dialog.Root open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999]" />
          <div className="fixed inset-0 flex items-center justify-center z-[9999]">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="w-[90vw] md:w-[500px]"
            >
              <Dialog.Content
                className="bg-white dark:bg-bolt-elements-background-depth-1 rounded-lg p-6 border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor-dark shadow-xl"
                aria-describedby="connection-required-description"
              >
                <Dialog.Title className="sr-only">GitLab Connection Required</Dialog.Title>
                <div className="relative text-center space-y-4">
                  <Dialog.Close asChild>
                    <button
                      onClick={handleClose}
                      className="absolute right-0 top-0 p-2 rounded-lg transition-all duration-200 ease-in-out bg-transparent text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary dark:text-bolt-elements-textTertiary-dark dark:hover:text-bolt-elements-textPrimary-dark hover:bg-bolt-elements-background-depth-2 dark:hover:bg-bolt-elements-background-depth-3 focus:outline-none focus:ring-2 focus:ring-bolt-elements-borderColor dark:focus:ring-bolt-elements-borderColor-dark"
                    >
                      <span className="i-ph:x block w-5 h-5" aria-hidden="true" />
                      <span className="sr-only">Close dialog</span>
                    </button>
                  </Dialog.Close>
                  <motion.div
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.1 }}
                    className="mx-auto w-16 h-16 rounded-xl bg-bolt-elements-background-depth-3 flex items-center justify-center text-orange-500"
                  >
                    <div className="i-ph:gitlab-logo w-8 h-8" />
                  </motion.div>
                  <h3 className="text-lg font-medium text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary-dark">
                    GitLab Connection Required
                  </h3>
                  <p
                    id="connection-required-description"
                    className="text-sm text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary-dark max-w-md mx-auto"
                  >
                    To deploy your code to GitLab, you need to connect your GitLab account first.
                  </p>
                  <div className="pt-2 flex justify-center gap-3">
                    <motion.button
                      className="px-4 py-2 rounded-lg bg-bolt-elements-background-depth-2 dark:bg-bolt-elements-background-depth-3 text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary-dark text-sm hover:bg-bolt-elements-background-depth-3 dark:hover:bg-bolt-elements-background-depth-4 border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor-dark"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleClose}
                    >
                      Close
                    </motion.button>
                    <motion.button
                      onClick={() => setShowAuthDialog(true)}
                      className="px-4 py-2 rounded-lg bg-orange-500 text-white text-sm hover:bg-orange-600 inline-flex items-center gap-2"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="i-ph:gitlab-logo w-4 h-4" />
                      Connect GitLab Account
                    </motion.button>
                  </div>
                </div>
              </Dialog.Content>
            </motion.div>
          </div>
        </Dialog.Portal>

        {/* GitLab Auth Dialog */}
        <GitLabAuthDialog isOpen={showAuthDialog} onClose={handleAuthDialogClose} />
      </Dialog.Root>
    );
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999]" />
        <div className="fixed inset-0 flex items-center justify-center z-[9999]">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="w-[90vw] md:w-[500px]"
          >
            <Dialog.Content
              className="bg-white dark:bg-bolt-elements-background-depth-1 rounded-lg border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor-dark shadow-xl"
              aria-describedby="push-dialog-description"
            >
              <div className="p-6">
                <div className="flex items-center gap-4 mb-6">
                  <motion.div
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.1 }}
                    className="w-10 h-10 rounded-xl bg-bolt-elements-background-depth-3 flex items-center justify-center text-orange-500"
                  >
                    <div className="i-ph:gitlab-logo w-5 h-5" />
                  </motion.div>
                  <div>
                    <Dialog.Title className="text-lg font-medium text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary-dark">
                      Deploy to GitLab
                    </Dialog.Title>
                    <p
                      id="push-dialog-description"
                      className="text-sm text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary-dark"
                    >
                      Deploy your code to a new or existing GitLab repository
                    </p>
                  </div>
                  <Dialog.Close asChild>
                    <button
                      onClick={handleClose}
                      className="ml-auto p-2 rounded-lg transition-all duration-200 ease-in-out bg-transparent text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary dark:text-bolt-elements-textTertiary-dark dark:hover:text-bolt-elements-textPrimary-dark hover:bg-bolt-elements-background-depth-2 dark:hover:bg-bolt-elements-background-depth-3 focus:outline-none focus:ring-2 focus:ring-bolt-elements-borderColor dark:focus:ring-bolt-elements-borderColor-dark"
                    >
                      <span className="i-ph:x block w-5 h-5" aria-hidden="true" />
                      <span className="sr-only">Close dialog</span>
                    </button>
                  </Dialog.Close>
                </div>

                <div className="flex items-center gap-3 mb-6 p-4 bg-bolt-elements-background-depth-2 dark:bg-bolt-elements-background-depth-3 rounded-lg border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor-dark">
                  <div className="relative">
                    {user.avatar_url && user.avatar_url !== 'null' && user.avatar_url !== '' ? (
                      <img
                        src={user.avatar_url}
                        alt={user.username}
                        className="w-10 h-10 rounded-full object-cover"
                        crossOrigin="anonymous"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          // Handle CORS/COEP errors by hiding the image and showing fallback
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';

                          const fallback = target.parentElement?.querySelector('.avatar-fallback') as HTMLElement;

                          if (fallback) {
                            fallback.style.display = 'flex';
                          }
                        }}
                        onLoad={(e) => {
                          // Ensure fallback is hidden when image loads successfully
                          const target = e.target as HTMLImageElement;

                          const fallback = target.parentElement?.querySelector('.avatar-fallback') as HTMLElement;

                          if (fallback) {
                            fallback.style.display = 'none';
                          }
                        }}
                      />
                    ) : null}

                    <div
                      className="avatar-fallback w-10 h-10 rounded-full bg-bolt-elements-background-depth-4 flex items-center justify-center text-bolt-elements-textSecondary font-semibold text-sm"
                      style={{
                        display:
                          user.avatar_url && user.avatar_url !== 'null' && user.avatar_url !== '' ? 'none' : 'flex',
                      }}
                    >
                      {user.name ? (
                        user.name.charAt(0).toUpperCase()
                      ) : user.username ? (
                        user.username.charAt(0).toUpperCase()
                      ) : (
                        <div className="i-ph:user w-5 h-5" />
                      )}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center text-white">
                      <div className="i-ph:gitlab-logo w-3 h-3" />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary-dark">
                      {user.name || user.username}
                    </p>
                    <p className="text-sm text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary-dark">
                      @{user.username}
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <label
                      htmlFor="repoName"
                      className="text-sm text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary-dark"
                    >
                      Repository Name
                    </label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-bolt-elements-textTertiary dark:text-bolt-elements-textTertiary-dark">
                        <span className="i-ph:git-branch w-4 h-4" />
                      </div>
                      <input
                        id="repoName"
                        type="text"
                        value={repoName}
                        onChange={(e) => setRepoName(e.target.value)}
                        placeholder="my-awesome-project"
                        className="w-full pl-10 px-4 py-2 rounded-lg bg-bolt-elements-background-depth-2 dark:bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor-dark text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary-dark placeholder-bolt-elements-textTertiary dark:placeholder-bolt-elements-textTertiary-dark focus:outline-none focus:ring-2 focus:ring-orange-500"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary-dark">
                        Recent Repositories
                      </label>
                      <span className="text-xs text-bolt-elements-textTertiary dark:text-bolt-elements-textTertiary-dark">
                        {filteredRepos.length} of {recentRepos.length}
                      </span>
                    </div>

                    <div className="mb-2">
                      <SearchInput
                        placeholder="Search repositories..."
                        value={repoSearchQuery}
                        onChange={(e) => setRepoSearchQuery(e.target.value)}
                        onClear={() => setRepoSearchQuery('')}
                        className="bg-bolt-elements-background-depth-2 dark:bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor-dark text-sm"
                      />
                    </div>

                    {recentRepos.length === 0 && !isFetchingRepos ? (
                      <EmptyState
                        icon="i-ph:gitlab-logo"
                        title="No repositories found"
                        description="We couldn't find any repositories in your GitLab account."
                        variant="compact"
                      />
                    ) : (
                      <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                        {filteredRepos.length === 0 && repoSearchQuery.trim() !== '' ? (
                          <EmptyState
                            icon="i-ph:magnifying-glass"
                            title="No matching repositories"
                            description="Try a different search term"
                            variant="compact"
                          />
                        ) : (
                          filteredRepos.map((repo) => (
                            <motion.button
                              key={repo.id}
                              type="button"
                              onClick={() => setRepoName(repo.name)}
                              className="w-full p-3 text-left rounded-lg bg-bolt-elements-background-depth-2 dark:bg-bolt-elements-background-depth-3 hover:bg-bolt-elements-background-depth-3 dark:hover:bg-bolt-elements-background-depth-4 transition-colors group border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor-dark hover:border-orange-500/30"
                              whileHover={{ scale: 1.01 }}
                              whileTap={{ scale: 0.99 }}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="i-ph:git-branch w-4 h-4 text-orange-500" />
                                  <span className="text-sm font-medium text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary-dark group-hover:text-orange-500">
                                    {repo.name}
                                  </span>
                                </div>
                                {repo.visibility === 'private' && (
                                  <Badge variant="primary" size="sm" icon="i-ph:lock w-3 h-3">
                                    Private
                                  </Badge>
                                )}
                              </div>
                              {repo.description && (
                                <p className="mt-1 text-xs text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary-dark line-clamp-2">
                                  {repo.description}
                                </p>
                              )}
                              <div className="mt-2 flex items-center gap-2 flex-wrap">
                                <Badge variant="subtle" size="sm" icon="i-ph:star w-3 h-3">
                                  {repo.star_count.toLocaleString()}
                                </Badge>
                                <Badge variant="subtle" size="sm" icon="i-ph:git-fork w-3 h-3">
                                  {repo.forks_count.toLocaleString()}
                                </Badge>
                                <Badge variant="subtle" size="sm" icon="i-ph:clock w-3 h-3">
                                  {new Date(repo.updated_at).toLocaleDateString()}
                                </Badge>
                              </div>
                            </motion.button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {isFetchingRepos && (
                    <div className="flex items-center justify-center py-4">
                      <StatusIndicator status="loading" pulse={true} label="Loading repositories..." />
                    </div>
                  )}

                  <div className="p-3 bg-bolt-elements-background-depth-2 dark:bg-bolt-elements-background-depth-3 rounded-lg border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor-dark">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="private"
                        checked={isPrivate}
                        onChange={(e) => setIsPrivate(e.target.checked)}
                        className="rounded border-bolt-elements-borderColor dark:border-bolt-elements-borderColor-dark text-orange-500 focus:ring-orange-500 dark:bg-bolt-elements-background-depth-3"
                      />
                      <label
                        htmlFor="private"
                        className="text-sm text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary-dark"
                      >
                        Make repository private
                      </label>
                    </div>
                    <p className="text-xs text-bolt-elements-textTertiary dark:text-bolt-elements-textTertiary-dark mt-2 ml-6">
                      Private repositories are only visible to you and people you share them with
                    </p>
                  </div>

                  <div className="pt-4 flex gap-2">
                    <motion.button
                      type="button"
                      onClick={handleClose}
                      className="px-4 py-2 rounded-lg bg-bolt-elements-background-depth-2 dark:bg-bolt-elements-background-depth-3 text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary-dark hover:bg-bolt-elements-background-depth-3 dark:hover:bg-bolt-elements-background-depth-4 text-sm border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor-dark"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      Cancel
                    </motion.button>
                    <motion.button
                      type="submit"
                      disabled={isLoading}
                      className={classNames(
                        'flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-sm inline-flex items-center justify-center gap-2',
                        isLoading ? 'opacity-50 cursor-not-allowed' : '',
                      )}
                      whileHover={!isLoading ? { scale: 1.02 } : {}}
                      whileTap={!isLoading ? { scale: 0.98 } : {}}
                    >
                      {isLoading ? (
                        <>
                          <div className="i-ph:spinner-gap animate-spin w-4 h-4" />
                          Deploying...
                        </>
                      ) : (
                        <>
                          <div className="i-ph:gitlab-logo w-4 h-4" />
                          Deploy to GitLab
                        </>
                      )}
                    </motion.button>
                  </div>
                </form>
              </div>
            </Dialog.Content>
          </motion.div>
        </div>
      </Dialog.Portal>

      {/* GitLab Auth Dialog */}
      <GitLabAuthDialog isOpen={showAuthDialog} onClose={handleAuthDialogClose} />
    </Dialog.Root>
  );
}
