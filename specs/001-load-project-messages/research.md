# Research: Load Project Messages on Open

**Feature**: 001-load-project-messages  
**Date**: 2025-12-27

## 1. Pagination Strategy for Browser-Based Fetching

### Decision
Use **sequential pagination with async iteration** - fetch pages one at a time, yielding results as they arrive.

### Rationale
- Allows displaying partial results immediately (FR-010)
- Easier to implement backoff between requests
- Memory-efficient (no need to hold all promises)
- Compatible with React's streaming patterns

### Alternatives Considered

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| Parallel fetch all pages | Faster total time | Memory spike, harder to show progress | ❌ Rejected |
| Sequential with yield | Progressive display, memory efficient | Slightly slower total | ✅ Selected |
| Cursor-based pagination | No offset drift | API doesn't support cursors | ❌ Not available |
| Single large request | Simplest | Timeout risk, no progress | ❌ Rejected |

### Implementation Pattern

```typescript
async function* fetchAllPages<T>(
  fetcher: (offset: number) => Promise<{ items: T[]; total: number }>,
  pageSize: number = 100
): AsyncGenerator<{ items: T[]; loaded: number; total: number }> {
  let offset = 0;
  let total = Infinity;
  const allItems: T[] = [];

  while (offset < total) {
    const response = await fetcher(offset);
    total = response.total;
    allItems.push(...response.items);
    offset += pageSize;
    
    yield {
      items: [...allItems],
      loaded: allItems.length,
      total
    };
  }
}
```

---

## 2. Exponential Backoff Implementation

### Decision
Use **exponential backoff with jitter** - base delay doubles each retry with random jitter to prevent thundering herd.

### Rationale
- Industry standard for rate limiting (used by AWS, Google, etc.)
- Jitter prevents synchronized retries from multiple clients
- Configurable max retries and delays

### Implementation

```typescript
interface BackoffConfig {
  baseDelay: number;      // Initial delay in ms (default: 1000)
  maxDelay: number;       // Maximum delay cap (default: 30000)
  maxRetries: number;     // Max retry attempts (default: 3)
  jitterFactor: number;   // Random factor 0-1 (default: 0.1)
}

function calculateBackoff(attempt: number, config: BackoffConfig): number {
  const exponentialDelay = config.baseDelay * Math.pow(2, attempt);
  const cappedDelay = Math.min(exponentialDelay, config.maxDelay);
  const jitter = cappedDelay * config.jitterFactor * Math.random();
  return cappedDelay + jitter;
}
```

### Retry Decision Matrix

| Error Type | Should Retry | Backoff |
|------------|--------------|---------|
| 429 Rate Limited | Yes | Exponential |
| 5xx Server Error | Yes | Exponential |
| 408 Timeout | Yes | Exponential |
| 401 Unauthorized | No | - |
| 403 Forbidden | No | - |
| 404 Not Found | No | - |
| Network Error | Yes | Exponential |

---

## 3. Message Deduplication Algorithm

### Decision
Use **Map-based O(n+m) deduplication** by `message_id` UUID.

### Rationale
- O(n+m) time complexity (n=server, m=local)
- Single pass through each list
- UUID guarantees no false positives
- Preserves server ordering as source of truth

### Algorithm

```typescript
function mergeMessages(
  serverMessages: Message[],
  localMessages: Message[]
): Message[] {
  // Build set of server message IDs (O(n))
  const serverIds = new Set(serverMessages.map(m => m.id));
  
  // Find local-only messages (O(m))
  const localOnly = localMessages.filter(m => !serverIds.has(m.id));
  
  // Merge: server messages + local-only, sorted by sequence
  const merged = [...serverMessages, ...localOnly];
  
  // Sort by sequence_num, then created_at for ties
  merged.sort((a, b) => {
    const seqDiff = (a.sequence_num ?? 0) - (b.sequence_num ?? 0);
    if (seqDiff !== 0) return seqDiff;
    return new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime();
  });
  
  return merged;
}
```

### Edge Cases

| Scenario | Handling |
|----------|----------|
| Duplicate message_id with different content | Server wins (source of truth) |
| Local message with no sequence_num | Assign max(server_seq) + index |
| Empty server response | Use all local messages |
| Empty local cache | Use all server messages |

---

## 4. Skeleton UI Best Practices

### Decision
Use **content-aware skeleton placeholders** that match message bubble shapes.

### Rationale
- Reduces perceived loading time by 30-40% (UX research)
- Sets correct expectations for incoming content
- Consistent with modern chat applications (Slack, Discord)

### Implementation Pattern

```tsx
// MessageSkeleton.tsx
function MessageSkeleton({ role }: { role: 'user' | 'assistant' }) {
  const alignment = role === 'user' ? 'justify-end' : 'justify-start';
  const width = role === 'user' ? 'w-48' : 'w-64';
  
  return (
    <div className={`flex ${alignment} mb-4`}>
      <div className={`${width} rounded-lg p-4 bg-bolt-elements-bg-depth-2`}>
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-bolt-elements-bg-depth-3 rounded w-3/4" />
          <div className="h-4 bg-bolt-elements-bg-depth-3 rounded w-1/2" />
        </div>
      </div>
    </div>
  );
}

// Show alternating user/assistant skeletons
function MessageSkeletonList({ count = 6 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <MessageSkeleton key={i} role={i % 2 === 0 ? 'user' : 'assistant'} />
      ))}
    </>
  );
}
```

### Animation

- Use CSS `animate-pulse` for shimmer effect
- Stagger animation delays for visual flow
- Match actual message bubble dimensions

---

## 5. Progress Indicator UX

### Decision
Use **determinate progress bar** with message count when total is known.

### Rationale
- Total count available from first API response
- Determinate progress reduces anxiety (UX research)
- Text provides concrete information

### Implementation

```tsx
function LoadingProgress({ loaded, total }: { loaded: number; total: number }) {
  const percentage = total > 0 ? Math.round((loaded / total) * 100) : 0;
  
  return (
    <div className="flex flex-col items-center gap-2 py-4">
      <div className="w-64 h-2 bg-bolt-elements-bg-depth-2 rounded-full overflow-hidden">
        <div 
          className="h-full bg-bolt-elements-accent transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-sm text-bolt-elements-textSecondary">
        Loading {loaded.toLocaleString()} of {total.toLocaleString()} messages
      </span>
    </div>
  );
}
```

### States

| State | Display |
|-------|---------|
| Unknown total | "Loading messages..." (indeterminate) |
| Known total | "Loading X of Y messages" (determinate) |
| Rate limited | "Loading paused, retrying..." |
| Complete | Hide progress, show messages |

---

## 6. Existing Codebase Integration Points

### Files to Modify

| File | Current Behavior | Required Change |
|------|-----------------|-----------------|
| `db.ts:getServerMessages` | Fetches single page (50 messages) | Call new paginated loader |
| `useChatHistory.ts` | Simple server/local fallback | Add merge logic, loading states |
| `Chat.client.tsx` | Shows messages when ready | Show skeleton during load |

### Existing Utilities to Leverage

| Utility | Location | Purpose |
|---------|----------|---------|
| `withRetry` | `app/lib/utils/retry.ts` | Already has retry logic (can extend) |
| `createScopedLogger` | `app/utils/logger.ts` | Logging infrastructure |
| `toast` | `react-toastify` | User notifications |

### Type Definitions Available

```typescript
// From app/types/project.ts
interface ProjectMessage {
  id: string;
  project_id: string;
  message_id: string;
  sequence_num: number;
  role: 'user' | 'assistant' | 'system';
  content: unknown;
  annotations: JSONValue[] | null;
  created_at: string;
}

// From ai package
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt?: Date;
  // ... other fields
}
```

---

## 7. Performance Considerations

### Memory Budget

| Message Count | Estimated Memory | Notes |
|---------------|------------------|-------|
| 500 | ~5 MB | Comfortable |
| 5,000 | ~50 MB | Needs virtualization |
| 10,000 | ~100 MB | Upper limit |

### Network Requests

| Message Count | API Calls (100/page) | Estimated Time |
|---------------|---------------------|----------------|
| 500 | 5 | ~2.5s |
| 5,000 | 50 | ~25s |
| 10,000 | 100 | ~50s |

### Optimization Opportunities

1. **Parallel snapshot fetch**: Load snapshot while fetching messages
2. **IndexedDB caching**: Cache server responses for offline
3. **Compression**: API could support gzip (already likely enabled)
4. **Incremental sync**: Only fetch messages newer than last sync (future enhancement)

---

## Summary

All research questions resolved. No NEEDS CLARIFICATION items remain. Ready to proceed to Phase 1 design and implementation.

