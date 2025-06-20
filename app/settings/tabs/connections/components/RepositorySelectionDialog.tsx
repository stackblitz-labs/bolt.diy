import type {
  GitHubRepoInfo,
  GitHubContent,
  RepositoryStats,
  GitHubUserResponse,
} from '~/shared/components/github/types/GitHub';
import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import * as Dialog from '@radix-ui/react-dialog';
import { classNames } from '~/shared/utils/classNames';
import { getLocalStorage } from '~/shared/lib/persistence';
import { motion, AnimatePresence } from 'framer-motion';
import Cookies from 'js-cookie';

// Import UI components
import { Input, SearchInput, Badge, FilterChip } from '~/shared/components/ui';

// Import the components we've extracted
import { RepositoryList } from './RepositoryList';
import { StatsDialog } from './StatsDialog';
import { GitHubAuthDialog } from './GitHubAuthDialog';
import { RepositoryDialogContext } from './RepositoryDialogContext';

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
    <RepositoryDialogContext.Provider value={{ setShowAuthDialog }}>
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
          <Dialog.Content className="fixed top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[90vw] md:w-[650px] max-h-[85vh] overflow-hidden bg-white dark:bg-bolt-elements-background-depth-1 rounded-xl shadow-xl z-[51] border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor-dark">
            {/* Header */}
            <div className="p-5 border-b border-bolt-elements-borderColor dark:border-bolt-elements-borderColor-dark flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/10 flex items-center justify-center text-purple-500 shadow-sm">
                  <span className="i-ph:github-logo w-5 h-5" />
                </div>
                <div>
                  <Dialog.Title className="text-lg font-semibold text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary-dark">
                    Import GitHub Repository
                  </Dialog.Title>
                  <p className="text-sm text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary-dark">
                    Clone a repository from GitHub to your workspace
                  </p>
                </div>
              </div>
              <Dialog.Close
                onClick={handleClose}
                className={classNames(
                  'p-2 rounded-lg transition-all duration-200 ease-in-out bg-transparent',
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

            {/* Auth Info Banner */}
            <div className="p-4 border-b border-bolt-elements-borderColor dark:border-bolt-elements-borderColor-dark flex items-center justify-between bg-gradient-to-r from-bolt-elements-background-depth-2 to-bolt-elements-background-depth-1 dark:from-bolt-elements-background-depth-3 dark:to-bolt-elements-background-depth-2">
              <div className="flex items-center gap-2">
                <span className="i-ph:info text-blue-500" />
                <span className="text-sm text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary-dark">
                  Need to access private repositories?
                </span>
              </div>
              <motion.button
                onClick={() => setShowAuthDialog(true)}
                className="px-3 py-1.5 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm transition-colors flex items-center gap-1.5 shadow-sm"
                whileHover={{ scale: 1.02, boxShadow: '0 4px 8px rgba(124, 58, 237, 0.2)' }}
                whileTap={{ scale: 0.98 }}
              >
                <span className="i-ph:github-logo w-4 h-4" />
                Connect GitHub Account
              </motion.button>
            </div>

            {/* Content */}
            <div className="p-5">
              {/* Tabs */}
              <div className="mb-6">
                <div className="bg-[#f0f0f0] dark:bg-[#1e1e1e] rounded-lg overflow-hidden border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor-dark">
                  <div className="flex">
                    <button
                      onClick={() => setActiveTab('my-repos')}
                      className={classNames(
                        'flex-1 py-3 px-4 text-center text-sm font-medium transition-colors',
                        activeTab === 'my-repos'
                          ? 'bg-[#e6e6e6] dark:bg-[#2a2a2a] text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary-dark'
                          : 'bg-[#f0f0f0] dark:bg-[#1e1e1e] text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary-dark hover:bg-[#e6e6e6] dark:hover:bg-[#2a2a2a]/50',
                      )}
                    >
                      My Repos
                    </button>
                    <button
                      onClick={() => setActiveTab('search')}
                      className={classNames(
                        'flex-1 py-3 px-4 text-center text-sm font-medium transition-colors',
                        activeTab === 'search'
                          ? 'bg-[#e6e6e6] dark:bg-[#2a2a2a] text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary-dark'
                          : 'bg-[#f0f0f0] dark:bg-[#1e1e1e] text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary-dark hover:bg-[#e6e6e6] dark:hover:bg-[#2a2a2a]/50',
                      )}
                    >
                      Search
                    </button>
                    <button
                      onClick={() => setActiveTab('url')}
                      className={classNames(
                        'flex-1 py-3 px-4 text-center text-sm font-medium transition-colors',
                        activeTab === 'url'
                          ? 'bg-[#e6e6e6] dark:bg-[#2a2a2a] text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary-dark'
                          : 'bg-[#f0f0f0] dark:bg-[#1e1e1e] text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary-dark hover:bg-[#e6e6e6] dark:hover:bg-[#2a2a2a]/50',
                      )}
                    >
                      From URL
                    </button>
                  </div>
                </div>
              </div>

              {activeTab === 'url' ? (
                <div className="space-y-5">
                  <div className="bg-gradient-to-br from-bolt-elements-background-depth-1 to-bolt-elements-background-depth-1 dark:from-bolt-elements-background-depth-2-dark dark:to-bolt-elements-background-depth-2-dark p-5 rounded-xl border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor-dark">
                    <h3 className="text-base font-medium text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary-dark mb-3 flex items-center gap-2">
                      <span className="i-ph:link-simple w-4 h-4 text-purple-500" />
                      Repository URL
                    </h3>

                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-500">
                        <span className="i-ph:github-logo w-5 h-5" />
                      </div>
                      <Input
                        type="text"
                        placeholder="Enter GitHub repository URL (e.g., https://github.com/user/repo)"
                        value={customUrl}
                        onChange={(e) => setCustomUrl(e.target.value)}
                        className="w-full pl-10 py-3 border-bolt-elements-borderColor dark:border-bolt-elements-borderColor-dark focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>

                    <div className="mt-3 text-xs text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary-dark bg-white/50 dark:bg-bolt-elements-background-depth-4/50 p-3 rounded-lg border border-bolt-elements-borderColor/30 dark:border-bolt-elements-borderColor-dark/30 backdrop-blur-sm">
                      <p className="flex items-start gap-2">
                        <span className="i-ph:info w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-blue-500" />
                        <span>
                          You can paste any GitHub repository URL, including specific branches or tags.
                          <br />
                          <span className="text-bolt-elements-textTertiary dark:text-bolt-elements-textTertiary-dark">
                            Example: https://github.com/username/repository/tree/branch-name
                          </span>
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-sm text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary-dark">
                    <div className="h-px flex-grow bg-bolt-elements-borderColor dark:bg-bolt-elements-borderColor-dark"></div>
                    <span>Ready to import?</span>
                    <div className="h-px flex-grow bg-bolt-elements-borderColor dark:bg-bolt-elements-borderColor-dark"></div>
                  </div>

                  <motion.button
                    onClick={handleImport}
                    disabled={!customUrl}
                    className={classNames(
                      'w-full h-12 px-4 py-2 rounded-xl text-white transition-all duration-200 flex items-center gap-2 justify-center',
                      customUrl
                        ? 'bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 shadow-md'
                        : 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed',
                    )}
                    whileHover={customUrl ? { scale: 1.02, boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)' } : {}}
                    whileTap={customUrl ? { scale: 0.98 } : {}}
                  >
                    <span className="i-ph:git-pull-request w-5 h-5" />
                    Import Repository
                  </motion.button>
                </div>
              ) : (
                <>
                  {activeTab === 'search' && (
                    <div className="space-y-5 mb-5">
                      <div className="bg-gradient-to-br from-blue-500/5 to-cyan-500/5 p-5 rounded-xl border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor-dark">
                        <h3 className="text-base font-medium text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary-dark mb-3 flex items-center gap-2">
                          <span className="i-ph:magnifying-glass w-4 h-4 text-blue-500" />
                          Search GitHub
                        </h3>

                        <div className="flex gap-2">
                          <div className="flex-1">
                            <SearchInput
                              placeholder="Search GitHub repositories..."
                              value={searchQuery}
                              onChange={(e) => {
                                setSearchQuery(e.target.value);

                                if (e.target.value.length > 2) {
                                  handleSearch(e.target.value);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && searchQuery.length > 2) {
                                  handleSearch(searchQuery);
                                }
                              }}
                              onClear={() => {
                                setSearchQuery('');
                                setSearchResults([]);
                              }}
                              iconClassName="text-blue-500"
                              className="py-3 bg-white dark:bg-bolt-elements-background-depth-4 border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor-dark text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary-dark focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                              loading={isLoading}
                            />
                          </div>
                          <motion.button
                            onClick={() => setFilters({})}
                            className="px-3 py-2 rounded-lg bg-white dark:bg-bolt-elements-background-depth-4 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor-dark shadow-sm"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            title="Clear filters"
                          >
                            <span className="i-ph:funnel-simple w-4 h-4" />
                          </motion.button>
                        </div>

                        <div className="mt-3">
                          <div className="text-xs text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary-dark mb-2">
                            Filters
                          </div>

                          {/* Active filters */}
                          {(filters.language || filters.stars || filters.forks) && (
                            <div className="flex flex-wrap gap-2 mb-3">
                              <AnimatePresence>
                                {filters.language && (
                                  <FilterChip
                                    label="Language"
                                    value={filters.language}
                                    icon="i-ph:code"
                                    active
                                    onRemove={() => {
                                      const newFilters = { ...filters };
                                      delete newFilters.language;
                                      setFilters(newFilters);

                                      if (searchQuery.length > 2) {
                                        handleSearch(searchQuery);
                                      }
                                    }}
                                  />
                                )}
                                {filters.stars && (
                                  <FilterChip
                                    label="Stars"
                                    value={`>${filters.stars}`}
                                    icon="i-ph:star"
                                    active
                                    onRemove={() => {
                                      const newFilters = { ...filters };
                                      delete newFilters.stars;
                                      setFilters(newFilters);

                                      if (searchQuery.length > 2) {
                                        handleSearch(searchQuery);
                                      }
                                    }}
                                  />
                                )}
                                {filters.forks && (
                                  <FilterChip
                                    label="Forks"
                                    value={`>${filters.forks}`}
                                    icon="i-ph:git-fork"
                                    active
                                    onRemove={() => {
                                      const newFilters = { ...filters };
                                      delete newFilters.forks;
                                      setFilters(newFilters);

                                      if (searchQuery.length > 2) {
                                        handleSearch(searchQuery);
                                      }
                                    }}
                                  />
                                )}
                              </AnimatePresence>
                            </div>
                          )}

                          <div className="grid grid-cols-3 gap-2">
                            <div className="relative col-span-3 md:col-span-1">
                              <div className="absolute left-2 top-1/2 -translate-y-1/2 text-bolt-elements-textTertiary dark:text-bolt-elements-textTertiary-dark">
                                <span className="i-ph:code w-3.5 h-3.5" />
                              </div>
                              <input
                                type="text"
                                placeholder="Language (e.g., javascript)"
                                value={filters.language || ''}
                                onChange={(e) => {
                                  setFilters({ ...filters, language: e.target.value });

                                  if (searchQuery.length > 2) {
                                    handleSearch(searchQuery);
                                  }
                                }}
                                className="w-full pl-8 px-3 py-2 text-sm rounded-lg bg-white dark:bg-bolt-elements-background-depth-4 border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor-dark focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div className="relative">
                              <div className="absolute left-2 top-1/2 -translate-y-1/2 text-bolt-elements-textTertiary dark:text-bolt-elements-textTertiary-dark">
                                <span className="i-ph:star w-3.5 h-3.5" />
                              </div>
                              <input
                                type="number"
                                placeholder="Min stars"
                                value={filters.stars || ''}
                                onChange={(e) => handleFilterChange('stars', e.target.value)}
                                className="w-full pl-8 px-3 py-2 text-sm rounded-lg bg-white dark:bg-bolt-elements-background-depth-4 border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor-dark focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div className="relative">
                              <div className="absolute left-2 top-1/2 -translate-y-1/2 text-bolt-elements-textTertiary dark:text-bolt-elements-textTertiary-dark">
                                <span className="i-ph:git-fork w-3.5 h-3.5" />
                              </div>
                              <input
                                type="number"
                                placeholder="Min forks"
                                value={filters.forks || ''}
                                onChange={(e) => handleFilterChange('forks', e.target.value)}
                                className="w-full pl-8 px-3 py-2 text-sm rounded-lg bg-white dark:bg-bolt-elements-background-depth-4 border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor-dark focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 text-xs text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary-dark bg-white/50 dark:bg-bolt-elements-background-depth-4/50 p-3 rounded-lg border border-bolt-elements-borderColor/30 dark:border-bolt-elements-borderColor-dark/30 backdrop-blur-sm">
                          <p className="flex items-start gap-2">
                            <span className="i-ph:info w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-blue-500" />
                            <span>
                              Search for repositories by name, description, or topics. Use filters to narrow down
                              results.
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {selectedRepository ? (
                      <div className="space-y-5 bg-gradient-to-br from-purple-500/5 to-blue-500/5 p-5 rounded-xl border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor-dark">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <motion.button
                              onClick={() => setSelectedRepository(null)}
                              className="p-2 rounded-lg hover:bg-white dark:hover:bg-bolt-elements-background-depth-4 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary shadow-sm"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                            >
                              <span className="i-ph:arrow-left w-4 h-4" />
                            </motion.button>
                            <div>
                              <h3 className="font-medium text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary-dark text-lg">
                                {selectedRepository.name}
                              </h3>
                              <p className="text-xs text-bolt-elements-textTertiary dark:text-bolt-elements-textTertiary-dark flex items-center gap-1">
                                <span className="i-ph:user w-3 h-3" />
                                {selectedRepository.full_name.split('/')[0]}
                              </p>
                            </div>
                          </div>

                          {selectedRepository.private && (
                            <Badge variant="primary" size="md" icon="i-ph:lock w-3 h-3">
                              Private
                            </Badge>
                          )}
                        </div>

                        {selectedRepository.description && (
                          <div className="bg-white/50 dark:bg-bolt-elements-background-depth-4/50 p-3 rounded-lg border border-bolt-elements-borderColor/30 dark:border-bolt-elements-borderColor-dark/30 backdrop-blur-sm">
                            <p className="text-sm text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary-dark">
                              {selectedRepository.description}
                            </p>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2">
                          {selectedRepository.language && (
                            <Badge variant="subtle" size="md" icon="i-ph:code w-3 h-3">
                              {selectedRepository.language}
                            </Badge>
                          )}
                          <Badge variant="subtle" size="md" icon="i-ph:star w-3 h-3">
                            {selectedRepository.stargazers_count.toLocaleString()}
                          </Badge>
                          {selectedRepository.forks_count > 0 && (
                            <Badge variant="subtle" size="md" icon="i-ph:git-fork w-3 h-3">
                              {selectedRepository.forks_count.toLocaleString()}
                            </Badge>
                          )}
                        </div>

                        <div className="pt-3 border-t border-bolt-elements-borderColor/30 dark:border-bolt-elements-borderColor-dark/30">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="i-ph:git-branch w-4 h-4 text-purple-500" />
                            <label className="text-sm font-medium text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary-dark">
                              Select Branch
                            </label>
                          </div>
                          <select
                            value={selectedBranch}
                            onChange={(e) => setSelectedBranch(e.target.value)}
                            className="w-full px-3 py-3 rounded-lg bg-white dark:bg-bolt-elements-background-depth-4 border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor-dark text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary-dark focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-sm"
                          >
                            {branches.map((branch) => (
                              <option
                                key={branch.name}
                                value={branch.name}
                                className="bg-white dark:bg-bolt-elements-background-depth-4 text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary-dark"
                              >
                                {branch.name} {branch.default ? '(default)' : ''}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center gap-3 text-sm text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary-dark">
                          <div className="h-px flex-grow bg-bolt-elements-borderColor/30 dark:bg-bolt-elements-borderColor-dark/30"></div>
                          <span>Ready to import?</span>
                          <div className="h-px flex-grow bg-bolt-elements-borderColor/30 dark:bg-bolt-elements-borderColor-dark/30"></div>
                        </div>

                        <motion.button
                          onClick={handleImport}
                          className="w-full h-12 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white transition-all duration-200 flex items-center gap-2 justify-center shadow-md"
                          whileHover={{ scale: 1.02, boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)' }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <span className="i-ph:git-pull-request w-5 h-5" />
                          Import {selectedRepository.name}
                        </motion.button>
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
    </RepositoryDialogContext.Provider>
  );
}
