import { atom, type WritableAtom } from 'nanostores';

export class WorkbenchStore {
  // The current repository.
  repositoryId = atom<string | undefined>(undefined);

  // Repository we are waiting to start up.
  pendingRepositoryId = atom<string | undefined>(undefined);

  // Any available preview URL for the current repository.
  previewURL = atom<string | undefined>(undefined);

  showWorkbench: WritableAtom<boolean> = import.meta.hot?.data.showWorkbench ?? atom(false);

  // Selected element from element picker
  selectedElement: WritableAtom<any | null> = import.meta.hot?.data.selectedElement ?? atom(null);

  constructor() {
    if (import.meta.hot) {
      import.meta.hot.data.showWorkbench = this.showWorkbench;
      import.meta.hot.data.selectedElement = this.selectedElement;
    }
  }

  setShowWorkbench(show: boolean) {
    this.showWorkbench.set(show);
  }

  setSelectedElement(element: any | null) {
    this.selectedElement.set(element);
  }
}

export const workbenchStore = new WorkbenchStore();
