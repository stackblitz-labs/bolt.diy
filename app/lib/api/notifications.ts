import { logStore } from '~/lib/stores/logs';
import type { LogEntry } from '~/lib/stores/logs';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  timestamp: string;
  read: boolean;
  details?: Record<string, unknown>;
}

export interface LogEntryWithRead extends LogEntry {
  read: boolean;
}

export const getNotifications = async (): Promise<Notification[]> => {
  // Get notifications from the log store
  const logs = Object.values(logStore.logs.get());

  return logs
    .filter((log) => log.category !== 'system') // Filter out system logs
    .map((log) => ({
      id: log.id,
      title: (log.details?.title as string) || log.message.split('\n')[0],
      message: log.message,
      type: log.level as 'info' | 'warning' | 'error' | 'success',
      timestamp: log.timestamp,
      read: logStore.isRead(log.id),
      details: log.details,
    }))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};

export const markNotificationRead = async (notificationId: string): Promise<void> => {
  logStore.markAsRead(notificationId);
};

export const clearNotifications = async (): Promise<void> => {
  logStore.clearLogs();
};

export const getUnreadCount = (): number => {
  const logs = Object.values(logStore.logs.get()) as LogEntryWithRead[];

  return logs.filter((log) => {
    if (!logStore.isRead(log.id)) {
      if (log.details?.type === 'update') {
        return true;
      }

      return log.level === 'error' || log.level === 'warning';
    }

    return false;
  }).length;
};
