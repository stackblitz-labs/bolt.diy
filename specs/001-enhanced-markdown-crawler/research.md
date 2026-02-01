# Research: Enhanced Markdown Crawler Integration

**Branch**: `001-enhanced-markdown-crawler`
**Date**: 2026-02-01
**Spec**: [spec.md](./spec.md)

## Executive Summary

This research documents the findings from analyzing the current crawler integration and determining the best approach to integrate two new markdown generation endpoints (`/generate-google-maps-markdown` and `/crawl-website-markdown`) into the website-agent.

## Current Architecture Analysis

### Existing Crawler Flow

**File**: [app/lib/services/crawlerClient.server.ts](../../app/lib/services/crawlerClient.server.ts)

The current crawler client provides three methods:
1. `searchRestaurant(businessName, address)` → Search for restaurant verification
2. `extractBusinessData(payload)` → Call `/crawl` endpoint to extract Google Maps data
3. `generateWebsiteContent(sessionId)` → Call `/generate-website-content` for AI content

**Current Flow**:
```
searchRestaurant() → extractBusinessData() → generateWebsiteContent()
                              ↓
                     CrawlResponse with BusinessData
                              ↓
                     Stored in BusinessProfile.crawled_data
```

### Current Data Model

**File**: [app/types/project.ts](../../app/types/project.ts)

```typescript
interface BusinessProfile {
  session_id?: string;
  gmaps_url?: string;
  crawled_data?: BusinessData;        // Raw JSON from /crawl
  generated_content?: GeneratedContent; // AI content from /generate-website-content
  crawled_at?: string;
}
```

**Issue**: The `crawled_data` field contains raw JSON that requires parsing. The new markdown endpoints provide pre-processed, LLM-friendly content.

### Current API Route

**File**: [app/routes/api.crawler.extract.ts](../../app/routes/api.crawler.extract.ts)

- Accepts POST with `session_id` and one of: `google_maps_url`, `business_name + address`, `website_url`, or `place_id`
- Calls `extractBusinessData()` from crawler client
- Returns `CrawlResponse` with `BusinessData`

### Project Generation Service Usage

**File**: [app/lib/services/projectGenerationService.ts](../../app/lib/services/projectGenerationService.ts)

The generation service uses `BusinessProfile` in multiple places:
1. `validateBusinessProfile()` - Validates required fields
2. `analyzeBusinessProfile()` - Extracts cuisine, price tier, style for template selection
3. `selectTemplate()` - Uses analysis to select best template
4. `generateContent()` - Composes prompts from business data
5. `composeContentPrompt()` - Builds detailed prompt with business info
6. `formatBusinessDataForPrompt()` - Formats crawled data for LLM

**Key insight**: The generation service currently extracts data from `crawled_data` (JSON) and formats it into prompts. With markdown, this formatting is already done by the crawler API.

## New Endpoints Analysis

### Endpoint 1: POST /generate-google-maps-markdown

**Purpose**: Convert raw Google Maps crawl data into structured markdown profile.

**Request**:
```json
{
  "session_id": "unique-session-123"
}
```

**Response**:
```json
{
  "success": true,
  "markdown": "# Restaurant Name\n\n## Basic Info\n- **Address**: ...\n- **Rating**: 4.5 (273 reviews)\n..."
}
```

**Prerequisite**: Requires prior `/crawl` call with same `session_id`.

**Caching**: Built-in caching via `mongodb_google_maps_markdown_collection`.

### Endpoint 2: POST /crawl-website-markdown

**Purpose**: Crawl restaurant's existing website and generate rich markdown with visual analysis.

**Request**:
```json
{
  "url": "https://restaurant-website.com",
  "max_pages": 1,
  "session_id": "session-123",
  "enable_visual_analysis": true
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "markdown": "# Page: https://...\n> **Global Visual Style**: Modern, minimalist...\n\n## Section 1\n...",
    "session_id": "session-123",
    "url": "https://restaurant-website.com"
  }
}
```

**Optional**: Only called when website URL is present in crawled data.

## Design Decisions

### Decision 1: Data Storage Strategy

**Chosen**: Replace `crawled_data` with markdown fields for new crawls

**Rationale**:
- Markdown is the primary content source for LLM prompts
- Reduces redundancy (no raw JSON + formatted text)
- Cleaner data model
- User decision: graceful coexistence - old projects keep `crawled_data`, new crawls use markdown

**Implementation**:
```typescript
interface BusinessProfile {
  session_id?: string;
  gmaps_url?: string;
  // Legacy (for existing projects)
  crawled_data?: BusinessData;
  generated_content?: GeneratedContent;
  // New (for enhanced crawls)
  google_maps_markdown?: string;
  website_markdown?: string;
  crawled_at?: string;
}
```

### Decision 2: API Call Orchestration

**Chosen**: Parallel execution after `/crawl` completes

**Rationale**:
- Both markdown endpoints only require `session_id` from the prior crawl
- Parallel execution reduces total time from ~240s to ~120s worst case
- 120-second timeout per call accommodates LLM Vision processing

**Flow**:
```
/crawl (session_id)
        ↓
        ↓ (completes, returns website_url if present)
        ↓
┌───────┴───────┐
↓               ↓
/generate-google-maps-markdown    /crawl-website-markdown (if website_url)
session_id                        session_id + url
↓               ↓
└───────┬───────┘
        ↓ (parallel, Promise.allSettled)
        ↓
Store both in BusinessProfile
```

### Decision 3: Error Handling Strategy

**Chosen**: Graceful degradation with partial data

**Rationale**:
- Google Maps markdown is required (contains essential business info)
- Website markdown is optional (many restaurants don't have websites)
- Website crawl failures (timeouts, bot protection) shouldn't block generation

**Implementation**:
- Use `Promise.allSettled()` for parallel calls
- Proceed with Google Maps markdown if website markdown fails
- Log warnings for failed website crawls

### Decision 4: Generation Service Integration

**Chosen**: Prioritize markdown content, fallback to legacy data

**Rationale**:
- Markdown content is pre-formatted for LLM consumption
- Need to support existing projects with `crawled_data`
- Smooth transition path

**Implementation in `composeContentPrompt()`**:
```typescript
// Priority: markdown > generated_content > crawled_data
const googleMapsContext = businessProfile.google_maps_markdown
  || formatBusinessDataForPrompt(businessProfile);

const websiteContext = businessProfile.website_markdown || '';
```

## Alternatives Considered

### Alternative 1: Store Both Raw + Markdown

**Rejected because**:
- Storage overhead
- Data consistency issues (raw vs markdown could diverge)
- User explicitly chose "replace entirely"

### Alternative 2: Sequential API Calls

**Rejected because**:
- Doubles total wait time (~240s vs ~120s)
- No dependency between the two markdown endpoints
- Poor user experience

### Alternative 3: Replace `/generate-website-content` Entirely

**Deferred because**:
- `/generate-website-content` provides structured JSON (colors, typography, sections)
- Markdown provides contextual prose but not structured design tokens
- Both have value; can be combined in future iteration

## Technical Dependencies

### External Dependencies
- HuskIT Crawler API with new endpoints (assumed available per spec)
- MongoDB caching on crawler side (transparent to website-agent)

### Internal Dependencies
- `crawlerClient.server.ts` - Add two new methods
- `crawler.ts` types - Add new request/response interfaces
- `project.ts` types - Extend BusinessProfile
- `api.crawler.extract.ts` - Update to call markdown endpoints
- `projectGenerationService.ts` - Update prompt composition

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Crawler API unavailable | Low | High | Retry logic, clear error messages |
| LLM Vision timeout (120s) | Medium | Medium | Configurable timeout, proceed without website markdown |
| Markdown format inconsistency | Low | Low | Validate markdown before storage |
| Existing project regression | Low | High | Graceful coexistence, no migration |

## Performance Considerations

### Current Baseline
- `/crawl`: ~30-60s (Google Maps scraping)
- `/generate-website-content`: ~20-30s (LLM processing)
- Total: ~60-90s

### With Enhancement
- `/crawl`: ~30-60s (unchanged)
- `/generate-google-maps-markdown` + `/crawl-website-markdown`: ~60-120s parallel (LLM Vision)
- Total: ~90-180s worst case

### Mitigation
- Caching on crawler side reduces repeat requests
- Website markdown is optional (skipped if no website)
- Generation pipeline uses pre-processed markdown (may speed up LLM prompts)

## Conclusion

The enhanced markdown crawler integration is well-scoped and aligns with the existing architecture. Key decisions:

1. **Add new fields** to BusinessProfile (`google_maps_markdown`, `website_markdown`)
2. **Parallel execution** of markdown endpoints after `/crawl`
3. **Graceful coexistence** with existing projects
4. **Optional website markdown** with graceful degradation

The implementation involves:
- 2 new crawler client methods
- 4 new TypeScript interfaces
- Updates to 3 existing files (types, API route, generation service)
- No database migrations required (JSONB column already flexible)
