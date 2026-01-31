---
description: Create Beads issues directly from Speckit spec artifacts (no tasks.md needed)
argument-hint: <specs/feature-dir> [--dry-run] [--update]
---

# Create Beads Issues from Speckit Specification

You are creating Beads issues directly from a Speckit feature specification.

**Key principle**: Derive tasks directly from spec.md, plan.md, data-model.md, and contracts/. Beads issues ARE the task list—no separate tasks.md needed.

---

## Hard Rules

1. **VERIFY BEADS CLI** - Stop if `bd` is not installed
2. **DERIVE FROM SPEC** - Generate tasks from user stories, entities, and contracts
3. **MINIMAL DEPS** - Only add phase-level dependencies, not task-to-task
4. **MATCH CODEBASE** - Use Remix/TS paths (`app/...`, `test/...`, `tests/...`)
5. **RESPECT --dry-run** - No `bd create` or `bd update` commands if dry-run

---

## Phase 0 — Preconditions & Intake (MANDATORY)

### 0.1 Parse Arguments

From `$ARGUMENTS` extract:
- **Required**: `FEATURE_DIR` (e.g., `specs/001-project-chat-sync`)
- **Optional**:
  - `--dry-run` - Plan only, no Beads commands
  - `--update` - Update existing issues instead of creating new ones

If `FEATURE_DIR` is missing, stop and show usage:
```text
/speckit.beads specs/<feature-dir> [--dry-run] [--update]
```

### 0.2 Verify Beads CLI

```bash
bd --version
```

If `bd` is not available: **STOP** and instruct:
```text
⛔ BEADS CLI NOT FOUND
Install beads: https://github.com/steveyegge/beads
```

### 0.3 Validate Feature Directory

```bash
ls -la "$FEATURE_DIR"
```

**Required files**:
- `spec.md` - User stories and requirements
- `plan.md` - Technical plan and structure

**Optional files** (enhance task generation):
- `data-model.md` - Entity definitions → model/migration tasks
- `research.md` - Technical decisions → setup tasks
- `quickstart.md` - Validation scenarios → test tasks
- `contracts/` - API specifications → endpoint tasks
- `checklists/` - Quality gates → verification tasks

If `spec.md` or `plan.md` is **missing**, stop and instruct:
```text
⛔ REQUIRED FILES MISSING

Ensure these exist:
  $FEATURE_DIR/spec.md
  $FEATURE_DIR/plan.md

Run /speckit.specify first if needed.
```

---

## Phase 1 — Load Spec Artifacts (MANDATORY)

Read files in this order to build context:

### 1.1 Read Core Files

```bash
cat "$FEATURE_DIR/spec.md"
cat "$FEATURE_DIR/plan.md"
```

**Extract from spec.md:**
- Feature name and branch
- User Stories (US1, US2, US3...) with priorities and titles
- Acceptance scenarios for each story
- Functional Requirements (FR-*)
- Success Criteria (SC-*)
- Edge cases

**Extract from plan.md:**
- Technical stack
- Project structure paths
- Phase breakdown
- Key dependencies/libraries

### 1.2 Read Optional Files (if present)

```bash
cat "$FEATURE_DIR/data-model.md" 2>/dev/null
cat "$FEATURE_DIR/research.md" 2>/dev/null
cat "$FEATURE_DIR/quickstart.md" 2>/dev/null
ls "$FEATURE_DIR/contracts/" 2>/dev/null && cat "$FEATURE_DIR/contracts/"* 2>/dev/null
ls "$FEATURE_DIR/checklists/" 2>/dev/null && cat "$FEATURE_DIR/checklists/"* 2>/dev/null
```

**Extract from data-model.md:**
- Entities and their attributes
- Relationships between entities
- Validation rules

**Extract from contracts/:**
- Endpoints (method, path)
- Request/response schemas
- Auth requirements

### 1.3 Print Load Summary

```text
📁 SPEC ARTIFACTS LOADED
════════════════════════════════
Feature: [name from spec.md]
Branch: [branch from spec.md]

Loaded:
  ✓ spec.md - [X] user stories, [Y] FRs
  ✓ plan.md - tech stack captured
  ◦ data-model.md - [X] entities / not found
  ◦ research.md - [found/not found]
  ◦ contracts/ - [X] endpoints / not found
  ◦ checklists/ - [X] items / not found
════════════════════════════════
```

---

## Phase 2 — Derive Task Structure

Generate tasks from spec artifacts (DO NOT read tasks.md):

### 2.1 Setup Tasks (from plan.md)

Generate tasks for:
- Project structure setup
- Dependencies installation
- Configuration files
- Base infrastructure (logging, error handling)

### 2.2 Foundation Tasks (from data-model.md + plan.md)

Generate tasks for shared components:
- Core models/entities that multiple stories need
- Database migrations
- Shared services/utilities
- Authentication/authorization (if applicable)

### 2.3 User Story Tasks (from spec.md + contracts/ + data-model.md)

For EACH user story, generate tasks:
- **Models**: Entities specific to this story (from data-model.md)
- **Services**: Business logic for this story
- **Endpoints**: API routes for this story (from contracts/)
- **UI**: Components/routes for this story
- **Validation**: Acceptance scenario verification

### 2.4 Polish Tasks (from checklists/ + quickstart.md)

Generate tasks for:
- Documentation updates
- Performance optimization
- Security hardening
- Final validation against quickstart.md

### 2.5 Print Derived Structure

```text
📋 DERIVED TASK STRUCTURE
════════════════════════════════
Setup:       [X] tasks
Foundation:  [Y] tasks
US1 [Title]: [Z1] tasks
US2 [Title]: [Z2] tasks
US3 [Title]: [Z3] tasks
Polish:      [W] tasks
────────────────────────────────
Total: [T] tasks to create
════════════════════════════════
```

---

## Phase 3 — Create Beads Issues

### 3.1 Create Feature Epic

```bash
bd create "Epic: [Feature Name]" -t epic -p 1 \
  --description "## Overview
[2-3 sentence summary from spec.md]

## User Stories
- US1: [Title] (P1)
- US2: [Title] (P2)
- US3: [Title] (P3)

## Tech Stack
[From plan.md]

## Source
Spec: $FEATURE_DIR

## Verification Gates
\`\`\`bash
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run build
\`\`\`" --json
```

Save the returned ID as `$FEATURE_EPIC_ID`.

### 3.2 Create Phase Epics

**Foundation Epic**:

```bash
bd create "Foundation: Setup + Core Infrastructure" -t epic -p 0 \
  --description "## Purpose
Shared infrastructure that ALL user stories depend on.

## Scope
- Project initialization
- Core models and shared services
- Base infrastructure

## Exit Criteria
All foundational work complete. User story implementation can begin.

## Source
Derived from: plan.md, data-model.md" \
  --deps $FEATURE_EPIC_ID --json
```

Save as `$FOUNDATION_EPIC_ID`.

**User Story Epics** (one per story from spec.md):

```bash
bd create "US1: [Story Title]" -t epic -p 1 \
  --description "## Goal
[From spec.md - story description]

## Independent Test
[From spec.md - how to verify this story works alone]

## Acceptance Scenarios
[From spec.md - Given/When/Then scenarios]

## Source
Derived from: spec.md US1" \
  --deps $FEATURE_EPIC_ID,$FOUNDATION_EPIC_ID --json
```

Repeat for US2, US3, etc.

**Polish Epic**:

```bash
bd create "Polish: Cross-Cutting Concerns" -t epic -p 3 \
  --description "## Purpose
Final improvements affecting all user stories.

## Scope
- Documentation
- Performance optimization
- Security hardening
- Final validation

## Source
Derived from: checklists/, quickstart.md" \
  --deps $FEATURE_EPIC_ID --json
```

### 3.3 Create Task Issues

**Task naming convention**: `[Phase].[Number]: [Action] [Target] in [path]`

**Setup/Foundation tasks**:

```bash
bd create "Setup.1: Initialize project structure" -t task -p 2 \
  --description "## Task
Create base project structure per plan.md

## Files
[Paths from plan.md project structure section]

## Source
Derived from: plan.md" \
  --deps $FOUNDATION_EPIC_ID --json
```

**Entity tasks** (from data-model.md):

```bash
bd create "US1.1: Create [Entity] model in app/lib/models/[entity].ts" -t task -p 2 \
  --description "## Task
Implement [Entity] model with attributes and validation

## Entity Details
[From data-model.md - attributes, relationships, validation rules]

## Files
- app/lib/models/[entity].ts

## Source
Derived from: data-model.md" \
  --deps $US1_EPIC_ID --json
```

**Endpoint tasks** (from contracts/):

```bash
bd create "US1.2: Implement [METHOD] [path] endpoint in app/routes/api.[name].ts" -t task -p 2 \
  --description "## Task
Implement API endpoint per contract specification

## Contract
- Method: [METHOD]
- Path: [path]
- Request: [schema summary]
- Response: [schema summary]

## Files
- app/routes/api.[name].ts

## Source
Derived from: contracts/[file]" \
  --deps $US1_EPIC_ID --json
```

**Parent assignment rules**:
- Setup/Foundation tasks → `$FOUNDATION_EPIC_ID`
- Tasks for US1 → `$US1_EPIC_ID`
- Tasks for US2 → `$US2_EPIC_ID`
- Polish tasks → `$POLISH_EPIC_ID`

---

## Phase 4 — Wire Dependencies (MINIMAL)

### 4.1 Phase Gating Only

All user story epics depend on Foundation completion:

```bash
bd dep add $US1_EPIC_ID $FOUNDATION_EPIC_ID --type blocks --json
bd dep add $US2_EPIC_ID $FOUNDATION_EPIC_ID --type blocks --json
bd dep add $US3_EPIC_ID $FOUNDATION_EPIC_ID --type blocks --json
```

### 4.2 Skip Task-Level Dependencies

**DO NOT** create task-to-task dependencies. Let the developer determine execution order within each story.

### 4.3 Verify No Cycles

```bash
bd dep cycles --json
```

---

## Phase 5 — Verification (MANDATORY)

### 5.1 Structural Check

```bash
bd list --json | head -50
```

Verify:
- [ ] Feature Epic exists
- [ ] Foundation Epic exists
- [ ] One Epic per user story from spec.md
- [ ] Tasks cover all entities from data-model.md
- [ ] Tasks cover all endpoints from contracts/

### 5.2 Ready Work Check

```bash
bd ready --json
```

Verify:
- [ ] Foundation tasks are ready (no blockers)
- [ ] User story tasks are blocked until Foundation completes

### 5.3 Print Summary

```text
✅ SPECKIT → BEADS IMPORT COMPLETE
════════════════════════════════════════

📁 Source: $FEATURE_DIR

📊 Created:
   1 Feature Epic
   1 Foundation Epic
   [N] User Story Epics
   1 Polish Epic
   [T] Task Issues

🔗 Dependencies:
   Phase gating: [X] edges
   No task-level deps (by design)
   No cycles detected

📋 Coverage:
   User Stories: [X]/[X] covered
   Entities: [Y]/[Y] covered
   Endpoints: [Z]/[Z] covered

🚀 Ready to Start:
   [List first 3 ready tasks from Foundation]

════════════════════════════════════════
Next: bd ready
```

---

## --update Mode (Re-import)

When `--update` flag is provided:

1. Search for existing issues by feature name:
   ```bash
   bd list --json | grep "[Feature Name]"
   ```

2. Compare derived tasks with existing issues:
   - If issue exists for a task → update description if spec changed
   - If no match → create new issue

3. Do NOT delete issues (they may have work in progress)

4. Print update summary:
   ```text
   📝 UPDATE SUMMARY
   ════════════════════════════════
   Updated: [X] issues
   Created: [Y] new issues
   Skipped: [Z] unchanged
   ════════════════════════════════
   ```

---

## --dry-run Mode

When `--dry-run` is provided:
- Execute Phase 0-2 (loading and deriving)
- Print what WOULD be created
- Do NOT execute any `bd` commands

Print:
```text
🧪 DRY RUN - No changes made

Would create:
- Epic: [Feature Name]
- Foundation Epic ([X] tasks)
- US1: [Title] ([Y] tasks)
- US2: [Title] ([Z] tasks)
- Polish Epic ([W] tasks)

Total: [T] issues

Would add dependencies:
- Foundation blocks all user stories
```

---

## Error Handling

### Missing Required Files
Stop and instruct to run `/speckit.specify` or `/speckit.plan` first.

### Beads CLI Not Found
Stop and provide installation link.

### Empty Spec Sections
If spec.md has no user stories or requirements:
```bash
bd create "Clarify: spec.md missing user stories" -t task -p 1 --json
```

### No Entities/Contracts
If data-model.md and contracts/ are both missing, generate only story-level tasks from spec.md acceptance scenarios.

---

## Quick Reference

```bash
# Create issues from a spec
/speckit.beads specs/001-my-feature/

# Dry run first
/speckit.beads specs/001-my-feature/ --dry-run

# Re-import after spec changes
/speckit.beads specs/001-my-feature/ --update

# After import
bd ready           # See actionable work
bd show <id>       # View issue details
bd update <id> --status in_progress

# Implement a task
/implement-beads <id>

# Close when done
bd close <id> --reason "Implemented and verified"
```

---

## Architecture Quick Reference (This Codebase)

```
app/                         # Remix source
├── routes/                  # Remix routes (loaders/actions + UI)
│   ├── api.*.ts            # API routes (server-only)
│   └── *.tsx               # Page routes
├── components/             # React/UI components
├── lib/                    # Business logic, integrations
│   ├── modules/llm/        # LLM providers + registry
│   ├── runtime/            # WebContainer action runner
│   └── stores/             # nanostores/zustand state
├── styles/                 # UnoCSS, design tokens
└── utils/                  # Shared utilities

Testing
────────────────────────────
test/                       # Vitest unit/integration tests
tests/                      # Playwright E2E tests

Verification Gates
────────────────────────────
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run build
```
