# Implementation Plan: Enhanced Markdown Crawler Integration

**Branch**: `001-enhanced-markdown-crawler` | **Date**: 2026-02-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-enhanced-markdown-crawler/spec.md`

## Summary

Integrate two new crawler API endpoints (`/generate-google-maps-markdown` and `/crawl-website-markdown`) into the website-agent to provide richer, LLM-processed content for website generation. This replaces raw JSON crawl data with pre-formatted markdown that includes structured business profiles and visual style descriptions from existing restaurant websites.

**Key Changes**:
1. Add two new crawler client methods for markdown generation
2. Extend `BusinessProfile` type with markdown fields
3. Update `api.crawler.extract.ts` to call markdown endpoints in parallel after `/crawl`
4. Update `projectGenerationService.ts` to use markdown as primary content source

## Technical Context

**Language/Version**: TypeScript 5.7.2 (strict mode)
**Primary Dependencies**: Remix 2.15.2, Vercel AI SDK 4.3.16
**Storage**: Supabase/PostgreSQL (JSONB column for BusinessProfile)
**Testing**: Vitest for unit tests
**Target Platform**: Cloudflare Pages (edge functions, 30s timeout constraint)
**Project Type**: Web application (Remix full-stack)
**Performance Goals**:
- Initial site generation: <3 minutes end-to-end (p95)
- Markdown API calls: 120s timeout per call (parallel execution)
**Constraints**:
- Cloudflare edge 30s constraint (but crawler calls are server-side with longer timeout)
- Graceful degradation when website markdown unavailable
**Scale/Scope**: Single-tenant, ~1000 projects, ~10KB-50KB markdown per profile

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Code Quality | ✅ Pass | TypeScript strict mode, Zod schemas for contracts |
| Testing Discipline | ✅ Pass | Unit tests for new crawler methods, integration tests for flow |
| UX Consistency | ✅ Pass | No UI changes in this feature |
| Performance Budgets | ✅ Pass | 120s timeout per API call, parallel execution |

**No violations. Proceeding with implementation.**

## Project Structure

### Documentation (this feature)

```text
specs/001-enhanced-markdown-crawler/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0: Technical research
├── data-model.md        # Phase 1: Data model definitions
├── quickstart.md        # Phase 1: Implementation guide
├── contracts/           # Phase 1: API contracts
│   └── crawler-markdown.md
├── checklists/          # Quality checklists
│   └── requirements.md
└── tasks.md             # Phase 2: Task breakdown (created by /speckit.tasks)
```

### Source Code (repository root)

```text
app/
├── types/
│   ├── crawler.ts           # New: Markdown request/response types
│   └── project.ts           # Modified: BusinessProfile with markdown fields
├── lib/services/
│   └── crawlerClient.server.ts  # Modified: Add markdown generation methods
├── routes/
│   └── api.crawler.extract.ts   # Modified: Call markdown endpoints after /crawl
└── lib/services/
    └── projectGenerationService.ts  # Modified: Use markdown in prompts
```

**Structure Decision**: This feature modifies existing files in the established Remix structure. No new directories or architectural changes required.

## Implementation Overview

### Phase 0: Research (Completed)

See [research.md](./research.md) for detailed findings:

- **Current Flow Analysis**: Documented existing crawler integration and data flow
- **API Endpoint Review**: Analyzed new markdown endpoint contracts
- **Design Decisions**:
  - Replace `crawled_data` with markdown for new crawls (graceful coexistence)
  - Parallel execution with `Promise.allSettled()`
  - 120s timeout per markdown API call
  - Website markdown is optional (graceful degradation)

### Phase 1: Design (Completed)

#### Data Model ([data-model.md](./data-model.md))

Extended `BusinessProfile` interface:

```typescript
interface BusinessProfile {
  session_id?: string;
  gmaps_url?: string;
  crawled_at?: string;
  // Legacy (existing projects)
  crawled_data?: BusinessData;
  generated_content?: GeneratedContent;
  // Enhanced (new crawls)
  google_maps_markdown?: string;
  website_markdown?: string;
}
```

#### API Contracts ([contracts/crawler-markdown.md](./contracts/crawler-markdown.md))

Two new crawler client methods:

1. `generateGoogleMapsMarkdown(sessionId)` → Google Maps markdown
2. `crawlWebsiteMarkdown(request)` → Website markdown with visual analysis

#### Quickstart ([quickstart.md](./quickstart.md))

Step-by-step implementation guide with code snippets.

### Phase 2: Implementation Tasks

See [tasks.md](./tasks.md) (created by `/speckit.tasks`).

**Summary of Tasks**:

| # | Task | Priority | Effort |
|---|------|----------|--------|
| 1 | Add new type definitions to `crawler.ts` | P1 | Small |
| 2 | Extend `BusinessProfile` in `project.ts` | P1 | Small |
| 3 | Add `generateGoogleMapsMarkdown()` to crawler client | P1 | Medium |
| 4 | Add `crawlWebsiteMarkdown()` to crawler client | P1 | Medium |
| 5 | Update `api.crawler.extract.ts` to call markdown endpoints | P1 | Medium |
| 6 | Update `validateBusinessProfile()` in generation service | P2 | Small |
| 7 | Update `composeContentPrompt()` to use markdown | P2 | Medium |
| 8 | Add unit tests for new crawler methods | P2 | Medium |
| 9 | Add integration test for full flow | P3 | Medium |

## Dependencies

### External Dependencies

| Dependency | Purpose | Status |
|------------|---------|--------|
| HuskIT Crawler API | Provides markdown endpoints | Assumed available |
| Gemini API | Powers LLM Vision in crawler | Configured on crawler side |

### Internal Dependencies

| File | Dependency | Notes |
|------|------------|-------|
| `crawlerClient.server.ts` | `types/crawler.ts` | New types must be added first |
| `api.crawler.extract.ts` | `crawlerClient.server.ts` | New methods must be added first |
| `projectGenerationService.ts` | `types/project.ts` | Extended BusinessProfile needed |

## Risk Mitigation

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Crawler API unavailable | Low | Clear error messages, retry guidance |
| LLM Vision timeout | Medium | 120s timeout, proceed without website markdown |
| Existing project regression | Low | Graceful coexistence, no data migration |
| Markdown format issues | Low | Validation before storage |

## Success Criteria Verification

| Criterion | How to Verify |
|-----------|---------------|
| SC-001: Rich content in generated sites | Manual inspection of generated HTML for brand/style content |
| SC-002: 100% success for no-website cases | Test with restaurant without website URL |
| SC-003: 50% faster on cache hit | Time comparison: first vs. second generation |
| SC-004: Graceful error handling | Simulate crawler timeout, verify user feedback |

## Next Steps

1. Run `/speckit.tasks` to generate detailed task breakdown
2. Implement tasks in dependency order
3. Run tests: `pnpm test`
4. Manual testing with real restaurants
5. Create PR for review

## Complexity Tracking

> **No violations identified. No complexity justifications required.**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | N/A | N/A |
