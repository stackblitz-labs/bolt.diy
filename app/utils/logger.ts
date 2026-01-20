export type DebugLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'none';

/*
 * Chalk is a Node.js-only library - only load it on server side
 * This prevents it from being bundled in client code where node:tty doesn't exist
 */
let chalkInstance: any = null;
let chalkLoadAttempted = false;

function getChalk() {
  // Only use chalk on server-side (Node.js environment)
  if (typeof window !== 'undefined' || typeof process === 'undefined' || !process.versions?.node) {
    return null; // Client-side: no chalk
  }

  if (chalkLoadAttempted) {
    return chalkInstance; // Return cached result (could be null if failed)
  }

  chalkLoadAttempted = true;

  // Lazy load chalk only on server
  try {
    /*
     * Use a function that can be tree-shaken for client bundles
     * The require will only execute on server
     */
    const requireChalk = () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const chalkModule = require('chalk');
      return chalkModule.Chalk ? new chalkModule.Chalk({ level: 3 }) : null;
    };
    chalkInstance = requireChalk();
  } catch {
    // Chalk not available or failed to load - safe to ignore
    chalkInstance = null;
  }

  return chalkInstance;
}

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
    // Serialize objects to compact JSON for readable output
    const formatted = typeof current === 'object' && current !== null ? JSON.stringify(current) : current;

    if (acc.endsWith('\n')) {
      return acc + formatted;
    }

    if (!acc) {
      return String(formatted);
    }

    return `${acc} ${formatted}`;
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
  // Use chalk on server-side, plain text on client-side
  const chalk = getChalk();

  if (chalk) {
    try {
      return chalk.bgHex(bg)(chalk.hex(color)(text));
    } catch {
      // Fallback if chalk methods fail
      return text;
    }
  }

  // Client-side or chalk unavailable: return plain text
  return text;
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

/*
 * ============================================================================
 * Crawler Telemetry Helpers
 * ============================================================================
 */

/**
 * Source mix metrics for multi-source crawl telemetry
 */
export interface SourceMixMetrics {
  maps: number;
  website: number;
  social: number;
  total: number;
}

/**
 * Quota state telemetry
 */
export interface QuotaStateTelemetry {
  tenantId?: string;
  percentage: number;
  state: 'healthy' | 'warning' | 'exhausted';
  dailyConsumed: number;
  dailyLimit: number;
  timeToReset?: string; // Human-readable format like "2h 30m"
}

/**
 * Toast notification metrics for PCC UI
 */
export interface ToastMetrics {
  type: 'info' | 'warning' | 'error' | 'success';
  duration: number; // milliseconds displayed
  ctaClicked: boolean;
  dismissed: boolean;
  dismissMethod?: 'click' | 'escape' | 'timeout';
}

/**
 * Performance mark helpers for crawler operations
 */
export const CRAWLER_PERFORMANCE_MARKS = {
  /**
   * Mark the start of a crawler request
   */
  startRequest(correlationId: string): void {
    if (typeof performance !== 'undefined') {
      performance.mark(`crawler.request:start:${correlationId}`);
    }
  },

  /**
   * Mark the end of a crawler request and measure duration
   */
  endRequest(correlationId: string): number | null {
    if (typeof performance === 'undefined') {
      return null;
    }

    const endMark = `crawler.request:end:${correlationId}`;
    const startMark = `crawler.request:start:${correlationId}`;

    performance.mark(endMark);

    try {
      const measure = performance.measure(`crawler.request:${correlationId}`, startMark, endMark);

      // Clean up marks
      performance.clearMarks(startMark);
      performance.clearMarks(endMark);

      return measure.duration;
    } catch {
      return null;
    }
  },

  /**
   * Mark cache lookup operation
   */
  markCacheLookup(correlationId: string, hit: boolean): void {
    if (typeof performance !== 'undefined') {
      performance.mark(`crawler.cache:${hit ? 'hit' : 'miss'}:${correlationId}`);
    }
  },

  /**
   * Mark quota check operation
   */
  markQuotaCheck(correlationId: string, state: 'healthy' | 'warning' | 'exhausted'): void {
    if (typeof performance !== 'undefined') {
      performance.mark(`crawler.quota:${state}:${correlationId}`);
    }
  },
};

/**
 * Calculate source mix from sources array
 */
export function calculateSourceMix(sources: Array<{ type: 'maps' | 'website' | 'social' }>): SourceMixMetrics {
  const mix: SourceMixMetrics = {
    maps: 0,
    website: 0,
    social: 0,
    total: sources.length,
  };

  sources.forEach((source) => {
    mix[source.type]++;
  });

  return mix;
}

/**
 * Log crawler telemetry event
 */
export function logCrawlerTelemetry(
  event: string,
  data: Record<string, any>,
  level: Exclude<DebugLevel, 'none'> = 'info',
): void {
  const crawlerLogger = createScopedLogger('Crawler');
  const message = `[Telemetry] ${event}`;

  // Structured logging for telemetry
  const telemetryData = {
    timestamp: new Date().toISOString(),
    event,
    ...data,
  };

  crawlerLogger[level](message, JSON.stringify(telemetryData, null, 2));
}

/**
 * Log quota state change
 */
export function logQuotaStateChange(telemetry: QuotaStateTelemetry): void {
  const level: Exclude<DebugLevel, 'none'> =
    telemetry.state === 'exhausted' ? 'error' : telemetry.state === 'warning' ? 'warn' : 'info';

  logCrawlerTelemetry(
    'quota.state_change',
    {
      tenantId: telemetry.tenantId,
      state: telemetry.state,
      percentage: telemetry.percentage.toFixed(2),
      consumed: telemetry.dailyConsumed,
      limit: telemetry.dailyLimit,
      timeToReset: telemetry.timeToReset,
    },
    level,
  );
}

/**
 * Log source mix for a crawl operation
 */
export function logSourceMix(correlationId: string, mix: SourceMixMetrics): void {
  logCrawlerTelemetry('crawl.source_mix', {
    correlationId,
    maps: mix.maps,
    website: mix.website,
    social: mix.social,
    total: mix.total,
    distribution: {
      mapsPercent: mix.total > 0 ? ((mix.maps / mix.total) * 100).toFixed(1) : '0',
      websitePercent: mix.total > 0 ? ((mix.website / mix.total) * 100).toFixed(1) : '0',
      socialPercent: mix.total > 0 ? ((mix.social / mix.total) * 100).toFixed(1) : '0',
    },
  });
}

/**
 * Log toast interaction metrics
 */
export function logToastMetrics(toastId: string, metrics: ToastMetrics): void {
  logCrawlerTelemetry('pcc.toast_interaction', {
    toastId,
    type: metrics.type,
    durationMs: metrics.duration,
    ctaClicked: metrics.ctaClicked,
    dismissed: metrics.dismissed,
    dismissMethod: metrics.dismissMethod,
  });
}

/**
 * Log crawler performance metrics
 */
export function logCrawlerPerformance(
  correlationId: string,
  durationMs: number,
  cacheHit: boolean,
  sourcesCount: number,
): void {
  logCrawlerTelemetry('crawl.performance', {
    correlationId,
    durationMs: Math.round(durationMs),
    durationSec: (durationMs / 1000).toFixed(2),
    cacheHit,
    sourcesCount,
    avgSourceMs: sourcesCount > 0 ? Math.round(durationMs / sourcesCount) : 0,
  });
}

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
