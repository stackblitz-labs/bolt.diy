import { atom, map } from 'nanostores';
import { describe, expect, it, vi } from 'vitest';
import { FilesStore } from './files';
import type { ArtifactState } from './workbench';
import { WorkbenchStore } from './workbench';
import { EnhancedStreamingMessageParser } from '~/lib/runtime/enhanced-message-parser';

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

describe('WorkbenchStore chat lifecycle', () => {
  it('does not execute a shell command parsed from imported history', async () => {
    const store = new WorkbenchStore();
    store.setReloadedMessages(['imported']);

    const parser = new EnhancedStreamingMessageParser({
      callbacks: {
        onArtifactOpen: (data) => store.addArtifact(data),
        onActionClose: (data) => {
          store.addAction(data);
          store.runAction(data);
        },
      },
    });

    parser.parse(
      'imported',
      '<boltArtifact id="saved" title="Saved"><boltAction type="shell">echo unsafe</boltAction></boltArtifact>',
      true,
    );
    await store.waitForExecutionQueue();

    const actions = Object.values(store.artifacts.get()['imported-0'].runner.actions.get());
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      type: 'shell',
      content: 'echo unsafe',
      status: 'pending',
      requiresApproval: true,
    });
  });

  it.each(['shell', 'start', 'build', 'supabase'] as const)(
    'keeps a saved %s action inert until explicitly approved',
    async (type) => {
      const store = new WorkbenchStore();
      store.setReloadedMessages(['saved']);
      store.addArtifact({ id: 'artifact', title: 'Saved', messageId: 'saved' });

      const action =
        type === 'supabase'
          ? { type, operation: 'query' as const, content: 'select 1' }
          : { type, content: 'echo test' };

      const data = { artifactId: 'artifact', messageId: 'saved', actionId: '0', action };
      const runner = store.artifacts.get().artifact.runner;
      const execute = vi.spyOn(runner, 'runAction').mockResolvedValue(undefined);

      store.addAction(data);
      store.runAction(data);
      await store.waitForExecutionQueue();

      expect(runner.actions.get()['0']).toMatchObject({ status: 'pending', requiresApproval: true });
      expect(execute).not.toHaveBeenCalled();

      await store.runHistoricalAction(data);
      expect(execute).toHaveBeenCalledOnce();
    },
  );

  it('continues to execute new shell actions normally', async () => {
    const store = new WorkbenchStore();
    store.addArtifact({ id: 'artifact', title: 'New', messageId: 'new' });

    const data = {
      artifactId: 'artifact',
      messageId: 'new',
      actionId: '0',
      action: { type: 'shell' as const, content: 'echo test' },
    };

    const runner = store.artifacts.get().artifact.runner;
    const execute = vi.spyOn(runner, 'runAction').mockResolvedValue(undefined);
    store.addAction(data);
    store.runAction(data);
    await store.waitForExecutionQueue();
    expect(execute).toHaveBeenCalledOnce();
  });

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
    store.setReloadedMessages(['message']);
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
