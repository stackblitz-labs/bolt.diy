# Implementation Plan: Load Project Messages on Open

**Branch**: `001-load-project-messages` | **Date**: 2025-12-27 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/001-load-project-messages/spec.md`

## Summary

Enhance the project opening flow to load **all** user messages belonging to a project, not limited to the current 50-message default. This requires implementing paginated fetching in the client, merging server/local messages with proper deduplication, and providing visual feedback during loading via skeleton UI with progress indicators.

## Technical Context

**Language/Version**: TypeScript 5.7.2, Node.js >=18.18.0  
**Primary Dependencies**: Remix 2.15.2, Vercel AI SDK (`ai`), Nanostores, React 18, react-toastify  
**Storage**: PostgreSQL (Supabase) for server, IndexedDB for client fallback  
**Testing**: Vitest for unit tests, Playwright for integration  
**Target Platform**: Web (Cloudflare Pages edge runtime, browser client)  
**Project Type**: Web application (Remix full-stack)  
**Performance Goals**: Load 500 messages in <5 seconds, 10,000 messages max supported  
**Constraints**: Browser memory limits (~100MB for message data), 30s Cloudflare edge timeout  
**Scale/Scope**: Up to 10,000 messages per project, exponential backoff for rate limiting

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Library-First | ✅ Pass | Changes contained within existing `lib/persistence/` module |
| Test-First | ✅ Pass | Unit tests will be added for new functions |
| Integration Testing | ✅ Pass | E2E test for message loading flow |
| Observability | ✅ Pass | Using existing logger infrastructure |
| Simplicity | ✅ Pass | Minimal changes to existing architecture |

## Project Structure

### Documentation (this feature)

```text
specs/001-load-project-messages/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (API changes if any)
└── tasks.md             # Phase 2 output
```

### Source Code (files to modify/create)

```text
app/
├── lib/
│   └── persistence/
│       ├── db.ts                    # MODIFY: Add getAllServerMessages with pagination
│       ├── useChatHistory.ts        # MODIFY: Add merge logic, loading state
│       └── messageLoader.ts         # CREATE: New module for paginated loading
├── components/
│   └── chat/
│       ├── Chat.client.tsx          # MODIFY: Add loading state props
│       ├── MessageSkeleton.tsx      # CREATE: Skeleton loading component
│       └── LoadingProgress.tsx      # CREATE: Progress indicator component
└── types/
    └── message-loading.ts           # CREATE: Types for loading state

tests/
├── unit/
│   └── messageLoader.test.ts        # CREATE: Unit tests for pagination
└── integration/
    └── project-messages.test.ts     # CREATE: E2E test for loading flow
```

**Structure Decision**: Extends existing `lib/persistence/` module with new `messageLoader.ts` for separation of concerns. UI components added to existing `components/chat/` directory.

## Complexity Tracking

No constitution violations. Implementation follows existing patterns.

---

## Phase 0: Research

### Research Tasks

1. **Pagination Strategy**: Best approach for fetching all paginated data in browser
2. **Exponential Backoff**: Standard implementation for rate limit handling
3. **Message Deduplication**: Efficient algorithm for merging two message lists by UUID
4. **Skeleton UI**: Best practices for React skeleton loading states
5. **Progress Indicators**: UX patterns for multi-step loading operations

### Findings

See [research.md](./research.md) for detailed findings.

---

## Phase 1: Design

### 1.1 Core Algorithm: Paginated Message Fetching

```text
Function: getAllServerMessages(projectId: string)

1. Initialize:
   - allMessages = []
   - offset = 0
   - pageSize = 100 (optimal batch size)
   - total = unknown
   - retryCount = 0
   - maxRetries = 3

2. Fetch Loop:
   WHILE (total is unknown OR offset < total):
     TRY:
       response = fetchPage(projectId, offset, pageSize)
       total = response.total
       allMessages.append(response.messages)
       offset += pageSize
       retryCount = 0
       
       // Emit progress for UI
       onProgress({ loaded: allMessages.length, total })
       
     CATCH RateLimitError:
       IF retryCount >= maxRetries:
         // Return partial results
         RETURN { messages: allMessages, total, partial: true }
       
       delay = calculateBackoff(retryCount) // 1s, 2s, 4s
       WAIT(delay)
       retryCount++
       
     CATCH NetworkError:
       THROW to trigger fallback

3. Return:
   { messages: allMessages, total, partial: false }
```

### 1.2 Core Algorithm: Message Merge with Deduplication

```text
Function: mergeMessages(serverMessages: Message[], localMessages: Message[])

1. Create lookup map from server messages:
   serverMap = Map<message_id, Message>
   FOR msg IN serverMessages:
     serverMap.set(msg.id, msg)

2. Identify local-only messages:
   localOnly = []
   FOR msg IN localMessages:
     IF NOT serverMap.has(msg.id):
       localOnly.push(msg)

3. Merge and sort:
   merged = [...serverMessages, ...localOnly]
   merged.sort((a, b) => a.sequence_num - b.sequence_num)

4. Return merged
```

### 1.3 Component Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                     Chat.client.tsx                          │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                   useChatHistory                         ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐ ││
│  │  │ loadingState │  │ initialMsgs  │  │ loadProgress  │ ││
│  │  └──────────────┘  └──────────────┘  └───────────────┘ ││
│  └─────────────────────────────────────────────────────────┘│
│                              │                               │
│              ┌───────────────┴───────────────┐              │
│              ▼                               ▼              │
│  ┌─────────────────────┐       ┌─────────────────────────┐ │
│  │  MessageSkeleton    │       │    LoadingProgress      │ │
│  │  (when loading)     │       │    "Loading X of Y"     │ │
│  └─────────────────────┘       └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 1.4 State Machine: Loading States

```text
States:
  - IDLE: No loading in progress
  - LOADING_SERVER: Fetching from server (show skeleton)
  - LOADING_PARTIAL: Some messages loaded, more coming (show messages + progress)
  - LOADING_LOCAL: Falling back to IndexedDB
  - COMPLETE: All messages loaded
  - ERROR: Failed to load (show error state)

Transitions:
  IDLE → LOADING_SERVER: projectId provided, user authenticated
  IDLE → LOADING_LOCAL: projectId missing or not authenticated
  LOADING_SERVER → LOADING_PARTIAL: First page received
  LOADING_SERVER → LOADING_LOCAL: Server error, fallback
  LOADING_PARTIAL → LOADING_PARTIAL: More pages fetched
  LOADING_PARTIAL → COMPLETE: All pages fetched
  LOADING_LOCAL → COMPLETE: Local messages loaded
  * → ERROR: Unrecoverable error
```

---

## Phase 2: Implementation Tasks

### Task Breakdown (High-Level)

| ID | Task | Priority | Estimate | Dependencies |
|----|------|----------|----------|--------------|
| T01 | Create `messageLoader.ts` module with pagination | P1 | 2h | None |
| T02 | Add exponential backoff utility | P1 | 1h | None |
| T03 | Update `getServerMessages` to use paginated loader | P1 | 1h | T01 |
| T04 | Implement message merge/deduplication logic | P1 | 1h | None |
| T05 | Update `useChatHistory` with merge and loading states | P1 | 2h | T03, T04 |
| T06 | Create `MessageSkeleton.tsx` component | P2 | 1h | None |
| T07 | Create `LoadingProgress.tsx` component | P2 | 1h | None |
| T08 | Update `Chat.client.tsx` to render loading states | P2 | 1h | T05, T06, T07 |
| T09 | Add empty state component | P2 | 0.5h | None |
| T10 | Unit tests for `messageLoader.ts` | P1 | 1h | T01 |
| T11 | Unit tests for merge logic | P1 | 0.5h | T04 |
| T12 | Integration test for full loading flow | P2 | 2h | T05 |

**Total Estimate**: ~14 hours

### Critical Path

```text
T01 (pagination) → T03 (getServerMessages) → T05 (useChatHistory) → T08 (UI)
       ↓
T02 (backoff) ─────────────────────────────────────────────────────────┘
       
T04 (merge) ──────────────────────────────────────→ T05
       
T06 (skeleton) ───────────────────────────────────→ T08
T07 (progress) ───────────────────────────────────→ T08
```

---

## API Contract Changes

### Existing Endpoint (No Changes Required)

The existing `/api/projects/:id/messages` endpoint already supports pagination:

```yaml
GET /api/projects/{projectId}/messages
  Query Parameters:
    - limit: number (default: 50, max: 100)
    - offset: number (default: 0)
    - order: 'asc' | 'desc' (default: 'asc')
  
  Response:
    {
      "messages": ProjectMessage[],
      "total": number
    }
```

**Note**: No server-side changes needed. The API already returns `total` count for pagination.

---

## File Changes Summary

### Modified Files

| File | Changes |
|------|---------|
| `app/lib/persistence/db.ts` | Replace `getServerMessages` with call to new paginated loader |
| `app/lib/persistence/useChatHistory.ts` | Add loading states, merge logic, progress callback |
| `app/components/chat/Chat.client.tsx` | Render skeleton/progress based on loading state |
| `app/components/chat/BaseChat.tsx` | Pass loading state props |

### New Files

| File | Purpose |
|------|---------|
| `app/lib/persistence/messageLoader.ts` | Paginated message fetching with backoff |
| `app/components/chat/MessageSkeleton.tsx` | Skeleton UI for loading state |
| `app/components/chat/LoadingProgress.tsx` | Progress indicator component |
| `app/types/message-loading.ts` | TypeScript types for loading state |
| `tests/unit/messageLoader.test.ts` | Unit tests |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Memory exhaustion with 10k messages | Low | High | Implement virtualized rendering for >5k messages (NFR-002) |
| Rate limiting during load | Medium | Medium | Exponential backoff + partial display (FR-010) |
| Slow initial load | Medium | Medium | Show skeleton immediately, stream messages as loaded |
| Data loss during merge | Low | High | Comprehensive unit tests for merge algorithm |

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Load time (500 messages) | <5 seconds | Performance test |
| Message completeness | 100% | E2E test assertion |
| UI responsiveness | No freeze >100ms | Lighthouse audit |
| Fallback success rate | 100% when offline | E2E test with network mock |

---

## Next Steps

1. Run `/speckit.tasks` to generate detailed task breakdown
2. Implement T01-T05 (core functionality) first
3. Implement T06-T09 (UI components) second
4. Add tests T10-T12 throughout
5. Manual QA with various message counts (0, 50, 500, 5000)
