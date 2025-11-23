# Feature Specification: Google Places Crawler Service

**Feature Branch**: `001-places-crawler`  
**Created**: 2025-11-22  
**Status**: Draft  
**Input**: User description: "i want to Implement \"T007 Implement Google Places crawler service with quota + caching guards in `app/lib/services/crawlerAgent.server.ts`\" in @specs/001-phase1-plan/tasks.md with some adjustment"

## Clarifications

### Session 2025-11-22

- Q: How should the crawler obtain place data now that it must avoid direct Google Places calls? → A: Call the internal REST service that proxies Google Places and enforces quotas.
- Q: Which source datasets must the internal service provide for each crawl (Google Maps, legacy site, social data)? → A: Each source is optional; use whatever data is available per request.
- Q: What fields must `CrawlResult` expose so downstream agents have a deterministic contract? → A: Return `tenantId`, `placeId`, `freshness`, `cacheHit`, `sourcesUsed[]`, `sections.identity/contact/hours/menu/reviews/media` (each with `data`, `completeness`, `source`), `missingSections[]`, `quotaState`, and optional `error{code,message,remediation}` plus `rawPayloadRef` for audit.
- Q: How should PCC UI surface crawler provenance and remediation guidance? → A: Show per-section provenance badges (Maps/Website/Social icons + timestamp tooltip), list missing sections inline with “Needs data” chips, and map each crawler error code to deterministic PCC messaging (toast + log entry + actionable CTA).
- Q: Does PCC refer to the Prompt Command Center UI? → A: Yes—PCC is shorthand for Prompt Command Center, the operator-facing workbench experience guiding generation, quota, and resume flows.
- Q: How should the Prompt Command Center collect missing data before triggering the crawler? → A: Keep the conversational UX: user submits a natural-language request (“Generate a website…”), the orchestrator replies in the chat requesting required inputs (Maps URL, legacy site, socials, etc.), and once the user supplies them in chat the system confirms (“Running crawler…”) and invokes the crawler agent.
- Q: What constitutes a “high-visibility toast” in PCC? → A: Toasts appear pinned to the top of the chat panel, use the shadcn `destructive` theme with an error icon, include deterministic CTA text, stay visible for at least 6 seconds (or until dismissed), and expose accessibility hooks (role="alert", Escape to dismiss, screen-reader copy matching the remediation hint).
- Q: What accessibility expectations apply to PCC provenance badges/chips/toasts? → A: Keyboard navigation must cycle between conversation, provenance badges, “Needs data” chips, and toasts; each badge/chip has ARIA labels describing source/state; toasts announce via `role="alert"` with the remediation text so assistive tech users get the same guidance.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Capture Verified Place Profile (Priority: P1)

Operators submit a Google Maps link (or known Place ID) and expect the crawler to return a structured restaurant profile—with data synthesized from any combination of Google Maps, the tenant’s existing website, and approved social profiles—covering address, contact info, business hours, ratings, review excerpts, photos, and cuisine hints that downstream agents can trust without manual cleanup.

**Why this priority**: Generation cannot begin until accurate source data exists; without it, every downstream agent stalls.

**Independent Test**: Provide a new tenant Google Maps URL and confirm the crawler persists a `CrawledData` record populated with the required fields and exposes them to `/api.site.generate` without manual intervention.

**Acceptance Scenarios**:

1. **Given** a tenant with no cached crawls, **When** the crawler receives a valid Google Maps URL, **Then** it normalizes the place ID, calls the internal Places Data Service, and returns a structured payload covering identity, contact, hours, photos, and ratings using whichever source data (Maps, website, social) is available.
2. **Given** the crawler has validated the payload, **When** the orchestrator requests the data, **Then** the service stores the raw response plus normalized summary and exposes the summary via a typed response object tied to the `tenant_id`.

#### Prompt Command Center (PCC) UI expectations for User Story 1

- Each populated section (identity, contact, hours, menu, reviews, media) MUST display an inline provenance badge showing the contributing source (`Maps`, `Website`, or `Social`) plus a tooltip with `source name · timestamp`.
- Sections missing data MUST render a “Needs data” chip along with guidance copied from the crawler’s `missingSections` array so operators can supply manual inputs without guessing.
- When the crawler emits `INVALID_INPUT`, `PLACE_NOT_FOUND`, or `NO_SOURCE_DATA`, the Prompt Command Center MUST show a toast pinned to the top of the chat panel using the destructive/error theme with icon + CTA (“Fix URL”, “Provide data”, etc.), remain visible ≥6 s (unless dismissed), log the same remediation text in the prompt history, and expose keyboard dismissal (Escape) plus `role="alert"` with the remediation text for screen readers.
- The conversational workflow remains in-line: operators type a natural-language command, the orchestrator follows up within the same thread to collect missing data (Google Maps URL, old site link, social handles). After all required inputs arrive, the system posts a confirmation message (“Running crawler…”) before calling the crawler agent so every step is visible in chat history.
- Provenance badges and “Needs data” chips MUST support keyboard focus (Tab/Shift+Tab) and announce descriptive ARIA labels (e.g., “Menu sourced from Google Maps on Nov 22”, “Testimonials need data”). Toast CTAs must be reachable via keyboard and expose clear `aria-label`s mirroring the visible action text.

---

### User Story 2 - Guard Against Quota Exhaustion (Priority: P1)

Platform operators need assurance that crawling cannot exceed daily/instant quotas allocated by the internal Places Data Service (which fronts Google Places) and that any approaching limit triggers proactive alerts and graceful degradation rather than silent failures.

**Why this priority**: A single runaway tenant could exhaust the shared quota, blocking all other customers from generating sites.

**Independent Test**: Simulate a burst of crawl requests that reaches 80% of the daily budget reported by the internal service and confirm the crawler throttles subsequent requests, raises telemetry events, and surfaces actionable error codes to the orchestrator.

**Acceptance Scenarios**:

1. **Given** the daily quota ledger is below 80%, **When** a series of crawl requests run concurrently, **Then** the crawler tracks each unit against the ledger reported by the internal service and rejects further requests once the configured ceiling is met with a `QUOTA_EXCEEDED` status.
2. **Given** the quota ledger crosses the warning threshold, **When** additional crawl requests arrive, **Then** the crawler emits structured telemetry (tenant, remaining budget, ETA to reset) so operators can respond before hard failure.

---

### User Story 3 - Reuse Cached Crawls for Resumes (Priority: P2)

Resume flows and template reselections should reuse recent crawl payloads to avoid redundant API calls while still allowing explicit refreshes when data appears stale or incorrect.

**Why this priority**: Cached crawls reduce latency, prevent quota waste, and keep resume flows under SLA.

**Independent Test**: Trigger `/api.site.generate` twice within the cache TTL using the same tenant and confirm the second run is served entirely from the cached `CrawledData` record unless a force-refresh flag is supplied.

**Acceptance Scenarios**:

1. **Given** a cached crawl newer than the freshness threshold, **When** the orchestrator requests a new generation without force refresh, **Then** the crawler returns the cached payload, marks the interaction as a cache hit, and completes under the cache SLA.
2. **Given** an operator indicates the real-world data changed, **When** the orchestrator sets a refresh flag, **Then** the crawler bypasses cache, fetches a new payload, and replaces the stale cache entry while keeping the legacy data for audit.

---

### Edge Cases

- Google Maps URL resolves to multiple places (chains); crawler must choose the highest-confidence match and report ambiguity.
- Input is missing a valid place ID (e.g., shortened link); crawler must surface a validation error before consuming quota.
- Internal service responds with partial data (e.g., no hours or menu, social links only); crawler must flag missing sections so downstream agents can request fallbacks.
- All optional sources return empty (no Maps, website, or social data); crawler must return a deterministic `NO_SOURCE_DATA` error with guidance to supply manual inputs.
- API quota is exceeded mid-run; crawler must emit deterministic error codes and avoid retry storms.
- Cached payload exists but references a different tenant (malicious reuse); crawler must block cross-tenant cache reads.

## Assumptions

- The internal Places Data Service already fronts Google Places APIs, legacy site snapshots, and social data harvesters, managing authentication plus shared quotas per environment.
- Each source (Maps, website, social) is optional per crawl; the service may return any subset without guaranteeing completeness.
- `crawled_data` table is authoritative cache storage and can store up to 2 MB per entry as defined in the Phase 1 data model.
- Operators provide either a Google Maps share URL or a known place ID; free-form addresses are out of scope for this task.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The crawler MUST accept a Google Maps URL or canonical Place ID, normalize it to a unique identifier, and validate that the tenant is authorized to crawl the referenced business.
- **FR-002**: The crawler MUST request the latest place details from the internal Places Data Service when no fresh cache exists, covering identity, contact info, hours, review summary, rating, cuisine tags, and available media links synthesized from whichever sources (Maps, website, social) are available.
- **FR-003**: The crawler MUST persist each raw response plus a normalized summary in `crawled_data`, linking it to the tenant, source URL, crawl timestamp, and status.
- **FR-004**: The crawler MUST expose a deterministic response contract to orchestrators that includes freshness timestamp, required data sections, per-source provenance indicators, and any missing-field flags.
- **FR-005**: The crawler MUST reuse cached payloads when they are newer than the configured TTL unless the request specifies a force-refresh flag.
- **FR-006**: The crawler MUST honor per-minute and per-day request quotas communicated by the internal service, maintain an in-memory ledger, and reject or queue requests once limits are met.
- **FR-007**: The crawler MUST emit structured telemetry for every request (tenant, latency, cache hit/miss, quota state, result code) so heartbeat and SLA monitors can act.
- **FR-008**: The crawler MUST surface actionable error codes (`INVALID_INPUT`, `PLACE_NOT_FOUND`, `QUOTA_EXCEEDED`, `UPSTREAM_ERROR`, `NO_SOURCE_DATA`) with remediation hints for PCC UI.
- **FR-008a**: Each error code MUST include a structured remediation hint that PCC can reference verbatim for toast/log copy plus an optional CTA identifier so UI behavior stays deterministic.
- **FR-011**: Prompt Command Center MUST meet accessibility requirements for the crawler experience: keyboard traversal across chat logs, provenance badges, “Needs data” chips, and toasts; ARIA labels describing each badge/chip; and toast messages announced via `role="alert"` using the remediation hint content.
- **FR-009**: The crawler MUST verify cached payload ownership and never serve another tenant’s data even if the source URL matches.
- **FR-010**: The crawler MUST support manual invalidation hooks (e.g., when operators flag stale data) that delete or supersede prior cache entries without orphaning audit history.

### Key Entities *(include if feature involves data)*

- **CrawlRequest**: Captures tenant identifier, submitted Google Maps URL/Place ID, requested fields, force-refresh flag, and orchestration correlation IDs.
- **CrawlResult**: Structured representation returned to downstream agents containing normalized business profile, freshness timestamp, missing-section flags, per-source provenance indicators, and pointers to stored raw payloads.
- Fields:
  - `tenantId` (UUID) and `placeId` (string) for scoping.
  - `freshness` (timestamptz), `cacheHit` (boolean), and `rawPayloadRef` (string/URL) for audit.
  - `sourcesUsed[]` entries with `{ type: 'maps'|'website'|'social', timestamp, confidence? }`.
  - `sections` object with keys `identity`, `contact`, `hours`, `menu`, `reviews`, `media`; each section contains `{ data: object, completeness: 'complete'|'partial'|'missing', source: 'maps'|'website'|'social' }`.
  - `missingSections[]` enumerating required sections still empty, plus optional `notes` prompting PCC copy.
  - `quotaState` summarizing `% of daily budget` and `state` (`healthy`/`warning`/`exhausted`).
  - Optional `error` object `{ code, message, remediation, ctaId }` when the fetch fails.
- **CacheEntry**: Reference to a `crawled_data` row storing tenant, source URL, crawl timestamp, TTL expiration, and whether the entry is eligible for reuse.
- **QuotaLedger**: Rolling counters for each Places API key describing limits, consumed units, warning thresholds, and next reset time.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 95% of first-time crawl requests return a complete normalized payload within 8 seconds of submission.
- **SC-002**: Cache hit rate for repeat generation or resume flows within 24 hours is at least 50%, measured per tenant.
- **SC-003**: 100% of quota threshold crossings emit telemetry within 1 minute and block additional calls that would exceed the budget.
- **SC-004**: 100% of crawler error responses include a deterministic error code and remediation hint that PCC can map to user-facing guidance.
