import { describe, expect, it, vi } from 'vitest';
import { EditorStore } from './editor';
import type { FileMap, FilesStore } from './files';

describe('editor document reconciliation', () => {
  const entry = (content: string) => ({ type: 'file' as const, isBinary: false, content });
  const draftPath = '/home/project/draft.ts';
  const changedPath = '/home/project/changed.ts';

  const initialFiles: FileMap = {
    [draftPath]: entry('saved draft'),
    [changedPath]: entry('before'),
  };

  it('keeps a draft, scroll and document identity across unrelated writes and lock changes', () => {
    const filesStore = { getFile: (path: string) => initialFiles[path] } as FilesStore;
    const editor = new EditorStore(filesStore);
    editor.setDocuments(initialFiles);
    editor.setSelectedFile(draftPath);
    editor.updateFile(draftPath, 'unsaved draft');
    editor.updateScrollPosition(draftPath, { top: 48, left: 0 });

    const draft = editor.currentDocument.get();
    const onChange = vi.fn();
    const unsubscribe = editor.currentDocument.listen(onChange);
    const updatedFiles = { ...initialFiles, [changedPath]: entry('after') };

    editor.setDocuments(updatedFiles);
    expect(editor.documents.get()[changedPath].value).toBe('after');
    expect(editor.currentDocument.get()).toBe(draft);
    expect(editor.currentDocument.get()).toMatchObject({ value: 'unsaved draft', scroll: { top: 48, left: 0 } });

    const updatedDocuments = editor.documents.get();
    editor.setDocuments({ ...updatedFiles, [draftPath]: { ...entry('saved draft'), isLocked: true } });
    expect(editor.documents.get()).toBe(updatedDocuments);
    expect(onChange).not.toHaveBeenCalled();

    unsubscribe();
  });

  it('updates changed files, removes stale paths, and clears drafts on a project reset', () => {
    const filesStore = { getFile: (path: string) => initialFiles[path] } as FilesStore;
    const editor = new EditorStore(filesStore);
    editor.setDocuments(initialFiles);
    editor.updateFile(draftPath, 'old draft');

    editor.setDocuments({ [draftPath]: entry('external write') });
    expect(editor.documents.get()[draftPath].value).toBe('external write');
    expect(editor.documents.get()).not.toHaveProperty(changedPath);

    editor.updateFile(draftPath, 'another draft');
    editor.setDocuments({});
    editor.setDocuments(initialFiles);
    expect(editor.documents.get()[draftPath].value).toBe('saved draft');
  });
});
