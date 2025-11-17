import { atom } from 'nanostores';
import type { DeploySettings } from '~/lib/replay/Deploy';
import { DeployStatus } from '~/components/header/DeployChat/DeployChatButton';
import { database } from '~/lib/persistence/apps';
import { downloadRepository } from '~/lib/replay/Deploy';

export class DeployModalStore {
  isOpen = atom<boolean>(false);
  status = atom<DeployStatus>(DeployStatus.NotStarted as DeployStatus);
  deploySettings = atom<DeploySettings>({});
  error = atom<string | undefined>(undefined);
  databaseFound = atom<boolean>(false);
  loadingData = atom<boolean>(false);
  
  // Track if data has been loaded at least once
  hasLoadedData = atom<boolean>(false);
  
  // Polling interval ID
  private pollingInterval: NodeJS.Timeout | null = null;
  
  // Current app ID and repository ID being tracked
  private currentAppId: string | null = null;
  private currentRepositoryId: string | null = null;

  constructor() {
    if (import.meta.hot) {
      import.meta.hot.data.isOpen = this.isOpen;
    }
  }

  open() {
    this.isOpen.set(true);
  }

  close() {
    this.isOpen.set(false);
  }

  setStatus(status: DeployStatus) {
    this.status.set(status);
  }

  setDeploySettings(settings: DeploySettings) {
    this.deploySettings.set(settings);
  }

  setError(error: string | undefined) {
    this.error.set(error);
  }

  setDatabaseFound(found: boolean) {
    this.databaseFound.set(found);
  }

  setLoadingData(loading: boolean) {
    this.loadingData.set(loading);
  }

  /**
   * Load deploy data for an app
   */
  async loadData(appId: string, repositoryId: string): Promise<void> {
    if (!appId || !repositoryId) {
      return;
    }

    // If we've already loaded data for this app, don't reload unless forced
    if (this.hasLoadedData.get() && this.currentAppId === appId && this.currentRepositoryId === repositoryId) {
      return;
    }

    this.setLoadingData(true);

    try {
      // Check for database
      try {
        const repositoryContents = await downloadRepository(repositoryId);
        const byteCharacters = atob(repositoryContents);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/zip' });
        const reader = new FileReader();

        reader.onload = (event) => {
          if (event.target?.result) {
            const zipContents = event.target.result as string;
            this.setDatabaseFound(zipContents.includes('supabase'));
          }
        };

        reader.readAsText(blob);
      } catch (error) {
        console.error('Error downloading repository:', error);
      }

      // Load existing settings
      const existingSettings = await database.getAppDeploySettings(appId);
      if (existingSettings) {
        this.setDeploySettings(existingSettings);
      }

      this.hasLoadedData.set(true);
      this.currentAppId = appId;
      this.currentRepositoryId = repositoryId;
    } catch (error) {
      console.error('Error loading deploy data:', error);
    } finally {
      this.setLoadingData(false);
    }
  }

  /**
   * Start polling for deploy data updates
   */
  startPolling(appId: string, repositoryId: string, intervalMs: number = 30000): void {
    // Stop existing polling if any
    this.stopPolling();
    
    this.currentAppId = appId;
    this.currentRepositoryId = repositoryId;
    
    // Load data immediately
    this.loadData(appId, repositoryId);
    
    // Set up polling interval
    this.pollingInterval = setInterval(() => {
      if (this.currentAppId === appId && this.currentRepositoryId === repositoryId) {
        // Only reload settings, not the repository check
        database.getAppDeploySettings(appId).then((settings) => {
          if (settings) {
            this.setDeploySettings(settings);
          }
        }).catch((error) => {
          console.error('Error polling deploy settings:', error);
        });
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
    this.currentRepositoryId = null;
  }

  reset() {
    this.isOpen.set(false);
    this.status.set(DeployStatus.NotStarted);
    this.deploySettings.set({});
    this.error.set(undefined);
    this.databaseFound.set(false);
    this.loadingData.set(false);
    this.hasLoadedData.set(false);
    this.stopPolling();
  }
}

export const deployModalStore = new DeployModalStore();
