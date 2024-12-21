import type { WebContainer, WebContainerProcess } from '@webcontainer/api';
import type { ITerminal } from '~/types/terminal';
import { withResolvers } from './promises';
import { atom } from 'nanostores';

export async function newShellProcess(webcontainer: WebContainer, terminal: ITerminal) {
  const args: string[] = [];

  // we spawn a JSH process with a fallback cols and rows in case the process is not attached yet to a visible terminal
  const process = await webcontainer.spawn('/bin/jsh', ['--osc', ...args], {
    terminal: {
      cols: terminal.cols ?? 80,
      rows: terminal.rows ?? 15,
    },
  });

  const input = process.input.getWriter();
  const output = process.output;

  const jshReady = withResolvers<void>();

  let isInteractive = false;
  output.pipeTo(
    new WritableStream({
      write(data) {
        if (!isInteractive) {
          const [, osc] = data.match(/\x1b\]654;([^\x07]+)\x07/) || [];

          if (osc === 'interactive') {
            // wait until we see the interactive OSC
            isInteractive = true;

            jshReady.resolve();
          }
        }

        terminal.write(data);
      },
    }),
  );

  terminal.onData((data) => {
    // console.log('terminal onData', { data, isInteractive });

    if (isInteractive) {
      input.write(data);
    }
  });

  await jshReady.promise;

  return process;
}

export type ExecutionResult = { output: string; exitCode: number } | undefined;

export class BoltShell {
  #initialized: (() => void) | undefined;
  #readyPromise: Promise<void>;
  #webcontainer: WebContainer | undefined;
  #terminal: ITerminal | undefined;
  #process: WebContainerProcess | undefined;
  executionState = atom<
    { sessionId: string; active: boolean; executionPrms?: Promise<any>; abort?: () => void } | undefined
  >();
  #outputStream: ReadableStreamDefaultReader<string> | undefined;
  #shellInputStream: WritableStreamDefaultWriter<string> | undefined;

  constructor() {
    this.#readyPromise = new Promise((resolve) => {
      this.#initialized = resolve;
    });
  }

  ready() {
    return this.#readyPromise;
  }

  async init(webcontainer: WebContainer, terminal: ITerminal) {
    this.#webcontainer = webcontainer;
    this.#terminal = terminal;

    const { process, output } = await this.newBoltShellProcess(webcontainer, terminal);
    this.#process = process;
    this.#outputStream = output.getReader();
    await this.waitTillOscCode('interactive');
    this.#initialized?.();
  }

  get terminal() {
    return this.#terminal;
  }

  get process() {
    return this.#process;
  }

  async executeCommand(sessionId: string, command: string, abort?: () => void): Promise<ExecutionResult> {
    if (!this.process || !this.terminal) {
      return undefined;
    }

    const state = this.executionState.get();

    if (state?.active && state.abort) {
      state.abort();
    }

    /*
     * interrupt the current execution
     *  this.#shellInputStream?.write('\x03');
     */
    this.terminal.input('\x03');
    await this.waitTillOscCode('prompt');

    if (state && state.executionPrms) {
      await state.executionPrms;
    }

    //start a new execution
    this.terminal.input(command.trim() + '\n');

    //wait for the execution to finish
    const executionPromise = this.getCurrentExecutionResult();
    this.executionState.set({ sessionId, active: true, executionPrms: executionPromise, abort });

    const resp = await executionPromise;
    this.executionState.set({ sessionId, active: false });

    if (resp) {
      try {
        resp.output = cleanTerminalOutput(resp.output);
      } catch (error) {
        console.log('failed to format terminal output', error);
      }
    }

    return resp;
  }

  async newBoltShellProcess(webcontainer: WebContainer, terminal: ITerminal) {
    const args: string[] = [];

    // we spawn a JSH process with a fallback cols and rows in case the process is not attached yet to a visible terminal
    const process = await webcontainer.spawn('/bin/jsh', ['--osc', ...args], {
      terminal: {
        cols: terminal.cols ?? 80,
        rows: terminal.rows ?? 15,
      },
    });

    const input = process.input.getWriter();
    this.#shellInputStream = input;

    const [internalOutput, terminalOutput] = process.output.tee();

    const jshReady = withResolvers<void>();

    let isInteractive = false;
    terminalOutput.pipeTo(
      new WritableStream({
        write(data) {
          if (!isInteractive) {
            const [, osc] = data.match(/\x1b\]654;([^\x07]+)\x07/) || [];

            if (osc === 'interactive') {
              // wait until we see the interactive OSC
              isInteractive = true;

              jshReady.resolve();
            }
          }

          terminal.write(data);
        },
      }),
    );

    terminal.onData((data) => {
      // console.log('terminal onData', { data, isInteractive });

      if (isInteractive) {
        input.write(data);
      }
    });

    await jshReady.promise;

    return { process, output: internalOutput };
  }

  async getCurrentExecutionResult(): Promise<ExecutionResult> {
    const { output, exitCode } = await this.waitTillOscCode('exit');
    return { output, exitCode };
  }

  async waitTillOscCode(waitCode: string) {
    let fullOutput = '';
    let exitCode: number = 0;

    if (!this.#outputStream) {
      return { output: fullOutput, exitCode };
    }

    const tappedStream = this.#outputStream;

    while (true) {
      const { value, done } = await tappedStream.read();

      if (done) {
        break;
      }

      const text = value || '';
      fullOutput += text;

      // Check if command completion signal with exit code
      const [, osc, , , code] = text.match(/\x1b\]654;([^\x07=]+)=?((-?\d+):(\d+))?\x07/) || [];

      if (osc === 'exit') {
        exitCode = parseInt(code, 10);
      }

      if (osc === waitCode) {
        break;
      }
    }

    return { output: fullOutput, exitCode };
  }
}

/**
 * Cleans and formats terminal output while preserving structure and paths
 */
export function cleanTerminalOutput(input: string): string {
  // Step 1: Remove ANSI escape sequences and control characters
  const removeAnsi = input.replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '');

  // Step 2: Remove terminal control sequences
  const removeControl = removeAnsi
    .replace(/\[\?[0-9;]*[a-zA-Z]/g, '')
    .replace(/\]654;[^\n]*/g, '')
    .replace(/\[[0-9]+[GJ]/g, '');

  // Step 3: Add newlines at key breakpoints while preserving paths
  const formatOutput = removeControl
    // Preserve prompt line
    .replace(/^([~\/][^\n❯]+)❯/m, '$1\n❯')
    // Add newline before command output indicators
    .replace(/(?<!^|\n)>/g, '\n>')
    // Add newline before error keywords without breaking paths
    .replace(/(?<!^|\n|\w)(error|failed|warning|Error|Failed|Warning):/g, '\n$1:')
    // Add newline before 'at' in stack traces without breaking paths
    .replace(/(?<!^|\n|\/)(at\s+(?!async|sync))/g, '\nat ')
    // Ensure 'at async' stays on same line
    .replace(/\bat\s+async/g, 'at async');

  // Step 4: Clean up whitespace while preserving intentional spacing
  const cleanSpaces = formatOutput
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0) // Remove empty lines
    .join('\n');

  // Step 5: Final cleanup
  return cleanSpaces
    .replace(/\n{3,}/g, '\n\n') // Replace multiple newlines with double newlines
    .replace(/:\s+/g, ': ') // Normalize spacing after colons
    .replace(/\s{2,}/g, ' ') // Remove multiple spaces
    .trim();
}

export function newBoltShellProcess() {
  return new BoltShell();
}
