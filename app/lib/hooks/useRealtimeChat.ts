import { useEffect, useRef } from 'react';
import { useAuth } from './useAuth';
import { useWorkspace } from './useWorkspace';
import { getSupabaseAuthClient } from '~/lib/api/supabase-auth-client';
import { chatId } from '~/lib/persistence/useChatHistory';
import type { Message } from 'ai';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useStore } from '@nanostores/react';

export interface RealtimeChatUpdate {
  id: string;
  messages: Message[];
  title?: string;
  description?: string;
  metadata?: any;
  last_modified_by?: string;
}

export function useRealtimeChat(onChatUpdate: (update: RealtimeChatUpdate) => void) {
  const { isAuthenticated, session, user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const subscriptionRef = useRef<RealtimeChannel | null>(null);
  const currentChatId = useStore(chatId);
  const onChatUpdateRef = useRef(onChatUpdate);

  // Keep the callback ref up to date
  useEffect(() => {
    onChatUpdateRef.current = onChatUpdate;
  }, [onChatUpdate]);

  useEffect(() => {
    if (!isAuthenticated || !currentWorkspace || !currentChatId || !session?.access_token) {
      // Clean up existing subscription if conditions are no longer met
      if (subscriptionRef.current) {
        const supabase = getSupabaseAuthClient();
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }

      return;
    }

    const supabase = getSupabaseAuthClient();
    const numericChatId = parseInt(currentChatId, 10);

    if (isNaN(numericChatId)) {
      console.warn('Invalid chat ID for realtime subscription:', currentChatId);
      return;
    }

    // Set auth token for realtime
    supabase.realtime.setAuth(session.access_token);

    // Only create subscription if one doesn't exist for this chat ID
    if (subscriptionRef.current && subscriptionRef.current.topic === `chat:${numericChatId}`) {
      return; // Already subscribed to this chat
    }

    // Remove existing subscription if it's for a different chat
    if (subscriptionRef.current) {
      supabase.removeChannel(subscriptionRef.current);
      subscriptionRef.current = null;
    }

    // Subscribe to real-time chat updates
    const channel = supabase
      .channel(`chat:${numericChatId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chats',
          filter: `id=eq.${numericChatId}`,
        },
        (payload) => {
          console.log('🔔 Chat realtime update:', {
            lastModifiedBy: payload.new?.last_modified_by,
            currentUserId: user?.id,
            messageCount: (payload.new?.messages as Message[])?.length || 0,
            lastMessageRole: (payload.new?.messages as Message[])?.[(payload.new?.messages as Message[])?.length - 1]
              ?.role,
          });

          if (payload.new) {
            /*
             * Don't skip based on last_modified_by - let the callback decide
             * This allows assistant messages to come through even if saved by the same user
             */
            const update: RealtimeChatUpdate = {
              id: String(payload.new.id),
              messages: (payload.new.messages as Message[]) || [],
              title: payload.new.title,
              description: payload.new.description,
              metadata: payload.new.metadata,
              last_modified_by: payload.new.last_modified_by,
            };

            // Use the ref to call the latest callback
            onChatUpdateRef.current(update);
          }
        },
      )
      .subscribe((status) => {
        console.log('Chat realtime subscription status:', status, 'for chat:', numericChatId);
      });

    subscriptionRef.current = channel;

    // eslint-disable-next-line
    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, [isAuthenticated, currentWorkspace?.id, currentChatId, session?.access_token, user?.id]);

  return null;
}
