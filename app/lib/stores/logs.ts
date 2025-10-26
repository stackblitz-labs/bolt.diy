import { atom, map } from 'nanostores';
import Cookies from 'js-cookie';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('LogStore');

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'debug';
  message: string;
  details?: Record<string, any>;
  category:
    | 'system'
    | 'provider'
    | 'user'
    | 'error'
    | 'api'
    | 'auth'
    | 'database'
    | 'network'
    | 'performance'
    | 'settings'
    | 'task'
    | 'update'
    | 'feature';
  subCategory?: string;
  duration?: number;
  statusCode?: number;
  source?: string;
  stack?: string;
  metadata?: {
    component?: string;
    action?: string;
    userId?: string;
    sessionId?: string;
    previousValue?: any;
    newValue?: any;
  };
}

interface LogDetails extends Record<string, any> {
  type: string;
  message: string;
}

const MAX_LOGS = 1000; // Maximum number of logs to keep in memory

class LogStore {
  private _logs = map<Record<string, LogEntry>>({});
  showLogs = atom(true);
  private _readLogs = new Set<string>();

  constructor() {
    // Load saved logs from cookies on initialization
    this._loadLogs();

    // Only load read logs in browser environment
    if (typeof window !== 'undefined') {
      this._loadReadLogs();
    }
  }

  // Expose the logs store for subscription
  get logs() {
    return this._logs;
  }

  private _loadLogs() {
    const savedLogs = Cookies.get('eventLogs');

    if (savedLogs) {
      try {
        const parsedLogs = JSON.parse(savedLogs);
        this._logs.set(parsedLogs);
      } catch (error) {
        logger.error('Failed to parse logs from cookies:', error);
      }
    }
  }

  private _loadReadLogs() {
    if (typeof window === 'undefined') {
      return;
    }

    const savedReadLogs = localStorage.getItem('bolt_read_logs');

    if (savedReadLogs) {
      try {
        const parsedReadLogs = JSON.parse(savedReadLogs);
        this._readLogs = new Set(parsedReadLogs);
      } catch (error) {
        logger.error('Failed to parse read logs:', error);
      }
    }
  }

  private _saveLogs() {
    const currentLogs = this._logs.get();
    Cookies.set('eventLogs', JSON.stringify(currentLogs));
  }

  private _saveReadLogs() {
    if (typeof window === 'undefined') {
      return;
    }

    localStorage.setItem('bolt_read_logs', JSON.stringify(Array.from(this._readLogs)));
  }

  private _generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private _trimLogs() {
    const currentLogs = Object.entries(this._logs.get());

    if (currentLogs.length > MAX_LOGS) {
      const sortedLogs = currentLogs.sort(
        ([, a], [, b]) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
      const newLogs = Object.fromEntries(sortedLogs.slice(0, MAX_LOGS));
      this._logs.set(newLogs);
    }
  }

  // Base log method for general logging
  private _addLog(
    message: string,
    level: LogEntry['level'],
    category: LogEntry['category'],
    details?: Record<string, any>,
    metadata?: LogEntry['metadata'],
  ) {
    const id = this._generateId();
    const entry: LogEntry = {
      id,
      timestamp: new Date().toISOString(),
      level,
      message,
      details,
      category,
      metadata,
    };

    this._logs.setKey(id, entry);
    this._trimLogs();
    this._saveLogs();

    return id;
  }

  // Specialized method for API logging
  private _addApiLog(
    message: string,
    method: string,
    url: string,
    details: {
      method: string;
      url: string;
      statusCode: number;
      duration: number;
      request: any;
      response: any;
    },
  ) {
    const statusCode = details.statusCode;
    return this._addLog(message, statusCode >= 400 ? 'error' : 'info', 'api', details, {
      component: 'api',
      action: method,
    });
  }

  // System events
  logSystem(message: string, details?: Record<string, any>) {
    return this._addLog(message, 'info', 'system', details);
  }

  // Provider events
  logProvider(message: string, details?: Record<string, any>) {
    return this._addLog(message, 'info', 'provider', details);
  }

  // User actions
  logUserAction(message: string, details?: Record<string, any>) {
    return this._addLog(message, 'info', 'user', details);
  }

  // API Connection Logging
  logAPIRequest(endpoint: string, method: string, duration: number, statusCode: number, details?: Record<string, any>) {
    const message = `${method} ${endpoint} - ${statusCode} (${duration}ms)`;
    const level = statusCode >= 400 ? 'error' : statusCode >= 300 ? 'warning' : 'info';

    return this._addLog(message, level, 'api', {
      ...details,
      endpoint,
      method,
      duration,
      statusCode,
      timestamp: new Date().toISOString(),
    });
  }

  // Authentication Logging
  logAuth(
    action: 'login' | 'logout' | 'token_refresh' | 'key_validation',
    success: boolean,
    details?: Record<string, any>,
  ) {
    const message = `Auth ${action} - ${success ? 'Success' : 'Failed'}`;
    const level = success ? 'info' : 'error';

    return this._addLog(message, level, 'auth', {
      ...details,
      action,
      success,
      timestamp: new Date().toISOString(),
    });
  }

  // Network Status Logging
  logNetworkStatus(status: 'online' | 'offline' | 'reconnecting' | 'connected', details?: Record<string, any>) {
    const message = `Network ${status}`;
    const level = status === 'offline' ? 'error' : status === 'reconnecting' ? 'warning' : 'info';

    return this._addLog(message, level, 'network', {
      ...details,
      status,
      timestamp: new Date().toISOString(),
    });
  }

  // Database Operations Logging
  logDatabase(operation: string, success: boolean, duration: number, details?: Record<string, any>) {
    const message = `DB ${operation} - ${success ? 'Success' : 'Failed'} (${duration}ms)`;
    const level = success ? 'info' : 'error';

    return this._addLog(message, level, 'database', {
      ...details,
      operation,
      success,
      duration,
      timestamp: new Date().toISOString(),
    });
  }

  // Error events
  logError(message: string, error?: Error | unknown, details?: Record<string, any>) {
    const errorDetails =
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
            ...details,
          }
        : { error, ...details };

    return this._addLog(message, 'error', 'error', errorDetails);
  }

  // Warning events
  logWarning(message: string, details?: Record<string, any>) {
    return this._addLog(message, 'warning', 'system', details);
  }

  // Debug events
  logDebug(message: string, details?: Record<string, any>) {
    return this._addLog(message, 'debug', 'system', details);
  }

  clearLogs() {
    this._logs.set({});
    this._saveLogs();
  }

  getLogs() {
    return Object.values(this._logs.get()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }

  getFilteredLogs(level?: LogEntry['level'], category?: LogEntry['category'], searchQuery?: string) {
    return this.getLogs().filter((log) => {
      const matchesLevel = !level || level === 'debug' || log.level === level;
      const matchesCategory = !category || log.category === category;
      const matchesSearch =
        !searchQuery ||
        log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
        JSON.stringify(log.details).toLowerCase().includes(searchQuery.toLowerCase());

      return matchesLevel && matchesCategory && matchesSearch;
    });
  }

  markAsRead(logId: string) {
    this._readLogs.add(logId);
    this._saveReadLogs();
  }

  isRead(logId: string): boolean {
    return this._readLogs.has(logId);
  }

  clearReadLogs() {
    this._readLogs.clear();
    this._saveReadLogs();
  }

  // API interactions
  logApiCall(
    method: string,
    endpoint: string,
    statusCode: number,
    duration: number,
    requestData?: any,
    responseData?: any,
  ) {
    return this._addLog(
      `API ${method} ${endpoint}`,
      statusCode >= 400 ? 'error' : 'info',
      'api',
      {
        method,
        endpoint,
        statusCode,
        duration,
        request: requestData,
        response: responseData,
      },
      {
        component: 'api',
        action: method,
      },
    );
  }

  // Network operations
  logNetworkRequest(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    requestData?: any,
    responseData?: any,
  ) {
    return this._addLog(
      `${method} ${url}`,
      statusCode >= 400 ? 'error' : 'info',
      'network',
      {
        method,
        url,
        statusCode,
        duration,
        request: requestData,
        response: responseData,
      },
      {
        component: 'network',
        action: method,
      },
    );
  }

  // Authentication events
  logAuthEvent(event: string, success: boolean, details?: Record<string, any>) {
    return this._addLog(
      `Auth ${event} ${success ? 'succeeded' : 'failed'}`,
      success ? 'info' : 'error',
      'auth',
      details,
      {
        component: 'auth',
        action: event,
      },
    );
  }

  // Performance tracking
  logPerformance(operation: string, duration: number, details?: Record<string, any>) {
    return this._addLog(
      `Performance: ${operation}`,
      duration > 1000 ? 'warning' : 'info',
      'performance',
      {
        operation,
        duration,
        ...details,
      },
      {
        component: 'performance',
        action: 'metric',
      },
    );
  }

  // Error handling
  logErrorWithStack(error: Error, category: LogEntry['category'] = 'error', details?: Record<string, any>) {
    return this._addLog(
      error.message,
      'error',
      category,
      {
        ...details,
        name: error.name,
        stack: error.stack,
      },
      {
        component: category,
        action: 'error',
      },
    );
  }

  // Refresh logs (useful for real-time updates)
  refreshLogs() {
    const currentLogs = this._logs.get();
    this._logs.set({ ...currentLogs });
  }

  // Enhanced logging methods
  logInfo(message: string, details: LogDetails) {
    return this._addLog(message, 'info', 'system', details);
  }

  logSuccess(message: string, details: LogDetails) {
    return this._addLog(message, 'info', 'system', { ...details, success: true });
  }

  logApiRequest(
    method: string,
    url: string,
    details: {
      method: string;
      url: string;
      statusCode: number;
      duration: number;
      request: any;
      response: any;
    },
  ) {
    return this._addApiLog(`API ${method} ${url}`, method, url, details);
  }

  logSettingsChange(component: string, setting: string, oldValue: any, newValue: any) {
    return this._addLog(
      `Settings changed in ${component}: ${setting}`,
      'info',
      'settings',
      {
        setting,
        previousValue: oldValue,
        newValue,
      },
      {
        component,
        action: 'settings_change',
        previousValue: oldValue,
        newValue,
      },
    );
  }

  logFeatureToggle(featureId: string, enabled: boolean) {
    return this._addLog(
      `Feature ${featureId} ${enabled ? 'enabled' : 'disabled'}`,
      'info',
      'feature',
      { featureId, enabled },
      {
        component: 'features',
        action: 'feature_toggle',
      },
    );
  }

  logTaskOperation(taskId: string, operation: string, status: string, details?: any) {
    return this._addLog(
      `Task ${taskId}: ${operation} - ${status}`,
      'info',
      'task',
      { taskId, operation, status, ...details },
      {
        component: 'task-manager',
        action: 'task_operation',
      },
    );
  }

  logProviderAction(provider: string, action: string, success: boolean, details?: any) {
    return this._addLog(
      `Provider ${provider}: ${action} - ${success ? 'Success' : 'Failed'}`,
      success ? 'info' : 'error',
      'provider',
      { provider, action, success, ...details },
      {
        component: 'providers',
        action: 'provider_action',
      },
    );
  }

  logPerformanceMetric(component: string, operation: string, duration: number, details?: any) {
    return this._addLog(
      `Performance: ${component} - ${operation} took ${duration}ms`,
      duration > 1000 ? 'warning' : 'info',
      'performance',
      { component, operation, duration, ...details },
      {
        component,
        action: 'performance_metric',
      },
    );
  }
}

export const logStore = new LogStore();
