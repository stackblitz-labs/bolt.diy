# Feature Specification: User Project Tables

**Feature Branch**: `001-user-project-tables`  
**Created**: 2025-12-17  
**Status**: Draft  
**Input**: User description: "Create database tables to support: users can create many projects, projects have name/address/Google Map URL/website metadata/status, projects store generated website source code and chat history"

## Clarifications

### Session 2025-12-17

- Q: Should projects integrate with or replace existing tenants/business_profiles tables? → A: Projects integrate with existing tables (project links to tenant)
- Q: What should happen to existing IndexedDB local data? → A: No migration needed (development phase, existing local data can be discarded)
- Q: How should generated source code files be stored for editing and deployment? → A: StackBlitz/snapshot pattern - store entire FileMap as single JSONB blob per project (matches current IndexedDB structure, minimal code changes)
- Q: Should the system keep version history (multiple snapshots) or just current state? → A: Current state only (one snapshot per project, overwritten on save)
- Q: Should there be a limit on projects per user? → A: Soft limit of 10 projects per user (can be increased later)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create New Project (Priority: P1)

A logged-in user wants to start a new website project for their restaurant. They provide basic information (name, address, Google Map URL) and begin building their website through chat interactions.

**Why this priority**: Core functionality - without project creation, no other features can work. This enables users to persist their work across sessions and devices.

**Independent Test**: Can be fully tested by creating a project with basic info and verifying it persists after logout/login.

**Acceptance Scenarios**:

1. **Given** a logged-in user, **When** they create a new project with name "My Restaurant", **Then** the project is saved and appears in their project list
2. **Given** a logged-in user with no projects, **When** they access the dashboard, **Then** they see an option to create their first project
3. **Given** a user creating a project, **When** they provide an address and Google Map URL, **Then** this information is stored with the project

---

### User Story 2 - Chat History Persistence (Priority: P1)

A user building their website through chat wants their conversation history to be saved so they can continue where they left off, even from a different device.

**Why this priority**: Essential for AI-assisted website building - losing chat context means losing the ability to make iterative improvements.

**Independent Test**: Can be tested by having a conversation, closing the browser, reopening, and verifying all messages are restored.

**Acceptance Scenarios**:

1. **Given** a user with an active project chat, **When** they send messages to the AI, **Then** all messages are persisted to the project
2. **Given** a user who previously worked on a project, **When** they reopen the project, **Then** they see their complete chat history
3. **Given** a user on device A with chat history, **When** they log in on device B, **Then** they see the same chat history

---

### User Story 3 - Source Code Persistence (Priority: P1)

A user wants their generated website code to be saved so they can continue editing, preview, and deploy it later without regenerating everything.

**Why this priority**: Critical for user productivity - regenerating code is time-consuming and may produce different results.

**Independent Test**: Can be tested by generating code, closing browser, reopening project, and verifying all files are restored exactly as they were.

**Acceptance Scenarios**:

1. **Given** a project with AI-generated code, **When** the user closes their session, **Then** all file contents are saved
2. **Given** a saved project with code, **When** the user reopens it, **Then** all files are restored to the workspace
3. **Given** large generated codebase, **When** saving the project, **Then** all files up to reasonable size limits are preserved

---

### User Story 4 - Project Management (Priority: P2)

A user with multiple restaurant websites wants to organize, rename, and manage their projects from a central dashboard.

**Why this priority**: Secondary to core creation/persistence but essential for users with multiple projects.

**Independent Test**: Can be tested by creating multiple projects and verifying list, rename, and delete operations work correctly.

**Acceptance Scenarios**:

1. **Given** a user with multiple projects, **When** they view their dashboard, **Then** they see a list of all their projects with names and last modified dates
2. **Given** a user viewing their projects, **When** they rename a project, **Then** the new name is saved and displayed
3. **Given** a user viewing their projects, **When** they delete a project, **Then** the project and all associated data is removed

---

### User Story 5 - Project Status Workflow (Priority: P2)

A user wants to track the state of their project through different lifecycle stages (draft, published, archived).

**Why this priority**: Helps users organize work-in-progress vs completed projects.

**Independent Test**: Can be tested by changing project status and verifying it persists and filters work.

**Acceptance Scenarios**:

1. **Given** a new project, **When** created, **Then** it starts in "draft" status
2. **Given** a draft project, **When** the user deploys it, **Then** the status changes to "published"
3. **Given** a user with many projects, **When** they filter by status, **Then** only matching projects are shown

---

### Edge Cases

- What happens when a user tries to create a project with a duplicate name? System allows it but adds a unique identifier
- How does system handle very large chat histories (1000+ messages)? Pagination and lazy loading
- What happens if source code storage limit is exceeded? User is notified and guided to reduce file count
- How does system handle concurrent edits from multiple devices? Last-write-wins with conflict notification
- What happens to projects if user account is deleted? Projects are permanently deleted (cascade)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow authenticated users to create new projects
- **FR-002**: System MUST store project metadata including name, address, Google Map URL, and website metadata
- **FR-003**: System MUST support project status values: draft, published, archived
- **FR-004**: System MUST persist chat messages associated with each project
- **FR-005**: System MUST preserve message order, role (user/assistant), content, and timestamps
- **FR-006**: System MUST store generated website source code as FileMap snapshot (JSONB) for each project
- **FR-007**: System MUST support both text and binary content within the FileMap structure
- **FR-008**: System MUST maintain file path structure within the snapshot
- **FR-009**: System MUST enforce that users can only access their own projects
- **FR-010**: System MUST cascade delete all associated data when a project is deleted
- **FR-011**: System MUST allow users to rename projects
- **FR-012**: System MUST track project creation and last modified timestamps
- **FR-013**: System MUST support retrieving paginated project lists for a user
- **FR-014**: System MUST support restoring workspace state from stored source code
- **FR-015**: System MUST support saving full FileMap snapshot on each save operation (mirrors current IndexedDB behavior)
- **FR-016**: System MUST support generating deployment packages from stored FileMap snapshot
- **FR-017**: System MUST enforce a soft limit of 10 projects per user (configurable)

### Key Entities

- **Project**: The central entity representing a user's website project. Contains name, status, and timestamps. Owned by exactly one user. Links to an existing `tenant` record for business identity and to `business_profile` for address, Google Map URL, and website metadata.

- **Chat Message**: Individual messages within a project's conversation. Contains role (user/assistant/system), content (text or structured), annotations, and timestamp. Belongs to exactly one project, ordered sequentially.

- **Project Snapshot**: Point-in-time capture of entire project file system stored as single JSONB blob (FileMap structure). Contains all file paths, contents, and binary flags. Mirrors current IndexedDB snapshot structure for minimal migration effort.


## Assumptions

- Users are authenticated via existing Better Auth system
- File storage follows StackBlitz pattern: entire FileMap stored as single JSONB snapshot (mirrors current IndexedDB structure for minimal migration)
- Chat message content follows existing AI SDK message format
- Source code files are limited to reasonable sizes (individual files <10MB, total project <100MB)
- Project metadata structure follows patterns established in existing `business_profiles` table
- No migration of existing IndexedDB data required (development phase - local data can be discarded)
- No version history required initially - only current state stored (one snapshot per project)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can create a new project and see it in their list within 2 seconds
- **SC-002**: Chat history loads completely when opening a project within 3 seconds for conversations up to 500 messages
- **SC-003**: Generated source code restores to workspace within 5 seconds for projects up to 100 files
- **SC-004**: Users can access their projects from any device after logging in
- **SC-005**: 100% of project data is preserved across browser sessions without data loss
- **SC-006**: Project list displays correctly for users with up to 10 projects (soft limit)
- **SC-007**: System handles concurrent access from multiple browser tabs without data corruption
