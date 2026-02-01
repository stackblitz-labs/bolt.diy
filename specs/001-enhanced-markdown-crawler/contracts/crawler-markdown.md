# API Contracts: Enhanced Markdown Crawler Integration

**Branch**: `001-enhanced-markdown-crawler`
**Date**: 2026-02-01
**Spec**: [spec.md](../spec.md)

## Overview

This document defines the API contracts for the crawler client methods that integrate with the external HuskIT Crawler API's new markdown endpoints.

---

## Crawler Client Methods

### 1. generateGoogleMapsMarkdown

Generates an LLM-processed markdown profile from previously crawled Google Maps data.

#### Signature

```typescript
export async function generateGoogleMapsMarkdown(
  sessionId: string
): Promise<GenerateGoogleMapsMarkdownResponse>
```

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| sessionId | string | Yes | Session ID from prior `/crawl` operation |

#### Return Type

```typescript
interface GenerateGoogleMapsMarkdownResponse {
  success: boolean;
  markdown?: string;
  error?: string;
  statusCode?: number;
}
```

#### HTTP Request (to Crawler API)

```
POST /generate-google-maps-markdown
Content-Type: application/json

{
  "session_id": "6e1091de-c360-4b6f-a0cb-40a6037bb797"
}
```

#### HTTP Response Examples

**Success (200)**:
```json
{
  "success": true,
  "markdown": "# Kuu Ramen\n\n## Basic Info\n- **Address**: 1275 1st Ave, New York, NY 10065\n- **Rating**: 4.8 (2030 reviews)\n- **Price Level**: $$\n- **Category**: Japanese Restaurant\n\n## Hours\n- Monday: 11:30 AM – 10:00 PM\n- Tuesday: 11:30 AM – 10:00 PM\n..."
}
```

**Not Found (404)**:
```json
{
  "success": false,
  "error": "Google Maps crawl data not found for session_id"
}
```

**Server Error (500)**:
```json
{
  "success": false,
  "error": "Gemini API call failed: rate limit exceeded"
}
```

#### Timeout

- 120 seconds (per FR-010)

#### Caching Behavior

The crawler API caches results in `mongodb_google_maps_markdown_collection`. Subsequent calls with the same `session_id` return cached markdown without re-processing.

---

### 2. crawlWebsiteMarkdown

Crawls a website and generates rich markdown with LLM Vision analysis.

#### Signature

```typescript
export async function crawlWebsiteMarkdown(
  request: CrawlWebsiteMarkdownRequest
): Promise<CrawlWebsiteMarkdownResponse>
```

#### Parameters

```typescript
interface CrawlWebsiteMarkdownRequest {
  url: string;
  session_id: string;
  max_pages?: number;          // Default: 1
  enable_visual_analysis?: boolean;  // Default: true (per FR-007)
}
```

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| url | string | Yes | - | Website URL to crawl |
| session_id | string | Yes | - | Session ID linking to prior `/crawl` |
| max_pages | number | No | 1 | Maximum pages to crawl |
| enable_visual_analysis | boolean | No | true | Enable LLM Vision for image descriptions |

#### Return Type

```typescript
interface CrawlWebsiteMarkdownResponse {
  success: boolean;
  data?: {
    markdown: string;
    session_id: string;
    url: string;
  };
  error?: string;
  statusCode?: number;
}
```

#### HTTP Request (to Crawler API)

```
POST /crawl-website-markdown
Content-Type: application/json

{
  "url": "https://www.kuuramen.com/",
  "max_pages": 1,
  "session_id": "6e1091de-c360-4b6f-a0cb-40a6037bb797",
  "enable_visual_analysis": true
}
```

#### HTTP Response Examples

**Success (200)**:
```json
{
  "success": true,
  "data": {
    "markdown": "# Page: https://www.kuuramen.com/\n\n> **Global Visual Style**: Modern Japanese aesthetic with warm wood tones and minimalist design. Clean typography with emphasis on food photography.\n\n## Hero Section\nLarge hero image showing a steaming bowl of ramen. Tagline: \"Authentic Japanese Ramen in NYC\"...",
    "session_id": "6e1091de-c360-4b6f-a0cb-40a6037bb797",
    "url": "https://www.kuuramen.com/"
  }
}
```

**Not Found (404)**:
```json
{
  "success": false,
  "error": "Google Maps crawl data not found"
}
```

**Validation Error (422)**:
```json
{
  "success": false,
  "error": "Invalid crawl data structure"
}
```

**Server Error (500)**:
```json
{
  "success": false,
  "error": "Gemini API call failed"
}
```

#### Timeout

- 120 seconds (per FR-010)
- Website crawling with Vision analysis is computationally expensive

#### Error Handling

This method is **optional** - failures should not block the generation flow:

```typescript
// Recommended usage pattern
const [gmapsResult, websiteResult] = await Promise.allSettled([
  generateGoogleMapsMarkdown(sessionId),
  crawlWebsiteMarkdown({ url: websiteUrl, session_id: sessionId }),
]);

// gmapsResult is required
if (gmapsResult.status === 'rejected' || !gmapsResult.value.success) {
  throw new Error('Google Maps markdown generation failed');
}

// websiteResult is optional
const websiteMarkdown = websiteResult.status === 'fulfilled' && websiteResult.value.success
  ? websiteResult.value.data?.markdown
  : undefined;
```

---

## Type Definitions

Add these to `app/types/crawler.ts`:

```typescript
// ─── Google Maps Markdown Types ──────────────────────────────────

export interface GenerateGoogleMapsMarkdownRequest {
  session_id: string;
}

export interface GenerateGoogleMapsMarkdownResponse {
  success: boolean;
  markdown?: string;
  error?: string;
  statusCode?: number;
}

// ─── Website Markdown Types ──────────────────────────────────────

export interface CrawlWebsiteMarkdownRequest {
  url: string;
  session_id: string;
  max_pages?: number;
  enable_visual_analysis?: boolean;
}

export interface CrawlWebsiteMarkdownResponse {
  success: boolean;
  data?: {
    markdown: string;
    session_id: string;
    url: string;
  };
  error?: string;
  statusCode?: number;
}
```

---

## Integration in api.crawler.extract.ts

The API route should be updated to call both markdown endpoints after the initial crawl:

```typescript
// After successful extractBusinessData()
const crawlResult = await extractBusinessData(payload);

if (!crawlResult.success) {
  return json({ error: { ... } }, { status: 500 });
}

// Extract website URL from crawl result
const websiteUrl = crawlResult.data?.website;

// Call both markdown endpoints in parallel
const MARKDOWN_TIMEOUT = 120_000; // 120 seconds per FR-010

const [gmapsMarkdownResult, websiteMarkdownResult] = await Promise.allSettled([
  generateGoogleMapsMarkdown(sessionId),
  websiteUrl
    ? crawlWebsiteMarkdown({
        url: websiteUrl,
        session_id: sessionId,
        enable_visual_analysis: true,
      })
    : Promise.resolve({ success: false, error: 'No website URL' }),
]);

// Build response with markdown data
const response = {
  success: true,
  data: crawlResult.data,
  google_maps_markdown: gmapsMarkdownResult.status === 'fulfilled' && gmapsMarkdownResult.value.success
    ? gmapsMarkdownResult.value.markdown
    : undefined,
  website_markdown: websiteMarkdownResult.status === 'fulfilled' && websiteMarkdownResult.value.success
    ? websiteMarkdownResult.value.data?.markdown
    : undefined,
};

return json(response);
```

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| MARKDOWN_GENERATION_FAILED | 500 | Google Maps markdown generation failed |
| WEBSITE_CRAWL_FAILED | 500 | Website markdown crawl failed (non-blocking) |
| MARKDOWN_TIMEOUT | 408 | Markdown API call timed out after 120s |
| SESSION_NOT_FOUND | 404 | Session ID not found (crawl data missing) |
| INVALID_CRAWL_DATA | 422 | Crawl data structure is invalid |

---

## Sequence Diagram

```
Client                  api.crawler.extract     crawlerClient        Crawler API
   │                            │                    │                    │
   │  POST /api/crawler/extract │                    │                    │
   │ ─────────────────────────> │                    │                    │
   │                            │                    │                    │
   │                            │  extractBusinessData()                  │
   │                            │ ──────────────────>│ POST /crawl        │
   │                            │                    │ ──────────────────>│
   │                            │                    │<──────────────────│
   │                            │<──────────────────│                    │
   │                            │                    │                    │
   │                            │ ┌────────────────────────────────────┐ │
   │                            │ │  Promise.allSettled (parallel)     │ │
   │                            │ │                                    │ │
   │                            │ │  generateGoogleMapsMarkdown()      │ │
   │                            │ │ ────────────────>│ POST /generate...│ │
   │                            │ │                  │ ────────────────>│ │
   │                            │ │                  │<────────────────│ │
   │                            │ │                  │                  │ │
   │                            │ │  crawlWebsiteMarkdown()            │ │
   │                            │ │ ────────────────>│ POST /crawl-web..│ │
   │                            │ │                  │ ────────────────>│ │
   │                            │ │                  │<────────────────│ │
   │                            │ │<────────────────│                  │ │
   │                            │ └────────────────────────────────────┘ │
   │                            │                    │                    │
   │<─────────────────────────│                    │                    │
   │  { success, data,         │                    │                    │
   │    google_maps_markdown,  │                    │                    │
   │    website_markdown }     │                    │                    │
```
