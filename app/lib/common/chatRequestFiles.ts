import type { FileMap } from '~/lib/stores/files';

export function getChatRequestFiles(files: FileMap, nativeAgent: boolean): FileMap {
  if (!nativeAgent) {
    return files;
  }

  /*
   * The native agent reads project content through tools. The request still
   * supplies locked paths to the server prompt through the existing file map.
   */
  const lockedFiles: FileMap = {};

  for (const path of Object.keys(files)) {
    const entry = files[path];

    if (entry?.isLocked) {
      lockedFiles[path] = entry.type === 'file' ? { ...entry, content: '' } : entry;
    }
  }

  return lockedFiles;
}
