import { getLocalStorage, setLocalStorage } from './localStorage';

const PROJECT_SETTINGS_PREFIX = 'bolt_project_settings';
const isClient = typeof window !== 'undefined' && typeof localStorage !== 'undefined';

export interface ProjectSettings {
  memory: string;
}

const defaultSettings: ProjectSettings = {
  memory: '',
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

export function clearProjectSettings(chatId: string | undefined): void {
  if (!chatId || !isClient) {
    return;
  }

  const key = buildKey(chatId);

  if (!key) {
    return;
  }

  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`Error clearing project settings for chat "${chatId}":`, error);
  }
}

export function clearAllProjectSettings(): void {
  if (!isClient) {
    return;
  }

  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith(`${PROJECT_SETTINGS_PREFIX}:`))
      .forEach((key) => {
        localStorage.removeItem(key);
      });
  } catch (error) {
    console.error('Error clearing project settings:', error);
  }
}
