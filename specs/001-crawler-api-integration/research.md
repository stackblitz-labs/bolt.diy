# Research: Crawler API Integration

**Feature**: 001-crawler-api-integration  
**Date**: 2026-01-04

## HuskIT/Crawler API Analysis

### Overview

The HuskIT/crawler is a Python-based API service that provides:
1. Google Maps business data extraction (`POST /crawl`)
2. Website content crawling (`POST /crawl-website`)
3. AI-powered website content generation (`POST /generate-website-content`)

All endpoints use session-based caching via MongoDB for persistence.

---

## Endpoint 1: POST /crawl (Google Maps Extraction)

### Decision
Use this endpoint to extract business information from Google Maps URLs during project creation.

### Request Format

```json
{
  "session_id": "unique-session-456",
  "google_maps_url": "https://www.google.com/maps/place/..."
}
```

### Response Format (Success)

```json
{
  "success": true,
  "data": {
    "name": "Business Name",
    "address": "123 Main St, City, Country",
    "phone": "+1234567890",
    "website": "https://example.com",
    "rating": 4.5,
    "reviews_count": 250,
    "hours": {
      "Monday": "10:00 AM - 10:00 PM",
      "Tuesday": "10:00 AM - 10:00 PM"
    },
    "reviews": [
      {
        "author": "John Doe",
        "rating": 5,
        "text": "Great food!",
        "date": "2025-01-15"
      }
    ],
    "menu": {
      "categories": [
        {
          "name": "Appetizers",
          "items": [
            {
              "name": "Spring Rolls",
              "price": "$8.99",
              "description": "Fresh vegetables wrapped in rice paper"
            }
          ]
        }
      ]
    },
    "photos": [
      {
        "url": "https://...",
        "type": "food"
      }
    ]
  }
}
```

### Response Format (Error)

```json
{
  "success": false,
  "error": "Invalid Google Maps URL: https://example.com"
}
```

### Caching Behavior
- Same `session_id` returns cached result (no re-crawl)
- This aligns with 1:1 session/project relationship requirement

---

## Endpoint 2: POST /crawl-website (Website Content Extraction)

### Decision
Use this endpoint to crawl the business website URL extracted from Google Maps data.

### Request Format

```json
{
  "url": "https://example.com",
  "max_pages": 5,
  "extract_instagram_metadata": "all"
}
```

### Response Format (Success)

```json
{
  "success": true,
  "data": {
    "url": "https://example.com",
    "pages": 3,
    "crawledPages": [
      {
        "url": "https://example.com/",
        "pageNumber": 1,
        "headings": {
          "h1": ["Main Title"],
          "h2": ["Section 1", "Section 2"]
        },
        "sections": [
          {
            "type": "hero",
            "heading": "Welcome to Our Restaurant",
            "content": "Experience the finest dining...",
            "images": [
              {
                "url": "https://example.com/hero.jpg",
                "description": "Hero banner image",
                "width": 1920,
                "height": 1080
              }
            ]
          }
        ]
      }
    ],
    "allImages": ["https://example.com/image1.jpg"],
    "paragraphs": ["First paragraph of content..."],
    "styling": {
      "fonts": ["Roboto", "Open Sans"],
      "backgroundColors": ["#ffffff", "#f5f5f5"],
      "textColors": ["#000000", "#333333"]
    },
    "instagramPosts": [],
    "businessInfo": {
      "title": "Restaurant Name",
      "description": "Meta description...",
      "logo": {
        "url": "https://example.com/favicon.ico",
        "source": "favicon"
      }
    }
  }
}
```

### Section Types
- `hero`, `about`, `services`, `products`, `testimonials`, `contact`, `gallery`, `team`, `other`

---

## Endpoint 3: POST /generate-website-content (AI Content Generation)

### Decision
Use this endpoint as the final step to generate AI-powered website content.

### Request Format

```json
{
  "session_id": "unique-session-123"
}
```

### Response Format (Success)

```json
{
  "success": true,
  "session_id": "unique-session-123",
  "data": {
    "brandStrategy": {
      "usp": "Authentic Asian-European fusion cuisine",
      "targetAudience": "Food enthusiasts aged 25-45",
      "toneOfVoice": "Warm, sophisticated, inviting",
      "visualStyle": "Modern, natural, elegant"
    },
    "visualAssets": {
      "colorPalette": {
        "primary": "#2C5F2D",
        "secondary": "#F5E6D3",
        "accent": "#D4AF37",
        "background": ["#FFFFFF", "#F5F5F5"],
        "text": ["#000000", "#333333"]
      },
      "typography": {
        "headingFont": "Roboto",
        "bodyFont": "Open Sans"
      },
      "logo": {
        "url": "https://example.com/logo.png",
        "source": "extracted"
      }
    },
    "businessIdentity": {
      "legalName": "Business Ltd.",
      "displayName": "Business Name",
      "tagline": "Generated tagline",
      "description": "Generated description..."
    },
    "industryContext": {
      "categories": ["Restaurant", "Bistro"],
      "pricingTier": "mid-range",
      "operationalHighlights": ["Reservation recommended"]
    },
    "reputationData": {
      "reviewsCount": 245,
      "averageRating": 4.7,
      "trustBadges": ["Google Verified"]
    },
    "contentSections": {
      "hero": {
        "heading": "Welcome",
        "subheading": "Experience our restaurant",
        "images": ["https://..."]
      },
      "about": {
        "heading": "Our Story",
        "content": "Founded in 2018...",
        "images": ["https://..."]
      },
      "products": {
        "heading": "Our Menu",
        "items": [...]
      }
    },
    "extractedData": {
      "allImages": ["url1", "url2"],
      "instagramPosts": [],
      "websiteUrl": "https://example.com",
      "pagesAnalyzed": 3
    }
  }
}
```

### Caching Mechanism
- Cached content returned for same `session_id`
- Saves AI API costs on retry

---

## Integration Architecture Decision

### Rationale
The crawler API provides a complete extraction-to-generation pipeline. We integrate at two points:

1. **After Google Maps URL submission** → Call `/crawl` to extract business data
2. **After user confirms** → Call `/generate-website-content` to get AI content

Website crawling (`/crawl-website`) happens automatically within the crawler service when it processes the Google Maps URL that includes a website.

### Alternatives Considered

| Alternative | Rejected Because |
|------------|------------------|
| Direct SerpAPI integration | Crawler already handles this; avoid duplication |
| Client-side API calls | Security concerns; API should be server-proxied |
| Async polling | Synchronous response confirmed; simpler implementation |

---

## Error Handling Strategy

### Decision
Implement graceful degradation with user notification.

### Error Categories

| Error Type | User Experience | Technical Handling |
|-----------|-----------------|-------------------|
| Invalid URL | Show validation error | 400 status, prevent submission |
| Crawl timeout | Show retry option | 60s timeout, fallback to manual |
| API unavailable | Show retry + manual option | Catch network errors |
| Partial data | Show available data | Proceed with whatever returned |

---

## Environment Configuration

### Decision
Use environment variable for API base URL.

```
CRAWLER_API_URL=http://localhost:4999
```

### Rationale
- Allows different URLs for dev/staging/prod
- Easy to configure without code changes
- Follows existing project patterns for external services

---

## Session ID Generation

### Decision
Generate UUID v4 client-side at project creation start.

### Rationale
- Simple, unique, and collision-free
- Matches crawler API expectations
- Can be stored with project for future reference

