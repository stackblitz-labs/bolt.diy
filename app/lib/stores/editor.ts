import { atom, computed, map, type MapStore, type WritableAtom } from 'nanostores';
import type { FileMap, FilesStore } from './files';
import type { EditorDocument, ScrollPosition } from '~/components/editor/codemirror/CodeMirrorEditor';
import { createScopedLogger } from '~/utils/logger';

export type EditorDocuments = Record<string, EditorDocument>;

type SelectedFile = WritableAtom<string | undefined>;

const logger = createScopedLogger('EditorStore');

export class EditorStore {
  #filesStore: FilesStore;
  #previousFiles: FileMap = {};

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

  setDocuments(files: FileMap) {
    const previousFiles = this.#previousFiles;

    if (files === previousFiles) {
      return;
    }

    this.#previousFiles = files;

    const documents = this.documents.get();
    const nextDocuments: EditorDocuments = {};

    let changed = false;
    let fileCount = 0;

    for (const filePath of Object.keys(files)) {
      const file = files[filePath];

      if (file?.type !== 'file') {
        continue;
      }

      const previousDocument = documents[filePath];
      const previousFile = previousFiles[filePath];
      fileCount++;

      // Keep a draft and its selection when the persisted file is unchanged.
      if (
        previousDocument &&
        (previousFile === file ||
          (previousFile?.type === 'file' &&
            previousFile.content === file.content &&
            previousFile.isBinary === file.isBinary) ||
          (previousDocument.value === file.content && previousDocument.isBinary === file.isBinary))
      ) {
        nextDocuments[filePath] = previousDocument;
        continue;
      }

      changed = true;
      nextDocuments[filePath] = {
        value: file.content,
        filePath,
        isBinary: file.isBinary,
        scroll: previousDocument?.scroll,
      };
    }

    if (changed || fileCount !== Object.keys(documents).length) {
      this.documents.set(nextDocuments);
    }
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
      this.documents.setKey(filePath, {
        ...documentState,
        value: newContent,
      });
    }
  }
}
