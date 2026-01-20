# API Contracts: Hybrid Context Selection

**Feature**: 001-hybrid-context-selection
**Date**: January 19, 2026
**Type**: Internal TypeScript Interfaces

---

## Overview

This feature modifies internal function interfaces. No new REST API endpoints are created. The existing `selectContext()` function signature is preserved with optional new parameters.

---

## 1. getContextFiles (NEW)

**Location**: `app/lib/.server/llm/context/getContextFiles.ts`

**Purpose**: Core function that selects relevant files based on user query without LLM.

### Function Signature

```typescript
export interface ContextOptions {
  /** File paths edited in current chat session */
  recentlyEdited?: string[];

  /** Previous user messages for mention detection */
  chatHistory?: string[];

  /** Maximum files to return (default: 12, max: 30) */
  maxFiles?: number;
}

export interface ScoredFile {
  /** Absolute file path */
  path: string;

  /** Computed relevance score */
  score: number;

  /** Debug: signals that contributed to score */
  signals?: string[];
}

/**
 * Selects context files based on user query and scoring signals.
 *
 * @param userMessage - The user's current request/query
 * @param allFiles - Array of all available file paths
 * @param options - Configuration options
 * @returns Array of file paths sorted by relevance score
 */
export function getContextFiles(
  userMessage: string,
  allFiles: string[],
  options?: ContextOptions
): string[];
```

### Behavior

| Input | Output |
|-------|--------|
| Valid query with matches | Sorted file paths (max: options.maxFiles) |
| Query with no keyword matches | Core bundle files only |
| Empty query | Core bundle files only |
| Empty allFiles array | Empty array |

### Performance

- **Latency**: <20ms for typical 20-30 file projects
- **Memory**: O(n) where n = number of files

---

## 2. grepForSpecificText (NEW)

**Location**: `app/lib/.server/llm/context/grep.ts`

**Purpose**: Finds files containing specific text mentioned in user query.

### Function Signature

```typescript
import type { FileMap } from '../constants';

/**
 * Searches file contents for specific text patterns from user query.
 * Extracts quoted strings, prices ($XX.XX), and hex colors (#XXXXXX).
 *
 * @param userMessage - The user's current request
 * @param files - FileMap with file contents
 * @returns Array of file paths containing matched text
 */
export function grepForSpecificText(
  userMessage: string,
  files: FileMap
): string[];
```

### Pattern Extraction

Extracts these patterns from user message:
- Quoted strings: `"hello"` or `'world'`
- Prices: `$14`, `$14.99`
- Hex colors: `#21C6FF`, `#fff`

### Performance

- **Latency**: 10-50ms for 20-30 files
- **Memory**: O(1) - streaming search

---

## 3. selectContext (MODIFIED)

**Location**: `app/lib/.server/llm/select-context.ts`

**Purpose**: Existing function - implementation changes, interface preserved.

### Current Signature (Preserved)

```typescript
export async function selectContext(props: {
  messages: Message[];
  env?: Env;
  apiKeys?: Record<string, string>;
  files: FileMap;
  providerSettings?: Record<string, IProviderSetting>;
  promptId?: string;
  contextOptimization?: boolean;
  summary: string;
  onFinish?: (resp: GenerateTextResult<Record<string, CoreTool<any, any>>, never>) => void;
}): Promise<FileMap>;
```

### New Optional Parameter

```typescript
export async function selectContext(props: {
  // ... existing props (unchanged) ...

  /** NEW: Files edited in current session for boost scoring */
  recentlyEdited?: string[];
}): Promise<FileMap>;
```

### Behavior Change

| Before | After |
|--------|-------|
| Makes LLM call with file paths | Calls local getContextFiles() |
| Returns max 5 files | Returns 10-15 files (configurable) |
| 2-5 second latency | <100ms latency |
| Parses XML response | No parsing needed |

### Backward Compatibility

- All existing callers continue to work
- `onFinish` callback receives mock response (no actual LLM call)
- `recentlyEdited` is optional - defaults to empty array

---

## 4. API Chat Route (UNCHANGED)

**Location**: `app/routes/api.chat.ts`

**Current Call** (lines 347-364):
```typescript
filteredFiles = await selectContext({
  messages: [...processedMessages],
  env: context.cloudflare?.env,
  apiKeys,
  files,
  providerSettings,
  promptId,
  contextOptimization,
  summary,
  onFinish(resp) { /* token tracking */ },
});
```

**After Enhancement** (optional):
```typescript
filteredFiles = await selectContext({
  // ... existing props ...
  recentlyEdited: request.recentlyEdited ?? [], // NEW
});
```

---

## 5. Chat Request Body (ENHANCED)

**Location**: `app/components/chat/Chat.client.tsx`

**Current** (lines 186-204):
```typescript
experimental_prepareRequestBody: ({ messages }) => ({
  messages,
  apiKeys,
  files,
  promptId,
  contextOptimization: contextOptimizationEnabled,
  chatMode,
  designScheme,
  restaurantThemeId: restaurantThemeIdRef.current,
})
```

**After Enhancement**:
```typescript
experimental_prepareRequestBody: ({ messages }) => ({
  // ... existing fields ...
  recentlyEdited: workbenchStore.getModifiedFilePaths(), // NEW
})
```

---

## Type Definitions Summary

```typescript
// New types to add in app/lib/.server/llm/context/types.ts

export interface ContextOptions {
  recentlyEdited?: string[];
  chatHistory?: string[];
  maxFiles?: number;
}

export interface ScoredFile {
  path: string;
  score: number;
  signals?: string[];
}

export interface BoostWeights {
  core: number;
  recentlyEdited: number;
  keywordMatch: number;
  grepMatch: number;
  chatMention: number;
}

export const DEFAULT_BOOST_WEIGHTS: BoostWeights = {
  core: 10,
  recentlyEdited: 8,
  keywordMatch: 5,
  grepMatch: 5,
  chatMention: 3,
};

export const DEFAULT_MAX_FILES = 12;
```

---

## Error Handling

| Error Condition | Handling | HTTP Status |
|-----------------|----------|-------------|
| No files in project | Return empty FileMap | N/A (internal) |
| Invalid file path | Skip and continue | N/A |
| Empty user message | Return core bundle only | N/A |
| Score calculation error | Log and use 0 | N/A |

---

## Logging

New log points (using existing `createScopedLogger`):

```typescript
const logger = createScopedLogger('context-selection');

logger.info(`Selected ${files.length} files in ${duration}ms`);
logger.debug(`Scores: ${JSON.stringify(scores)}`);
logger.warn(`Keyword not found: ${keyword}`);
```

---

## Metrics (Future)

Recommended metrics for observability:
- `context_selection_duration_ms` - Time to select files
- `context_selection_file_count` - Number of files selected
- `context_selection_core_only` - Boolean: only core bundle returned
- `context_selection_grep_matches` - Number of grep matches
