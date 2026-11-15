import { useStore } from '@nanostores/react';
import type { Terminal } from '@xterm/xterm';
import { useState } from 'react';
import { addTerminalAttachment, lastTerminalCommand } from '~/lib/stores/terminalContext';

export function readTerminalScrollback(terminal: Terminal): string {
  const buffer = terminal.buffer.active;
  const lines: string[] = [];

  for (let index = 0; index < buffer.length; index++) {
    const line = buffer.getLine(index);

    if (!line) {
      continue;
    }

    const text = line.translateToString(true);

    if (line.isWrapped && lines.length) {
      lines[lines.length - 1] += text;
    } else {
      lines.push(text);
    }
  }

  while (lines.length && !lines[lines.length - 1]) {
    lines.pop();
  }

  return lines.join('\n');
}

export function TerminalContextPicker({
  terminal,
  label,
  isBolt,
}: {
  terminal: () => Terminal | undefined;
  label: string;
  isBolt: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [empty, setEmpty] = useState(false);
  const [lineCount, setLineCount] = useState(100);
  const lastCommand = useStore(lastTerminalCommand);

  const attach = (name: string, text: string) => {
    if (!text.trim()) {
      setEmpty(true);
      return;
    }

    addTerminalAttachment(`${label} · ${name}`, text);
    setEmpty(false);
    setOpen(false);
  };
  const commandText = lastCommand
    ? `$ ${lastCommand.command}\n${lastCommand.output}\nExit code: ${lastCommand.exitCode}`
    : '';

  return (
    <div className="relative">
      <button
        type="button"
        className="rounded px-2 py-1 text-xs text-bolt-elements-textPrimary hover:bg-bolt-elements-terminals-buttonBackground"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        Add to chat
      </button>
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 max-h-48 w-64 overflow-y-auto rounded border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-2 text-xs text-bolt-elements-textPrimary shadow-lg">
          <button
            type="button"
            className="block w-full p-1 text-left"
            onClick={() => attach('selection', terminal()?.getSelection() || '')}
          >
            Selected output
          </button>
          <div className="flex items-center gap-1 p-1">
            <button
              type="button"
              className="text-left"
              onClick={() =>
                attach(
                  `last ${lineCount} lines`,
                  readTerminalScrollback(terminal()!).split('\n').slice(-lineCount).join('\n'),
                )
              }
              disabled={!terminal()}
            >
              Last
            </button>
            <input
              aria-label="Number of terminal lines"
              type="number"
              min="1"
              max="1000"
              value={lineCount}
              className="w-16 rounded border border-bolt-elements-borderColor bg-transparent p-1"
              onChange={(event) => setLineCount(Math.max(1, Math.min(1000, Number(event.target.value) || 1)))}
            />
            <span>lines</span>
          </div>
          <button
            type="button"
            className="block w-full p-1 text-left"
            onClick={() => {
              const value = terminal();

              if (value) {
                attach('available scrollback', readTerminalScrollback(value));
              }
            }}
          >
            Available scrollback
          </button>
          {isBolt && lastCommand && (
            <button
              type="button"
              className="block w-full p-1 text-left"
              onClick={() => attach('last command', commandText)}
            >
              Last Bolt command
            </button>
          )}
          {isBolt && lastCommand && lastCommand.exitCode !== 0 && (
            <button
              type="button"
              className="block w-full p-1 text-left"
              onClick={() => attach('failed command', commandText)}
            >
              Add last error to chat
            </button>
          )}
          <p className="mt-1 text-bolt-elements-textSecondary">
            Review the redacted output before sending. Scrollback is limited.
          </p>
          {empty && <p role="status">No terminal output selected or available.</p>}
        </div>
      )}
    </div>
  );
}
