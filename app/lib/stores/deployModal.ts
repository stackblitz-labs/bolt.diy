import { atom } from 'nanostores';
import type { DeploySettings } from '~/lib/replay/Deploy';
import { DeployStatus } from '~/components/header/DeployChat/DeployChatButton';

export class DeployModalStore {
  isOpen = atom<boolean>(false);
  status = atom<DeployStatus>(DeployStatus.NotStarted as DeployStatus);
  deploySettings = atom<DeploySettings>({});
  error = atom<string | undefined>(undefined);
  databaseFound = atom<boolean>(false);
  loadingData = atom<boolean>(false);

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

  reset() {
    this.isOpen.set(false);
    this.status.set(DeployStatus.NotStarted);
    this.deploySettings.set({});
    this.error.set(undefined);
    this.databaseFound.set(false);
    this.loadingData.set(false);
  }
}

export const deployModalStore = new DeployModalStore();
