import { atom } from 'nanostores';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { spawn, writeToBoltTerminal, toggleTerminal, readFile, saveFileContent, createFile } = vi.hoisted(() => ({
  spawn: vi.fn(),
  writeToBoltTerminal: vi.fn(),
  toggleTerminal: vi.fn(),
  readFile: vi.fn(),
  saveFileContent: vi.fn(),
  createFile: vi.fn(),
}));

vi.mock('~/lib/webcontainer', () => ({
  webcontainer: Promise.resolve({ spawn, workdir: '/home/project', fs: { readFile } }),
}));
vi.mock('~/lib/persistence/useChatHistory', () => ({ chatId: atom('command-test') }));
vi.mock('~/lib/stores/workbench', () => ({
  workbenchStore: {
    projectGeneration: atom(1),
    previews: atom([]),
    files: atom({}),
    saveFileContent,
    createFile,
    isFolderLocked: () => ({ isLocked: false }),
    isFileLocked: () => ({ locked: false }),
    queueProjectMutation: (operation: () => Promise<unknown>) => operation(),
    toggleTerminal,
    writeToBoltTerminal,
  },
}));
vi.mock('./ripgrepClient', () => ({ searchWithRipgrep: vi.fn() }));

import { createProjectMcpBridge } from './projectMcp';
import { workbenchStore } from '~/lib/stores/workbench';

let bridge: Awaited<ReturnType<typeof createProjectMcpBridge>> | undefined;

afterEach(async () => {
  await bridge?.close();
  bridge = undefined;
  workbenchStore.previews.set([]);
  workbenchStore.files.set({});
});

function processWithOutput(output: string, exitCode: number | Promise<number>) {
  return {
    output: new ReadableStream<string>({
      start(controller) {
        controller.enqueue(output);
        controller.close();
      },
    }),
    exit: Promise.resolve(exitCode),
    kill: vi.fn(),
  };
}

describe('project command tools', () => {
  it('executes in the default project directory and forwards real output to Bolt Terminal', async () => {
    spawn.mockResolvedValueOnce(processWithOutput('command-marker\n', 0));
    bridge = await createProjectMcpBridge();

    const result = await bridge.callTool('project_run_command', { command: 'echo command-marker' });

    expect(spawn).toHaveBeenCalledWith('/bin/jsh', ['-c', 'echo command-marker']);
    expect(toggleTerminal).toHaveBeenCalledWith(true);
    expect(writeToBoltTerminal).toHaveBeenCalledWith('command-marker\n');
    expect(result.structuredContent).toMatchObject({
      status: 'exited',
      exitCode: 0,
      output: 'command-marker\n',
      previewReady: false,
    });
    expect(result.isError).not.toBe(true);
  });

  it('preserves WebContainer plain-object spawn errors instead of reporting success', async () => {
    spawn.mockRejectedValueOnce({ code: 'ENOENT', message: 'no such file or directory' });
    bridge = await createProjectMcpBridge();

    const result = await bridge.callTool('project_run_command', { command: 'npm install' });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: 'text', text: 'no such file or directory' }]);
    expect(writeToBoltTerminal).toHaveBeenCalledWith(
      expect.stringContaining('Command failed: no such file or directory'),
    );
  });

  it('returns failed exit status and output through both launch and output tools', async () => {
    spawn.mockResolvedValueOnce(processWithOutput('npm error missing script\n', 1));
    bridge = await createProjectMcpBridge();

    const result = await bridge.callTool('project_run_command', { command: 'npm run dev' });

    const output = await bridge.callTool('project_get_process_output', {
      processId: (result.structuredContent as Record<string, unknown>).processId,
    });

    for (const response of [result, output]) {
      expect(response.isError).toBe(true);
      expect(response.structuredContent).toMatchObject({
        status: 'exited',
        exitCode: 1,
        output: 'npm error missing script\n',
        error: 'Command exited with code 1.',
      });
    }
  });

  it('retains a long-running server and its output without pretending it finished', async () => {
    let finish!: (code: number) => void;

    const process = processWithOutput(
      'server-listening\n',
      new Promise<number>((resolve) => {
        finish = resolve;
      }),
    );
    process.kill.mockImplementation(() => finish(143));
    spawn.mockResolvedValueOnce(process);
    bridge = await createProjectMcpBridge();

    const result = await bridge.callTool('project_run_command', { command: 'npm run dev' });

    expect(result.structuredContent).toMatchObject({ status: 'running', output: 'server-listening\n' });
    expect((result.structuredContent as Record<string, unknown>).exitCode).toBeUndefined();
    expect(process.kill).not.toHaveBeenCalled();
    finish(1);

    const output = await bridge.callTool('project_get_process_output', {
      processId: (result.structuredContent as Record<string, unknown>).processId,
    });
    expect(output.isError).toBe(true);
    expect(output.structuredContent).toMatchObject({ status: 'exited', exitCode: 1 });
  });

  it('reports a live preview as tool evidence while keeping the dev server running', async () => {
    let finish!: (code: number) => void;

    const process = processWithOutput(
      'server-listening\n',
      new Promise<number>((resolve) => {
        finish = resolve;
      }),
    );
    process.kill.mockImplementation(() => finish(143));
    spawn.mockResolvedValueOnce(process);
    workbenchStore.previews.set([{ port: 5173, ready: true, baseUrl: 'https://preview.example' }]);
    bridge = await createProjectMcpBridge();

    const result = await bridge.callTool('project_run_command', { command: 'npm run dev' });

    expect(result.structuredContent).toMatchObject({ status: 'running', previewReady: true });
    expect(process.kill).not.toHaveBeenCalled();
  });

  it('preserves verification purpose and the exact command through output polling', async () => {
    spawn.mockResolvedValueOnce(processWithOutput('checks passed\n', 0));
    bridge = await createProjectMcpBridge();

    const launched = await bridge.callTool('project_run_command', { command: 'npm run typecheck', purpose: 'test' });

    const polled = await bridge.callTool('project_get_process_output', {
      processId: (launched.structuredContent as Record<string, unknown>).processId,
    });

    for (const result of [launched, polled]) {
      expect(result.structuredContent).toMatchObject({
        command: 'npm run typecheck',
        purpose: 'test',
        exitCode: 0,
        status: 'exited',
      });
    }
  });
});

describe('targeted project file edits', () => {
  const original = 'header\nbutton: blue\nfooter\n';

  const prepare = async () => {
    workbenchStore.files.set({ '/home/project/src/App.tsx': { type: 'file', content: original, isBinary: false } });
    readFile.mockResolvedValue(new TextEncoder().encode(original));
    saveFileContent.mockClear();
    createFile.mockClear();
    bridge = await createProjectMcpBridge();
  };

  it('rejects unnecessary full replacements of existing files without a reason', async () => {
    await prepare();

    const result = await bridge!.callTool('project_write_file', { path: 'src/App.tsx', content: 'rewritten app' });
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: 'text', text: expect.stringContaining('project_patch_file') }]);
    expect(saveFileContent).not.toHaveBeenCalled();
  });

  it('patches only the exact target and preserves surrounding content', async () => {
    await prepare();

    const result = await bridge!.callTool('project_patch_file', {
      path: 'src/App.tsx',
      expectedContent: original,
      oldText: 'button: blue',
      newText: 'button: green',
    });
    expect(result.structuredContent).toMatchObject({ patched: true, changed: true });
    expect(saveFileContent).toHaveBeenCalledExactlyOnceWith(
      '/home/project/src/App.tsx',
      'header\nbutton: green\nfooter\n',
    );
    expect(createFile).not.toHaveBeenCalled();
  });

  it('refuses stale or ambiguous patches', async () => {
    await prepare();

    const stale = await bridge!.callTool('project_patch_file', {
      path: 'src/App.tsx',
      expectedContent: 'stale',
      oldText: 'button: blue',
      newText: 'button: green',
    });
    expect(stale.isError).toBe(true);
    readFile.mockResolvedValueOnce(new TextEncoder().encode('same same'));

    const ambiguous = await bridge!.callTool('project_patch_file', {
      path: 'src/App.tsx',
      expectedContent: 'same same',
      oldText: 'same',
      newText: 'other',
    });
    expect(ambiguous.isError).toBe(true);
    expect(saveFileContent).not.toHaveBeenCalled();
  });

  it('permits justified full replacements and reports no-op writes accurately', async () => {
    await prepare();

    const unchanged = await bridge!.callTool('project_write_file', { path: 'src/App.tsx', content: original });
    expect(unchanged.structuredContent).toMatchObject({ changed: false });
    expect(saveFileContent).not.toHaveBeenCalled();

    const replaced = await bridge!.callTool('project_write_file', {
      path: 'src/App.tsx',
      content: 'new layout',
      replacementReason: 'The user requested replacing this entire starter page.',
    });
    expect(replaced.structuredContent).toMatchObject({ written: true, created: false, changed: true });
    expect(saveFileContent).toHaveBeenCalledExactlyOnceWith('/home/project/src/App.tsx', 'new layout');
  });
});
