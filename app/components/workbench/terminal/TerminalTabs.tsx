import { useStore } from '@nanostores/react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import type { Terminal as XTerm } from '@xterm/xterm';
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Panel, type PanelImperativeHandle } from 'react-resizable-panels';
import { Terminal, type TerminalRef } from './Terminal';
import { TerminalManager } from './TerminalManager';
import { IconButton } from '~/components/ui/IconButton';
import {
  addTerminalContext,
  terminalCommandHistory,
  type TerminalCommandRecord,
  type TerminalContextKind,
} from '~/lib/stores/terminalContext';
import { themeStore } from '~/lib/stores/theme';
import { workbenchStore } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('Terminal');

const MAX_TERMINALS = 3;
export const DEFAULT_TERMINAL_SIZE = 25;

const MINIMIZED_TERMINAL_SIZE = '34px';
const MINIMIZED_TERMINAL_HEIGHT = 34;

export const TerminalTabs = memo(() => {
  const showTerminal = useStore(workbenchStore.showTerminal);
  const theme = useStore(themeStore);
  const commandHistory = useStore(terminalCommandHistory);

  const terminalRefs = useRef<Map<number, TerminalRef>>(new Map());
  const terminalPanelRef = useRef<PanelImperativeHandle>(null);

  const [activeTerminal, setActiveTerminal] = useState(0);
  const [terminalCount, setTerminalCount] = useState(0);
  const [isMinimized, setIsMinimized] = useState(!showTerminal);

  const addTerminal = () => {
    if (terminalCount < MAX_TERMINALS) {
      setTerminalCount(terminalCount + 1);
      setActiveTerminal(terminalCount);
    }
  };

  const closeTerminal = useCallback(
    (index: number) => {
      if (index === 0) {
        return;
      } // Can't close bolt terminal

      const terminalRef = terminalRefs.current.get(index);

      if (terminalRef?.getTerminal) {
        const terminal = terminalRef.getTerminal();

        if (terminal) {
          workbenchStore.detachTerminal(terminal);
        }
      }

      // Remove the terminal from refs
      terminalRefs.current.delete(index);

      // Adjust terminal count and active terminal
      setTerminalCount(terminalCount - 1);

      if (activeTerminal === index) {
        setActiveTerminal(Math.max(0, index - 1));
      } else if (activeTerminal > index) {
        setActiveTerminal(activeTerminal - 1);
      }
    },
    [activeTerminal, terminalCount],
  );

  useEffect(() => {
    return () => {
      terminalRefs.current.forEach((ref, index) => {
        if (index > 0 && ref?.getTerminal) {
          const terminal = ref.getTerminal();

          if (terminal) {
            workbenchStore.detachTerminal(terminal);
          }
        }
      });
    };
  }, []);

  useEffect(() => {
    const { current: terminal } = terminalPanelRef;

    if (!terminal) {
      return;
    }

    const terminalSize = terminal.getSize().inPixels;

    if (!showTerminal && terminalSize > MINIMIZED_TERMINAL_HEIGHT) {
      terminal.resize(MINIMIZED_TERMINAL_SIZE);
    } else if (showTerminal && terminalSize <= MINIMIZED_TERMINAL_HEIGHT) {
      terminal.resize(`${DEFAULT_TERMINAL_SIZE}%`);
    }
  }, [showTerminal]);

  useEffect(() => {
    const unsubscribeFromThemeStore = themeStore.subscribe(() => {
      terminalRefs.current.forEach((ref) => {
        ref?.reloadStyles();
      });
    });

    return () => {
      unsubscribeFromThemeStore();
    };
  }, []);

  return (
    <Panel
      panelRef={terminalPanelRef}
      defaultSize={showTerminal ? DEFAULT_TERMINAL_SIZE : MINIMIZED_TERMINAL_SIZE}
      minSize={MINIMIZED_TERMINAL_SIZE}
      onResize={(size) => {
        const minimized = size.inPixels <= MINIMIZED_TERMINAL_HEIGHT + 1;
        setIsMinimized(minimized);

        if (workbenchStore.showTerminal.get() !== !minimized) {
          workbenchStore.toggleTerminal(!minimized);
        }
      }}
    >
      {isMinimized && (
        <div className="h-full min-h-[34px] flex items-center justify-end bg-bolt-elements-background-depth-2 border-t border-bolt-elements-borderColor px-2">
          <button
            type="button"
            className="flex items-center gap-2 px-3 py-1 rounded-md bg-transparent text-sm text-bolt-elements-textPrimary hover:bg-bolt-elements-terminals-buttonBackground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bolt-elements-focus"
            title="Expand terminal"
            onClick={() => {
              terminalPanelRef.current?.resize(`${DEFAULT_TERMINAL_SIZE}%`);
              workbenchStore.toggleTerminal(true);
            }}
          >
            <div className="i-ph:terminal-window-duotone text-lg" />
            <span>Terminal</span>
            <div className="i-ph:caret-up text-sm" />
          </button>
        </div>
      )}
      <div className={classNames('h-full', { hidden: isMinimized })}>
        <div className="bg-bolt-elements-terminals-background h-full flex flex-col">
          <div className="flex items-center bg-bolt-elements-background-depth-2 border-y border-bolt-elements-borderColor gap-1.5 min-h-[34px] p-2">
            {Array.from({ length: terminalCount + 1 }, (_, index) => {
              const isActive = activeTerminal === index;
              const terminalName = index === 0 ? 'Bolt Terminal' : `Terminal ${index}`;

              return (
                <React.Fragment key={index}>
                  {index == 0 ? (
                    <div className="flex items-center gap-1">
                      <button
                        key={index}
                        className={classNames(
                          'flex items-center text-sm cursor-pointer gap-1.5 px-3 py-2 h-full whitespace-nowrap rounded-full',
                          {
                            'bg-bolt-elements-terminals-buttonBackground text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary':
                              isActive,
                            'bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary hover:bg-bolt-elements-terminals-buttonBackground':
                              !isActive,
                          },
                        )}
                        onClick={() => setActiveTerminal(index)}
                      >
                        <div className="i-ph:terminal-window-duotone text-lg" />
                        Bolt Terminal
                      </button>
                      <TerminalContextMenu
                        terminalName={terminalName}
                        getTerminal={() => terminalRefs.current.get(index)?.getTerminal()}
                        commands={commandHistory}
                      />
                    </div>
                  ) : (
                    <React.Fragment>
                      <div className="flex items-center gap-1">
                        <button
                          key={index}
                          className={classNames(
                            'flex items-center text-sm cursor-pointer gap-1.5 px-3 py-2 h-full whitespace-nowrap rounded-full',
                            {
                              'bg-bolt-elements-terminals-buttonBackground text-bolt-elements-textPrimary': isActive,
                              'bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary hover:bg-bolt-elements-terminals-buttonBackground':
                                !isActive,
                            },
                          )}
                          onClick={() => setActiveTerminal(index)}
                        >
                          <div className="i-ph:terminal-window-duotone text-lg" />
                          {terminalName}
                        </button>
                        <TerminalContextMenu
                          terminalName={terminalName}
                          getTerminal={() => terminalRefs.current.get(index)?.getTerminal()}
                          commands={commandHistory.filter((command) => command.terminalName === terminalName)}
                        />
                        <button
                          type="button"
                          title="Close terminal"
                          className="rounded p-1 text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary"
                          onClick={() => closeTerminal(index)}
                        >
                          <div className="i-ph:x text-xs" />
                        </button>
                      </div>
                    </React.Fragment>
                  )}
                </React.Fragment>
              );
            })}
            {terminalCount < MAX_TERMINALS && <IconButton icon="i-ph:plus" size="md" onClick={addTerminal} />}
            <IconButton
              icon="i-ph:arrow-clockwise"
              title="Reset Terminal"
              size="md"
              onClick={() => {
                const ref = terminalRefs.current.get(activeTerminal);

                if (ref?.getTerminal()) {
                  const terminal = ref.getTerminal()!;
                  terminal.clear();
                  terminal.focus();

                  if (activeTerminal === 0) {
                    workbenchStore.attachBoltTerminal(terminal);
                  } else {
                    workbenchStore.attachTerminal(terminal, `Terminal ${activeTerminal}`);
                  }
                }
              }}
            />
            <IconButton
              className="ml-auto"
              icon="i-ph:minus"
              title="Minimize terminal"
              size="md"
              onClick={() => {
                terminalPanelRef.current?.resize(MINIMIZED_TERMINAL_SIZE);
                workbenchStore.toggleTerminal(false);
              }}
            />
          </div>
          {Array.from({ length: terminalCount + 1 }, (_, index) => {
            const isActive = activeTerminal === index;

            logger.debug(`Starting bolt terminal [${index}]`);

            if (index == 0) {
              return (
                <React.Fragment key={`terminal-container-${index}`}>
                  <Terminal
                    key={`terminal-${index}`}
                    id={`terminal_${index}`}
                    className={classNames('h-full overflow-hidden modern-scrollbar-invert', {
                      hidden: !isActive,
                    })}
                    ref={(ref) => {
                      if (ref) {
                        terminalRefs.current.set(index, ref);
                      }
                    }}
                    onTerminalReady={(terminal) => workbenchStore.attachBoltTerminal(terminal)}
                    onTerminalResize={(cols, rows) => workbenchStore.onTerminalResize(cols, rows)}
                    theme={theme}
                  />
                  <TerminalManager
                    terminal={terminalRefs.current.get(index)?.getTerminal() || null}
                    isActive={isActive}
                  />
                </React.Fragment>
              );
            } else {
              return (
                <React.Fragment key={`terminal-container-${index}`}>
                  <Terminal
                    key={`terminal-${index}`}
                    id={`terminal_${index}`}
                    className={classNames('modern-scrollbar h-full overflow-hidden', {
                      hidden: !isActive,
                    })}
                    ref={(ref) => {
                      if (ref) {
                        terminalRefs.current.set(index, ref);
                      }
                    }}
                    onTerminalReady={(terminal) => workbenchStore.attachTerminal(terminal, `Terminal ${index}`)}
                    onTerminalResize={(cols, rows) => workbenchStore.onTerminalResize(cols, rows)}
                    theme={theme}
                  />
                  <TerminalManager
                    terminal={terminalRefs.current.get(index)?.getTerminal() || null}
                    isActive={isActive}
                  />
                </React.Fragment>
              );
            }
          })}
        </div>
      </div>
    </Panel>
  );
});

function TerminalContextMenu({
  terminalName,
  getTerminal,
  commands,
}: {
  terminalName: string;
  getTerminal: () => XTerm | undefined;
  commands: TerminalCommandRecord[];
}) {
  const attachBuffer = (kind: Extract<TerminalContextKind, 'last-lines' | 'session' | 'selection'>) => {
    const terminal = getTerminal();

    if (!terminal) {
      return;
    }

    let text = '';

    if (kind === 'selection') {
      text = terminal.getSelection();
    } else {
      const buffer = terminal.buffer.active;

      const lines = Array.from(
        { length: buffer.length },
        (_, index) => buffer.getLine(index)?.translateToString(true) ?? '',
      );
      text = (kind === 'last-lines' ? lines.slice(-100) : lines).join('\n');
    }

    addTerminalContext({ terminalName, kind, text });
  };

  const attachCommand = (command: (typeof commands)[number], isError = false) => {
    addTerminalContext({
      terminalName: command.terminalName,
      kind: isError ? 'error' : 'command',
      command: command.command,
      exitCode: command.exitCode,
      text: command.output,
    });
  };

  const failedCommand = commands[0]?.exitCode !== 0 ? commands[0] : undefined;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          title="Add terminal output to chat"
          aria-label={`Add ${terminalName} output to chat`}
          className="rounded-md p-1.5 text-bolt-elements-textTertiary hover:bg-bolt-elements-item-backgroundActive hover:text-bolt-elements-textPrimary"
        >
          <span className="i-ph:paperclip text-base" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={5}
          className="z-50 max-h-[70vh] min-w-[220px] overflow-y-auto rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-1 shadow-lg"
        >
          {failedCommand && (
            <DropdownMenu.Item
              className="cursor-pointer rounded-md px-3 py-2 text-sm text-red-400 outline-none hover:bg-bolt-elements-item-backgroundActive focus:bg-bolt-elements-item-backgroundActive"
              onSelect={() => attachCommand(failedCommand, true)}
            >
              <span className="i-ph:warning-circle mr-2 inline-block" />
              Send error to chat
            </DropdownMenu.Item>
          )}
          <ContextMenuItem onSelect={() => attachBuffer('last-lines')}>Attach last 100 lines</ContextMenuItem>
          <ContextMenuItem onSelect={() => attachBuffer('session')}>Attach whole session</ContextMenuItem>
          <DropdownMenu.Item
            className="cursor-pointer rounded-md px-3 py-2 text-sm text-bolt-elements-textPrimary outline-none hover:bg-bolt-elements-item-backgroundActive focus:bg-bolt-elements-item-backgroundActive"
            onSelect={() => attachBuffer('selection')}
          >
            Attach selected output
          </DropdownMenu.Item>
          {commands.length > 0 && (
            <>
              <DropdownMenu.Separator className="my-1 h-px bg-bolt-elements-borderColor" />
              <div className="px-3 py-1 text-xs text-bolt-elements-textTertiary">Recent Bolt commands</div>
              {commands.slice(0, 10).map((command) => (
                <DropdownMenu.Item
                  key={command.id}
                  className="cursor-pointer rounded-md px-3 py-2 text-sm text-bolt-elements-textPrimary outline-none hover:bg-bolt-elements-item-backgroundActive focus:bg-bolt-elements-item-backgroundActive"
                  onSelect={() => attachCommand(command)}
                >
                  <span
                    className={
                      command.exitCode === 0
                        ? 'i-ph:terminal mr-2 inline-block'
                        : 'i-ph:warning mr-2 inline-block text-red-400'
                    }
                  />
                  <span className="inline-block max-w-[240px] truncate align-bottom">
                    {command.command} {command.exitCode === 0 ? '' : `(exit ${command.exitCode})`}
                  </span>
                </DropdownMenu.Item>
              ))}
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function ContextMenuItem({ children, onSelect }: { children: React.ReactNode; onSelect: () => void }) {
  return (
    <DropdownMenu.Item
      className="cursor-pointer rounded-md px-3 py-2 text-sm text-bolt-elements-textPrimary outline-none hover:bg-bolt-elements-item-backgroundActive focus:bg-bolt-elements-item-backgroundActive"
      onSelect={onSelect}
    >
      {children}
    </DropdownMenu.Item>
  );
}
