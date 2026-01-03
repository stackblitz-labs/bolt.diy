# Quickstart: Load Project Messages on Open

**Feature**: 001-load-project-messages  
**Date**: 2025-12-27

## Overview

This guide helps developers quickly understand and implement the "Load All Project Messages" feature.

---

## Quick Summary

**Problem**: When opening a project, only 50 messages load (API default limit).

**Solution**: Implement paginated fetching to load ALL messages, with:
- Progress indicator during load
- Server/local message merging
- Exponential backoff for rate limits

---

## Key Files to Modify

| File | What to Change |
|------|----------------|
| `app/lib/persistence/db.ts` | Update `getServerMessages` to fetch all pages |
| `app/lib/persistence/useChatHistory.ts` | Add loading states, merge logic |
| `app/components/chat/Chat.client.tsx` | Render skeleton UI during load |

---

## Implementation Steps

### Step 1: Create Message Loader Module

Create `app/lib/persistence/messageLoader.ts`:

```typescript
import type { Message } from 'ai';
import type { MessageLoadProgress } from '~/types/message-loading';

export interface LoaderConfig {
  pageSize?: number;
  maxRetries?: number;
  onProgress?: (progress: MessageLoadProgress) => void;
}

export async function loadAllMessages(
  projectId: string,
  config: LoaderConfig = {}
): Promise<{ messages: Message[]; total: number; partial: boolean }> {
  const { pageSize = 100, maxRetries = 3, onProgress } = config;
  
  const allMessages: Message[] = [];
  let offset = 0;
  let total = Infinity;
  let retryCount = 0;
  
  while (offset < total) {
    try {
      const response = await fetch(
        `/api/projects/${projectId}/messages?limit=${pageSize}&offset=${offset}`
      );
      
      if (response.status === 429) {
        // Rate limited - backoff and retry
        if (retryCount >= maxRetries) {
          return { messages: allMessages, total, partial: true };
        }
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise(r => setTimeout(r, delay));
        retryCount++;
        continue;
      }
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      total = data.total;
      
      // Convert to AI SDK Message format
      const messages = data.messages.map((msg: any) => ({
        id: msg.message_id,
        role: msg.role,
        content: msg.content,
        createdAt: new Date(msg.created_at),
      }));
      
      allMessages.push(...messages);
      offset += pageSize;
      retryCount = 0;
      
      onProgress?.({
        loaded: allMessages.length,
        total,
        page: Math.ceil(offset / pageSize),
        isComplete: offset >= total,
        isRateLimited: false,
      });
      
    } catch (error) {
      throw error; // Let caller handle
    }
  }
  
  return { messages: allMessages, total, partial: false };
}
```

### Step 2: Update getServerMessages

In `app/lib/persistence/db.ts`, replace the existing function:

```typescript
export async function getServerMessages(
  projectId: string,
  onProgress?: (progress: { loaded: number; total: number }) => void
): Promise<ChatHistoryItem | null> {
  const { messages, total, partial } = await loadAllMessages(projectId, {
    pageSize: 100,
    maxRetries: 3,
    onProgress: onProgress ? (p) => onProgress({ loaded: p.loaded, total: p.total }) : undefined,
  });
  
  if (messages.length === 0) return null;
  
  return {
    id: projectId,
    messages,
    timestamp: messages[0]?.createdAt?.toISOString() || new Date().toISOString(),
  };
}
```

### Step 3: Add Loading State to useChatHistory

In `app/lib/persistence/useChatHistory.ts`:

```typescript
// Add new state
const [loadingState, setLoadingState] = useState<{
  phase: 'idle' | 'loading' | 'complete' | 'error';
  loaded: number;
  total: number | null;
}>({ phase: 'idle', loaded: 0, total: null });

// Update loadMessages function
const loadMessages = async () => {
  setLoadingState({ phase: 'loading', loaded: 0, total: null });
  
  try {
    const serverResult = await getServerMessages(projectId, (progress) => {
      setLoadingState({
        phase: 'loading',
        loaded: progress.loaded,
        total: progress.total,
      });
    });
    
    // ... rest of existing logic
    
    setLoadingState({ phase: 'complete', loaded: total, total });
  } catch (error) {
    setLoadingState({ phase: 'error', loaded: 0, total: null });
  }
};

// Return loading state
return { ready, initialMessages, loadingState, /* ... */ };
```

### Step 4: Create Skeleton Component

Create `app/components/chat/MessageSkeleton.tsx`:

```tsx
export function MessageSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-4 p-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`rounded-lg p-4 bg-bolt-elements-bg-depth-2 
              ${i % 2 === 0 ? 'w-48' : 'w-64'}`}
          >
            <div className="animate-pulse space-y-2">
              <div className="h-4 bg-bolt-elements-bg-depth-3 rounded w-3/4" />
              <div className="h-4 bg-bolt-elements-bg-depth-3 rounded w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

### Step 5: Create Progress Component

Create `app/components/chat/LoadingProgress.tsx`:

```tsx
export function LoadingProgress({
  loaded,
  total,
}: {
  loaded: number;
  total: number | null;
}) {
  const percentage = total ? Math.round((loaded / total) * 100) : 0;
  
  return (
    <div className="flex flex-col items-center gap-2 py-4">
      <div className="w-64 h-2 bg-bolt-elements-bg-depth-2 rounded-full overflow-hidden">
        <div
          className="h-full bg-bolt-elements-accent transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-sm text-bolt-elements-textSecondary">
        {total
          ? `Loading ${loaded.toLocaleString()} of ${total.toLocaleString()} messages`
          : 'Loading messages...'}
      </span>
    </div>
  );
}
```

### Step 6: Update Chat.client.tsx

```tsx
export function Chat() {
  const { projectId } = useLoaderData<{ projectId?: string }>();
  const { ready, initialMessages, loadingState, /* ... */ } = useChatHistory(projectId);
  
  // Show skeleton while loading
  if (loadingState.phase === 'loading' && loadingState.loaded === 0) {
    return (
      <>
        <Header />
        <MessageSkeleton count={6} />
        <LoadingProgress loaded={0} total={null} />
      </>
    );
  }
  
  // Show progress with partial messages
  if (loadingState.phase === 'loading' && loadingState.loaded > 0) {
    return (
      <>
        <Header />
        <ChatImpl messages={initialMessages} /* ... */ />
        <LoadingProgress loaded={loadingState.loaded} total={loadingState.total} />
      </>
    );
  }
  
  // Normal render when complete
  return ready ? <ChatImpl /* ... */ /> : <BaseChat />;
}
```

---

## Testing

### Manual Test Cases

1. **Load 500+ messages**
   - Create a project with many messages
   - Open project, verify all messages load
   - Verify progress indicator shows correct count

2. **Offline fallback**
   - Open project once (populates IndexedDB)
   - Disable network
   - Reopen project, verify local messages load

3. **Rate limiting**
   - Mock 429 response from API
   - Verify partial messages display
   - Verify retry with backoff

### Unit Test

```typescript
// tests/unit/messageLoader.test.ts
import { describe, it, expect, vi } from 'vitest';
import { loadAllMessages } from '~/lib/persistence/messageLoader';

describe('loadAllMessages', () => {
  it('fetches all pages', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => ({ messages: Array(100).fill({}), total: 250 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => ({ messages: Array(100).fill({}), total: 250 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => ({ messages: Array(50).fill({}), total: 250 }),
      });

    const result = await loadAllMessages('project-123');
    
    expect(result.messages.length).toBe(250);
    expect(result.partial).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
```

---

## Checklist

- [ ] Create `messageLoader.ts` with pagination
- [ ] Update `getServerMessages` to use loader
- [ ] Add merge logic for server + local messages
- [ ] Add loading state to `useChatHistory`
- [ ] Create `MessageSkeleton.tsx`
- [ ] Create `LoadingProgress.tsx`
- [ ] Update `Chat.client.tsx` to show loading UI
- [ ] Add unit tests
- [ ] Test with 500+ messages
- [ ] Test offline fallback
- [ ] Test rate limiting scenario

---

## Common Issues

| Issue | Solution |
|-------|----------|
| Messages load but order is wrong | Check `sequence_num` sorting in merge |
| Progress shows NaN% | Handle `total: null` case |
| Infinite loading | Check termination condition `offset >= total` |
| Duplicate messages | Verify deduplication by `message_id` |

