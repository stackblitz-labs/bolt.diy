# Research: Hybrid Context Selection

**Feature**: 001-hybrid-context-selection
**Date**: January 19, 2026
**Status**: Complete

## Executive Summary

Research confirms that the hybrid approach (core bundle + keyword matching) is the optimal solution for this codebase. The current implementation uses an LLM call that only sees file paths, causing poor selection accuracy. The proposed solution replaces this with a local function that can achieve 99% faster selection with better accuracy.

---

## Research Areas

### 1. Current Context Selection Architecture

**Decision**: Replace `selectContext()` LLM call with local `getContextFiles()` function

**Rationale**:
- Current implementation (`app/lib/.server/llm/select-context.ts`) makes an LLM call that only sees file paths, not content
- The LLM is asked to select max 5 files based solely on filenames
- This is fundamentally flawed: the LLM cannot know file contents or structure
- Latency: 2-5 seconds per call, ~4,000-8,000 tokens consumed

**Alternatives Considered**:

| Approach | Rejected Because |
|----------|------------------|
| Full BM25 index | Overkill for 20-30 file sites; adds complexity without proportional benefit |
| AST-based (Aider-style) | Requires tree-sitter, NetworkX; unnecessary for flat restaurant site structure |
| Embedding-based | Requires vector DB; semantic search doesn't improve on keyword matching for this domain |
| Agentic exploration (Claude Code-style) | Multiple LLM round-trips; higher latency and cost |

**Key Finding**: The existing `getFilePaths()` function (line 242-250 of select-context.ts) already extracts file paths and applies ignore patterns. We can build on this.

---

### 2. File Data Structures

**Decision**: Use existing `FileMap` type without modification

**Rationale**:
- `FileMap` is `Record<string, File | Folder | undefined>`
- `File` contains `{ type: 'file', content: string, isBinary: boolean, isLocked?: boolean }`
- File paths are absolute: `/home/project/src/pages/Home.tsx`
- Content is available for grep operations
- No schema changes needed

**Key Files**:
- Type definition: `app/lib/.server/llm/constants.ts` (lines 49-65)
- Store: `app/lib/stores/files.ts` (FilesStore class)
- API transport: `app/routes/api.chat.ts` (receives files in request body)

---

### 3. Recently Edited Files Tracking

**Decision**: Use existing `#modifiedFiles` Map from FilesStore, passed via API request

**Rationale**:
- `FilesStore.#modifiedFiles` already tracks files modified since last user message
- It stores `Map<filePath, originalContent>` - we only need the keys
- This aligns with the per-chat-session scope defined in clarifications
- No new persistence mechanism needed

**Implementation Approach**:
1. Add `recentlyEdited: string[]` to the API request body from Chat.client.tsx
2. Extract from `workbenchStore.getModifiedFiles()` or similar
3. Pass to `selectContext()` which delegates to `getContextFiles()`

**Alternative Considered**: Add timestamps to track "last 30 minutes" - rejected as per-session tracking is simpler and aligns with user story requirements.

---

### 4. Chat History Access for Mention Detection

**Decision**: Extract user messages from existing `messages` array

**Rationale**:
- Messages are already passed to `selectContext()` as `Message[]`
- Can filter for `role === 'user'` and extract text content
- `extractTextContent()` helper already exists (line 116-119 of select-context.ts)
- No new data structures needed

**Implementation Approach**:
```typescript
const chatHistory = messages
  .filter(m => m.role === 'user')
  .map(m => extractTextContent(m));
```

---

### 5. Restaurant Template File Structure

**Decision**: Define core patterns and keyword map based on typical React/Vite restaurant site structure

**Rationale**:
- Templates directory has placeholders only (no real templates yet)
- Improvement plan references [Chromaticstreet](https://github.com/neweb-learn/Chromaticstreet) as example
- Standard React + Vite structure with predictable component names

**Core Bundle Patterns** (always included):
```typescript
const CORE_PATTERNS = [
  'pages/',        // All page components
  'App.tsx',       // Main app entry
  'main.tsx',      // Vite entry point
  'index.css',     // Global styles
  'styles/',       // Style directory
  'data/',         // Data files (menu, info)
  'Layout',        // Layout component
  'Footer',        // Footer component
];
```

**Keyword Map** (section → files):
```typescript
const KEYWORD_MAP = {
  'header': ['Hero', 'Layout', 'Navbar'],
  'hero': ['Hero', 'Home'],
  'menu': ['Menu', 'MenuPreview', 'data/'],
  'footer': ['Footer'],
  'about': ['About', 'Story'],
  'contact': ['Footer', 'data/'],
  'color': ['index.css', 'styles/', 'tailwind.config'],
  'font': ['index.css', 'styles/'],
  // ... more mappings
};
```

---

### 6. Grep Fallback for Specific Text

**Decision**: Implement simple string search through file contents for quoted strings, prices, and hex colors

**Rationale**:
- Users often reference specific values: "$14", "#21C6FF", "Open 9am-10pm"
- These are unique identifiers that can be grepped
- FileMap already contains content - no additional data loading needed

**Implementation Approach**:
```typescript
// Extract patterns from user message
const patterns = userMessage.match(
  /["']([^"']+)["']|#[0-9A-Fa-f]{6}|\$\d+(\.\d{2})?/g
);

// Search file contents
for (const [path, file] of Object.entries(files)) {
  if (file?.type === 'file' && patterns.some(p => file.content.includes(p))) {
    matches.push(path);
  }
}
```

---

### 7. Scoring Algorithm

**Decision**: Use simple additive scoring with configurable weights

**Rationale**:
- No need for BM25 complexity (IDF, length normalization)
- Simple weights are interpretable and tunable
- Matches Aider's approach of boost multipliers

**Boost Weights**:

| Signal | Weight | Justification |
|--------|--------|---------------|
| Core Bundle | +10 | Always needed for context |
| Recently Edited | +8 | High relevance for follow-up edits |
| Keyword Match | +5 | Good signal, but not definitive |
| Grep Match | +5 | Specific text found |
| Chat Mentioned | +3 | Lower confidence, but useful |

**Formula**:
```
finalScore = sum of all applicable boosts
```

**Selection**: Sort by score descending, take top 10-15 files (configurable).

---

### 8. API Interface Compatibility

**Decision**: Preserve existing `selectContext()` function signature; modify implementation only

**Rationale**:
- FR-011 requires preserving existing API interface
- `api.chat.ts` calls `selectContext()` without changes (line 347-364)
- Return type remains `FileMap` (filtered files)

**Interface Preservation**:
```typescript
// Existing interface (unchanged)
export async function selectContext(props: {
  messages: Message[];
  env?: Env;
  apiKeys?: Record<string, string>;
  files: FileMap;
  providerSettings?: Record<string, IProviderSetting>;
  promptId?: string;
  contextOptimization?: boolean;
  summary: string;
  onFinish?: (resp: GenerateTextResult<...>) => void;
}): Promise<FileMap>

// New: Add optional recentlyEdited parameter
export async function selectContext(props: {
  // ... existing props ...
  recentlyEdited?: string[];  // NEW - optional for backward compatibility
}): Promise<FileMap>
```

---

### 9. Performance Requirements

**Decision**: Target <100ms for context selection (current: 2-5 seconds)

**Rationale**:
- FR-008 specifies <100ms latency
- Local function with simple string operations should be <20ms
- No network calls, no LLM inference
- grep fallback adds ~10-50ms for small file sets

**Benchmarks** (estimated):
- Core bundle matching: ~1ms
- Keyword matching: ~2ms
- Score calculation: ~1ms
- Grep (20-30 files): ~10-50ms
- **Total**: ~15-55ms (well under 100ms)

---

### 10. Error Handling and Edge Cases

**Decision**: Graceful fallback to core bundle if no matches found

**Rationale**:
- If keyword matching and grep return no results, core bundle ensures context is provided
- Better than throwing an error or returning empty
- Aligns with edge case in spec: "user's query contains no recognizable keywords"

**Edge Cases Handled**:

| Scenario | Handling |
|----------|----------|
| No keyword matches | Return core bundle only |
| No files in project | Return empty FileMap (caller handles) |
| All files ignored | Return empty FileMap |
| Score tie | Maintain original order (stable sort) |
| Too many matches (>15) | Truncate to max limit |

---

## File Structure for Implementation

```
app/lib/.server/llm/
├── context/                      # NEW DIRECTORY
│   ├── getContextFiles.ts        # Core function: scoring + selection
│   ├── patterns.ts               # CORE_PATTERNS and KEYWORD_MAP definitions
│   └── grep.ts                   # grepForSpecificText function
├── select-context.ts             # MODIFIED: use getContextFiles()
├── constants.ts                  # UNCHANGED: FileMap types
└── ...
```

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Keyword map incomplete | Medium | Medium | Add logging to identify missed keywords; easy to extend |
| Template structure varies | Low | Medium | Core patterns are broad; grep fallback catches edge cases |
| Performance regression | Low | High | Benchmark before/after; no network calls ensures speed |
| Recently edited tracking complex | Low | Medium | Use existing #modifiedFiles Map |

---

## Dependencies

**No new dependencies required**. Implementation uses:
- Existing `FileMap` type
- Existing `Message` type from `ai` package
- Standard JavaScript string operations
- Existing `ignore` package for pattern matching (already imported)

---

## Conclusion

The hybrid approach is well-suited for this codebase:
1. **Simple**: No new infrastructure (embeddings, indexes, AST parsing)
2. **Fast**: Local function, no LLM call, <100ms target achievable
3. **Accurate**: Core bundle + keyword + grep covers all common cases
4. **Maintainable**: Easy to extend keyword map, adjust weights
5. **Compatible**: Preserves existing API interface

Ready to proceed to Phase 1 (data model and contracts).
