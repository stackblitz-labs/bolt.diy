import { useState, useEffect, useMemo } from 'react';
import { database } from '~/lib/persistence/apps';
import { AppUpdateReasonKind, type AppSummary, type AppUpdateReason } from '~/lib/persistence/messageAppSummary';
import { getRepositoryURL } from '~/lib/replay/DevelopmentServer';
import { CheckCircle, ChevronDown, ChevronLeft, ChevronRight, MoreHorizontal, Search } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';

export function includeHistorySummary(summary: AppSummary): boolean {
  if (!summary.reason) {
    return false;
  }

  switch (summary.reason.kind) {
    case AppUpdateReasonKind.FeatureImplemented:
    case AppUpdateReasonKind.BuildInitialApp:
    case AppUpdateReasonKind.RevertApp:
    case AppUpdateReasonKind.CopyApp:
    case AppUpdateReasonKind.ManualUpdate:
      return true;
    default:
      return false;
  }
}

interface AppHistoryProps {
  appId: string;
}

const ITEMS_PER_PAGE = 8;

const AppHistory = ({ appId }: AppHistoryProps) => {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<AppSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchHistory();
  }, [appId]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const history = await database.getAppHistory(appId);
      setHistory(history.filter(includeHistorySummary).reverse());
    } catch (err) {
      console.error('Failed to fetch app history:', err);
    } finally {
      setLoading(false);
    }
  };

  const getFormattedDateTime = (timeString: string) => {
    try {
      const date = new Date(timeString);
      const dateStr = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const timeStr = date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      return `${dateStr} (${timeStr}...`;
    } catch (_) {
      return timeString;
    }
  };

  const getReasonText = (reason: AppUpdateReason | undefined, allHistory: AppSummary[]) => {
    if (!reason) {
      return 'Unknown';
    }
    switch (reason.kind) {
      case AppUpdateReasonKind.FeatureImplemented:
        return reason.featureName || 'Feature implemented';
      case AppUpdateReasonKind.BuildInitialApp:
        return 'Initial build';
      case AppUpdateReasonKind.RevertApp: {
        const targetSummary = allHistory.find((summary) => summary.iteration === reason.iteration);
        return targetSummary ? `Reverted to v${targetSummary.version}` : 'Reverted';
      }
      case AppUpdateReasonKind.CopyApp:
        return 'Copied from another app';
      case AppUpdateReasonKind.ManualUpdate:
        return 'Manual update';
      default:
        return 'Unknown';
    }
  };

  const handleOpenPreview = (summary: AppSummary) => {
    window.open(getRepositoryURL(summary.repositoryId), '_blank');
  };

  const handleRevertToVersion = async (summary: AppSummary) => {
    await database.revertApp(appId, summary.iteration);
    fetchHistory();
  };

  // Filter and search logic
  const filteredHistory = useMemo(() => {
    let filtered = history;

    // Apply filter
    if (filterType !== 'all') {
      filtered = filtered.filter((summary) => {
        if (!summary.reason) {
          return false;
        }
        switch (filterType) {
          case 'feature':
            return summary.reason.kind === AppUpdateReasonKind.FeatureImplemented;
          case 'revert':
            return summary.reason.kind === AppUpdateReasonKind.RevertApp;
          case 'initial':
            return summary.reason.kind === AppUpdateReasonKind.BuildInitialApp;
          default:
            return true;
        }
      });
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((summary) => {
        const version = summary.version?.toLowerCase() || '';
        const reasonText = getReasonText(summary.reason, history).toLowerCase();
        return version.includes(query) || reasonText.includes(query);
      });
    }

    return filtered;
  }, [history, filterType, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredHistory.length / ITEMS_PER_PAGE);
  const paginatedHistory = filteredHistory.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const currentVersion = history.length > 0 ? history[0] : null;

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterType]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-bolt-elements-borderColor border-t-bolt-elements-textPrimary"></div>
          <div className="text-bolt-elements-textSecondary text-sm">Loading history...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Current Version Section */}
        {currentVersion && (
          <div className="p-4 border border-bolt-elements-borderColor rounded-md bg-background">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle size={18} className="text-bolt-elements-textSecondary" />
              <span className="text-xs font-medium border border-bolt-elements-borderColor rounded px-2 py-0.5 text-bolt-elements-textSecondary">
                Current Version
              </span>
              <span className="text-sm font-medium text-bolt-elements-textPrimary">
                {currentVersion.version || '0.0.0'}
              </span>
            </div>
            <p className="text-sm text-bolt-elements-textSecondary pl-6">
              {getReasonText(currentVersion.reason, history)}
            </p>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-bolt-elements-textSecondary" />
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-9 pr-3 text-sm border border-bolt-elements-borderColor rounded-md bg-background text-bolt-elements-textPrimary placeholder:text-bolt-elements-textSecondary focus:outline-none focus:ring-1 focus:ring-bolt-elements-borderColor"
          />
        </div>

        {/* Filter Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger className="w-full h-10 px-3 text-sm border border-bolt-elements-borderColor rounded-md bg-background text-bolt-elements-textPrimary flex items-center justify-between">
            <span>
              {filterType === 'all' && 'All versions'}
              {filterType === 'feature' && 'Features only'}
              {filterType === 'revert' && 'Reverts only'}
              {filterType === 'initial' && 'Initial builds only'}
            </span>
            <ChevronDown size={16} className="text-bolt-elements-textSecondary" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
            <DropdownMenuItem onClick={() => setFilterType('all')}>All versions</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilterType('feature')}>Features only</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilterType('revert')}>Reverts only</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilterType('initial')}>Initial builds only</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Version Table */}
        {filteredHistory.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-bolt-elements-textSecondary text-sm">No versions found</p>
          </div>
        ) : (
          <div className="border border-bolt-elements-borderColor rounded-md overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-[1fr_1.5fr_auto] gap-4 px-4 py-3 bg-bolt-elements-background-depth-2 border-b border-bolt-elements-borderColor">
              <span className="text-sm font-medium text-bolt-elements-textSecondary">Version</span>
              <span className="text-sm font-medium text-bolt-elements-textSecondary">Date</span>
              <span className="w-8"></span>
            </div>

            {/* Table Rows */}
            {paginatedHistory.map((summary, index) => {
              const isCurrentVersion = currentVersion && summary.iteration === currentVersion.iteration;
              return (
                <div
                  key={summary.iteration || index}
                  className="grid grid-cols-[1fr_1.5fr_auto] gap-4 px-4 py-3 border-b border-bolt-elements-borderColor last:border-b-0 hover:bg-bolt-elements-background-depth-2 transition-colors"
                >
                  <span className="text-sm font-medium text-bolt-elements-textPrimary">
                    {summary.version || '0.0.0'}
                  </span>
                  <span className="text-sm text-bolt-elements-textSecondary truncate">
                    {getFormattedDateTime(summary.time)}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-bolt-elements-background-depth-3 transition-colors">
                      <MoreHorizontal size={16} className="text-bolt-elements-textSecondary" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleOpenPreview(summary)}>Open preview</DropdownMenuItem>
                      {!isCurrentVersion && (
                        <DropdownMenuItem onClick={() => handleRevertToVersion(summary)}>
                          Revert to this version
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      {filteredHistory.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-bolt-elements-borderColor">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="w-10 h-10 flex items-center justify-center rounded-full border border-bolt-elements-borderColor text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm text-bolt-elements-textSecondary">
            <span className="font-medium text-bolt-elements-textPrimary">
              {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredHistory.length)}
            </span>{' '}
            of {filteredHistory.length}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="w-10 h-10 flex items-center justify-center rounded-full border border-bolt-elements-borderColor text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
};

export default AppHistory;
