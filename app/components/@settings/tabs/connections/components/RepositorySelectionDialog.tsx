import type { GitHubRepoInfo, GitHubContent, RepositoryStats, GitHubUserResponse } from '~/types/GitHub';
import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import * as Dialog from '@radix-ui/react-dialog';
import { classNames } from '~/utils/classNames';
import { getLocalStorage } from '~/lib/persistence';
import { motion } from 'framer-motion';
import { formatSize } from '~/utils/formatSize';
import { Input } from '~/components/ui/Input';
import Cookies from 'js-cookie';

interface GitHubTreeResponse {
  tree: Array<{
    path: string;
    type: string;
    size?: number;
  }>;
}

interface RepositorySelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
}

interface SearchFilters {
  language?: string;
  stars?: number;
  forks?: number;
}

interface StatsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  stats: RepositoryStats;
  isLargeRepo?: boolean;
}

function StatsDialog({ isOpen, onClose, onConfirm, stats, isLargeRepo }: StatsDialogProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
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
            <Dialog.Content className="bg-white dark:bg-[#1E1E1E] rounded-lg border border-[#E5E5E5] dark:border-[#333333] shadow-xl">
              <div className="p-6 space-y-4">
                <div>
                  <h3 className="text-lg font-medium text-[#111111] dark:text-white">Repository Overview</h3>
                  <div className="mt-4 space-y-2">
                    <p className="text-sm text-[#666666] dark:text-[#999999]">Repository Statistics:</p>
                    <div className="space-y-2 text-sm text-[#111111] dark:text-white">
                      <div className="flex items-center gap-2">
                        <span className="i-ph:files text-purple-500 w-4 h-4" />
                        <span>Total Files: {stats.totalFiles}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="i-ph:database text-purple-500 w-4 h-4" />
                        <span>Total Size: {formatSize(stats.totalSize)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="i-ph:code text-purple-500 w-4 h-4" />
                        <span>
                          Languages:{' '}
                          {Object.entries(stats.languages)
                            .sort(([, a], [, b]) => b - a)
                            .slice(0, 3)
                            .map(([lang, size]) => `${lang} (${formatSize(size)})`)
                            .join(', ')}
                        </span>
                      </div>
                      {stats.hasPackageJson && (
                        <div className="flex items-center gap-2">
                          <span className="i-ph:package text-purple-500 w-4 h-4" />
                          <span>Has package.json</span>
                        </div>
                      )}
                      {stats.hasDependencies && (
                        <div className="flex items-center gap-2">
                          <span className="i-ph:tree-structure text-purple-500 w-4 h-4" />
                          <span>Has dependencies</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {isLargeRepo && (
                    <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-500/10 rounded-lg text-sm flex items-start gap-2">
                      <span className="i-ph:warning text-yellow-600 dark:text-yellow-500 w-4 h-4 flex-shrink-0 mt-0.5" />
                      <div className="text-yellow-800 dark:text-yellow-500">
                        This repository is quite large ({formatSize(stats.totalSize)}). Importing it might take a while
                        and could impact performance.
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="border-t border-[#E5E5E5] dark:border-[#333333] p-4 flex justify-end gap-3 bg-[#F9F9F9] dark:bg-[#252525] rounded-b-lg">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg bg-[#F5F5F5] dark:bg-[#333333] text-[#666666] hover:text-[#111111] dark:text-[#999999] dark:hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={onConfirm}
                  className="px-4 py-2 rounded-lg bg-purple-500 text-white hover:bg-purple-600 transition-colors"
                >
                  OK
                </button>
              </div>
            </Dialog.Content>
          </motion.div>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function GitHubAuthDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [token, setToken] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tokenType, setTokenType] = useState<'classic' | 'fine-grained'>('classic');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token.trim()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const userData = (await response.json()) as GitHubUserResponse;

        // Save connection data
        const connectionData = {
          token,
          tokenType,
          user: {
            login: userData.login,
            avatar_url: userData.avatar_url,
            name: userData.name || userData.login,
          },
          connected_at: new Date().toISOString(),
        };

        localStorage.setItem('github_connection', JSON.stringify(connectionData));

        // Set cookies for API requests
        Cookies.set('githubToken', token);
        Cookies.set('githubUsername', userData.login);
        Cookies.set('git:github.com', JSON.stringify({ username: token, password: 'x-oauth-basic' }));

        toast.success(`Successfully connected as ${userData.login}`);
        onClose();
      } else {
        if (response.status === 401) {
          toast.error('Invalid GitHub token. Please check and try again.');
        } else {
          toast.error(`GitHub API error: ${response.status} ${response.statusText}`);
        }
      }
    } catch (error) {
      console.error('Error connecting to GitHub:', error);
      toast.error('Failed to connect to GitHub. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999]" />
        <div className="fixed inset-0 flex items-center justify-center z-[9999]">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <Dialog.Content className="bg-white dark:bg-[#1A1A1A] rounded-lg shadow-xl max-w-sm w-full mx-4 overflow-hidden">
              <div className="p-4 space-y-3">
                <h2 className="text-lg font-semibold text-[#111111] dark:text-white">Access Private Repositories</h2>

                <p className="text-sm text-[#666666] dark:text-[#999999]">
                  To access private repositories, you need to connect your GitHub account by providing a personal access
                  token.
                </p>

                <div className="bg-[#F9F9F9] dark:bg-[#252525] p-4 rounded-lg space-y-3">
                  <h3 className="text-base font-medium text-[#111111] dark:text-white">Connect with GitHub Token</h3>

                  <form onSubmit={handleSubmit} className="space-y-3">
                    <div>
                      <label className="block text-sm text-[#666666] dark:text-[#999999] mb-1">
                        GitHub Personal Access Token
                      </label>
                      <input
                        type="password"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                        className="w-full px-3 py-1.5 rounded-lg border border-[#E5E5E5] dark:border-[#333333] bg-white dark:bg-[#1A1A1A] text-[#111111] dark:text-white placeholder-[#999999] text-sm"
                      />
                      <div className="mt-1 text-xs text-[#666666] dark:text-[#999999]">
                        Get your token at{' '}
                        <a
                          href="https://github.com/settings/tokens"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-purple-500 hover:underline"
                        >
                          github.com/settings/tokens
                        </a>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-sm text-[#666666] dark:text-[#999999]">Token Type</label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            checked={tokenType === 'classic'}
                            onChange={() => setTokenType('classic')}
                            className="w-3.5 h-3.5 accent-purple-500"
                          />
                          <span className="text-sm text-[#111111] dark:text-white">Classic</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            checked={tokenType === 'fine-grained'}
                            onChange={() => setTokenType('fine-grained')}
                            className="w-3.5 h-3.5 accent-purple-500"
                          />
                          <span className="text-sm text-[#111111] dark:text-white">Fine-grained</span>
                        </label>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      {isSubmitting ? 'Connecting...' : 'Connect to GitHub'}
                    </button>
                  </form>
                </div>

                <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg space-y-1.5">
                  <h3 className="text-sm text-amber-800 dark:text-amber-300 font-medium flex items-center gap-1.5">
                    <span className="i-ph:warning-circle w-4 h-4" />
                    Accessing Private Repositories
                  </h3>
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Important things to know about accessing private repositories:
                  </p>
                  <ul className="list-disc pl-4 text-xs text-amber-700 dark:text-amber-400 space-y-0.5">
                    <li>You must be granted access to the repository by its owner</li>
                    <li>Your GitHub token must have the 'repo' scope</li>
                    <li>For organization repositories, you may need additional permissions</li>
                    <li>No token can give you access to repositories you don't have permission for</li>
                  </ul>
                </div>
              </div>

              <div className="border-t border-[#E5E5E5] dark:border-[#333333] p-3 flex justify-end">
                <Dialog.Close asChild>
                  <button
                    onClick={onClose}
                    className="px-4 py-1.5 bg-[#F5F5F5] hover:bg-[#E5E5E5] dark:bg-[#252525] dark:hover:bg-[#333333] rounded-lg text-[#111111] dark:text-white transition-colors text-sm"
                  >
                    Close
                  </button>
                </Dialog.Close>
              </div>
            </Dialog.Content>
          </motion.div>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function RepositorySelectionDialog({ isOpen, onClose, onSelect }: RepositorySelectionDialogProps) {
  const [selectedRepository, setSelectedRepository] = useState<GitHubRepoInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [repositories, setRepositories] = useState<GitHubRepoInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GitHubRepoInfo[]>([]);
  const [activeTab, setActiveTab] = useState<'my-repos' | 'search' | 'url'>('my-repos');
  const [customUrl, setCustomUrl] = useState('');
  const [branches, setBranches] = useState<{ name: string; default?: boolean }[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({});
  const [showStatsDialog, setShowStatsDialog] = useState(false);
  const [currentStats, setCurrentStats] = useState<RepositoryStats | null>(null);
  const [pendingGitUrl, setPendingGitUrl] = useState<string>('');
  const [showAuthDialog, setShowAuthDialog] = useState(false);

  // Handle GitHub auth dialog close and refresh repositories
  const handleAuthDialogClose = () => {
    setShowAuthDialog(false);

    // If we're on the my-repos tab, refresh the repository list
    if (activeTab === 'my-repos') {
      fetchUserRepos();
    }
  };

  // Initialize GitHub connection and fetch repositories
  useEffect(() => {
    const savedConnection = getLocalStorage('github_connection');

    // If no connection exists but environment variables are set, create a connection
    if (!savedConnection && import.meta.env.VITE_GITHUB_ACCESS_TOKEN) {
      const token = import.meta.env.VITE_GITHUB_ACCESS_TOKEN;
      const tokenType = import.meta.env.VITE_GITHUB_TOKEN_TYPE === 'fine-grained' ? 'fine-grained' : 'classic';

      // Fetch GitHub user info to initialize the connection
      fetch('https://api.github.com/user', {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          Authorization: `Bearer ${token}`,
        },
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error('Invalid token or unauthorized');
          }

          return response.json();
        })
        .then((data: unknown) => {
          const userData = data as GitHubUserResponse;

          // Save connection to local storage
          const newConnection = {
            token,
            tokenType,
            user: {
              login: userData.login,
              avatar_url: userData.avatar_url,
              name: userData.name || userData.login,
            },
            connected_at: new Date().toISOString(),
          };

          localStorage.setItem('github_connection', JSON.stringify(newConnection));

          // Also save as cookies for API requests
          Cookies.set('githubToken', token);
          Cookies.set('githubUsername', userData.login);
          Cookies.set('git:github.com', JSON.stringify({ username: token, password: 'x-oauth-basic' }));

          // Refresh repositories after connection is established
          if (isOpen && activeTab === 'my-repos') {
            fetchUserRepos();
          }
        })
        .catch((error) => {
          console.error('Failed to initialize GitHub connection from environment variables:', error);
        });
    }
  }, [isOpen]);

  // Fetch repositories when dialog opens or tab changes
  useEffect(() => {
    if (isOpen && activeTab === 'my-repos') {
      fetchUserRepos();
    }
  }, [isOpen, activeTab]);

  const fetchUserRepos = async () => {
    const connection = getLocalStorage('github_connection');

    if (!connection?.token) {
      toast.error('Please connect your GitHub account first');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100&type=all', {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          Authorization: `Bearer ${connection.token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch repositories');
      }

      const data = await response.json();

      // Add type assertion and validation
      if (
        Array.isArray(data) &&
        data.every((item) => typeof item === 'object' && item !== null && 'full_name' in item)
      ) {
        setRepositories(data as GitHubRepoInfo[]);
      } else {
        throw new Error('Invalid repository data format');
      }
    } catch (error) {
      console.error('Error fetching repos:', error);
      toast.error('Failed to fetch your repositories');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    setIsLoading(true);
    setSearchResults([]);

    try {
      let searchQuery = query;

      if (filters.language) {
        searchQuery += ` language:${filters.language}`;
      }

      if (filters.stars) {
        searchQuery += ` stars:>${filters.stars}`;
      }

      if (filters.forks) {
        searchQuery += ` forks:>${filters.forks}`;
      }

      const response = await fetch(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(searchQuery)}&sort=stars&order=desc`,
        {
          headers: {
            Accept: 'application/vnd.github.v3+json',
          },
        },
      );

      if (!response.ok) {
        throw new Error('Failed to search repositories');
      }

      const data = await response.json();

      // Add type assertion and validation
      if (typeof data === 'object' && data !== null && 'items' in data && Array.isArray(data.items)) {
        setSearchResults(data.items as GitHubRepoInfo[]);
      } else {
        throw new Error('Invalid search results format');
      }
    } catch (error) {
      console.error('Error searching repos:', error);
      toast.error('Failed to search repositories');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBranches = async (repo: GitHubRepoInfo) => {
    setIsLoading(true);

    try {
      const connection = getLocalStorage('github_connection');
      const headers: HeadersInit = connection?.token
        ? {
            Accept: 'application/vnd.github.v3+json',
            Authorization: `Bearer ${connection.token}`,
          }
        : {};
      const response = await fetch(`https://api.github.com/repos/${repo.full_name}/branches`, {
        headers,
      });

      if (!response.ok) {
        throw new Error('Failed to fetch branches');
      }

      const data = await response.json();

      // Add type assertion and validation
      if (Array.isArray(data) && data.every((item) => typeof item === 'object' && item !== null && 'name' in item)) {
        setBranches(
          data.map((branch) => ({
            name: branch.name,
            default: branch.name === repo.default_branch,
          })),
        );
      } else {
        throw new Error('Invalid branch data format');
      }
    } catch (error) {
      console.error('Error fetching branches:', error);
      toast.error('Failed to fetch branches');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRepoSelect = async (repo: GitHubRepoInfo) => {
    setSelectedRepository(repo);
    await fetchBranches(repo);
  };

  const formatGitUrl = (url: string): string => {
    // Remove any tree references and ensure .git extension
    const baseUrl = url
      .replace(/\/tree\/[^/]+/, '') // Remove /tree/branch-name
      .replace(/\/$/, '') // Remove trailing slash
      .replace(/\.git$/, ''); // Remove .git if present
    return `${baseUrl}.git`;
  };

  const verifyRepository = async (repoUrl: string): Promise<RepositoryStats | null> => {
    try {
      // Extract branch from URL if present (format: url#branch)
      let branch: string | null = null;
      let cleanUrl = repoUrl;

      if (repoUrl.includes('#')) {
        const parts = repoUrl.split('#');
        cleanUrl = parts[0];
        branch = parts[1];
      }

      const [owner, repo] = cleanUrl
        .replace(/\.git$/, '')
        .split('/')
        .slice(-2);

      // Try to get token from local storage first
      const connection = getLocalStorage('github_connection');

      // If no connection in local storage, check environment variables
      let headers: HeadersInit = {};

      if (connection?.token) {
        headers = {
          Accept: 'application/vnd.github.v3+json',
          Authorization: `Bearer ${connection.token}`,
        };
      } else if (import.meta.env.VITE_GITHUB_ACCESS_TOKEN) {
        // Use token from environment variables
        headers = {
          Accept: 'application/vnd.github.v3+json',
          Authorization: `Bearer ${import.meta.env.VITE_GITHUB_ACCESS_TOKEN}`,
        };
      }

      // First, get the repository info to determine the default branch
      const repoInfoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers,
      });

      if (!repoInfoResponse.ok) {
        if (repoInfoResponse.status === 401 || repoInfoResponse.status === 403) {
          throw new Error(
            `Authentication failed (${repoInfoResponse.status}). Your GitHub token may be invalid or missing the required permissions.`,
          );
        } else if (repoInfoResponse.status === 404) {
          throw new Error(
            `Repository not found or is private (${repoInfoResponse.status}). To access private repositories, you need to connect your GitHub account or provide a valid token with appropriate permissions.`,
          );
        } else {
          throw new Error(
            `Failed to fetch repository information: ${repoInfoResponse.statusText} (${repoInfoResponse.status})`,
          );
        }
      }

      const repoInfo = (await repoInfoResponse.json()) as { default_branch: string };
      let defaultBranch = repoInfo.default_branch || 'main';

      // If a branch was specified in the URL, use that instead of the default
      if (branch) {
        defaultBranch = branch;
      }

      // Try to fetch the repository tree using the selected branch
      let treeResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`,
        {
          headers,
        },
      );

      // If the selected branch doesn't work, try common branch names
      if (!treeResponse.ok) {
        // Try 'master' branch if default branch failed
        treeResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/master?recursive=1`, {
          headers,
        });

        // If master also fails, try 'main' branch
        if (!treeResponse.ok) {
          treeResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`, {
            headers,
          });
        }

        // If all common branches fail, throw an error
        if (!treeResponse.ok) {
          throw new Error(
            'Failed to fetch repository structure. Please check the repository URL and your access permissions.',
          );
        }
      }

      const treeData = (await treeResponse.json()) as GitHubTreeResponse;

      // Calculate repository stats
      let totalSize = 0;
      let totalFiles = 0;
      const languages: { [key: string]: number } = {};
      let hasPackageJson = false;
      let hasDependencies = false;

      for (const file of treeData.tree) {
        if (file.type === 'blob') {
          totalFiles++;

          if (file.size) {
            totalSize += file.size;
          }

          // Check for package.json
          if (file.path === 'package.json') {
            hasPackageJson = true;

            // Fetch package.json content to check dependencies
            const contentResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/package.json`, {
              headers,
            });

            if (contentResponse.ok) {
              const content = (await contentResponse.json()) as GitHubContent;
              const packageJson = JSON.parse(Buffer.from(content.content, 'base64').toString());
              hasDependencies = !!(
                packageJson.dependencies ||
                packageJson.devDependencies ||
                packageJson.peerDependencies
              );
            }
          }

          // Detect language based on file extension
          const ext = file.path.split('.').pop()?.toLowerCase();

          if (ext) {
            languages[ext] = (languages[ext] || 0) + (file.size || 0);
          }
        }
      }

      const stats: RepositoryStats = {
        totalFiles,
        totalSize,
        languages,
        hasPackageJson,
        hasDependencies,
      };

      return stats;
    } catch (error) {
      console.error('Error verifying repository:', error);

      // Check if it's an authentication error and show the auth dialog
      const errorMessage = error instanceof Error ? error.message : 'Failed to verify repository';

      if (
        errorMessage.includes('Authentication failed') ||
        errorMessage.includes('may be private') ||
        errorMessage.includes('Repository not found or is private') ||
        errorMessage.includes('Unauthorized') ||
        errorMessage.includes('401') ||
        errorMessage.includes('403') ||
        errorMessage.includes('404') ||
        errorMessage.includes('access permissions')
      ) {
        setShowAuthDialog(true);
      }

      toast.error(errorMessage);

      return null;
    }
  };

  const handleImport = async () => {
    try {
      let gitUrl: string;

      if (activeTab === 'url' && customUrl) {
        gitUrl = formatGitUrl(customUrl);
      } else if (selectedRepository) {
        gitUrl = formatGitUrl(selectedRepository.html_url);

        if (selectedBranch) {
          gitUrl = `${gitUrl}#${selectedBranch}`;
        }
      } else {
        return;
      }

      // Verify repository before importing
      const stats = await verifyRepository(gitUrl);

      if (!stats) {
        return;
      }

      setCurrentStats(stats);
      setPendingGitUrl(gitUrl);
      setShowStatsDialog(true);
    } catch (error) {
      console.error('Error preparing repository:', error);

      // Check if it's an authentication error
      const errorMessage = error instanceof Error ? error.message : 'Failed to prepare repository. Please try again.';

      // Show the GitHub auth dialog for any authentication or permission errors
      if (
        errorMessage.includes('Authentication failed') ||
        errorMessage.includes('may be private') ||
        errorMessage.includes('Repository not found or is private') ||
        errorMessage.includes('Unauthorized') ||
        errorMessage.includes('401') ||
        errorMessage.includes('403') ||
        errorMessage.includes('404') ||
        errorMessage.includes('access permissions')
      ) {
        // Directly show the auth dialog instead of just showing a toast
        setShowAuthDialog(true);

        toast.error(
          <div className="space-y-2">
            <p>{errorMessage}</p>
            <button onClick={() => setShowAuthDialog(true)} className="underline font-medium block text-purple-500">
              Learn how to access private repositories
            </button>
          </div>,
          { autoClose: 10000 }, // Keep the toast visible longer
        );
      } else {
        toast.error(errorMessage);
      }
    }
  };

  const handleStatsConfirm = () => {
    setShowStatsDialog(false);

    if (pendingGitUrl) {
      onSelect(pendingGitUrl);
      onClose();
    }
  };

  const handleFilterChange = (key: keyof SearchFilters, value: string) => {
    let parsedValue: string | number | undefined = value;

    if (key === 'stars' || key === 'forks') {
      parsedValue = value ? parseInt(value, 10) : undefined;
    }

    setFilters((prev) => ({ ...prev, [key]: parsedValue }));
    handleSearch(searchQuery);
  };

  // Handle dialog close properly
  const handleClose = () => {
    setIsLoading(false); // Reset loading state
    setSearchQuery(''); // Reset search
    setSearchResults([]); // Reset results
    onClose();
  };

  return (
    <>
      <Dialog.Root
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleClose();
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[90vw] md:w-[600px] max-h-[85vh] overflow-hidden bg-white dark:bg-[#1A1A1A] rounded-xl shadow-xl z-[51] border border-[#E5E5E5] dark:border-[#333333]">
            <div className="p-4 border-b border-[#E5E5E5] dark:border-[#333333] flex items-center justify-between">
              <Dialog.Title className="text-lg font-semibold text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary-dark">
                Import GitHub Repository
              </Dialog.Title>
              <Dialog.Close
                onClick={handleClose}
                className={classNames(
                  'p-2 rounded-lg transition-all duration-200 ease-in-out',
                  'text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary',
                  'dark:text-bolt-elements-textTertiary-dark dark:hover:text-bolt-elements-textPrimary-dark',
                  'hover:bg-bolt-elements-background-depth-2 dark:hover:bg-bolt-elements-background-depth-3',
                  'focus:outline-none focus:ring-2 focus:ring-bolt-elements-borderColor dark:focus:ring-bolt-elements-borderColor-dark',
                )}
              >
                <span className="i-ph:x block w-5 h-5" aria-hidden="true" />
                <span className="sr-only">Close dialog</span>
              </Dialog.Close>
            </div>

            <div className="p-4 border-b border-[#E5E5E5] dark:border-[#333333] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="i-ph:info text-blue-500" />
                <span className="text-sm text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary-dark">
                  Need to access private repositories?
                </span>
              </div>
              <button
                onClick={() => setShowAuthDialog(true)}
                className="px-3 py-1.5 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm transition-colors flex items-center gap-1.5"
              >
                <span className="i-ph:key" />
                Connect GitHub Account
              </button>
            </div>

            <div className="p-4">
              <div className="flex gap-2 mb-4">
                <TabButton active={activeTab === 'my-repos'} onClick={() => setActiveTab('my-repos')}>
                  <span className="i-ph:book-bookmark" />
                  My Repos
                </TabButton>
                <TabButton active={activeTab === 'search'} onClick={() => setActiveTab('search')}>
                  <span className="i-ph:magnifying-glass" />
                  Search
                </TabButton>
                <TabButton active={activeTab === 'url'} onClick={() => setActiveTab('url')}>
                  <span className="i-ph:link" />
                  URL
                </TabButton>
              </div>

              {activeTab === 'url' ? (
                <div className="space-y-4">
                  <Input
                    type="text"
                    placeholder="Enter GitHub repository URL"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    className="w-full"
                  />

                  <button
                    onClick={handleImport}
                    disabled={!customUrl}
                    className={classNames(
                      'w-full h-10 px-4 py-2 rounded-lg text-white transition-all duration-200 flex items-center gap-2 justify-center',
                      customUrl
                        ? 'bg-purple-500 hover:bg-purple-600'
                        : 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed',
                    )}
                  >
                    Import Repository
                  </button>
                </div>
              ) : (
                <>
                  {activeTab === 'search' && (
                    <div className="space-y-4 mb-4">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Search repositories..."
                          value={searchQuery}
                          onChange={(e) => {
                            setSearchQuery(e.target.value);
                            handleSearch(e.target.value);
                          }}
                          className="flex-1 px-4 py-2 rounded-lg bg-[#F5F5F5] dark:bg-[#252525] border border-[#E5E5E5] dark:border-[#333333] text-bolt-elements-textPrimary"
                        />
                        <button
                          onClick={() => setFilters({})}
                          className="px-3 py-2 rounded-lg bg-[#F5F5F5] dark:bg-[#252525] text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary"
                        >
                          <span className="i-ph:funnel-simple" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Filter by language..."
                          value={filters.language || ''}
                          onChange={(e) => {
                            setFilters({ ...filters, language: e.target.value });
                            handleSearch(searchQuery);
                          }}
                          className="px-3 py-1.5 text-sm rounded-lg bg-[#F5F5F5] dark:bg-[#252525] border border-[#E5E5E5] dark:border-[#333333]"
                        />
                        <input
                          type="number"
                          placeholder="Min stars..."
                          value={filters.stars || ''}
                          onChange={(e) => handleFilterChange('stars', e.target.value)}
                          className="px-3 py-1.5 text-sm rounded-lg bg-[#F5F5F5] dark:bg-[#252525] border border-[#E5E5E5] dark:border-[#333333]"
                        />
                      </div>
                      <input
                        type="number"
                        placeholder="Min forks..."
                        value={filters.forks || ''}
                        onChange={(e) => handleFilterChange('forks', e.target.value)}
                        className="px-3 py-1.5 text-sm rounded-lg bg-[#F5F5F5] dark:bg-[#252525] border border-[#E5E5E5] dark:border-[#333333]"
                      />
                    </div>
                  )}

                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {selectedRepository ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedRepository(null)}
                            className="p-1.5 rounded-lg hover:bg-[#F5F5F5] dark:hover:bg-[#252525]"
                          >
                            <span className="i-ph:arrow-left w-4 h-4" />
                          </button>
                          <h3 className="font-medium">{selectedRepository.full_name}</h3>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm text-bolt-elements-textSecondary">Select Branch</label>
                          <select
                            value={selectedBranch}
                            onChange={(e) => setSelectedBranch(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-bolt-elements-background-depth-2 dark:bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor-dark text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary-dark focus:outline-none focus:ring-2 focus:ring-bolt-elements-borderColor dark:focus:ring-bolt-elements-borderColor-dark"
                          >
                            {branches.map((branch) => (
                              <option
                                key={branch.name}
                                value={branch.name}
                                className="bg-bolt-elements-background-depth-2 dark:bg-bolt-elements-background-depth-3 text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary-dark"
                              >
                                {branch.name} {branch.default ? '(default)' : ''}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={handleImport}
                            className="w-full h-10 px-4 py-2 rounded-lg bg-purple-500 text-white hover:bg-purple-600 transition-all duration-200 flex items-center gap-2 justify-center"
                          >
                            Import Selected Branch
                          </button>
                        </div>
                      </div>
                    ) : (
                      <RepositoryList
                        repos={activeTab === 'my-repos' ? repositories : searchResults}
                        isLoading={isLoading}
                        onSelect={handleRepoSelect}
                        activeTab={activeTab}
                      />
                    )}
                  </div>
                </>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>

        {/* GitHub Auth Dialog */}
        <GitHubAuthDialog isOpen={showAuthDialog} onClose={handleAuthDialogClose} />

        {/* Repository Stats Dialog */}
        {currentStats && (
          <StatsDialog
            isOpen={showStatsDialog}
            onClose={() => setShowStatsDialog(false)}
            onConfirm={handleStatsConfirm}
            stats={currentStats}
            isLargeRepo={currentStats.totalSize > 50 * 1024 * 1024}
          />
        )}
      </Dialog.Root>
    </>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={classNames(
        'px-4 py-2 h-10 rounded-lg transition-all duration-200 flex items-center gap-2 min-w-[120px] justify-center',
        active
          ? 'bg-purple-500 text-white hover:bg-purple-600'
          : 'bg-[#F5F5F5] dark:bg-[#252525] text-bolt-elements-textPrimary dark:text-white hover:bg-[#E5E5E5] dark:hover:bg-[#333333] border border-[#E5E5E5] dark:border-[#333333]',
      )}
    >
      {children}
    </button>
  );
}

function RepositoryList({
  repos,
  isLoading,
  onSelect,
  activeTab,
}: {
  repos: GitHubRepoInfo[];
  isLoading: boolean;
  onSelect: (repo: GitHubRepoInfo) => void;
  activeTab: string;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-bolt-elements-textSecondary">
        <span className="i-ph:spinner animate-spin mr-2" />
        Loading repositories...
      </div>
    );
  }

  if (repos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-bolt-elements-textSecondary">
        <span className="i-ph:folder-simple-dashed w-12 h-12 mb-2 opacity-50" />
        <p>{activeTab === 'my-repos' ? 'No repositories found' : 'Search for repositories'}</p>
      </div>
    );
  }

  return repos.map((repo) => <RepositoryCard key={repo.full_name} repo={repo} onSelect={() => onSelect(repo)} />);
}

function RepositoryCard({ repo, onSelect }: { repo: GitHubRepoInfo; onSelect: () => void }) {
  return (
    <div className="p-4 rounded-lg bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor hover:border-bolt-elements-borderColorActive/70 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="i-ph:git-repository text-bolt-elements-textTertiary" />
          <h3 className="font-medium text-bolt-elements-textPrimary dark:text-white">{repo.name}</h3>
        </div>
        <button
          onClick={onSelect}
          className="px-4 py-2 h-10 rounded-lg bg-purple-500 text-white hover:bg-purple-600 transition-all duration-200 flex items-center gap-2 min-w-[120px] justify-center"
        >
          <span className="i-ph:download-simple w-4 h-4" />
          Import
        </button>
      </div>
      {repo.description && <p className="text-sm text-bolt-elements-textSecondary mb-3">{repo.description}</p>}
      <div className="flex items-center gap-4 text-sm text-bolt-elements-textTertiary">
        {repo.language && (
          <span className="flex items-center gap-1">
            <span className="i-ph:code" />
            {repo.language}
          </span>
        )}
        <span className="flex items-center gap-1">
          <span className="i-ph:star" />
          {repo.stargazers_count.toLocaleString()}
        </span>
        <span className="flex items-center gap-1">
          <span className="i-ph:clock" />
          {new Date(repo.updated_at).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}
