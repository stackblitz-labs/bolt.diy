import type { WebContainer, WebContainerProcess } from '@webcontainer/api';
import { describe, expect, it, vi } from 'vitest';
import { BoltShell } from './shell';
import type { ITerminal } from '~/types/terminal';

describe('BoltShell.stop', () => {
  it('interrupts the server and waits for its exit before completing a reset', async () => {
    const shell = new BoltShell();
    const input = vi.fn();
    const abort = vi.fn();

    let finishCommand!: () => void;

    const executionPrms = new Promise<void>((resolve) => {
      finishCommand = resolve;
    });

    vi.spyOn(shell, 'terminal', 'get').mockReturnValue({ input } as unknown as ITerminal);
    shell.executionState.set({ sessionId: 'old-chat', active: true, executionPrms, abort });

    let stopped = false;

    const stopping = shell.stop().then(() => {
      stopped = true;
    });

    await Promise.resolve();
    expect(abort).toHaveBeenCalledOnce();
    expect(input).toHaveBeenCalledWith('\x03');
    expect(stopped).toBe(false);

    finishCommand();
    await stopping;
    expect(stopped).toBe(true);
  });

  it('returns immediately when there is no active command', async () => {
    const shell = new BoltShell();
    await expect(shell.stop()).resolves.toBeUndefined();
  });

  it('does not interrupt the incoming chat when the outgoing session has already changed', async () => {
    const shell = new BoltShell();
    const input = vi.fn();
    const abort = vi.fn();

    vi.spyOn(shell, 'terminal', 'get').mockReturnValue({ input } as unknown as ITerminal);
    shell.executionState.set({ sessionId: 'incoming-chat', active: true, abort });

    await shell.stop('outgoing-chat');

    expect(input).not.toHaveBeenCalled();
    expect(abort).not.toHaveBeenCalled();
  });
});

async function initializedShell(onInput: (data: string, output: ReadableStreamDefaultController<string>) => void) {
  const shell = new BoltShell();

  let output!: ReadableStreamDefaultController<string>;

  const commandStream = new ReadableStream<string>({
    start(controller) {
      output = controller;
      output.enqueue('\x1b]654;interactive\x07');
    },
  });

  const input = vi.fn((data: string) => onInput(data, output));
  const terminal = { input } as unknown as ITerminal;
  vi.spyOn(shell, 'newBoltShellProcess').mockResolvedValue({
    process: {} as WebContainerProcess,
    terminalStream: commandStream,
    commandStream,
    expoUrlStream: new ReadableStream<string>({ start: (controller) => controller.close() }),
  });
  await shell.init({} as WebContainer, terminal);

  return { shell, input, output };
}

describe('BoltShell command handoff', () => {
  it('stops a running dev server before installing dependencies when exit and prompt arrive together', async () => {
    let serverRunning = false;

    const abortServer = vi.fn();

    const { shell, input } = await initializedShell((data, output) => {
      if (data === '\x03') {
        output.enqueue(serverRunning ? '^C\x1b]654;exit=0:130\x07\x1b]654;prompt\x07' : '\x1b]654;prompt\x07');
        serverRunning = false;
      } else if (data === 'npm run dev\n') {
        serverRunning = true;
      } else if (data === 'npm install\n') {
        output.enqueue('installed\n\x1b]654;exit=1:0\x07\x1b]654;prompt\x07');
      }
    });

    const server = shell.executeCommand('server', 'npm run dev', abortServer);
    await vi.waitFor(() => expect(shell.executionState.get()?.active).toBe(true));

    const install = shell.executeCommand('install', 'npm install');

    await expect(install).resolves.toEqual({ output: 'installed', exitCode: 0 });
    await expect(server).resolves.toMatchObject({ exitCode: 130 });
    expect(abortServer).toHaveBeenCalledOnce();
    expect(input.mock.calls.filter(([command]) => command === 'npm run dev\n')).toHaveLength(1);
    expect(input.mock.calls.filter(([command]) => command === 'npm install\n')).toHaveLength(1);
  });

  it('recognizes split OSC markers and preserves a following prompt for the next command', async () => {
    const { shell } = await initializedShell((data, output) => {
      if (data === '\x03') {
        output.enqueue('\x1b]654;pro');
        output.enqueue('mpt\x07');
      } else {
        output.enqueue('build failed\n\x1b]654;start\x07\x1b]654;exit=0:');
        output.enqueue('7\x07\x1b]654;prompt\x07');
      }
    });

    await expect(shell.executeCommand('build', 'npm run build')).resolves.toEqual({
      output: 'build failed',
      exitCode: 7,
    });
    await expect(shell.waitTillOscCode('prompt')).resolves.toMatchObject({ output: '\x1b]654;prompt\x07' });
  });

  it('does not launch a cancelled action after waiting for the outgoing server to exit', async () => {
    const cancellation = new AbortController();

    let serverRunning = false;

    const { shell, input } = await initializedShell((data, output) => {
      if (data === '\x03') {
        if (serverRunning) {
          cancellation.abort();
          output.enqueue('\x1b]654;exit=0:130\x07\x1b]654;prompt\x07');
        } else {
          output.enqueue('\x1b]654;prompt\x07');
        }
      } else if (data === 'npm run dev\n') {
        serverRunning = true;
      }
    });

    const server = shell.executeCommand('outgoing', 'npm run dev');
    await vi.waitFor(() => expect(shell.executionState.get()?.active).toBe(true));

    await expect(
      shell.executeCommand('cancelled', 'npm install', undefined, cancellation.signal),
    ).resolves.toBeUndefined();
    await server;
    expect(input).not.toHaveBeenCalledWith('npm install\n');
  });
});
