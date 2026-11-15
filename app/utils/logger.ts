export type DebugLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'none';
import { Chalk } from 'chalk';

const chalk = new Chalk({ level: 3 });

type LoggerFunction = (...messages: any[]) => void;

interface Logger {
  trace: LoggerFunction;
  debug: LoggerFunction;
  info: LoggerFunction;
  warn: LoggerFunction;
  error: LoggerFunction;
  setLevel: (level: DebugLevel) => void;
}

let currentLevel: DebugLevel = import.meta.env.VITE_LOG_LEVEL || (import.meta.env.DEV ? 'debug' : 'info');

export const logger: Logger = {
  trace: (...messages: any[]) => logWithDebugCapture('trace', undefined, messages),
  debug: (...messages: any[]) => logWithDebugCapture('debug', undefined, messages),
  info: (...messages: any[]) => logWithDebugCapture('info', undefined, messages),
  warn: (...messages: any[]) => logWithDebugCapture('warn', undefined, messages),
  error: (...messages: any[]) => logWithDebugCapture('error', undefined, messages),
  setLevel,
};

export function createScopedLogger(scope: string): Logger {
  return {
    trace: (...messages: any[]) => logWithDebugCapture('trace', scope, messages),
    debug: (...messages: any[]) => logWithDebugCapture('debug', scope, messages),
    info: (...messages: any[]) => logWithDebugCapture('info', scope, messages),
    warn: (...messages: any[]) => logWithDebugCapture('warn', scope, messages),
    error: (...messages: any[]) => logWithDebugCapture('error', scope, messages),
    setLevel,
  };
}

function setLevel(level: DebugLevel) {
  if ((level === 'trace' || level === 'debug') && import.meta.env.PROD) {
    return;
  }

  currentLevel = level;
}

function log(level: DebugLevel, scope: string | undefined, messages: any[]) {
  const levelOrder: DebugLevel[] = ['trace', 'debug', 'info', 'warn', 'error', 'none'];

  if (levelOrder.indexOf(level) < levelOrder.indexOf(currentLevel)) {
    return;
  }

  // If current level is 'none', don't log anything
  if (currentLevel === 'none') {
    return;
  }

  const allMessages = messages.reduce((acc, current) => {
    if (acc.endsWith('\n')) {
      return acc + current;
    }

    if (!acc) {
      return current;
    }

    return `${acc} ${current}`;
  }, '');

  const labelBackgroundColor = getColorForLevel(level);
  const labelTextColor = level === 'warn' ? '#000000' : '#FFFFFF';

  const labelStyles = getLabelStyles(labelBackgroundColor, labelTextColor);
  const scopeStyles = getLabelStyles('#77828D', 'white');

  const styles = [labelStyles];

  if (typeof scope === 'string') {
    styles.push('', scopeStyles);
  }

  let labelText = formatText(` ${level.toUpperCase()} `, labelTextColor, labelBackgroundColor);

  if (scope) {
    labelText = `${labelText} ${formatText(` ${scope} `, '#FFFFFF', '77828D')}`;
  }

  if (typeof window !== 'undefined') {
    console.log(`%c${level.toUpperCase()}${scope ? `%c %c${scope}` : ''}`, ...styles, allMessages);
  } else {
    console.log(`${labelText}`, allMessages);
  }
}

function formatText(text: string, color: string, bg: string) {
  return chalk.bgHex(bg)(chalk.hex(color)(text));
}

function getLabelStyles(color: string, textColor: string) {
  return `background-color: ${color}; color: white; border: 4px solid ${color}; color: ${textColor};`;
}

function getColorForLevel(level: DebugLevel): string {
  switch (level) {
    case 'trace':
    case 'debug': {
      return '#77828D';
    }
    case 'info': {
      return '#1389FD';
    }
    case 'warn': {
      return '#FFDB6C';
    }
    case 'error': {
      return '#EE4744';
    }
    default: {
      return '#000000';
    }
  }
}

export const renderLogger = createScopedLogger('Render');

// Debug logging integration
let debugLogger: any = null;

// Lazy load debug logger to avoid circular dependencies
const getDebugLogger = () => {
  if (!debugLogger && typeof window !== 'undefined') {
    try {
      // Use dynamic import asynchronously but don't block the function
      import('./debugLogger')
        .then(({ debugLogger: loggerInstance }) => {
          debugLogger = loggerInstance;
        })
        .catch(() => {
          // Debug logger not available, skip integration
        });
    } catch {
      // Debug logger not available, skip integration
    }
  }

  return debugLogger;
};

// Override the log function to also capture to debug logger

function logWithDebugCapture(level: DebugLevel, scope: string | undefined, messages: any[]) {
  // Call original log function (the one that does the actual console logging)
  log(level, scope, messages);

  // Also capture to debug logger if available
  const debug = getDebugLogger();

  if (debug) {
    debug.captureLog(level, scope, messages);
  }
}
