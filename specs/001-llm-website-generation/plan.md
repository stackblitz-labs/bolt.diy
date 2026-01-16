# Implementation Plan: LLM Website Generation

**Feature Branch**: `001-llm-website-generation`  
**Spec**: [spec.md](./spec.md)  
**Created**: 2026-01-09

## Technical Context

| Aspect | Details |
|--------|---------|
| Runtime | Remix 2.15 + Vite, Cloudflare Pages (30s edge timeout) |
| LLM Integration | Vercel AI SDK (`ai`), `/api/llmcall` for simple calls, `/api/chat` for streaming |
| State Management | Nanostores (reactive), Zustand (complex), IndexedDB (persistence) |
| Database | Supabase/PostgreSQL (projects, snapshots, messages) |
| Existing Services | `websiteGenerationService.ts`, `selectStarterTemplate.ts`, `contentTransformer.ts` |
| Theme System | 12 restaurant themes in `app/theme-prompts/`, `getThemePrompt()` registry |

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CreateProjectDialog                               │
│  (Building your website step)                                        │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    POST /api/project/generate                        │
│  New API endpoint for website generation                             │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PHASE 1: Template Selection (Fast LLM, ~3s)                        │
│  ┌─────────────────────┐      ┌─────────────────────────────────┐   │
│  │   Business Profile  │ ───▶ │  LLM picks best template from   │   │
│  │   (input)           │      │  12 restaurant themes           │   │
│  └─────────────────────┘      └──────────────┬──────────────────┘   │
│                                              │                       │
│                          Output: "Bamboo Bistro" selected            │
└──────────────────────────────────────────────┬──────────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PHASE 2: Content Generation (User's LLM, ~30-60s)                  │
│  ┌─────────────────────┐      ┌─────────────────────────────────┐   │
│  │ Business Profile +  │ ───▶ │  LLM generates website code     │   │
│  │ Theme Design Prompt │      │  with actual business data      │   │
│  │ (from Phase 1)      │      │  (streamed via SSE)             │   │
│  └─────────────────────┘      └──────────────┬──────────────────┘   │
│                                              │                       │
│                          Output: Generated files (App.tsx, etc.)     │
└──────────────────────────────────────────────┬──────────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    WebContainer Injection                            │
│  Files streamed via SSE → ActionRunner → WebContainer FS             │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Auto-Save Snapshot                                │
│  saveSnapshot() → project_snapshots table                            │
└─────────────────────────────────────────────────────────────────────┘
```

### Sequence Flow (Phase 1 → Phase 2)

```
1. Phase 1: Template Selection
   ├── Input: BusinessProfile { name, cuisine, category, style }
   ├── LLM: Fast model (gpt-4o-mini) analyzes profile
   ├── Registry: Reads list of 12 templates to choose from
   └── Output: Selected template ID (e.g., "bamboobistro")
                    │
                    │ (sequential - Phase 2 waits for Phase 1)
                    ▼
2. Phase 2: Content Generation
   ├── Input: BusinessProfile + Selected Theme's Design Prompt
   ├── Registry: Reads theme prompt for "bamboobistro"
   ├── LLM: User's model generates website code
   └── Output: Stream of generated files
```

## Phase 0: Research Findings

### Decision 1: Two-Phase Generation Architecture

**Decision**: Use two separate LLM calls - fast model for template selection, user's configured model for content generation.

**Rationale**:
- Template selection is a simpler task (analyze business profile → pick from 12 options)
- Content generation requires creative writing and code generation (more complex)
- Using a fast/cheap model for Phase 1 reduces cost and latency
- Existing `selectTemplateFromCrawlerData()` already implements this pattern

**Alternatives Considered**:
- Single LLM call (rejected: inefficient, longer latency, higher cost)
- Deterministic template selection (rejected: loses intelligent matching capability)

### Decision 2: API Design for Generation

**Decision**: Create new `/api/project/generate` endpoint with SSE streaming.

**Rationale**:
- Existing `/api/chat` is for conversational mode, not suited for direct generation
- SSE allows real-time progress updates during generation
- Separate endpoint keeps concerns isolated (project creation vs chat)

**Alternatives Considered**:
- Reuse `/api/chat` (rejected: too coupled to conversation flow)
- WebSocket (rejected: overkill for one-way streaming)

### Decision 3: Business Profile Data Source

**Decision**: Use `project.business_profile` containing `crawled_data` from Google Maps crawler.

**Rationale**:
- Crawler API integration already stores business data in `projects.business_profile`
- Contains structured data: name, address, phone, hours, rating, reviews, menu
- `CrawlerOutput` type already defined for LLM consumption

**Alternatives Considered**:
- Fetch live from crawler API (rejected: unnecessary latency, data already cached)
- Manual input only (rejected: loses rich data from Google Maps)

### Decision 4: Fast Model Selection for Phase 1

**Decision**: Use `gpt-4o-mini` (OpenAI) or `claude-3-haiku` (Anthropic) based on user's configured provider.

**Rationale**:
- These models are 10-20x cheaper than full models
- Fast response times (1-3 seconds)
- Sufficient capability for template matching task

**Implementation**:
```typescript
const FAST_MODELS = {
  'OpenAI': 'gpt-4o-mini',
  'Anthropic': 'claude-3-haiku-20240307',
  'Google': 'gemini-1.5-flash',
  // Fallback to user's model if provider not in list
};
```

## Phase 1: Data Model

### Entities

#### GenerationRequest
```typescript
interface GenerationRequest {
  projectId: string;
  userId: string;
  businessProfile: BusinessProfile;
  model?: string;  // User's preferred model (Phase 2)
  provider?: ProviderInfo;
}
```

#### GenerationProgress
```typescript
interface GenerationProgress {
  phase: 'template_selection' | 'content_generation' | 'file_injection' | 'snapshot_save';
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  message: string;
  percentage: number;
  startedAt: number;  // timestamp
  templateName?: string;  // Set after Phase 1
  error?: string;
}
```

#### GenerationResult (existing - extended)
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
  files: Array<{ path: string; content: string }>;
  snapshot?: {
    savedAt: string;
    fileCount: number;
  };
  error?: string;
}
```

### Database Changes

No schema changes required. Uses existing:
- `projects.business_profile` (JSONB) - Input data
- `project_snapshots` (existing table) - Auto-saved output

## Phase 1: API Contracts

### POST /api/project/generate

**Purpose**: Trigger website generation for a project with SSE progress streaming.

**Request**:
```typescript
interface GenerateRequest {
  projectId: string;
  // Model/provider from cookies (same as /api/chat)
}
```

**Response**: Server-Sent Events stream

```typescript
// Progress events
type SSEEvent = 
  | { event: 'progress'; data: GenerationProgress }
  | { event: 'template_selected'; data: { name: string; themeId: string; reasoning: string } }
  | { event: 'file'; data: { path: string; content: string } }  // Streamed per file
  | { event: 'complete'; data: GenerationResult }
  | { event: 'error'; data: { message: string; code: string; retryable: boolean } };
```

**Error Codes**:
- `PROJECT_NOT_FOUND` - Invalid project ID
- `NO_BUSINESS_PROFILE` - Project missing business_profile data
- `TEMPLATE_SELECTION_FAILED` - Phase 1 LLM error (will use fallback)
- `GENERATION_FAILED` - Phase 2 LLM error
- `SNAPSHOT_SAVE_FAILED` - Database error saving snapshot

### System Prompt Composition

#### Phase 1: Template Selection Prompt

```typescript
const templateSelectionPrompt = `
You are selecting the best restaurant website template for a business.

Available Templates:
${RESTAURANT_THEMES.map(t => `
- ${t.label}: ${t.description}
  Cuisines: ${t.cuisines.join(', ')}
  Style: ${t.styleTags.join(', ')}
`).join('\n')}

Business Profile:
${formatBusinessProfile(businessProfile)}

Select the SINGLE best matching template. Consider:
1. Cuisine type alignment
2. Price tier and ambiance
3. Brand style and tone

Response format:
<selection>
  <templateName>{exact template name from list}</templateName>
  <reasoning>{1-2 sentence explanation}</reasoning>
</selection>
`;
```

#### Phase 2: Content Generation Prompt

```typescript
const contentGenerationPrompt = `
${BASE_BOLT_SYSTEM_PROMPT}

THEME DESIGN INSTRUCTIONS:
${themePrompt}

BUSINESS PROFILE:
${formatBusinessProfile(businessProfile)}

TASK: Generate a complete, production-ready restaurant website using the business information above.

Requirements:
1. Replace ALL placeholders with actual business data
2. Use the exact brand name, address, phone, and hours provided
3. Apply the theme's design system (colors, typography, layout)
4. Generate complete file contents - no TODOs or placeholders
5. Include: Hero, About, Menu, Contact, Footer sections

Color customization:
- Primary: ${businessProfile.generated_content?.visualAssets?.colorPalette?.primary || '#000'}
- Accent: ${businessProfile.generated_content?.visualAssets?.colorPalette?.accent || '#666'}

Generate the website now.
`;
```

## Phase 2: Implementation Components

### Component 1: Generation Service Extension

**File**: `app/lib/services/projectGenerationService.ts` (new)

**Responsibilities**:
- Orchestrate two-phase generation
- Handle progress tracking and SSE streaming
- Fallback logic for Phase 1 failures
- Auto-save snapshot after generation

**Key Functions**:
```typescript
// Main entry point
async function generateProjectWebsite(
  projectId: string,
  userId: string,
  options: GenerationOptions
): AsyncGenerator<SSEEvent>

// Phase 1: Template selection
async function selectTemplate(
  businessProfile: BusinessProfile,
  fastModel: string,
  provider: ProviderInfo
): Promise<TemplateSelection>

// Phase 2: Content generation with streaming
async function* generateContent(
  businessProfile: BusinessProfile,
  themeId: RestaurantThemeId,
  model: string,
  provider: ProviderInfo
): AsyncGenerator<FileEvent>

// Auto-save generated files
async function saveGeneratedSnapshot(
  projectId: string,
  files: FileMap,
  userId: string
): Promise<SaveSnapshotResponse>
```

### Component 2: API Route

**File**: `app/routes/api.project.generate.ts` (new)

**Responsibilities**:
- Authentication check
- Fetch project and business_profile
- Validate request
- Stream SSE events from generation service

### Component 3: CreateProjectDialog Integration

**File**: `app/components/projects/CreateProjectDialog.tsx` (modify)

**Changes**:
- Add generation state management
- Call `/api/project/generate` in "building" step
- Handle SSE events for progress updates
- Inject files into workbench via `workbenchStore`
- Navigate to project chat after completion

**New State**:
```typescript
const [generationProgress, setGenerationProgress] = useState<GenerationProgress | null>(null);
const [generationError, setGenerationError] = useState<string | null>(null);
const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
```

### Component 4: Fast Model Resolver

**File**: `app/lib/services/fastModelResolver.ts` (new)

**Purpose**: Select appropriate fast model based on user's provider.

```typescript
export function getFastModel(provider: ProviderInfo): { model: string; provider: ProviderInfo } {
  const fastModels: Record<string, string> = {
    'OpenAI': 'gpt-4o-mini',
    'Anthropic': 'claude-3-haiku-20240307',
    'Google': 'gemini-1.5-flash',
    'OpenRouter': 'openai/gpt-4o-mini',
    'Groq': 'llama-3.1-8b-instant',
  };
  
  const fastModel = fastModels[provider.name];
  if (fastModel) {
    return { model: fastModel, provider };
  }
  
  // Fallback: use user's configured model (may be slower but works)
  return { model: provider.defaultModel, provider };
}
```

## Quickstart Guide

### Prerequisites
- Configured LLM provider with valid API key
- Existing project with `business_profile` data (from crawler flow)

### Local Development

```bash
# 1. Start dev server
pnpm run dev

# 2. Create a project with Google Maps URL (populates business_profile)
# Use the UI wizard: New Project → Enter business details → Submit Maps URL

# 3. Trigger generation (automatically happens in "Building" step)
# Or manually via API:
curl -X POST http://localhost:5173/api/project/generate \
  -H "Content-Type: application/json" \
  -H "Cookie: <auth-cookies>" \
  -d '{"projectId": "<project-uuid>"}'
```

### Testing Generation Flow

1. **Unit Test**: Template selection with mock business profile
2. **Unit Test**: Fast model resolver for each provider
3. **Integration Test**: Full generation flow (mocked LLM)
4. **E2E Test**: Complete wizard flow with real project

## Implementation Phases

### Phase 1: Core Generation Service (P1)
1. Create `projectGenerationService.ts` with two-phase orchestration
2. Create `fastModelResolver.ts` for model selection
3. Create `/api/project/generate` route with SSE streaming
4. Add unit tests for template selection logic

### Phase 2: UI Integration (P1)
1. Modify `CreateProjectDialog.tsx` building step
2. Add EventSource handling for SSE
3. Update progress indicators based on events
4. Handle error states and retry

### Phase 3: WebContainer & Snapshot (P2)
1. Inject generated files into WebContainer via workbenchStore
2. Auto-save snapshot after successful generation
3. Navigate to project after completion

### Phase 4: Edge Cases & Polish (P3)
1. Handle Phase 1 failures with fallback template
2. "Taking longer than usual" message after 60s
3. Retry logic for transient failures
4. Logging and observability

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Phase 1 LLM failure | Fallback to "Classic Minimalist v2" template |
| Phase 2 timeout | No hard timeout; show progress message; allow user to wait |
| Large template files | Stream files individually; don't buffer entire response |
| Snapshot save failure | Log error; don't block user; retry in background |
| Invalid business_profile | Validate before generation; use defaults for missing fields |

## Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| `ai` | ^4.3.x | Vercel AI SDK for LLM calls |
| `@supabase/supabase-js` | ^2.x | Database operations |
| Existing prompts.ts | - | Base Bolt system prompt |
| Existing theme-prompts/ | - | 12 restaurant theme prompts |

## Success Metrics

- Generation completes in <60s (target for P90)
- 90% first-try success rate
- Zero placeholder text in generated websites
- Auto-save snapshot success rate >99%
