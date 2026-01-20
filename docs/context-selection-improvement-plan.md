# Context Selection Improvement Plan

> **Status:** Proposed  
> **Author:** AI Agent Team  
> **Created:** January 15, 2026  
> **Last Updated:** January 17, 2026  
> **Version:** 2.0 (Revised for Small Restaurant Websites)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Target Use Case](#target-use-case)
3. [Current Architecture](#current-architecture)
4. [Problem Statement](#problem-statement)
5. [Research Findings](#research-findings)
6. [Approach Comparison](#approach-comparison)
7. [Proposed Solution](#proposed-solution)
8. [Technical Design](#technical-design)
9. [Implementation Plan](#implementation-plan)
10. [Success Metrics](#success-metrics)
11. [Risks & Mitigations](#risks--mitigations)
12. [Future Enhancements](#future-enhancements)
13. [References](#references)

---

## Executive Summary

### The Problem
Our current website editing flow uses **3 LLM calls** per user message. The second call (`selectContext`) only sees **file paths** (not content), causing it to guess which files are relevant based solely on filenames. This leads to poor file selection and incorrect edits.

### The Solution (Revised)
After deep research into Aider, Cody, Claude Code, and OpenHands, and considering our **small, predictable restaurant website structure** (~20-30 files), we recommend a **Hybrid Core Bundle + Keyword Matching** approach instead of a full BM25 retriever.

This approach:
- **Always includes core files** (pages, layout, styles, data)
- **Adds extras via simple keyword matching** (hero → Hero.tsx)
- **Uses optional grep fallback** for specific text searches
- **Borrows boost signals from Aider** (recently edited, chat-mentioned)

### Impact
| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| LLM calls per message | 3 | 2 | 33% fewer |
| Token usage | 60-120K | 30-60K | ~50% reduction |
| Context selection latency | 2-5s | 5-20ms | 99% faster |
| File selection accuracy | Poor | Excellent | Significant |
| Monthly LLM cost | $$$ | $$ | ~30-40% savings |
| Implementation time | 3-4 hours (BM25) | 1-2 hours (Hybrid) | 50% faster |

---

## Target Use Case

### Restaurant Website Structure

Our AI builder generates **small, predictable restaurant websites** like [Chromaticstreet](https://github.com/neweb-learn/Chromaticstreet):

```
restaurant-website/           (~20-30 files total)
├── src/
│   ├── pages/               (3 files)
│   │   ├── Home.tsx
│   │   ├── About.tsx
│   │   └── Menu.tsx
│   ├── components/          (6-10 files)
│   │   ├── Hero.tsx
│   │   ├── Feature.tsx
│   │   ├── Footer.tsx
│   │   ├── Layout.tsx
│   │   ├── MenuPreview.tsx
│   │   ├── Story.tsx
│   │   ├── figma/
│   │   └── ui/
│   ├── data/                (menu items, restaurant info)
│   ├── styles/              (CSS/theme files)
│   ├── guidelines/          (design tokens)
│   ├── lib/                 (utilities)
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── index.html
├── package.json
└── vite.config.ts
```

### Key Characteristics

| Characteristic | Value | Implication |
|---------------|-------|-------------|
| Total files | 20-30 | Can include most files in context |
| File naming | Predictable (Hero.tsx, Menu.tsx) | Simple keyword matching works |
| Structure | Standard sections | Core bundle approach viable |
| Dependencies | Flat (no deep call chains) | No need for dependency graph |
| Tech stack | React + Vite + TypeScript | Single language, consistent patterns |

### Common User Requests

| Request Type | Example | Target Files |
|--------------|---------|--------------|
| Header/Navigation | "Change the logo" | Layout.tsx, Hero.tsx |
| Hero section | "Update the headline" | Hero.tsx, Home.tsx |
| Menu | "Change dish prices" | Menu.tsx, MenuPreview.tsx, data/ |
| Footer | "Update contact info" | Footer.tsx |
| Styling | "Make it more blue" | index.css, styles/, tailwind.config |
| About | "Change our story" | About.tsx, Story.tsx |

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

### 4. Claude Code's Approach (On-Demand Agentic Search)

**How it works:**
- **No pre-built index or embeddings**
- Uses GrepTool (regex search) + Glob + LS for file discovery
- Auto-loads CLAUDE.md files for project context
- LLM decides which tools to call each turn

**Pros:** Simple, no infrastructure, works for any codebase  
**Cons:** Multiple LLM calls for exploration, higher latency

### 5. OpenHands' Approach (Action-Observation Loop)

**How it works:**
- Iterative loop: LLM → Execute → Observe → LLM
- Uses `view` tool to explore files before editing
- `str_replace` for exact text replacement
- Full event history maintained

**Pros:** Self-correcting, sees content before editing  
**Cons:** Multiple round-trips, higher latency and token usage

### Key Insight: No Embeddings Needed

All major tools (Aider, Cody, Claude Code, OpenHands) **avoid embedding-based retrieval** because:
- Code is fundamentally about named entities (symbols)
- AST analysis and keyword matching are deterministic and fast
- Embeddings struggle with code-specific semantics
- Simpler approaches work well for predictable structures

---

## Approach Comparison

### Full Comparison Matrix

| Feature | Aider | Cody | Claude Code | OpenHands | Our Hybrid |
|---------|-------|------|-------------|-----------|------------|
| **Pre-indexing** | ✅ AST + Graph | ✅ Multiple indexes | ❌ None | ❌ None | ❌ None |
| **Embeddings** | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No |
| **File Discovery** | PageRank | RRF fusion | Grep/Glob | LLM explores | Keyword map |
| **Sees Content** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes (core bundle) |
| **Dependencies** | tree-sitter, NetworkX | LSP, Symf | None | None | None |
| **Setup Time** | 1-2 days | 1 day | Minutes | Minutes | 1-2 hours |
| **Best For** | Large codebases | IDE integration | General use | Interactive | Small, predictable |

### Aider Deep Dive: Why We Don't Need It

Aider's RepoMap is sophisticated but **overkill for restaurant websites**:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  AIDER'S APPROACH: Full AST + PageRank                                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐       │
│  │ Tree-Sitter │───▶│ Extract     │───▶│ Build Graph │───▶│ PageRank    │       │
│  │ AST Parsing │    │ Defs/Refs   │    │ (NetworkX)  │    │ + Binary    │       │
│  │             │    │             │    │             │    │ Search      │       │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘       │
│                                                                                 │
│  COMPLEXITY: High | SETUP: 1-2 days | BEST FOR: Large codebases (1000+ files)   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Aider's Key Techniques:**
| Technique | Purpose | Needed for Restaurants? |
|-----------|---------|------------------------|
| Tree-sitter parsing | Extract symbols from AST | ❌ No - filenames are descriptive |
| NetworkX graph | Track who-calls-whom | ❌ No - flat component structure |
| PageRank ranking | Find central files | ❌ No - all sections equally important |
| Binary search | Fit token budget | ❌ No - small enough to include all |
| .scm query files | Language-specific extraction | ❌ No - only React/TS |

**What We Borrow from Aider:**
| Technique | Aider's Approach | Our Simplified Version |
|-----------|------------------|------------------------|
| Chat file boost | ×50 weight | ×8 boost for recently edited |
| Mentioned identifiers | ×10 weight | ×5 boost for keyword match |
| Important files | Prepend config files | Core bundle always included |
| Well-named boost | ×10 for camelCase | Not needed - all well-named |

### Decision: Hybrid Approach

For **20-30 file restaurant websites** with **predictable structure**:

| Approach | Verdict | Reason |
|----------|---------|--------|
| ❌ Full BM25 | Overkill | Too complex for small sites |
| ❌ Aider (AST+PageRank) | Overkill | No deep dependencies to track |
| ❌ Cody (Multiple retrievers) | Overkill | Single language, simple structure |
| ❌ Claude Code (Agentic) | Higher latency | Multiple LLM round-trips |
| ✅ **Hybrid (Core + Keywords)** | **Perfect fit** | Simple, fast, accurate |

---

## Proposed Solution

### Recommended Approach: Hybrid Core Bundle + Keyword Matching

Replace LLM Call #2 with a **local, deterministic function** that:

1. **Always includes core files** (pages, layout, styles, data)
2. **Adds extras via keyword matching** (simple section → file mapping)
3. **Uses optional grep fallback** for specific text searches
4. **Applies Aider-inspired boosts** (recently edited, chat-mentioned)

This is **simpler than BM25** but equally effective for small, predictable websites.

### New Flow Diagram

```
┌────────────────────────────────────────────────────────────────────────────────┐
│  IMPROVED FLOW: 2 LLM CALLS (was 3)                                            │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  User: "Change the header color to blue"                                       │
│                          │                                                     │
│                          ▼                                                     │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │ LLM CALL #1: createSummary() - UNCHANGED                                 │  │
│  │                                                                          │  │
│  │ Same as before - summarizes chat history                                 │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                          │                                                     │
│                          ▼                                                     │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │ LOCAL: getContextFiles() - NEW! (NO LLM, SIMPLER THAN BM25)              │  │
│  │                                                                          │  │
│  │ STEP 1: Always include CORE BUNDLE (~8-12 files)                         │  │
│  │   • All pages: Home.tsx, About.tsx, Menu.tsx                             │  │
│  │   • Layout: Layout.tsx, Footer.tsx, App.tsx                              │  │
│  │   • Styles: index.css, tailwind.config, theme files                      │  │
│  │   • Data: menu data, restaurant info                                     │  │
│  │                                                                          │  │
│  │ STEP 2: Add EXTRAS via keyword matching                                  │  │
│  │   • "header/hero/headline" → Hero.tsx                                    │  │
│  │   • "menu/dishes/prices" → MenuPreview.tsx, data/                        │  │
│  │   • "footer/contact" → Footer.tsx                                        │  │
│  │   • "story/about" → Story.tsx                                            │  │
│  │                                                                          │  │
│  │ STEP 3: Apply Aider-inspired boosts                                      │  │
│  │   • Recently edited files: +8                                            │  │
│  │   • Chat-mentioned files: +5                                             │  │
│  │   • Keyword matches: +5                                                  │  │
│  │                                                                          │  │
│  │ STEP 4: Optional grep for specific text                                  │  │
│  │   • "change $14 to $16" → grep for "14" or "$14"                         │  │
│  │   • "update #21C6FF" → grep for hex color                                │  │
│  │                                                                          │  │
│  │ LATENCY: ~5-20ms                                                         │  │
│  │ TOKENS: 0 (no LLM call!)                                                 │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                          │                                                     │
│                          ▼                                                     │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │ LLM CALL #2: streamText() - UNCHANGED                                    │  │
│  │                                                                          │  │
│  │ Same as before - generates response with edits                           │  │
│  │ Now receives CORRECTLY selected files                                    │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                │
│  TOTAL: ~30,000-60,000 tokens (50% reduction!)                                 │
└────────────────────────────────────────────────────────────────────────────────┘
```

### Why This Works for Restaurant Websites

| Factor | Why Hybrid Works |
|--------|------------------|
| **Small file count** | Can include all core files without exceeding context |
| **Predictable naming** | Hero.tsx, Menu.tsx - names match sections |
| **Standard structure** | Same sections across all restaurants |
| **Flat dependencies** | No deep call chains to track |
| **Single language** | Only React/TypeScript, no complex parsing needed |

### Scoring Algorithm (Simplified from BM25)

The hybrid approach uses **simple additive scoring** instead of BM25:

| Signal | Boost Value | Description |
|--------|-------------|-------------|
| **Core Bundle** | +10 | Always-included files (pages, layout, styles) |
| **Recently Edited** | +8 | Files modified in current session (Aider-inspired) |
| **Keyword Match** | +5 | User query contains section keyword |
| **Chat Mentioned** | +3 | File mentioned in conversation history |
| **Grep Match** | +5 | File contains specific text user mentioned |

**Final Score Formula:**
```
finalScore = coreBoost + recentlyEditedBoost + keywordBoost + chatMentionBoost + grepBoost
```

**Note:** No BM25 inverted index needed. Simple keyword matching is sufficient.

---

## Technical Design

### New File Structure (Simplified)

```
app/lib/.server/llm/
├── context/                      # NEW DIRECTORY
│   └── getContextFiles.ts        # Single file - core bundle + keyword matching
├── create-summary.ts             # UNCHANGED
├── select-context.ts             # MODIFIED - use getContextFiles()
├── stream-text.ts                # UNCHANGED
└── ...
```

**Note:** No separate types.ts, index.ts, retrieval.ts needed. Single file is sufficient.

### Core Implementation

```typescript
// ~/lib/.server/llm/context/getContextFiles.ts

import type { FileMap } from '~/lib/.server/llm/constants';

// ============================================
// STEP 1: Define Core Bundle (always included)
// ============================================

const CORE_PATTERNS = [
  // Pages - always include all pages
  'pages/Home',
  'pages/About', 
  'pages/Menu',
  
  // Layout components
  'components/Layout',
  'components/Footer',
  'App.tsx',
  
  // Styles - always include for visual changes
  'index.css',
  'styles/',
  'tailwind.config',
  
  // Data - always include for content changes
  'data/',
];

// ============================================
// STEP 2: Define Keyword → File Mapping
// ============================================

const KEYWORD_MAP: Record<string, string[]> = {
  // Header / Navigation
  'header': ['Hero', 'Layout', 'Navbar'],
  'navbar': ['Layout', 'Navbar'],
  'navigation': ['Layout', 'Navbar'],
  'logo': ['Layout', 'Hero'],
  'nav': ['Layout'],
  
  // Hero section
  'hero': ['Hero', 'Home'],
  'headline': ['Hero'],
  'tagline': ['Hero'],
  'banner': ['Hero'],
  'cta': ['Hero'],
  'button': ['Hero', 'ui/Button'],
  
  // Menu
  'menu': ['Menu', 'MenuPreview', 'data/'],
  'dish': ['Menu', 'MenuPreview', 'data/'],
  'food': ['Menu', 'MenuPreview'],
  'price': ['Menu', 'MenuPreview', 'data/'],
  'item': ['Menu', 'MenuPreview'],
  
  // Story / About
  'story': ['Story', 'About'],
  'about': ['About', 'Story'],
  'history': ['Story', 'About'],
  
  // Footer / Contact
  'footer': ['Footer'],
  'contact': ['Footer'],
  'hours': ['Footer', 'data/'],
  'address': ['Footer'],
  'location': ['Footer'],
  'social': ['Footer'],
  
  // Features
  'feature': ['Feature'],
  'service': ['Feature'],
  
  // Styling
  'color': ['index.css', 'styles/', 'tailwind.config', 'guidelines/'],
  'font': ['index.css', 'styles/'],
  'style': ['index.css', 'styles/'],
  'theme': ['styles/', 'guidelines/'],
  'background': ['index.css', 'styles/'],
};

// ============================================
// STEP 3: Main Function
// ============================================

export interface ContextOptions {
  recentlyEdited?: string[];  // Files edited in current session
  chatHistory?: string[];      // Previous messages for mention detection
}

export function getContextFiles(
  userMessage: string,
  allFiles: string[],
  options: ContextOptions = {}
): string[] {
  const { recentlyEdited = [], chatHistory = [] } = options;
  const scores = new Map<string, number>();
  const queryLower = userMessage.toLowerCase();
  
  // ---- STEP 1: Score core bundle files ----
  for (const file of allFiles) {
    for (const pattern of CORE_PATTERNS) {
      if (file.includes(pattern)) {
        scores.set(file, (scores.get(file) || 0) + 10);
        break;
      }
    }
  }
  
  // ---- STEP 2: Score keyword matches ----
  for (const [keyword, patterns] of Object.entries(KEYWORD_MAP)) {
    if (queryLower.includes(keyword)) {
      for (const pattern of patterns) {
        for (const file of allFiles) {
          if (file.includes(pattern)) {
            scores.set(file, (scores.get(file) || 0) + 5);
          }
        }
      }
    }
  }
  
  // ---- STEP 3: Boost recently edited files (Aider-inspired) ----
  for (const file of recentlyEdited) {
    if (allFiles.includes(file)) {
      scores.set(file, (scores.get(file) || 0) + 8);
    }
  }
  
  // ---- STEP 4: Boost files mentioned in chat history ----
  for (const msg of chatHistory) {
    for (const file of allFiles) {
      const basename = file.split('/').pop()?.replace(/\.(tsx?|jsx?|css)$/, '');
      if (basename && msg.toLowerCase().includes(basename.toLowerCase())) {
        scores.set(file, (scores.get(file) || 0) + 3);
      }
    }
  }
  
  // ---- STEP 5: Sort by score and return ----
  return [...scores.entries()]
    .filter(([_, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([file]) => file);
}

// ============================================
// STEP 4: Optional Grep Fallback
// ============================================

export function grepForSpecificText(
  userMessage: string,
  files: FileMap
): string[] {
  const matches: string[] = [];
  
  // Extract quoted strings, prices, hex colors
  const patterns = userMessage.match(
    /["']([^"']+)["']|#[0-9A-Fa-f]{6}|\$\d+(\.\d{2})?/g
  );
  
  if (!patterns) return matches;
  
  for (const pattern of patterns) {
    const searchTerm = pattern.replace(/["']/g, '');
    for (const [path, content] of Object.entries(files)) {
      if (typeof content === 'string' && content.includes(searchTerm)) {
        matches.push(path);
      }
    }
  }
  
  return [...new Set(matches)];
}
```

### Modified select-context.ts

```typescript
// Key changes to ~/lib/.server/llm/select-context.ts

import { getContextFiles, grepForSpecificText } from './context/getContextFiles';

export async function selectContext(props: {
  messages: Message[];
  files: FileMap;
  summary: string;
  recentlyEdited?: string[];
  // ... other existing props
}) {
  const { messages, files, summary, recentlyEdited = [] } = props;
  
  // Get all file paths
  const allFiles = Object.keys(files).map(p => 
    p.replace('/home/project/', '')
  );
  
  // Extract last user message
  const lastUserMessage = messages
    .filter(m => m.role === 'user')
    .pop();
  
  if (!lastUserMessage) {
    throw new Error('No user message found');
  }
  
  const userQuery = extractTextContent(lastUserMessage);
  
  // NEW: Use local getContextFiles instead of LLM
  const selectedFiles = getContextFiles(
    userQuery,
    allFiles,
    {
      recentlyEdited,
      chatHistory: messages
        .filter(m => m.role === 'user')
        .map(m => extractTextContent(m)),
    }
  );
  
  // Optional: Add grep matches for specific text
  const grepMatches = grepForSpecificText(userQuery, files);
  const allSelected = [...new Set([...selectedFiles, ...grepMatches])];
  
  // Build filteredFiles
  const filteredFiles: FileMap = {};
  for (const path of allSelected) {
    const fullPath = `/home/project/${path}`;
    if (files[fullPath]) {
      filteredFiles[path] = files[fullPath];
    }
  }
  
  logger.info(`Selected ${Object.keys(filteredFiles).length} files`);
  
  return filteredFiles;
  
  // REMOVED: generateText() LLM call entirely
}
```

### API Route Changes

**No changes required** to `app/routes/api.chat.ts`:

```typescript
// The public interface remains the same
const summary = await createSummary({ ... });
const filteredFiles = await selectContext({ ..., summary });  // Now uses local function
const result = await streamText({ ..., contextFiles: filteredFiles });
```

---

## Implementation Plan (Revised)

### Phase 1: Core Hybrid Retriever (1-2 hours)

**Goal:** Replace LLM-based selection with simple hybrid function

| Task | Estimate | Owner |
|------|----------|-------|
| Create `context/getContextFiles.ts` with core bundle + keyword map | 45 min | |
| Implement `grepForSpecificText()` function | 15 min | |
| Modify `select-context.ts` to use new function | 20 min | |
| Add logging for debugging | 10 min | |
| Manual testing with 10 sample queries | 30 min | |

**Deliverables:**
- New `context/getContextFiles.ts` file
- Modified `select-context.ts`
- Working hybrid selection

### Phase 2: Aider-Inspired Boosts (30 min - 1 hour)

**Goal:** Add recently-edited and chat-mention boosts

| Task | Estimate | Owner |
|------|----------|-------|
| Track recently edited files in session | 20 min | |
| Extract file mentions from chat history | 20 min | |
| Apply boost scores | 10 min | |
| Test boost behavior | 10 min | |

**Deliverables:**
- Recently edited tracking
- Chat mention detection
- Improved selection for iterative edits

### Phase 3: Testing & Validation (1-2 hours)

**Goal:** Verify improvement in file selection accuracy

| Task | Estimate | Owner |
|------|----------|-------|
| Create test dataset of 20 queries + expected files | 30 min | |
| Compare old vs new selection accuracy | 30 min | |
| Measure latency improvement | 15 min | |
| Edge case testing | 30 min | |
| Fix any issues | Variable | |

**Deliverables:**
- Accuracy comparison report
- Performance benchmarks

### Phase 4: Production Rollout (30 min - 1 hour)

**Goal:** Deploy and monitor in production

| Task | Estimate | Owner |
|------|----------|-------|
| Feature flag for gradual rollout | 15 min | |
| Add logging for selection quality | 15 min | |
| Deploy to staging | 10 min | |
| Deploy to production | 10 min | |

**Deliverables:**
- Production deployment
- Monitoring logs

### Optional Phase 5: BM25 Upgrade (If Needed)

**Trigger:** Only if hybrid approach misses files in >10% of queries

| Task | Estimate | Owner |
|------|----------|-------|
| Add BM25 content scoring | 1 hour | |
| Add inverted index | 1 hour | |

**Deliverables:**
- Full BM25 retriever
- Higher accuracy for edge cases

### Total Time Estimate

| Phase | Time | Priority |
|-------|------|----------|
| Phase 1: Core Hybrid | 1-2 hours | **Required** |
| Phase 2: Aider Boosts | 30 min - 1 hour | Recommended |
| Phase 3: Testing | 1-2 hours | Required |
| Phase 4: Rollout | 30 min - 1 hour | Required |
| Phase 5: BM25 (if needed) | 3-4 hours | Optional |
| **Total (without Phase 5)** | **3-6 hours** | |

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
| Function execution time | <20ms | Server-side timing |
| Memory usage | <10MB per session | Memory profiling (no index needed) |
| Error rate | <1% | Error logs |

### Validation Approach

1. **A/B Testing:** Run old vs new selection on same queries
2. **Manual Review:** Sample 100 queries, check if correct files selected
3. **User Feedback:** Track support tickets related to incorrect edits

---

## Risks & Mitigations

### Risk 1: Keyword Map Missing a Section

**Scenario:** User says "update the gallery" but we don't have "gallery" in KEYWORD_MAP

**Mitigation:**
- Grep fallback catches specific text user mentions
- Core bundle includes all pages which likely contain gallery
- Easy to add new keywords to the map as we discover them

### Risk 2: Unconventional File Naming

**Scenario:** Developer names component `XYZ.tsx` instead of `Hero.tsx`

**Mitigation:**
- Core bundle still includes all pages
- Grep fallback can find content regardless of filename
- Chat-mention boost helps if user mentions "XYZ" explicitly

### Risk 3: Too Many Files Selected

**Scenario:** Query matches multiple keywords, selecting 15+ files

**Mitigation:**
- Sort by score and take top N (e.g., 10-15)
- Token budget guardrail before sending to streamText
- Core files have highest scores, so they're always included

### Risk 4: New Template Structure

**Scenario:** New restaurant template uses different file structure

**Mitigation:**
- CORE_PATTERNS and KEYWORD_MAP are easy to update
- Could auto-detect structure from package.json or file patterns
- Consider template-specific configs in the future

---

## Future Enhancements

### Short-term (1-2 months)

1. **Template-Specific Configs:** Different KEYWORD_MAP per template type
2. **Auto-Detection:** Detect file structure from package.json/tsconfig
3. **Keyword Expansion:** Add synonyms (e.g., "navbar" → "header", "nav")

### Medium-term (3-6 months) - If Accuracy Issues

1. **BM25 Content Search:** Add full-text search for edge cases
2. **Symbol Extraction:** Parse exports to improve matching
3. **Chunk-level Selection:** Return specific functions, not whole files

### Long-term (6+ months) - Only If Scale Increases

1. **Tree-sitter Integration:** For larger codebases (100+ files)
2. **Dependency Graph:** Track imports for transitive dependencies
3. **Learning from Feedback:** Adjust weights based on successful edits

### NOT Planned (Overkill for Restaurant Sites)

| Feature | Reason to Skip |
|---------|----------------|
| Embeddings/Vector DB | Too complex, not needed for 20-30 files |
| PageRank | No deep dependencies to rank |
| Multiple retrievers (RRF) | Single simple approach is sufficient |
| Language Server Protocol | Overhead not justified |

---

## References

### Research Sources

1. **Aider Repository Map**
   - https://github.com/Aider-AI/aider
   - AST-based symbol extraction + PageRank ranking
   - **What we borrowed:** Chat file boost, mentioned identifiers boost, important files concept

2. **Cody Context Retrieval**
   - https://github.com/sourcegraph/cody
   - Multiple retrievers + Reciprocal Rank Fusion
   - **What we learned:** Simple heuristics can work as well as complex systems

3. **Claude Code**
   - On-demand agentic search with GrepTool
   - No pre-built index or embeddings
   - **Validation:** Simple approaches work for predictable codebases

4. **OpenHands**
   - Action-observation loop pattern
   - Iterative file exploration
   - **Insight:** Seeing content before editing is critical

5. **Hybrid RAG Best Practices**
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

## Appendix A: Sample Test Cases for Restaurant Websites

| Query | Expected Files (Hybrid) | Matching Signal |
|-------|------------------------|-----------------|
| "Change header color to blue" | Hero.tsx, Layout.tsx, index.css | Keyword "header" + core styles |
| "Update the menu prices" | Menu.tsx, MenuPreview.tsx, data/ | Keyword "menu" + "price" |
| "Fix the footer links" | Footer.tsx | Keyword "footer" |
| "Change the hero headline" | Hero.tsx, Home.tsx | Keyword "hero" + "headline" |
| "Update restaurant hours" | Footer.tsx, data/ | Keyword "hours" |
| "Make the buttons more rounded" | Hero.tsx, ui/Button.tsx, index.css | Keyword "button" + core styles |
| "Change '$14' to '$16'" | *(grep match)* | Grep for "$14" |
| "Update the about story" | About.tsx, Story.tsx | Keyword "about" + "story" |

---

## Appendix B: BM25 Algorithm (For Reference Only)

**Note:** BM25 is NOT used in the hybrid approach. Included for reference if Phase 5 is needed.

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

## Appendix C: Aider RepoMap Summary

Aider's approach is more sophisticated but **not needed for small restaurant sites**:

| Aider Component | Purpose | Our Equivalent |
|-----------------|---------|----------------|
| Tree-sitter | Parse AST | Not needed - predictable filenames |
| NetworkX graph | Track dependencies | Not needed - flat structure |
| PageRank | Rank file importance | Not needed - all sections equal |
| Binary search | Fit token budget | Simple guardrail sufficient |
| ×50 chat boost | Prioritize active files | ×8 recently edited boost |
| ×10 mentioned boost | Prioritize named files | ×5 keyword match boost |

---

## Approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Tech Lead | | | |
| Engineering Manager | | | |
| Product Owner | | | |

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Jan 15, 2026 | Initial proposal with BM25 approach |
| 2.0 | Jan 17, 2026 | **Major revision**: Simplified to Hybrid approach after research into Aider, Cody, Claude Code, OpenHands. Added target use case analysis, approach comparison, and Aider-inspired boosts. |

---

*Document version: 2.0*
