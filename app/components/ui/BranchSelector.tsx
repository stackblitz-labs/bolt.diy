import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './Button';
import { classNames } from '~/utils/classNames';
import { GitBranch, Check, Shield, Star, RefreshCw, X } from 'lucide-react';

interface BranchInfo {
  name: string;
  sha: string;
  protected: boolean;
  isDefault: boolean;
  canPush?: boolean; // GitLab specific
}

interface BranchSelectorProps {
  provider: 'github' | 'gitlab';
  repoOwner: string;
  repoName: string;
  projectId?: string | number; // GitLab specific
  token: string;
  gitlabUrl?: string;
  defaultBranch?: string;
  onBranchSelect: (branch: string) => void;
  onClose: () => void;
  isOpen: boolean;
  className?: string;
}

export function BranchSelector({
  provider,
  repoOwner,
  repoName,
  projectId,
  token,
  gitlabUrl,
  defaultBranch,
  onBranchSelect,
  onClose,
  isOpen,
  className,
}: BranchSelectorProps) {
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<string>('');

  const filteredBranches = branches.filter((branch) => branch.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const fetchBranches = async () => {
    setIsLoading(true);
    setError(null);

    try {
      let response: Response;

      if (provider === 'github') {
        response = await fetch('/api/github-branches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            owner: repoOwner,
            repo: repoName,
            token,
          }),
        });
      } else {
        // GitLab
        if (!projectId) {
          throw new Error('Project ID is required for GitLab repositories');
        }

        response = await fetch('/api/gitlab-branches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            gitlabUrl: gitlabUrl || 'https://gitlab.com',
            projectId,
          }),
        });
      }

      if (!response.ok) {
        const errorData: any = await response.json().catch(() => ({ error: 'Failed to fetch branches' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data: any = await response.json();
      setBranches(data.branches || []);

      // Set default selected branch
      const defaultBranchToSelect = data.defaultBranch || defaultBranch || 'main';
      setSelectedBranch(defaultBranchToSelect);
    } catch (err) {
      console.error('Failed to fetch branches:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch branches');
      setBranches([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBranchSelect = (branchName: string) => {
    setSelectedBranch(branchName);
  };

  const handleConfirmSelection = () => {
    onBranchSelect(selectedBranch);
    onClose();
  };

  useEffect(() => {
    if (isOpen && !branches.length) {
      fetchBranches();
    }
  }, [isOpen, repoOwner, repoName, projectId]);

  // Reset search when closing
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className={classNames(
            'bg-white dark:bg-gray-950 rounded-xl shadow-xl border border-bolt-elements-borderColor max-w-md w-full max-h-[80vh] flex flex-col',
            className,
          )}
        >
          {/* Header */}
          <div className="p-6 border-b border-bolt-elements-borderColor flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <GitBranch className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-bolt-elements-textPrimary">Select Branch</h3>
                <p className="text-sm text-bolt-elements-textSecondary">
                  {repoOwner}/{repoName}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-bolt-elements-background-depth-1 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center p-8 space-y-4">
                <div className="animate-spin w-8 h-8 border-2 border-bolt-elements-borderColorActive border-t-transparent rounded-full" />
                <p className="text-sm text-bolt-elements-textSecondary">Loading branches...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center p-8 space-y-4">
                <div className="text-red-500 mb-2">
                  <GitBranch className="w-8 h-8 mx-auto" />
                </div>
                <p className="text-sm text-red-600 text-center">{error}</p>
                <Button onClick={fetchBranches} variant="outline" size="sm">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retry
                </Button>
              </div>
            ) : (
              <>
                {/* Search */}
                {branches.length > 10 && (
                  <div className="p-4 border-b border-bolt-elements-borderColor">
                    <input
                      type="text"
                      placeholder="Search branches..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary focus:outline-none focus:ring-1 focus:ring-bolt-elements-borderColorActive"
                    />
                  </div>
                )}

                {/* Branch List */}
                <div className="flex-1 overflow-y-auto">
                  {filteredBranches.length > 0 ? (
                    <div className="p-4 space-y-1">
                      {filteredBranches.map((branch) => (
                        <button
                          key={branch.name}
                          onClick={() => handleBranchSelect(branch.name)}
                          className={classNames(
                            'w-full text-left p-3 rounded-lg transition-all duration-200 border',
                            selectedBranch === branch.name
                              ? 'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-100'
                              : 'bg-bolt-elements-background-depth-1 border-transparent hover:bg-bolt-elements-background-depth-2',
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <GitBranch className="w-4 h-4 flex-shrink-0 text-bolt-elements-textSecondary" />
                              <span className="font-medium text-bolt-elements-textPrimary truncate">{branch.name}</span>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {branch.isDefault && <Star className="w-3 h-3 text-yellow-500" />}
                                {branch.protected && <Shield className="w-3 h-3 text-red-500" />}
                              </div>
                            </div>
                            {selectedBranch === branch.name && <Check className="w-4 h-4 text-blue-600" />}
                          </div>
                          <div className="text-xs text-bolt-elements-textSecondary mt-1 truncate">
                            {branch.sha.substring(0, 8)}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center p-8">
                      <p className="text-sm text-bolt-elements-textSecondary">
                        {searchQuery ? 'No branches found matching your search.' : 'No branches available.'}
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          {!isLoading && !error && branches.length > 0 && (
            <div className="p-6 border-t border-bolt-elements-borderColor flex items-center justify-between">
              <div className="text-sm text-bolt-elements-textSecondary">
                {selectedBranch && (
                  <>
                    Selected: <span className="font-medium">{selectedBranch}</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Button onClick={onClose} variant="outline" size="sm">
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmSelection}
                  disabled={!selectedBranch}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Clone Branch
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
