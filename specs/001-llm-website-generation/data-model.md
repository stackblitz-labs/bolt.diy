# Data Model: LLM Website Generation

**Feature**: 001-llm-website-generation  
**Created**: 2026-01-09

## Overview

This feature primarily uses existing data structures. The main entities are already defined in the codebase. This document maps them to the feature requirements.

## Existing Entities (No Changes Required)

### Project

**Location**: `app/types/project.ts`

```typescript
interface Project {
  id: string;
  user_id: string;
  tenant_id: string | null;
  name: string;
  description: string | null;
  status: ProjectStatus;  // 'draft' | 'published' | 'archived'
  url_id: string | null;
  business_profile?: BusinessProfile | null;  // ← Input for generation
  created_at: string;
  updated_at: string;
}
```

**Role in Feature**: Source of `business_profile` data for generation input.

---

### BusinessProfile

**Location**: `app/types/project.ts`

```typescript
interface BusinessProfile {
  session_id?: string;
  gmaps_url?: string;
  crawled_data?: BusinessData;
  generated_content?: GeneratedContent;
  crawled_at?: string;
}
```

**Role in Feature**: Primary input for both Phase 1 (template selection) and Phase 2 (content generation).

---

### BusinessData (from Crawler)

**Location**: `app/types/crawler.ts`

```typescript
interface BusinessData {
  name?: string;
  address?: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviews_count?: number;
  hours?: Record<string, string>;  // Day → hours string
  reviews?: Review[];
  menu?: Menu;
  photos?: Photo[];
}
```

**Role in Feature**: Raw business data used when `generated_content` is not available.

---

### GeneratedContent (AI-Enhanced)

**Location**: `app/types/crawler.ts`

```typescript
interface GeneratedContent {
  brandStrategy: BrandStrategy;
  visualAssets: VisualAssets;
  businessIdentity: BusinessIdentity;
  industryContext: IndustryContext;
  reputationData?: ReputationData;
  contentSections: ContentSections;
  extractedData?: ExtractedData;
}

interface BrandStrategy {
  usp: string;
  targetAudience: string;
  toneOfVoice: string;
  visualStyle: string;
}

interface VisualAssets {
  colorPalette: ColorPalette;
  typography: Typography;
  logo?: Logo;
}

interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string[];
  text: string[];
}
```

**Role in Feature**: Rich brand/content data that produces better website generation results.

---

### ProjectSnapshot

**Location**: `app/types/project.ts`

```typescript
interface ProjectSnapshot {
  id: string;
  project_id: string;
  files: FileMap;  // Generated website files
  summary: string | null;
  created_at: string;
  updated_at: string;
}

interface FileMap {
  [path: string]: {
    type: 'file' | 'folder';
    content?: string;
    isBinary?: boolean;
  };
}
```

**Role in Feature**: Storage for auto-saved generated website files.

---

### RestaurantTheme

**Location**: `app/types/restaurant-theme.ts`

```typescript
type RestaurantThemeId = 
  | 'artisanhearthv3' | 'bamboobistro' | 'boldfeastv2' 
  | 'chromaticstreet' | 'classicminimalistv2' | 'dynamicfusion'
  | 'freshmarket' | 'gastrobotanical' | 'indochineluxe'
  | 'noirluxev3' | 'saigonveranda' | 'therednoodle';

interface RestaurantTheme {
  id: RestaurantThemeId;
  label: string;
  description: string;
  cuisines: string[];
  styleTags: string[];
  templateName: string;
  prompt: string;  // Theme-specific design guidelines
}
```

**Role in Feature**: Output of Phase 1 template selection; input for Phase 2 prompt composition.

---

## New Types (Feature-Specific)

### GenerationProgress

**Purpose**: Track and report generation status via SSE.

```typescript
interface GenerationProgress {
  phase: 'template_selection' | 'content_generation' | 'file_injection' | 'snapshot_save';
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  message: string;
  percentage: number;
  startedAt: number;  // Unix timestamp
  templateName?: string;  // Set after Phase 1 completes
  error?: string;
}

// Example progression:
// 1. { phase: 'template_selection', status: 'in_progress', message: 'Analyzing business details', percentage: 10 }
// 2. { phase: 'template_selection', status: 'completed', message: 'Template selected: Bamboo Bistro', percentage: 20, templateName: 'Bamboo Bistro' }
// 3. { phase: 'content_generation', status: 'in_progress', message: 'Generating layout & copy', percentage: 30 }
// 4. { phase: 'content_generation', status: 'in_progress', message: 'Taking longer than usual...', percentage: 50 }
// 5. { phase: 'file_injection', status: 'in_progress', message: 'Injecting files (15/42)', percentage: 70 }
// 6. { phase: 'snapshot_save', status: 'in_progress', message: 'Saving project', percentage: 90 }
// 7. { phase: 'snapshot_save', status: 'completed', message: 'Website ready!', percentage: 100 }
```

---

### GenerationRequest

**Purpose**: Input to generation API endpoint.

```typescript
interface GenerationRequest {
  projectId: string;
}
// Note: userId, model, provider extracted from session/cookies
```

---

### GenerationResult

**Purpose**: Final output after successful generation.

```typescript
interface GenerationResult {
  success: boolean;
  projectId: string;
  template: {
    name: string;
    themeId: RestaurantThemeId;
    title: string;
    reasoning?: string;
  };
  files: GeneratedFile[];
  snapshot: {
    savedAt: string;
    fileCount: number;
    sizeMB: number;
  };
  timing: {
    phase1Ms: number;
    phase2Ms: number;
    totalMs: number;
  };
  error?: string;
}

interface GeneratedFile {
  path: string;
  content: string;
  size: number;
}
```

---

### SSEEvent

**Purpose**: Type-safe SSE event union for generation stream.

```typescript
type GenerationSSEEvent = 
  | { event: 'progress'; data: GenerationProgress }
  | { event: 'template_selected'; data: { name: string; themeId: RestaurantThemeId; reasoning: string } }
  | { event: 'file'; data: GeneratedFile }
  | { event: 'complete'; data: GenerationResult }
  | { event: 'error'; data: { message: string; code: string; retryable: boolean } }
  | { event: 'heartbeat'; data: { timestamp: number } };
```

---

### FastModelConfig

**Purpose**: Map providers to their fast/cheap models for Phase 1.

```typescript
interface FastModelConfig {
  [providerName: string]: {
    model: string;
    contextWindow: number;
    costPer1MTokens: number;  // USD
  };
}

const FAST_MODEL_CONFIG: FastModelConfig = {
  'OpenAI': { model: 'gpt-4o-mini', contextWindow: 128000, costPer1MTokens: 0.15 },
  'Anthropic': { model: 'claude-3-haiku-20240307', contextWindow: 200000, costPer1MTokens: 0.25 },
  'Google': { model: 'gemini-1.5-flash', contextWindow: 1000000, costPer1MTokens: 0.075 },
  'Groq': { model: 'llama-3.1-8b-instant', contextWindow: 128000, costPer1MTokens: 0 },
  'OpenRouter': { model: 'openai/gpt-4o-mini', contextWindow: 128000, costPer1MTokens: 0.15 },
};
```

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         INPUT                                        │
├─────────────────────────────────────────────────────────────────────┤
│ Project.business_profile                                             │
│   ├── crawled_data: BusinessData                                    │
│   │     ├── name, address, phone                                    │
│   │     ├── hours, rating, reviews_count                           │
│   │     └── menu, photos, reviews                                  │
│   │                                                                  │
│   └── generated_content: GeneratedContent (preferred if available)  │
│         ├── brandStrategy: { usp, targetAudience, toneOfVoice }   │
│         ├── visualAssets: { colorPalette, typography }            │
│         └── contentSections: { hero, about, products }            │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│              PHASE 1: TEMPLATE SELECTION (Sequential Step 1)         │
├─────────────────────────────────────────────────────────────────────┤
│ Input:                                                               │
│   └── BusinessProfile (name, cuisine, category, style)              │
│                                                                      │
│ LLM Call: Fast model (gpt-4o-mini) ~3 seconds                       │
│   └── Reads template list from Registry (12 options)                │
│                                                                      │
│ Output: RestaurantThemeId (e.g., "bamboobistro")                    │
│                                                                      │
│ Fallback: "classicminimalistv2" if LLM fails                        │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ (waits for Phase 1 to complete)
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│              PHASE 2: CONTENT GENERATION (Sequential Step 2)         │
├─────────────────────────────────────────────────────────────────────┤
│ Input:                                                               │
│   ├── BusinessProfile (full data)                                   │
│   ├── Base Bolt System Prompt                                       │
│   └── Theme Prompt (loaded from Registry using Phase 1 output)      │
│                                                                      │
│ LLM Call: User's model (e.g., GPT-4o) ~30-60 seconds                │
│   └── Streams generated code via SSE                                │
│                                                                      │
│ Output: GeneratedFile[] (streamed one file at a time)               │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         OUTPUT                                       │
├─────────────────────────────────────────────────────────────────────┤
│ 1. WebContainer: Files injected via ActionRunner                    │
│ 2. Editor: Files appear in file tree via editorStore                │
│ 3. Database: ProjectSnapshot saved to project_snapshots             │
│ 4. UI: GenerationResult returned for success state                  │
└─────────────────────────────────────────────────────────────────────┘
```

### Why Sequential (Not Parallel)?

Phase 2 **depends on Phase 1's output**:
- Phase 1 selects the template → outputs `themeId`
- Phase 2 needs `themeId` to load the correct theme prompt from Registry
- Without knowing which template, Phase 2 cannot compose the correct prompt

## Validation Rules

### BusinessProfile Validation (Pre-generation)

```typescript
function validateBusinessProfile(profile: BusinessProfile | null | undefined): ValidationResult {
  const errors: string[] = [];
  
  if (!profile) {
    return { valid: false, errors: ['No business profile data'] };
  }
  
  const data = profile.generated_content?.businessIdentity || profile.crawled_data;
  
  if (!data) {
    return { valid: false, errors: ['No crawled or generated data'] };
  }
  
  // Required: Business name (minimum)
  const name = profile.generated_content?.businessIdentity?.displayName || profile.crawled_data?.name;
  if (!name?.trim()) {
    errors.push('Business name is required');
  }
  
  // Recommended (warnings, not blocking)
  const warnings: string[] = [];
  if (!profile.crawled_data?.address) warnings.push('Address not provided');
  if (!profile.crawled_data?.phone) warnings.push('Phone not provided');
  
  return { 
    valid: errors.length === 0, 
    errors, 
    warnings,
    canProceedWithDefaults: errors.length === 0 // Can generate even with warnings
  };
}
```

### Generated File Validation

```typescript
function validateGeneratedFile(file: GeneratedFile): boolean {
  // Path must be relative, no .. traversal
  if (file.path.includes('..') || file.path.startsWith('/')) {
    return false;
  }
  
  // Content must be string
  if (typeof file.content !== 'string') {
    return false;
  }
  
  // Reasonable size limit (10MB per file)
  if (file.content.length > 10 * 1024 * 1024) {
    return false;
  }
  
  return true;
}
```

## State Transitions

### Generation State Machine

```
                    ┌───────────────────┐
                    │      IDLE         │
                    │ (before confirm)  │
                    └─────────┬─────────┘
                              │ User confirms
                              ▼
                    ┌───────────────────┐
                    │  SELECTING        │
                    │  (Phase 1)        │
                    └─────────┬─────────┘
                              │
              ┌───────────────┼───────────────┐
              │ Success       │               │ Failure
              ▼               │               ▼
    ┌─────────────────┐       │     ┌─────────────────┐
    │   GENERATING    │       │     │   FALLBACK      │
    │   (Phase 2)     │       │     │   TEMPLATE      │
    └────────┬────────┘       │     └────────┬────────┘
             │                │              │
             └────────────────┴──────────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │    INJECTING      │
                    │    (files)        │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │    SAVING         │
                    │    (snapshot)     │
                    └─────────┬─────────┘
                              │
              ┌───────────────┴───────────────┐
              │ Success                       │ Failure (non-blocking)
              ▼                               ▼
    ┌─────────────────┐             ┌─────────────────┐
    │    COMPLETE     │             │    COMPLETE     │
    │   (all saved)   │             │   (no snapshot) │
    └─────────────────┘             └─────────────────┘
```
