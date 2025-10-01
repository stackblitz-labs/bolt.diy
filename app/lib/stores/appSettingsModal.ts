import { atom } from 'nanostores';

export interface AppSettings {
  // App name
  name?: string;

  // App icon (URL or data URL)
  icon?: string;

  // Authentication settings
  authenticationRequired?: boolean;
  domainWhitelist?: string[];

  // API integrations
  apiIntegrations?: {
    name: string;
    configured: boolean;
    credentialsSet: boolean;
  }[];
}

export class AppSettingsModalStore {
  isOpen = atom<boolean>(false);
  settings = atom<AppSettings>({});
  loadingData = atom<boolean>(false);
  error = atom<string | undefined>(undefined);

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

  setSettings(settings: AppSettings) {
    this.settings.set(settings);
  }

  updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    const currentSettings = this.settings.get();
    this.settings.set({
      ...currentSettings,
      [key]: value,
    });
  }

  setLoadingData(loading: boolean) {
    this.loadingData.set(loading);
  }

  setError(error: string | undefined) {
    this.error.set(error);
  }

  reset() {
    this.isOpen.set(false);
    this.settings.set({});
    this.loadingData.set(false);
    this.error.set(undefined);
  }
}

export const appSettingsModalStore = new AppSettingsModalStore();
