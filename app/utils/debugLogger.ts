import { isMac, isWindows, isLinux } from './os';
import { isMobile } from './mobile';
import { PROVIDER_LIST, DEFAULT_MODEL } from './constants';
import { logger } from './logger';

// Lazy import to avoid circular dependencies
let logStore: any = null;
const getLogStore = () => {
  if (!logStore && typeof window !== 'undefined') {
    try {
      // Import and set the logStore on first access
      import('~/lib/stores/logs')
        .then(({ logStore: store }) => {
          logStore = store;
        })
        .catch(() => {
          // Ignore import errors
        });
    } catch {
      // Ignore errors
    }
  }

  return logStore;
};

// Configuration interface for debug logger
export interface DebugLoggerConfig {
  enabled: boolean;
  maxEntries: number;
  captureConsole: boolean;
  captureNetwork: boolean;
  captureErrors: boolean;
  debounceTerminal: number; // ms
}

// Circular buffer implementation for memory efficiency
class CircularBuffer<T> {
  private _buffer: (T | undefined)[];
  private _head = 0;
  private _tail = 0;
  private _size = 0;

  constructor(private _capacity: number) {
    this._buffer = new Array(_capacity);
  }

  push(item: T): void {
    this._buffer[this._tail] = item;
    this._tail = (this._tail + 1) % this._capacity;

    if (this._size < this._capacity) {
      this._size++;
    } else {
      this._head = (this._head + 1) % this._capacity;
    }
  }

  toArray(): T[] {
    const result: T[] = [];
    let current = this._head;

    for (let i = 0; i < this._size; i++) {
      const item = this._buffer[current];

      if (item !== undefined) {
        result.push(item);
      }

      current = (current + 1) % this._capacity;
    }

    return result;
  }

  clear(): void {
    this._buffer = new Array(this._capacity);
    this._head = 0;
    this._tail = 0;
    this._size = 0;
  }

  getSize(): number {
    return this._size;
  }
}

export interface DebugLogData {
  timestamp: string;
  sessionId: string;
  systemInfo: SystemInfo;
  appInfo: AppInfo;
  logs: LogEntry[];
  errors: ErrorEntry[];
  networkRequests: NetworkEntry[];
  performance: PerformanceEntry;
  state: StateEntry;
  userActions: UserActionEntry[];
  terminalLogs: TerminalEntry[];
}

export interface SystemInfo {
  platform: string;
  userAgent: string;
  screenResolution: string;
  viewportSize: string;
  isMobile: boolean;
  timezone: string;
  language: string;
  cookiesEnabled: boolean;
  localStorageEnabled: boolean;
  sessionStorageEnabled: boolean;
}

export interface AppInfo {
  version: string;
  buildTime: string;
  currentModel: string;
  currentProvider: string;
  projectType: string;
  workbenchView: string;
  hasActivePreview: boolean;
  unsavedFiles: number;
  workbenchState?: {
    currentView: string;
    showWorkbench: boolean;
    showTerminal: boolean;
    artifactsCount: number;
    filesCount: number;
    unsavedFiles: number;
    hasActivePreview: boolean;
  };
  gitInfo?: {
    branch: string;
    commit: string;
    isDirty: boolean;
    remoteUrl?: string;
    lastCommit?: {
      message: string;
      date: string;
      author: string;
    };
  };
}

export interface LogEntry {
  timestamp: string;
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  scope?: string;
  message: string;
  data?: any;
}

export interface ErrorEntry {
  timestamp: string;
  type: 'javascript' | 'react' | 'terminal' | 'network' | 'unknown';
  message: string;
  stack?: string;
  url?: string;
  line?: number;
  column?: number;
  userAgent?: string;
  context?: any;
}

export interface NetworkEntry {
  timestamp: string;
  method: string;
  url: string;
  status?: number;
  duration?: number;
  requestSize?: number;
  responseSize?: number;
  error?: string;
}

export interface PerformanceEntry {
  navigationStart: number;
  loadTime: number;
  domContentLoaded: number;
  firstPaint?: number;
  firstContentfulPaint?: number;
  memoryUsage?: {
    used: number;
    total: number;
    limit: number;
  };
  timing: any; // Using any instead of deprecated PerformanceTiming
}

export interface StateEntry {
  currentView: string;
  showWorkbench: boolean;
  showTerminal: boolean;
  artifactsCount: number;
  filesCount: number;
  alerts: Array<{
    type: string;
    title: string;
    source?: string;
  }>;
}

export interface UserActionEntry {
  timestamp: string;
  action: string;
  target?: string;
  data?: any;
}

export interface TerminalEntry {
  timestamp: string;
  type: 'input' | 'output' | 'error';
  content: string;
  command?: string;
}

class DebugLogger {
  private _logs: CircularBuffer<LogEntry>;
  private _errors: CircularBuffer<ErrorEntry>;
  private _networkRequests: CircularBuffer<NetworkEntry>;
  private _userActions: CircularBuffer<UserActionEntry>;
  private _terminalLogs: CircularBuffer<TerminalEntry>;
  private _config: DebugLoggerConfig;
  private _isCapturing = false;
  private _isInitialized = false;

  // Store original functions
  private _originalConsoleLog: typeof console.log;
  private _originalConsoleError: typeof console.error;
  private _originalConsoleWarn: typeof console.warn;
  private _originalFetch: typeof window.fetch | null = null;

  // Store bound event handlers for proper cleanup
  private _boundErrorHandler: (event: ErrorEvent) => void;
  private _boundRejectionHandler: (event: PromiseRejectionEvent) => void;
  private _boundUnloadHandler: () => void;

  // Debouncing for terminal logs
  private _terminalLogQueue: TerminalEntry[] = [];
  private _terminalLogTimer: NodeJS.Timeout | null = null;

  // Helper for JSON replacer with seen tracking
  private _seenObjects = new WeakSet();

  constructor(config: Partial<DebugLoggerConfig> = {}) {
    // Default configuration
    this._config = {
      enabled: false, // Start disabled for performance
      maxEntries: 1000,
      captureConsole: true,
      captureNetwork: true,
      captureErrors: true,
      debounceTerminal: 100,
      ...config,
    };

    // Initialize circular buffers
    this._logs = new CircularBuffer<LogEntry>(this._config.maxEntries);
    this._errors = new CircularBuffer<ErrorEntry>(this._config.maxEntries);
    this._networkRequests = new CircularBuffer<NetworkEntry>(this._config.maxEntries);
    this._userActions = new CircularBuffer<UserActionEntry>(this._config.maxEntries);
    this._terminalLogs = new CircularBuffer<TerminalEntry>(this._config.maxEntries);

    // Store original functions
    this._originalConsoleLog = console.log;
    this._originalConsoleError = console.error;
    this._originalConsoleWarn = console.warn;

    // Bind event handlers once to prevent memory leaks
    this._boundErrorHandler = this._handleError.bind(this);
    this._boundRejectionHandler = this._handleUnhandledRejection.bind(this);
    this._boundUnloadHandler = this._cleanup.bind(this);

    // Setup cleanup on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this._boundUnloadHandler);
    }
  }

  // Initialize the debug logger (lazy initialization for performance)
  initialize(): void {
    if (this._isInitialized) {
      return;
    }

    try {
      // Only initialize if we're in a browser environment
      if (typeof window === 'undefined') {
        return;
      }

      this._isInitialized = true;

      // Start capturing if enabled
      if (this._config.enabled) {
        this.startCapture();
      }

      logger.info('Debug logger initialized');
    } catch (error) {
      logger.error('Failed to initialize debug logger:', error);
    }
  }

  startCapture(): void {
    if (this._isCapturing) {
      return;
    }

    try {
      this._isCapturing = true;
      this._config.enabled = true;

      if (this._config.captureConsole) {
        this._interceptConsole();
      }

      if (this._config.captureErrors) {
        this._interceptErrors();
      }

      if (this._config.captureNetwork) {
        this._interceptNetwork();
      }

      logger.info('Debug logging started');
    } catch (error) {
      logger.error('Failed to start debug capture:', error);
      this._isCapturing = false;
    }
  }

  stopCapture(): void {
    if (!this._isCapturing) {
      return;
    }

    try {
      this._isCapturing = false;
      this._config.enabled = false;

      this._restoreConsole();
      this._restoreErrors();
      this._restoreNetwork();

      // Clear terminal log timer
      if (this._terminalLogTimer) {
        clearTimeout(this._terminalLogTimer);
        this._terminalLogTimer = null;
        this._flushTerminalLogs();
      }

      logger.info('Debug logging stopped');
    } catch (error) {
      logger.error('Failed to stop debug capture:', error);
    }
  }

  // Public method to enable debug logging on demand
  enableDebugMode(): void {
    this._config.enabled = true;

    if (!this._isInitialized) {
      this.initialize();
    } else if (!this._isCapturing) {
      this.startCapture();
    }
  }

  // Public method to disable debug logging
  disableDebugMode(): void {
    this.stopCapture();
  }

  // Get current status
  getStatus(): { initialized: boolean; capturing: boolean; enabled: boolean } {
    return {
      initialized: this._isInitialized,
      capturing: this._isCapturing,
      enabled: this._config.enabled,
    };
  }

  // Update configuration
  updateConfig(newConfig: Partial<DebugLoggerConfig>): void {
    const wasCapturing = this._isCapturing;

    if (wasCapturing) {
      this.stopCapture();
    }

    this._config = { ...this._config, ...newConfig };

    // Recreate buffers if maxEntries changed
    if (newConfig.maxEntries && newConfig.maxEntries !== this._config.maxEntries) {
      const oldLogs = this._logs.toArray();
      const oldErrors = this._errors.toArray();
      const oldNetworkRequests = this._networkRequests.toArray();
      const oldUserActions = this._userActions.toArray();
      const oldTerminalLogs = this._terminalLogs.toArray();

      this._logs = new CircularBuffer<LogEntry>(this._config.maxEntries);
      this._errors = new CircularBuffer<ErrorEntry>(this._config.maxEntries);
      this._networkRequests = new CircularBuffer<NetworkEntry>(this._config.maxEntries);
      this._userActions = new CircularBuffer<UserActionEntry>(this._config.maxEntries);
      this._terminalLogs = new CircularBuffer<TerminalEntry>(this._config.maxEntries);

      // Re-add existing data
      oldLogs.forEach((log) => this._logs.push(log));
      oldErrors.forEach((error) => this._errors.push(error));
      oldNetworkRequests.forEach((request) => this._networkRequests.push(request));
      oldUserActions.forEach((action) => this._userActions.push(action));
      oldTerminalLogs.forEach((log) => this._terminalLogs.push(log));
    }

    if (wasCapturing && this._config.enabled) {
      this.startCapture();
    }
  }

  // Cleanup method
  private _cleanup(): void {
    this.stopCapture();

    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this._boundUnloadHandler);
    }
  }

  private _interceptConsole(): void {
    const self = this;

    console.log = function (...args: any[]) {
      self.captureLog('info', undefined, args);
      self._originalConsoleLog.apply(console, args);
    };

    console.error = function (...args: any[]) {
      self.captureLog('error', undefined, args);
      self._originalConsoleError.apply(console, args);
    };

    console.warn = function (...args: any[]) {
      self.captureLog('warn', undefined, args);
      self._originalConsoleWarn.apply(console, args);
    };
  }

  private _restoreConsole(): void {
    console.log = this._originalConsoleLog;
    console.error = this._originalConsoleError;
    console.warn = this._originalConsoleWarn;
  }

  private _interceptErrors(): void {
    try {
      window.addEventListener('error', this._boundErrorHandler);
      window.addEventListener('unhandledrejection', this._boundRejectionHandler);
    } catch (error) {
      logger.error('Failed to intercept errors:', error);
    }
  }

  private _restoreErrors(): void {
    try {
      window.removeEventListener('error', this._boundErrorHandler);
      window.removeEventListener('unhandledrejection', this._boundRejectionHandler);
    } catch (error) {
      logger.error('Failed to restore error handlers:', error);
    }
  }

  private _interceptNetwork(): void {
    try {
      // Store original fetch if not already stored
      if (!this._originalFetch && typeof window !== 'undefined') {
        this._originalFetch = window.fetch;
      }

      if (!this._originalFetch) {
        return;
      }

      const originalFetch = this._originalFetch;
      const self = this;

      window.fetch = async function (...args: Parameters<typeof fetch>) {
        // Quick path for non-capturing mode
        if (!self._isCapturing) {
          return originalFetch.apply(this, args);
        }

        const startTime = performance.now();
        const [resource, config] = args;

        try {
          const response = await originalFetch.apply(this, args);
          const duration = Math.round(performance.now() - startTime);

          // Only capture if still capturing (could have changed during request)
          if (self._isCapturing) {
            self.captureNetworkRequest({
              timestamp: new Date().toISOString(),
              method: config?.method || 'GET',
              url: typeof resource === 'string' ? resource : (resource as Request).url,
              status: response.status,
              duration,
            });
          }

          return response;
        } catch (error) {
          const duration = Math.round(performance.now() - startTime);

          if (self._isCapturing) {
            self.captureNetworkRequest({
              timestamp: new Date().toISOString(),
              method: config?.method || 'GET',
              url: typeof resource === 'string' ? resource : (resource as Request).url,
              duration,
              error: error instanceof Error ? error.message : 'Network error',
            });
          }

          throw error;
        }
      };
    } catch (error) {
      logger.error('Failed to intercept network requests:', error);
    }
  }

  private _restoreNetwork(): void {
    try {
      if (this._originalFetch && typeof window !== 'undefined') {
        window.fetch = this._originalFetch;
      }
    } catch (error) {
      logger.error('Failed to restore network fetch:', error);
    }
  }

  private _handleError(event: ErrorEvent): void {
    this.captureError({
      timestamp: new Date().toISOString(),
      type: 'javascript',
      message: event.message,
      stack: event.error?.stack,
      url: event.filename,
      line: event.lineno,
      column: event.colno,
      userAgent: navigator.userAgent,
    });
  }

  private _handleUnhandledRejection(event: PromiseRejectionEvent): void {
    this.captureError({
      timestamp: new Date().toISOString(),
      type: 'javascript',
      message: event.reason?.message || 'Unhandled promise rejection',
      stack: event.reason?.stack,
      userAgent: navigator.userAgent,
    });
  }

  captureLog(level: LogEntry['level'], scope?: string, args: any[] = []): void {
    if (!this._isCapturing) {
      return;
    }

    try {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level,
        scope,

        /* Lazy stringification - only convert to string when needed */
        message: this._formatMessage(args),
        data: args.length === 1 && typeof args[0] === 'object' ? args[0] : undefined,
      };

      this._logs.push(entry);
    } catch (error) {
      // Fallback - don't let logging errors break the app
      console.error('Debug logger failed to capture log:', error);
    }
  }

  private _formatMessage(args: any[]): string {
    this._seenObjects = new WeakSet(); // Reset for each message

    return args
      .map((arg) => {
        if (typeof arg === 'object' && arg !== null) {
          try {
            // Prevent circular reference errors and limit depth
            return JSON.stringify(arg, this._jsonReplacer.bind(this), 2);
          } catch {
            return '[Object]';
          }
        }

        return String(arg);
      })
      .join(' ');
  }

  private _jsonReplacer(_key: string, value: any): any {
    // Prevent circular references and limit object depth
    if (typeof value === 'object' && value !== null) {
      if (this._seenObjects.has(value)) {
        return '[Circular]';
      }

      this._seenObjects.add(value);
    }

    return value;
  }

  captureError(error: ErrorEntry): void {
    try {
      this._errors.push(error);
    } catch (err) {
      console.error('Debug logger failed to capture error:', err);
    }
  }

  captureNetworkRequest(request: NetworkEntry): void {
    try {
      this._networkRequests.push(request);
    } catch (error) {
      console.error('Debug logger failed to capture network request:', error);
    }
  }

  captureUserAction(action: string, target?: string, data?: any): void {
    if (!this._isCapturing) {
      return;
    }

    try {
      const entry: UserActionEntry = {
        timestamp: new Date().toISOString(),
        action,
        target,
        data,
      };

      this._userActions.push(entry);
    } catch (error) {
      console.error('Debug logger failed to capture user action:', error);
    }
  }

  captureTerminalLog(entry: TerminalEntry): void {
    try {
      // Debounce terminal logs to prevent spam
      if (this._config.debounceTerminal > 0) {
        this._terminalLogQueue.push(entry);

        if (this._terminalLogTimer) {
          clearTimeout(this._terminalLogTimer);
        }

        this._terminalLogTimer = setTimeout(() => {
          this._flushTerminalLogs();
        }, this._config.debounceTerminal);
      } else {
        this._terminalLogs.push(entry);
      }
    } catch (error) {
      console.error('Debug logger failed to capture terminal log:', error);
    }
  }

  private _flushTerminalLogs(): void {
    try {
      while (this._terminalLogQueue.length > 0) {
        const entry = this._terminalLogQueue.shift();

        if (entry) {
          this._terminalLogs.push(entry);
        }
      }
      this._terminalLogTimer = null;
    } catch (error) {
      console.error('Debug logger failed to flush terminal logs:', error);
    }
  }

  async generateDebugLog(): Promise<DebugLogData> {
    try {
      // Enable debug mode temporarily if not already enabled
      const wasEnabled = this._config.enabled;

      if (!wasEnabled) {
        this.enableDebugMode();
      }

      // Flush any pending terminal logs
      if (this._terminalLogTimer) {
        clearTimeout(this._terminalLogTimer);
        this._flushTerminalLogs();
      }

      const [systemInfo, appInfo, performanceInfo, state] = await Promise.all([
        this._collectSystemInfo(),
        this._collectAppInfo(),
        Promise.resolve(this._collectPerformanceInfo()),
        Promise.resolve(this._collectStateInfo()),
      ]);

      // Get logs from logStore with proper error handling
      const logStoreLogs = await this._getLogStoreLogs();

      const debugData: DebugLogData = {
        timestamp: new Date().toISOString(),
        sessionId: this._generateSessionId(),
        systemInfo,
        appInfo,
        logs: [...this._logs.toArray(), ...logStoreLogs],
        errors: this._errors.toArray(),
        networkRequests: this._networkRequests.toArray(),
        performance: performanceInfo,
        state,
        userActions: this._userActions.toArray(),
        terminalLogs: this._terminalLogs.toArray(),
      };

      // Restore previous state
      if (!wasEnabled) {
        this.disableDebugMode();
      }

      return debugData;
    } catch (error) {
      logger.error('Failed to generate debug log:', error);
      throw error;
    }
  }

  private async _getLogStoreLogs(): Promise<LogEntry[]> {
    try {
      const store = getLogStore();

      if (!store) {
        // Try to load the store if not already loaded
        try {
          const { logStore: storeModule } = await import('~/lib/stores/logs');
          logStore = storeModule;

          return this._getLogStoreLogs();
        } catch {
          return [];
        }
      }

      const logs = store.getLogs?.() || [];

      return logs.slice(0, 500).map((log: any) => ({
        timestamp: log.timestamp,
        level: log.level as LogEntry['level'],
        scope: log.category,
        message: log.message,
        data: log.details,
      }));
    } catch (error) {
      logger.warn('Failed to get logStore logs:', error);
      return [];
    }
  }

  private async _collectSystemInfo(): Promise<SystemInfo> {
    let platform = 'Unknown';

    if (isMac) {
      platform = 'macOS';
    } else if (isWindows) {
      platform = 'Windows';
    } else if (isLinux) {
      platform = 'Linux';
    }

    return {
      platform,
      userAgent: navigator.userAgent,
      screenResolution: `${screen.width}x${screen.height}`,
      viewportSize: `${window.innerWidth}x${window.innerHeight}`,
      isMobile: isMobile(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      cookiesEnabled: navigator.cookieEnabled,
      localStorageEnabled: this._testLocalStorage(),
      sessionStorageEnabled: this._testSessionStorage(),
    };
  }

  private async _collectAppInfo(): Promise<AppInfo> {
    let workbenchInfo = {
      currentView: 'code',
      showWorkbench: false,
      showTerminal: true,
      artifactsCount: 0,
      filesCount: 0,
      unsavedFiles: 0,
      hasActivePreview: false,
    };

    // Try to get workbench information
    try {
      if (typeof window !== 'undefined') {
        // Access stores if available
        const workbenchStore = (window as any).__bolt_workbench_store;

        if (workbenchStore) {
          const state = workbenchStore.get?.() || {};
          workbenchInfo = {
            currentView: state.currentView || 'code',
            showWorkbench: state.showWorkbench || false,
            showTerminal: state.showTerminal !== undefined ? state.showTerminal : true,
            artifactsCount: Object.keys(state.artifacts || {}).length,
            filesCount: Object.keys(state.files || {}).length,
            unsavedFiles: state.unsavedFiles?.size || 0,
            hasActivePreview: (state.previews || []).length > 0,
          };
        }
      }
    } catch {
      // Ignore errors when accessing stores
    }

    return {
      version: this._getAppVersion(),
      buildTime: new Date().toISOString(),
      currentModel: this._getCurrentModel(),
      currentProvider: this._getCurrentProvider(),
      projectType: this._getProjectType(),
      workbenchView: workbenchInfo.currentView,
      hasActivePreview: workbenchInfo.hasActivePreview,
      unsavedFiles: workbenchInfo.unsavedFiles,
      workbenchState: workbenchInfo,
      gitInfo: await this._getGitInfo(),
    };
  }

  private _getAppVersion(): string {
    try {
      // Try to get version from environment or default
      return import.meta.env?.VITE_APP_VERSION || '1.0.0';
    } catch {
      return '1.0.0';
    }
  }

  private _getCurrentModel(): string {
    try {
      // Try to get from localStorage or environment
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('bolt_current_model');

        if (stored) {
          return stored;
        }
      }

      return DEFAULT_MODEL;
    } catch {
      return DEFAULT_MODEL;
    }
  }

  private _getCurrentProvider(): string {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('bolt_current_provider');

        if (stored) {
          return stored;
        }
      }

      return PROVIDER_LIST[0]?.name || 'unknown';
    } catch {
      return PROVIDER_LIST[0]?.name || 'unknown';
    }
  }

  private _getProjectType(): string {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('bolt_project_type');

        if (stored) {
          return stored;
        }
      }

      return 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private async _getGitInfo(): Promise<AppInfo['gitInfo']> {
    try {
      // Try to fetch git info from existing API endpoint
      const response = await fetch('/api/system/git-info');

      if (response.ok) {
        const gitInfo = await response.json();

        // Transform the API response to match our interface
        const gitInfoTyped = gitInfo as any;

        // Type assertion for API response
        return {
          branch: gitInfoTyped.local?.branch || 'unknown',
          commit: gitInfoTyped.local?.commitHash || 'unknown',
          isDirty: false, // The existing API doesn't provide this info
          remoteUrl: gitInfoTyped.local?.remoteUrl,
          lastCommit: gitInfoTyped.local
            ? {
                message: 'Latest commit',
                date: gitInfoTyped.local.commitTime,
                author: gitInfoTyped.local.author,
              }
            : undefined,
        };
      }
    } catch {
      // API not available, try client-side fallback
      console.warn('Git info API not available, using fallback');
    }

    // Fallback: try to get basic git info from localStorage or known values
    return this._getGitInfoFallback();
  }

  private _getGitInfoFallback(): AppInfo['gitInfo'] {
    try {
      // Try to get from localStorage (could be set by the app)
      const stored = localStorage.getItem('bolt_git_info');

      if (stored) {
        return JSON.parse(stored);
      }

      // Try to get from environment/build variables
      const branch = import.meta.env?.VITE_GIT_BRANCH || 'unknown';
      const commit = import.meta.env?.VITE_GIT_COMMIT || 'unknown';

      return {
        branch,
        commit,
        isDirty: false, // Assume clean if we don't know
      };
    } catch {
      return {
        branch: 'unknown',
        commit: 'unknown',
        isDirty: false,
      };
    }
  }

  private _collectPerformanceInfo(): PerformanceEntry {
    const timing = performance.timing as any;
    const paintEntries = performance.getEntriesByType('paint');

    return {
      navigationStart: timing.navigationStart,
      loadTime: timing.loadEventEnd - timing.navigationStart,
      domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
      firstPaint: paintEntries.find((entry) => entry.name === 'first-paint')?.startTime,
      firstContentfulPaint: paintEntries.find((entry) => entry.name === 'first-contentful-paint')?.startTime,
      memoryUsage: (performance as any).memory
        ? {
            used: (performance as any).memory.usedJSHeapSize,
            total: (performance as any).memory.totalJSHeapSize,
            limit: (performance as any).memory.jsHeapSizeLimit,
          }
        : undefined,
      timing,
    };
  }

  private _collectStateInfo(): StateEntry {
    const store = getLogStore();
    let alerts: StateEntry['alerts'] = [];

    // Get recent alerts from logStore
    if (store) {
      try {
        const logs = store.getLogs?.() || [];
        alerts = logs
          .filter((log: any) => ['error', 'warning'].includes(log.level))
          .slice(0, 10)
          .map((log: any) => ({
            type: log.level,
            title: log.message.substring(0, 100),
            source: log.category,
          }));
      } catch {
        // Ignore errors
      }
    }

    // Get workbench state
    let workbenchState = {
      currentView: 'code',
      showWorkbench: false,
      showTerminal: true,
      artifactsCount: 0,
      filesCount: 0,
    };

    try {
      if (typeof window !== 'undefined') {
        const workbenchStore = (window as any).__bolt_workbench_store;

        if (workbenchStore) {
          const state = workbenchStore.get?.() || {};
          workbenchState = {
            currentView: state.currentView || 'code',
            showWorkbench: state.showWorkbench || false,
            showTerminal: state.showTerminal !== undefined ? state.showTerminal : true,
            artifactsCount: Object.keys(state.artifacts || {}).length,
            filesCount: Object.keys(state.files || {}).length,
          };
        }
      }
    } catch {
      // Ignore errors
    }

    return {
      currentView: workbenchState.currentView,
      showWorkbench: workbenchState.showWorkbench,
      showTerminal: workbenchState.showTerminal,
      artifactsCount: workbenchState.artifactsCount,
      filesCount: workbenchState.filesCount,
      alerts,
    };
  }

  private _testLocalStorage(): boolean {
    try {
      localStorage.setItem('test', 'test');
      localStorage.removeItem('test');

      return true;
    } catch {
      return false;
    }
  }

  private _testSessionStorage(): boolean {
    try {
      sessionStorage.setItem('test', 'test');
      sessionStorage.removeItem('test');

      return true;
    } catch {
      return false;
    }
  }

  private _generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  clearLogs(): void {
    try {
      this._logs.clear();
      this._errors.clear();
      this._networkRequests.clear();
      this._userActions.clear();
      this._terminalLogs.clear();

      // Clear any pending terminal logs
      this._terminalLogQueue = [];

      if (this._terminalLogTimer) {
        clearTimeout(this._terminalLogTimer);
        this._terminalLogTimer = null;
      }

      logger.info('Debug logs cleared');
    } catch (error) {
      logger.error('Failed to clear logs:', error);
    }
  }

  // Get current memory usage statistics
  getMemoryStats(): {
    logs: number;
    errors: number;
    networkRequests: number;
    userActions: number;
    terminalLogs: number;
    total: number;
  } {
    const stats = {
      logs: this._logs.getSize(),
      errors: this._errors.getSize(),
      networkRequests: this._networkRequests.getSize(),
      userActions: this._userActions.getSize(),
      terminalLogs: this._terminalLogs.getSize(),
      total: 0,
    };

    stats.total = stats.logs + stats.errors + stats.networkRequests + stats.userActions + stats.terminalLogs;

    return stats;
  }
}

// Export singleton instance with default configuration
export const debugLogger = new DebugLogger({
  enabled: false, // Start disabled for performance
  maxEntries: 1000,
  captureConsole: true,
  captureNetwork: true,
  captureErrors: true,
  debounceTerminal: 100,
});

// Helper function to download debug log
export async function downloadDebugLog(filename?: string): Promise<void> {
  try {
    const debugData = await debugLogger.generateDebugLog();

    // Create a formatted summary
    const summary = createDebugSummary(debugData);
    const fullContent = `${summary}\n\n=== DETAILED DEBUG DATA ===\n\n${JSON.stringify(debugData, null, 2)}`;

    const blob = new Blob([fullContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `bolt-debug-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);

    logger.info('Debug log downloaded successfully');
  } catch (error) {
    logger.error('Failed to download debug log:', error);
  }
}

// Create a human-readable summary of the debug data
function createDebugSummary(data: DebugLogData): string {
  const summary = [
    '=== BOLT DIY DEBUG LOG SUMMARY ===',
    `Generated: ${new Date(data.timestamp).toLocaleString()}`,
    `Session ID: ${data.sessionId}`,
    '',
    '=== SYSTEM INFORMATION ===',
    `Platform: ${data.systemInfo.platform}`,
    `Browser: ${data.systemInfo.userAgent.split(' ').slice(0, 2).join(' ')}`,
    `Screen: ${data.systemInfo.screenResolution}`,
    `Mobile: ${data.systemInfo.isMobile ? 'Yes' : 'No'}`,
    `Timezone: ${data.systemInfo.timezone}`,
    '',
    '=== APPLICATION INFORMATION ===',
    `Version: ${data.appInfo.version}`,
    `Current Model: ${data.appInfo.currentModel}`,
    `Current Provider: ${data.appInfo.currentProvider}`,
    `Project Type: ${data.appInfo.projectType}`,
    `Workbench View: ${data.appInfo.workbenchView}`,
    `Active Preview: ${data.appInfo.hasActivePreview ? 'Yes' : 'No'}`,
    `Unsaved Files: ${data.appInfo.unsavedFiles}`,
    '',
    '=== GIT INFORMATION ===',
    data.appInfo.gitInfo
      ? [
          `Branch: ${data.appInfo.gitInfo.branch}`,
          `Commit: ${data.appInfo.gitInfo.commit.substring(0, 8)}`,
          `Working Directory: ${data.appInfo.gitInfo.isDirty ? 'Dirty' : 'Clean'}`,
          data.appInfo.gitInfo.remoteUrl ? `Remote: ${data.appInfo.gitInfo.remoteUrl}` : '',
          data.appInfo.gitInfo.lastCommit
            ? `Last Commit: ${data.appInfo.gitInfo.lastCommit.message.substring(0, 50)}...`
            : '',
        ]
          .filter(Boolean)
          .join('\n')
      : 'Git information not available',
    '',
    '=== SESSION STATISTICS ===',
    `Total Logs: ${data.logs.length}`,
    `Errors: ${data.errors.length}`,
    `Network Requests: ${data.networkRequests.length}`,
    `User Actions: ${data.userActions.length}`,
    `Terminal Logs: ${data.terminalLogs.length}`,
    '',
    '=== RECENT ALERTS ===',
    ...data.state.alerts.slice(0, 5).map((alert) => `${alert.type.toUpperCase()}: ${alert.title}`),
    '',
    '=== PERFORMANCE ===',
    `Page Load Time: ${data.performance.loadTime}ms`,
    `DOM Content Loaded: ${data.performance.domContentLoaded}ms`,
    data.performance.memoryUsage
      ? `Memory Usage: ${(data.performance.memoryUsage.used / 1024 / 1024).toFixed(2)} MB`
      : 'Memory Usage: N/A',
    '',
    '=== WORKBENCH STATE ===',
    `Current View: ${data.state.currentView}`,
    `Show Workbench: ${data.state.showWorkbench}`,
    `Show Terminal: ${data.state.showTerminal}`,
    `Artifacts: ${data.state.artifactsCount}`,
    `Files: ${data.state.filesCount}`,
  ];

  return summary.join('\n');
}

// Utility functions for capturing additional data
export function captureTerminalLog(
  content: string,
  type: 'input' | 'output' | 'error' = 'output',
  command?: string,
): void {
  // Only capture if content is meaningful (not just whitespace or control characters)
  if (!content || content.trim().length === 0) {
    return;
  }

  try {
    debugLogger.captureTerminalLog({
      timestamp: new Date().toISOString(),
      type,
      content: content.trim(),
      command,
    });
  } catch (error) {
    console.error('Failed to capture terminal log:', error);
  }
}

export function captureUserAction(action: string, target?: string, data?: any): void {
  try {
    debugLogger.captureUserAction(action, target, data);
  } catch (error) {
    console.error('Failed to capture user action:', error);
  }
}

export function getDebugLogger(): DebugLogger {
  return debugLogger;
}

// Utility function to enable debug mode on demand
export function enableDebugMode(): void {
  debugLogger.enableDebugMode();
}

// Utility function to disable debug mode
export function disableDebugMode(): void {
  debugLogger.disableDebugMode();
}

// Utility function to get debug logger status
export function getDebugStatus(): { initialized: boolean; capturing: boolean; enabled: boolean } {
  return debugLogger.getStatus();
}

// Utility function to update debug configuration
export function updateDebugConfig(config: Partial<DebugLoggerConfig>): void {
  debugLogger.updateConfig(config);
}

// Initialize debug logger when this module is imported
if (typeof window !== 'undefined') {
  // Defer initialization to avoid blocking
  setTimeout(() => {
    debugLogger.initialize();
  }, 0);
}
