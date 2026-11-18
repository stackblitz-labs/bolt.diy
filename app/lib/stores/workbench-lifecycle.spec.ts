import { atom, map } from 'nanostores';
import { describe, expect, it, vi } from 'vitest';
import { FilesStore } from './files';
import type { ArtifactState } from './workbench';
import { WorkbenchStore } from './workbench';
import type { ActionCallbackData } from '~/lib/runtime/message-parser';

vi.mock('~/lib/persistence', () => ({ description: atom(undefined) }));
vi.mock('~/lib/webcontainer', () => ({ webcontainer: Promise.resolve({ workdir: '/home/project' }) }));
vi.mock('./files', () => ({
  FilesStore: class {
    files = map({});
    getFile = vi.fn(() => ({}));
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
    setDocuments = vi.fn();
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

describe('WorkbenchStore actions', () => {
  const pathlessAction = { type: 'file' as const, content: 'const a = 1;' };

  const pathlessActionData = {
    artifactId: 'artifact',
    messageId: 'message',
    actionId: 'file',
    action: pathlessAction,
  } as ActionCallbackData;

  it('skips file actions with no path and warns once across streamed samples', async () => {
    const store = new WorkbenchStore();
    const runAction = vi.fn(async () => undefined);
    store.artifacts.setKey('artifact', {
      runner: { actions: map({ file: pathlessAction }), runAction },
    } as unknown as ArtifactState);

    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    try {
      await expect(store._runAction(pathlessActionData)).resolves.toBeUndefined();

      for (let sample = 0; sample < 25; sample++) {
        await store._runAction(pathlessActionData, true);
      }

      expect(runAction).not.toHaveBeenCalled();
      expect(log.mock.calls.filter((args) => args.join(' ').includes('File action has no filePath'))).toHaveLength(1);
    } finally {
      log.mockRestore();
    }
  });

  it('continues processing queued callbacks after a rejection', async () => {
    const store = new WorkbenchStore();
    const executed: string[] = [];
    store.addToExecutionQueue(async () => {
      executed.push('first');
      throw new Error('boom');
    });
    store.addToExecutionQueue(async () => {
      executed.push('second');
    });

    await store.waitForExecutionQueue();

    expect(executed).toEqual(['first', 'second']);
  });

  it('aborts every artifact runner and clears the action alert', () => {
    const store = new WorkbenchStore();
    const first = vi.fn();
    const second = vi.fn();
    store.artifacts.setKey('first', { runner: { abortAllActions: first } } as unknown as ArtifactState);
    store.artifacts.setKey('second', { runner: { abortAllActions: second } } as unknown as ArtifactState);
    store.actionAlert.set({ type: 'preview', title: 'Alert', description: 'Test alert', content: 'Test content' });

    store.abortAllActions();

    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
    expect(store.actionAlert.get()).toBeUndefined();
  });
});

describe('WorkbenchStore view selection', () => {
  it('starts open and preserves the user choice through a programmatic view change', () => {
    const store = new WorkbenchStore();
    expect(store.showWorkbench.get()).toBe(true);
    expect(store.currentView.get()).toBe('code');
    expect(store.userSelectedView.get()).toBeUndefined();

    store.selectWorkbenchView('diff', { userInitiated: true });
    expect(store.currentView.get()).toBe('diff');
    expect(store.userSelectedView.get()).toBe('diff');

    store.selectWorkbenchView('preview');
    expect(store.currentView.get()).toBe('preview');
    expect(store.userSelectedView.get()).toBe('diff');
  });

  it('clears the user choice and opens the code view on reset', async () => {
    const store = new WorkbenchStore();
    store.selectWorkbenchView('diff', { userInitiated: true });
    store.showWorkbench.set(false);

    await store.resetWorkbench();

    expect(store.userSelectedView.get()).toBeUndefined();
    expect(store.currentView.get()).toBe('code');
    expect(store.showWorkbench.get()).toBe(true);
  });
});

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
