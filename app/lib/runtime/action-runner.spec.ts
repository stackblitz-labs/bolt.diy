import type { WebContainer } from '@webcontainer/api';
import { describe, expect, it, vi } from 'vitest';
import { ActionRunner } from './action-runner';
import type { BoltShell } from '~/utils/shell';

describe('ActionRunner file actions', () => {
  it('marks a file action failed when creating its directory fails', async () => {
    const webcontainer = {
      workdir: '/project',
      fs: {
        mkdir: vi.fn().mockRejectedValue(new Error('filesystem unavailable')),
        writeFile: vi.fn(),
      },
    } as unknown as WebContainer;

    const runner = new ActionRunner(Promise.resolve(webcontainer), () => ({}) as BoltShell);

    const action = {
      artifactId: 'artifact-1',
      messageId: 'message-1',
      actionId: 'action-1',
      action: { type: 'file' as const, filePath: 'src/App.tsx', content: 'export default function App() {}' },
    };

    runner.addAction(action);
    await runner.runAction(action);

    expect(runner.actions.get()['action-1']).toMatchObject({ status: 'failed', error: 'Action failed' });
    expect(webcontainer.fs.writeFile).not.toHaveBeenCalled();
  });

  it('marks a file action failed when writing the file fails', async () => {
    const webcontainer = {
      workdir: '/project',
      fs: {
        mkdir: vi.fn().mockResolvedValue(undefined),
        writeFile: vi.fn().mockRejectedValue(new Error('disk full')),
      },
    } as unknown as WebContainer;

    const runner = new ActionRunner(Promise.resolve(webcontainer), () => ({}) as BoltShell);

    const action = {
      artifactId: 'artifact-1',
      messageId: 'message-1',
      actionId: 'action-2',
      action: { type: 'file' as const, filePath: 'src/App.tsx', content: 'export default function App() {}' },
    };

    runner.addAction(action);
    await runner.runAction(action);

    expect(runner.actions.get()['action-2']).toMatchObject({ status: 'failed', error: 'Action failed' });
    expect(webcontainer.fs.writeFile).toHaveBeenCalledWith('src/App.tsx', 'export default function App() {}');
  });
});
