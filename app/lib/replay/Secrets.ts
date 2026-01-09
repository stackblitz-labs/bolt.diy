import { callNutAPI } from './NutAPI';
import { onChatResponse } from '~/lib/stores/chat';

export interface RepositorySecret {
  key: string;
  value?: string;
}

export async function setAppSecrets(appId: string, secrets: RepositorySecret[]) {
  const { response } = await callNutAPI('set-app-secrets', {
    appId,
    secrets,
  });

  if (response) {
    onChatResponse(response, 'SetAppSecrets');
  }
}

export async function getAppSetSecrets(appId: string): Promise<string[]> {
  const { setSecrets } = await callNutAPI('get-app-set-secrets', { appId });
  return setSecrets;
}
