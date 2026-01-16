# Website Generation Flow

This document describes the complete flow for generating a website for a single project.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           USER JOURNEY                                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   [1] Enter Details ──▶ [2] Maps URL ──▶ [3] Crawling ──▶ [4] Review           │
│                                                                                 │
│                              │                                                  │
│                              ▼                                                  │
│                                                                                 │
│   [5] Confirm ──▶ [6] Building Website ──▶ [7] Preview & Chat                  │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Detailed Flow Diagram

```
                              ┌──────────────────┐
                              │   User opens     │
                              │  "New Project"   │
                              │     dialog       │
                              └────────┬─────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ STEP 1: DETAILS                                                                  │
│ ┌──────────────────────────────────────────────────────────────────────────────┐ │
│ │  • Enter Business Name (required)                                            │ │
│ │  • Enter Business Address (required)                                         │ │
│ │  • Click "Continue"                                                          │ │
│ └──────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────┬───────────────────────────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ STEP 2: GOOGLE MAPS URL                                                          │
│ ┌──────────────────────────────────────────────────────────────────────────────┐ │
│ │  • User pastes Google Maps share URL                                         │ │
│ │  • Examples: maps.app.goo.gl/..., google.com/maps?q=...                     │ │
│ │  • Click "Submit Link"                                                       │ │
│ └──────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│  ┌─────────────────┐                              ┌─────────────────────┐        │
│  │  Invalid URL    │ ─────────────────────────────▶│ MAPS ERROR STEP   │        │
│  └─────────────────┘                              │ • Try Again         │        │
│                                                   │ • Manual Entry      │        │
│                                                   │ • Go Back           │        │
│                                                   └─────────────────────┘        │
└──────────────────────────────────────┬───────────────────────────────────────────┘
                                       │ Valid URL
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ STEP 3: CRAWLING (10-30 seconds)                                                 │
│ ┌──────────────────────────────────────────────────────────────────────────────┐ │
│ │                         POST /api/crawler/extract                            │ │
│ │  ┌───────────────────────────────────────────────────────────────────────┐   │ │
│ │  │  Request: { session_id, google_maps_url }                             │   │ │
│ │  │                                                                       │   │ │
│ │  │  Crawler extracts from Google Maps:                                   │   │ │
│ │  │  • Business name, address, phone                                      │   │ │
│ │  │  • Operating hours                                                    │   │ │
│ │  │  • Rating, reviews count, reviews                                     │   │ │
│ │  │  • Menu items (if available)                                          │   │ │
│ │  │  • Photos URLs                                                        │   │ │
│ │  │  • Business website URL                                               │   │ │
│ │  └───────────────────────────────────────────────────────────────────────┘   │ │
│ │                                                                              │ │
│ │  Progress indicators:                                                        │ │
│ │  [0-3s] "Connecting to Google Maps..."                                       │ │
│ │  [3-10s] "Extracting business information..."                                │ │
│ │  [10s+] "Almost done..."                                                     │ │
│ └──────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────┬───────────────────────────────────────────┘
                                       │ Success
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ STEP 4: REVIEW                                                                   │
│ ┌──────────────────────────────────────────────────────────────────────────────┐ │
│ │  User reviews and can edit:                                                  │ │
│ │  • Business Name (editable, required)                                        │ │
│ │  • Address (editable, required)                                              │ │
│ │  • Phone (editable, optional)                                                │ │
│ │  • Website (editable, optional)                                              │ │
│ │                                                                              │ │
│ │  Display only (non-editable):                                                │ │
│ │  • Rating & reviews count                                                    │ │
│ │  • Operating hours (expandable)                                              │ │
│ │  • "Website content extracted" indicator                                     │ │
│ └──────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────┬───────────────────────────────────────────┘
                                       │ Click "Continue"
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ STEP 5: CONFIRM                                                                  │
│ ┌──────────────────────────────────────────────────────────────────────────────┐ │
│ │  "Is this your company?"                                                     │ │
│ │                                                                              │ │
│ │  Shows card with:                                                            │ │
│ │  • Business name                                                             │ │
│ │  • Address                                                                   │ │
│ │  • Rating & reviews (if available)                                           │ │
│ │                                                                              │ │
│ │  Actions:                                                                    │ │
│ │  • "Yes, this is my business" ──▶ Triggers project creation & generation    │ │
│ │  • "Edit information" ──▶ Back to Review step                               │ │
│ └──────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────┬───────────────────────────────────────────┘
                                       │ "Yes, this is my business"
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ STEP 6: BUILDING WEBSITE                                                         │
│                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────┐  │
│  │ 6A. CREATE PROJECT IN DATABASE                                             │  │
│  │                                                                            │  │
│  │  onCreateProject() → POST /api/projects                                    │  │
│  │  Payload: {                                                                │  │
│  │    name: "Business Name",                                                  │  │
│  │    gmaps_url: "https://maps.app.goo.gl/...",                              │  │
│  │    address: { line1: "123 Main St" },                                      │  │
│  │    session_id: "uuid",                                                     │  │
│  │    businessProfile: { crawled_data, session_id, crawled_at }              │  │
│  │  }                                                                         │  │
│  │                                                                            │  │
│  │  Returns: Project { id, url_id, name, ... }                               │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
│                                       │                                          │
│                                       ▼                                          │
│  ┌────────────────────────────────────────────────────────────────────────────┐  │
│  │ 6B. TRIGGER WEBSITE GENERATION                                             │  │
│  │                                                                            │  │
│  │  POST /api/project/generate                                                │  │
│  │  Request: { projectId: "project-uuid" }                                    │  │
│  │  Response: Server-Sent Events (SSE) stream                                 │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
│                                       │                                          │
│                                       ▼                                          │
│  ┌────────────────────────────────────────────────────────────────────────────┐  │
│  │ 6C. TWO-PHASE LLM GENERATION                                               │  │
│  │                                                                            │  │
│  │  ┌──────────────────────────────────────────────────────────────────────┐  │  │
│  │  │ PHASE 1: TEMPLATE SELECTION (~3-5 seconds)                           │  │  │
│  │  │                                                                      │  │  │
│  │  │  Model: Fast/cheap model based on provider                           │  │  │
│  │  │  • OpenAI: gpt-4o-mini                                               │  │  │
│  │  │  • Anthropic: claude-3-haiku-20240307                                │  │  │
│  │  │  • Google: gemini-1.5-flash                                          │  │  │
│  │  │  • Groq: llama-3.1-8b-instant                                        │  │  │
│  │  │                                                                      │  │  │
│  │  │  Input:                                                              │  │  │
│  │  │  • Business profile (name, cuisine, category, price tier)            │  │  │
│  │  │  • List of 12 available restaurant themes                            │  │  │
│  │  │                                                                      │  │  │
│  │  │  LLM analyzes and selects best matching template:                    │  │  │
│  │  │  • Cuisine alignment                                                 │  │  │
│  │  │  • Price tier / experience                                           │  │  │
│  │  │  • Brand style (minimalist, rustic, vibrant, etc.)                   │  │  │
│  │  │                                                                      │  │  │
│  │  │  Output: <selection>                                                 │  │  │
│  │  │    <templateName>Bamboo Bistro</templateName>                        │  │  │
│  │  │    <reasoning>Best match for Asian casual dining</reasoning>         │  │  │
│  │  │    <title>Restaurant Website</title>                                 │  │  │
│  │  │  </selection>                                                        │  │  │
│  │  │                                                                      │  │  │
│  │  │  Fallback: If Phase 1 fails → "Classic Minimalist v2"               │  │  │
│  │  └──────────────────────────────────────────────────────────────────────┘  │  │
│  │                              │                                             │  │
│  │                              ▼                                             │  │
│  │  ┌──────────────────────────────────────────────────────────────────────┐  │  │
│  │  │ PHASE 2: CONTENT GENERATION (~30-60 seconds)                         │  │  │
│  │  │                                                                      │  │  │
│  │  │  Model: User's configured LLM (higher quality)                       │  │  │
│  │  │                                                                      │  │  │
│  │  │  System prompt composition:                                          │  │  │
│  │  │  ┌────────────────────────────────────────────────────────────────┐  │  │  │
│  │  │  │ 1. Base Bolt system prompt (WebContainer constraints)         │  │  │  │
│  │  │  │ 2. Theme design instructions (from selected template)         │  │  │  │
│  │  │  │ 3. Brand voice (tone, USP, target audience)                   │  │  │  │
│  │  │  │ 4. Color palette & typography (if provided)                   │  │  │  │
│  │  │  │ 5. Business profile data:                                     │  │  │  │
│  │  │  │    - Name, address, phone, hours                              │  │  │  │
│  │  │  │    - Menu items (categories + items)                          │  │  │  │
│  │  │  │    - Reviews (top 5)                                          │  │  │  │
│  │  │  │    - Photos URLs                                              │  │  │  │
│  │  │  │ 6. Content requirements (no placeholders, use exact data)     │  │  │  │
│  │  │  └────────────────────────────────────────────────────────────────┘  │  │  │
│  │  │                                                                      │  │  │
│  │  │  LLM generates website code via streamText()                         │  │  │
│  │  │  Output: <boltAction type="file" filePath="/home/project/...">       │  │  │
│  │  │            file content...                                           │  │  │
│  │  │          </boltAction>                                               │  │  │
│  │  │                                                                      │  │  │
│  │  │  Files streamed as they're generated (SSE)                           │  │  │
│  │  └──────────────────────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
│                                       │                                          │
│                                       ▼                                          │
│  ┌────────────────────────────────────────────────────────────────────────────┐  │
│  │ 6D. SSE EVENT STREAM                                                       │  │
│  │                                                                            │  │
│  │  Event types:                                                              │  │
│  │  • progress: { phase, status, message, percentage }                        │  │
│  │  • template_selected: { name, themeId, reasoning }                         │  │
│  │  • file: { path, content, size }                                           │  │
│  │  • complete: { success, projectId, template, files, snapshot, timing }     │  │
│  │  • error: { message, code, retryable }                                     │  │
│  │  • heartbeat: { timestamp } (every 5s to keep connection alive)            │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
│                                       │                                          │
│                                       ▼                                          │
│  ┌────────────────────────────────────────────────────────────────────────────┐  │
│  │ 6E. AUTO-SAVE SNAPSHOT                                                     │  │
│  │                                                                            │  │
│  │  After Phase 2 completes:                                                  │  │
│  │  saveSnapshot(projectId, files, userId)                                    │  │
│  │  → Saves to project_snapshots table                                        │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  UI Progress indicators:                                                         │
│  ┌────────────────────────────────────────────────────────────────────────────┐  │
│  │ [✓] Analyzing business details (Phase 1 complete)                          │  │
│  │ [⟳] Generating layout & copy... (Phase 2 in progress)                      │  │
│  │ [ ] Final polish & SEO check (pending)                                     │  │
│  │                                                                            │  │
│  │ Selected template: Bamboo Bistro                                           │  │
│  │                                                                            │  │
│  │ [After 60s] "Taking longer than usual..."                                  │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────┬───────────────────────────────────────────┘
                                       │ Generation complete
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ STEP 7: INJECT FILES & NAVIGATE                                                  │
│ ┌──────────────────────────────────────────────────────────────────────────────┐ │
│ │                                                                              │ │
│ │  When 'complete' event received:                                             │ │
│ │                                                                              │ │
│ │  1. Inject files into WebContainer:                                          │ │
│ │     for (const file of files) {                                              │ │
│ │       await workbenchStore.createFile(file.path, file.content);             │ │
│ │     }                                                                        │ │
│ │                                                                              │ │
│ │  2. Show success toast: "Website generated successfully!"                    │ │
│ │                                                                              │ │
│ │  3. Close dialog                                                             │ │
│ │                                                                              │ │
│ │  4. Navigate to project chat:                                                │ │
│ │     navigate(`/chat/${project.url_id}`)                                      │ │
│ │                                                                              │ │
│ └──────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────┬───────────────────────────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ FINAL STATE: PROJECT CHAT                                                        │
│ ┌──────────────────────────────────────────────────────────────────────────────┐ │
│ │                                                                              │ │
│ │  • User sees generated website in preview panel                              │ │
│ │  • Files visible in workbench file tree                                      │ │
│ │  • Can chat with AI to modify website                                        │ │
│ │  • Snapshot already saved (can restore later)                                │ │
│ │                                                                              │ │
│ └──────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────┘
```

## Error Handling

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ ERROR SCENARIOS                                                                  │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  1. Invalid Google Maps URL                                                      │
│     → Show "Maps Error" step with retry/manual options                           │
│                                                                                  │
│  2. Crawler fails/times out                                                      │
│     → Show error with retry option                                               │
│     → Allow "Continue with Manual Entry" (fallback mode)                         │
│                                                                                  │
│  3. Project creation fails                                                       │
│     → Show error in "Building" step                                              │
│     → "Try Again" button                                                         │
│                                                                                  │
│  4. Phase 1 (template selection) fails                                           │
│     → Automatic fallback to "Classic Minimalist v2"                              │
│     → Continue to Phase 2                                                        │
│                                                                                  │
│  5. Phase 2 (content generation) fails                                           │
│     → Show error in "Building" step                                              │
│     → "Try Again" button (retries generation)                                    │
│     → "Back" button (return to confirm step)                                     │
│                                                                                  │
│  6. Snapshot save fails                                                          │
│     → Log error but don't block user                                             │
│     → Generation still considered successful                                     │
│     → User can manually save later                                               │
│                                                                                  │
│  7. File injection fails                                                         │
│     → Show error toast                                                           │
│     → Allow retry                                                                │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/crawler/extract` | POST | Extract business data from Google Maps URL |
| `/api/projects` | POST | Create new project in database |
| `/api/project/generate` | POST | Trigger website generation (SSE stream) |
| `/api/llmcall` | POST | Internal LLM call for Phase 1 template selection |

## Key Files

| File | Purpose |
|------|---------|
| `app/components/projects/CreateProjectDialog.tsx` | UI wizard component |
| `app/routes/api.project.generate.ts` | Generation API endpoint |
| `app/lib/services/projectGenerationService.ts` | Two-phase generation orchestration |
| `app/lib/services/fastModelResolver.ts` | Select fast model for Phase 1 |
| `app/types/generation.ts` | TypeScript types for generation |
| `app/theme-prompts/registry.ts` | Restaurant theme registry |

## Timing Expectations

| Phase | Typical Duration |
|-------|------------------|
| Crawling | 10-30 seconds |
| Phase 1 (Template Selection) | 3-5 seconds |
| Phase 2 (Content Generation) | 30-60 seconds |
| Total (end-to-end) | 45-90 seconds |

> **Note**: After 60 seconds, UI shows "Taking longer than usual..." message. There is no hard timeout - generation is allowed to complete regardless of duration.

## Post-Generation: What's Sent to LLM During Chat

After the website is generated and the user starts chatting, the following data is sent to the LLM:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ POST /api/chat - Request Body                                                    │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  {                                                                               │
│    messages: [...],           // Conversation history                            │
│    files: {...},              // ⭐ ALL files from WebContainer (generated code) │
│    chatMode: "build",         // "build" or "discuss"                            │
│    restaurantThemeId: "...",  // Theme ID (if set during generation)             │
│    contextOptimization: true, // Whether to filter relevant files                │
│    designScheme: {...},       // Color palette, typography                       │
│    supabase: {...},           // Supabase connection state                       │
│    maxLLMSteps: 10            // Max tool call steps                             │
│  }                                                                               │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### System Prompt Composition

The LLM receives a composed system prompt with these layers:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ SYSTEM PROMPT LAYERS (chatMode === 'build')                                      │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  1. BASE BOLT SYSTEM PROMPT (~15K chars)                                         │
│     ├── WebContainer constraints (in-browser Node.js, no native binaries)        │
│     ├── Database instructions (Supabase)                                         │
│     ├── Artifact format (<boltArtifact>, <boltAction>)                          │
│     ├── Design instructions                                                      │
│     └── Examples                                                                 │
│                                                                                  │
│  2. RESTAURANT THEME PROMPT (if restaurantThemeId is set)                        │
│     └── Theme-specific design guidelines (colors, typography, layout)            │
│                                                                                  │
│  3. CONTEXT BUFFER (if contextOptimization is enabled)                           │
│     └── Filtered relevant files from WebContainer                                │
│         (selected by AI based on user's request)                                 │
│                                                                                  │
│  4. CHAT SUMMARY (if contextOptimization is enabled)                             │
│     └── Summarized conversation history (to reduce tokens)                       │
│                                                                                  │
│  5. LOCKED FILES LIST (if any files are locked)                                  │
│     └── Files that MUST NOT be modified                                          │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### How Files Flow to LLM

```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│    WebContainer     │     │   workbenchStore    │     │    /api/chat        │
│    (Browser FS)     │────▶│      .files         │────▶│   Request Body      │
│                     │     │                     │     │                     │
│  /home/project/     │     │  FileMap {          │     │  files: {           │
│  ├── src/           │     │   "/home/project/   │     │   "/home/project/   │
│  │   ├── App.tsx    │     │    src/App.tsx": {  │     │    src/App.tsx":    │
│  │   └── ...        │     │      type: "file",  │     │    { content: "..." │
│  ├── package.json   │     │      content: "..." │     │    }                │
│  └── ...            │     │    }                │     │  }                  │
└─────────────────────┘     │  }                  │     └─────────────────────┘
                            └─────────────────────┘
                                      │
                                      ▼
                            ┌─────────────────────┐
                            │   Context Selection │
                            │   (if optimization  │
                            │    enabled)         │
                            │                     │
                            │  AI selects only    │
                            │  relevant files     │
                            │  based on user's    │
                            │  request            │
                            └─────────────────────┘
                                      │
                                      ▼
                            ┌─────────────────────┐
                            │   LLM System Prompt │
                            │                     │
                            │  CONTEXT BUFFER:    │
                            │  <boltArtifact>     │
                            │    <boltAction      │
                            │     type="file"     │
                            │     filePath="..."> │
                            │      file content   │
                            │    </boltAction>    │
                            │  </boltArtifact>    │
                            └─────────────────────┘
```

### Key Points

1. **Files are ALWAYS available** - The generated website files are stored in `workbenchStore.files` and sent with every chat request

2. **LLM knows the current state** - The LLM can see all files in the project, so it knows:
   - What components exist
   - Current styles and layouts
   - Package dependencies
   - Any user modifications

3. **Context optimization** - When enabled, the system:
   - Creates a summary of the conversation
   - Selects only relevant files (not all 50+ files)
   - Reduces token usage significantly

4. **Theme persistence** - The `restaurantThemeId` is stored in a ref and sent with each request, so the LLM maintains design consistency

5. **Edit vs Create** - LLM is instructed to use:
   - `type="edit"` for modifying existing files (SEARCH/REPLACE blocks)
   - `type="file"` for creating new files or complete rewrites

---

## Available Templates

12 restaurant themes available for selection:

1. Classic Minimalist v2
2. Noir Luxe v3
3. Bamboo Bistro
4. Chromatic Street
5. Indochine Luxe
6. The Red Noodle
7. Mediterranean Sun
8. Rustic Hearth
9. Fresh Botanical
10. Urban Industrial
11. Coastal Breeze
12. Golden Harvest

Template selection is based on:
- Cuisine alignment (Vietnamese, Chinese, French, etc.)
- Price tier (budget, mid, upscale, luxury)
- Brand style (minimalist, rustic, vibrant, dark-luxe, botanical)
- Ambiance keywords from reviews
