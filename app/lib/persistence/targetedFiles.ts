export const TARGETED_FILES_KEY = 'bolt.targetedFiles';

export interface TargetedFile {
  chatId: string;
  path: string;
}

let targetedFilesCache: TargetedFile[] | null = null;
const targetedFilesMap = new Map<string, Set<string>>();

function getChatSet(chatId: string, create = false): Set<string> | undefined {
  if (create && !targetedFilesMap.has(chatId)) {
    targetedFilesMap.set(chatId, new Set());
  }

  return targetedFilesMap.get(chatId);
}

function initializeCache(): TargetedFile[] {
  if (targetedFilesCache !== null) {
    return targetedFilesCache;
  }

  try {
    if (typeof localStorage !== 'undefined') {
      const json = localStorage.getItem(TARGETED_FILES_KEY);

      if (json) {
        const items = JSON.parse(json) as TargetedFile[];
        targetedFilesCache = items;
        rebuildLookup(items);

        return items;
      }
    }

    targetedFilesCache = [];

    return [];
  } catch {
    targetedFilesCache = [];
    return [];
  }
}

function rebuildLookup(items: TargetedFile[]): void {
  targetedFilesMap.clear();

  for (const item of items) {
    let set = targetedFilesMap.get(item.chatId);

    if (!set) {
      set = new Set();
      targetedFilesMap.set(item.chatId, set);
    }

    set.add(item.path);
  }
}

export function saveTargetedFiles(items: TargetedFile[]): void {
  targetedFilesCache = [...items];
  rebuildLookup(items);

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(TARGETED_FILES_KEY, JSON.stringify(items));
    }
  } catch {}
}

export function getTargetedFiles(): TargetedFile[] {
  return initializeCache();
}

export function addTargetedFile(chatId: string, path: string): void {
  const files = getTargetedFiles();
  const set = getChatSet(chatId, true)!;
  set.add(path);

  const filtered = files.filter((f) => !(f.chatId === chatId && f.path === path));
  filtered.push({ chatId, path });
  saveTargetedFiles(filtered);
}

export function removeTargetedFile(chatId: string, path: string): void {
  const files = getTargetedFiles();
  const set = getChatSet(chatId);

  if (set) {
    set.delete(path);
  }

  const filtered = files.filter((f) => !(f.chatId === chatId && f.path === path));
  saveTargetedFiles(filtered);
}

export function isFileTargeted(chatId: string, path: string): boolean {
  initializeCache();

  const set = getChatSet(chatId);

  return set ? set.has(path) : false;
}

export function getTargetedFilesForChat(chatId: string): string[] {
  initializeCache();

  const set = getChatSet(chatId);

  return set ? Array.from(set) : [];
}

export function clearCache(): void {
  targetedFilesCache = null;
  targetedFilesMap.clear();
}
