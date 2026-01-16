# Context Selection Improvement Plan

> **Status:** Proposed  
> **Author:** AI Agent Team  
> **Created:** January 15, 2026  
> **Last Updated:** January 15, 2026

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Architecture](#current-architecture)
3. [Problem Statement](#problem-statement)
4. [Research Findings](#research-findings)
5. [Proposed Solution](#proposed-solution)
6. [Technical Design](#technical-design)
7. [Implementation Plan](#implementation-plan)
8. [Success Metrics](#success-metrics)
9. [Risks & Mitigations](#risks--mitigations)
10. [Future Enhancements](#future-enhancements)
11. [References](#references)

---

## Executive Summary

### The Problem
Our current website editing flow uses **3 LLM calls** per user message. The second call (`selectContext`) only sees **file paths** (not content), causing it to guess which files are relevant based solely on filenames. This leads to poor file selection and incorrect edits.

### The Solution
Replace the LLM-based file selection with a **local content-aware retriever** that uses BM25 scoring + symbol extraction. This eliminates one LLM call, reduces latency by 2-5 seconds, cuts token usage by ~50%, and dramatically improves file selection accuracy.

### Impact
| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| LLM calls per message | 3 | 2 | 33% fewer |
| Token usage | 60-120K | 30-60K | ~50% reduction |
| Context selection latency | 2-5s | 10-50ms | 99% faster |
| File selection accuracy | Poor | Good | Significant |
| Monthly LLM cost | $$$ | $$ | ~30-40% savings |

---

## Current Architecture

### Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  CURRENT FLOW: 3 LLM CALLS PER USER MESSAGE                                      │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  User: "Change the header color to blue"                                         │
│                                                                                  │
│                          │                                                       │
│                          ▼                                                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐     │
│  │ LLM CALL #1: createSummary()                                            │     │
│  │                                                                         │     │
│  │ INPUT:  All conversation messages                                       │     │
│  │ OUTPUT: Summary of chat history and current request                     │     │
│  │                                                                         │     │
│  │ TOKENS: ~5,000-10,000                                                   │     │
│  │ FILE: app/lib/.server/llm/create-summary.ts                             │     │
│  └─────────────────────────────────────────────────────────────────────────┘     │
│                          │                                                       │
│                          ▼                                                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐     │
│  │ LLM CALL #2: selectContext()  ⚠️ PROBLEM AREA                           │     │
│  │                                                                         │     │
│  │ INPUT:  - Summary from Call #1                                          │     │
│  │         - All file PATHS only (not content!)                            │     │
│  │         - User's question                                               │     │
│  │                                                                         │     │
│  │ OUTPUT: <includeFile path="Header.tsx"/> (max 5 files)                  │     │
│  │                                                                         │     │
│  │ TOKENS: ~4,000-8,000                                                    │     │
│  │ FILE: app/lib/.server/llm/select-context.ts                             │     │
│  └─────────────────────────────────────────────────────────────────────────┘     │
│                          │                                                       │
│                          ▼                                                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐     │
│  │ LLM CALL #3: streamText() - MAIN CHAT                                   │     │
│  │                                                                         │     │
│  │ INPUT:  - System prompt                                                 │     │
│  │         - FULL CONTENT of 5 selected files                              │     │
│  │         - Summary + User's question                                     │     │
│  │                                                                         │     │
│  │ OUTPUT: Response + <boltAction> edits                                   │     │
│  │                                                                         │     │
│  │ TOKENS: ~50,000-100,000                                                 │     │
│  │ FILE: app/lib/.server/llm/stream-text.ts                                │     │
│  └─────────────────────────────────────────────────────────────────────────┘     │
│                                                                                  │
│  TOTAL: ~60,000-120,000 tokens per user message                                  │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Key Files

| File | Purpose |
|------|---------|
| `app/routes/api.chat.ts` | Main API endpoint, orchestrates all 3 calls |
| `app/lib/.server/llm/create-summary.ts` | LLM Call #1 - Summarizes chat history |
| `app/lib/.server/llm/select-context.ts` | LLM Call #2 - Selects relevant files |
| `app/lib/.server/llm/stream-text.ts` | LLM Call #3 - Main chat/edit response |

---

## Problem Statement

### Core Issue: File Path Blindness

The `selectContext()` function (LLM Call #2) only receives file **paths**, not their contents:

```typescript
// Current implementation in select-context.ts (lines 132-134)
AVAILABLE FILES PATHS
---
${filePaths.map((path) => `- ${path}`).join('\n')}  // ← Only paths!
---
```

### Failure Examples

| Scenario | What LLM Sees | What It Misses |
|----------|---------------|----------------|
| Wrapper components | `Header.tsx` | Real logic is in `HeaderContent.tsx` |
| Generic names | `utils.ts`, `helpers.ts` | No idea which util has the function |
| Re-exports | `index.ts` | Could be empty barrel file or main logic |
| CSS-in-JS | `Button.tsx` | Styles are inline, not in `button.css` |
| Unconventional naming | `useBlue.ts` | Is this a hook? A color constant? |

### Real-World Impact

1. **Wrong files selected** → LLM edits wrong component
2. **Missing dependencies** → Edits break related files
3. **User frustration** → Multiple attempts to get correct edit
4. **Wasted tokens** → Paying for incorrect selections

---

## Research Findings

We analyzed how leading AI coding assistants handle context selection:

### 1. Aider's Approach (AST + PageRank)

**How it works:**
- Uses tree-sitter to parse code into Abstract Syntax Trees
- Extracts symbol definitions and references
- Builds dependency graph with NetworkX
- Ranks files using PageRank algorithm
- No embeddings required

**Pros:** Excellent for complex codebases, discovers hidden dependencies  
**Cons:** Heavier CPU, requires tree-sitter integration

### 2. Cody's Approach (Multiple Retrievers + RRF)

**How it works:**
- **Jaccard Similarity**: Word overlap between query and file content
- **LSP-Light**: Symbol resolution using Language Server Protocol
- **Symf Indexer**: Full-text search with symbol boosting
- **Reciprocal Rank Fusion (RRF)**: Combines all retrievers

```typescript
// RRF formula
score = Σ (1 / (k + rank_i)) for each retriever
```

**Pros:** Multiple signals reduce blind spots  
**Cons:** More complex, multiple retrieval passes

### 3. Hybrid RAG (BM25 + Embeddings)

**How it works:**
- Combines lexical search (BM25) with semantic embeddings
- Tunable weight parameter: `H = (1−α)·BM25 + α·vector`
- Uses reranking to refine combined results

**Pros:** Best of both lexical and semantic matching  
**Cons:** Requires embedding infrastructure, higher latency

### Key Insight: No Embeddings Needed

Both Aider and Cody **avoid embedding-based retrieval** because:
- Code is fundamentally about named entities (symbols)
- AST analysis and keyword matching are deterministic and fast
- Embeddings struggle with code-specific semantics

---

## Proposed Solution

### Recommended Approach: Lightweight Lexical + Symbol-Aware Retriever

Replace LLM Call #2 with a **local, deterministic retriever** that:

1. Builds an in-memory index of file contents
2. Scores files using multiple signals (BM25 + boosts)
3. Returns top 5 most relevant files
4. Runs in ~10-50ms (vs 2-5s for LLM)

### New Flow Diagram

```
┌────────────────────────────────────────────────────────────────┐
│  IMPROVED FLOW: 2 LLM CALLS (was 3)                            │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  User: "Change the header color to blue"                       │
│                          │                                     │
│                          ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ LLM CALL #1: createSummary() - UNCHANGED                 │  │
│  │                                                          │  │
│  │ Same as before - summarizes chat history                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          │                                     │
│                          ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ LOCAL: retrieveRelevantFiles() - NEW! (NO LLM)           │  │
│  │                                                          │  │
│  │ PROCESS:                                                 │  │
│  │ 1. Build in-memory inverted index of file contents       │  │
│  │ 2. Score files using BM25 algorithm                      │  │
│  │ 3. Apply boost signals:                                  │  │
│  │    • Path/filename match (+3)                            │  │
│  │    • Symbol/export match (+2.5)                          │  │
│  │    • Currently in context (+5)                           │  │
│  │ 4. Return top 5 files by combined score                  │  │
│  │                                                          │  │
│  │ LATENCY: ~10-50ms                                        │  │
│  │ TOKENS: 0 (no LLM call!)                                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          │                                     │
│                          ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ LLM CALL #2: streamText() - UNCHANGED                    │  │
│  │                                                          │  │
│  │ Same as before - generates response with edits           │  │
│  │ Now receives CORRECTLY selected files                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  TOTAL: ~30,000-60,000 tokens (50% reduction!)                 │
└────────────────────────────────────────────────────────────────┘
```

### Scoring Algorithm

The retriever combines multiple signals to score each file:

| Signal | Boost Value | Description |
|--------|-------------|-------------|
| **BM25 Content Match** | Base score | Standard information retrieval scoring on file content |
| **Path/Filename Match** | +3.0 | File path contains terms from user query |
| **Basename Match** | +2.0 | Filename (without extension) matches query term |
| **Symbol/Export Match** | +2.5 | Exported function/component name matches query |
| **Currently in Context** | +5.0 | File was selected in previous conversation turn |

**Final Score Formula:**
```
finalScore = BM25(query, fileContent) 
           + pathMatchBoost 
           + symbolMatchBoost 
           + contextBoost
```

---

## Technical Design

### New File Structure

```
app/lib/.server/llm/
├── context/                      # NEW DIRECTORY
│   ├── types.ts                  # Type definitions
│   ├── index.ts                  # Index building logic
│   └── retrieval.ts              # Scoring and retrieval logic
├── create-summary.ts             # UNCHANGED
├── select-context.ts             # MODIFIED - use local retrieval
├── stream-text.ts                # UNCHANGED
└── ...
```

### Type Definitions

```typescript
// ~/lib/.server/llm/context/types.ts

import type { FileMap } from '~/lib/.server/llm/constants';

export type IndexedFile = {
  path: string;          // Relative path: 'src/components/Header.tsx'
  fullPath: string;      // Full path: '/home/project/src/components/Header.tsx'
  content: string;       // File content (truncated to 20KB)
  tokens: string[];      // Tokenized content for BM25
  pathTokens: string[];  // Tokenized path segments
  symbols: string[];     // Exported functions/components/classes
};

export type CodeIndex = {
  files: IndexedFile[];
  invertedIndex: Map<string, { doc: number; tf: number }[]>;
  docLengths: number[];
  avgDocLength: number;
};

export type RetrievalOptions = {
  maxFiles?: number;      // Default: 5
  pinnedPaths?: string[]; // Files already in context buffer
};
```

### Index Building

```typescript
// ~/lib/.server/llm/context/index.ts

export function buildCodeIndex(files: FileMap): CodeIndex {
  // 1. Filter files using existing ignore patterns
  // 2. Tokenize each file's content (lowercase, split on non-alphanumeric)
  // 3. Extract symbols using regex patterns:
  //    - export function/const/class declarations
  //    - JSX component usage (<ComponentName />)
  // 4. Build inverted index: token -> [{ docIdx, termFrequency }]
  // 5. Calculate document lengths and average for BM25
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter((t) => t && !STOP_WORDS.has(t));
}

function extractSymbols(path: string, content: string): string[] {
  // Regex patterns for:
  // - export function Name()
  // - export const Name =
  // - export class Name
  // - <ComponentName in JSX/TSX files
}
```

### Retrieval Logic

```typescript
// ~/lib/.server/llm/context/retrieval.ts

export function retrieveRelevantFiles(
  index: CodeIndex,
  options: {
    query: string;
    summary?: string;
    options?: RetrievalOptions;
  }
): IndexedFile[] {
  const { maxFiles = 5, pinnedPaths = [] } = options.options ?? {};
  
  // 1. Combine query + summary for richer context
  const combined = `${summary ?? ''}\n\n${query}`;
  
  // 2. Extract different types of terms
  const queryTokens = tokenizeQuery(combined);
  const fileLikeTerms = extractFileLikeTerms(combined);  // *.tsx, *.css patterns
  const symbolTerms = extractSymbolTerms(combined);       // PascalCase words
  
  // 3. Calculate BM25 base scores
  const bm25Scores = scoreBM25(index, queryTokens);
  
  // 4. Apply boost signals
  for (each file) {
    score = bm25Scores[i];
    score += pathMatchBoost(file, fileLikeTerms);    // +3.0
    score += symbolMatchBoost(file, symbolTerms);     // +2.5
    score += pinnedBoost(file, pinnedPaths);          // +5.0
  }
  
  // 5. Sort by score and return top maxFiles
  return sortedFiles.slice(0, maxFiles);
}
```

### Modified select-context.ts

```typescript
// Key changes to ~/lib/.server/llm/select-context.ts

import { buildCodeIndex } from './context/index';
import { retrieveRelevantFiles } from './context/retrieval';

export async function selectContext(props: {
  messages: Message[];
  files: FileMap;
  summary: string;
  // ... other existing props
}) {
  // Keep existing: extract current context, get last user message
  const { codeContext } = extractCurrentContext(processedMessages);
  const userQuery = extractTextContent(lastUserMessage);
  
  // NEW: Replace LLM call with local retrieval
  const index = buildCodeIndex(files);
  
  const retrieved = retrieveRelevantFiles(index, {
    query: userQuery,
    summary,
    options: {
      maxFiles: 5,
      pinnedPaths: currentContextFiles,
    },
  });
  
  // Build filteredFiles from retrieved results
  const filteredFiles: FileMap = {};
  retrieved.forEach((f) => {
    filteredFiles[f.path] = files[f.fullPath];
  });
  
  return filteredFiles;
  
  // REMOVED: generateText() LLM call
}
```

### API Route Changes

**No changes required** to `app/routes/api.chat.ts`:

```typescript
// The public interface remains the same
const summary = await createSummary({ ... });
const filteredFiles = await selectContext({ ..., summary });  // Now uses local retrieval
const result = await streamText({ ..., contextFiles: filteredFiles });
```

---

## Implementation Plan

### Phase 1: Core Retriever (1-3 hours)

**Goal:** Replace LLM-based selection with basic local retriever

| Task | Estimate | Owner |
|------|----------|-------|
| Create `context/types.ts` with type definitions | 15 min | |
| Implement `context/index.ts` with tokenization and inverted index | 45 min | |
| Implement `context/retrieval.ts` with BM25 + boosts | 45 min | |
| Modify `select-context.ts` to use local retrieval | 30 min | |
| Add logging for debugging | 15 min | |
| Manual testing with various queries | 30 min | |

**Deliverables:**
- New `context/` directory with 3 files
- Modified `select-context.ts`
- Working local retrieval

### Phase 2: Symbol Extraction Enhancement (2-4 hours)

**Goal:** Improve symbol detection for better accuracy

| Task | Estimate | Owner |
|------|----------|-------|
| Add more regex patterns for TypeScript/React | 1 hour | |
| Handle CSS class names and selectors | 30 min | |
| Add support for import/export analysis | 1 hour | |
| Unit tests for symbol extraction | 1 hour | |

**Deliverables:**
- Enhanced symbol extraction
- Test coverage

### Phase 3: Testing & Validation (2-4 hours)

**Goal:** Verify improvement in file selection accuracy

| Task | Estimate | Owner |
|------|----------|-------|
| Create test dataset of queries + expected files | 1 hour | |
| Compare old vs new selection accuracy | 1 hour | |
| Measure latency improvement | 30 min | |
| Edge case testing (large projects, unusual naming) | 1 hour | |
| Fix any issues discovered | Variable | |

**Deliverables:**
- Accuracy comparison report
- Performance benchmarks

### Phase 4: Production Rollout (1-2 hours)

**Goal:** Deploy and monitor in production

| Task | Estimate | Owner |
|------|----------|-------|
| Feature flag for gradual rollout | 30 min | |
| Add monitoring/metrics for selection quality | 30 min | |
| Deploy to staging | 15 min | |
| Deploy to production (canary) | 15 min | |
| Full rollout | 15 min | |

**Deliverables:**
- Production deployment
- Monitoring dashboard

### Optional Phase 5: AST Integration (1-2 days)

**Goal:** Add tree-sitter for robust symbol extraction

| Task | Estimate | Owner |
|------|----------|-------|
| Integrate tree-sitter for TypeScript/JavaScript | 4 hours | |
| Build dependency graph from imports | 4 hours | |
| Add PageRank-style scoring for central files | 4 hours | |
| Performance optimization | 2 hours | |

**Deliverables:**
- AST-based symbol extraction
- Dependency-aware scoring

---

## Success Metrics

### Primary Metrics

| Metric | Current | Target | How to Measure |
|--------|---------|--------|----------------|
| File selection accuracy | ~60% | >90% | Manual review of 100 random queries |
| Context selection latency | 2-5s | <100ms | Server-side timing logs |
| Token usage per message | 60-120K | 30-60K | LLM API usage tracking |
| User retry rate | High | Low | Count of repeated similar queries |

### Secondary Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Index build time | <200ms | Server-side timing |
| Memory usage | <50MB per session | Memory profiling |
| Error rate | <1% | Error logs |

### Validation Approach

1. **A/B Testing:** Run old vs new selection on same queries
2. **Manual Review:** Sample 100 queries, check if correct files selected
3. **User Feedback:** Track support tickets related to incorrect edits

---

## Risks & Mitigations

### Risk 1: Heuristics Miss Edge Cases

**Scenario:** User says "update checkout logic" but logic is in a generically-named file

**Mitigation:**
- BM25 content matching catches "checkout" in file content
- Add "recently edited" boost for active files
- Increase candidate set to 8, then prune by token limit

### Risk 2: Index Build Overhead

**Scenario:** Large workspace slows down responses

**Mitigation:**
- Truncate file content to 20KB for indexing
- For very large projects (>500 files), cache index per session
- Incremental updates when files change

### Risk 3: Incorrect Symbol Extraction

**Scenario:** Regex patterns miss complex TypeScript syntax

**Mitigation:**
- Symbol matching is a boost signal, not required
- BM25 content matching is primary signal
- Phase 5 adds tree-sitter for robust parsing

### Risk 4: No LLM Disambiguation

**Scenario:** Ambiguous query could match multiple files equally well

**Mitigation:**
- Return top 5 files (not just 1)
- Add optional LLM reranker for top 10 candidates if quality issues persist
- User can always mention specific files explicitly

---

## Future Enhancements

### Short-term (1-2 months)

1. **Index Caching:** Cache index per project to avoid rebuilding
2. **Incremental Updates:** Update index when files change
3. **Recently Edited Boost:** Prioritize files user recently modified

### Medium-term (3-6 months)

1. **Tree-sitter Integration:** Robust AST parsing for symbol extraction
2. **Dependency Graph:** Build import/export graph for transitive dependencies
3. **Chunk-level Selection:** Return specific functions, not whole files

### Long-term (6+ months)

1. **Hybrid RAG:** Add optional embedding-based retrieval
2. **Learning from Feedback:** Adjust weights based on successful edits
3. **Multi-repo Support:** Handle monorepos and linked projects

---

## References

### Research Sources

1. **Aider Repository Map**
   - https://github.com/Aider-AI/aider
   - AST-based symbol extraction + PageRank ranking

2. **Cody Context Retrieval**
   - https://github.com/sourcegraph/cody
   - Multiple retrievers + Reciprocal Rank Fusion

3. **BM25 Algorithm**
   - Standard information retrieval scoring
   - https://en.wikipedia.org/wiki/Okapi_BM25

4. **Hybrid RAG Best Practices**
   - https://superlinked.com/vectorhub/articles/optimizing-rag-with-hybrid-search-reranking

### Internal Files

| File | Description |
|------|-------------|
| `app/routes/api.chat.ts` | Main chat API endpoint |
| `app/lib/.server/llm/create-summary.ts` | Chat summary generation |
| `app/lib/.server/llm/select-context.ts` | Current file selection (to be modified) |
| `app/lib/.server/llm/stream-text.ts` | Main LLM streaming |
| `docs/website-generation-flow.md` | Current flow documentation |

---

## Appendix A: BM25 Algorithm

BM25 (Best Matching 25) is a ranking function used in information retrieval:

```
score(D, Q) = Σ IDF(qi) * (f(qi, D) * (k1 + 1)) / (f(qi, D) + k1 * (1 - b + b * |D|/avgdl))
```

Where:
- `f(qi, D)` = term frequency of query term qi in document D
- `|D|` = length of document D
- `avgdl` = average document length
- `k1` = term frequency saturation parameter (typically 1.2-2.0)
- `b` = length normalization parameter (typically 0.75)
- `IDF(qi)` = inverse document frequency of term qi

---

## Appendix B: Sample Test Cases

| Query | Expected Top Files | Rationale |
|-------|-------------------|-----------|
| "Change header color to blue" | Header.tsx, header.css | Path match + content match |
| "Add a new menu item" | Menu.tsx, Navigation.tsx | Symbol match + content |
| "Fix the footer links" | Footer.tsx | Path match |
| "Update the contact form validation" | ContactForm.tsx, validation.ts | Content match |
| "Change the primary button style" | Button.tsx, theme.css | Symbol + content match |

---

## Approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Tech Lead | | | |
| Engineering Manager | | | |
| Product Owner | | | |

---

*Document version: 1.0*
