import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import { getSupabaseAuthClient } from '~/lib/api/supabase-auth-client';
import { chatId } from '~/lib/persistence/useChatHistory';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface PresenceUser {
  id: string;
  username: string;
  display_name: string;
  email: string;
  status: 'viewing' | 'editing';
  last_seen: string;
}

export function useChatPresence() {
  const { user, isAuthenticated, session } = useAuth();
  const currentChatId = chatId.get();
  const [activeUsers, setActiveUsers] = useState<PresenceUser[]>([]);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const subscriptionRef = useRef<RealtimeChannel | null>(null);
  const isEditingRef = useRef(false);

  // Update presence in database
  const updatePresence = useCallback(
    async (status: 'viewing' | 'editing') => {
      if (!isAuthenticated || !user || !currentChatId) {
        return;
      }

      try {
        const supabase = getSupabaseAuthClient();
        const numericChatId = parseInt(currentChatId, 10);

        if (isNaN(numericChatId)) {
          return;
        }

        // Upsert presence record
        const { error } = await supabase.from('chat_presence').upsert(
          {
            chat_id: numericChatId,
            user_id: user.id,
            status,
            last_seen: new Date().toISOString(),
          },
          {
            onConflict: 'chat_id,user_id',
          },
        );

        if (error) {
          console.error('Failed to update presence:', error);
        }
      } catch (error) {
        console.error('Error updating presence:', error);
      }
    },
    [isAuthenticated, user, currentChatId],
  );

  // Set editing status
  const setEditing = useCallback(
    (editing: boolean) => {
      isEditingRef.current = editing;
      updatePresence(editing ? 'editing' : 'viewing');
    },
    [updatePresence],
  );

  // Heartbeat to keep presence active
  useEffect(() => {
    if (!isAuthenticated || !user || !currentChatId) {
      return;
    }

    // Initial presence update
    updatePresence('viewing');

    // Set up heartbeat (update every 30 seconds)
    heartbeatIntervalRef.current = setInterval(() => {
      updatePresence(isEditingRef.current ? 'editing' : 'viewing');
    }, 30000);

    // eslint-disable-next-line
    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };
  }, [isAuthenticated, user, currentChatId, updatePresence]);

  // Subscribe to presence changes
  useEffect(() => {
    if (!isAuthenticated || !user || !currentChatId || !session?.access_token) {
      setActiveUsers([]);
      return;
    }

    const supabase = getSupabaseAuthClient();
    const numericChatId = parseInt(currentChatId, 10);

    if (isNaN(numericChatId)) {
      return;
    }

    // Set auth token for realtime
    supabase.realtime.setAuth(session.access_token);

    // Load initial presence
    const loadPresence = async () => {
      try {
        // Get all active users (last seen within last 2 minutes)
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

        const { data: presenceData, error } = await supabase
          .from('chat_presence')
          .select(
            `
            user_id,
            status,
            last_seen,
            users:user_id (
              id,
              username,
              display_name,
              email
            )
          `,
          )
          .eq('chat_id', numericChatId)
          .gte('last_seen', twoMinutesAgo)
          .order('last_seen', { ascending: false });

        if (error) {
          console.error('Failed to load presence:', error);
          return;
        }

        // Transform data
        const users: PresenceUser[] = (presenceData || [])
          .filter((p) => p.users) // Filter out null users
          .map((p: any) => ({
            id: p.user_id,
            username: p.users.username,
            display_name: p.users.display_name,
            email: p.users.email,
            status: p.status,
            last_seen: p.last_seen,
          }));

        setActiveUsers(users);
      } catch (error) {
        console.error('Error loading presence:', error);
      }
    };

    loadPresence();

    // Subscribe to real-time presence changes
    const channel = supabase
      .channel(`chat-presence:${numericChatId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_presence',
          filter: `chat_id=eq.${numericChatId}`,
        },
        async (payload) => {
          console.log('🔔 Presence event:', payload);

          // Reload presence when changes occur
          await loadPresence();
        },
      )
      .subscribe((status) => {
        console.log('Presence subscription status:', status);
      });

    subscriptionRef.current = channel;

    // eslint-disable-next-line
    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, [isAuthenticated, user, currentChatId, session?.access_token]);

  // Cleanup presence on unmount or chat change
  useEffect(() => {
    return () => {
      if (isAuthenticated && user && currentChatId) {
        // Remove presence when leaving chat
        const removePresence = async () => {
          try {
            const supabase = getSupabaseAuthClient();
            const numericChatId = parseInt(currentChatId, 10);

            if (!isNaN(numericChatId)) {
              await supabase.from('chat_presence').delete().eq('chat_id', numericChatId).eq('user_id', user.id);
            }
          } catch (error) {
            console.error('Error removing presence:', error);
          }
        };

        removePresence();
      }
    };
  }, [isAuthenticated, user, currentChatId]);

  return {
    activeUsers,
    setEditing,
  };
}
