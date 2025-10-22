// All apps are stored in the database. Before logging in or creating an account
// we store the IDs of any apps created in local storage. The first time the user logs in,
// any local apps are associated with the user and then local storage is cleared.

import { getCurrentUserId } from '~/lib/supabase/client';
import type { DeploySettings } from '~/lib/replay/Deploy';
import { callNutAPI } from '~/lib/replay/NutAPI';
import type { AppSummary } from './messageAppSummary';
import { onChatResponse } from '~/lib/stores/chat';

// Basic information about an app for showing in the library.
export interface AppLibraryEntry {
  id: string;
  createdAt: string;
  updatedAt: string;
  title: string;
}

const localStorageKey = 'nut-apps';

function getLocalAppIds(): string[] {
  const appIdsJSON = localStorage.getItem(localStorageKey);
  if (!appIdsJSON) {
    return [];
  }
  return JSON.parse(appIdsJSON);
}

function setLocalAppIds(appIds: string[] | undefined): void {
  if (appIds?.length) {
    localStorage.setItem(localStorageKey, JSON.stringify(appIds));
  } else {
    localStorage.removeItem(localStorageKey);
  }
}

// Update the owner of all apps that were created locally before logging in.
export async function maybeSetLocalAppsOwner() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return;
  }

  const localAppIds = getLocalAppIds();
  if (localAppIds.length) {
    try {
      for (const appId of localAppIds) {
        await setAppOwner(appId);
      }
      setLocalAppIds(undefined);
    } catch (error) {
      console.error('Error syncing local apps', error);
    }
  }
}

// Apps we've deleted locally. We never return these from the database afterwards
// to present a coherent view of the apps in case the apps are queried before the
// delete finishes.
const deletedAppIds = new Set<string>();

async function getAllAppEntries(): Promise<AppLibraryEntry[]> {
  await maybeSetLocalAppsOwner();

  const userId = await getCurrentUserId();
  const localAppIds = getLocalAppIds();

  if (!userId) {
    return Promise.all(
      localAppIds.map(async (appId) => {
        const { entry } = await callNutAPI('get-app-entry', { appId });
        return entry;
      }),
    );
  }

  const { entries } = await callNutAPI('get-user-app-entries', {});

  return entries.filter((entry: AppLibraryEntry) => !deletedAppIds.has(entry.id));
}

async function setAppOwner(appId: string): Promise<void> {
  await callNutAPI('set-app-owner', { appId });
}

async function deleteApp(appId: string): Promise<void> {
  deletedAppIds.add(appId);

  const userId = await getCurrentUserId();

  if (!userId) {
    const localAppIds = getLocalAppIds().filter((id) => id != appId);
    setLocalAppIds(localAppIds);
  }

  await callNutAPI('delete-app', { appId });
}

async function createApp(): Promise<string> {
  const { appId } = await callNutAPI('create-app', {});

  const userId = await getCurrentUserId();
  if (!userId) {
    const localAppIds = getLocalAppIds();
    localAppIds.push(appId);
    setLocalAppIds(localAppIds);
  }
  return appId;
}

async function getAppTitle(appId: string): Promise<string> {
  const { entry } = await callNutAPI('get-app-entry', { appId });
  return entry.title;
}

async function updateAppTitle(appId: string, title: string): Promise<void> {
  if (!title.trim()) {
    throw new Error('Title cannot be empty');
  }

  await callNutAPI('set-app-title', { appId, title });
}

async function getAppDeploySettings(appId: string): Promise<DeploySettings | undefined> {
  console.log('DatabaseGetAppDeploySettingsStart', appId);

  const { deploySettings } = await callNutAPI('get-app-deploy-settings', { appId });
  return deploySettings;
}

async function setAppDeploySettings(appId: string, deploySettings: DeploySettings): Promise<void> {
  await callNutAPI('set-app-deploy-settings', { appId, deploySettings });
}

async function getAppHistory(appId: string): Promise<AppSummary[]> {
  const { history } = await callNutAPI('get-app-history', { appId });
  return history;
}

async function revertApp(appId: string, iteration: number): Promise<void> {
  const { response } = await callNutAPI('revert-app', { appId, iteration });
  if (response) {
    onChatResponse(response, 'RevertApp');
  }
}

async function copyApp(appId: string): Promise<string> {
  const { appId: newAppId } = await callNutAPI('copy-app', { appId });
  return newAppId;
}

export const database = {
  getAllAppEntries,
  deleteApp,
  createApp,
  getAppTitle,
  updateAppTitle,
  getAppDeploySettings,
  setAppDeploySettings,
  getAppHistory,
  revertApp,
  copyApp,
};
