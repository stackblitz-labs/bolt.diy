import { atom, map } from 'nanostores';
import { describe, expect, it, vi } from 'vitest';
import { FilesStore } from './files';
import type { ArtifactState } from './workbench';

vi.mock('~/lib/persistence', () => ({ description: atom(undefined) }));
vi.mock('~/lib/webcontainer', () => ({ webcontainer: Promise.resolve({ workdir: '/home/project' }) }));
vi.mock('./files', () => ({
  FilesStore: class {
    files = map({});
    reset() {
      return Promise.resolve();
    }
  },
}));
vi.mock('./editor', () => ({
  EditorStore: class {
    documents = map({});
    currentDocument = atom(undefined);
    selectedFile = atom(undefined);
    updateFile = vi.fn();
    setSelectedFile = vi.fn();
  },
}));
vi.mock('./previews', () => ({
  PreviewsStore: class {
    previews = atom([]);
    reset = vi.fn();
  },
}));
vi.mock('./terminal', () => ({
  TerminalStore: class {
    boltTerminal = { executionState: atom(undefined), stop: vi.fn(async () => undefined) };
  },
}));

import { WorkbenchStore } from './workbench';

describe('WorkbenchStore chat lifecycle', () => {
  it('waits for the outgoing server exit before clearing the project', async () => {
    const store = new WorkbenchStore();
    const abortAllActions = vi.fn();
    store.artifacts.setKey('outgoing', { runner: { abortAllActions } } as unknown as ArtifactState);
    store.boltTerminal.executionState.set({ sessionId: 'outgoing', active: true });

    let finishStop!: () => void;
    vi.mocked(store.boltTerminal.stop).mockImplementationOnce(
      () => new Promise<void>((resolve) => (finishStop = resolve)),
    );

    const clearFiles = vi.spyOn(FilesStore.prototype, 'reset');
    const resetting = store.resetWorkbench();

    expect(abortAllActions).toHaveBeenCalledOnce();
    expect(store.boltTerminal.stop).toHaveBeenCalledWith('outgoing');
    expect(clearFiles).not.toHaveBeenCalled();

    finishStop();
    await resetting;
    expect(clearFiles).toHaveBeenCalledOnce();
  });

  it('does not clear incoming files when a reset becomes stale while waiting', async () => {
    const store = new WorkbenchStore();

    let current = true;
    let drain!: () => void;
    vi.spyOn(store, 'waitForExecutionQueue').mockImplementationOnce(
      () => new Promise<void>((resolve) => (drain = resolve)),
    );

    const clearFiles = vi.spyOn(FilesStore.prototype, 'reset');
    const resetting = store.resetWorkbench(() => current);

    current = false;
    drain();
    await resetting;

    expect(clearFiles).not.toHaveBeenCalled();
  });

  it('keeps Preview selected while incoming file actions stream', async () => {
    const store = new WorkbenchStore();
    const action = { type: 'file' as const, filePath: 'src/App.tsx', content: 'export default function App() {}' };
    const runAction = vi.fn(async () => undefined);
    const abortAllActions = vi.fn();
    store.artifacts.setKey('incoming', {
      runner: { actions: map({ file: action }), runAction, abortAllActions },
    } as unknown as ArtifactState);
    store.selectWorkbenchView('preview', { userInitiated: true });

    await store._runAction({ artifactId: 'incoming', messageId: 'message', actionId: 'file', action }, true);

    expect(store.currentView.get()).toBe('preview');
    expect(runAction).toHaveBeenCalled();
    expect(abortAllActions).not.toHaveBeenCalled();
  });
});
