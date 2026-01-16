# Tasks: LLM Website Generation

**Input**: Design documents from `/specs/001-llm-website-generation/`  
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓  
**Tests**: Not explicitly requested - omitting test tasks  

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1, US2, US3) - only for story phases

## Path Conventions (This Project)

- **Routes**: `app/routes/` (Remix routing)
- **Components**: `app/components/`
- **Services**: `app/lib/services/`
- **Types**: `app/types/`
- **Utils**: `app/utils/`
- **Theme Prompts**: `app/theme-prompts/`

---

## Phase 1: Setup (Type Definitions)

**Purpose**: Define all new TypeScript types required for the feature

- [x] T001 [P] Create `GenerationProgress` interface in `app/types/generation.ts`
  - **Fields**: `phase`, `status`, `message`, `percentage`, `startedAt`, `templateName?`, `error?`
  - **Phase enum**: `'template_selection' | 'content_generation' | 'file_injection' | 'snapshot_save'`
  - **Status enum**: `'pending' | 'in_progress' | 'completed' | 'error'`

- [x] T002 [P] Create `GenerationRequest` interface in `app/types/generation.ts`
  - **Fields**: `projectId: string`
  - Note: userId, model, provider extracted from session/cookies server-side

- [x] T003 [P] Create `GenerationResult` interface in `app/types/generation.ts`
  - **Fields**: `success`, `projectId`, `template` (name, themeId, title, reasoning), `files[]`, `snapshot` (savedAt, fileCount, sizeMB), `timing` (phase1Ms, phase2Ms, totalMs), `error?`

- [x] T004 [P] Create `GenerationSSEEvent` union type in `app/types/generation.ts`
  - **Events**: `progress`, `template_selected`, `file`, `complete`, `error`, `heartbeat`
  - Follow schema from `contracts/api-project-generate.yaml`

- [x] T005 [P] Create `FastModelConfig` type in `app/types/generation.ts`
  - **Structure**: `{ [providerName: string]: { model: string; contextWindow: number; costPer1MTokens: number } }`

- [x] T006 Export all new types from `app/types/generation.ts` and add re-export in `app/types/index.ts`

**Checkpoint**: All TypeScript types defined and exported

---

## Phase 2: Foundational (Core Services)

**Purpose**: Core infrastructure that MUST be complete before ANY user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Fast Model Resolver

- [x] T007 Create `app/lib/services/fastModelResolver.ts` with provider-to-model mapping:
  - **Implementation**:
    ```typescript
    export const FAST_MODEL_CONFIG = {
      'OpenAI': { model: 'gpt-4o-mini', contextWindow: 128000, costPer1MTokens: 0.15 },
      'Anthropic': { model: 'claude-3-haiku-20240307', contextWindow: 200000, costPer1MTokens: 0.25 },
      'Google': { model: 'gemini-1.5-flash', contextWindow: 1000000, costPer1MTokens: 0.075 },
      'Groq': { model: 'llama-3.1-8b-instant', contextWindow: 128000, costPer1MTokens: 0 },
      'OpenRouter': { model: 'openai/gpt-4o-mini', contextWindow: 128000, costPer1MTokens: 0.15 },
    };
    ```

- [x] T008 Implement `getFastModel(provider: ProviderInfo)` function in `app/lib/services/fastModelResolver.ts`
  - **Input**: User's provider info from cookies
  - **Output**: `{ model: string; provider: ProviderInfo }`
  - **Fallback**: If provider not in mapping, return user's configured model

### Business Profile Validation

- [x] T009 Create `validateBusinessProfile()` function in `app/lib/services/projectGenerationService.ts`
  - **Input**: `BusinessProfile | null | undefined`
  - **Output**: `{ valid: boolean; errors: string[]; warnings: string[]; canProceedWithDefaults: boolean }`
  - **Required**: Business name (minimum)
  - **Warnings**: Missing address, phone, hours (non-blocking)
  - Reference: `data-model.md` validation rules

### SSE Utilities

- [x] T010 Create `app/lib/services/sseUtils.ts` with helper functions:
  - `createSSEStream()`: Create TransformStream for SSE
  - `sendSSEEvent(writer, event, data)`: Format and send SSE event
  - `sendProgress(writer, phase, status, message, percentage, extras?)`: Send progress event
  - `sendHeartbeat(writer)`: Send heartbeat event with timestamp
  - **Format**: `event: {eventName}\ndata: {JSON}\n\n`

### Generation Service Skeleton

- [x] T011 Create `app/lib/services/projectGenerationService.ts` skeleton with:
  - **Main function**: `generateProjectWebsite(projectId, userId, options)` returning `AsyncGenerator<GenerationSSEEvent>`
  - **Phase 1 function**: `selectTemplate(businessProfile, fastModel, provider)` returning `Promise<TemplateSelection>`
  - **Phase 2 function**: `generateContent(businessProfile, themeId, model, provider)` returning `AsyncGenerator<FileEvent>`
  - **Snapshot function**: `saveGeneratedSnapshot(projectId, files, userId)` returning `Promise<SaveSnapshotResponse>`
  - Leave function bodies as `// TODO: implement in US1`

**Checkpoint**: Foundation ready - all types, utilities, and service skeletons created

---

## Phase 3: User Story 1 - Automatic Website Generation (Priority: P1) 🎯 MVP

**Goal**: Business owner confirms info → system generates website automatically → website appears in preview

**Independent Test**: Complete create project wizard with valid business data, verify functional website in preview panel within ~60s

### API Endpoint

- [x] T012 [US1] Create `app/routes/api.project.generate.ts` Remix action handler:
  - **Method**: POST only
  - **Request body**: `{ projectId: string }`
  - **Authentication**: Extract userId from Better Auth session via `getSession()`
  - **Validation**: Check projectId format, user owns project

- [x] T013 [US1] Implement project fetch and business_profile validation in `api.project.generate.ts`:
  - Fetch project from database using `getProject(projectId, userId)`
  - Validate `project.business_profile` using `validateBusinessProfile()`
  - Return 404 if project not found, 400 if no business_profile

- [x] T014 [US1] Implement SSE response streaming in `api.project.generate.ts`:
  - Create response with `Content-Type: text/event-stream`
  - Set headers: `Cache-Control: no-cache`, `Connection: keep-alive`
  - Call `generateProjectWebsite()` and stream events to response
  - Handle errors with `event: error` SSE event

### Phase 1: Template Selection

- [x] T015 [US1] Implement `selectTemplate()` in `app/lib/services/projectGenerationService.ts`:
  - **Input**: BusinessProfile, fast model, provider
  - **Call**: POST to `/api/llmcall` with template selection prompt
  - **Prompt**: List all 12 themes with descriptions, cuisines, style tags from `RESTAURANT_THEMES`
  - **Parse response**: Extract `<templateName>` and `<reasoning>` from LLM output
  - **Fallback**: Return `'classicminimalistv2'` if LLM fails or returns invalid template
  - **SSE**: Send `progress` event with phase `template_selection`

- [x] T016 [US1] Create template selection prompt in `app/lib/services/projectGenerationService.ts`:
  - Import `RESTAURANT_THEMES` from `app/theme-prompts/registry.ts`
  - Format business profile with: name, cuisine/category, style, price tier
  - Request format: `<selection><templateName>...</templateName><reasoning>...</reasoning></selection>`
  - See `plan.md` lines 239-262 for full prompt template

### Phase 2: Content Generation

- [x] T017 [US1] Implement `generateContent()` in `app/lib/services/projectGenerationService.ts`:
  - **Input**: BusinessProfile, selected themeId, user's model, provider
  - **Load theme prompt**: Call `getThemePrompt(themeId)` from registry
  - **Compose system prompt**: Concatenate base Bolt prompt + theme prompt + business profile
  - **Call**: Use Vercel AI SDK `streamText()` with composed prompt
  - **Stream files**: Parse artifact/file blocks from LLM response, yield `file` events
  - **SSE**: Send `progress` event with phase `content_generation`

- [x] T018 [US1] Create content generation prompt composer in `app/lib/services/projectGenerationService.ts`:
  - **Function**: `composeContentPrompt(businessProfile, themePrompt)`
  - **Structure**:
    1. Base Bolt system prompt from `getSystemPrompt()`
    2. Theme design instructions section
    3. Business profile data section (formatted)
    4. Task instructions: generate complete website, no placeholders
  - **Data mapping**: Use `generated_content` if available, fallback to `crawled_data`
  - See `plan.md` lines 268-291 for full prompt template

- [x] T019 [US1] Implement file parsing from LLM streaming response:
  - **Parse pattern**: Look for `<boltAction type="file" filePath="...">...</boltAction>`
  - **Extract**: path and content from each file action
  - **Yield**: `{ event: 'file', data: { path, content, size } }` for each file
  - Reference: Existing parsing in `app/lib/runtime/message-parser.ts`

### Main Orchestration

- [x] T020 [US1] Implement `generateProjectWebsite()` orchestration in `app/lib/services/projectGenerationService.ts`:
  - **Step 1**: Send progress "Analyzing business details" (10%)
  - **Step 2**: Call `selectTemplate()` for Phase 1
  - **Step 3**: Send `template_selected` event with name, themeId, reasoning
  - **Step 4**: Send progress "Generating layout & copy" (30%)
  - **Step 5**: Call `generateContent()` for Phase 2, yield each file event
  - **Step 6**: Send progress "Final polish" (80%)
  - **Step 7**: Call `saveGeneratedSnapshot()` 
  - **Step 8**: Send `complete` event with GenerationResult
  - **Heartbeat**: Send every 5 seconds during long operations

- [x] T021 [US1] Implement `saveGeneratedSnapshot()` in `app/lib/services/projectGenerationService.ts`:
  - **Input**: projectId, files array, userId
  - **Transform**: Convert file array to FileMap format `{ [path]: { type: 'file', content } }`
  - **Call**: `saveSnapshot()` from `app/lib/services/projects.server.ts`
  - **SSE**: Send progress "Saving project" (90%)
  - **Handle failure**: Log error, don't block completion, include warning in result

### UI Integration

- [x] T022 [US1] Add generation state to `app/components/projects/CreateProjectDialog.tsx`:
  - **New state**:
    ```typescript
    const [generationProgress, setGenerationProgress] = useState<GenerationProgress | null>(null);
    const [generationError, setGenerationError] = useState<string | null>(null);
    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
    const [generatedFiles, setGeneratedFiles] = useState<GeneratedFile[]>([]);
    ```
  - **Initialize**: Reset state when entering 'building' step

- [x] T023 [US1] Implement EventSource connection in `CreateProjectDialog.tsx`:
  - **Trigger**: When step changes to 'building' and project is created
  - **Create EventSource**: POST to `/api/project/generate` with `{ projectId }`
  - **Note**: Use `fetch()` with streaming reader since POST not supported by native EventSource
  - **Parse SSE**: Split by `\n\n`, parse `event:` and `data:` lines

- [x] T024 [US1] Implement SSE event handlers in `CreateProjectDialog.tsx`:
  - **progress**: Update `generationProgress` state, update UI indicators
  - **template_selected**: Update `selectedTemplate` state
  - **file**: Accumulate files in `generatedFiles` array
  - **complete**: Close stream, trigger file injection
  - **error**: Set `generationError`, show retry button
  - **heartbeat**: Ignore (just keeps connection alive)

- [x] T025 [US1] Update building step UI in `CreateProjectDialog.tsx`:
  - **Progress display**: Show current phase message (from `generationProgress.message`)
  - **Template display**: Show selected template name after Phase 1
  - **Progress bar**: Update based on `generationProgress.percentage`
  - **Timing**: Track elapsed time, show "Taking longer than usual..." after 60s

### File Injection

- [x] T026 [US1] Implement file injection into WebContainer in `CreateProjectDialog.tsx`:
  - **Trigger**: On `complete` event from SSE
  - **Import**: `workbenchStore` from `app/lib/stores/workbench`
  - **For each file**: Call `workbenchStore.updateFile(path, content)`
  - **Alternative**: Use `ActionRunner` pattern from existing template injection

- [x] T027 [US1] Implement editor file tree update:
  - **Import**: `editorStore` from `app/lib/stores/editor`
  - **After injection**: Call `editorStore.setDocuments(fileMap)` if needed
  - **Verify**: Files appear in sidebar file tree
  - Reference: `app/lib/stores/workbench.ts` `_runBundledAction` method

- [x] T028 [US1] Navigate to project after successful generation:
  - **On complete**: Close dialog, navigate to `/chat/{projectId}`
  - **Show toast**: "Website generated successfully!"
  - **Handle partial success**: If snapshot failed, still navigate but show warning

**Checkpoint**: Full generation flow works end-to-end. User completes wizard → website generated and displayed.

---

## Phase 4: User Story 2 - Template Selection Based on Business Type (Priority: P2)

**Goal**: System intelligently selects best-matching template based on business characteristics

**Independent Test**: Create projects with different business types (fine dining French, casual Asian, street food), verify appropriate themes selected

### Enhanced Selection Logic

- [x] T029 [US2] Enhance template selection prompt with detailed business analysis:
  - **Extract from profile**:
    - Cuisine type (from menu or business name)
    - Price tier (from menu prices or rating context)
    - Ambiance (from reviews sentiment)
    - Category (from `businessIdentity.industry` or `crawled_data.category`)
  - **Add to prompt**: Explicit matching criteria for each factor

- [x] T030 [US2] Create business profile analyzer function in `app/lib/services/projectGenerationService.ts`:
  - **Function**: `analyzeBusinessProfile(profile: BusinessProfile)`
  - **Output**: `{ cuisine: string; priceTier: 'budget' | 'mid' | 'upscale' | 'luxury'; style: string; keywords: string[] }`
  - **Sources**: Prefer `generated_content`, fallback to `crawled_data`
  - **Inference**: Derive style from reviews, price from menu items

- [x] T031 [US2] Add template-business matching rules documentation:
  - **Update**: Template selection prompt with explicit matching rules
  - **Examples**:
    - Fine dining + French → "Noir Luxe v3" or "Classic Minimalist v2"
    - Casual + Asian → "Bamboo Bistro" or "Indochine Luxe"
    - Street food → "Chromatic Street" or "The Red Noodle"
  - Reference: `app/theme-prompts/registry.ts` theme metadata

- [x] T032 [US2] Log template selection reasoning for debugging:
  - **After selection**: Log business profile summary, selected template, reasoning
  - **Use**: `app/utils/logger.ts` logging utilities
  - **Level**: Info in dev, reduced in production

**Checkpoint**: Template selection is intelligent and matches business type appropriately

---

## Phase 5: User Story 3 - Content Personalization (Priority: P3)

**Goal**: Generated website contains actual business data, not placeholder text

**Independent Test**: Verify generated website displays actual business name, address, phone, hours from profile

### Data Mapping Enhancement

- [x] T033 [US3] Create comprehensive business data formatter in `app/lib/services/projectGenerationService.ts`:
  - **Function**: `formatBusinessDataForPrompt(profile: BusinessProfile): string`
  - **Sections**:
    - Basic info: name, tagline, description
    - Contact: address, phone, email, website
    - Hours: formatted day-by-day schedule
    - Menu: categories with items (names, descriptions, prices)
    - Reviews: Top 3-5 positive reviews with attribution
    - Photos: URLs or descriptions
  - **Format**: Clear markdown sections for LLM consumption

- [x] T034 [US3] Implement fallback values for missing data:
  - **Required fields with defaults**:
    - Name: "Restaurant Name" (should not happen if validation passes)
    - Address: "123 Main Street" (generic placeholder)
    - Phone: "(555) 123-4567" (generic placeholder)
    - Hours: "Contact us for hours"
  - **Mark in prompt**: Explicitly tell LLM which fields are placeholders

- [x] T035 [US3] Enhance content generation prompt with personalization instructions:
  - **Add section**: "CONTENT REQUIREMENTS"
  - **Rules**:
    - MUST use exact business name in header, footer, meta title
    - MUST use exact address in contact section
    - MUST use exact phone in contact section
    - MUST use provided hours if available
    - SHOULD incorporate brand messaging from `brandStrategy.usp`
    - SHOULD use color palette from `visualAssets.colorPalette`

- [x] T036 [US3] Add brand voice instructions to prompt:
  - **Extract from profile**: `generated_content.brandStrategy.toneOfVoice`
  - **Add to prompt**: "Write all copy in a {toneOfVoice} voice"
  - **Examples**: "warm and inviting", "professional and elegant", "fun and casual"

### Color Customization

- [x] T037 [US3] Implement color palette injection in content prompt:
  - **Extract**: `generated_content.visualAssets.colorPalette`
  - **Format in prompt**:
    ```
    COLOR PALETTE:
    - Primary: {primary} - Use for headers, CTAs, key elements
    - Secondary: {secondary} - Use for accents, borders
    - Background: {background} - Use for page backgrounds
    - Text: {text} - Use for body text
    ```
  - **Fallback**: Use theme's default colors if not provided

**Checkpoint**: Generated websites display actual business data with appropriate branding

---

## Phase 6: Polish & Edge Cases

**Purpose**: Error handling, timeout management, retry logic

### Error Handling

- [ ] T038 [P] Implement Phase 1 failure fallback in `projectGenerationService.ts`:
  - **On LLM error**: Log error, use `'classicminimalistv2'` as default
  - **On invalid response**: Parse error, use default template
  - **SSE**: Send progress with warning message, continue to Phase 2

- [ ] T039 [P] Implement Phase 2 failure handling in `projectGenerationService.ts`:
  - **On LLM error**: Send `error` event with `GENERATION_FAILED`, `retryable: true`
  - **On stream timeout**: Don't abort, send "Taking longer than usual..." progress
  - **On parse error**: Log malformed content, skip file, continue

- [ ] T040 Implement retry button in `CreateProjectDialog.tsx`:
  - **Trigger**: Show when `generationError` is set and error is retryable
  - **Action**: Reset state, re-call `/api/project/generate`
  - **Limit**: Allow max 2 retries, then show "Manual setup" fallback option

### Timeout Handling

- [ ] T041 Implement "Taking longer than usual" message:
  - **Timer**: Start 60s timer when Phase 2 begins
  - **On timeout**: Update progress message, don't abort generation
  - **UI**: Show message but keep progress spinner running
  - **Clear**: Reset timer on completion or error

- [ ] T042 Implement heartbeat monitoring in `CreateProjectDialog.tsx`:
  - **Expect**: Heartbeat every 5 seconds
  - **On miss**: After 15s without any event, show connection warning
  - **Recovery**: If events resume, clear warning

### Snapshot Save Handling

- [ ] T043 Implement snapshot save retry:
  - **On failure**: Log error, wait 2s, retry once
  - **On second failure**: Log, mark in result as `snapshot: null`
  - **Non-blocking**: Generation still considered successful

- [ ] T044 Add snapshot save progress in UI:
  - **Show**: "Saving project..." during snapshot save phase
  - **On success**: "Project saved!" then navigate
  - **On failure**: "Warning: Could not save project. You may need to save manually."

### Validation Edge Cases

- [ ] T045 Handle minimal business profile (name only):
  - **Validation**: Pass if name exists
  - **Generation**: Use extensive defaults for missing fields
  - **UI**: Show info message "Limited data available, using defaults"

- [ ] T046 Handle business profile without menu data:
  - **Check**: `crawled_data.menu` or `generated_content.contentSections.products`
  - **Fallback**: Instruct LLM to generate generic menu section placeholder
  - **Prompt addition**: "Menu data not available - create a placeholder menu section"

### Observability

- [ ] T047 [P] Add generation timing metrics:
  - **Track**: Phase 1 duration, Phase 2 duration, total duration
  - **Include in result**: `timing: { phase1Ms, phase2Ms, totalMs }`
  - **Log**: Summary at end of generation

- [ ] T048 [P] Add generation event logging:
  - **Log start**: projectId, userId, model, provider
  - **Log Phase 1**: selected template, reasoning, duration
  - **Log Phase 2**: file count, total size, duration
  - **Log complete**: success/failure, snapshot saved
  - **Use**: `app/utils/logger.ts`

**Checkpoint**: All edge cases handled gracefully with appropriate user feedback

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)         →  No dependencies
         ↓
Phase 2 (Foundational)  →  Depends on Phase 1 (types)
         ↓
Phase 3 (US1 - Core)    →  Depends on Phase 2 (services, utils)
         ↓
Phase 4 (US2 - Select)  →  Can run after US1 complete (enhances selection)
         ↓
Phase 5 (US3 - Content) →  Can run after US1 complete (enhances content)
         ↓
Phase 6 (Polish)        →  Depends on US1 (error handling for working system)
```

### Within Phase 3 (US1) Dependencies

```
T012-T014 (API setup)     →  No internal deps
         ↓
T015-T016 (Phase 1 LLM)   →  Needs API structure
         ↓
T017-T019 (Phase 2 LLM)   →  Needs Phase 1 working
         ↓
T020-T021 (Orchestration) →  Needs both phases
         ↓
T022-T025 (UI)            →  Needs API endpoint working
         ↓
T026-T028 (Injection)     →  Needs UI receiving events
```

### Parallel Opportunities

```bash
# Phase 1: All type definitions can run in parallel
T001, T002, T003, T004, T005  # Different type files, no deps

# Phase 2: Fast model resolver and SSE utils are independent
T007 + T008  # Fast model resolver
T010         # SSE utils (independent)

# Phase 3: API and UI initial setup
T012         # API route setup
T022         # UI state setup (can start while API in progress)

# Phase 6: Independent polish tasks
T038, T039   # Error handling (different phases)
T047, T048   # Metrics and logging
```

---

## Parallel Example: Phase 1 Setup

```bash
# Launch all type definition tasks together:
Task T001: "Create GenerationProgress interface in app/types/generation.ts"
Task T002: "Create GenerationRequest interface in app/types/generation.ts"
Task T003: "Create GenerationResult interface in app/types/generation.ts"
Task T004: "Create GenerationSSEEvent union type in app/types/generation.ts"
Task T005: "Create FastModelConfig type in app/types/generation.ts"
# Then T006 to export all
```

---

## Implementation Strategy

### MVP First (Phase 1 + 2 + US1 Only)

1. Complete Phase 1: Type definitions
2. Complete Phase 2: Core services skeleton
3. Complete Phase 3: US1 - Full generation flow
4. **STOP and VALIDATE**: Test complete wizard flow end-to-end
5. Deploy/demo MVP

**MVP Scope**: 28 tasks (T001-T028)

### Incremental Delivery

1. **MVP**: Setup + Foundational + US1 → Full generation works
2. **Enhancement 1**: US2 → Better template selection
3. **Enhancement 2**: US3 → Better content personalization
4. **Hardening**: Polish → Error handling, retry, observability

### Estimated Effort

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| Phase 1: Setup | 6 tasks | 1-2 hours |
| Phase 2: Foundational | 5 tasks | 2-3 hours |
| Phase 3: US1 (MVP) | 17 tasks | 6-8 hours |
| Phase 4: US2 | 4 tasks | 2-3 hours |
| Phase 5: US3 | 5 tasks | 2-3 hours |
| Phase 6: Polish | 11 tasks | 3-4 hours |
| **Total** | **48 tasks** | **16-23 hours** |

---

## Notes

- [P] tasks = different files, no dependencies → can run in parallel
- [Story] label = maps task to user story for traceability
- Each user story should be independently testable after completion
- Commit after each task or logical group
- Reference `plan.md` and `data-model.md` for detailed type/prompt specs
- Use existing patterns from `api.chat.ts` and `selectStarterTemplate.ts`
