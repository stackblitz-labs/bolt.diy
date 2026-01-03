# Feature Specification: Load Project Messages on Open

**Feature Branch**: `001-load-project-messages`  
**Created**: 2025-12-27  
**Status**: Draft  
**Input**: User description: "i want to update when open project -> we must load all user message belong to this project"

## Clarifications

### Session 2025-12-27

- Q: What happens when server and local IndexedDB both have messages but they differ? → A: Server wins with local preservation - use server messages but append any local-only messages not on server.
- Q: What is the maximum number of messages a project can have? → A: 10,000 messages as practical upper limit; beyond this, virtualized rendering may be needed.
- Q: How should the system handle API rate limiting during pagination? → A: Exponential backoff with partial display - show loaded messages immediately, retry remaining pages with backoff.
- Q: Which field uniquely identifies a message for deduplication? → A: message_id (UUID) is the unique identifier; sequence_num is for display ordering only.
- Q: What should the loading state UX look like? → A: Skeleton UI with progress - message-shaped placeholders + "Loading X of Y messages" progress indicator.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Load Complete Chat History (Priority: P1)

When a user opens a project they previously worked on, all their chat messages should be loaded and displayed so they can continue where they left off without losing any context.

**Why this priority**: This is the core functionality - without complete message loading, users lose conversation context which is critical for AI-assisted development workflows.

**Independent Test**: Can be fully tested by opening a project with existing messages and verifying all messages appear in the chat interface.

**Acceptance Scenarios**:

1. **Given** a project with 100+ messages stored on the server, **When** the user opens the project via `/chat/{url_id}`, **Then** all messages are loaded and displayed in the correct chronological order.

2. **Given** a project with messages containing different roles (user, assistant, system), **When** the project is opened, **Then** messages of all roles are loaded and styled appropriately.

3. **Given** a project with message annotations (hidden messages, context markers), **When** the project is opened, **Then** annotations are preserved and hidden messages remain hidden from UI while still available for context.

---

### User Story 2 - Handle Large Message Volumes (Priority: P2)

Users with long chat histories (hundreds or thousands of messages) should not experience degraded performance or incomplete data loading.

**Why this priority**: Performance issues with large histories would directly impact user experience and could cause data loss perception.

**Independent Test**: Can be tested by loading a project with 500+ messages and measuring load time and completeness.

**Acceptance Scenarios**:

1. **Given** a project with 500 messages, **When** the user opens the project, **Then** all messages are loaded within 5 seconds with a visible loading indicator.

2. **Given** a project with very large messages (long code blocks), **When** the project is opened, **Then** messages are loaded progressively without blocking the UI.

---

### User Story 3 - Fallback to Local Storage (Priority: P3)

When server storage is unavailable (network issues, unauthenticated), users should still access locally cached messages.

**Why this priority**: Offline resilience ensures users can continue working even with connectivity issues.

**Independent Test**: Can be tested by simulating offline mode and verifying local messages load.

**Acceptance Scenarios**:

1. **Given** a user is offline but has local messages cached in IndexedDB, **When** they open the project, **Then** local messages are displayed with an offline indicator.

2. **Given** server message fetch fails, **When** local messages exist, **Then** local messages are loaded and user sees a warning toast.

---

### Edge Cases

- What happens when server returns empty messages but local cache has messages? (Local messages are preserved and used)
- What happens when server and local both have messages but differ? (Server wins, local-only messages appended)
- How does system handle messages with malformed content? (Skip malformed, display valid messages)
- What happens if project ID is invalid or user doesn't have access? (Show authentication error, don't clear local cache)
- What happens when messages are being loaded and user starts typing? (Allow typing, queue new messages after load completes)
- What happens if API rate limits during pagination? (Show partial messages, exponential backoff retry for remaining)
- What happens when a project has zero messages? (Show empty state with helpful prompt to start conversation)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST load all messages belonging to a project when the project is opened, not limited to a fixed page size.
- **FR-002**: System MUST preserve message ordering by sequence number when displaying messages.
- **FR-003**: System MUST preserve message metadata (annotations, timestamps, role) when loading from server.
- **FR-004**: System MUST display a skeleton UI with message-shaped placeholders during message loading.
- **FR-004a**: System MUST show a progress indicator ("Loading X of Y messages") when total message count is known.
- **FR-004b**: System MUST display an empty state with helpful prompt when a project has zero messages.
- **FR-005**: System MUST fall back to IndexedDB storage when server fetch fails and user is authenticated.
- **FR-006**: System MUST handle pagination transparently, fetching additional pages until all messages are retrieved.
- **FR-007**: System MUST restore file snapshots alongside messages when opening a project.
- **FR-008**: System MUST handle the case where projectId is resolved from url_id via the loader.
- **FR-009**: System MUST use server messages as source of truth when both server and local messages exist, while preserving any local-only messages not found on server (append after server messages).
- **FR-010**: System MUST display already-loaded messages immediately when API rate limiting occurs during pagination, and retry remaining pages using exponential backoff.
- **FR-011**: System MUST show a visual indicator when additional messages are still being loaded after partial display.

### Key Entities

- **Project**: Container entity with id, url_id, name, and ownership information.
- **ProjectMessage**: Individual chat message with message_id (UUID, unique identifier for deduplication), sequence_num (display order), role, content, annotations, and timestamps.
- **ChatHistoryItem**: Client-side representation including messages array and metadata.

### Identity Rules

- **Message uniqueness**: `message_id` (UUID) is the canonical unique identifier across server and local storage.
- **Deduplication**: When merging server and local messages, match by `message_id` to identify duplicates.
- **Ordering**: `sequence_num` determines display order; messages with same `sequence_num` are ordered by `created_at`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can see their complete chat history when opening any project with 100+ messages.
- **SC-002**: Message loading completes within 5 seconds for projects with up to 500 messages.
- **SC-003**: 100% of messages stored on server are retrieved and displayed (no data loss).
- **SC-004**: Users with offline/network issues can still access locally cached messages.
- **SC-005**: Chat interface remains responsive during message loading (no UI freeze).

## Non-Functional Requirements

- **NFR-001**: System MUST support loading up to 10,000 messages per project as practical upper limit.
- **NFR-002**: For projects exceeding 5,000 messages, system SHOULD use virtualized rendering to maintain UI responsiveness.
- **NFR-003**: System MUST complete initial message loading within 5 seconds for projects with up to 500 messages.

## Assumptions

- User authentication is handled by Better Auth and session is available in request headers.
- The existing `/api/projects/:id/messages` endpoint is functional and returns correct data.
- IndexedDB is available in the browser environment for fallback storage.
- The current 50-message default limit in the API is configurable via query parameters.
- Projects with more than 10,000 messages are edge cases and may require archiving older messages.
