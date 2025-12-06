# Technical Solution: Copy-and-Edit with grep-ast Patterns

## Executive Summary

Based on deep research into Aider, Cursor, grep-ast, and web-tree-sitter, this document provides comprehensive technical guidance for implementing the "copy template and incrementally edit" approach. The solution uses SEARCH/REPLACE block format with multi-strategy matching and error recovery.

**Key Finding:** The "copy template and incrementally edit" approach is **definitively better** than "generate full website from scratch" for production-grade AI website builders.

### Feasibility Assessment

| Aspect | Status | Notes |
|--------|--------|-------|
| **Core SEARCH/REPLACE format** | ✅ Proven | Industry-standard (Aider, Cursor) |
| **Integration with existing actions** | ✅ Compatible | Extends current `BoltAction` system |
| **Multi-strategy matching** | ✅ Feasible | Exact → normalized → fuzzy chain |
| **Streaming compatibility** | ✅ Safe | Treat edit as non-streaming action |
| **AST integration** | ⚠️ Optional | Significant complexity; defer to Phase 2 |

**Estimated effort:** 7-10 days (core), +3-5 days (AST enhancement)

---

## Part 1: Why "Copy and Edit" is Better

### Comparison Matrix

| Criteria | Generate Full Website | Copy Template + Edit | Winner |
|----------|----------------------|---------------------|--------|
| **Code Quality** | Inconsistent, redundant boilerplate | Proven templates, clean edits | Edit |
| **User Experience** | Overwhelming changes | Focused, predictable | Edit |
| **Iteration Speed** | Fast first, slow later | Fast iterative cycles | Edit |
| **Error Recovery** | Hard to isolate errors | Localized, easy rollback | Edit |
| **Maintainability** | Diverges from best practices | Stable foundation | Edit |
| **Token Usage** | High (regenerate all) | Low (only changes) | Edit |
| **Predictability** | Low (anything can change) | High (scoped changes) | Edit |

### Industry Validation

| Tool | Approach | Key Pattern |
|------|----------|-------------|
| **Cursor** | Fast-apply model | Speculative edits at ~1000 tokens/s |
| **Aider** | SEARCH/REPLACE blocks | grep-ast for AST-aware matching |
| **Continue.dev** | Region-based patching | Highlight + instruction prompts |
| **Lovable** | Incremental editing | Production-grade workflows |
| **GitHub Copilot** | Block-level diffs | Preview before acceptance |

---

## Part 2: grep-ast Technical Overview

### 2.1 What is grep-ast?

grep-ast is an AST-aware search tool built on Tree-sitter that:
- Parses source files into Concrete Syntax Trees (CST)
- Provides context-aware code chunking
- Identifies parent/child AST nodes around matches
- Returns syntactically valid code regions

**Repository:** [Aider-AI/grep-ast](https://github.com/Aider-AI/grep-ast)

> **⚠️ Important Clarification:** grep-ast is used for **context extraction** (feeding relevant code snippets to the LLM), NOT for patch application. Aider's edit matching uses a separate text-based multi-strategy approach. This distinction is critical for implementation.

### 2.2 Core Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     grep-ast Architecture                    │
├─────────────────────────────────────────────────────────────┤
│  Source Code → Tree-sitter Parser → CST → Named AST Nodes  │
│       ↓                                        ↓            │
│  Pattern Match → TreeContext → Context Extraction           │
│       ↓                                        ↓            │
│  Line Numbers + Parent Scopes + Child Nodes → Output       │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 TreeContext Class

The core class from grep-ast that handles context extraction:

```python
class TreeContext:
    def __init__(
        self,
        filename,
        code,
        color=False,
        verbose=False,
        line_number=False,
        parent_context=True,    # Show containing function/class
        child_context=True,     # Show code inside matches
        last_line=True,
        margin=3,               # Context lines around matches
        mark_lois=True,         # Mark "lines of interest"
        header_max=10,          # Max lines in headers
        loi_pad=1,              # Padding around matched lines
    ):
```

**Key Configuration Parameters:**
- **parent_context**: Shows enclosing function/class/method
- **child_context**: Shows nested code within matches
- **margin**: Configurable context window (default: 3 lines)
- **AST-aware chunking**: Returns syntactically complete regions

### 2.4 Tree-sitter Integration

grep-ast uses an abstraction layer to support multiple tree-sitter backends:

```python
try:
    from tree_sitter_language_pack import get_language, get_parser
    USING_TSL_PACK = True
except ImportError:
    from tree_sitter_languages import get_language, get_parser
    USING_TSL_PACK = False
```

**Supported Languages (15+):**
- TypeScript, JavaScript, TSX, JSX
- Python, Rust, Go, Java
- HTML, CSS, JSON, YAML
- And more via tree-sitter-language-pack

---

## Part 3: Aider's SEARCH/REPLACE Format

### 3.1 Block Format Specification

```
path/to/file.tsx
<<<<<<< SEARCH
// Exact code to find (including whitespace)
=======
// Replacement code
>>>>>>> REPLACE
```

### 3.2 Format Rules (from Aider Documentation)

1. **SEARCH block must match EXACTLY** - including whitespace, indentation, comments, and docstrings
2. **Only include lines that need to change** - plus minimal context for uniqueness
3. **Multiple edits in one file** = multiple SEARCH/REPLACE blocks
4. **New files** = empty SEARCH block
5. **First match only** - replaces only the first occurrence
6. **Include 2-3 lines of context** before/after the change point

### 3.3 Example Edits

**Adding an import:**
```
src/App.tsx
<<<<<<< SEARCH
import React from 'react';
import { Header } from './components/Header';
=======
import React from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
>>>>>>> REPLACE
```

**Changing a component prop:**
```
src/components/Hero.tsx
<<<<<<< SEARCH
export function Hero() {
  return (
    <section className="hero">
      <h1>Welcome</h1>
=======
export function Hero({ title }: { title: string }) {
  return (
    <section className="hero">
      <h1>{title}</h1>
>>>>>>> REPLACE
```

**Modifying CSS:**
```
src/styles/main.css
<<<<<<< SEARCH
.hero {
  background-color: #ffffff;
  padding: 2rem;
}
=======
.hero {
  background-color: #1a1a2e;
  padding: 4rem;
  color: #ffffff;
}
>>>>>>> REPLACE
```

### 3.4 Aider's Architecture

Aider supports an optional two-stage Architect/Editor pattern (enabled via `--architect` flag):

1. **Architect LLM** (optional): Reasons about desired changes, outputs a plan
2. **Editor LLM**: Generates SEARCH/REPLACE blocks in the specified format

> **Note:** The Architect/Editor pattern is an **optional mode**, not the default architecture. For most edits, Aider uses a single LLM pass. The separation is useful for complex refactorings but adds latency and cost.

When enabled, this separation ensures:
- Complex refactorings are both reasoned and formatted correctly
- The Editor focuses solely on syntactically correct diffs
- Reduced prompt engineering complexity

**Our recommendation:** Start with single-pass editing. Add architect mode later if complex multi-file refactorings show high failure rates.

---

## Part 4: Implementation Design

### 4.1 System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    Copy-and-Edit Flow                             │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. TEMPLATE INITIALIZATION                                       │
│     User Request → Select Template → Copy to WebContainer         │
│                                                                   │
│  2. CONTEXT BUILDING (NEW)                                        │
│     Read Existing Files → Build File Index → Create AST Context   │
│                                                                   │
│  3. AI EDITING (NEW)                                              │
│     User Message + File Context → LLM → SEARCH/REPLACE Blocks     │
│                                                                   │
│  4. EDIT APPLICATION (NEW)                                        │
│     Parse Blocks → Match in Files → Apply Patches → Validate      │
│                                                                   │
│  5. ERROR RECOVERY (NEW)                                          │
│     Match Failed? → Fuzzy Match → Expand Context → Retry          │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### 4.2 New Action Type

Add to `app/types/actions.ts`:

```typescript
// Extend ActionType to include 'edit'
export type ActionType = 'file' | 'shell' | 'supabase' | 'edit';

// EditAction extends BaseAction - keeps raw content for streaming compatibility
// Parsed blocks are handled at runtime, not in the wire type
export interface EditAction extends BaseAction {
  type: 'edit';
  // content is inherited from BaseAction - contains raw SEARCH/REPLACE blocks
}

export type BoltAction = FileAction | ShellAction | EditAction | StartAction | BuildAction | SupabaseAction;
```

> **⚠️ Design Note:** The `EditAction` extends `BaseAction` with raw `content` only. Do NOT embed `searchContent`/`replaceContent` fields directly - this conflicts with how `message-parser` accumulates streaming content. Parse blocks at runtime in `edit-parser.ts` instead.

**Runtime type for parsed blocks** (in `edit-parser.ts`):

```typescript
export interface EditBlock {
  filePath: string;
  searchContent: string;
  replaceContent: string;
  lineNumber?: number;  // For error reporting
}

export interface ParsedEditAction {
  raw: EditAction;         // Original action from parser
  blocks: EditBlock[];     // Parsed SEARCH/REPLACE blocks
}
```

### 4.3 Edit Block Parser

New file: `app/lib/runtime/edit-parser.ts`

```typescript
export interface EditBlock {
  filePath: string;
  searchContent: string;
  replaceContent: string;
  lineNumber?: number;  // For error reporting
}

export interface ParseResult {
  edits: EditBlock[];
  errors: string[];
}

/**
 * Parse SEARCH/REPLACE blocks from LLM response
 * Supports both fenced and unfenced formats
 */
export function parseEditBlocks(response: string): ParseResult {
  const edits: EditBlock[] = [];
  const errors: string[] = [];
  
  // Pattern 1: Fenced format (recommended)
  // ```edit:path/to/file.tsx
  // <<<<<<< SEARCH
  // code
  // =======
  // replacement
  // >>>>>>> REPLACE
  // ```
  const fencedRegex = /```(?:edit:)?([^\n]+)\n<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE\n```/g;
  
  // Pattern 2: Unfenced format (Aider style)
  // path/to/file.tsx
  // <<<<<<< SEARCH
  // code
  // =======
  // replacement
  // >>>>>>> REPLACE
  const unfencedRegex = /^([^\n]+\.(?:tsx?|jsx?|css|html|json|md|py|rs|go))\n<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/gm;
  
  let match;
  
  // Try fenced format first
  while ((match = fencedRegex.exec(response)) !== null) {
    edits.push({
      filePath: match[1].trim(),
      searchContent: match[2],
      replaceContent: match[3],
    });
  }
  
  // Fall back to unfenced format
  if (edits.length === 0) {
    while ((match = unfencedRegex.exec(response)) !== null) {
      edits.push({
        filePath: match[1].trim(),
        searchContent: match[2],
        replaceContent: match[3],
      });
    }
  }
  
  return { edits, errors };
}

/**
 * Apply a single edit to file content
 * Returns { success, newContent, error }
 */
export function applyEdit(
  fileContent: string, 
  edit: EditBlock
): { success: boolean; newContent: string; error?: string } {
  
  // Empty search = new file or append
  if (edit.searchContent.trim() === '') {
    return { 
      success: true, 
      newContent: edit.replaceContent 
    };
  }
  
  // Exact match first
  if (fileContent.includes(edit.searchContent)) {
    return {
      success: true,
      newContent: fileContent.replace(edit.searchContent, edit.replaceContent),
    };
  }
  
  // Whitespace-normalized match
  const result = fuzzyReplace(fileContent, edit.searchContent, edit.replaceContent);
  if (result) {
    return { success: true, newContent: result };
  }
  
  return {
    success: false,
    newContent: fileContent,
    error: `Search content not found in ${edit.filePath}`,
  };
}

/**
 * Fuzzy replace with whitespace normalization
 */
function fuzzyReplace(
  content: string, 
  search: string, 
  replace: string
): string | null {
  const searchLines = search.split('\n');
  const contentLines = content.split('\n');
  
  for (let i = 0; i <= contentLines.length - searchLines.length; i++) {
    let match = true;
    for (let j = 0; j < searchLines.length; j++) {
      if (contentLines[i + j].trim() !== searchLines[j].trim()) {
        match = false;
        break;
      }
    }
    
    if (match) {
      // Preserve original indentation of first line
      const originalIndent = contentLines[i].match(/^\s*/)?.[0] || '';
      const replaceLines = replace.split('\n').map((line, idx) => {
        if (idx === 0) return originalIndent + line.trim();
        return line;
      });
      
      contentLines.splice(i, searchLines.length, ...replaceLines);
      return contentLines.join('\n');
    }
  }
  
  return null;
}

/**
 * Apply multiple edits to files
 * Groups by file and sorts for safe application
 */
export function applyMultipleEdits(
  files: Map<string, string>,
  edits: EditBlock[]
): Map<string, { content: string; errors: string[] }> {
  
  // Group edits by file
  const editsByFile = new Map<string, EditBlock[]>();
  for (const edit of edits) {
    const existing = editsByFile.get(edit.filePath) || [];
    existing.push(edit);
    editsByFile.set(edit.filePath, existing);
  }
  
  const results = new Map<string, { content: string; errors: string[] }>();
  
  for (const [filePath, fileEdits] of editsByFile) {
    let content = files.get(filePath) || '';
    const errors: string[] = [];
    
    // Sort edits by position (bottom-up to preserve line numbers)
    const sortedEdits = sortEditsForApplication(fileEdits, content);
    
    // Apply edits in sequence
    for (const edit of sortedEdits) {
      const result = applyEdit(content, edit);
      if (result.success) {
        content = result.newContent;
      } else {
        errors.push(result.error || 'Unknown error');
      }
    }
    
    results.set(filePath, { content, errors });
  }
  
  return results;
}

/**
 * Sort edits by position (descending) to avoid offset issues
 */
function sortEditsForApplication(edits: EditBlock[], fileContent: string): EditBlock[] {
  const editsWithLines = edits.map(edit => {
    const index = fileContent.indexOf(edit.searchContent);
    const lineNumber = index === -1 ? Infinity : fileContent.substring(0, index).split('\n').length;
    return { edit, lineNumber };
  });
  
  // Sort descending (apply bottom-up)
  editsWithLines.sort((a, b) => b.lineNumber - a.lineNumber);
  return editsWithLines.map(e => e.edit);
}
```

### 4.4 System Prompt Instructions

Add to `app/lib/common/prompts/prompts.ts`:

```typescript
const EDIT_FORMAT_INSTRUCTIONS = `
## Code Editing Rules

When modifying EXISTING files, use SEARCH/REPLACE blocks:

path/to/file.tsx
<<<<<<< SEARCH
// Exact existing code (copy-paste from file)
// Include enough context to uniquely identify location
=======
// Your replacement code
// Preserve indentation style
>>>>>>> REPLACE

### Rules:
1. SEARCH must match EXACTLY - whitespace, indentation, comments
2. Include 2-3 lines of context before/after the change point
3. Multiple changes in one file = multiple SEARCH/REPLACE blocks
4. For NEW files, use <boltAction type="file"> format
5. Never regenerate entire files - only edit what needs to change

### Example - Changing a component prop:

src/components/Hero.tsx
<<<<<<< SEARCH
export function Hero() {
  return (
    <section className="hero">
      <h1>Welcome</h1>
=======
export function Hero({ title }: { title: string }) {
  return (
    <section className="hero">
      <h1>{title}</h1>
>>>>>>> REPLACE

### Example - Adding an import:

src/App.tsx
<<<<<<< SEARCH
import React from 'react';
import { Header } from './components/Header';
=======
import React from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
>>>>>>> REPLACE
`;
```

### 4.5 Message Parser Integration

Update `app/lib/runtime/message-parser.ts`:

```typescript
import { parseEditBlocks, type EditBlock } from './edit-parser';

// Add new tag constants
const EDIT_BLOCK_MARKERS = {
  SEARCH_START: '<<<<<<< SEARCH',
  DIVIDER: '=======',
  REPLACE_END: '>>>>>>> REPLACE',
};

// Add to ActionType
export type ActionType = 'file' | 'shell' | 'start' | 'supabase' | 'edit';

// In StreamingMessageParser class
export class StreamingMessageParser {
  #actionCounter = 0;
  
  /**
   * Check if content contains edit blocks
   */
  #containsEditBlocks(content: string): boolean {
    return content.includes(EDIT_BLOCK_MARKERS.SEARCH_START) &&
           content.includes(EDIT_BLOCK_MARKERS.REPLACE_END);
  }
  
  /**
   * Parse edit blocks and emit actions
   */
  #parseAndEmitEditBlocks(
    messageId: string, 
    content: string,
    artifactId: string
  ): void {
    const { edits, errors } = parseEditBlocks(content);
    
    for (const edit of edits) {
      const actionId = String(this.#actionCounter++);
      
      this._options.callbacks?.onActionOpen?.({
        artifactId,
        messageId,
        actionId,
        action: {
          type: 'edit',
          filePath: edit.filePath,
          searchContent: edit.searchContent,
          replaceContent: edit.replaceContent,
          content: edit.replaceContent,
        } as EditAction,
      });
      
      this._options.callbacks?.onActionClose?.({
        artifactId,
        messageId,
        actionId,
        action: {
          type: 'edit',
          filePath: edit.filePath,
          searchContent: edit.searchContent,
          replaceContent: edit.replaceContent,
          content: edit.replaceContent,
        } as EditAction,
      });
    }
  }
}
```

### 4.6 Workbench Edit Handler

Update `app/lib/stores/workbench.ts`:

```typescript
import { applyEdit } from '~/lib/runtime/edit-parser';

// In _runAction method
async _runAction(data: ActionCallbackData, isStreaming: boolean = false) {
  const { artifactId } = data;
  const artifact = this.#getArtifact(artifactId);
  
  if (!artifact) {
    unreachable('Artifact not found');
  }

  const action = artifact.runner.actions.get()[data.actionId];

  if (!action || action.executed) {
    return;
  }

  // Handle edit action type
  if (data.action.type === 'edit') {
    const wc = await webcontainer;
    const fullPath = path.join(wc.workdir, data.action.filePath);
    
    // Get existing file content
    const existingFile = this.#filesStore.getFile(fullPath);
    const existingContent = existingFile?.content || '';
    
    // Apply the edit
    const result = applyEdit(existingContent, {
      filePath: data.action.filePath,
      searchContent: data.action.searchContent,
      replaceContent: data.action.replaceContent,
    });
    
    if (result.success) {
      // Update the editor
      this.#editorStore.updateFile(fullPath, result.newContent);
      
      // Save file if not streaming
      if (!isStreaming) {
        await this.saveFile(fullPath);
      }
      
      // Mark action as executed
      artifact.runner.actions.setKey(data.actionId, {
        ...action,
        executed: true,
      });
      
      logger.info(`Edit applied successfully to ${data.action.filePath}`);
    } else {
      logger.error(`Edit failed: ${result.error}`);
      
      // Emit error for UI feedback
      this.alert.set({
        type: 'error',
        title: 'Edit Failed',
        description: result.error,
        content: `Could not find matching code in ${data.action.filePath}. The file may have been modified.`,
      });
    }
    
    return;
  }
  
  // ... existing file/shell/start action handling ...
}
```

---

## Part 5: Web-Based Tree-sitter Integration (Optional Enhancement)

> **⚠️ Complexity Warning:** AST integration is **optional and non-trivial**. It requires:
> - Async WASM initialization (`Parser.init()`)
> - Per-language grammar loading (~100KB-500KB per language WASM file)
> - Bundling/hosting WASM files in `public/parsers/`
> - Language detection and mapping logic
> - Error handling for parse failures
>
> **Recommendation:** Defer to Phase 2. The text-based matching (exact → normalized → fuzzy) handles 90%+ of cases.

For AST-aware editing in the browser, use **web-tree-sitter**.

### 5.1 Installation

```bash
pnpm add web-tree-sitter
```

**Additional setup required:**
1. Download language WASM files from [tree-sitter releases](https://github.com/AIDotNet/web-tree-sitter-binaries)
2. Place in `public/parsers/tree-sitter-{lang}.wasm`
3. Configure Vite to serve WASM files correctly

### 5.2 Parser Setup

New file: `app/lib/ast/tree-sitter-parser.ts`

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

export async function loadLanguage(langName: string): Promise<Parser.Language> {
  if (languageCache.has(langName)) {
    return languageCache.get(langName)!;
  }
  
  const wasmPath = `/parsers/tree-sitter-${langName}.wasm`;
  const language = await Parser.Language.load(wasmPath);
  languageCache.set(langName, language);
  return language;
}

export async function parseCode(
  code: string, 
  language: string
): Promise<Parser.Tree> {
  const parser = await initParser();
  const lang = await loadLanguage(language);
  parser.setLanguage(lang);
  return parser.parse(code);
}

export function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    'ts': 'typescript',
    'tsx': 'tsx',
    'js': 'javascript',
    'jsx': 'javascript',
    'css': 'css',
    'html': 'html',
    'json': 'json',
    'py': 'python',
    'rs': 'rust',
    'go': 'go',
  };
  return langMap[ext || ''] || 'javascript';
}
```

### 5.3 AST-Aware Context Extraction

```typescript
import Parser from 'web-tree-sitter';

export interface CodeContext {
  filePath: string;
  functionName?: string;
  className?: string;
  startLine: number;
  endLine: number;
  code: string;
}

/**
 * Extract context around a specific line
 * Returns the enclosing function/class/block
 */
export function extractContext(
  tree: Parser.Tree,
  code: string,
  lineNumber: number
): CodeContext | null {
  const lines = code.split('\n');
  
  // Find the node at the given line
  const point = { row: lineNumber - 1, column: 0 };
  let node = tree.rootNode.descendantForPosition(point);
  
  // Walk up to find enclosing function/class
  while (node && node.parent) {
    const type = node.type;
    
    if (
      type.includes('function') ||
      type.includes('method') ||
      type.includes('class') ||
      type === 'arrow_function' ||
      type === 'lexical_declaration'
    ) {
      return {
        filePath: '',
        functionName: extractName(node),
        startLine: node.startPosition.row + 1,
        endLine: node.endPosition.row + 1,
        code: lines.slice(
          node.startPosition.row, 
          node.endPosition.row + 1
        ).join('\n'),
      };
    }
    
    node = node.parent;
  }
  
  return null;
}

function extractName(node: Parser.SyntaxNode): string | undefined {
  // Try to find identifier child
  for (const child of node.children) {
    if (child.type === 'identifier' || child.type === 'property_identifier') {
      return child.text;
    }
  }
  return undefined;
}
```

---

## Part 6: Error Recovery Strategies

### 6.1 Fallback Chain

```typescript
export async function applyEditWithRecovery(
  fileContent: string,
  edit: EditBlock,
  tree?: Parser.Tree
): Promise<{ success: boolean; newContent: string; strategy: string }> {
  
  // Strategy 1: Exact match
  if (fileContent.includes(edit.searchContent)) {
    return {
      success: true,
      newContent: fileContent.replace(edit.searchContent, edit.replaceContent),
      strategy: 'exact',
    };
  }
  
  // Strategy 2: Whitespace-normalized match
  const normalizedResult = fuzzyReplace(fileContent, edit.searchContent, edit.replaceContent);
  if (normalizedResult) {
    return {
      success: true,
      newContent: normalizedResult,
      strategy: 'whitespace-normalized',
    };
  }
  
  // Strategy 3: AST-aware match (if tree provided)
  if (tree) {
    const astResult = astAwareReplace(fileContent, edit, tree);
    if (astResult) {
      return {
        success: true,
        newContent: astResult,
        strategy: 'ast-aware',
      };
    }
  }
  
  // Strategy 4: Line-by-line fuzzy match
  const fuzzyResult = lineByLineFuzzyMatch(fileContent, edit);
  if (fuzzyResult) {
    return {
      success: true,
      newContent: fuzzyResult,
      strategy: 'fuzzy-lines',
    };
  }
  
  return {
    success: false,
    newContent: fileContent,
    strategy: 'failed',
  };
}
```

### 6.2 Aider's Error Recovery Approach

From Aider documentation, error recovery strategies include:

1. **Context expansion**: If match fails, expand SEARCH context to include parent AST nodes
2. **Fallback to whole file**: Switch to `--edit-format whole` to re-sync model's understanding
3. **Architect mode**: Separate reasoning and editing for complex changes
4. **LLM repair**: Re-prompt Editor LLM to adjust the diff
5. **Diagnostic feedback**: Log exact mismatches for debugging

### 6.3 Conflict Resolution for Multiple Edits

```typescript
/**
 * Sort edits to avoid conflicts when applying multiple edits
 * Apply from bottom to top to preserve line numbers
 */
export function sortEditsForApplication(
  edits: EditBlock[],
  fileContent: string
): EditBlock[] {
  // Find line numbers for each edit
  const editsWithLines = edits.map(edit => {
    const lineNumber = findLineNumber(fileContent, edit.searchContent);
    return { edit, lineNumber };
  });
  
  // Sort by line number descending (apply bottom-up)
  editsWithLines.sort((a, b) => b.lineNumber - a.lineNumber);
  
  return editsWithLines.map(e => e.edit);
}

function findLineNumber(content: string, search: string): number {
  const index = content.indexOf(search);
  if (index === -1) return Infinity;
  
  return content.substring(0, index).split('\n').length;
}
```

---

## Part 7: LLM Prompting Strategy

### 7.1 When to Use Edit vs File Actions

| Scenario | Action Type | Rationale |
|----------|-------------|-----------|
| Creating new file | `type="file"` | No existing content to match |
| Modifying existing file | `type="edit"` | Targeted changes, lower tokens |
| Complete file rewrite | `type="file"` | More reliable than many edits |
| Adding imports | `type="edit"` | Small, localized change |
| Refactoring function | `type="edit"` | Scoped to function body |

### 7.2 Prompt Template

Add to `app/lib/common/prompts/prompts.ts`:

```typescript
const EDIT_VS_FILE_GUIDANCE = `
## File Modification Guidelines

When modifying EXISTING files, prefer SEARCH/REPLACE blocks:

<boltAction type="edit">
path/to/file.tsx
<<<<<<< SEARCH
// Copy exact existing code from the file
// Include 2-3 lines of context for uniqueness
=======
// Your replacement code
// Preserve indentation style
>>>>>>> REPLACE
</boltAction>

### When to use type="edit":
- Adding/modifying imports
- Changing component props or logic
- Updating styles
- Small to medium refactors

### When to use type="file":
- Creating brand new files
- Complete file rewrites (>80% changed)
- When multiple overlapping edits would be confusing

### SEARCH/REPLACE Rules:
1. SEARCH must match EXACTLY - whitespace, indentation, comments
2. Include enough context to uniquely identify the location
3. Multiple changes = multiple SEARCH/REPLACE blocks
4. Apply changes in reading order (top to bottom)
`;
```

### 7.3 Context Inclusion

When sending file context to the LLM:
- Include file version/hash to detect drift
- Show only relevant files (use grep-ast patterns for extraction)
- Limit context to ~4000 tokens per file

---

## Part 8: Diff UI & User Experience

### 8.1 Edit Preview Component

Before applying edits, show a diff preview:

```typescript
interface EditPreviewProps {
  edits: ParsedEditAction;
  onApply: () => void;
  onCancel: () => void;
  onApplyFile: (filePath: string) => void;
}

// Display grouped by file with:
// - Side-by-side or unified diff view
// - Strategy indicator (exact/normalized/fuzzy)
// - Apply all / Apply per file / Cancel buttons
```

### 8.2 Reusing Existing Diff Infrastructure

Leverage existing `FileHistory` and diff components:

```typescript
// In workbench.ts - before applying edit
const previewResult = await previewEdit(existingContent, editBlock);

// Show diff using existing Change[] infrastructure
const changes: Change[] = computeDiff(existingContent, previewResult.newContent);

// Display in UI for user confirmation (optional)
```

### 8.3 Strategy Indicators

Show users which matching strategy was used:

| Strategy | UI Indicator | Confidence |
|----------|--------------|------------|
| `exact` | ✅ Exact match | High |
| `whitespace-normalized` | ⚠️ Whitespace adjusted | Medium |
| `fuzzy-lines` | ⚠️ Fuzzy match (85%) | Low |
| `failed` | ❌ No match found | N/A |

---

## Part 9: Failure Recovery UX

### 9.1 Error Display

When edits fail, provide actionable feedback:

```typescript
interface EditFailure {
  filePath: string;
  searchSnippet: string;      // First 100 chars of SEARCH block
  reason: 'no_match' | 'multiple_matches' | 'file_not_found';
  suggestion?: string;        // "Did you mean..." with closest match
  similarLines?: string[];    // Nearby lines that partially match
}
```

### 9.2 User Options on Failure

```
┌─────────────────────────────────────────────────┐
│  ❌ Edit Failed: src/components/Hero.tsx        │
├─────────────────────────────────────────────────┤
│  Could not find matching code:                  │
│  > export function Hero() {                     │
│  >   return (                                   │
│                                                 │
│  Similar code found at line 45:                 │
│  > export const Hero = () => {                  │
│  >   return (                                   │
│                                                 │
│  [Skip this file]  [Retry with AI]  [Edit manually] │
└─────────────────────────────────────────────────┘
```

### 9.3 Retry Flow

When user clicks "Retry with AI":

```typescript
async function retryFailedEdit(failure: EditFailure): Promise<void> {
  const prompt = `
The following edit failed to match:

File: ${failure.filePath}
Search block:
\`\`\`
${failure.searchSnippet}
\`\`\`

Current file content (relevant section):
\`\`\`
${failure.similarLines?.join('\n')}
\`\`\`

Please regenerate the SEARCH/REPLACE block with the correct matching content.
`;
  
  await sendMessage(prompt);
}
```

---

## Part 10: Risk Assessment

### 10.1 Key Risks & Mitigations

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| **LLM generates malformed blocks** | Medium | High | Strict parser with clear error messages; few-shot examples in prompt |
| **Fuzzy match corrupts code** | High | Medium | Conservative threshold (0.85+); single-occurrence requirement; show diff before apply |
| **File changed since LLM saw it** | Medium | Medium | Track file version/hash; reject stale edits with "file changed" message |
| **Streaming regression** | High | Low | Keep edit as non-streaming; extensive tests for existing file streaming |
| **AST complexity explosion** | Medium | High | Defer AST to Phase 2; feature-flag it; start with TS/JS only |

### 10.2 Testing Strategy

```typescript
// Required test coverage:

// 1. Edit parser tests
describe('parseEditBlocks', () => {
  it('parses single block');
  it('parses multiple blocks same file');
  it('parses multiple blocks different files');
  it('handles empty SEARCH (new file)');
  it('handles malformed markers gracefully');
  it('preserves whitespace in content');
});

// 2. Edit application tests
describe('applyEdit', () => {
  it('applies exact match');
  it('applies whitespace-normalized match');
  it('applies fuzzy match with high similarity');
  it('rejects fuzzy match with multiple candidates');
  it('rejects low-similarity fuzzy match');
  it('handles empty file');
});

// 3. Integration tests
describe('message-parser with edits', () => {
  it('streams file actions unchanged');
  it('accumulates edit action content');
  it('emits edit action on close');
});
```

---

## Part 11: Migration Plan

### Phase 1: Core Implementation (7-10 days)

| Step | Task | Effort | Risk | Dependencies |
|------|------|--------|------|--------------|
| 1.1 | Types + parser wiring (`EditAction` in actions.ts) | 2-3 hours | Low | None |
| 1.2 | Update `message-parser.ts` to accept `type="edit"` | 2-3 hours | Low | 1.1 |
| 1.3 | Create `edit-parser.ts` with block parsing | 1-2 days | Low | None |
| 1.4 | Add unit tests for edit parser | 0.5 days | Low | 1.3 |
| 1.5 | Implement `applyEditWithRecovery` (exact + normalized + fuzzy) | 1-2 days | Medium | 1.3 |
| 1.6 | Add edit application tests | 0.5 days | Low | 1.5 |
| 1.7 | Integrate edit handler in `workbench.ts` | 1-2 days | Medium | 1.2, 1.5 |
| 1.8 | Add diff UI for edit preview | 1 day | Low | 1.7 |
| 1.9 | Update system prompts | 2-3 hours | Low | None |
| 1.10 | Failure UX and error messaging | 1 day | Low | 1.7 |

### Phase 2: AST Enhancement (Optional, 3-5 days)

| Step | Task | Effort | Risk | Dependencies |
|------|------|--------|------|--------------|
| 2.1 | Install `web-tree-sitter` and setup WASM loading | 0.5 days | Medium | None |
| 2.2 | Implement AST parser wrapper | 1 day | Medium | 2.1 |
| 2.3 | Add AST-aware context extraction | 1-2 days | Medium | 2.2 |
| 2.4 | Integrate AST matching as fallback strategy | 1 day | Medium | 1.5, 2.3 |
| 2.5 | Feature-flag and testing | 0.5 days | Low | 2.4 |

### Implementation Order Diagram

```
                    ┌─────────────────┐
                    │  1.1 Types      │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
    ┌─────────────────┐ ┌─────────┐ ┌─────────────────┐
    │ 1.2 Msg Parser  │ │1.3 Edit │ │ 1.9 Prompts     │
    └────────┬────────┘ │ Parser  │ └─────────────────┘
             │          └────┬────┘
             │               │
             │          ┌────┴────┐
             │          ▼         ▼
             │    ┌─────────┐ ┌─────────┐
             │    │1.4 Tests│ │1.5 Apply│
             │    └─────────┘ └────┬────┘
             │                     │
             └──────────┬──────────┘
                        ▼
              ┌─────────────────┐
              │ 1.7 Workbench   │
              └────────┬────────┘
                       │
         ┌─────────────┼─────────────┐
         ▼             ▼             ▼
   ┌───────────┐ ┌───────────┐ ┌───────────┐
   │ 1.8 Diff  │ │1.10 Error │ │ 2.x AST   │
   │    UI     │ │    UX     │ │ (Optional)│
   └───────────┘ └───────────┘ └───────────┘
```

**Total estimated effort:** 
- **Core (Phase 1):** 7-10 days
- **With AST (Phase 1+2):** 10-15 days

---

## Part 12: Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `app/lib/runtime/edit-parser.ts` | Parse SEARCH/REPLACE blocks |
| `app/lib/ast/tree-sitter-parser.ts` | Optional AST integration |
| `tests/unit/edit-parser.test.ts` | Unit tests for edit parser |

### Modified Files

| File | Changes |
|------|---------|
| `app/types/actions.ts` | Add `EditAction` type |
| `app/lib/runtime/message-parser.ts` | Detect and emit edit blocks |
| `app/lib/stores/workbench.ts` | Handle edit action application |
| `app/lib/common/prompts/prompts.ts` | Add edit format instructions |
| `app/utils/selectStarterTemplate.ts` | Update template loading approach |

---

## Part 13: Expected Benefits

1. **50-70% token reduction** - Only send/receive changed code
2. **Faster iterations** - Targeted changes apply instantly
3. **Better error recovery** - Fallback strategies for matching
4. **Predictable changes** - Scoped, reviewable edits
5. **Template integrity** - Base template remains stable
6. **Industry standard** - Proven patterns from production tools

---

## References

- [Aider Edit Formats Documentation](https://aider.chat/docs/more/edit-formats.html)
- [Aider grep-ast Repository](https://github.com/Aider-AI/grep-ast)
- [Tree-sitter Documentation](https://tree-sitter.github.io/tree-sitter/)
- [web-tree-sitter NPM Package](https://www.npmjs.com/package/web-tree-sitter)
- [Cursor Instant Apply Blog](https://cursor.com/blog/instant-apply)
- [Aider Architect Mode](https://aider.chat/2024/09/26/architect.html)

---

## Conclusion

This implementation follows industry best practices from Aider, Cursor, and grep-ast. The key insight: **index once, query fast, edit targeted**.

The SEARCH/REPLACE format provides:
- Clear, deterministic edit boundaries
- Easy debugging when matches fail
- Compatibility with existing diff tooling
- Minimal token overhead for changes

Start with the basic edit parser (Phase 1-4), then add AST enhancements as needed.

