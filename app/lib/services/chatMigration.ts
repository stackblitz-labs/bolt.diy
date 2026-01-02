import { openDatabase, getAll } from '~/lib/persistence/db';
import type { ChatHistoryItem } from '~/lib/persistence/useChatHistory';
import { getSupabaseAuthClient } from '~/lib/api/supabase-auth-client';
import { currentWorkspace } from '~/lib/stores/workspace';
import { currentUser } from '~/lib/stores/auth';

export interface MigrationResult {
  success: boolean;
  migrated: number;
  failed: number;
  errors: string[];
}

/**
 * Migrate chats from IndexedDB to Supabase
 */
export async function migrateChatsToSupabase(): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    migrated: 0,
    failed: 0,
    errors: [],
  };

  try {
    // Check if user is authenticated
    const user = currentUser.get();

    if (!user) {
      throw new Error('User must be authenticated to migrate chats');
    }

    // Check if workspace is selected
    const workspace = currentWorkspace.get();

    if (!workspace) {
      throw new Error('Workspace must be selected to migrate chats');
    }

    // Get Supabase client
    const supabase = getSupabaseAuthClient();

    // Open IndexedDB
    const db = await openDatabase();

    if (!db) {
      throw new Error('IndexedDB is not available');
    }

    // Get all chats from IndexedDB
    const chats = await getAll(db);

    if (chats.length === 0) {
      result.success = true;
      return result;
    }

    // Migrate each chat
    for (const chat of chats) {
      try {
        // Check if chat already exists in Supabase
        const { data: existingChat } = await supabase.from('chats').select('id').eq('id', chat.id).single();

        if (existingChat) {
          // Update existing chat
          const { error: updateError } = await supabase
            .from('chats')
            .update({
              workspace_id: workspace.id,
              title: chat.description || chat.id,
              description: chat.description,
              messages: chat.messages || [],
              metadata: chat.metadata || {},
              updated_at: chat.timestamp || new Date().toISOString(),
            })
            .eq('id', chat.id);

          if (updateError) {
            throw updateError;
          }
        } else {
          // Create new chat
          const { error: insertError } = await supabase.from('chats').insert({
            id: chat.id,
            workspace_id: workspace.id,
            created_by: user.id,
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

        result.migrated++;
      } catch (error) {
        result.failed++;

        const errorMessage = error instanceof Error ? error.message : String(error);
        result.errors.push(`Failed to migrate chat ${chat.id}: ${errorMessage}`);
        console.error(`Failed to migrate chat ${chat.id}:`, error);
      }
    }

    result.success = result.failed === 0;

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    result.errors.push(errorMessage);
    console.error('Chat migration error:', error);

    return result;
  }
}

/**
 * Sync a single chat to Supabase
 */
export async function syncChatToSupabase(chat: ChatHistoryItem): Promise<boolean> {
  try {
    const user = currentUser.get();
    const workspace = currentWorkspace.get();

    if (!user || !workspace) {
      return false;
    }

    const supabase = getSupabaseAuthClient();

    // Check if chat exists
    const { data: existingChat } = await supabase.from('chats').select('id').eq('id', chat.id).single();

    if (existingChat) {
      // Update existing chat
      const { error } = await supabase
        .from('chats')
        .update({
          workspace_id: workspace.id,
          title: chat.description || chat.id,
          description: chat.description,
          messages: chat.messages || [],
          metadata: chat.metadata || {},
          updated_at: new Date().toISOString(),
        })
        .eq('id', chat.id);

      return !error;
    } else {
      // Create new chat
      const { error } = await supabase.from('chats').insert({
        id: chat.id,
        workspace_id: workspace.id,
        created_by: user.id,
        title: chat.description || chat.id,
        description: chat.description,
        messages: chat.messages || [],
        metadata: chat.metadata || {},
        created_at: chat.timestamp || new Date().toISOString(),
        updated_at: chat.timestamp || new Date().toISOString(),
      });

      return !error;
    }
  } catch (error) {
    console.error('Sync chat error:', error);
    return false;
  }
}
