import { memo, useEffect } from 'react';
import type { Terminal as XTerm } from '@xterm/xterm';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('TerminalManager');

interface TerminalManagerProps {
  terminal: XTerm | null;
  isActive: boolean;
  onReconnect?: () => void;
}

export const TerminalManager = memo(({ terminal, isActive }: TerminalManagerProps) => {
  // Simplified terminal manager - removed aggressive health checking that was causing issues

  // Basic terminal event handling - no aggressive monitoring
  useEffect(() => {
    if (!terminal) {
      return undefined;
    }

    const disposables: Array<{ dispose: () => void }> = [];

    // Set up paste handler via terminal's onKey
    const onPasteKeyDisposable = terminal.onKey((e) => {
      // Detect Ctrl+V or Cmd+V
      if ((e.domEvent.ctrlKey || e.domEvent.metaKey) && e.domEvent.key === 'v') {
        if (!isActive) {
          return;
        }

        // Read from clipboard if available
        if (navigator.clipboard && navigator.clipboard.readText) {
          navigator.clipboard
            .readText()
            .then((text) => {
              if (text && terminal) {
                terminal.paste(text);
              }
            })
            .catch((err) => {
              logger.warn('Failed to read clipboard:', err);
            });
        }
      }
    });

    disposables.push(onPasteKeyDisposable);

    return () => {
      disposables.forEach((d) => d.dispose());
    };
  }, [terminal, isActive]);

  // Auto-focus terminal when it becomes active
  useEffect(() => {
    if (isActive && terminal) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        terminal.focus();
      }, 100);
    }
  }, [isActive, terminal]);

  return null; // This is a utility component, no UI
});

TerminalManager.displayName = 'TerminalManager';
