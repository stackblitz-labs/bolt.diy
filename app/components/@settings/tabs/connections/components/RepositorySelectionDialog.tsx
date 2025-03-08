import type { GitHubRepoInfo, GitHubContent, RepositoryStats } from '~/types/GitHub';
import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import * as Dialog from '@radix-ui/react-dialog';
import { classNames } from '~/utils/classNames';
import { getLocalStorage } from '~/lib/persistence';
import { motion } from 'framer-motion';
import { formatSize } from '~/utils/formatSize';
import { Input } from '~/components/ui/Input';

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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [stats, setStats] = useState<RepositoryStats | null>(null);
  const [showStatsDialog, setShowStatsDialog] = useState(false);
  const [currentStats, setCurrentStats] = useState<RepositoryStats | null>(null);
  const [pendingGitUrl, setPendingGitUrl] = useState<string>('');

  // Fetch user's repositories when dialog opens
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
      const response = await fetch(`https://api.github.com/repos/${repo.full_name}/branches`, {
        headers: {
          Authorization: `Bearer ${getLocalStorage('github_connection')?.token}`,
        },
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
      const [owner, repo] = repoUrl
        .replace(/\.git$/, '')
        .split('/')
        .slice(-2);

      const connection = getLocalStorage('github_connection');
      const headers: HeadersInit = connection?.token ? { Authorization: `Bearer ${connection.token}` } : {};
      const repoObjResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers,
      });
      const repoObjData = (await repoObjResponse.json()) as any;

      if (!repoObjData.default_branch) {
        throw new Error('Failed to fetch repository branch');
      }

      const defaultBranch = repoObjData.default_branch;

      // Fetch repository tree
      const treeResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`,
        {
          headers,
        },
      );

      if (!treeResponse.ok) {
        throw new Error('Failed to fetch repository structure');
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

      setStats(stats);

      return stats;
    } catch (error) {
      console.error('Error verifying repository:', error);
      toast.error('Failed to verify repository');

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
      toast.error('Failed to prepare repository. Please try again.');
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
                  placeholder="Enter repository URL"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  className={classNames('w-full', {
                    'border-red-500': false,
                  })}
                />
                <button
                  onClick={handleImport}
                  disabled={!customUrl}
                  className="w-full h-10 px-4 py-2 rounded-lg bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2 justify-center"
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
      {currentStats && (
        <StatsDialog
          isOpen={showStatsDialog}
          onClose={handleStatsConfirm}
          onConfirm={handleStatsConfirm}
          stats={currentStats}
          isLargeRepo={currentStats.totalSize > 50 * 1024 * 1024}
        />
      )}
    </Dialog.Root>
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
    <div className="p-4 rounded-lg bg-[#F5F5F5] dark:bg-[#252525] border border-[#E5E5E5] dark:border-[#333333] hover:border-purple-500/50 transition-colors">
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
