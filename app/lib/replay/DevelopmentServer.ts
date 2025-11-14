// Support managing state for the development server URL the preview is loading.

import { workbenchStore } from '~/lib/stores/workbench';
import { debounce } from '~/utils/debounce';
import { callNutAPI } from './NutAPI';
import { chatStore } from '~/lib/stores/chat';

export function getRepositoryURL(repositoryId: string | undefined) {
  if (!repositoryId) {
    return undefined;
  }

  const override = import.meta.env.VITE_REPOSITORY_URL_OVERRIDE;
  if (override) {
    return override;
  }

  return `https://${repositoryId}.http.replay.io`;
}

export const updateDevelopmentServer = debounce(async (repositoryId: string | undefined) => {
  chatStore.previewLoading.set(true);
  workbenchStore.pendingRepositoryId.set(repositoryId);

  let workbenchRepositoryId = repositoryId;

  if (repositoryId) {
    try {
      const { showRepositoryId } = await callNutAPI('wait-for-development-server', { repositoryId });
      workbenchRepositoryId = showRepositoryId;
    } catch (error) {
      chatStore.previewLoading.set(false);
      console.error('Error waiting for development server', error);
    }
  }

  if (workbenchStore.pendingRepositoryId.get() !== repositoryId) {
    chatStore.previewLoading.set(false);
    return;
  }

  const repositoryURL = getRepositoryURL(workbenchRepositoryId);

  chatStore.previewLoading.set(false);
  workbenchStore.showWorkbench.set(repositoryURL !== undefined);
  workbenchStore.repositoryId.set(workbenchRepositoryId);
  workbenchStore.previewURL.set(repositoryURL);
}, 500);
