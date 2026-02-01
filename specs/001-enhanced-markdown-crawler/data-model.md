# Data Model: Enhanced Markdown Crawler Integration

**Branch**: `001-enhanced-markdown-crawler`
**Date**: 2026-02-01
**Spec**: [spec.md](./spec.md)

## Overview

This document defines the data model changes required to support LLM-processed markdown content from the crawler API. The changes extend the existing `BusinessProfile` interface and add new types for the markdown API responses.

## Entity Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         BusinessProfile                          │
├─────────────────────────────────────────────────────────────────┤
│ session_id?: string                                              │
│ gmaps_url?: string                                               │
│ crawled_at?: string                                              │
├─────────────────────────────────────────────────────────────────┤
│ // Legacy fields (for existing projects)                         │
│ crawled_data?: BusinessData                                      │
│ generated_content?: GeneratedContent                             │
├─────────────────────────────────────────────────────────────────┤
│ // New fields (for enhanced crawls)                              │
│ google_maps_markdown?: string                                    │
│ website_markdown?: string                                        │
└─────────────────────────────────────────────────────────────────┘
```

## Type Definitions

### Extended BusinessProfile

**File**: `app/types/project.ts`

```typescript
/**
 * Business profile data from crawler API.
 *
 * Supports two data formats:
 * 1. Legacy: crawled_data (raw JSON) + generated_content (AI-processed JSON)
 * 2. Enhanced: google_maps_markdown + website_markdown (LLM-ready content)
 *
 * New crawls populate the markdown fields. Existing projects retain legacy format.
 */
export interface BusinessProfile {
  /** Unique session ID linking all crawler operations */
  session_id?: string;

  /** Original Google Maps URL used for crawling */
  gmaps_url?: string;

  /** Timestamp when crawl was performed */
  crawled_at?: string;

  // ─── Legacy Fields (existing projects) ───────────────────────────

  /** Raw Google Maps data from /crawl endpoint */
  crawled_data?: BusinessData;

  /** AI-generated content from /generate-website-content endpoint */
  generated_content?: GeneratedContent;

  // ─── Enhanced Fields (new crawls) ────────────────────────────────

  /**
   * Markdown profile generated from Google Maps data.
   * Contains structured sections: Basic Info, Hours, Menu, Reviews, etc.
   * Pre-formatted for LLM prompt injection.
   */
  google_maps_markdown?: string;

  /**
   * Markdown from crawling the restaurant's existing website.
   * Contains visual style descriptions, layout analysis, and content sections.
   * Optional - only populated if restaurant has a website.
   */
  website_markdown?: string;
}
```

### New Request/Response Types

**File**: `app/types/crawler.ts`

```typescript
// ─── Google Maps Markdown ────────────────────────────────────────

/**
 * Request to generate markdown from previously crawled Google Maps data.
 * Requires prior /crawl call with the same session_id.
 */
export interface GenerateGoogleMapsMarkdownRequest {
  session_id: string;
}

/**
 * Response containing LLM-processed markdown profile.
 */
export interface GenerateGoogleMapsMarkdownResponse {
  success: boolean;

  /** Markdown content (only present on success) */
  markdown?: string;

  /** Error message (only present on failure) */
  error?: string;

  /** HTTP status code from crawler API */
  statusCode?: number;
}

// ─── Website Markdown ────────────────────────────────────────────

/**
 * Request to crawl a website and convert to rich markdown.
 */
export interface CrawlWebsiteMarkdownRequest {
  /** Website URL to crawl */
  url: string;

  /** Maximum pages to crawl (default: 1, homepage only) */
  max_pages?: number;

  /** Session ID linking to prior /crawl operation */
  session_id: string;

  /** Enable LLM Vision analysis for visual descriptions (default: true) */
  enable_visual_analysis?: boolean;
}

/**
 * Response containing website markdown with visual analysis.
 */
export interface CrawlWebsiteMarkdownResponse {
  success: boolean;

  /** Response data (only present on success) */
  data?: {
    /** Markdown content with visual style descriptions */
    markdown: string;

    /** Session ID (echoed back) */
    session_id: string;

    /** Crawled URL */
    url: string;
  };

  /** Error message (only present on failure) */
  error?: string;

  /** HTTP status code from crawler API */
  statusCode?: number;
}
```

### Crawler Client Method Signatures

**File**: `app/lib/services/crawlerClient.server.ts`

```typescript
/**
 * Generate markdown profile from previously crawled Google Maps data.
 *
 * Prerequisites: extractBusinessData() must have been called with the same sessionId.
 * Caching: Crawler API caches results per session_id.
 *
 * @param sessionId - Session ID from prior /crawl operation
 * @returns Markdown profile or error
 */
export async function generateGoogleMapsMarkdown(
  sessionId: string
): Promise<GenerateGoogleMapsMarkdownResponse>;

/**
 * Crawl a website and generate rich markdown with visual analysis.
 *
 * Uses LLM Vision to describe images, layout, and visual style.
 * Timeout: 120 seconds to accommodate Vision processing.
 *
 * @param request - Website URL, session ID, and options
 * @returns Website markdown or error
 */
export async function crawlWebsiteMarkdown(
  request: CrawlWebsiteMarkdownRequest
): Promise<CrawlWebsiteMarkdownResponse>;
```

## Field Specifications

### google_maps_markdown

| Property | Value |
|----------|-------|
| Type | `string` (nullable) |
| Max Length | ~50KB (typical: 5-15KB) |
| Format | Markdown with sections |
| Required | Yes (for new crawls) |
| Mutable | Yes (re-crawl overwrites) |

**Expected Sections**:
- `# Restaurant Name`
- `## Basic Info` (address, rating, reviews count, price level, category)
- `## Hours` (opening hours per day)
- `## Contact` (phone, website)
- `## Menu` (categories and items with prices)
- `## Reviews` (top reviews with quotes)
- `## Attributes` (atmosphere, offerings, accessibility)

### website_markdown

| Property | Value |
|----------|-------|
| Type | `string` (nullable) |
| Max Length | ~100KB (typical: 10-30KB) |
| Format | Markdown with visual descriptions |
| Required | No (optional) |
| Mutable | Yes (re-crawl overwrites) |

**Expected Content**:
- Global visual style description
- Color palette observations
- Typography analysis
- Layout structure
- Section-by-section content
- Image descriptions (via LLM Vision)

## Validation Rules

### BusinessProfile Validation

```typescript
function validateBusinessProfile(profile: BusinessProfile): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Must have either legacy data OR markdown
  const hasLegacyData = !!profile.crawled_data;
  const hasMarkdown = !!profile.google_maps_markdown;

  if (!hasLegacyData && !hasMarkdown) {
    errors.push('No business data available (crawled_data or google_maps_markdown required)');
  }

  // Extract business name from available sources
  const businessName = extractBusinessName(profile);
  if (!businessName) {
    errors.push('Business name is required');
  }

  // Warnings for missing optional data
  if (!profile.website_markdown && !profile.crawled_data?.website) {
    warnings.push('No website data available');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    canProceedWithDefaults: errors.length === 0,
  };
}

function extractBusinessName(profile: BusinessProfile): string | undefined {
  return (
    profile.generated_content?.businessIdentity?.displayName ||
    profile.crawled_data?.name ||
    extractNameFromMarkdown(profile.google_maps_markdown)
  );
}
```

### Markdown Content Validation

```typescript
function validateMarkdownContent(markdown: string): boolean {
  // Basic sanity checks
  if (!markdown || markdown.length < 100) {
    return false; // Too short to be valid
  }

  if (markdown.length > 200_000) {
    return false; // Too large, likely error
  }

  // Should contain at least one heading
  if (!markdown.includes('#')) {
    return false;
  }

  return true;
}
```

## State Transitions

### BusinessProfile Lifecycle

```
┌─────────────┐
│   Empty     │
│ (no data)   │
└──────┬──────┘
       │ searchRestaurant()
       ↓
┌─────────────┐
│  Verified   │
│ (place_id)  │
└──────┬──────┘
       │ extractBusinessData()
       ↓
┌─────────────────────┐
│      Crawled        │
│ (session_id set)    │
│ (crawled_at set)    │
└──────┬──────────────┘
       │ generateGoogleMapsMarkdown() + crawlWebsiteMarkdown()
       │ (parallel)
       ↓
┌─────────────────────────────────────┐
│           Markdown Ready            │
│ (google_maps_markdown set)          │
│ (website_markdown set, if website)  │
└─────────────────────────────────────┘
```

### Legacy vs Enhanced Data

```
┌─────────────────────────────────────────────────────────────────┐
│                    Existing Project                              │
│                                                                  │
│  crawled_data: { name, address, ... }  ← Legacy                 │
│  generated_content: { brandStrategy, ... }  ← Legacy            │
│  google_maps_markdown: undefined                                 │
│  website_markdown: undefined                                     │
│                                                                  │
│  → Generation uses: crawled_data + generated_content            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     New Project                                  │
│                                                                  │
│  crawled_data: undefined  ← Not set                             │
│  generated_content: undefined  ← Not set                        │
│  google_maps_markdown: "# Restaurant..."  ← Enhanced            │
│  website_markdown: "# Page: https://..."  ← Enhanced (optional) │
│                                                                  │
│  → Generation uses: google_maps_markdown + website_markdown     │
└─────────────────────────────────────────────────────────────────┘
```

## Database Considerations

### Storage

The `BusinessProfile` is stored as a JSONB column on the `projects` table in Supabase/PostgreSQL. No schema migration is required because:

1. JSONB is schema-less - new fields are automatically supported
2. Existing projects retain their `crawled_data` structure
3. New projects use new fields without affecting existing data

### Indexing

No additional indexes required for markdown fields:
- Queries are by `project_id` (already indexed)
- Full-text search on markdown not required for MVP
- Content is used in application layer, not SQL queries

### Size Estimates

| Field | Avg Size | Max Size |
|-------|----------|----------|
| google_maps_markdown | 10 KB | 50 KB |
| website_markdown | 20 KB | 100 KB |
| Total increase | ~30 KB | ~150 KB |

This is comparable to existing `crawled_data` size (~20-50 KB).

## Migration Strategy

**No migration required.**

- Existing projects: Continue to work with `crawled_data`
- New crawls: Populate markdown fields
- Generation service: Check for markdown first, fall back to legacy
- Gradual transition: No forced migration, organic adoption

## Related Entities

### CrawlSession (Conceptual)

The `session_id` links multiple operations:

```
session_id
    ├── /crawl (extractBusinessData)
    ├── /generate-google-maps-markdown
    └── /crawl-website-markdown
```

This is managed by the crawler service (MongoDB collections). The website-agent only stores the `session_id` for reference.

### Project

```typescript
interface Project {
  id: string;
  user_id: string;
  business_profile?: BusinessProfile | null; // Contains markdown fields
  // ... other fields
}
```

The `business_profile` JSONB column contains the BusinessProfile with optional markdown fields.
