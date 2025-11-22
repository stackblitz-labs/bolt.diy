# Feature Specification: Phase 1 Implementation Plan

**Feature Branch**: `001-phase1-plan`  
**Created**: 2025-11-21  
**Status**: Draft  
**Input**: User description: "base on @system-overview.md and current codebase i want to create high level Implementation plan to completed requirements in @Phase1.md"

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
  
  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - Generate Ready-to-Edit Site (Priority: P1)

Restaurant operators launch the PCC (Prompt Command Center), submit their business links, and receive a fully populated premium template that reflects crawled data and synthesized marketing copy.

**Why this priority**: Without a reliable end-to-end initial generation, none of the downstream editing or review loops deliver value.

**Independent Test**: Provide a valid Google Maps URL and confirm a complete preview loads with branded copy, theme, hero image, testimonials, and menu populated from crawled sources.

**Acceptance Scenarios**:

1. **Given** a valid restaurant URL, **When** the orchestrator runs the crawler → content → website pipeline, **Then** the user sees a rendered preview with correct business fundamentals (name, address, hours).
2. **Given** customer reviews fetched during crawling, **When** the content agent synthesizes testimonials, **Then** the hero, about, menu, and testimonial sections reference those review insights verbatim or paraphrased.
3. **Given** multiple templates in the registry, **When** the content agent classifies the brand archetype, **Then** the selected template matches the documented template-selection criteria.

**Quality & Compliance Checks**:

- **Code Quality**: Changes to `app/routes/api.site.generate.ts`, `app/lib/services/contentAgent.server.ts`, and `app/lib/modules/templates/schema.ts` must land with typed contracts documented inline and pass `pnpm run lint`, `pnpm run typecheck`, and `pnpm run test`.
- **Testing**: `tests/integration/api.site.generate.test.ts`, `tests/integration/api.site.generate.resume.test.ts`, and `tests/unit/templates/schema.test.ts` must fail before the feature and pass afterward; Playwright journeys in `tests/playwright/pcc-error-states.spec.ts` and `tests/playwright/pcc-resume-flow.spec.ts` cover UI error/resume flows.
- **UX States**: `app/components/workbench/PromptCommandCenter.tsx` must present idle, loading (SSE timeline), success, and error/resume states with ARIA updates validated via `tests/playwright/pcc-data-prompt.spec.ts`.
- **Performance**: `SwitchableStream` heartbeats and `performance.mark('api.site.generate')` instrumentation (logged via `app/utils/logger.ts`) must show p95 generation < 3 min and heartbeat gaps <10 s in CI telemetry.

---

### User Story 2 - Iterate via Natural Language Edits (Priority: P2)

After the first draft loads, the operator issues natural-language change requests (e.g., “Change the price of the lasagna to $18”) and sees those edits reflected within seconds.

**Why this priority**: The interactive editing loop is the main differentiator; without reliable intent classification and file updates the MVP fails usability metrics.

**Independent Test**: Trigger at least five diverse edit commands (content, pricing, colors, testimonials) and verify each is applied correctly without manual file edits.

**Acceptance Scenarios**:

1. **Given** a running preview, **When** the user submits a content edit, **Then** the classifier produces a structured command that updates the targeted JSON path only.
2. **Given** sequential edits, **When** the build service detects changes, **Then** the preview refresh occurs within 20 seconds of the user command.
3. **Given** conflicting edit requests (e.g., invalid menu item), **When** the system cannot fulfill the command, **Then** a clear error is surfaced without corrupting prior content.

**Quality & Compliance Checks**:

- **Code Quality**: `app/lib/services/intentClassifier.server.ts`, `app/lib/webcontainer/mutationRunner.ts`, and `app/routes/api.site.modify.ts` must document command schemas, avoid `any`, and pass repo-wide lint/typecheck/test commands.
- **Testing**: `tests/unit/orchestrator/intentClassifier.test.ts`, `tests/unit/orchestrator/errorHandling.test.ts`, and `tests/playwright/pcc-edit-loop.spec.ts` must cover classifier confidence thresholds, optimistic locking, and five-edit SLA flows.
- **UX States**: Prompt input + result panels in `app/components/workbench/PromptCommandCenter.tsx` must expose idle, streaming, success, and error/retry states with keyboard focus traps verified in `tests/playwright/pcc-edit-loop.spec.ts`.
- **Performance**: Telemetry emitted from `app/routes/api.site.modify.ts` (`performance.mark('edit-loop')` + command duration logs) must demonstrate ≥95 % edits finishing under 20 s before launch.

---

### User Story 3 - Preserve and Share Site Versions (Priority: P3)

Once satisfied, the operator saves a labeled snapshot so the site can be reviewed, restored, or deployed later.

**Why this priority**: Persisted versions enable QA, sales reviews, and user confidence ahead of public launch.

**Independent Test**: From the PCC, trigger “Save Version,” confirm metadata stored in the database, and verify the archive is downloadable/restorable into a fresh workspace.

**Acceptance Scenarios**:

1. **Given** a generated site, **When** the user saves a snapshot, **Then** a version label, template reference, and storage pointer are persisted in the database.
2. **Given** multiple saved versions, **When** the user requests a restore, **Then** the selected snapshot rehydrates the workspace without needing another crawl.

**Quality & Compliance Checks**:

- **Code Quality**: Snapshot modules (`app/lib/services/snapshotService.server.ts`, `app/lib/persistence/siteSnapshots.ts`, `app/routes/api.snapshot.save.ts`, `app/routes/api.snapshot.restore.ts`) must declare Zod/TypeScript contracts for metadata and reference them in code comments, shipping only after `pnpm` lint/typecheck/test succeed.
- **Testing**: `tests/unit/persistence/siteSnapshots.test.ts`, integration harnesses for save/restore stubs, and `tests/playwright/snapshot-flow.spec.ts` must cover failure + success paths and artifact download/rehydration.
- **UX States**: Save/Restore controls inside `app/components/workbench/PromptCommandCenter.tsx` must expose idle/loading/success/error toasts plus disabled controls during uploads; Playwright smoke tests assert ARIA announcements.
- **Performance**: Snapshot save + restore flows instrumented with `performance.mark('snapshot-save')`/`'snapshot-restore'` and R2 latency logs must prove archives write/rehydrate within 60 s p95 and surface telemetry in `app/utils/logger.ts`.

---


### Edge Cases

- Crawler receives a valid URL but Google Places returns partial data → system must fall back to default copy blocks while flagging missing fields in the PCC.
- Content agent cannot find high-quality reviews (e.g., new business) → site still renders using neutral copy and an empty testimonials carousel while prompting user to provide text.
- Template selection produces a layout that lacks required sections (e.g., menu component) → orchestrator must rerun selection with guardrails before handing off to Website Agent.
- Build service exceeds Cloudflare timeout during first generation → orchestrator streams heartbeats via SSE and, if still running after 3 minutes, surfaces a resume option instead of failing silently.
- Concurrent edits from AI and user conflict → lock the affected file region and queue follow-up instructions once the previous command completes.
- No review meets testimonial quality → render neutral testimonial block and prompt operator to supply quotes.

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: The Premium Template Library MUST include at least three production-grade templates with shared data schemas (content JSON, theme tokens, testimonials block) ready for automated cloning.
- **FR-002**: A Template Registry MUST expose metadata (industry fit, tone, supported sections) so the Content Agent can programmatically select the best match.
- **FR-003**: The Crawler Agent MUST ingest Google Maps/website inputs, request Places data with quota safeguards (≤50 reviews, ≤10 photos), and cache raw payloads in `crawled_data`.
- **FR-004**: Long-running orchestrations (crawl → content → website) MUST stream milestone events via SSE/`SwitchableStream` to avoid Cloudflare function timeouts.
- **FR-005**: The Content Agent MUST synthesize Master Content JSON containing themes, hero copy, testimonials, menu descriptions, design tokens, and hero image references derived from crawled insights, fallback testimonials must be neutral and clearly labeled.
- **FR-006**: Template mounting MUST copy files into an isolated workspace, inject Master Content JSON + theme overrides, and ensure the build service produces a previewable site without manual edits.
- **FR-007**: The Modification Orchestrator MUST classify user prompts into structured commands specifying action, file, path, and value, with validation before execution.
- **FR-008**: The Website Agent MUST apply validated commands atomically, log results, and trigger the build service so preview updates land within 20 seconds.
- **FR-009**: Error handling MUST normalize crawler/content/website failures into actionable PCC notifications that include suggested next steps (retry, provide data manually, contact support).
- **FR-010**: Users MUST be able to save labeled site snapshots that archive workspace files, reference the template and business profile used, and store the bundle in object storage with metadata in Postgres.
- **FR-011**: Snapshot restore MUST rehydrate an isolated workspace from archived artifacts without requiring new API calls, preserving edit history for audit logs.
- **FR-012**: Observability MUST capture per-agent durations, SSE heartbeat status, and success/failure counts to verify Phase1 success metrics.

### Key Entities *(include if feature involves data)*

- **Tenant**: Represents a customer business; links users to business profiles and snapshot history.
- **BusinessProfile**: Normalized, AI-enhanced brand data (contact info, hours, menu, ai_generated_copy, testimonials, design tokens) that powers template injection.
- **CrawledData**: Cached raw API payloads attached to a tenant and source URL to support reprocessing without re-crawling.
- **MasterContent**: Transient structured output shared between Content Agent and Website Agent, capturing selected template, synthesized copy, assets, and styling decisions.
- **SiteSnapshot**: Immutable record of a generated build, storing template ID, business profile reference, workspace archive URL, and version label.

## Quality & Compliance Constraints *(mandatory)*

### Code Quality
- Changes impact Remix API routes, AI orchestration modules, template assets, and persistence layers; all submissions MUST pass `pnpm run lint`, `pnpm run typecheck`, and `pnpm run test`.
- Cross-layer contracts (crawler → content → website) must stay within defined JSON schemas documented in the Template Registry; deviations require schema migrations reviewed in docs.
- Any temporary logging or feature flags must include cleanup tasks before Phase1 exit criteria are signed off.

### Testing Standards
- **P1 story** requires end-to-end integration tests that simulate crawl/content/website pipeline with mocked Places data plus contract tests for Template Registry schema.
- **P2 story** requires unit tests for intent classification, mutation runners, and Vitest/Playwright flows that submit edits and assert preview updates.
- **P3 story** requires persistence tests for snapshot creation/restoration plus smoke tests ensuring archives are downloadable and restorable.
- CI must record coverage deltas for agents and PCC UI components, enforcing existing thresholds; new fixtures should mask external API calls.

### UX Consistency
- PCC surfaces must show idle (ready for input), loading (SSE progress with percentage), success (preview + confirmation toasts), and error states (actionable copy, retry CTA) aligned with HuskIT design tokens.
- Preview pane behavior must remain responsive at 320 px, 768 px, and 1280 px widths with readable typography and accessible contrast; interactive edit controls must support keyboard focus and ARIA status updates.
- Reduced-motion preference disables animated progress indicators, falling back to stepped textual updates.

### Performance & Resource Requirements
- Initial generation must complete under 3 minutes end-to-end 95% of the time; edit turnaround must remain under 20 seconds for ≥95% of intents.
- Crawling and content synthesis must respect API quotas and memory constraints, batching review data to keep agent payloads within LLM context limits.
- Telemetry events must capture duration per agent, SSE heartbeat counts, and preview refresh latency to validate SLA adherence.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of initial generation attempts complete successfully with a functional preview that reflects crawled data.
- **SC-002**: 95% of content/style edit commands reflect in the preview within 20 seconds end-to-end.
- **SC-003**: At least 80% of invited pilot restaurants complete one initial generation plus one edit without concierge support.
- **SC-004**: At least 10 premium templates are documented, with 3 fully production-ready by the end of Sprint 1 and all 10 by Sprint 6.
- **SC-005**: Snapshot saves succeed for 95% of sessions, and 100% of saved versions remain restorable within 1 minute.
