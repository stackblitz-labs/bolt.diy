# Implementation Plan: Phase 1 Implementation Plan

**Branch**: `001-phase1-plan` | **Date**: 2025-11-22 | **Spec**: [/specs/001-phase1-plan/spec.md](/specs/001-phase1-plan/spec.md)  
**Input**: Feature specification from `/specs/001-phase1-plan/spec.md`

**Note**: This plan captures the detailed design, research, and delivery strategy required to complete the Phase 1 MVP defined in `docs/requirements/Phase1.md`.

## Summary

Deliver a premium-template-driven website generation MVP where crawler, content, website, edit, and snapshot agents collaborate through Remix API routes using SSE so restaurant operators can (1) create a branded first draft from Google Maps data, (2) iterate via natural-language edits inside the PCC, and (3) save/restore labeled snapshots. The updated spec now embeds constitution-required acceptance bullets for each story, consolidates fallback behavior under FR-005, and fixes the Phase 1 scope to the three enumerated user stories.

## Technical Context

**Language/Version**: TypeScript (strict) on Node 18, Remix + Vite runtimes  
**Primary Dependencies**: Remix, Vite, UnoCSS, shadcn/ui, Vercel AI SDK (`ai`), Nanostores, Zustand, WebContainer SDK, Supabase/Postgres client, Cloudflare Pages functions  
**Storage**: PostgreSQL (Supabase) for users/tenants/profiles/snapshots, R2/S3 object storage for workspace archives, local WebContainer FS for active template edits  
**Testing**: Vitest (unit/integration), Playwright preview suite, MSW for external API mocks  
**Target Platform**: Cloudflare Pages (Remix edge functions) + browser PCC + optional Electron shell  
**Project Type**: Single Remix app servicing UI + API routes  
**Performance Goals**: Initial generation < 3 minutes end-to-end p95, iterative edits < 20 seconds p95, PCC UI interactions < 150 ms, API acknowledgements < 400 ms with SSE heartbeats every 5 s  
**Constraints**: Cloudflare 30 s function timeout, Google Places quotas (≤50 reviews, ≤10 photos), WebContainer memory (~1 GB) for template cloning, strict JSON schema compatibility across agents  
**Scale/Scope**: 50 pilot restaurants, 3 production-ready templates by Sprint 1, 10 templates by Sprint 6, ≤5 concurrent editing sessions per tenant during MVP

## Constitution Check (pre-research)

1. **Code Quality Gate** — Touch points include `app/routes/api.*`, `app/lib/.server/llm/*`, `app/components/workbench/*`, and `/templates`. All PRs must pass `pnpm run lint`, `pnpm run typecheck`, `pnpm run test`, and declare typed contracts (Zod) for crawler→content→website interfaces plus snapshot metadata. Feature flag rollback per route remains the contingency plan.
2. **Testing Discipline** —  
   - US1: SSE integration tests with mocked crawler/content, resume & heartbeat suites, schema contract tests, PCC Playwright coverage for error/prompts/resume states.  
   - US2: Intent classifier + mutation runner unit tests, Playwright sequential edit SLA scenario, telemetry assertions.  
   - US3: Snapshot persistence unit tests, save/restore integration harness, PCC Save/Restore Playwright smoke.  
   Coverage must stay ≥90 % for critical runtimes and ≥80 % for touched files, using mocks for Google Places/object storage.  
3. **UX Consistency** — Reuse HuskIT design tokens under `app/styles/tokens.css`, shadcn toasts, PCC terminal layout. Every surface documents idle/loading/success/error states, ARIA live regions, focus management, breakpoints 320 px / 768 px / 1280 px, and reduced-motion fallbacks.  
4. **Performance & Resource Budgets** — SSE heartbeats ≤5 s, resumable tokens, `performance.mark` instrumentation for generate/edit/snapshot flows, crawler caching + retries, preview refresh timers (<20 s). Telemetry must capture SLA metrics for compliance checks.

## Project Structure

### Documentation (this feature)

```text
specs/001-phase1-plan/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── orchestrator.openapi.yaml
└── tasks.md
```

### Source Code (repository root)

```text
app/
├── routes/
│   ├── api.chat.ts
│   ├── api.site.generate.ts
│   ├── api.site.modify.ts
│   ├── api.snapshot.save.ts
│   └── api.snapshot.restore.ts
├── components/
│   ├── workbench/
│   │   ├── PromptCommandCenter.tsx
│   │   ├── Preview.tsx
│   │   └── Terminal/*
│   └── ui/*
├── lib/
│   ├── stores/
│   ├── persistence/
│   ├── modules/
│   │   └── llm/
│   └── webcontainer/
└── utils/

templates/
├── registry.json
├── restaurant-classic/
└── … (≥10 premium templates)

functions/[[path]].ts
scripts/
├── orchestration/*
└── templates/*

tests/
├── unit/
├── integration/
└── playwright/
```

**Structure Decision**: Continue using a single Remix workspace for UI + API. Agent-specific modules reside under `app/lib`, PCC UI stays under `app/components/workbench`, and template assets plus seeding scripts stay in `/templates` + `/scripts/templates`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| None | — | — |

## Phase 0 – Research Summary

1. **Template Schema Standardization** — Shared `content.json` + `theme.json` enforced by Zod; per-template schemas were too brittle.  
2. **SSE Orchestrator Resilience** — Adopt `SwitchableStream` with 5 s heartbeats + resumable tokens; long polling/WebSockets conflict with Cloudflare constraints.  
3. **Snapshot Storage Stack** — Store archives in R2/S3 with metadata in Postgres; Supabase storage and Postgres blobs were rejected for complexity/perf reasons.  
4. **Intent Classification Safety** — LLM classifier with confidence threshold + guided fallback forms; regex heuristics or forcing structured forms only would hurt UX.

## Phase 1 – Design & Contracts Summary

- `data-model.md` captures Tenant, BusinessProfile, CrawledData, MasterContent, SiteSnapshot schemas plus validation rules, relationships, audit fields, and lifecycle notes that tie directly to the user stories.  
- `/contracts/orchestrator.openapi.yaml` documents `POST /api.site.generate`, `POST /api.site.modify`, `POST /api.snapshot.save`, `POST /api.snapshot.restore` with SSE streams, resume tokens, normalization payloads, and telemetry metadata.  
- `quickstart.md` walks contributors through env setup, template seeding, running SSE routes locally, executing edit/snapshot flows, and running lint/typecheck/test/Playwright suites.  
- `.specify/scripts/bash/update-agent-context.sh cursor-agent` keeps the Cursor agent aware of SwitchableStream usage, WebContainer orchestration, and snapshot telemetry hooks referenced in the plan.

## Phase 2 – Implementation Outline (preview)

1. Finish template registry contracts + hydrate first three templates according to the shared schema.  
2. Ship Google Places crawler with quota guards, caching, and telemetry instrumentation.  
3. Build Content Agent to translate crawled data into Master Content JSON with clearly labeled fallback testimonials.  
4. Build Website Agent workspace orchestration for template mounting and preview generation.  
5. Implement Modification Orchestrator (classifier → mutation runner → `/api.site.modify`) with optimistic locking and SLA telemetry.  
6. Implement snapshot save/restore services, API routes, and PCC controls tied to R2/Postgres persistence.  
7. Complete end-to-end tests, Playwright coverage, accessibility checks, and performance validation gates before rollout.

### Template Scale Milestones (SC-004 Alignment)

- **Sprint 1**: Deliver three starter templates (`restaurant-classic`, `bistro-elegant`, `taqueria-modern`) plus QA checklist coverage for responsiveness and Lighthouse ≥90.  
- **Sprint 2**: Add templates 4–6 (`restaurant-modern`, `family-style`, `cafe-bright`) and update `templates/registry.json` + seeding scripts; capture Playwright snapshot baselines.  
- **Sprint 3**: Add templates 7–10 (`fusion-night`, `food-truck`, `pastry-boutique`, `ghost-kitchen`) with targeted tone tags and seeded assets inside WebContainer workspaces.  
- **Continuous QA**: Maintain `tests/playwright/templates/premium-templates.spec.ts` to exercise all templates, verifying schema compatibility across breakpoints.

## Constitution Check (post-design)

1. **Code Quality** — Contracts live beside their implementations (`app/lib/modules/templates/schema.ts`, crawler/content/website services, snapshot persistence helpers). Quickstart lists lint/typecheck/test commands; no outstanding violations.  
2. **Testing** — Each user story now maps to explicit Vitest/Playwright suites plus coverage expectations; fixtures stub Google Places, R2, and SSE where needed.  
3. **UX Consistency** — PCC state machine and breakpoint behaviors are documented in quickstart and enforced via dedicated Playwright scenarios plus accessibility QA task T034.  
4. **Performance** — Budgets restated with instrumentation plan (`performance.mark` hooks, heartbeat metrics, snapshot latency logging) and mitigation strategies (resume tokens, caching, retries). Gate satisfied; proceed to `/speckit.tasks`/implementation phases on branch `001-phase1-plan`.
