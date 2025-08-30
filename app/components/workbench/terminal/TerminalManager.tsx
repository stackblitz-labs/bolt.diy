import { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { Terminal as XTerm } from '@xterm/xterm';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('TerminalManager');

interface TerminalManagerProps {
  terminal: XTerm | null;
  isActive: boolean;
  onReconnect?: () => void;
}

export const TerminalManager = memo(({ terminal, isActive, onReconnect }: TerminalManagerProps) => {
  const [isHealthy, setIsHealthy] = useState(true);
  const [lastActivity, setLastActivity] = useState(Date.now());
  const healthCheckIntervalRef = useRef<NodeJS.Timeout>();
  const reconnectAttemptsRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 3;
  const HEALTH_CHECK_INTERVAL = 5000; // 5 seconds
  const INACTIVITY_THRESHOLD = 30000; // 30 seconds

  // Monitor terminal health
  const checkTerminalHealth = useCallback(() => {
    if (!terminal || !isActive) {
      return;
    }

    try {
      // Check if terminal is still responsive
      const currentTime = Date.now();
      const inactivityDuration = currentTime - lastActivity;

      // If terminal has been inactive for too long, attempt recovery
      if (inactivityDuration > INACTIVITY_THRESHOLD) {
        logger.warn(`Terminal inactive for ${inactivityDuration}ms, attempting recovery`);
        handleTerminalRecovery();
      }

      // Test if terminal can write - check if terminal buffer exists
      try {
        // Try to access terminal buffer to check if it's still valid
        const buffer = terminal.buffer;

        if (!buffer || !buffer.active) {
          logger.error('Terminal buffer invalid');
          setIsHealthy(false);
          handleTerminalRecovery();
        }
      } catch {
        logger.error('Terminal buffer check failed');
        setIsHealthy(false);
        handleTerminalRecovery();
      }
    } catch (error) {
      logger.error('Terminal health check failed:', error);
      setIsHealthy(false);
      handleTerminalRecovery();
    }
  }, [terminal, isActive, lastActivity]);

  // Handle terminal recovery
  const handleTerminalRecovery = useCallback(() => {
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      logger.error('Max reconnection attempts reached');
      terminal?.write('\x1b[31m\n⚠️ Terminal connection lost. Please refresh the page.\n\x1b[0m');

      return;
    }

    reconnectAttemptsRef.current++;
    logger.info(`Attempting terminal recovery (attempt ${reconnectAttemptsRef.current})`);

    try {
      // Clear any stuck event listeners
      if (terminal) {
        // Force focus back to terminal
        terminal.focus();

        // Clear selection if any
        terminal.clearSelection();

        // Reset cursor position
        terminal.scrollToBottom();

        // Write recovery message
        terminal.write('\x1b[33m\n🔄 Reconnecting terminal...\n\x1b[0m');

        // Trigger reconnection callback
        onReconnect?.();

        // Reset health status
        setIsHealthy(true);
        setLastActivity(Date.now());
        reconnectAttemptsRef.current = 0;

        terminal.write('\x1b[32m✓ Terminal reconnected successfully\n\x1b[0m');
      }
    } catch (error) {
      logger.error('Terminal recovery failed:', error);
      setIsHealthy(false);
    }
  }, [terminal, onReconnect]);

  // Monitor terminal input/output
  useEffect(() => {
    if (!terminal) {
      return undefined;
    }

    const disposables: Array<{ dispose: () => void }> = [];

    // Track terminal activity
    const onDataDisposable = terminal.onData(() => {
      setLastActivity(Date.now());
      setIsHealthy(true);
      reconnectAttemptsRef.current = 0;
    });

    const onKeyDisposable = terminal.onKey(() => {
      setLastActivity(Date.now());
      setIsHealthy(true);
    });

    disposables.push(onDataDisposable);
    disposables.push(onKeyDisposable);

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
                setLastActivity(Date.now());
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
  }, [terminal, isActive, isHealthy, handleTerminalRecovery]);

  // Set up health check interval
  useEffect(() => {
    if (isActive) {
      healthCheckIntervalRef.current = setInterval(checkTerminalHealth, HEALTH_CHECK_INTERVAL);
    }

    return () => {
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
      }
    };
  }, [isActive, checkTerminalHealth]);

  // Auto-focus terminal when it becomes active
  useEffect(() => {
    if (isActive && terminal && isHealthy) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        terminal.focus();
      }, 100);
    }
  }, [isActive, terminal, isHealthy]);

  return null; // This is a utility component, no UI
});

TerminalManager.displayName = 'TerminalManager';
