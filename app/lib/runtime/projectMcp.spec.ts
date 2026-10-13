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
    waitForExecutionQueue: async () => undefined,
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
  workbenchStore.projectGeneration.set(workbenchStore.projectGeneration.get() + 1);
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
  it('reuses the same running dev command instead of spawning another preview server', async () => {
    let finish!: (code: number) => void;

    const process = processWithOutput(
      'server ready\n',
      new Promise<number>((resolve) => {
        finish = resolve;
      }),
    );
    process.kill.mockImplementation(() => finish(143));
    spawn.mockClear();
    spawn.mockResolvedValueOnce(process);
    bridge = await createProjectMcpBridge();

    const first = await bridge.callTool('project_run_command', { command: 'npm run dev', purpose: 'run' });

    const second = await bridge.callTool('project_run_command', {
      command: 'cd /home/project && npm run dev',
      purpose: 'run',
    });
    expect(spawn).toHaveBeenCalledOnce();
    expect(second.structuredContent).toMatchObject({
      processId: (first.structuredContent as { processId: string }).processId,
      status: 'running',
      reused: true,
    });
  });
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

describe('project paths', () => {
  it('lists the project root and accepts absolute paths inside the project', async () => {
    workbenchStore.files.set({
      '/home/project/src/App.tsx': { type: 'file', content: 'page', isBinary: false },
      '/home/project/package.json': { type: 'file', content: '{}', isBinary: false },
    });
    readFile.mockResolvedValue(new TextEncoder().encode('page'));
    bridge = await createProjectMcpBridge();

    for (const prefix of ['', '.', '/home/project', '/home/project/']) {
      const result = await bridge.callTool('project_list_paths', { path: prefix });
      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toMatchObject({ entries: [{ path: 'src/App.tsx' }, { path: 'package.json' }] });
    }

    const listing = await bridge.callTool('project_list_paths', { path: '/home/project/src' });
    expect(listing.structuredContent).toMatchObject({ entries: [{ path: 'src/App.tsx' }] });

    const read = await bridge.callTool('project_read_file', { path: '/home/project/src/App.tsx' });
    expect(read.isError).not.toBe(true);
    expect(read.structuredContent).toMatchObject({ path: 'src/App.tsx', content: 'page' });
    expect(readFile).toHaveBeenLastCalledWith('src/App.tsx');
  });

  it('rejects traversal, sibling roots, and deleting the project root', async () => {
    bridge = await createProjectMcpBridge();

    for (const outside of ['../private', '/home/project/../private', '/home/project-other/src', '/etc/passwd']) {
      const result = await bridge.callTool('project_list_paths', { path: outside });
      expect(result.isError).toBe(true);
    }

    for (const root of ['.', '/home/project']) {
      const result = await bridge.callTool('project_delete_path', { path: root, recursive: true });
      expect(result.isError).toBe(true);
    }
  });
});

describe('targeted project file edits', () => {
  const original = 'const styles = {\nbutton: blue\n};\n';

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
      'const styles = {\nbutton: green\n};\n',
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
      content: 'export const layout = "new";\n',
      replacementReason: 'The user requested replacing this entire starter page.',
    });
    expect(replaced.structuredContent).toMatchObject({ written: true, created: false, changed: true });
    expect(saveFileContent).toHaveBeenCalledExactlyOnceWith(
      '/home/project/src/App.tsx',
      'export const layout = "new";\n',
    );
  });

  it('patches with a read revision without reproducing the entire expected file', async () => {
    await prepare();

    const read = await bridge!.callTool('project_read_file', { path: 'src/App.tsx' });
    const revision = (read.structuredContent as { revision: string }).revision;
    expect(revision).toMatch(/^[a-f0-9]{64}$/);

    const result = await bridge!.callTool('project_patch_file', {
      path: 'src/App.tsx',
      expectedRevision: revision,
      oldText: 'button: blue',
      newText: 'button: green',
    });
    expect(result.isError).not.toBe(true);
    expect(saveFileContent).toHaveBeenCalledExactlyOnceWith(
      '/home/project/src/App.tsx',
      'const styles = {\nbutton: green\n};\n',
    );
  });

  it('uses the latest read revision when a patch omits expectedRevision', async () => {
    await prepare();

    await bridge!.callTool('project_read_file', { path: 'src/App.tsx' });

    const result = await bridge!.callTool('project_patch_file', {
      path: 'src/App.tsx',
      oldText: 'button: blue',
      newText: 'button: green',
    });

    expect(result.isError).not.toBe(true);
    expect(saveFileContent).toHaveBeenCalledExactlyOnceWith(
      '/home/project/src/App.tsx',
      'const styles = {\nbutton: green\n};\n',
    );
  });

  it('rejects a stale revision and a patch without any concurrency check', async () => {
    await prepare();

    const read = await bridge!.callTool('project_read_file', { path: 'src/App.tsx' });
    readFile.mockResolvedValue(new TextEncoder().encode(`${original}// user edit\n`));

    const stale = await bridge!.callTool('project_patch_file', {
      path: 'src/App.tsx',
      expectedRevision: (read.structuredContent as { revision: string }).revision,
      oldText: 'button: blue',
      newText: 'button: green',
    });
    expect(stale.isError).toBe(true);
    expect(stale.content).toEqual([{ type: 'text', text: expect.stringContaining('Read the file again') }]);

    const unchecked = await bridge!.callTool('project_patch_file', {
      path: 'src/App.tsx',
      oldText: 'button: blue',
      newText: 'button: green',
    });
    expect(unchecked.isError).toBe(true);
    expect(saveFileContent).not.toHaveBeenCalled();
  });

  it('rejects invalid patches and flattened source replacements before saving', async () => {
    await prepare();

    const patch = await bridge!.callTool('project_patch_file', {
      path: 'src/App.tsx',
      expectedContent: original,
      oldText: 'button: blue',
      newText: 'button: <',
    });
    const replacement = await bridge!.callTool('project_write_file', {
      path: 'src/App.tsx',
      replacementReason: 'Replace the starter with the requested page.',
      content:
        "import { ArrowRight } from 'lucide-react' function App() { return <main>Hello</main>; } export default App;",
    });

    for (const result of [patch, replacement]) {
      expect(result.isError).toBe(true);
      expect(result.content).toEqual([{ type: 'text', text: expect.stringContaining('File was not saved') }]);
    }
    expect(saveFileContent).not.toHaveBeenCalled();
    expect(workbenchStore.files.get()['/home/project/src/App.tsx']).toMatchObject({ content: original });
  });

  it('rejects malformed new source files before creating them', async () => {
    await prepare();
    readFile.mockRejectedValueOnce({ code: 'ENOENT' });

    const result = await bridge!.callTool('project_write_file', {
      path: 'src/Broken.tsx',
      content: 'export const Broken = () => <main>',
      overwrite: false,
    });
    expect(result.isError).toBe(true);
    expect(createFile).not.toHaveBeenCalled();
    expect(saveFileContent).not.toHaveBeenCalled();
  });
});
