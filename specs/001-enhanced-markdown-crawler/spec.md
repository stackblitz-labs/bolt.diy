# Feature Specification: Enhanced Markdown Crawler Integration

**Feature Branch**: `001-enhanced-markdown-crawler`
**Created**: 2026-02-01
**Status**: Draft
**Input**: User description: "Improve flow to crawl Google Maps content and website content. Replace data from `/crawl` API with data from `/generate-google-maps-markdown` and `/crawl-website-markdown` endpoints for richer LLM-processed content."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Restaurant Website Generation with Rich Content (Priority: P1)

A restaurant operator initiates website generation by providing their Google Maps URL or business name/address. The system crawls Google Maps data, then enriches it with LLM-processed markdown that includes structured business information and visual descriptions from their existing website.

**Why this priority**: This is the core flow - generating websites with richer, more contextual content directly improves the quality of generated websites and user satisfaction.

**Independent Test**: Can be fully tested by initiating a new project with a Google Maps URL and verifying that the generated website contains content derived from both Google Maps markdown (structured profile) and website markdown (visual style descriptions).

**Acceptance Scenarios**:

1. **Given** a user provides a Google Maps URL for their restaurant, **When** the crawl process completes, **Then** the system stores both Google Maps markdown and website markdown in the business profile.

2. **Given** a restaurant has an existing website listed in Google Maps, **When** the system generates content, **Then** the website markdown includes visual style descriptions extracted from the existing site.

3. **Given** the crawler successfully extracts data, **When** the markdown generation completes, **Then** the business profile contains human-readable markdown as the primary content source.

---

### User Story 2 - Website Generation Without Existing Website (Priority: P2)

A restaurant operator who does not have an existing website initiates website generation. The system generates content using only the Google Maps markdown without failing on the website markdown step.

**Why this priority**: Many restaurants don't have existing websites - the system must gracefully handle this common scenario.

**Independent Test**: Can be tested by using a restaurant Google Maps listing that has no website URL, verifying the generation completes successfully using only Google Maps data.

**Acceptance Scenarios**:

1. **Given** a restaurant has no website URL in their Google Maps listing, **When** the crawl process runs, **Then** the system skips website markdown crawling and proceeds with Google Maps markdown only.

2. **Given** website markdown crawling fails or times out, **When** the system continues generation, **Then** it uses available Google Maps markdown without blocking the entire flow.

---

### User Story 3 - Cached Markdown Retrieval (Priority: P3)

When a user re-generates or iterates on their website, the system retrieves previously generated markdown from cache rather than re-crawling and re-processing.

**Why this priority**: Improves iteration speed and reduces API costs, but is an optimization rather than core functionality.

**Independent Test**: Can be tested by generating a website, then re-triggering generation for the same session_id and verifying the response is faster (cached).

**Acceptance Scenarios**:

1. **Given** a project has previously been crawled with a specific session_id, **When** the user requests regeneration, **Then** the system retrieves cached markdown if available.

2. **Given** cached markdown exists, **When** the user explicitly requests a fresh crawl, **Then** the system re-crawls and overwrites the cache.

---

### Edge Cases

- What happens when the external crawler API is unavailable? System should return a clear error message and allow retry.
- What happens when Google Maps markdown generation succeeds but website markdown fails? System should proceed with partial data.
- What happens when the website has aggressive bot protection? System should timeout gracefully and proceed without website markdown.
- What happens when the session_id doesn't exist (markdown requested before crawl)? System should return 404 with clear guidance.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST call `/generate-google-maps-markdown` endpoint after the initial `/crawl` completes (requires prior crawl data).
- **FR-002**: System MUST call `/crawl-website-markdown` endpoint when a website URL is present in the crawled data.
- **FR-011**: System MUST execute `/generate-google-maps-markdown` and `/crawl-website-markdown` in parallel after `/crawl` completes to minimize total processing time.
- **FR-003**: System MUST store both markdown outputs in the business profile, replacing the existing `crawled_data` field entirely.
- **FR-009**: System MUST support graceful coexistence - existing projects with `crawled_data` continue to function; only new crawls populate markdown fields.
- **FR-004**: System MUST handle website markdown as optional - generation proceeds if only Google Maps markdown is available.
- **FR-005**: System MUST use the same `session_id` across ALL API calls in the flow: `/crawl`, `/generate-google-maps-markdown`, and `/crawl-website-markdown`.
- **FR-006**: System MUST respect the crawler's caching behavior - cached markdown is returned if available for the session.
- **FR-007**: System MUST enable visual analysis for website markdown crawling (`enable_visual_analysis: true`).
- **FR-008**: Website generation pipeline MUST use the markdown data as the primary content source for LLM prompts.
- **FR-010**: System MUST apply a 120-second timeout per markdown API call to accommodate LLM Vision processing.

### Key Entities

- **BusinessProfile**: Modified to replace `crawled_data` with `google_maps_markdown` (string) and `website_markdown` (string) fields.
- **CrawlSession**: Represents a crawl operation identified by `session_id`, linking Google Maps crawl, markdown generation, and website crawl.
- **MarkdownContent**: LLM-processed content containing structured business information and visual descriptions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Generated websites contain contextual content (brand tone, visual style descriptions) derived from markdown processing.
- **SC-002**: Website generation completes successfully for 100% of restaurants without existing websites (no blocking failures from missing website markdown).
- **SC-003**: Repeat generations for the same restaurant retrieve cached markdown, reducing processing time by at least 50%.
- **SC-004**: The system handles crawler API timeouts or failures gracefully in 100% of cases, providing clear feedback to users.

## Assumptions

- The external crawler API at `CRAWLER_API_URL` is already updated with the new endpoints (`/generate-google-maps-markdown` and `/crawl-website-markdown`).
- The existing `/crawl` endpoint remains a prerequisite - the new markdown endpoints require prior crawl data.
- Session IDs are managed by the crawler service and remain valid for markdown generation after crawl.
- The `max_pages` parameter for website crawling defaults to 1 (homepage only).
- Visual analysis is always enabled for website markdown to capture design/style information.

## Clarifications

### Session 2026-02-01

- Q: How should existing projects with old crawled_data format be handled? → A: Graceful coexistence - old projects keep working with existing data, new crawls populate markdown fields. No migration required.
- Q: What timeout threshold for markdown API calls? → A: 120 seconds per markdown API call (more tolerance for LLM Vision processing).
- Q: Should markdown API calls run in parallel or sequentially? → A: Parallel - both `/generate-google-maps-markdown` and `/crawl-website-markdown` run simultaneously after `/crawl` completes, since both only require the session_id.
- Q: Session ID consistency across flow? → A: All three APIs (`/crawl`, `/generate-google-maps-markdown`, `/crawl-website-markdown`) MUST use the same session_id throughout the entire flow.

## Out of Scope

- Changes to the crawler API itself (this spec covers only the website-agent integration).
- Multi-page website crawling beyond the homepage.
- Custom session management or session expiration handling.
- UI changes to display markdown content to users directly.
