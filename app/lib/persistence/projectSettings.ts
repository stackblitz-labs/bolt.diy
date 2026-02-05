import { getLocalStorage, setLocalStorage } from './localStorage';

const PROJECT_SETTINGS_PREFIX = 'bolt_project_settings';

export interface ProjectSettings {
  memory: string;
  planMode: boolean;
}

const defaultSettings: ProjectSettings = {
  memory: '',
  planMode: false,
};

function buildKey(chatId?: string) {
  return chatId ? `${PROJECT_SETTINGS_PREFIX}:${chatId}` : undefined;
}

export function getProjectSettings(chatId?: string): ProjectSettings {
  if (!chatId) {
    return { ...defaultSettings };
  }

  const stored = getLocalStorage(buildKey(chatId) as string);

  return {
    ...defaultSettings,
    ...(stored || {}),
  };
}

export function setProjectSettings(chatId: string | undefined, updates: Partial<ProjectSettings>): void {
  if (!chatId) {
    return;
  }

  const key = buildKey(chatId);

  if (!key) {
    return;
  }

  const current = getProjectSettings(chatId);
  setLocalStorage(key, { ...current, ...updates });
}
