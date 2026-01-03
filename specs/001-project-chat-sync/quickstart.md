# Quickstart: Project Chat Sync

This quickstart is for developers validating the feature behavior end-to-end.

## Prereqs

- Node.js >= 18.18
- `pnpm`
- Environment configured for auth + Supabase (use your existing project setup)

## Run locally

```bash
pnpm run dev
```

## Validate Core Flows

### US1: Reopen project and continue conversation (MVP)

#### Test 1.1: Signed-in reopen loads recent history
1. Sign in to the application
2. Create a new project or select an existing one
3. Send at least 10-15 messages to build up chat history
4. Navigate away from the project (go to dashboard or another project)
5. Reopen the same project
6. **Confirm**:
   - The most recent portion of chat history loads quickly (<2 seconds)
   - A "Load older messages" button appears above the message list if more messages exist
   - Messages are displayed in correct chronological order
   - The message count indicator shows loaded/total messages

#### Test 1.2: Load older messages on demand
1. With a project that has 60+ messages, scroll to the top
2. Click "Load older messages" button
3. **Confirm**:
   - Older messages prepend in correct chronological order
   - Button shows loading state while fetching
   - Button remains enabled if more pages exist
   - Button becomes disabled when all messages loaded
   - UI stays responsive during loading (no freezing)

#### Test 1.3: Send new message after reopen
1. Open an existing project with history
2. Send a new message
3. Refresh the page or close and reopen the project
4. **Confirm**:
   - New message persists and appears in the chat
   - Message order is maintained
   - No duplicate messages appear

### US2: Cross-session access (Manual Test)

#### Test 2.1: Session A → Session B continuity
1. **Session A**: Sign in, create project, send 5 messages
2. **Session B** (incognito window or different browser):
   - Sign in with the same account
   - Open the same project
3. **Confirm**:
   - Session B sees the same chat history as Session A
   - Messages appear in correct order
   - Message IDs are consistent across sessions

#### Test 2.2: Concurrent writes merge correctly
1. **Session A**: Open project, send 2 messages (don't close yet)
2. **Session B**: Open same project in parallel, send 2 different messages
3. Reload the project in both sessions
4. **Confirm**:
   - Both sessions see all 4 messages
   - No messages are lost or overwritten
   - Each message appears exactly once (deduplicated by message_id)

#### Test 2.3: Server append-only behavior
1. Open DevTools Network tab
2. Send a new message in the chat
3. **Confirm**:
   - Request goes to `/api/projects/:id/messages/append` (not bulk POST)
   - Request body includes `message_id` but NOT `sequence_num`
   - Response returns `{ inserted_count: N }`
   - Server allocates sequence numbers (no conflicts)

### US3: Keep working when sync unavailable (Implemented ✓)

#### Test 3.1: Signed-out local-only chat
1. Sign out from the application
2. Open a project with existing chat history
3. **Confirm**:
   - Local cached messages are displayed
   - No 401 error or hard-fail
   - UI remains responsive
4. Send a new message while signed out
5. **Confirm**:
   - Message is stored locally
   - Message shows "pending sync" indicator (visual marker)
   - Toast notification indicates message not yet synced
6. Sign in
7. **Confirm**:
   - Pending messages automatically sync to server
   - "Pending sync" indicators clear
   - Success toast confirms sync completed

#### Test 3.2: Sync failure handling
1. Open DevTools → Network tab
2. Set throttling to "Offline"
3. Send a new message in the chat
4. **Confirm**:
   - Message is kept locally with "not yet synced" indicator
   - Sync status banner shows "Connection unavailable"
   - "Retry sync" button is available in the banner
5. Restore connectivity (disable throttling)
6. Click "Retry sync" button
7. **Confirm**:
   - Pending messages sync to server
   - Indicators clear after successful sync
   - Banner updates to "All messages synced"

#### Test 3.3: Background sync on recovery
1. Sign out, send messages (they're marked pending)
2. Sign in
3. **Confirm**:
   - Background sync automatically runs
   - No manual intervention required
   - Toast notifications show sync progress

### Phase 6: Clear Chat History & Polish (Implemented ✓)

#### Test 6.1: Clear chat history
1. Open a project with chat history
2. Look for "Clear Chat History" button (appears when chat has started)
3. Click the button
4. **Confirm**:
   - Confirmation dialog appears: "Are you sure you want to clear all chat history? This action cannot be undone."
   - After confirming, all messages are cleared from UI
   - Server messages are deleted (if authenticated)
   - Local IndexedDB messages are deleted
   - Success toast confirms: "Chat history cleared successfully"
5. Reload the page or reopen the project
6. **Confirm**:
   - Chat remains empty
   - No messages reappear

#### Test 6.2: Large chat history guardrails
1. Load a project with 1000+ messages (or simulate by loading many pages)
2. Keep clicking "Load older messages"
3. **Confirm**:
   - After loading ~1000 messages (20 pages), button stops loading
   - Info toast: "You've reached the maximum number of messages (1000). For very large chat histories, consider exporting and starting a new chat."
   - Older messages remain on server but aren't loaded for performance
   - User can still send new messages

#### Test 6.3: Load-older button disabled during streaming
1. Open a project with many messages
2. Start a long AI response (streaming)
3. Try to click "Load older messages" while streaming
4. **Confirm**:
   - Button is disabled during streaming
   - Button becomes enabled after streaming completes
   - No UI jank or freezing occurs

### Error Scenarios

#### Test E1: Network timeout handling
1. Open DevTools → Network tab → Set throttling to "Offline"
2. Try to load a project
3. **Confirm**:
   - Falls back to local cached messages (if available)
   - Shows warning toast: "Loaded from local cache - server unavailable"
   - UI doesn't hard-fail or show blank screen

#### Test E2: Authentication failure
1. Sign out
2. Try to access a project directly via URL
3. **Confirm**:
   - Shows local messages only (no server error)
   - No 401 hard-fail that blocks the route
   - User can continue chatting locally

#### Test E3: Rate limiting recovery
1. Simulate rate limiting (use Supabase RLS or custom rate limiter)
2. Send messages rapidly
3. **Confirm**:
   - Client retries with exponential backoff
   - Shows loading indicator during retry
   - Eventually succeeds or shows clear error message

## Run tests

```bash
pnpm run test
pnpm run typecheck
pnpm run lint
```

