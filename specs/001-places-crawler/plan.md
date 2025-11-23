# Implementation Plan: Google Places Crawler Service

**Branch**: `001-places-crawler` | **Date**: 2025-11-22 | **Spec**: [`specs/001-places-crawler/spec.md`](./spec.md)  
**Input**: Feature specification from `/specs/001-places-crawler/spec.md`

## Summary

Build a TypeScript crawlerAgent that mediates between Remix orchestrators and the internal Places Data Service, reusing cached payloads, enforcing quota/telemetry guardrails, and feeding Prompt Command Center (PCC) conversations with deterministic `CrawlResult` payloads. The agent must ingest Google Maps, legacy site, and social inputs (any subset), persist normalized summaries in `crawled_data`, and surface provenance, missing-section guidance, conversational input prompts, accessibility-compliant badges/toasts (FR-011), and resumable cache flows inside the PCC chat UI.

## Technical Context

**Language/Version**: TypeScript 5.7.x on Node 18 (Remix + Vite runtime)  
**Primary Dependencies**: Remix server runtime, Supabase JS client, UnoCSS + shadcn/ui, internal Places Data Service REST API, `app/utils/logger.ts` telemetry helpers  
**Storage**: Supabase/PostgreSQL (`crawled_data`, `business_profiles`, `site_snapshots`)  
**Testing**: Vitest unit/contract suites, Remix integration tests, Playwright PCC scenarios (including accessibility per FR-011), axe/lint accessibility checks  
**Target Platform**: Cloudflare Pages/Workers (API routes) with optional Electron shell for dev  
**Project Type**: Single Remix project (shared `app/` codebase)  
**Performance Goals**: 95% first-time crawls <8s, ≥50% resume cache hit rate, telemetry alerts emitted <60s after quota threshold events  
**Constraints**: Enforce quota guardrails (80% warn, 100% block), payloads ≤2 MB, deterministic PCC remediation copy per error code, PCC accessibility (keyboard focus loops, ARIA labels, `role="alert"` toasts)  
**Scale/Scope**: Multi-tenant orchestration (dozens of concurrent operators) with conversational PCC prompts; foundation for later snapshot/edit flows

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution file remains a placeholder with no explicit principles; plan still honors Phase 1 requirements (schema-first design, telemetry instrumentation, PCC accessibility per FR-011, resumable flows, tests before release). No violations recorded.

## Project Structure

### Documentation (this feature)

```text
specs/001-places-crawler/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md
```

### Source Code (repository root)

```text
app/
├── components/
│   └── workbench/PromptCommandCenter.tsx
├── lib/
│   ├── modules/templates/
│   ├── services/
│   │   ├── crawlerAgent.server.ts
│   │   ├── crawlerAgent.schema.ts
│   │   └── internalPlacesClient.server.ts
│   ├── webcontainer/workspaceOrchestrator.ts
│   └── utils/logger.ts
├── routes/
│   ├── api.site.generate.ts
│   ├── api.snapshot.save.ts
│   └── api.snapshot.restore.ts
└── stores/

scripts/templates/
├── clone-starters.ts
└── seed-registry.ts

supabase/
└── migrations/

tests/
├── integration/api.site.generate*.ts
├── unit/services/crawlerAgent.test.ts
└── playwright/pcc-*.spec.ts
```

**Structure Decision**: Single Remix app with services + schemas under `app/lib`, PCC UI under `app/components/workbench`, Supabase migrations for `crawled_data`, and mirrored unit/integration/playwright tests (including FR-011 accessibility coverage for PCC toasts/badges/chips).

## Complexity Tracking

No constitution violations → table intentionally empty.
