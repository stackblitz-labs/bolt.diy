import { atom, map } from 'nanostores';
import { workbenchStore } from './workbench';
import { PROVIDER_LIST } from '~/utils/constants';
import type { IProviderConfig } from '~/types/model';

export interface Shortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  ctrlOrMetaKey?: boolean;
  action: () => void;
}

export interface Shortcuts {
  toggleTerminal: Shortcut;
}

export const URL_CONFIGURABLE_PROVIDERS = ['Ollama', 'LMStudio', 'OpenAILike'];
export const LOCAL_PROVIDERS = ['OpenAILike', 'LMStudio', 'Ollama'];

export type ProviderSetting = Record<string, IProviderConfig>;

export const shortcutsStore = map<Shortcuts>({
  toggleTerminal: {
    key: 'j',
    ctrlOrMetaKey: true,
    action: () => workbenchStore.toggleTerminal(),
  },
});

const initialProviderSettings: ProviderSetting = {};
PROVIDER_LIST.forEach((provider) => {
  initialProviderSettings[provider.name] = {
    ...provider,
    settings: {
      enabled: true,
    },
  };
});
export const providersStore = map<ProviderSetting>(initialProviderSettings);

export const isDebugMode = atom(false);

export const isEventLogsEnabled = atom(false);

export const isLocalModelsEnabled = atom(true);

export const promptStore = atom<string>('default');

export const latestBranchStore = atom(false);

export const isGitHubAuthEnabled = atom(false);
