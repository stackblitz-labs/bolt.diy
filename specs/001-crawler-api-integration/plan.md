# Implementation Plan: Crawler API Integration

**Branch**: `001-crawler-api-integration` | **Date**: 2026-01-04 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/001-crawler-api-integration/spec.md`

## Summary

Integrate the HuskIT/crawler API with the Create Project dialog to automatically extract business data from Google Maps URLs and generate AI-powered website content. The integration uses a session-based approach where one session_id is generated per project creation flow and used for all crawler API calls.

## Technical Context

**Language/Version**: TypeScript 5.7.2 on Node.js >=18.18.0  
**Primary Dependencies**: Remix 2.15.2, React 18, Vercel AI SDK (`ai`), nanostores  
**Storage**: Supabase/PostgreSQL (projects table, business_profile JSONB)  
**Testing**: Vitest, React Testing Library  
**Target Platform**: Web (Cloudflare Pages)  
**Project Type**: Web application (Remix fullstack)  
**Performance Goals**: 60s timeout for crawler calls, responsive UI with loading states  
**Constraints**: Crawler API at configurable URL (default localhost:4999), no authentication  
**Scale/Scope**: Single user flow, ~10 projects per user limit

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Library-First | ✅ Pass | Crawler client as standalone service module |
| CLI Interface | N/A | Web UI feature, no CLI needed |
| Test-First | ⚠️ Reminder | Write tests for crawler client and proxy routes |
| Integration Testing | ✅ Required | Mock crawler API for integration tests |
| Observability | ✅ Pass | Use existing logger, add crawler-specific logging |
| Simplicity | ✅ Pass | Minimal new abstractions, extends existing patterns |

## Project Structure

### Documentation (this feature)

```text
specs/001-crawler-api-integration/
├── plan.md              # This file
├── research.md          # Crawler API analysis
├── data-model.md        # Entity definitions and TypeScript types
├── quickstart.md        # Development setup guide
├── contracts/
│   └── crawler-api.yaml # OpenAPI contract
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Implementation tasks (via /speckit.tasks)
```

### Source Code Changes

```text
app/
├── types/
│   └── crawler.ts                    # NEW: Crawler API types
├── lib/
│   └── services/
│       └── crawlerClient.server.ts   # NEW: Crawler HTTP client
├── routes/
│   ├── api.crawler.extract.ts        # NEW: Proxy route for /crawl
│   └── api.crawler.generate.ts       # NEW: Proxy route for /generate-website-content
└── components/
    └── projects/
        └── CreateProjectDialog.tsx   # MODIFY: Add crawl flow
```

**Structure Decision**: Extends existing web application structure. New files follow established patterns for services (`*.server.ts`), routes (`api.*.ts`), and types.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Frontend                                    │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                    CreateProjectDialog.tsx                          │ │
│  │  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐        │ │
│  │  │ Details  │ → │  Maps    │ → │ Crawling │ → │  Review  │ → ...  │ │
│  │  └──────────┘   └──────────┘   └──────────┘   └──────────┘        │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                    │                                     │
│                                    ▼                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                           Remix Routes (Server)                          │
│  ┌─────────────────────────┐    ┌─────────────────────────────┐        │
│  │ api.crawler.extract.ts  │    │ api.crawler.generate.ts     │        │
│  │ POST /api/crawler/extract│   │ POST /api/crawler/generate  │        │
│  └─────────────────────────┘    └─────────────────────────────┘        │
│                    │                           │                        │
│                    ▼                           ▼                        │
│  ┌────────────────────────────────────────────────────────────────────┐│
│  │              crawlerClient.server.ts                                ││
│  │  - extractBusinessData(sessionId, mapsUrl) → CrawlResponse         ││
│  │  - generateWebsiteContent(sessionId) → GenerateContentResponse     ││
│  └────────────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────────────┤
│                        External Services                                 │
│  ┌────────────────────────────────────────────────────────────────────┐│
│  │                   HuskIT/Crawler API                                ││
│  │  localhost:4999 (or CRAWLER_API_URL)                               ││
│  │  ┌──────────────┐  ┌───────────────┐  ┌─────────────────────────┐ ││
│  │  │ POST /crawl  │  │ /crawl-website │  │ /generate-website-content│ ││
│  │  └──────────────┘  └───────────────┘  └─────────────────────────┘ ││
│  └────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

## Implementation Phases

### Phase 1: Foundation (Types & Client)

1. Create `app/types/crawler.ts` with all TypeScript interfaces
2. Create `crawlerClient.server.ts` with HTTP client functions
3. Add `CRAWLER_API_URL` to environment configuration
4. Write unit tests for crawler client (mocked)

### Phase 2: API Routes

1. Create `api.crawler.extract.ts` proxy route
2. Create `api.crawler.generate.ts` proxy route
3. Add authentication checks (session required)
4. Add error handling and timeout logic
5. Write integration tests for routes

### Phase 3: UI Integration

1. Update `CreateProjectDialog.tsx` with new steps:
   - Add `crawling` step (loading state)
   - Add `review` step (display/edit extracted data)
   - Integrate session ID generation
2. Add error states and retry UI
3. Add fallback to manual entry
4. Connect to new API routes

### Phase 4: Data Persistence

1. Update project creation to include crawler data
2. Store `business_profile` with crawled and generated content
3. Update `projects.server.ts` to handle enriched data

### Phase 5: Polish & Testing

1. End-to-end testing of full flow
2. Error scenario testing
3. UI polish (loading animations, error messages)
4. Documentation updates

## API Contract Summary

### Internal Routes (website-agent)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/crawler/extract` | POST | Proxy to crawler `/crawl` |
| `/api/crawler/generate` | POST | Proxy to crawler `/generate-website-content` |

### External Endpoints (HuskIT/crawler)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/crawl` | POST | Extract business data from Google Maps URL |
| `/crawl-website` | POST | Crawl website for content (optional) |
| `/generate-website-content` | POST | Generate AI website content |

See `contracts/crawler-api.yaml` for full OpenAPI specification.

## Key Design Decisions

### 1. Server-Side Proxy

**Decision**: Proxy crawler API calls through Remix routes instead of direct frontend calls.

**Rationale**:
- Keeps crawler URL internal
- Enables consistent error handling
- Allows timeout management on server
- Follows existing pattern for external APIs

### 2. Session-Based Caching

**Decision**: Generate one UUID session_id per project creation, reuse for all crawler calls.

**Rationale**:
- Matches crawler API caching mechanism
- Enables retries without re-crawling
- Creates natural 1:1 project-session relationship

### 3. Graceful Degradation

**Decision**: Allow manual entry when crawler fails.

**Rationale**:
- Users should never be blocked
- Crawler is enhancement, not requirement
- Maintains existing manual flow as fallback

### 4. 60-Second Timeout

**Decision**: Timeout crawler calls after 60 seconds.

**Rationale**:
- Balances user patience with crawl complexity
- Cloudflare edge has 30s limit, so server-side timeout needed
- User-specified requirement in clarification

## Complexity Tracking

> **No Constitution violations detected**

| Concern | Mitigation |
|---------|------------|
| New external dependency | Crawler API is internal, fallback to manual entry |
| Additional UI steps | Streamlined flow, clear progress indicators |
| Type complexity | Generated from crawler API, documented in data-model.md |

## Artifacts Generated

- [x] `research.md` - Crawler API analysis
- [x] `data-model.md` - Entity definitions
- [x] `contracts/crawler-api.yaml` - OpenAPI spec
- [x] `quickstart.md` - Development guide
- [ ] `tasks.md` - Implementation tasks (via `/speckit.tasks`)

## Next Steps

Run `/speckit.tasks` to generate the detailed task breakdown for implementation.
