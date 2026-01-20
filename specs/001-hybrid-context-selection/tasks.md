# Tasks: Hybrid Context Selection

**Feature**: 001-hybrid-context-selection
**Branch**: `001-hybrid-context-selection`
**Generated**: January 19, 2026
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

---

## Summary

| Metric | Value |
|--------|-------|
| Total Tasks | 42 |
| Setup Phase Tasks | 3 |
| Foundational Phase Tasks | 6 |
| User Story Tasks | 28 |
| Polish Phase Tasks | 5 |
| Parallel Opportunities | 18 |

### Task Distribution by User Story

| User Story | Priority | Tasks | Description |
|------------|----------|-------|-------------|
| US1 | P1 | 12 | Basic Website Editing with Accurate File Selection |
| US2 | P2 | 6 | Iterative Editing with Recently Edited File Boost |
| US3 | P3 | 5 | Specific Text Search via Grep Fallback |
| US4 | P3 | 5 | Chat History Context Awareness |

---

## Phase 1: Setup

**Goal**: Initialize project structure for context selection feature.

- [x] T001 Create context directory structure at `app/lib/.server/llm/context/`
- [x] T002 [P] Create `.gitkeep` placeholder in `app/lib/.server/llm/context/` to ensure directory is tracked
- [x] T003 [P] Verify TypeScript configuration includes new directory in `tsconfig.json`

---

## Phase 2: Foundational

**Goal**: Create shared types and constants that all user stories depend on.

**IMPORTANT**: All tasks in this phase MUST complete before any user story phase.

### Types and Interfaces

- [x] T004 Create `ContextOptions` interface in `app/lib/.server/llm/context/types.ts` with fields: `recentlyEdited?: string[]`, `chatHistory?: string[]`, `maxFiles?: number` per data-model.md specification
- [x] T005 [P] Create `ScoredFile` interface in `app/lib/.server/llm/context/types.ts` with fields: `path: string`, `score: number`, `signals?: string[]` for debugging
- [x] T006 [P] Create `BoostWeights` interface in `app/lib/.server/llm/context/types.ts` with configurable weights: `core: 10`, `recentlyEdited: 8`, `keywordMatch: 5`, `grepMatch: 5`, `chatMention: 3`
- [x] T007 Create `DEFAULT_BOOST_WEIGHTS` constant and `DEFAULT_MAX_FILES = 12` in `app/lib/.server/llm/context/types.ts`
- [x] T008 Create index file `app/lib/.server/llm/context/index.ts` that re-exports all types and future functions
- [x] T009 Add JSDoc comments to all interfaces in `app/lib/.server/llm/context/types.ts` documenting purpose, validation rules, and examples

---

## Phase 3: User Story 1 - Basic Website Editing with Accurate File Selection (P1)

**Goal**: Create core context selection function that selects correct files based on user query without LLM call.

**Independent Test**: Send edit request "change the header color" and verify Hero.tsx, Layout.tsx, index.css are selected without LLM call.

**Acceptance Criteria**:
- Function returns correct files for "change header color" query
- Core bundle files always included
- Keyword matching works for all defined keywords
- Returns sorted by score, limited to maxFiles
- Completes in under 100ms

### Core Patterns Configuration

- [x] T010 [US1] Create `CORE_PATTERNS` array in `app/lib/.server/llm/context/patterns.ts` with patterns: `['pages/', 'App.tsx', 'main.tsx', 'index.css', 'styles/', 'data/', 'Layout', 'Footer']` per research.md
- [x] T011 [P] [US1] Create `KEYWORD_MAP` record in `app/lib/.server/llm/context/patterns.ts` mapping 20+ keywords to file patterns: header→['Hero','Layout','Navbar'], hero→['Hero','Home'], menu→['Menu','MenuPreview','data/'], footer→['Footer'], about→['About','Story'], story→['Story','About'], color→['index.css','styles/','tailwind.config','guidelines/'], font→['index.css','styles/'], style→['index.css','styles/'], button→['Hero','ui/Button'], navigation→['Layout','Navbar'], logo→['Layout','Hero'], headline→['Hero'], banner→['Hero'], dish→['Menu','MenuPreview','data/'], food→['Menu','MenuPreview'], price→['Menu','MenuPreview','data/'], contact→['Footer','data/'], hours→['Footer','data/'], feature→['Feature'], service→['Feature'], background→['index.css','styles/'], theme→['styles/','guidelines/']
- [x] T012 [P] [US1] Add JSDoc comments to `patterns.ts` explaining pattern matching behavior: substring match, case-sensitive, extensible per template

### Core Scoring Algorithm

- [x] T013 [US1] Create `getContextFiles()` function signature in `app/lib/.server/llm/context/getContextFiles.ts` accepting `userMessage: string`, `allFiles: string[]`, `options?: ContextOptions` returning `string[]`
- [x] T014 [US1] Implement core bundle scoring (+10) in `getContextFiles()`: iterate allFiles, match against CORE_PATTERNS using `.includes()`, add score to Map<string, number>
- [x] T015 [US1] Implement keyword matching scoring (+5) in `getContextFiles()`: extract keywords from lowercased user message, look up KEYWORD_MAP, match file patterns against allFiles, accumulate scores
- [x] T016 [US1] Implement sorting and limiting in `getContextFiles()`: convert Map to array, filter score > 0, sort descending by score, slice to maxFiles (default 12), return file paths only
- [x] T017 [US1] Add logging using `createScopedLogger('context-selection')` in `getContextFiles()` to log selected file count and duration
- [x] T018 [US1] Export `getContextFiles` and `grepForSpecificText` (placeholder) from `app/lib/.server/llm/context/index.ts`

### Integration with selectContext

- [x] T019 [US1] Modify `app/lib/.server/llm/select-context.ts` to import `getContextFiles` from `./context/getContextFiles`
- [x] T020 [US1] Add optional `recentlyEdited?: string[]` parameter to `selectContext()` function props interface in `app/lib/.server/llm/select-context.ts`
- [x] T021 [US1] Replace LLM `generateText()` call (lines 128-183) with call to `getContextFiles(userQuery, allFiles, { recentlyEdited, chatHistory })` in `app/lib/.server/llm/select-context.ts`
- [x] T022 [US1] Remove XML parsing logic (lines 186-224) from `app/lib/.server/llm/select-context.ts` - no longer needed without LLM response
- [x] T023 [US1] Update `selectContext()` to build `filteredFiles: FileMap` from selected paths, mapping relative paths to full `/home/project/` paths in `app/lib/.server/llm/select-context.ts`
- [x] T024 [US1] Ensure `onFinish` callback is called with mock response object containing empty usage stats (for backward compatibility) in `app/lib/.server/llm/select-context.ts`

### Unit Tests for US1

- [x] T025 [US1] Create test file `app/lib/.server/llm/context/__tests__/getContextFiles.test.ts` with Vitest setup
- [x] T026 [P] [US1] Write test case: "selects Hero.tsx and index.css for 'change header color' query" in `getContextFiles.test.ts`
- [x] T027 [P] [US1] Write test case: "always includes core bundle files regardless of query" in `getContextFiles.test.ts`
- [x] T028 [P] [US1] Write test case: "limits results to maxFiles (default 12)" in `getContextFiles.test.ts`
- [x] T029 [P] [US1] Write test case: "returns empty array when allFiles is empty" in `getContextFiles.test.ts`
- [x] T030 [US1] Write test case: "completes selection in under 100ms for 30 files" (performance test) in `getContextFiles.test.ts`

---

## Phase 4: User Story 2 - Iterative Editing with Recently Edited File Boost (P2)

**Goal**: Prioritize files that were recently edited in the current chat session.

**Independent Test**: Edit Hero.tsx, then send "make it bolder" - Hero.tsx should be first in selected files.

**Acceptance Criteria**:
- Recently edited files receive +8 boost score
- Boost applies even when keywords don't match
- Works with empty recentlyEdited array (no boost applied)

### FilesStore Enhancement

- [x] T031 [US2] Add `getModifiedFilePaths(): string[]` method to `FilesStore` class in `app/lib/stores/files.ts` that returns `Array.from(this.#modifiedFiles.keys())`
- [x] T032 [US2] Export `getModifiedFilePaths` from workbenchStore facade in `app/lib/stores/workbench.ts` by delegating to `this.#filesStore.getModifiedFilePaths()`

### Recently Edited Boost Implementation

- [x] T033 [US2] Implement recentlyEdited boost (+8) in `getContextFiles()` in `app/lib/.server/llm/context/getContextFiles.ts`: iterate options.recentlyEdited, if file exists in allFiles, add +8 to its score

### API Integration

- [x] T034 [US2] Update `experimental_prepareRequestBody` in `app/components/chat/Chat.client.tsx` to include `recentlyEdited: workbenchStore.getModifiedFilePaths()` in request body
- [x] T035 [US2] Update `app/routes/api.chat.ts` to extract `recentlyEdited` from request body and pass to `selectContext()` call (line ~347)

### Unit Tests for US2

- [x] T036 [US2] Write test case: "boosts recently edited files by +8 score" in `getContextFiles.test.ts`
- [x] T037 [P] [US2] Write test case: "recently edited file appears first even with vague query 'make it better'" in `getContextFiles.test.ts`

---

## Phase 5: User Story 3 - Specific Text Search via Grep Fallback (P3)

**Goal**: Find files containing specific text (prices, colors, quoted strings) mentioned in user query.

**Independent Test**: Send "change $14 to $16" and verify system finds file containing "$14".

**Acceptance Criteria**:
- Extracts quoted strings, prices ($XX.XX), hex colors (#XXXXXX)
- Searches file contents for matches
- Matching files receive +5 boost
- Returns unique file paths

### Grep Function Implementation

- [x] T038 [US3] Create `grepForSpecificText()` function in `app/lib/.server/llm/context/grep.ts` accepting `userMessage: string`, `files: FileMap` returning `string[]`
- [x] T039 [US3] Implement pattern extraction in `grepForSpecificText()`: regex `/["']([^"']+)["']|#[0-9A-Fa-f]{3,6}|\$\d+(\.\d{2})?/g` to find quoted strings, hex colors, prices
- [x] T040 [US3] Implement file content search in `grepForSpecificText()`: iterate files, check `file.type === 'file'`, search `file.content.includes(pattern)`, collect matching paths, return unique array
- [x] T041 [US3] Integrate grep results in `selectContext()` in `app/lib/.server/llm/select-context.ts`: call `grepForSpecificText(userQuery, files)`, merge with `getContextFiles` results using `[...new Set([...selectedFiles, ...grepMatches])]`

### Unit Tests for US3

- [x] T042 [US3] Write test case: "finds file containing '$14' when query mentions price change" in `app/lib/.server/llm/context/__tests__/grep.test.ts`
- [x] T043 [P] [US3] Write test case: "finds file containing hex color '#21C6FF'" in `grep.test.ts`
- [x] T044 [P] [US3] Write test case: "extracts quoted strings from query" in `grep.test.ts`

---

## Phase 6: User Story 4 - Chat History Context Awareness (P3)

**Goal**: Boost files that were mentioned by name in previous chat messages.

**Independent Test**: Mention "Hero component" in chat, then ask "make it taller" - Hero.tsx should be selected.

**Acceptance Criteria**:
- Files mentioned by component name in chat history receive +3 boost
- Works with common names: Hero, Menu, Footer, etc.
- Only applies when file name appears in chat (substring match)

### Chat Mention Boost Implementation

- [x] T045 [US4] Implement chatHistory boost (+3) in `getContextFiles()` in `app/lib/.server/llm/context/getContextFiles.ts`: iterate options.chatHistory messages, for each file in allFiles extract basename without extension, check if any message includes basename (case-insensitive), add +3 boost
- [x] T046 [US4] Update `selectContext()` in `app/lib/.server/llm/select-context.ts` to extract chatHistory from messages: `messages.filter(m => m.role === 'user').map(m => extractTextContent(m))`

### Unit Tests for US4

- [x] T047 [US4] Write test case: "boosts Hero.tsx when 'Hero' mentioned in chat history" in `getContextFiles.test.ts`
- [x] T048 [P] [US4] Write test case: "applies +3 boost for each chat mention" in `getContextFiles.test.ts`
- [x] T049 [US4] Write test case: "case-insensitive matching for file mentions" in `getContextFiles.test.ts`

---

## Phase 7: Polish & Cross-Cutting Concerns

**Goal**: Final validation, documentation, and cleanup.

### Integration Testing

- [x] T050 Create integration test in `app/lib/.server/llm/__tests__/select-context.integration.test.ts` that tests full `selectContext()` flow with mock FileMap
- [x] T051 [P] Write integration test case: "selectContext returns FileMap without making LLM call"
- [x] T052 [P] Write integration test case: "selectContext completes in under 100ms"

### Performance Validation

- [x] T053 Add performance logging in `selectContext()` using `performance.now()` to measure and log total selection duration in `app/lib/.server/llm/select-context.ts`

### Cleanup

- [x] T054 Remove unused imports (`generateText`, LLM-related imports) from `app/lib/.server/llm/select-context.ts` after refactoring
- [x] T055 Run `pnpm lint:fix` to fix any linting issues in new files
- [x] T056 Run `pnpm typecheck` to verify no TypeScript errors
- [x] T057 Run `pnpm test` to verify all tests pass

---

## Dependency Graph

```
Phase 1 (Setup)
    │
    ▼
Phase 2 (Foundational) ─────────────────────────────────────────┐
    │                                                            │
    ▼                                                            │
Phase 3 (US1: Core Selection) ◄──── MUST COMPLETE FIRST ────────┤
    │                                                            │
    ├───────────────────┬───────────────────┐                    │
    ▼                   ▼                   ▼                    │
Phase 4 (US2)      Phase 5 (US3)      Phase 6 (US4)             │
(Recently Edited)  (Grep Fallback)   (Chat Mentions)             │
    │                   │                   │                    │
    └───────────────────┴───────────────────┘                    │
                        │                                        │
                        ▼                                        │
                Phase 7 (Polish) ◄───────────────────────────────┘
```

### User Story Dependencies

| User Story | Depends On | Can Run In Parallel With |
|------------|------------|--------------------------|
| US1 (P1) | Foundational | None (must complete first) |
| US2 (P2) | US1 | US3, US4 |
| US3 (P3) | US1 | US2, US4 |
| US4 (P3) | US1 | US2, US3 |

---

## Parallel Execution Examples

### Within Phase 3 (US1)

```
T010 (CORE_PATTERNS) ──┬──► T013 (getContextFiles signature)
T011 (KEYWORD_MAP)  ───┤
T012 (JSDoc)        ───┘
```

After T013:
```
T014 (core scoring) ──► T015 (keyword scoring) ──► T016 (sorting) ──► T017 (logging)
```

Tests can run in parallel:
```
T026 ─┬─► (parallel)
T027 ─┤
T028 ─┤
T029 ─┘
```

### Across User Stories (After US1 Complete)

```
US2 (T031-T037) ─┬─► (can run in parallel)
US3 (T038-T044) ─┤
US4 (T045-T049) ─┘
```

---

## Implementation Strategy

### MVP Scope (Recommended)

**Complete User Story 1 first** for a working MVP:

1. Core bundle pattern matching
2. Keyword-based file selection
3. Scoring and sorting
4. Integration with selectContext (replaces LLM call)

**Expected Outcome**:
- LLM calls reduced from 3 to 2
- Selection latency reduced from 2-5s to <100ms
- Basic file selection accuracy improved

### Incremental Delivery

| Increment | User Stories | Value Delivered |
|-----------|--------------|-----------------|
| 1 (MVP) | US1 | Core selection without LLM |
| 2 | US1 + US2 | Iterative editing support |
| 3 | US1 + US2 + US3 | Specific text search |
| 4 | All | Full feature with chat context |

---

## Verification Checklist

After all tasks complete, verify:

- [ ] `pnpm typecheck` passes with no errors
- [ ] `pnpm lint` passes with no errors
- [ ] `pnpm test` passes all tests
- [ ] `getContextFiles()` returns correct files for "change header color"
- [ ] Core bundle files always included in selection
- [ ] Recently edited files get +8 boost
- [ ] Grep finds "$14" in file contents
- [ ] Selection completes in <100ms
- [ ] `selectContext()` no longer makes LLM call
- [ ] Existing API interface preserved (backward compatible)

---

## Notes

1. **No TDD Required**: Tests are included as part of each user story phase but are not strictly TDD (test-first). Implement tests after or alongside implementation.

2. **Parallel Markers**: Tasks marked `[P]` can run in parallel with other `[P]` tasks in the same phase, provided dependencies are met.

3. **File Paths**: All file paths are absolute from repository root. The `app/` prefix indicates the main application source.

4. **Rollback**: If issues occur after deployment, revert `select-context.ts` to use LLM call and remove `app/lib/.server/llm/context/` directory.
