import { atom } from 'nanostores';
import { database } from '~/lib/persistence/apps';
import type { AppSummary } from '~/lib/persistence/messageAppSummary';
import { includeHistorySummary } from '~/components/workbench/VesionHistory/AppHistory';

export class VersionHistoryStore {
  // Cached history data
  history = atom<AppSummary[]>([]);
  
  // Loading state
  isLoading = atom<boolean>(false);
  
  // Last fetch timestamp
  lastFetched = atom<Date | null>(null);
  
  // Polling interval ID
  private pollingInterval: NodeJS.Timeout | null = null;
  
  // Current app ID being tracked
  private currentAppId: string | null = null;

  /**
   * Fetch history for an app
   */
  async fetchHistory(appId: string): Promise<void> {
    if (!appId) {
      return;
    }

    try {
      this.isLoading.set(true);
      const history = await database.getAppHistory(appId);
      const filteredHistory = history.filter(includeHistorySummary);
      this.history.set(filteredHistory);
      this.lastFetched.set(new Date());
    } catch (err) {
      console.error('Failed to fetch app history:', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Start polling for history updates
   */
  startPolling(appId: string, intervalMs: number = 30000): void {
    // Stop existing polling if any
    this.stopPolling();
    
    this.currentAppId = appId;
    
    // Fetch immediately
    this.fetchHistory(appId);
    
    // Set up polling interval
    this.pollingInterval = setInterval(() => {
      if (this.currentAppId === appId) {
        this.fetchHistory(appId);
      }
    }, intervalMs);
  }

  /**
   * Stop polling for updates
   */
  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.currentAppId = null;
  }

  /**
   * Clear cached data
   */
  clear(): void {
    this.history.set([]);
    this.isLoading.set(false);
    this.lastFetched.set(null);
    this.stopPolling();
  }

  /**
   * Get the count of versions
   */
  getVersionCount(): number {
    return this.history.get().length;
  }
}

export const versionHistoryStore = new VersionHistoryStore();

