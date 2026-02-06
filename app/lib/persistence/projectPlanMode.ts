import { getLocalStorage, setLocalStorage } from './localStorage';

const PROJECT_PLAN_MODE_PREFIX = 'bolt_project_plan_mode';
const isClient = typeof window !== 'undefined' && typeof localStorage !== 'undefined';

export interface ProjectPlanModeSettings {
  enabled: boolean;
}

const defaultSettings: ProjectPlanModeSettings = {
  enabled: false,
};

function buildKey(chatId?: string) {
  return chatId ? `${PROJECT_PLAN_MODE_PREFIX}:${chatId}` : undefined;
}

export function getProjectPlanMode(chatId?: string): ProjectPlanModeSettings {
  if (!chatId) {
    return { ...defaultSettings };
  }

  const stored = getLocalStorage(buildKey(chatId) as string);

  return {
    ...defaultSettings,
    ...(stored || {}),
  };
}

export function setProjectPlanMode(chatId: string | undefined, updates: Partial<ProjectPlanModeSettings>): void {
  if (!chatId) {
    return;
  }

  const key = buildKey(chatId);

  if (!key) {
    return;
  }

  const current = getProjectPlanMode(chatId);
  setLocalStorage(key, { ...current, ...updates });
}

export function clearProjectPlanMode(chatId: string | undefined): void {
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
    console.error(`Error clearing plan mode settings for chat "${chatId}":`, error);
  }
}

export function clearAllProjectPlanMode(): void {
  if (!isClient) {
    return;
  }

  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith(`${PROJECT_PLAN_MODE_PREFIX}:`))
      .forEach((key) => {
        localStorage.removeItem(key);
      });
  } catch (error) {
    console.error('Error clearing plan mode settings:', error);
  }
}
