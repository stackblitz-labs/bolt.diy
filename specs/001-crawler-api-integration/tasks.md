# Tasks: Crawler API Integration

**Input**: Design documents from `/specs/001-crawler-api-integration/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Not explicitly requested - test tasks omitted. Manual testing via quickstart.md.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1, US2, US3, US4)
- All file paths are relative to repository root

## Path Conventions (Remix Web App)

- **Types**: `app/types/`
- **Services**: `app/lib/services/`
- **Routes**: `app/routes/`
- **Components**: `app/components/`
- **Hooks**: `app/lib/persistence/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Environment configuration and type definitions

- [x] T001 Add `CRAWLER_API_URL` environment variable to `.env.example` with default value `http://localhost:4999` and add documentation comment explaining its purpose
- [x] T002 [P] Create `app/types/crawler.ts` with `CrawlSessionStatus` type enum containing values: `pending`, `crawling`, `completed`, `failed`, `timeout`
- [x] T003 [P] Add `CrawlSession` interface to `app/types/crawler.ts` with fields: `session_id` (string), `google_maps_url` (string), `status` (CrawlSessionStatus), `created_at` (string), `completed_at?` (string), `error?` (string)
- [x] T004 [P] Add `CrawlRequest` interface to `app/types/crawler.ts` with fields: `session_id` (string), `google_maps_url` (string)
- [x] T005 [P] Add `CrawlResponse` interface to `app/types/crawler.ts` with fields: `success` (boolean), `data?` (BusinessData), `error?` (string)
- [x] T006 [P] Add `BusinessData` interface to `app/types/crawler.ts` with all optional fields: `name`, `address`, `phone`, `website`, `rating`, `reviews_count`, `hours` (Record<string, string>), `reviews` (Review[]), `menu` (Menu), `photos` (Photo[])
- [x] T007 [P] Add supporting interfaces to `app/types/crawler.ts`: `Review` (author, rating, text, date), `Menu` (categories: MenuCategory[]), `MenuCategory` (name, items: MenuItem[]), `MenuItem` (name, price?, description?), `Photo` (url, type?)
- [x] T008 [P] Add `GenerateContentRequest` interface to `app/types/crawler.ts` with field: `session_id` (string)
- [x] T009 [P] Add `GenerateContentResponse` interface to `app/types/crawler.ts` with fields: `success` (boolean), `session_id` (string), `data?` (GeneratedContent), `error?` (string)
- [x] T010 [P] Add `GeneratedContent` interface to `app/types/crawler.ts` with fields: `brandStrategy`, `visualAssets`, `businessIdentity`, `industryContext`, `reputationData?`, `contentSections`, `extractedData?`
- [x] T011 [P] Add `BrandStrategy` interface to `app/types/crawler.ts` with fields: `usp` (string), `targetAudience` (string), `toneOfVoice` (string), `visualStyle` (string)
- [x] T012 [P] Add `VisualAssets` interface to `app/types/crawler.ts` with fields: `colorPalette` (ColorPalette), `typography` (Typography), `logo?` (Logo)
- [x] T013 [P] Add `ColorPalette` interface to `app/types/crawler.ts` with fields: `primary`, `secondary`, `accent` (strings), `background`, `text` (string arrays)
- [x] T014 [P] Add `Typography` interface to `app/types/crawler.ts` with fields: `headingFont`, `bodyFont` (strings), `allFonts?` (string[])
- [x] T015 [P] Add `Logo` interface to `app/types/crawler.ts` with fields: `url`, `source` (strings), `description?` (string)
- [x] T016 [P] Add `BusinessIdentity` interface to `app/types/crawler.ts` with fields: `legalName?`, `displayName`, `tagline`, `description` (strings)
- [x] T017 [P] Add `IndustryContext` interface to `app/types/crawler.ts` with fields: `categories` (string[]), `pricingTier?` (string), `operationalHighlights?` (string[])
- [x] T018 [P] Add `ReputationData` interface to `app/types/crawler.ts` with fields: `reviewsCount` (number), `averageRating` (number), `trustBadges?` (string[])
- [x] T019 [P] Add `ContentSections` interface to `app/types/crawler.ts` with optional fields: `hero` (HeroSection), `about` (AboutSection), `products` (ProductsSection), plus index signature for additional sections
- [x] T020 [P] Add section interfaces to `app/types/crawler.ts`: `HeroSection` (heading, subheading?, images?), `AboutSection` (heading, content, images?), `ProductsSection` (heading, items: ProductItem[]), `ProductItem` (name, description?, image?), `GenericSection` (heading?, content?, images?)
- [x] T021 [P] Add `ExtractedData` interface to `app/types/crawler.ts` with optional fields: `allImages`, `instagramPosts`, `websiteUrl`, `pagesAnalyzed`
- [x] T022 Add barrel export statement at end of `app/types/crawler.ts` exporting all interfaces and types

**Checkpoint**: All TypeScript types defined. Run `pnpm run typecheck` to verify no errors.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Crawler client service that all user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T023 Create `app/lib/services/crawlerClient.server.ts` with file header comment explaining it's a server-only HTTP client for HuskIT/crawler API
- [x] T024 Add environment configuration constants to `app/lib/services/crawlerClient.server.ts`: `CRAWLER_API_URL` from `process.env.CRAWLER_API_URL` with fallback to `http://localhost:4999`, and `CRAWLER_TIMEOUT` constant set to `60_000` (60 seconds)
- [x] T025 Import logger from `~/utils/logger` in `app/lib/services/crawlerClient.server.ts` for consistent logging
- [x] T026 Implement private helper function `fetchWithTimeout` in `app/lib/services/crawlerClient.server.ts` that accepts (url: string, options: RequestInit, timeoutMs: number) and returns Promise<Response>, using AbortController for timeout handling. On timeout, throw error with message `Request timed out after ${timeoutMs}ms`
- [x] T027 Implement `extractBusinessData` function in `app/lib/services/crawlerClient.server.ts` that accepts (sessionId: string, googleMapsUrl: string), calls POST `/crawl` endpoint with JSON body `{session_id, google_maps_url}`, handles timeout and network errors gracefully, logs request/response, and returns `CrawlResponse` type
- [x] T028 Implement `generateWebsiteContent` function in `app/lib/services/crawlerClient.server.ts` that accepts (sessionId: string), calls POST `/generate-website-content` endpoint with JSON body `{session_id}`, handles timeout and network errors gracefully, logs request/response, and returns `GenerateContentResponse` type
- [x] T029 Add error handling wrapper in both functions to catch network errors and return `{success: false, error: "Crawler API unavailable"}` instead of throwing
- [x] T030 Export `extractBusinessData` and `generateWebsiteContent` functions from `app/lib/services/crawlerClient.server.ts`
- [x] T031 Extend `CreateProjectInput` interface in `app/types/project.ts` to include optional `session_id?: string` field for storing the crawler session ID
- [x] T032 Extend `ProjectWithDetails` interface in `app/types/project.ts` to ensure `business_profile` can store crawler data structure: `{session_id?, gmaps_url?, crawled_data?, generated_content?, crawled_at?}`

**Checkpoint**: Crawler client ready. Test with: `curl http://localhost:4999/health` to verify crawler API is accessible.

---

## Phase 3: User Story 1 - Extract Business Data from Google Maps (Priority: P1) 🎯 MVP

**Goal**: When user submits a Google Maps URL, automatically extract business data and display for confirmation

**Independent Test**: 
1. Open Create Project dialog
2. Enter business name and address
3. Paste a valid Google Maps URL
4. Verify extracted business data (name, address, phone, website) appears
5. Confirm data is editable before proceeding

### API Route for Extraction

- [x] T033 [US1] Create `app/routes/api.crawler.extract.ts` with file header comment explaining it proxies to crawler `/crawl` endpoint
- [x] T034 [US1] Import required dependencies in `app/routes/api.crawler.extract.ts`: `json` from `@remix-run/node`, `ActionFunctionArgs` type, `getSession` from auth, `extractBusinessData` from crawlerClient, `logger` from utils
- [x] T035 [US1] Implement `action` function in `app/routes/api.crawler.extract.ts` that only accepts POST method, returning 405 for other methods
- [x] T036 [US1] Add authentication check in `action` function: call `getSession(request)`, if no session or no user, return 401 JSON response with error code `UNAUTHORIZED`
- [x] T037 [US1] Parse JSON body in `action` function, validate required fields `session_id` (string) and `google_maps_url` (string), return 400 if missing or invalid
- [x] T038 [US1] Validate `google_maps_url` format using same validation logic from CreateProjectDialog (check hostname is google.com, maps.app.goo.gl, or goo.gl), return 400 with error `Invalid Google Maps URL format` if invalid
- [x] T039 [US1] Call `extractBusinessData(sessionId, googleMapsUrl)` in `action` function, catch any errors and return appropriate error response
- [x] T040 [US1] Handle timeout specifically: if error message contains "timed out", return 408 status with error code `CRAWLER_TIMEOUT` and user-friendly message `Data extraction timed out. Please try again or continue with manual entry.`
- [x] T041 [US1] Handle crawler unavailable: if error indicates network failure, return 502 status with error code `CRAWLER_UNAVAILABLE` and message `Unable to reach data extraction service. Please try again later.`
- [x] T042 [US1] Log extraction attempt with session_id and result (success/failure) using logger
- [x] T043 [US1] Return crawler response as JSON with appropriate status code (200 for success, preserve success:false responses from crawler)

### UI: Crawling Step

- [x] T044 [US1] Update `Step` type in `app/components/projects/CreateProjectDialog.tsx` to add `'crawling'` step between `'maps'` and `'confirm'`
- [x] T045 [US1] Add new state variables to CreateProjectDialog component: `sessionId` (initialized with `crypto.randomUUID()`), `crawledData` (BusinessData | null), `crawlError` (string | null), `isCrawling` (boolean)
- [x] T046 [US1] Import `BusinessData` type from `~/types/crawler` in CreateProjectDialog
- [x] T047 [US1] Modify `handleSubmitMaps` function to: set `isCrawling(true)`, set step to `'crawling'`, call `/api/crawler/extract` with fetch, passing sessionId and mapsUrl
- [x] T048 [US1] Add response handling in `handleSubmitMaps`: on success with data, set `crawledData` state and navigate to new `'review'` step; on failure, set `crawlError` with error message and navigate to `'mapsError'` step
- [x] T049 [US1] Create `'crawling'` step UI in CreateProjectDialog render: show DialogTitle "Extracting business data...", DialogDescription "Please wait while we gather information from Google Maps.", centered spinner animation, estimated time message "This usually takes 10-30 seconds"
- [x] T050 [US1] Add progress indicators to crawling step: show "Connecting to Google Maps..." initially, then "Extracting business information..." after 3 seconds, then "Almost done..." after 10 seconds using useEffect with timers

### UI: Review Step (Edit Extracted Data)

- [x] T051 [US1] Add `'review'` step to `Step` type in CreateProjectDialog (after 'crawling', before 'confirm')
- [x] T052 [US1] Add editable state variables for extracted data: `editedName`, `editedAddress`, `editedPhone`, `editedWebsite` - initialize from crawledData when entering review step
- [x] T053 [US1] Create `'review'` step UI with DialogTitle "Review your business information" and DialogDescription "We found the following details. Edit if needed."
- [x] T054 [US1] Add editable input fields in review step for: Business Name (required), Address (required), Phone (optional), Website URL (optional) - each with label, input, and optional validation error
- [x] T055 [US1] Add display section in review step for non-editable data if available: rating with star display, reviews count, operating hours (collapsed by default with expand toggle)
- [x] T056 [US1] Add "Website data unavailable" subtle notice in review step if crawledData exists but has no website field, with muted text styling
- [x] T057 [US1] Add button group in review step: "Continue" primary button (navigates to confirm with edited data), "Go Back" outline button (returns to maps step)
- [x] T058 [US1] Implement `handleContinueFromReview` function that validates edited fields (name and address required), updates businessName and businessAddress state from edited values, and navigates to 'confirm' step
- [x] T059 [US1] Update confirm step to show both user-edited data and any additional crawled data (rating, hours) in a summary view

### Error Handling UI

- [x] T060 [US1] Update `'mapsError'` step UI to show crawlError message when available (instead of generic message)
- [x] T061 [US1] Add "Try Again" button to mapsError step that clears crawlError and navigates back to 'maps' step
- [x] T062 [US1] Add "Continue with Manual Entry" button to mapsError step that clears crawlError, sets crawledData to null, and navigates to 'confirm' step with only user-provided data
- [x] T063 [US1] Add timeout-specific UI: when crawlError contains "timed out", show additional explanation "The data extraction is taking longer than expected. You can try again or proceed with the information you provided."

**Checkpoint**: US1 complete. Test: Enter business details → paste valid Google Maps URL → see extracted data → edit if needed → proceed to confirm.

---

## Phase 4: User Story 3 - Generate AI-Powered Website Content (Priority: P1)

**Goal**: After user confirms business data, call AI generation endpoint and save results to project

**Independent Test**:
1. Complete US1 flow (extract business data)
2. Confirm business information
3. See "Building your website" progress
4. Verify project is created with generated content stored
5. Check project has business_profile with generated_content field

**Note**: US3 is P1 priority but depends on US1 data extraction completing first

### API Route for Content Generation

- [x] T064 [US3] Create `app/routes/api.crawler.generate.ts` with file header comment explaining it proxies to crawler `/generate-website-content` endpoint
- [x] T065 [US3] Import required dependencies in `app/routes/api.crawler.generate.ts`: same pattern as api.crawler.extract.ts
- [x] T066 [US3] Implement `action` function in `app/routes/api.crawler.generate.ts` that only accepts POST method with 405 for others
- [x] T067 [US3] Add authentication check in action function, return 401 if no session
- [x] T068 [US3] Parse JSON body and validate required `session_id` field (string, non-empty), return 400 if invalid
- [x] T069 [US3] Call `generateWebsiteContent(sessionId)` from crawlerClient, handle errors appropriately
- [x] T070 [US3] Handle timeout: return 408 with user-friendly message about AI generation taking longer than expected
- [x] T071 [US3] Handle crawler unavailable: return 502 with appropriate message
- [x] T072 [US3] Log generation attempt and result using logger
- [x] T073 [US3] Return generator response as JSON with appropriate status code

### Update Project Creation with Generated Content

- [x] T074 [US3] Add `GeneratedContent` type import to `app/lib/services/projects.server.ts`
- [x] T075 [US3] Modify `createProject` function signature in `app/lib/services/projects.server.ts` to accept optional `businessProfile` parameter containing crawled and generated data
- [x] T076 [US3] Update project insert in `createProject` to include `business_profile` JSONB column if businessProfile data is provided
- [x] T077 [US3] Add type for businessProfile parameter: `{session_id?: string, gmaps_url?: string, crawled_data?: BusinessData, generated_content?: GeneratedContent, crawled_at?: string}`
- [x] T078 [US3] Update `app/routes/api.projects.ts` action to accept and pass through businessProfile from request body to createProject

### UI: Building Step Enhancement

- [x] T079 [US3] Add new state variables to CreateProjectDialog: `generatedContent` (GeneratedContent | null), `generationError` (string | null)
- [x] T080 [US3] Import `GeneratedContent` type from `~/types/crawler` in CreateProjectDialog
- [x] T081 [US3] Modify `handleConfirm` function to: first call `/api/crawler/generate` with sessionId if crawledData exists, then create project with all data
- [x] T082 [US3] Update handleConfirm to construct businessProfile object containing: session_id, gmaps_url (from mapsUrl), crawled_data (from crawledData state), generated_content (from generation response), crawled_at (current ISO timestamp)
- [x] T083 [US3] Update payload sent to onCreateProject to include businessProfile data
- [x] T084 [US3] Update 'building' step UI progress indicators to show AI generation progress: Step 1 "Analyzing business details" (complete after crawl), Step 2 "Generating layout & copy..." (during AI generation), Step 3 "Final polish & SEO check" (completing)
- [x] T085 [US3] Handle generation failure: set generationError, show error in building step with retry button
- [x] T086 [US3] Add useEffect in 'building' step to call generation API when step becomes active (if crawledData exists and generatedContent is null)

### Connect Frontend to Updated API

- [x] T087 [US3] Update `useProjects` hook in `app/lib/persistence/useProjects.ts` to accept optional businessProfile in createProject function
- [x] T088 [US3] Modify createProject in useProjects to include businessProfile in request body when provided
- [x] T089 [US3] Update `CreateProjectDialogProps` interface to pass through businessProfile to onCreateProject callback
- [x] T090 [US3] Ensure CreateProjectDialog passes businessProfile to onCreateProject when available

**Checkpoint**: US1 + US3 complete. Test: Full flow from Google Maps URL → extracted data → confirm → AI generation → project created with business_profile containing all data.

---

## Phase 5: User Story 2 - Website Crawling Indicator (Priority: P2)

**Goal**: Show user when website crawl succeeded/failed as part of data extraction feedback

**Independent Test**:
1. Provide Google Maps URL for business WITH website
2. Verify review step shows website was successfully crawled
3. Provide Google Maps URL for business WITHOUT website
4. Verify review step shows "Website data unavailable" notice

**Note**: Website crawling happens automatically in crawler service during /crawl call. This story adds visibility to user.

- [x] T091 [US2] Add `websiteCrawled` boolean state to CreateProjectDialog to track if website was successfully extracted
- [x] T092 [US2] Update response handling in handleSubmitMaps: set `websiteCrawled` to true if crawledData.website exists and is non-empty
- [x] T093 [US2] Add visual indicator in 'review' step: if websiteCrawled is true, show success badge "✓ Website content extracted" with green styling
- [x] T094 [US2] Add visual indicator in 'review' step: if websiteCrawled is false but crawledData exists, show info badge "ℹ No website found - using Google Maps data only" with muted styling
- [x] T095 [US2] Add tooltip or expand section in review step explaining what website crawling provides: "Website data helps generate more accurate content for your business including menu items, services, and about page text."

**Checkpoint**: US2 complete. Users now see clear feedback about website data availability.

---

## Phase 6: User Story 4 - Fallback to Manual Entry (Priority: P3)

**Goal**: Ensure users can always complete project creation even when crawler fails

**Independent Test**:
1. Disconnect crawler API (stop service)
2. Attempt to create project with Google Maps URL
3. Verify graceful error message
4. Click "Continue with Manual Entry"
5. Complete project creation successfully with only user-provided data

- [x] T096 [US4] Add `fallbackMode` boolean state to CreateProjectDialog to track when user chose manual entry fallback
- [x] T097 [US4] Update "Continue with Manual Entry" button in mapsError step to set fallbackMode to true
- [x] T098 [US4] When fallbackMode is true and reaching 'building' step, skip AI generation call entirely (no crawledData = no generated content)
- [x] T099 [US4] Update handleConfirm to check fallbackMode: if true, only pass basic project data to onCreateProject without businessProfile
- [x] T100 [US4] Add simpler 'building' step UI when in fallbackMode: show only "Creating your project..." without AI generation steps
- [x] T101 [US4] Update 'confirm' step when in fallbackMode: show notice "You'll be able to add more details after your project is created" to set expectations
- [x] T102 [US4] Ensure project creation works with minimal data: name and address only, no business_profile required
- [x] T103 [US4] Add logging in projects.server.ts to differentiate between projects created with full crawler data vs manual fallback

**Checkpoint**: US4 complete. Test by stopping crawler service and verifying graceful fallback to manual project creation.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements affecting multiple user stories

### Error Handling & Edge Cases

- [x] T104 [P] Add retry logic in crawlerClient.server.ts: retry failed requests up to 2 times with 1-second delay for transient errors (network timeouts, 5xx responses)
- [x] T105 [P] Handle partial data gracefully in review step: if only some fields are populated, don't show empty field inputs (e.g., skip phone input if phone is null)
- [x] T106 [P] Add client-side validation before submitting to /api/crawler/extract: verify Google Maps URL format matches expected patterns

### Loading States & UX

- [x] T107 [P] Add loading state to review step "Continue" button while navigating to prevent double-clicks
- [x] T108 [P] Disable "Go Back" button during API calls to prevent navigation during loading
- [x] T109 [P] Add subtle animation to crawling step progress indicators for better perceived performance

### Logging & Observability

- [x] T110 [P] Add structured logging in api.crawler.extract.ts: log session_id, url (sanitized), duration_ms, success/failure
- [x] T111 [P] Add structured logging in api.crawler.generate.ts: log session_id, duration_ms, success/failure
- [x] T112 [P] Add client-side error tracking: log extraction/generation failures to console with session ID for debugging

### Documentation

- [x] T113 [P] Update `.env.example` with all new environment variables and documentation
- [x] T114 [P] Run through quickstart.md validation steps to verify full flow works
- [x] T115 [P] Add inline code comments in CreateProjectDialog explaining each step transition

### Cleanup

- [x] T116 Remove any TODO comments added during development
- [x] T117 Run `pnpm run typecheck` to verify no TypeScript errors
- [x] T118 Run `pnpm run lint:fix` to fix any linting issues
- [x] T119 Review all new files for consistent import paths using `~/` prefix

**Checkpoint**: Feature complete and polished. Ready for code review.

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
    │
    ▼
Phase 2 (Foundational) ──────────────┐
    │                                │
    ▼                                ▼
Phase 3 (US1: Extract) ──────► Phase 4 (US3: Generate)
    │                                │
    ▼                                │
Phase 5 (US2: Website Indicator)     │
    │                                │
    ▼                                ▼
Phase 6 (US4: Fallback) ◄────────────┘
    │
    ▼
Phase 7 (Polish)
```

### User Story Dependencies

| Story | Depends On | Can Start After |
|-------|------------|-----------------|
| US1 (Extract) | Phase 2 complete | Phase 2 |
| US2 (Website) | US1 complete | US1 |
| US3 (Generate) | US1 complete | US1 |
| US4 (Fallback) | US1 + US3 complete | US3 |

### Within Each Phase

1. Tasks marked [P] can run in parallel
2. Type definitions before implementations
3. Server-side before client-side
4. Core functionality before error handling
5. Main flow before edge cases

### Parallel Opportunities

**Phase 1** (all [P] tasks can run in parallel):
- T002-T022 can all be written simultaneously as they're all in the same file with no dependencies

**Phase 3** (after T043):
- API route (T033-T043) and UI updates (T044-T063) can be developed in parallel by different developers

**Phase 7** (all [P] tasks can run in parallel):
- T104-T112 are independent improvements

---

## Parallel Example: Phase 1 Type Definitions

```bash
# All these can be created in parallel (different sections of same file):
T002: CrawlSessionStatus enum
T003: CrawlSession interface
T004: CrawlRequest interface
T005: CrawlResponse interface
T006: BusinessData interface
T007: Supporting interfaces (Review, Menu, MenuItem, Photo)
# ... and so on
```

---

## Parallel Example: Phase 3 API & UI

```bash
# Developer A: API Route
T033-T043: Create and implement api.crawler.extract.ts

# Developer B: UI Changes (can start after T044 type change)
T044-T063: Update CreateProjectDialog.tsx
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 3)

1. ✅ Complete Phase 1: Setup (types)
2. ✅ Complete Phase 2: Foundational (crawler client)
3. ✅ Complete Phase 3: User Story 1 (extraction + review)
4. ✅ Complete Phase 4: User Story 3 (AI generation)
5. **STOP and VALIDATE**: Test full extraction → generation flow
6. Deploy/demo MVP

### Incremental Delivery

| Increment | Delivers | User Value |
|-----------|----------|------------|
| MVP (US1+US3) | Extract + Generate | Core automation |
| +US2 | Website indicator | Better transparency |
| +US4 | Fallback mode | Never blocked |
| +Polish | Error handling, UX | Production ready |

### Suggested Order

```
Day 1: Phase 1 + Phase 2 (Foundation)
Day 2: Phase 3 (US1 - Extraction)  
Day 3: Phase 4 (US3 - Generation)
Day 4: Test MVP, then Phase 5 + 6 (US2 + US4)
Day 5: Phase 7 (Polish) + Final testing
```

---

## Notes

- [P] tasks = different files or independent code blocks, no dependencies
- [Story] label maps task to specific user story for traceability
- Session ID is generated once in CreateProjectDialog and reused for all crawler calls
- Crawler API caches by session_id, so retries are safe and fast
- All API routes require authentication (Better Auth session)
- 60-second timeout is enforced on all crawler calls
- Fallback to manual entry should always work even if crawler is completely unavailable
- Run `pnpm run typecheck` after each phase to catch type errors early

