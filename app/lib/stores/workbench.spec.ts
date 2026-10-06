import { map } from 'nanostores';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActionCallbackData } from '~/lib/runtime/message-parser';
import type { ArtifactState, WorkbenchStore } from '~/lib/stores/workbench';

let workbenchStoreClass: typeof import('~/lib/stores/workbench').WorkbenchStore;
let store: WorkbenchStore;

function createArtifact(actionId: string, action: unknown) {
  const runner = {
    actions: map({ [actionId]: action }),
    runAction: vi.fn().mockResolvedValue(undefined),
    addAction: vi.fn().mockResolvedValue(undefined),
  };

  return { runner } as unknown as ArtifactState;
}

beforeAll(async () => {
  // Node exposes a global BroadcastChannel; the preview store opens real ones on construction.
  vi.stubGlobal('BroadcastChannel', undefined);
  ({ WorkbenchStore: workbenchStoreClass } = await import('~/lib/stores/workbench'));
});

beforeEach(() => {
  store = new workbenchStoreClass();
});

describe('WorkbenchStore._runAction', () => {
  it('should skip a file action that has no filePath instead of throwing', async () => {
    const artifactId = 'artifact-pathless';
    const actionId = 'action-pathless';

    store.artifacts.setKey(artifactId, createArtifact(actionId, { type: 'file', content: 'const a = 1;' }));

    const data = {
      artifactId,
      messageId: 'message-1',
      actionId,
      action: { type: 'file', content: 'const a = 1;' },
    } as unknown as ActionCallbackData;

    await expect(store._runAction(data)).resolves.toBeUndefined();

    const artifact = store.artifacts.get()[artifactId];
    expect(artifact.runner.runAction).not.toHaveBeenCalled();
  });

  it('should report a pathless file action only once across repeated streaming samples', async () => {
    const artifactId = 'artifact-sampled';
    const actionId = 'action-sampled';

    // The runner hands back the same action object on every streaming sample.
    const action = { type: 'file', content: 'const a = 1;' };
    store.artifacts.setKey(artifactId, createArtifact(actionId, action));

    const data = { artifactId, messageId: 'message-1', actionId, action } as unknown as ActionCallbackData;

    const warnings: string[] = [];

    const log = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      warnings.push(args.map(String).join(' '));
    });

    try {
      for (let i = 0; i < 25; i++) {
        await store._runAction(data, true);
      }
    } finally {
      log.mockRestore();
    }

    expect(warnings.filter((entry) => entry.includes('File action has no filePath'))).toHaveLength(1);
  });
});

describe('WorkbenchStore.addToExecutionQueue', () => {
  it('should keep processing later callbacks after one of them rejects', async () => {
    const executed: string[] = [];

    store.addToExecutionQueue(async () => {
      executed.push('first');
      throw new Error('boom');
    });

    store.addToExecutionQueue(async () => {
      executed.push('second');
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(executed).toEqual(['first', 'second']);
  });
});
