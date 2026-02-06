import { getLocalStorage, setLocalStorage } from './localStorage';

const PROJECT_MEMORY_PREFIX = 'bolt_project_memory';
const isClient = typeof window !== 'undefined' && typeof localStorage !== 'undefined';

export interface ProjectMemory {
  memory: string;
}

const defaultMemory: ProjectMemory = {
  memory: '',
};

function buildKey(chatId?: string) {
  return chatId ? `${PROJECT_MEMORY_PREFIX}:${chatId}` : undefined;
}

export function getProjectMemory(chatId?: string): ProjectMemory {
  if (!chatId) {
    return { ...defaultMemory };
  }

  const stored = getLocalStorage(buildKey(chatId) as string);

  return {
    ...defaultMemory,
    ...(stored || {}),
  };
}

export function setProjectMemory(chatId: string | undefined, updates: Partial<ProjectMemory>): void {
  if (!chatId) {
    return;
  }

  const key = buildKey(chatId);

  if (!key) {
    return;
  }

  const current = getProjectMemory(chatId);
  setLocalStorage(key, { ...current, ...updates });
}

export function clearProjectMemory(chatId: string | undefined): void {
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
    console.error(`Error clearing project memory for chat "${chatId}":`, error);
  }
}

export function clearAllProjectMemory(): void {
  if (!isClient) {
    return;
  }

  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith(`${PROJECT_MEMORY_PREFIX}:`))
      .forEach((key) => {
        localStorage.removeItem(key);
      });
  } catch (error) {
    console.error('Error clearing project memory:', error);
  }
}
