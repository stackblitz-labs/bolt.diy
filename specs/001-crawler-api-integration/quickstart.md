# Quickstart: Crawler API Integration

**Feature**: 001-crawler-api-integration  
**Date**: 2026-01-04

## Prerequisites

1. **Crawler API Running**
   ```bash
   # Ensure HuskIT/crawler is running on port 4999
   curl http://localhost:4999/health
   ```

2. **Environment Variable** (optional, defaults to localhost:4999)
   ```bash
   # .env.local
   CRAWLER_API_URL=http://localhost:4999
   ```

---

## Quick Test

### 1. Test Google Maps Extraction

```bash
curl -X POST http://localhost:4999/crawl \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "test-session-001",
    "google_maps_url": "https://www.google.com/maps/place/Cham+Bistro/@10.7297489,106.7183338,17z"
  }'
```

Expected: JSON with `success: true` and business data.

### 2. Test AI Content Generation

```bash
curl -X POST http://localhost:4999/generate-website-content \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "test-session-001"
  }'
```

Expected: JSON with generated content including brand strategy, visual assets, etc.

---

## Implementation Overview

### Files to Create

| File | Purpose |
|------|---------|
| `app/types/crawler.ts` | TypeScript interfaces for crawler API |
| `app/lib/services/crawlerClient.server.ts` | HTTP client for crawler API |
| `app/routes/api.crawler.extract.ts` | Proxy route for /crawl |
| `app/routes/api.crawler.generate.ts` | Proxy route for /generate-website-content |

### Files to Modify

| File | Changes |
|------|---------|
| `app/components/projects/CreateProjectDialog.tsx` | Add crawl step, data confirmation UI |
| `app/lib/persistence/useProjects.ts` | Add crawler integration hooks |
| `app/types/project.ts` | Extend with crawler data fields |
| `.env.example` | Add CRAWLER_API_URL |

---

## Integration Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Create Project Dialog Flow                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Step 1: Details          Step 2: Maps           Step 3: Crawling   │
│  ┌──────────────┐        ┌──────────────┐       ┌──────────────┐    │
│  │ Business Name│   →    │ Google Maps  │   →   │ Extracting   │    │
│  │ Address      │        │ URL Input    │       │ Data...      │    │
│  └──────────────┘        └──────────────┘       └──────────────┘    │
│                                                        │             │
│                                                        ▼             │
│  Step 6: Building        Step 5: Confirm         Step 4: Review     │
│  ┌──────────────┐        ┌──────────────┐       ┌──────────────┐    │
│  │ Generating   │   ←    │ Confirm      │   ←   │ Review Data  │    │
│  │ Website...   │        │ Business     │       │ Edit if Needed│   │
│  └──────────────┘        └──────────────┘       └──────────────┘    │
│         │                                                            │
│         ▼                                                            │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Call /generate-website-content → Save to Project             │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## New Step States

Update the `Step` type in `CreateProjectDialog.tsx`:

```typescript
type Step = 
  | 'details'      // Business name + address
  | 'maps'         // Google Maps URL input
  | 'crawling'     // NEW: Extracting data from crawler
  | 'review'       // NEW: Review/edit extracted data
  | 'confirm'      // Confirm business info
  | 'mapsError'    // Error state for maps
  | 'building';    // AI content generation
```

---

## Crawler Client Service

### Location
`app/lib/services/crawlerClient.server.ts`

### Key Functions

```typescript
// Environment config
const CRAWLER_API_URL = process.env.CRAWLER_API_URL || 'http://localhost:4999';
const CRAWLER_TIMEOUT = 60_000; // 60 seconds

// Extract business data
export async function extractBusinessData(
  sessionId: string,
  googleMapsUrl: string
): Promise<CrawlResponse>

// Generate AI content
export async function generateWebsiteContent(
  sessionId: string
): Promise<GenerateContentResponse>
```

---

## Session ID Generation

Generate UUID at start of project creation flow:

```typescript
// In CreateProjectDialog component
const [sessionId] = useState(() => crypto.randomUUID());
```

This session ID is:
1. Used for all crawler API calls
2. Stored with the project record
3. Enables caching on the crawler side

---

## Error Handling

### Timeout Handling

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), CRAWLER_TIMEOUT);

try {
  const response = await fetch(url, { signal: controller.signal });
  // ...
} catch (error) {
  if (error.name === 'AbortError') {
    return { success: false, error: 'Request timed out after 60 seconds' };
  }
  throw error;
} finally {
  clearTimeout(timeoutId);
}
```

### Fallback Flow

If crawler fails:
1. Show error with retry option
2. Offer "Continue with manual entry" button
3. Proceed with user-provided business name/address only

---

## Data Storage

After successful AI generation, save to project:

```typescript
// In projects.server.ts createProject function
const businessProfile = {
  session_id: sessionId,
  gmaps_url: googleMapsUrl,
  crawled_data: crawlResponse.data,
  generated_content: generateResponse.data,
  crawled_at: new Date().toISOString()
};

// Store in project's business_profile JSONB column
await supabase
  .from('projects')
  .update({ business_profile: businessProfile })
  .eq('id', projectId);
```

---

## Testing Checklist

- [ ] Crawler API accessible at configured URL
- [ ] Valid Google Maps URL extracts business data
- [ ] Invalid URL shows appropriate error
- [ ] Timeout after 60 seconds handled gracefully
- [ ] API failure allows manual entry fallback
- [ ] Session ID persists across all steps
- [ ] AI content generation uses same session ID
- [ ] Generated content saved to project
- [ ] UI shows loading states during API calls
- [ ] User can edit extracted data before confirm

---

## Development Commands

```bash
# Start website-agent dev server
pnpm run dev

# Ensure crawler is running (separate terminal)
cd /path/to/HuskIT/crawler
python app.py  # or your start command

# Test the flow
# 1. Open http://localhost:5173
# 2. Click "New Project"
# 3. Enter business details
# 4. Paste a Google Maps URL
# 5. Verify data extraction
# 6. Confirm and wait for AI generation
```

