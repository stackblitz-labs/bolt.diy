import { useEffect, useState, useCallback, useRef } from 'react';
import { useWorkspace } from './useWorkspace';
import { useAuth } from './useAuth';
import { getSupabaseAuthClient } from '~/lib/api/supabase-auth-client';
import type { ChatHistoryItem } from '~/lib/persistence/useChatHistory';
import type { Message } from 'ai';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface WorkspaceChat extends ChatHistoryItem {
  workspace_id: string;
  created_by: string;
}

export function useWorkspaceChats() {
  const { currentWorkspace } = useWorkspace();
  const { isAuthenticated: authAuthenticated, session } = useAuth();
  const [chats, setChats] = useState<WorkspaceChat[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadChats = useCallback(async () => {
    if (!currentWorkspace || !authAuthenticated) {
      setChats([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseAuthClient();
      const { data, error: fetchError } = await supabase
        .from('chats')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('updated_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      // Transform Supabase chats to ChatHistoryItem format
      const transformedChats: WorkspaceChat[] = (data || []).map((chat) => ({
        id: String(chat.id), // Convert bigint to string
        urlId: String(chat.id),
        description: chat.title || chat.description || String(chat.id),
        messages: (chat.messages as Message[]) || [],
        timestamp: chat.created_at,
        metadata: chat.metadata || {},
        workspace_id: chat.workspace_id,
        created_by: chat.created_by,
      }));

      setChats(transformedChats);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load chats';
      setError(errorMessage);
      console.error('Failed to load workspace chats:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentWorkspace?.id, authAuthenticated]);

  // Use ref to track if subscription is active to prevent duplicate subscriptions
  const subscriptionRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    console.log('🔔 useEffect loadChats', currentWorkspace?.id, authAuthenticated);

    if (!currentWorkspace || !authAuthenticated) {
      // Clean up subscription if workspace/auth is not available
      if (subscriptionRef.current) {
        const supabase = getSupabaseAuthClient();
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }

      return;
    }

    const supabase = getSupabaseAuthClient();

    if (!session?.access_token) {
      console.log('🔔 useEffect loadChats no session');
      return;
    }

    // Load chats initially
    loadChats();

    // Set auth token for realtime
    supabase.realtime.setAuth(session.access_token);

    // Only create subscription if one doesn't exist
    if (!subscriptionRef.current) {
      const channel = supabase
        .channel(`workspace-chats:${currentWorkspace.id}`)
        .on(
          'postgres_changes',
          {
            event: '*', // INSERT, UPDATE, DELETE
            schema: 'public',
            table: 'chats',
            filter: `workspace_id=eq.${currentWorkspace.id}`,
          },
          (payload) => {
            console.log('🔔 Workspace chat realtime event:', payload);

            // Reload chats when changes occur
            loadChats();
          },
        )
        .subscribe((status) => {
          console.log('Workspace chats realtime subscription status:', status);
        });

      subscriptionRef.current = channel;
    }

    // eslint-disable-next-line
    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, [currentWorkspace?.id, authAuthenticated, session?.access_token, loadChats]);

  const saveChat = async (chat: ChatHistoryItem) => {
    if (!currentWorkspace || !authAuthenticated) {
      throw new Error('Workspace and authentication required');
    }

    try {
      const supabase = getSupabaseAuthClient();
      const { data: user } = await supabase.auth.getUser();

      if (!user.user) {
        throw new Error('Not authenticated');
      }

      const numericChatId = parseInt(chat.id, 10);

      if (isNaN(numericChatId)) {
        throw new Error('Invalid chat ID format');
      }

      // Check if chat exists
      const { data: existingChat } = await supabase.from('chats').select('id').eq('id', numericChatId).single();

      if (existingChat) {
        // Update existing chat
        const { error: updateError } = await supabase
          .from('chats')
          .update({
            workspace_id: currentWorkspace.id,
            title: chat.description || chat.id,
            description: chat.description,
            messages: chat.messages || [],
            metadata: chat.metadata || {},
            updated_at: new Date().toISOString(),
          })
          .eq('id', chat.id);

        if (updateError) {
          throw updateError;
        }
      } else {
        // Create new chat
        const { error: insertError } = await supabase.from('chats').insert({
          id: chat.id,
          workspace_id: currentWorkspace.id,
          created_by: user.user.id,
          title: chat.description || chat.id,
          description: chat.description,
          messages: chat.messages || [],
          metadata: chat.metadata || {},
          created_at: chat.timestamp || new Date().toISOString(),
          updated_at: chat.timestamp || new Date().toISOString(),
        });

        if (insertError) {
          throw insertError;
        }
      }

      // Reload chats
      await loadChats();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save chat';
      console.error('Failed to save chat:', err);
      throw new Error(errorMessage);
    }
  };

  const deleteChat = async (chatId: string) => {
    if (!currentWorkspace || !authAuthenticated) {
      throw new Error('Workspace and authentication required');
    }

    try {
      const numericChatId = parseInt(chatId, 10);

      if (isNaN(numericChatId)) {
        throw new Error('Invalid chat ID format');
      }

      const supabase = getSupabaseAuthClient();
      const { error: deleteError } = await supabase
        .from('chats')
        .delete()
        .eq('id', numericChatId)
        .eq('workspace_id', currentWorkspace.id);

      if (deleteError) {
        throw deleteError;
      }

      // Reload chats
      await loadChats();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete chat';
      console.error('Failed to delete chat:', err);
      throw new Error(errorMessage);
    }
  };

  return {
    chats,
    isLoading,
    error,
    loadChats,
    saveChat,
    deleteChat,
  };
}
