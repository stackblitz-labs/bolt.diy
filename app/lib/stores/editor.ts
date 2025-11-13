import { atom, computed, map, type MapStore, type WritableAtom } from 'nanostores';
import type { EditorDocument, ScrollPosition } from '~/components/editor/codemirror/CodeMirrorEditor';
import type { FileMap, FilesStore } from './files';
import { createScopedLogger } from '~/utils/logger';
import { getCurrentChatId } from '~/utils/fileLocks';
import { addLockedItem } from '~/lib/persistence/lockedFiles';

export type EditorDocuments = Record<string, EditorDocument>;

type SelectedFile = WritableAtom<string | undefined>;

const logger = createScopedLogger('EditorStore');

export class EditorStore {
  #filesStore: FilesStore;
  #autoLockEnabled = true; // Enable automatic lock acquisition
  #autoLockTimers: Map<string, ReturnType<typeof setTimeout>> = new Map(); // Track debounce timers for auto-locking

  selectedFile: SelectedFile = import.meta.hot?.data.selectedFile ?? atom<string | undefined>();
  documents: MapStore<EditorDocuments> = import.meta.hot?.data.documents ?? map({});

  currentDocument = computed([this.documents, this.selectedFile], (documents, selectedFile) => {
    if (!selectedFile) {
      return undefined;
    }

    return documents[selectedFile];
  });

  constructor(filesStore: FilesStore) {
    this.#filesStore = filesStore;

    if (import.meta.hot) {
      import.meta.hot.data.documents = this.documents;
      import.meta.hot.data.selectedFile = this.selectedFile;
    }
  }

  /**
   * Automatically lock a file when user starts editing
   * Uses a short delay to avoid locking files that are just being viewed
   */
  #autoLockFile(filePath: string) {
    if (!this.#autoLockEnabled) {
      return;
    }

    // Clear any existing timer for this file
    const existingTimer = this.#autoLockTimers.get(filePath);

    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set a new timer to lock the file after a short delay (2 seconds of editing)
    const timer = setTimeout(() => {
      try {
        const chatId = getCurrentChatId();
        const file = this.#filesStore.getFile(filePath);

        // Only auto-lock if not already locked
        if (file && !file.isLocked) {
          addLockedItem(chatId, filePath, false, { autoLock: true });
          logger.info(`Auto-locked file: ${filePath}`);
        }
      } catch (error) {
        logger.error(`Failed to auto-lock file: ${filePath}`, error);
      } finally {
        this.#autoLockTimers.delete(filePath);
      }
    }, 2000); // 2 second delay before auto-locking

    this.#autoLockTimers.set(filePath, timer);
  }

  setDocuments(files: FileMap) {
    const previousDocuments = this.documents.value;

    this.documents.set(
      Object.fromEntries<EditorDocument>(
        Object.entries(files)
          .map(([filePath, dirent]) => {
            if (dirent === undefined || dirent.type !== 'file') {
              return undefined;
            }

            const previousDocument = previousDocuments?.[filePath];

            return [
              filePath,
              {
                value: dirent.content,
                filePath,
                isBinary: dirent.isBinary, // Add this line
                scroll: previousDocument?.scroll,
              },
            ] as [string, EditorDocument];
          })
          .filter(Boolean) as Array<[string, EditorDocument]>,
      ),
    );
  }

  setSelectedFile(filePath: string | undefined) {
    this.selectedFile.set(filePath);
  }

  updateScrollPosition(filePath: string, position: ScrollPosition) {
    const documents = this.documents.get();
    const documentState = documents[filePath];

    if (!documentState) {
      return;
    }

    this.documents.setKey(filePath, {
      ...documentState,
      scroll: position,
    });
  }

  updateFile(filePath: string, newContent: string) {
    const documents = this.documents.get();
    const documentState = documents[filePath];

    if (!documentState) {
      return;
    }

    // Check if the file is locked by getting the file from the filesStore
    const file = this.#filesStore.getFile(filePath);

    if (file?.isLocked) {
      logger.warn(`Attempted to update locked file: ${filePath}`);
      return;
    }

    /*
     * For scoped locks, we would need to implement diff checking here
     * to determine if the edit is modifying existing code or just adding new code
     * This is a more complex feature that would be implemented in a future update
     */

    const currentContent = documentState.value;
    const contentChanged = currentContent !== newContent;

    if (contentChanged) {
      // Trigger auto-lock on edit
      this.#autoLockFile(filePath);

      this.documents.setKey(filePath, {
        ...documentState,
        value: newContent,
      });
    }
  }
}
