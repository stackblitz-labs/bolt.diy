# Quickstart: Enhanced Markdown Crawler Integration

**Branch**: `001-enhanced-markdown-crawler`
**Date**: 2026-02-01
**Spec**: [spec.md](./spec.md)

## Overview

This quickstart guide provides step-by-step instructions for implementing the enhanced markdown crawler integration. Follow these steps in order.

## Prerequisites

1. **Crawler API**: Ensure the HuskIT Crawler API is running at `CRAWLER_API_URL` with the new endpoints:
   - `POST /generate-google-maps-markdown`
   - `POST /crawl-website-markdown`

2. **Development Environment**:
   ```bash
   pnpm install
   pnpm run dev
   ```

3. **Environment Variables** (`.env.local`):
   ```
   CRAWLER_API_URL=http://localhost:4999
   ```

## Implementation Steps

### Step 1: Add New Type Definitions

**File**: `app/types/crawler.ts`

Add the new request/response interfaces at the end of the file:

```typescript
// ─── Google Maps Markdown ────────────────────────────────────────

export interface GenerateGoogleMapsMarkdownRequest {
  session_id: string;
}

export interface GenerateGoogleMapsMarkdownResponse {
  success: boolean;
  markdown?: string;
  error?: string;
  statusCode?: number;
}

// ─── Website Markdown ────────────────────────────────────────────

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

### Step 2: Extend BusinessProfile Type

**File**: `app/types/project.ts`

Add the new markdown fields to the `BusinessProfile` interface:

```typescript
export interface BusinessProfile {
  session_id?: string;
  gmaps_url?: string;
  crawled_data?: BusinessData;
  generated_content?: GeneratedContent;
  crawled_at?: string;
  // Add these new fields:
  google_maps_markdown?: string;
  website_markdown?: string;
}
```

### Step 3: Add Crawler Client Methods

**File**: `app/lib/services/crawlerClient.server.ts`

Add two new exported functions after the existing methods:

```typescript
import type {
  // ... existing imports
  GenerateGoogleMapsMarkdownResponse,
  CrawlWebsiteMarkdownRequest,
  CrawlWebsiteMarkdownResponse,
} from '~/types/crawler';

const MARKDOWN_TIMEOUT = 120_000; // 120 seconds for LLM Vision processing

/**
 * Generate markdown profile from previously crawled Google Maps data.
 */
export async function generateGoogleMapsMarkdown(
  sessionId: string
): Promise<GenerateGoogleMapsMarkdownResponse> {
  const startTime = Date.now();

  try {
    logger.info(`[Crawler] Generating Google Maps markdown`, { sessionId });

    const response = await fetchWithTimeout(
      `${CRAWLER_API_URL}/generate-google-maps-markdown`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      },
      MARKDOWN_TIMEOUT,
    );

    const duration = Date.now() - startTime;

    if (!response.ok) {
      logger.error(`[Crawler] Google Maps markdown failed`, {
        sessionId,
        status: response.status,
        duration: `${duration}ms`,
      });

      let errorDetails = `Crawler API returned ${response.status}`;
      try {
        const errorBody = await response.json();
        if (errorBody?.error) errorDetails = errorBody.error;
      } catch { /* ignore */ }

      return {
        success: false,
        error: errorDetails,
        statusCode: response.status,
      };
    }

    const data = await response.json();
    logger.info(`[Crawler] Google Maps markdown success`, { sessionId, duration: `${duration}ms` });

    return data as GenerateGoogleMapsMarkdownResponse;
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('timed out')) {
      return { success: false, error: `Timed out after ${MARKDOWN_TIMEOUT}ms`, statusCode: 408 };
    }

    return { success: false, error: `Crawler unavailable (${errorMessage})`, statusCode: 503 };
  }
}

/**
 * Crawl a website and generate rich markdown with visual analysis.
 */
export async function crawlWebsiteMarkdown(
  request: CrawlWebsiteMarkdownRequest
): Promise<CrawlWebsiteMarkdownResponse> {
  const startTime = Date.now();

  try {
    logger.info(`[Crawler] Crawling website for markdown`, {
      url: request.url,
      sessionId: request.session_id,
    });

    const response = await fetchWithTimeout(
      `${CRAWLER_API_URL}/crawl-website-markdown`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: request.url,
          max_pages: request.max_pages ?? 1,
          session_id: request.session_id,
          enable_visual_analysis: request.enable_visual_analysis ?? true,
        }),
      },
      MARKDOWN_TIMEOUT,
    );

    const duration = Date.now() - startTime;

    if (!response.ok) {
      logger.error(`[Crawler] Website markdown failed`, {
        url: request.url,
        status: response.status,
        duration: `${duration}ms`,
      });

      let errorDetails = `Crawler API returned ${response.status}`;
      try {
        const errorBody = await response.json();
        if (errorBody?.error) errorDetails = errorBody.error;
      } catch { /* ignore */ }

      return {
        success: false,
        error: errorDetails,
        statusCode: response.status,
      };
    }

    const data = await response.json();
    logger.info(`[Crawler] Website markdown success`, {
      url: request.url,
      duration: `${duration}ms`,
    });

    return data as CrawlWebsiteMarkdownResponse;
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('timed out')) {
      return { success: false, error: `Timed out after ${MARKDOWN_TIMEOUT}ms`, statusCode: 408 };
    }

    return { success: false, error: `Crawler unavailable (${errorMessage})`, statusCode: 503 };
  }
}
```

### Step 4: Update API Route

**File**: `app/routes/api.crawler.extract.ts`

Update the action function to call markdown endpoints after successful crawl:

```typescript
import {
  extractBusinessData,
  generateGoogleMapsMarkdown,
  crawlWebsiteMarkdown,
} from '~/lib/services/crawlerClient.server';

// Inside action() after successful extractBusinessData():

// Call crawler API
const result = await extractBusinessData({ ... });

if (!result.success) {
  // ... existing error handling
}

// NEW: Generate markdown in parallel
const websiteUrl = result.data?.website;

const [gmapsMarkdownResult, websiteMarkdownResult] = await Promise.allSettled([
  generateGoogleMapsMarkdown(sessionId),
  websiteUrl
    ? crawlWebsiteMarkdown({
        url: websiteUrl,
        session_id: sessionId,
        enable_visual_analysis: true,
      })
    : Promise.resolve({ success: false, error: 'No website URL' } as const),
]);

// Extract markdown values
const googleMapsMarkdown =
  gmapsMarkdownResult.status === 'fulfilled' && gmapsMarkdownResult.value.success
    ? gmapsMarkdownResult.value.markdown
    : undefined;

const websiteMarkdown =
  websiteMarkdownResult.status === 'fulfilled' &&
  websiteMarkdownResult.value.success &&
  'data' in websiteMarkdownResult.value
    ? websiteMarkdownResult.value.data?.markdown
    : undefined;

// Log results
logger.info(`[API] Markdown generation complete`, {
  sessionId,
  hasGoogleMapsMarkdown: !!googleMapsMarkdown,
  hasWebsiteMarkdown: !!websiteMarkdown,
});

// Return enhanced response
return json({
  ...result,
  google_maps_markdown: googleMapsMarkdown,
  website_markdown: websiteMarkdown,
});
```

### Step 5: Update Generation Service

**File**: `app/lib/services/projectGenerationService.ts`

Update `composeContentPrompt()` to use markdown content:

```typescript
function composeContentPrompt(businessProfile: BusinessProfile, themePrompt: string): string {
  // Check if we have enhanced markdown content
  const hasMarkdown = !!businessProfile.google_maps_markdown;

  if (hasMarkdown) {
    // Use markdown content directly
    const websiteContext = businessProfile.website_markdown
      ? `\n\nEXISTING WEBSITE ANALYSIS:\n${businessProfile.website_markdown}`
      : '';

    return `
THEME DESIGN INSTRUCTIONS:
${themePrompt}

BUSINESS PROFILE (MARKDOWN FORMAT):
${businessProfile.google_maps_markdown}
${websiteContext}

CONTENT REQUIREMENTS:
1. MUST use the exact business name in header, footer, and meta title.
2. MUST use the exact address and phone in the Contact section if provided.
3. MUST use provided hours if available.
4. MUST replace ALL placeholders with business data (no lorem ipsum).
5. MUST generate complete file contents (no TODOs).
6. SHOULD use the website analysis to match visual style if available.

TASK: Generate a complete, production-ready restaurant website using the business information above.
`.trim();
  }

  // Fall back to legacy formatting
  // ... existing composeContentPrompt logic
}
```

### Step 6: Update Business Profile Validation

**File**: `app/lib/services/projectGenerationService.ts`

Update `validateBusinessProfile()` to support markdown:

```typescript
export function validateBusinessProfile(profile: BusinessProfile | null | undefined): BusinessProfileValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!profile) {
    return { valid: false, errors: ['No business profile data'], warnings: [], canProceedWithDefaults: false };
  }

  // Check for either legacy data OR markdown
  const hasLegacyData = !!profile.crawled_data?.name || !!profile.generated_content?.businessIdentity?.displayName;
  const hasMarkdown = !!profile.google_maps_markdown;

  if (!hasLegacyData && !hasMarkdown) {
    errors.push('Business data is required (crawled_data or google_maps_markdown)');
  }

  // Warnings
  if (!profile.website_markdown && !profile.crawled_data?.website) {
    warnings.push('No website data available');
  }

  const valid = errors.length === 0;
  return { valid, errors, warnings, canProceedWithDefaults: valid };
}
```

## Testing

### Manual Testing

1. **Start the crawler API**:
   ```bash
   cd ../crawler
   pnpm run dev
   ```

2. **Create a new project**:
   - Go to the app and create a new project with a Google Maps URL
   - Verify the API response includes `google_maps_markdown`
   - If the restaurant has a website, verify `website_markdown` is also present

3. **Check the logs**:
   ```
   [Crawler] Generating Google Maps markdown { sessionId: "..." }
   [Crawler] Google Maps markdown success { sessionId: "...", duration: "..." }
   [Crawler] Crawling website for markdown { url: "...", sessionId: "..." }
   [Crawler] Website markdown success { url: "...", duration: "..." }
   ```

4. **Generate the website**:
   - Verify the generated website uses content from the markdown

### Automated Tests

Run the test suite:

```bash
pnpm test
```

Add test cases for:
1. `generateGoogleMapsMarkdown()` success and error paths
2. `crawlWebsiteMarkdown()` success, timeout, and missing website
3. Parallel execution with `Promise.allSettled()`
4. `validateBusinessProfile()` with markdown fields

## Troubleshooting

### "Google Maps markdown failed" (404)

The `/crawl` endpoint must be called first with the same `session_id`. Ensure `extractBusinessData()` completes before calling `generateGoogleMapsMarkdown()`.

### "Website markdown failed" (timeout)

LLM Vision processing can take up to 120 seconds. If consistently timing out:
1. Check crawler API logs for Gemini errors
2. Verify `GOOGLE_GEMINI_API_KEY` is set in crawler environment
3. Consider increasing timeout if needed

### Markdown is undefined

Check if:
1. Crawler API is running and accessible
2. Network connectivity between website-agent and crawler
3. `session_id` is being passed correctly

## Next Steps

After implementing these changes:

1. Run `/speckit.tasks` to generate the task breakdown
2. Create a PR with the changes
3. Test with multiple restaurant types (with/without websites)
4. Monitor logs for errors and performance
