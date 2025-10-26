import { useState, useEffect } from 'react';
import { getNotifications, markNotificationRead, type Notification } from '~/lib/api/notifications';
import { logStore } from '~/lib/stores/logs';
import { useStore } from '@nanostores/react';

export const useNotifications = () => {
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState<Notification[]>([]);
  const logs = useStore(logStore.logs);

  const checkNotifications = async () => {
    try {
      const notifications = await getNotifications();
      const unread = notifications.filter((n) => !logStore.isRead(n.id));
      setUnreadNotifications(unread);
      setHasUnreadNotifications(unread.length > 0);
    } catch (error) {
      console.error('Failed to check notifications:', error);
    }
  };

  useEffect(() => {
    // Check immediately and then every minute
    checkNotifications();

    const interval = setInterval(checkNotifications, 60 * 1000);

    return () => clearInterval(interval);
  }, [logs]); // Re-run when logs change

  const markAsRead = async (notificationId: string) => {
    try {
      await markNotificationRead(notificationId);
      await checkNotifications();
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const notifications = await getNotifications();
      await Promise.all(notifications.map((n) => markNotificationRead(n.id)));
      await checkNotifications();
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  return { hasUnreadNotifications, unreadNotifications, markAsRead, markAllAsRead };
};
