# Implementation Plan: SEARCH/REPLACE Edit Actions

> **Document Status:** Ready for Implementation  
> **Related Spec:** [copy-edit-grep-ast-solution.md](./copy-edit-grep-ast-solution.md)  
> **Estimated Effort:** 7-10 days (Phase 1), +3-5 days (Phase 2 AST)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Complete Flow Overview](#2-complete-flow-overview)
3. [Prerequisites & Setup](#3-prerequisites--setup)
4. [Phase 1: Core Implementation](#4-phase-1-core-implementation)
5. [Phase 2: AST Enhancement (Optional)](#5-phase-2-ast-enhancement-optional)
6. [Testing Strategy](#6-testing-strategy)
7. [Rollout Plan](#7-rollout-plan)
8. [Success Metrics](#8-success-metrics)

---

## 1. Executive Summary

This plan adds Aider-style SEARCH/REPLACE editing to the website-agent, enabling:
- **Template-based website generation** with automatic customization via targeted edits
- **50-70% token reduction** for both initial generation and incremental changes
- **Multi-strategy matching**: exact → whitespace-normalized → fuzzy
- **Graceful error handling** with user-visible feedback

### The "Copy and Edit" Approach

```
┌─────────────────────────────────────────────────────────────────────┐
│  User: "Create a Chinese restaurant website called Dragon Palace"  │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  1. TEMPLATE SELECTION (Existing)                                   │
│     LLM picks "Bamboo Bistro" template                              │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  2. TEMPLATE LOADING (Existing)                                     │
│     Fetch files from GitHub → Mount to WebContainer                 │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  3. AUTO-CUSTOMIZATION (NEW - uses SEARCH/REPLACE)                  │
│     LLM generates targeted edits:                                   │
│     - Change "Bamboo Bistro" → "Dragon Palace"                      │
│     - Update menu items, colors, branding                           │
│     - Customize contact info, hours, etc.                           │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  4. USER SEES CUSTOMIZED WEBSITE                                    │
│     Ready for further iteration                                     │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  5. USER ITERATION (uses SEARCH/REPLACE)                            │
│     User: "Change the hero background to red"                       │
│     LLM: Generates single targeted edit                             │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| `EditAction` extends `BaseAction` with raw content only | Matches streaming parser accumulation pattern |
| Parse blocks at runtime in `edit-parser.ts` | Separation of concerns; wire type stays simple |
| Treat `type="edit"` as non-streaming | Edit blocks are atomic; no partial application |
| Multi-strategy matching without AST in Phase 1 | Covers 90%+ of cases; AST adds complexity |
| Use edits for BOTH initial customization AND user iterations | Consistent approach, maximum token savings |

---

## 2. Complete Flow Overview

### 2.1 Current Architecture (What Exists)

The current flow for website generation:

| Step | Component | File | What Happens |
|------|-----------|------|--------------|
| 1 | Template Selection | `selectStarterTemplate.ts` | LLM picks best template for user request |
| 2 | Fetch Files | `getTemplates()` | Downloads template files from GitHub |
| 3 | Mount Files | `Chat.client.tsx` | Injects files as `<boltAction type="file">` in assistant message |
| 4 | Trigger LLM | `reload()` | Sends conversation with template + user request to LLM |
| 5 | LLM Customizes | `api.chat.ts` | LLM generates **full file rewrites** to customize template |
| 6 | Apply Changes | `action-runner.ts` | Writes files to WebContainer |

**Problem with current approach:**
- Step 5 generates **entire files** even for small customizations
- High token usage (template file can be 500+ lines, LLM rewrites all)
- Risk of unintended changes to other parts of the file

### 2.2 New Architecture (What We're Building)

| Step | Component | Change |
|------|-----------|--------|
| 1-4 | Same | No changes |
| 5 | LLM Customizes | Generates `<boltAction type="edit">` with SEARCH/REPLACE blocks |
| 6 | Apply Changes | `action-runner.ts` parses blocks, applies targeted edits |

**Benefits:**
- 50-70% fewer tokens for customization
- Only changed lines are modified
- Predictable, reviewable changes

### 2.3 File Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                     INITIAL GENERATION FLOW                          │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  User Request: "Create Dragon Palace restaurant website"            │
│       │                                                              │
│       ▼                                                              │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ selectStarterTemplate() → "Bamboo Bistro"                   │    │
│  └─────────────────────────────────────────────────────────────┘    │
│       │                                                              │
│       ▼                                                              │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ getTemplates() → Fetch from GitHub                          │    │
│  │   Returns: { assistantMessage, userMessage }                │    │
│  │   - assistantMessage: <boltArtifact> with all template files│    │
│  │   - userMessage: "customize for original request"           │    │
│  └─────────────────────────────────────────────────────────────┘    │
│       │                                                              │
│       ▼                                                              │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Chat.client.tsx: setMessages() + reload()                   │    │
│  │   Triggers LLM with template context                        │    │
│  └─────────────────────────────────────────────────────────────┘    │
│       │                                                              │
│       ▼                                                              │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ LLM Response (NEW BEHAVIOR):                                │    │
│  │                                                              │    │
│  │   <boltArtifact title="Customize Restaurant">               │    │
│  │     <boltAction type="edit">                                │    │
│  │     src/components/Hero.tsx                                 │    │
│  │     <<<<<<< SEARCH                                          │    │
│  │     <h1>Bamboo Bistro</h1>                                  │    │
│  │     =======                                                  │    │
│  │     <h1>Dragon Palace</h1>                                  │    │
│  │     >>>>>>> REPLACE                                          │    │
│  │     </boltAction>                                            │    │
│  │     <boltAction type="edit">                                │    │
│  │     src/config/restaurant.ts                                │    │
│  │     <<<<<<< SEARCH                                          │    │
│  │     name: "Bamboo Bistro"                                   │    │
│  │     =======                                                  │    │
│  │     name: "Dragon Palace"                                   │    │
│  │     >>>>>>> REPLACE                                          │    │
│  │     </boltAction>                                            │    │
│  │   </boltArtifact>                                            │    │
│  └─────────────────────────────────────────────────────────────┘    │
│       │                                                              │
│       ▼                                                              │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ action-runner.ts: #runEditAction()                          │    │
│  │   - Parse SEARCH/REPLACE blocks                             │    │
│  │   - Match in existing files                                  │    │
│  │   - Apply targeted changes                                   │    │
│  │   - Write updated files                                      │    │
│  └─────────────────────────────────────────────────────────────┘    │
│       │                                                              │
│       ▼                                                              │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ USER SEES: Fully customized "Dragon Palace" website         │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                     USER ITERATION FLOW                              │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  User: "Change the hero background to red"                          │
│       │                                                              │
│       ▼                                                              │
│  LLM generates single SEARCH/REPLACE edit                           │
│       │                                                              │
│       ▼                                                              │
│  action-runner.ts applies edit                                      │
│       │                                                              │
│       ▼                                                              │
│  User sees updated website                                          │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.4 What Changes vs What Stays the Same

| Component | Status | Notes |
|-----------|--------|-------|
| `selectStarterTemplate.ts` | ✅ No change | Template selection works as-is |
| `getTemplates()` | ✅ No change | GitHub fetching works as-is |
| `Chat.client.tsx` | ✅ No change | Message injection works as-is |
| `api.chat.ts` | ✅ No change | Streaming works as-is |
| `stream-text.ts` | ⚠️ Minor update | Update prompt guidance |
| `prompts.ts` | ⚠️ Update | Add SEARCH/REPLACE instructions |
| `message-parser.ts` | ⚠️ Update | Handle `type="edit"` |
| `action-runner.ts` | ⚠️ Update | Add `#runEditAction()` |
| `edit-parser.ts` | 🆕 New file | Parse and apply SEARCH/REPLACE |

---

## 3. Prerequisites & Setup

### 3.1 Codebase Understanding

Before starting, review these files:

| File | Purpose |
|------|---------|
| `app/types/actions.ts` | Action type definitions |
| `app/lib/runtime/message-parser.ts` | Streaming XML parser for boltAction tags |
| `app/lib/runtime/action-runner.ts` | Action execution with serial queue |
| `app/lib/runtime/message-parser.spec.ts` | Existing test patterns |
| `app/lib/common/prompts/prompts.ts` | System prompt structure |

### 3.2 Development Environment

```bash
# Ensure tests run
pnpm test

# Run specific test file
pnpm exec vitest run app/lib/runtime/message-parser.spec.ts

# Type checking
pnpm run typecheck
```

### 3.3 Branch Strategy

```bash
git checkout -b feature/edit-actions
```

---

## 4. Phase 1: Core Implementation

### Task 1.1: Extend Action Types (2-3 hours)

**File:** `app/types/actions.ts`

**Changes:**

```typescript
// 1. Update ActionType to include 'edit'
export type ActionType = 'file' | 'shell' | 'supabase' | 'edit';

// 2. Add EditAction interface (extends BaseAction, no parsed fields)
export interface EditAction extends BaseAction {
  type: 'edit';
  // content: inherited from BaseAction - contains raw SEARCH/REPLACE blocks
}

// 3. Update BoltAction union
export type BoltAction = 
  | FileAction 
  | ShellAction 
  | StartAction 
  | BuildAction 
  | SupabaseAction 
  | EditAction;
```

**Acceptance Criteria:**
- [ ] TypeScript compiles without errors
- [ ] No breaking changes to existing action handlers
- [ ] `EditAction` only has `type` and inherited `content` fields

---

### Task 1.2: Create Edit Block Parser (1-2 days)

**File:** `app/lib/runtime/edit-parser.ts`

**Types:**

```typescript
/**
 * Represents a single SEARCH/REPLACE edit block
 */
export interface EditBlock {
  filePath: string;
  searchContent: string;
  replaceContent: string;
  lineNumber?: number; // For error reporting
}

/**
 * Result of parsing raw edit action content
 */
export interface ParseResult {
  blocks: EditBlock[];
  errors: string[]; // Non-fatal parse warnings
}

/**
 * Result of applying a single edit to file content
 */
export interface EditApplyResult {
  success: boolean;
  newContent: string;
  strategy: 'exact' | 'normalized' | 'fuzzy' | 'failed';
  error?: string;
}
```

**Core Functions:**

```typescript
/**
 * Parse raw SEARCH/REPLACE content into structured edit blocks
 * 
 * Expected format:
 * ```
 * path/to/file.tsx
 * <<<<<<< SEARCH
 * existing code
 * =======
 * replacement code
 * >>>>>>> REPLACE
 * ```
 */
export function parseEditBlocks(raw: string): ParseResult {
  const blocks: EditBlock[] = [];
  const errors: string[] = [];
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  
  let i = 0;
  while (i < lines.length) {
    // Skip blank lines
    while (i < lines.length && !lines[i].trim()) i++;
    if (i >= lines.length) break;
    
    // Look for file path line followed by <<<<<<< SEARCH
    const potentialPath = lines[i].trim();
    const nextLine = lines[i + 1]?.trim();
    
    if (!potentialPath || !nextLine?.startsWith('<<<<<<< SEARCH')) {
      i++;
      continue;
    }
    
    const filePath = potentialPath;
    const searchStart = i + 2;
    let dividerIndex = -1;
    let replaceEnd = -1;
    
    // Find ======= divider
    for (let j = searchStart; j < lines.length; j++) {
      if (lines[j].trim().startsWith('=======')) {
        dividerIndex = j;
        break;
      }
    }
    
    if (dividerIndex === -1) {
      errors.push(`Missing ======= divider for block at line ${i + 1}`);
      i++;
      continue;
    }
    
    // Find >>>>>>> REPLACE
    for (let j = dividerIndex + 1; j < lines.length; j++) {
      if (lines[j].trim().startsWith('>>>>>>> REPLACE')) {
        replaceEnd = j;
        break;
      }
    }
    
    if (replaceEnd === -1) {
      errors.push(`Missing >>>>>>> REPLACE for block at line ${i + 1}`);
      i = dividerIndex + 1;
      continue;
    }
    
    const searchContent = lines.slice(searchStart, dividerIndex).join('\n');
    const replaceContent = lines.slice(dividerIndex + 1, replaceEnd).join('\n');
    
    blocks.push({
      filePath: filePath.startsWith('/') ? filePath : `/${filePath}`,
      searchContent,
      replaceContent,
      lineNumber: i + 1,
    });
    
    i = replaceEnd + 1;
  }
  
  return { blocks, errors };
}

/**
 * Apply a single edit block to file content using multi-strategy matching
 * Strategy order: exact → whitespace-normalized → fuzzy
 */
export function applyEdit(
  fileContent: string,
  edit: EditBlock
): EditApplyResult {
  // Handle empty SEARCH (new file or append)
  if (edit.searchContent.trim() === '') {
    return {
      success: true,
      newContent: edit.replaceContent,
      strategy: 'exact',
    };
  }
  
  // Strategy 1: Exact match
  if (fileContent.includes(edit.searchContent)) {
    return {
      success: true,
      newContent: fileContent.replace(edit.searchContent, edit.replaceContent),
      strategy: 'exact',
    };
  }
  
  // Strategy 2: Whitespace-normalized match
  const normalizedResult = normalizedReplace(fileContent, edit);
  if (normalizedResult) {
    return {
      success: true,
      newContent: normalizedResult,
      strategy: 'normalized',
    };
  }
  
  // Strategy 3: Fuzzy line-based match
  const fuzzyResult = fuzzyReplace(fileContent, edit);
  if (fuzzyResult) {
    return {
      success: true,
      newContent: fuzzyResult,
      strategy: 'fuzzy',
    };
  }
  
  return {
    success: false,
    newContent: fileContent,
    strategy: 'failed',
    error: `Could not find matching code in file`,
  };
}

/**
 * Whitespace-normalized matching
 * Handles trailing spaces, inconsistent indentation
 */
function normalizedReplace(
  fileContent: string,
  edit: EditBlock
): string | null {
  const normalize = (s: string) => 
    s.split('\n').map(line => line.trimEnd()).join('\n');
  
  const normalizedFile = normalize(fileContent);
  const normalizedSearch = normalize(edit.searchContent);
  
  if (!normalizedFile.includes(normalizedSearch)) {
    return null;
  }
  
  // Find the actual position in original content using line matching
  const searchLines = edit.searchContent.split('\n');
  const fileLines = fileContent.split('\n');
  
  for (let i = 0; i <= fileLines.length - searchLines.length; i++) {
    let match = true;
    for (let j = 0; j < searchLines.length; j++) {
      if (fileLines[i + j].trimEnd() !== searchLines[j].trimEnd()) {
        match = false;
        break;
      }
    }
    
    if (match) {
      // Preserve original indentation of first line
      const originalIndent = fileLines[i].match(/^(\s*)/)?.[1] || '';
      const replaceLines = edit.replaceContent.split('\n');
      const searchIndent = searchLines[0].match(/^(\s*)/)?.[1] || '';
      
      // Adjust replacement indentation to match original
      const adjustedReplace = replaceLines.map((line, idx) => {
        if (idx === 0) {
          return originalIndent + line.trimStart();
        }
        // Maintain relative indentation for other lines
        const lineIndent = line.match(/^(\s*)/)?.[1] || '';
        const relativeIndent = lineIndent.length - searchIndent.length;
        const newIndent = originalIndent + ' '.repeat(Math.max(0, relativeIndent));
        return newIndent + line.trimStart();
      });
      
      const newLines = [
        ...fileLines.slice(0, i),
        ...adjustedReplace,
        ...fileLines.slice(i + searchLines.length),
      ];
      
      return newLines.join('\n');
    }
  }
  
  return null;
}

/**
 * Fuzzy line-based matching with similarity threshold
 * Uses simple Levenshtein-like comparison
 */
function fuzzyReplace(
  fileContent: string,
  edit: EditBlock,
  threshold: number = 0.85
): string | null {
  const searchLines = edit.searchContent.split('\n');
  const fileLines = fileContent.split('\n');
  
  if (searchLines.length === 0) return null;
  
  let bestMatch = { index: -1, similarity: 0 };
  
  for (let i = 0; i <= fileLines.length - searchLines.length; i++) {
    const windowLines = fileLines.slice(i, i + searchLines.length);
    const similarity = calculateSimilarity(
      windowLines.join('\n'),
      edit.searchContent
    );
    
    if (similarity > bestMatch.similarity) {
      bestMatch = { index: i, similarity };
    }
  }
  
  if (bestMatch.similarity < threshold || bestMatch.index === -1) {
    return null;
  }
  
  // Only apply if this is the unique best match
  let matchCount = 0;
  for (let i = 0; i <= fileLines.length - searchLines.length; i++) {
    const windowLines = fileLines.slice(i, i + searchLines.length);
    const similarity = calculateSimilarity(
      windowLines.join('\n'),
      edit.searchContent
    );
    if (similarity >= threshold) matchCount++;
  }
  
  if (matchCount > 1) {
    // Multiple matches - don't apply to avoid ambiguity
    return null;
  }
  
  const newLines = [
    ...fileLines.slice(0, bestMatch.index),
    ...edit.replaceContent.split('\n'),
    ...fileLines.slice(bestMatch.index + searchLines.length),
  ];
  
  return newLines.join('\n');
}

/**
 * Simple similarity calculation (0-1 range)
 */
function calculateSimilarity(a: string, b: string): number {
  const normalize = (s: string) => 
    s.toLowerCase().replace(/\s+/g, ' ').trim();
  
  const na = normalize(a);
  const nb = normalize(b);
  
  if (na === nb) return 1;
  if (na.length === 0 || nb.length === 0) return 0;
  
  // Simple character-based similarity
  const longer = na.length > nb.length ? na : nb;
  const shorter = na.length > nb.length ? nb : na;
  
  let matches = 0;
  for (let i = 0; i < shorter.length; i++) {
    if (shorter[i] === longer[i]) matches++;
  }
  
  return matches / longer.length;
}

/**
 * Sort edits for safe application (bottom-up to preserve line numbers)
 */
export function sortEditsForApplication(
  edits: EditBlock[],
  fileContent: string
): EditBlock[] {
  const editsWithPosition = edits.map(edit => {
    const index = fileContent.indexOf(edit.searchContent);
    const lineNumber = index === -1 
      ? Infinity 
      : fileContent.slice(0, index).split('\n').length;
    return { edit, lineNumber };
  });
  
  // Sort descending by line number (apply bottom-up)
  editsWithPosition.sort((a, b) => b.lineNumber - a.lineNumber);
  
  return editsWithPosition.map(e => e.edit);
}

/**
 * Group edits by target file path
 */
export function groupEditsByFile(
  blocks: EditBlock[]
): Map<string, EditBlock[]> {
  const map = new Map<string, EditBlock[]>();
  
  for (const block of blocks) {
    const existing = map.get(block.filePath) ?? [];
    existing.push(block);
    map.set(block.filePath, existing);
  }
  
  return map;
}
```

**Acceptance Criteria:**
- [ ] `parseEditBlocks` correctly parses single and multiple blocks
- [ ] Malformed blocks are skipped with errors logged (not thrown)
- [ ] `applyEdit` returns correct strategy for each match type
- [ ] Fuzzy matching only applies when unique match found
- [ ] Edits are sorted bottom-up for safe multi-edit application

---

### Task 1.3: Update Message Parser (2-3 hours)

**File:** `app/lib/runtime/message-parser.ts`

**Changes:**

```typescript
// In #parseActionTag method, add handling for 'edit' type:

#parseActionTag(input: string, actionOpenIndex: number, actionEndIndex: number) {
  const actionTag = input.slice(actionOpenIndex, actionEndIndex + 1);
  const actionType = this.#extractAttribute(actionTag, 'type') as ActionType;

  const actionAttributes = {
    type: actionType,
    content: '',
  };

  if (actionType === 'supabase') {
    // existing supabase handling...
  } else if (actionType === 'file') {
    const filePath = this.#extractAttribute(actionTag, 'filePath') as string;
    if (!filePath) {
      logger.debug('File path not specified');
    }
    (actionAttributes as FileAction).filePath = filePath;
  } else if (actionType === 'edit') {
    // Edit actions have no special attributes
    // Content is the raw SEARCH/REPLACE blocks
    // No streaming, no markdown cleanup
  } else if (!['shell', 'start', 'build'].includes(actionType)) {
    logger.warn(`Unknown action type '${actionType}'`);
  }

  return actionAttributes as BoltAction;
}
```

**Key Points:**
- `type="edit"` is recognized as valid (no warning)
- No special attribute extraction needed
- Content passes through unchanged (no markdown cleanup)
- No `onActionStream` callbacks for edit actions (existing code already handles this)

**Acceptance Criteria:**
- [ ] `<boltAction type="edit">` is parsed without warnings
- [ ] Edit action content preserves SEARCH/REPLACE markers exactly
- [ ] No streaming callbacks emitted for edit actions
- [ ] Existing file/shell action behavior unchanged

---

### Task 1.4: Integrate with Action Runner (1-2 days)

**File:** `app/lib/runtime/action-runner.ts`

**Changes:**

```typescript
// 1. Add import at top
import { 
  parseEditBlocks, 
  applyEdit, 
  groupEditsByFile, 
  sortEditsForApplication,
  type EditBlock,
  type EditApplyResult 
} from './edit-parser';

// 2. Update #executeAction to handle 'edit' type
async #executeAction(actionId: string, isStreaming: boolean = false) {
  const action = this.actions.get()[actionId];
  
  if (!action) {
    return;
  }

  if (action.status !== 'pending') {
    return;
  }

  this.#updateAction(actionId, { status: 'running' });

  try {
    switch (action.type) {
      case 'shell': {
        await this.#runShellAction(action);
        break;
      }
      case 'file': {
        await this.#runFileAction(action);
        break;
      }
      case 'start': {
        await this.#runStartAction(action);
        break;
      }
      case 'build': {
        await this.#runBuildAction(action);
        break;
      }
      case 'supabase': {
        await this.#runSupabaseAction(action as SupabaseAction);
        break;
      }
      case 'edit': {
        await this.#runEditAction(action);
        break;
      }
      default: {
        unreachable(`Unknown action type: ${(action as any).type}`);
      }
    }

    this.#updateAction(actionId, {
      status: action.abortSignal.aborted ? 'aborted' : 'complete',
      executed: true,
    });
  } catch (error: any) {
    // existing error handling...
  }
}

// 3. Add new #runEditAction method
async #runEditAction(action: ActionState & { type: 'edit' }) {
  const webcontainer = await this.#webcontainer;
  
  // Parse the raw content into edit blocks
  const { blocks, errors } = parseEditBlocks(action.content);
  
  if (errors.length > 0) {
    logger.warn('Edit parsing warnings:', errors);
  }
  
  if (blocks.length === 0) {
    logger.warn('EditAction contains no valid edit blocks');
    this.onAlert?.({
      type: 'warning',
      title: 'No Edits Found',
      description: 'The edit action did not contain any valid SEARCH/REPLACE blocks.',
      content: action.content.slice(0, 200),
    });
    return;
  }
  
  // Group blocks by file
  const editsByFile = groupEditsByFile(blocks);
  
  // Track results for summary
  const results: { 
    filePath: string; 
    applied: number; 
    failed: number;
    strategies: string[];
  }[] = [];
  
  for (const [filePath, fileBlocks] of editsByFile) {
    const normalizedPath = filePath.startsWith('/') 
      ? filePath 
      : `/${filePath}`;
    
    // Read current file content
    let fileContent: string;
    try {
      const buf = await webcontainer.fs.readFile(normalizedPath);
      fileContent = new TextDecoder().decode(buf);
    } catch (err) {
      logger.warn(`File not found for edit: ${normalizedPath}`);
      this.onAlert?.({
        type: 'error',
        title: 'Edit Failed',
        description: `File not found: ${normalizedPath}`,
        content: 'The target file does not exist. Create it first with a file action.',
      });
      results.push({ 
        filePath: normalizedPath, 
        applied: 0, 
        failed: fileBlocks.length,
        strategies: [],
      });
      continue;
    }
    
    // Sort edits for safe application (bottom-up)
    const sortedBlocks = sortEditsForApplication(fileBlocks, fileContent);
    
    let currentContent = fileContent;
    let applied = 0;
    let failed = 0;
    const strategies: string[] = [];
    
    for (const block of sortedBlocks) {
      const result = applyEdit(currentContent, block);
      
      if (result.success) {
        currentContent = result.newContent;
        applied++;
        strategies.push(result.strategy);
        logger.debug(`Edit applied (${result.strategy}):`, {
          filePath: normalizedPath,
          searchSnippet: block.searchContent.slice(0, 50),
        });
      } else {
        failed++;
        logger.warn('Failed to apply edit block:', {
          filePath: normalizedPath,
          searchSnippet: block.searchContent.slice(0, 100),
          error: result.error,
        });
        
        this.onAlert?.({
          type: 'error',
          title: 'Edit Match Failed',
          description: `Could not find matching code in ${normalizedPath}`,
          content: `SEARCH block:\n${block.searchContent.slice(0, 300)}`,
        });
      }
    }
    
    // Write updated content if any edits succeeded
    if (applied > 0 && currentContent !== fileContent) {
      await webcontainer.fs.writeFile(
        normalizedPath, 
        new TextEncoder().encode(currentContent)
      );
      logger.info(`Edited ${normalizedPath}: ${applied} edits applied`);
    }
    
    results.push({ filePath: normalizedPath, applied, failed, strategies });
  }
  
  // Log summary
  const totalApplied = results.reduce((sum, r) => sum + r.applied, 0);
  const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
  
  logger.info('Edit action complete:', {
    totalApplied,
    totalFailed,
    files: results.length,
  });
}
```

**Acceptance Criteria:**
- [ ] Edit actions are executed after streaming completes
- [ ] Files are read from WebContainer correctly
- [ ] Edits are applied in bottom-up order
- [ ] Successful edits are written back to WebContainer
- [ ] Failed edits trigger user-visible alerts
- [ ] Multiple blocks per file work correctly
- [ ] File not found is handled gracefully

---

### Task 1.5: Update System Prompts (2-3 hours)

**File:** `app/lib/common/prompts/prompts.ts`

**Add constant:**

```typescript
const EDIT_ACTION_GUIDANCE = `
## File Modification Guidelines

When modifying EXISTING files, prefer using SEARCH/REPLACE blocks with \`type="edit"\`:

<boltAction type="edit">
src/components/Hero.tsx
<<<<<<< SEARCH
// Copy EXACT existing code from the file
// Include 2-3 lines of context for uniqueness
=======
// Your replacement code
// Preserve indentation style
>>>>>>> REPLACE
</boltAction>

### SEARCH/REPLACE Rules:
1. SEARCH block must match the file EXACTLY - whitespace, indentation, comments
2. Include enough surrounding context to uniquely identify the location
3. Use multiple SEARCH/REPLACE blocks for multiple changes in the same file
4. Apply changes in reading order (top to bottom)

### When to use type="edit":
- Adding or modifying imports
- Changing component props or logic
- Updating styles (CSS/SCSS)
- Small to medium refactors
- Any targeted change to existing code

### When to use type="file":
- Creating brand new files
- Complete file rewrites (>80% of content changing)
- When multiple overlapping edits would be confusing

### Example - Adding an import:

<boltAction type="edit">
src/App.tsx
<<<<<<< SEARCH
import React from 'react';
import { Header } from './components/Header';
=======
import React from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
>>>>>>> REPLACE
</boltAction>

### Example - Modifying a component:

<boltAction type="edit">
src/components/Button.tsx
<<<<<<< SEARCH
export function Button({ children }) {
  return (
    <button className="btn">
      {children}
    </button>
=======
export function Button({ children, variant = 'primary' }) {
  return (
    <button className={\`btn btn-\${variant}\`}>
      {children}
    </button>
>>>>>>> REPLACE
</boltAction>
`;
```

**Inject into getSystemPrompt:**

```typescript
export const getSystemPrompt = (
  cwd: string = WORK_DIR,
  supabase?: { /* ... */ },
  designScheme?: DesignScheme,
) => `
You are Bolt, an expert AI assistant...

<system_constraints>
  ...existing constraints...
  
  IMPORTANT: WebContainer CANNOT execute diff or patch editing so always write your code in full no partial/diff update
  
  ${/* Replace the above line with: */}
  IMPORTANT: When modifying existing files, prefer using SEARCH/REPLACE blocks with type="edit" for targeted changes. Only use type="file" for new files or complete rewrites.
</system_constraints>

...existing sections...

${EDIT_ACTION_GUIDANCE}

<artifact_info>
  ...existing artifact info...
</artifact_info>
`;
```

**Acceptance Criteria:**
- [ ] System prompt includes edit action guidance
- [ ] Examples are clear and correctly formatted
- [ ] No template interpolation issues with special characters
- [ ] Prompt compiles and runs without errors

---

### Task 1.6: Add Unit Tests (1 day)

**File:** `app/lib/runtime/edit-parser.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { 
  parseEditBlocks, 
  applyEdit, 
  sortEditsForApplication,
  groupEditsByFile,
} from './edit-parser';

describe('parseEditBlocks', () => {
  describe('valid blocks', () => {
    it('parses a single valid block', () => {
      const raw = `src/App.tsx
<<<<<<< SEARCH
const a = 1;
=======
const a = 2;
>>>>>>> REPLACE`;
      
      const { blocks, errors } = parseEditBlocks(raw);
      
      expect(errors).toEqual([]);
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toMatchObject({
        filePath: '/src/App.tsx',
        searchContent: 'const a = 1;',
        replaceContent: 'const a = 2;',
      });
    });

    it('parses multiple blocks for different files', () => {
      const raw = `src/App.tsx
<<<<<<< SEARCH
import React from 'react';
=======
import React, { useState } from 'react';
>>>>>>> REPLACE

src/components/Button.tsx
<<<<<<< SEARCH
export function Button() {
=======
export function Button({ variant }) {
>>>>>>> REPLACE`;
      
      const { blocks, errors } = parseEditBlocks(raw);
      
      expect(errors).toEqual([]);
      expect(blocks).toHaveLength(2);
      expect(blocks[0].filePath).toBe('/src/App.tsx');
      expect(blocks[1].filePath).toBe('/src/components/Button.tsx');
    });

    it('parses multiple blocks for same file', () => {
      const raw = `src/App.tsx
<<<<<<< SEARCH
const a = 1;
=======
const a = 2;
>>>>>>> REPLACE

src/App.tsx
<<<<<<< SEARCH
const b = 3;
=======
const b = 4;
>>>>>>> REPLACE`;
      
      const { blocks, errors } = parseEditBlocks(raw);
      
      expect(blocks).toHaveLength(2);
      expect(blocks[0].filePath).toBe('/src/App.tsx');
      expect(blocks[1].filePath).toBe('/src/App.tsx');
    });

    it('handles empty SEARCH block (for new content)', () => {
      const raw = `src/new-file.ts
<<<<<<< SEARCH
=======
// This is new content
export const newFunction = () => {};
>>>>>>> REPLACE`;
      
      const { blocks, errors } = parseEditBlocks(raw);
      
      expect(errors).toEqual([]);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].searchContent).toBe('');
      expect(blocks[0].replaceContent).toContain('newFunction');
    });

    it('preserves multi-line content with correct whitespace', () => {
      const raw = `src/Component.tsx
<<<<<<< SEARCH
function Component() {
  return (
    <div>
      <h1>Hello</h1>
    </div>
  );
}
=======
function Component({ title }) {
  return (
    <div>
      <h1>{title}</h1>
    </div>
  );
}
>>>>>>> REPLACE`;
      
      const { blocks, errors } = parseEditBlocks(raw);
      
      expect(blocks).toHaveLength(1);
      expect(blocks[0].searchContent).toContain('  return (');
      expect(blocks[0].replaceContent).toContain('{ title }');
    });
  });

  describe('malformed blocks', () => {
    it('skips blocks with missing divider', () => {
      const raw = `src/App.tsx
<<<<<<< SEARCH
const a = 1;
>>>>>>> REPLACE`;
      
      const { blocks, errors } = parseEditBlocks(raw);
      
      expect(blocks).toHaveLength(0);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('skips blocks with missing REPLACE marker', () => {
      const raw = `src/App.tsx
<<<<<<< SEARCH
const a = 1;
=======
const a = 2;`;
      
      const { blocks, errors } = parseEditBlocks(raw);
      
      expect(blocks).toHaveLength(0);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('parses valid blocks while skipping malformed ones', () => {
      const raw = `src/valid.tsx
<<<<<<< SEARCH
valid content
=======
new valid content
>>>>>>> REPLACE

src/invalid.tsx
<<<<<<< SEARCH
missing replace marker
=======

src/also-valid.tsx
<<<<<<< SEARCH
also valid
=======
also new
>>>>>>> REPLACE`;
      
      const { blocks, errors } = parseEditBlocks(raw);
      
      expect(blocks).toHaveLength(2);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});

describe('applyEdit', () => {
  describe('exact matching', () => {
    it('applies exact match successfully', () => {
      const fileContent = `const a = 1;
const b = 2;
const c = 3;`;
      
      const result = applyEdit(fileContent, {
        filePath: '/test.ts',
        searchContent: 'const b = 2;',
        replaceContent: 'const b = 42;',
      });
      
      expect(result.success).toBe(true);
      expect(result.strategy).toBe('exact');
      expect(result.newContent).toContain('const b = 42;');
      expect(result.newContent).toContain('const a = 1;');
      expect(result.newContent).toContain('const c = 3;');
    });

    it('applies exact match with multi-line content', () => {
      const fileContent = `function hello() {
  console.log("Hello");
  return true;
}`;
      
      const result = applyEdit(fileContent, {
        filePath: '/test.ts',
        searchContent: `function hello() {
  console.log("Hello");`,
        replaceContent: `function hello(name) {
  console.log("Hello", name);`,
      });
      
      expect(result.success).toBe(true);
      expect(result.strategy).toBe('exact');
      expect(result.newContent).toContain('function hello(name)');
    });
  });

  describe('normalized matching', () => {
    it('applies normalized match when trailing whitespace differs', () => {
      const fileContent = `const a = 1;   
const b = 2;`;
      
      const result = applyEdit(fileContent, {
        filePath: '/test.ts',
        searchContent: 'const a = 1;',
        replaceContent: 'const a = 42;',
      });
      
      expect(result.success).toBe(true);
      expect(result.strategy).toBe('normalized');
      expect(result.newContent).toContain('const a = 42;');
    });
  });

  describe('fuzzy matching', () => {
    it('applies fuzzy match for minor differences', () => {
      const fileContent = `// Some comment
const  a = 1;
const b = 2;`;
      
      const result = applyEdit(fileContent, {
        filePath: '/test.ts',
        searchContent: 'const a = 1;',  // Note: file has extra space
        replaceContent: 'const a = 42;',
      });
      
      // May succeed with normalized or fuzzy depending on implementation
      expect(result.success).toBe(true);
    });
  });

  describe('failed matching', () => {
    it('returns failed when content not found', () => {
      const fileContent = `const a = 1;
const b = 2;`;
      
      const result = applyEdit(fileContent, {
        filePath: '/test.ts',
        searchContent: 'const c = 3;',
        replaceContent: 'const c = 33;',
      });
      
      expect(result.success).toBe(false);
      expect(result.strategy).toBe('failed');
      expect(result.newContent).toBe(fileContent); // Unchanged
    });

    it('returns failed when content is completely different', () => {
      const fileContent = `function hello() { return "hello"; }`;
      
      const result = applyEdit(fileContent, {
        filePath: '/test.ts',
        searchContent: 'function goodbye() { return "bye"; }',
        replaceContent: 'function goodbye() { return "farewell"; }',
      });
      
      expect(result.success).toBe(false);
      expect(result.strategy).toBe('failed');
    });
  });

  describe('empty SEARCH (new content)', () => {
    it('replaces entire content when SEARCH is empty', () => {
      const result = applyEdit('existing content', {
        filePath: '/test.ts',
        searchContent: '',
        replaceContent: 'new content',
      });
      
      expect(result.success).toBe(true);
      expect(result.newContent).toBe('new content');
    });
  });
});

describe('sortEditsForApplication', () => {
  it('sorts edits from bottom to top', () => {
    const fileContent = `line 1
line 2
line 3
line 4
line 5`;
    
    const edits = [
      { filePath: '/test.ts', searchContent: 'line 2', replaceContent: 'LINE 2' },
      { filePath: '/test.ts', searchContent: 'line 4', replaceContent: 'LINE 4' },
      { filePath: '/test.ts', searchContent: 'line 1', replaceContent: 'LINE 1' },
    ];
    
    const sorted = sortEditsForApplication(edits, fileContent);
    
    // Should be: line 4, line 2, line 1 (bottom-up)
    expect(sorted[0].searchContent).toBe('line 4');
    expect(sorted[1].searchContent).toBe('line 2');
    expect(sorted[2].searchContent).toBe('line 1');
  });
});

describe('groupEditsByFile', () => {
  it('groups edits by file path', () => {
    const edits = [
      { filePath: '/a.ts', searchContent: 'a1', replaceContent: 'A1' },
      { filePath: '/b.ts', searchContent: 'b1', replaceContent: 'B1' },
      { filePath: '/a.ts', searchContent: 'a2', replaceContent: 'A2' },
    ];
    
    const grouped = groupEditsByFile(edits);
    
    expect(grouped.size).toBe(2);
    expect(grouped.get('/a.ts')).toHaveLength(2);
    expect(grouped.get('/b.ts')).toHaveLength(1);
  });
});
```

**File:** `app/lib/runtime/message-parser.spec.ts` (extend existing)

```typescript
// Add to existing test file

describe('edit actions', () => {
  it('parses edit action as non-streaming', () => {
    const callbacks = {
      onArtifactOpen: vi.fn(),
      onArtifactClose: vi.fn(),
      onActionOpen: vi.fn(),
      onActionStream: vi.fn(),
      onActionClose: vi.fn(),
    };

    const parser = new StreamingMessageParser({ callbacks });

    const input = `<boltArtifact title="Edit Files" id="edit_1">
<boltAction type="edit">
src/App.tsx
<<<<<<< SEARCH
const a = 1;
=======
const a = 2;
>>>>>>> REPLACE
</boltAction>
</boltArtifact>`;

    parser.parse('test_edit', input);

    expect(callbacks.onActionOpen).toHaveBeenCalledTimes(1);
    expect(callbacks.onActionStream).not.toHaveBeenCalled();
    expect(callbacks.onActionClose).toHaveBeenCalledTimes(1);

    const closeCall = callbacks.onActionClose.mock.calls[0][0];
    expect(closeCall.action.type).toBe('edit');
    expect(closeCall.action.content).toContain('<<<<<<< SEARCH');
    expect(closeCall.action.content).toContain('>>>>>>> REPLACE');
  });

  it('preserves exact content including markers', () => {
    const callbacks = {
      onArtifactOpen: vi.fn(),
      onArtifactClose: vi.fn(),
      onActionOpen: vi.fn(),
      onActionClose: vi.fn(),
    };

    const parser = new StreamingMessageParser({ callbacks });

    const editContent = `path/to/file.tsx
<<<<<<< SEARCH
  exact indentation
    preserved here
=======
  new indentation
    also preserved
>>>>>>> REPLACE`;

    const input = `<boltArtifact title="Test" id="test_1">
<boltAction type="edit">
${editContent}
</boltAction>
</boltArtifact>`;

    parser.parse('test_preserve', input);

    const closeCall = callbacks.onActionClose.mock.calls[0][0];
    expect(closeCall.action.content).toContain('  exact indentation');
    expect(closeCall.action.content).toContain('    preserved here');
  });
});
```

**Acceptance Criteria:**
- [ ] All edit-parser tests pass
- [ ] Message parser tests pass including new edit action tests
- [ ] Test coverage for parsing, matching strategies, and edge cases
- [ ] Tests follow existing vitest patterns

---

## 5. Phase 2: AST Enhancement (Optional)

> **When to implement:** After Phase 1 is stable and you see >10% edit failures due to code drift.

### Task 2.1: Add web-tree-sitter (0.5 days)

```bash
pnpm add web-tree-sitter
```

**Setup WASM files:**
1. Download language grammars from tree-sitter releases
2. Place in `public/parsers/tree-sitter-{lang}.wasm`
3. Configure Vite to serve WASM correctly

### Task 2.2: Create AST Context Module (1 day)

**File:** `app/lib/runtime/ast-context.ts`

```typescript
import Parser from 'web-tree-sitter';

let parserInstance: Parser | null = null;
const languageCache = new Map<string, Parser.Language>();

export async function initParser(): Promise<Parser> {
  if (parserInstance) return parserInstance;
  
  await Parser.init();
  parserInstance = new Parser();
  return parserInstance;
}

export async function getAstContext(
  filePath: string, 
  code: string
): Promise<Parser.Tree | null> {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    'ts': 'typescript',
    'tsx': 'tsx',
    'js': 'javascript',
    'jsx': 'javascript',
  };
  
  const lang = langMap[ext || ''];
  if (!lang) return null;
  
  try {
    const parser = await initParser();
    
    if (!languageCache.has(lang)) {
      const language = await Parser.Language.load(
        `/parsers/tree-sitter-${lang}.wasm`
      );
      languageCache.set(lang, language);
    }
    
    parser.setLanguage(languageCache.get(lang)!);
    return parser.parse(code);
  } catch (err) {
    console.warn('Failed to parse AST:', err);
    return null;
  }
}
```

### Task 2.3: Add AST-Aware Matching Strategy (1-2 days)

Update `applyEdit` to accept optional AST and use it for constrained matching.

### Task 2.4: Feature Flag (0.5 days)

```typescript
const ENABLE_AST_MATCHING = process.env.ENABLE_AST_MATCHING === 'true';
```

---

## 6. Testing Strategy

### 6.1 Test Commands

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm exec vitest run app/lib/runtime/edit-parser.spec.ts

# Run with watch mode
pnpm exec vitest app/lib/runtime/edit-parser.spec.ts

# Run message parser tests
pnpm exec vitest run app/lib/runtime/message-parser.spec.ts
```

### 6.2 Manual QA Scenarios

#### Initial Generation Scenarios

| Scenario | Steps | Expected Result |
|----------|-------|-----------------|
| **Restaurant website** | "Create a Chinese restaurant called Dragon Palace" | 1. Template "Bamboo Bistro" selected<br>2. Files loaded from GitHub<br>3. LLM generates SEARCH/REPLACE to customize<br>4. User sees "Dragon Palace" website |
| **Custom branding** | "Create a pizza restaurant with red and gold colors" | Template loaded + color customizations via edits |
| **Menu customization** | "Create a sushi restaurant with omakase menu" | Template loaded + menu items edited |

#### User Iteration Scenarios

| Scenario | Steps | Expected Result |
|----------|-------|-----------------|
| Basic edit | Ask AI to change hero text | Uses `type="edit"`, text changes |
| Add import | Ask to add lodash import | Single SEARCH/REPLACE block works |
| Multi-file | Ask to update header and footer | Multiple files edited correctly |
| Failed match | Change file manually, then request AI edit | Graceful error with alert |
| Mixed actions | Request new file + edit existing | Both `type="file"` and `type="edit"` used appropriately |

### 6.3 Regression Checklist

- [ ] Existing file actions still work
- [ ] Shell actions still work  
- [ ] Supabase actions still work
- [ ] Streaming display unchanged
- [ ] Build/deploy unchanged

---

## 7. Rollout Plan

### 7.1 Feature Flag

```typescript
// app/lib/common/config.ts
export const ENABLE_EDIT_ACTIONS = 
  process.env.ENABLE_EDIT_ACTIONS === 'true' || 
  process.env.NODE_ENV === 'development';
```

### 7.2 Rollout Phases

| Phase | Duration | Scope | Monitoring |
|-------|----------|-------|------------|
| **Dev testing** | 3 days | Internal team only | Console logs |
| **Staging** | 2 days | Staging environment | Error tracking |
| **Soft launch** | 3 days | 10% of traffic | Strategy distribution metrics |
| **Full launch** | - | All users | User feedback, error rates |

### 7.3 Rollback Plan

1. Set `ENABLE_EDIT_ACTIONS=false` in environment
2. Prompt reverts to "always use type=file" guidance
3. Edit actions still parsed but fall through to empty operation

---

## 8. Success Metrics

### 8.1 Technical Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Edit success rate | >90% | `strategy !== 'failed'` / total edits |
| Exact match rate | >70% | `strategy === 'exact'` / successful edits |
| Token reduction | 50-70% | Compare before/after for same operations |

### 8.2 User Experience Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Failed edit alerts | <10% of sessions | Alert count / total sessions |
| User retry rate | <5% | Edit retry requests / total edits |

### 8.3 Logging

```typescript
// Log edit metrics
logger.info('Edit action complete', {
  totalBlocks: blocks.length,
  successful: applied,
  failed: failed,
  strategies: strategyCounts, // { exact: N, normalized: N, fuzzy: N, failed: N }
  files: editsByFile.size,
});
```

---

## Appendix A: File Summary

| File | Action | Description |
|------|--------|-------------|
| `app/types/actions.ts` | Modify | Add `EditAction` type |
| `app/lib/runtime/edit-parser.ts` | Create | Parse and apply SEARCH/REPLACE blocks |
| `app/lib/runtime/edit-parser.spec.ts` | Create | Unit tests for edit parser |
| `app/lib/runtime/message-parser.ts` | Modify | Handle `type="edit"` |
| `app/lib/runtime/message-parser.spec.ts` | Modify | Add edit action tests |
| `app/lib/runtime/action-runner.ts` | Modify | Add `#runEditAction` method |
| `app/lib/common/prompts/prompts.ts` | Modify | Add edit action guidance |

---

## Appendix B: Quick Reference

### Edit Block Format

```
path/to/file.tsx
<<<<<<< SEARCH
// Exact content to find
=======
// Replacement content
>>>>>>> REPLACE
```

### Action Tag Format

```xml
<boltAction type="edit">
path/to/file.tsx
<<<<<<< SEARCH
original code
=======
new code
>>>>>>> REPLACE
</boltAction>
```

### Strategy Priority

1. **Exact** - Verbatim substring match
2. **Normalized** - Match after trimming trailing whitespace
3. **Fuzzy** - Line-based similarity >85%, unique match only
4. **Failed** - No match found, content unchanged
