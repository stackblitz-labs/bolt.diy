# Data Model: Crawler API Integration

**Feature**: 001-crawler-api-integration  
**Date**: 2026-01-04

## Entity Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Project Creation Flow                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐      ┌──────────────┐      ┌───────────────────┐  │
│  │ CrawlSession │──1:1─│   Project    │──1:1─│ GeneratedContent  │  │
│  └──────────────┘      └──────────────┘      └───────────────────┘  │
│         │                     │                       │              │
│         ▼                     │                       │              │
│  ┌──────────────┐             │              ┌───────────────────┐  │
│  │ BusinessData │─────────────┘              │  ContentSections  │  │
│  └──────────────┘                            └───────────────────┘  │
│         │                                                            │
│         ▼                                                            │
│  ┌──────────────┐                                                   │
│  │WebsiteContent│ (optional)                                        │
│  └──────────────┘                                                   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## CrawlSession

Represents the crawl operation state for a single project creation flow.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| session_id | string (UUID) | Yes | Unique identifier for the crawl session |
| google_maps_url | string | Yes | The Google Maps URL submitted by user |
| status | enum | Yes | Current state of the crawl operation |
| created_at | timestamp | Yes | When the session was initiated |
| completed_at | timestamp | No | When crawling completed |
| error | string | No | Error message if crawl failed |

### Status Enum

```typescript
type CrawlSessionStatus = 
  | 'pending'      // Session created, crawl not started
  | 'crawling'     // Currently fetching data
  | 'completed'    // Successfully extracted data
  | 'failed'       // Crawl failed with error
  | 'timeout';     // Crawl exceeded 60s timeout
```

### Notes
- Session ID is generated once per project creation flow
- Same session ID used for all crawler API calls
- Stored in component state during creation; optionally persisted to project record

---

## BusinessData

Extracted business information from Google Maps and optional website crawl.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | No | Business name |
| address | string | No | Full address |
| phone | string | No | Contact phone number |
| website | string | No | Business website URL |
| rating | number | No | Google Maps rating (1-5) |
| reviews_count | number | No | Total review count |
| hours | Record<string, string> | No | Operating hours by day |
| reviews | Review[] | No | Sample reviews |
| menu | Menu | No | Menu structure (restaurants) |
| photos | Photo[] | No | Business photos |

### Review

| Field | Type | Required |
|-------|------|----------|
| author | string | Yes |
| rating | number | Yes |
| text | string | Yes |
| date | string | Yes |

### Menu

| Field | Type | Required |
|-------|------|----------|
| categories | MenuCategory[] | Yes |

### MenuCategory

| Field | Type | Required |
|-------|------|----------|
| name | string | Yes |
| items | MenuItem[] | Yes |

### MenuItem

| Field | Type | Required |
|-------|------|----------|
| name | string | Yes |
| price | string | No |
| description | string | No |

### Photo

| Field | Type | Required |
|-------|------|----------|
| url | string | Yes |
| type | string | No |

---

## WebsiteContent

Content extracted from crawling the business website (if available).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| url | string | Yes | Crawled website URL |
| pages | number | Yes | Number of pages crawled |
| crawledPages | CrawledPage[] | Yes | Detailed page content |
| allImages | string[] | No | All discovered image URLs |
| paragraphs | string[] | No | Text paragraphs |
| styling | StylingInfo | No | Extracted styling |
| instagramPosts | InstagramPost[] | No | Embedded Instagram content |
| businessInfo | BusinessInfo | No | Meta information |

### CrawledPage

| Field | Type | Required |
|-------|------|----------|
| url | string | Yes |
| pageNumber | number | Yes |
| headings | Record<string, string[]> | No |
| sections | PageSection[] | No |

### PageSection

| Field | Type | Required |
|-------|------|----------|
| type | SectionType | Yes |
| heading | string | No |
| content | string | No |
| images | SectionImage[] | No |
| keywords | string[] | No |

### SectionType

```typescript
type SectionType = 
  | 'hero'
  | 'about'
  | 'services'
  | 'products'
  | 'testimonials'
  | 'contact'
  | 'gallery'
  | 'team'
  | 'other';
```

### StylingInfo

| Field | Type | Required |
|-------|------|----------|
| fonts | string[] | No |
| backgroundColors | string[] | No |
| textColors | string[] | No |

---

## GeneratedContent

AI-generated website content from `/generate-website-content` endpoint.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| session_id | string | Yes | Matching session ID |
| brandStrategy | BrandStrategy | Yes | AI-generated brand strategy |
| visualAssets | VisualAssets | Yes | Color, typography, logo |
| businessIdentity | BusinessIdentity | Yes | Name, tagline, description |
| industryContext | IndustryContext | Yes | Categories, pricing tier |
| reputationData | ReputationData | No | Reviews, ratings |
| contentSections | ContentSections | Yes | Ready-to-use content |
| extractedData | ExtractedData | No | Source data summary |

### BrandStrategy

| Field | Type | Required |
|-------|------|----------|
| usp | string | Yes |
| targetAudience | string | Yes |
| toneOfVoice | string | Yes |
| visualStyle | string | Yes |

### VisualAssets

| Field | Type | Required |
|-------|------|----------|
| colorPalette | ColorPalette | Yes |
| typography | Typography | Yes |
| logo | Logo | No |

### ColorPalette

| Field | Type |
|-------|------|
| primary | string |
| secondary | string |
| accent | string |
| background | string[] |
| text | string[] |

### Typography

| Field | Type |
|-------|------|
| headingFont | string |
| bodyFont | string |
| allFonts | string[] |

### BusinessIdentity

| Field | Type | Required |
|-------|------|----------|
| legalName | string | No |
| displayName | string | Yes |
| tagline | string | Yes |
| description | string | Yes |

### IndustryContext

| Field | Type | Required |
|-------|------|----------|
| categories | string[] | Yes |
| pricingTier | string | No |
| operationalHighlights | string[] | No |

### ContentSections

| Field | Type | Required |
|-------|------|----------|
| hero | HeroSection | No |
| about | AboutSection | No |
| products | ProductsSection | No |
| [key: string] | GenericSection | No |

---

## TypeScript Definitions

### Location
`app/types/crawler.ts` (new file)

```typescript
// Crawler API Types
// Generated from specs/001-crawler-api-integration/data-model.md

export type CrawlSessionStatus = 
  | 'pending'
  | 'crawling'
  | 'completed'
  | 'failed'
  | 'timeout';

export interface CrawlSession {
  session_id: string;
  google_maps_url: string;
  status: CrawlSessionStatus;
  created_at: string;
  completed_at?: string;
  error?: string;
}

export interface CrawlRequest {
  session_id: string;
  google_maps_url: string;
}

export interface CrawlResponse {
  success: boolean;
  data?: BusinessData;
  error?: string;
}

export interface BusinessData {
  name?: string;
  address?: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviews_count?: number;
  hours?: Record<string, string>;
  reviews?: Review[];
  menu?: Menu;
  photos?: Photo[];
}

export interface Review {
  author: string;
  rating: number;
  text: string;
  date: string;
}

export interface Menu {
  categories: MenuCategory[];
}

export interface MenuCategory {
  name: string;
  items: MenuItem[];
}

export interface MenuItem {
  name: string;
  price?: string;
  description?: string;
}

export interface Photo {
  url: string;
  type?: string;
}

export interface GenerateContentRequest {
  session_id: string;
}

export interface GenerateContentResponse {
  success: boolean;
  session_id: string;
  data?: GeneratedContent;
  error?: string;
}

export interface GeneratedContent {
  brandStrategy: BrandStrategy;
  visualAssets: VisualAssets;
  businessIdentity: BusinessIdentity;
  industryContext: IndustryContext;
  reputationData?: ReputationData;
  contentSections: ContentSections;
  extractedData?: ExtractedData;
}

export interface BrandStrategy {
  usp: string;
  targetAudience: string;
  toneOfVoice: string;
  visualStyle: string;
}

export interface VisualAssets {
  colorPalette: ColorPalette;
  typography: Typography;
  logo?: Logo;
}

export interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string[];
  text: string[];
}

export interface Typography {
  headingFont: string;
  bodyFont: string;
  allFonts?: string[];
}

export interface Logo {
  url: string;
  source: string;
  description?: string;
}

export interface BusinessIdentity {
  legalName?: string;
  displayName: string;
  tagline: string;
  description: string;
}

export interface IndustryContext {
  categories: string[];
  pricingTier?: string;
  operationalHighlights?: string[];
}

export interface ReputationData {
  reviewsCount: number;
  averageRating: number;
  trustBadges?: string[];
}

export interface ContentSections {
  hero?: HeroSection;
  about?: AboutSection;
  products?: ProductsSection;
  [key: string]: GenericSection | undefined;
}

export interface HeroSection {
  heading: string;
  subheading?: string;
  images?: string[];
}

export interface AboutSection {
  heading: string;
  content: string;
  images?: string[];
}

export interface ProductsSection {
  heading: string;
  items: ProductItem[];
}

export interface ProductItem {
  name: string;
  description?: string;
  image?: string;
}

export interface GenericSection {
  heading?: string;
  content?: string;
  images?: string[];
}

export interface ExtractedData {
  allImages?: string[];
  instagramPosts?: unknown[];
  websiteUrl?: string;
  pagesAnalyzed?: number;
}
```

---

## Database Extensions

### Project Table Extension

The existing `projects` table already supports `business_profile` JSONB column. The generated content will be stored here.

```sql
-- No schema changes required
-- business_profile column stores GeneratedContent JSON
```

### Storage Pattern

```typescript
// When saving project after AI generation:
const projectUpdate = {
  business_profile: {
    gmaps_url: session.google_maps_url,
    session_id: session.session_id,
    crawled_data: businessData,
    generated_content: generatedContent,
    crawled_at: new Date().toISOString()
  }
};
```

