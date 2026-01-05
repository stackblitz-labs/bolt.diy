# Real-Time Chat Feature Documentation

## Overview

The real-time chat feature enables multiple users to collaborate on chats in real-time, with instant message synchronization and presence tracking. The system uses Supabase Realtime to broadcast database changes to all connected clients, ensuring that all users see the latest chat state immediately.

## Architecture

### Components

1. **Database Tables**
   - `chats` - Stores chat data (messages, metadata, workspace association)
   - `chat_presence` - Tracks active users in each chat

2. **React Hooks**
   - `useRealtimeChat` - Subscribes to real-time chat updates
   - `useChatPresence` - Manages user presence tracking
   - `useWorkspaceChats` - Loads and syncs workspace chat list

3. **UI Components**
   - `Chat.client.tsx` - Main chat component that handles message display and updates
   - `ActiveUsers.tsx` - Displays active users in the chat

## Database Schema

### `chats` Table

```sql
CREATE TABLE chats (
  id bigint PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  title text,
  description text,
  messages jsonb DEFAULT '[]'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  last_modified_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Key Fields:**
- `id`: Numeric chat identifier (bigint)
- `messages`: JSON array of message objects
- `last_modified_by`: UUID of the user who last modified the chat
- `workspace_id`: Associates chat with a workspace

### `chat_presence` Table

```sql
CREATE TABLE chat_presence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id bigint NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'viewing' CHECK (status IN ('viewing', 'editing')),
  last_seen timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(chat_id, user_id)
);
```

**Key Fields:**
- `chat_id`: References the chat
- `user_id`: References the user
- `status`: Current activity status ('viewing' or 'editing')
- `last_seen`: Timestamp of last activity

## Real-Time Chat Updates

### Subscription Setup

The `useRealtimeChat` hook establishes a Supabase Realtime subscription for chat updates:

```typescript
// Location: app/lib/hooks/useRealtimeChat.ts

useEffect(() => {
  // Validate prerequisites
  if (!isAuthenticated || !currentWorkspace || !currentChatId || !session?.access_token) {
    return;
  }

  // Set authentication token for realtime
  supabase.realtime.setAuth(session.access_token);

  // Create subscription channel
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
        // Handle update
      }
    )
    .subscribe();
}, [isAuthenticated, currentWorkspace?.id, currentChatId, session?.access_token]);
```

### Event Flow

1. **User sends a message or assistant responds**
   - Message is added to local state via `useChat` hook
   - `useEffect` in `Chat.client.tsx` detects message changes

2. **Save to Database**
   - **User messages**: Saved immediately when not streaming
   - **Assistant messages**: Saved only once when streaming completes (not in parts)
   - This prevents multiple partial updates and reduces Supabase latency

3. **Database Trigger**
   - When `chats` table is updated, Supabase Realtime broadcasts the change
   - All subscribed clients receive the update via `postgres_changes` event

4. **Update Processing**
   - `useRealtimeChat` receives the update and calls the callback
   - `Chat.client.tsx` processes the update through `processRealtimeUpdate`

### Update Processing Logic

The `processRealtimeUpdate` function in `Chat.client.tsx` determines whether to apply an update:

```typescript
// Key decision factors:
const messageCountIncreased = update.messages.length > messages.length;
const isCurrentUser = user?.id && update.last_modified_by === user.id;
const isCurrentlyStreaming = isLoading;

// Check if assistant message already exists locally
const existingAssistantMessage = messages.find(
  (msg) => msg.id === lastMessageInUpdateId && msg.role === 'assistant'
);

// Decision logic:
const shouldApply =
  !isCurrentUser || // Always apply updates from other users
  (!isAssistantMessageAlreadyComplete && messageCountIncreased) || // New message
  (lastMessageContentChanged && updateHasMoreContent) || // Streaming update with more content
  (!isAssistantMessageAlreadyComplete && messagesChanged && !isCurrentlyStreaming); // Non-streaming changes
```

**Update Rules:**
1. **Always apply** updates from different users
2. **Apply** new messages (count increased) if not already complete locally
3. **Apply** streaming updates only if they have more content than local state
4. **Skip** updates if assistant message is already complete locally and was triggered by current user

### Debouncing

Rapid updates (e.g., during streaming) are debounced to batch them together:

```typescript
// Immediate application for:
// - New messages (count increased)
// - Assistant messages from other users
// - Updates after 100ms since last processed update

// Debounced (50ms) for:
// - Rapid streaming updates from same user
```

### Preventing Infinite Loops

The system uses several mechanisms to prevent update loops:

1. **`isApplyingRealtimeUpdateRef` flag**
   - Set to `true` when applying a real-time update
   - Prevents `storeMessageHistory` from saving during real-time updates
   - Reset via `requestAnimationFrame` after React processes the update

2. **Message comparison**
   - Compares message IDs, content, and roles
   - Only applies updates if messages actually changed

3. **Streaming state awareness**
   - Tracks if current user is streaming
   - Skips updates that would overwrite local streaming with stale data

## Presence System

### Heartbeat Mechanism

The presence system uses a heartbeat to keep user presence active:

```typescript
// Location: app/lib/hooks/useChatPresence.ts

// Initial presence update on mount
updatePresence('viewing');

// Heartbeat every 30 seconds
setInterval(() => {
  updatePresence(isEditingRef.current ? 'editing' : 'viewing');
}, 30000);
```

### Presence Updates

1. **Status Changes**
   - `setEditing(true)` → Updates status to 'editing'
   - `setEditing(false)` → Updates status to 'viewing'
   - Each status change updates `last_seen` timestamp

2. **Database Upsert**
   ```typescript
   await supabase.from('chat_presence').upsert(
     {
       chat_id: numericChatId,
       user_id: user.id,
       status,
       last_seen: new Date().toISOString(),
     },
     { onConflict: 'chat_id,user_id' }
   );
   ```

### Real-Time Presence Subscription

```typescript
// Subscribe to presence changes
const channel = supabase
  .channel(`chat-presence:${numericChatId}`)
  .on(
    'postgres_changes',
    {
      event: '*', // INSERT, UPDATE, DELETE
      schema: 'public',
      table: 'chat_presence',
      filter: `chat_id=eq.${numericChatId}`,
    },
    async (payload) => {
      // Reload presence when changes occur
      await loadPresence();
    }
  )
  .subscribe();
```

### Presence Loading

Active users are determined by:
- `last_seen` within the last 2 minutes
- Sorted by `last_seen` (most recent first)

```typescript
const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

const { data } = await supabase
  .from('chat_presence')
  .select(`
    user_id,
    status,
    last_seen,
    users:user_id (id, username, display_name, email)
  `)
  .eq('chat_id', numericChatId)
  .gte('last_seen', twoMinutesAgo)
  .order('last_seen', { ascending: false });
```

### Presence Cleanup

When a user leaves a chat:
- Presence record is deleted from `chat_presence` table
- Cleanup runs on component unmount or chat change

```typescript
useEffect(() => {
  return () => {
    // Remove presence when leaving chat
    await supabase
      .from('chat_presence')
      .delete()
      .eq('chat_id', numericChatId)
      .eq('user_id', user.id);
  };
}, [currentChatId]);
```

## Workspace Chat List Updates

The `useWorkspaceChats` hook maintains a real-time list of chats in a workspace:

```typescript
// Subscribe to workspace chat changes
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
      // Reload chats when changes occur
      loadChats();
    }
  )
  .subscribe();
```

**Events:**
- `INSERT` - New chat created → Reload list
- `UPDATE` - Chat updated → Reload list
- `DELETE` - Chat deleted → Reload list

## Message Saving Strategy

### User Messages
- Saved immediately when added (if not currently streaming)
- Saved to both IndexedDB (local cache) and Supabase

### Assistant Messages
- **Not saved during streaming** (prevents partial updates)
- Saved only once when streaming completes (`streamingJustCompleted` flag)
- This ensures other users see the complete message at once

```typescript
// Location: app/components/chat/Chat.client.tsx

useEffect(() => {
  // Track when streaming completes
  const streamingJustCompleted = prevIsLoadingRef.current && !isLoading;
  prevIsLoadingRef.current = isLoading;

  // Skip saving if applying real-time update
  if (isApplyingRealtimeUpdateRef.current) {
    return;
  }

  const lastMessage = messages[messages.length - 1];
  const isNewUserMessage = lastMessage?.role === 'user' && messages.length > initialMessages.length;
  
  // Save conditions:
  const shouldSave =
    streamingJustCompleted || // Complete assistant message
    (isNewUserMessage && !isLoading); // New user message (not streaming)

  if (shouldSave) {
    storeMessageHistory(messages);
  }
}, [messages, isLoading]);
```

## Authentication & Security

### Supabase Client Configuration

The Supabase client uses a custom storage adapter that syncs with the application's auth state:

```typescript
// Location: app/lib/api/supabase-auth-client.ts

function createBoltAuthStorage() {
  return {
    getItem: (key: string) => {
      // Extract session from bolt_auth localStorage
      const boltAuth = localStorage.getItem('bolt_auth');
      // Return session in Supabase format
    },
    setItem: (key: string, value: string) => {
      // Sync Supabase session updates back to bolt_auth
    },
  };
}
```

### Realtime Authentication

Before subscribing, the realtime client must be authenticated:

```typescript
supabase.realtime.setAuth(session.access_token);
```

This ensures that:
- Only authenticated users can subscribe
- RLS policies are enforced
- User identity is available in triggers (`auth.uid()`)

## Error Handling

### Subscription Failures
- Logs subscription status changes
- Cleans up subscriptions on unmount
- Handles invalid chat IDs gracefully

### Update Failures
- Skips updates with invalid data (no messages, empty arrays)
- Logs skipped updates for debugging
- Continues processing subsequent updates

### Presence Failures
- Gracefully handles presence update errors
- Falls back to empty active users list
- Continues heartbeat on errors

## Performance Optimizations

1. **Debouncing**: Batches rapid updates (50ms debounce for streaming)
2. **Message Comparison**: Fast path for count changes, deep comparison only when needed
3. **Selective Updates**: Only applies updates that actually change the UI
4. **Refs for State**: Uses refs to avoid stale closures in callbacks
5. **RequestAnimationFrame**: Ensures flag resets happen after React updates

## Troubleshooting

### Messages Not Updating
- Check Supabase Realtime subscription status
- Verify `last_modified_by` is set correctly
- Check if `isApplyingRealtimeUpdateRef` is blocking saves
- Verify authentication token is valid

### Presence Not Showing
- Check heartbeat interval (30 seconds)
- Verify `last_seen` is within 2 minutes
- Check RLS policies on `chat_presence` table
- Verify realtime subscription is active

### Duplicate Messages
- Check if `isApplyingRealtimeUpdateRef` is working correctly
- Verify message comparison logic
- Check for multiple subscriptions (should only have one per chat)

### Infinite Update Loops
- Verify `isApplyingRealtimeUpdateRef` flag is resetting
- Check message comparison logic
- Verify streaming state detection

## Future Improvements

1. **Optimistic Updates**: Apply UI updates immediately, sync with server
2. **Conflict Resolution**: Handle simultaneous edits more gracefully
3. **Message Versioning**: Track message history for undo/redo
4. **Typing Indicators**: Show when users are typing (beyond just 'editing')
5. **Read Receipts**: Track which messages users have seen
6. **Offline Support**: Queue updates when offline, sync when reconnected

