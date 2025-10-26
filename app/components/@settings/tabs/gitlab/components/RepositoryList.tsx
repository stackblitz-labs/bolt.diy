import React, { useState, useMemo } from 'react';
import { Button } from '~/components/ui/Button';
import { RepositoryCard } from './RepositoryCard';
import type { GitLabProjectInfo } from '~/types/GitLab';

interface RepositoryListProps {
  repositories: GitLabProjectInfo[];
  onClone?: (repo: GitLabProjectInfo) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const MAX_REPOS_PER_PAGE = 20;

export function RepositoryList({ repositories, onClone, onRefresh, isRefreshing }: RepositoryListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isSearching, setIsSearching] = useState(false);

  const filteredRepositories = useMemo(() => {
    if (!searchQuery) {
      return repositories;
    }

    setIsSearching(true);

    const filtered = repositories.filter(
      (repo) =>
        repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        repo.path_with_namespace.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (repo.description && repo.description.toLowerCase().includes(searchQuery.toLowerCase())),
    );

    setIsSearching(false);

    return filtered;
  }, [repositories, searchQuery]);

  const totalPages = Math.ceil(filteredRepositories.length / MAX_REPOS_PER_PAGE);
  const startIndex = (currentPage - 1) * MAX_REPOS_PER_PAGE;
  const endIndex = startIndex + MAX_REPOS_PER_PAGE;
  const currentRepositories = filteredRepositories.slice(startIndex, endIndex);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1); // Reset to first page when searching
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-bolt-elements-textPrimary">
          Repositories ({filteredRepositories.length})
        </h4>
        {onRefresh && (
          <Button
            onClick={onRefresh}
            disabled={isRefreshing}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            {isRefreshing ? (
              <div className="i-ph:spinner animate-spin w-4 h-4" />
            ) : (
              <div className="i-ph:arrows-clockwise w-4 h-4" />
            )}
            Refresh
          </Button>
        )}
      </div>

      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search repositories..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full px-4 py-2 pl-10 rounded-lg bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary focus:outline-none focus:ring-1 focus:ring-bolt-elements-borderColorActive"
        />
        <div className="absolute left-3 top-1/2 -translate-y-1/2">
          {isSearching ? (
            <div className="i-ph:spinner animate-spin w-4 h-4 text-bolt-elements-textSecondary" />
          ) : (
            <div className="i-ph:magnifying-glass w-4 h-4 text-bolt-elements-textSecondary" />
          )}
        </div>
      </div>

      {/* Repository Grid */}
      <div className="space-y-4">
        {filteredRepositories.length === 0 ? (
          <div className="text-center py-8 text-bolt-elements-textSecondary">
            {searchQuery ? 'No repositories found matching your search.' : 'No repositories available.'}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentRepositories.map((repo) => (
                <RepositoryCard key={repo.id} repo={repo} onClone={onClone} />
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-bolt-elements-borderColor">
                <div className="text-sm text-bolt-elements-textSecondary">
                  Showing {Math.min(startIndex + 1, filteredRepositories.length)} to{' '}
                  {Math.min(endIndex, filteredRepositories.length)} of {filteredRepositories.length} repositories
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    variant="outline"
                    size="sm"
                  >
                    <div className="i-ph:caret-left w-4 h-4" />
                    Previous
                  </Button>
                  <span className="text-sm text-bolt-elements-textSecondary px-3">
                    {currentPage} of {totalPages}
                  </span>
                  <Button
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    variant="outline"
                    size="sm"
                  >
                    Next
                    <div className="i-ph:caret-right w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
