import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Button } from '~/components/ui/Button';
import { classNames } from '~/utils/classNames';
import { Database, Trash2, RefreshCw, Clock, HardDrive, CheckCircle } from 'lucide-react';

interface CacheEntry {
  key: string;
  size: number;
  timestamp: number;
  lastAccessed: number;
  data: any;
}

interface CacheStats {
  totalSize: number;
  totalEntries: number;
  oldestEntry: number;
  newestEntry: number;
  hitRate?: number;
}

interface GitHubCacheManagerProps {
  className?: string;
  showStats?: boolean;
}

// Cache management utilities
class CacheManagerService {
  private static readonly _cachePrefix = 'github_';
  private static readonly _cacheKeys = [
    'github_connection',
    'github_stats_cache',
    'github_repositories_cache',
    'github_user_cache',
    'github_rate_limits',
  ];

  static getCacheEntries(): CacheEntry[] {
    const entries: CacheEntry[] = [];

    for (const key of this._cacheKeys) {
      try {
        const data = localStorage.getItem(key);

        if (data) {
          const parsed = JSON.parse(data);
          entries.push({
            key,
            size: new Blob([data]).size,
            timestamp: parsed.timestamp || Date.now(),
            lastAccessed: parsed.lastAccessed || Date.now(),
            data: parsed,
          });
        }
      } catch (error) {
        console.warn(`Failed to parse cache entry: ${key}`, error);
      }
    }

    return entries.sort((a, b) => b.lastAccessed - a.lastAccessed);
  }

  static getCacheStats(): CacheStats {
    const entries = this.getCacheEntries();

    if (entries.length === 0) {
      return {
        totalSize: 0,
        totalEntries: 0,
        oldestEntry: 0,
        newestEntry: 0,
      };
    }

    const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
    const timestamps = entries.map((e) => e.timestamp);

    return {
      totalSize,
      totalEntries: entries.length,
      oldestEntry: Math.min(...timestamps),
      newestEntry: Math.max(...timestamps),
    };
  }

  static clearCache(keys?: string[]): void {
    const keysToRemove = keys || this._cacheKeys;

    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  }

  static clearExpiredCache(maxAge: number = 24 * 60 * 60 * 1000): number {
    const entries = this.getCacheEntries();
    const now = Date.now();
    let removedCount = 0;

    for (const entry of entries) {
      if (now - entry.timestamp > maxAge) {
        localStorage.removeItem(entry.key);
        removedCount++;
      }
    }

    return removedCount;
  }

  static compactCache(): void {
    const entries = this.getCacheEntries();

    for (const entry of entries) {
      try {
        // Re-serialize with minimal data
        const compacted = {
          ...entry.data,
          lastAccessed: Date.now(),
        };
        localStorage.setItem(entry.key, JSON.stringify(compacted));
      } catch (error) {
        console.warn(`Failed to compact cache entry: ${entry.key}`, error);
      }
    }
  }

  static formatSize(bytes: number): string {
    if (bytes === 0) {
      return '0 B';
    }

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}

export function GitHubCacheManager({ className = '', showStats = true }: GitHubCacheManagerProps) {
  const [cacheEntries, setCacheEntries] = useState<CacheEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastClearTime, setLastClearTime] = useState<number | null>(null);

  const refreshCacheData = useCallback(() => {
    setCacheEntries(CacheManagerService.getCacheEntries());
  }, []);

  useEffect(() => {
    refreshCacheData();
  }, [refreshCacheData]);

  const cacheStats = useMemo(() => CacheManagerService.getCacheStats(), [cacheEntries]);

  const handleClearAll = useCallback(async () => {
    setIsLoading(true);

    try {
      CacheManagerService.clearCache();
      setLastClearTime(Date.now());
      refreshCacheData();

      // Trigger a page refresh to update all components
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Failed to clear cache:', error);
    } finally {
      setIsLoading(false);
    }
  }, [refreshCacheData]);

  const handleClearExpired = useCallback(() => {
    setIsLoading(true);

    try {
      const removedCount = CacheManagerService.clearExpiredCache();
      refreshCacheData();

      if (removedCount > 0) {
        // Show success message or trigger update
        console.log(`Removed ${removedCount} expired cache entries`);
      }
    } catch (error) {
      console.error('Failed to clear expired cache:', error);
    } finally {
      setIsLoading(false);
    }
  }, [refreshCacheData]);

  const handleCompactCache = useCallback(() => {
    setIsLoading(true);

    try {
      CacheManagerService.compactCache();
      refreshCacheData();
    } catch (error) {
      console.error('Failed to compact cache:', error);
    } finally {
      setIsLoading(false);
    }
  }, [refreshCacheData]);

  const handleClearSpecific = useCallback(
    (key: string) => {
      setIsLoading(true);

      try {
        CacheManagerService.clearCache([key]);
        refreshCacheData();
      } catch (error) {
        console.error(`Failed to clear cache key: ${key}`, error);
      } finally {
        setIsLoading(false);
      }
    },
    [refreshCacheData],
  );

  if (!showStats && cacheEntries.length === 0) {
    return null;
  }

  return (
    <div
      className={classNames(
        'space-y-4 p-4 bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-lg',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-bolt-elements-item-contentAccent" />
          <h3 className="text-sm font-medium text-bolt-elements-textPrimary">GitHub Cache Management</h3>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refreshCacheData} disabled={isLoading}>
            <RefreshCw className={classNames('w-3 h-3', isLoading ? 'animate-spin' : '')} />
          </Button>
        </div>
      </div>

      {showStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-bolt-elements-background-depth-2 p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <HardDrive className="w-3 h-3 text-bolt-elements-textSecondary" />
              <span className="text-xs font-medium text-bolt-elements-textSecondary">Total Size</span>
            </div>
            <p className="text-sm font-semibold text-bolt-elements-textPrimary">
              {CacheManagerService.formatSize(cacheStats.totalSize)}
            </p>
          </div>

          <div className="bg-bolt-elements-background-depth-2 p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Database className="w-3 h-3 text-bolt-elements-textSecondary" />
              <span className="text-xs font-medium text-bolt-elements-textSecondary">Entries</span>
            </div>
            <p className="text-sm font-semibold text-bolt-elements-textPrimary">{cacheStats.totalEntries}</p>
          </div>

          <div className="bg-bolt-elements-background-depth-2 p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-3 h-3 text-bolt-elements-textSecondary" />
              <span className="text-xs font-medium text-bolt-elements-textSecondary">Oldest</span>
            </div>
            <p className="text-xs text-bolt-elements-textSecondary">
              {cacheStats.oldestEntry ? new Date(cacheStats.oldestEntry).toLocaleDateString() : 'N/A'}
            </p>
          </div>

          <div className="bg-bolt-elements-background-depth-2 p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="w-3 h-3 text-bolt-elements-textSecondary" />
              <span className="text-xs font-medium text-bolt-elements-textSecondary">Status</span>
            </div>
            <p className="text-xs text-green-600 dark:text-green-400">
              {cacheStats.totalEntries > 0 ? 'Active' : 'Empty'}
            </p>
          </div>
        </div>
      )}

      {cacheEntries.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-bolt-elements-textSecondary">
            Cache Entries ({cacheEntries.length})
          </h4>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {cacheEntries.map((entry) => (
              <div
                key={entry.key}
                className="flex items-center justify-between p-2 bg-bolt-elements-background-depth-2 rounded border border-bolt-elements-borderColor"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-bolt-elements-textPrimary truncate">
                    {entry.key.replace('github_', '')}
                  </p>
                  <p className="text-xs text-bolt-elements-textSecondary">
                    {CacheManagerService.formatSize(entry.size)} • {new Date(entry.lastAccessed).toLocaleString()}
                  </p>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleClearSpecific(entry.key)}
                  disabled={isLoading}
                  className="ml-2"
                >
                  <Trash2 className="w-3 h-3 text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-2 border-t border-bolt-elements-borderColor">
        <Button
          variant="outline"
          size="sm"
          onClick={handleClearExpired}
          disabled={isLoading}
          className="flex items-center gap-1"
        >
          <Clock className="w-3 h-3" />
          <span className="text-xs">Clear Expired</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleCompactCache}
          disabled={isLoading}
          className="flex items-center gap-1"
        >
          <RefreshCw className="w-3 h-3" />
          <span className="text-xs">Compact</span>
        </Button>

        {cacheEntries.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearAll}
            disabled={isLoading}
            className="flex items-center gap-1 text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
          >
            <Trash2 className="w-3 h-3" />
            <span className="text-xs">Clear All</span>
          </Button>
        )}
      </div>

      {lastClearTime && (
        <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded text-xs text-green-700 dark:text-green-400">
          <CheckCircle className="w-3 h-3" />
          <span>Cache cleared successfully at {new Date(lastClearTime).toLocaleTimeString()}</span>
        </div>
      )}
    </div>
  );
}
