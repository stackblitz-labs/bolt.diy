# Quickstart: Hybrid Context Selection

**Feature**: 001-hybrid-context-selection
**Date**: January 19, 2026

---

## What This Feature Does

Replaces the LLM-based file selection (`selectContext()`) with a fast, local function that:

1. **Always includes core files** - pages, layout, styles, data
2. **Matches keywords** - "header" → Hero.tsx, "menu" → Menu.tsx
3. **Boosts recently edited files** - prioritizes files from current session
4. **Greps for specific text** - finds "$14" or "#21C6FF" in file contents

**Result**: 33% fewer LLM calls, 50% token reduction, 99% faster selection.

---

## Quick Overview

### Before (Current)
```
User Message → LLM #1 (summary) → LLM #2 (select files) → LLM #3 (edit)
                                       ↑
                                 PROBLEM: Only sees file paths!
```

### After (This Feature)
```
User Message → LLM #1 (summary) → LOCAL FUNCTION → LLM #2 (edit)
                                       ↑
                                 Sees content, uses scoring!
```

---

## Key Files to Modify

| File | Change |
|------|--------|
| `app/lib/.server/llm/context/getContextFiles.ts` | **NEW** - Core selection function |
| `app/lib/.server/llm/context/patterns.ts` | **NEW** - Core patterns and keyword map |
| `app/lib/.server/llm/context/grep.ts` | **NEW** - Text search function |
| `app/lib/.server/llm/select-context.ts` | **MODIFY** - Use local function instead of LLM |
| `app/routes/api.chat.ts` | **MINOR** - Pass recentlyEdited (optional) |

---

## Implementation Steps

### Step 1: Create Core Function

```typescript
// app/lib/.server/llm/context/getContextFiles.ts

export function getContextFiles(
  userMessage: string,
  allFiles: string[],
  options: ContextOptions = {}
): string[] {
  const scores = new Map<string, number>();
  const queryLower = userMessage.toLowerCase();

  // Score core bundle (+10)
  for (const file of allFiles) {
    for (const pattern of CORE_PATTERNS) {
      if (file.includes(pattern)) {
        scores.set(file, (scores.get(file) || 0) + 10);
        break;
      }
    }
  }

  // Score keyword matches (+5)
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

  // Score recently edited (+8)
  for (const file of options.recentlyEdited || []) {
    if (allFiles.includes(file)) {
      scores.set(file, (scores.get(file) || 0) + 8);
    }
  }

  // Sort by score, return top N
  return [...scores.entries()]
    .filter(([_, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, options.maxFiles || 12)
    .map(([file]) => file);
}
```

### Step 2: Modify selectContext

```typescript
// app/lib/.server/llm/select-context.ts

import { getContextFiles, grepForSpecificText } from './context/getContextFiles';

export async function selectContext(props) {
  const { messages, files, recentlyEdited = [] } = props;

  // Get all file paths
  const allFiles = getFilePaths(files);

  // Get last user message
  const lastUserMessage = messages.filter(m => m.role === 'user').pop();
  const userQuery = extractTextContent(lastUserMessage);

  // NEW: Use local function instead of LLM
  const selectedFiles = getContextFiles(userQuery, allFiles, {
    recentlyEdited,
    chatHistory: messages.filter(m => m.role === 'user').map(extractTextContent),
  });

  // Add grep matches
  const grepMatches = grepForSpecificText(userQuery, files);
  const allSelected = [...new Set([...selectedFiles, ...grepMatches])];

  // Build filtered FileMap
  const filteredFiles: FileMap = {};
  for (const path of allSelected) {
    const fullPath = path.startsWith('/home/project/') ? path : `/home/project/${path}`;
    if (files[fullPath]) {
      filteredFiles[path.replace('/home/project/', '')] = files[fullPath];
    }
  }

  return filteredFiles;
}
```

---

## Testing

### Manual Test Cases

| Query | Expected Files |
|-------|----------------|
| "change the header color" | Hero.tsx, Layout.tsx, index.css |
| "update menu prices" | Menu.tsx, MenuPreview.tsx, data/* |
| "fix the footer" | Footer.tsx |
| "change $14 to $16" | (grep match containing "$14") |

### Unit Test Example

```typescript
import { getContextFiles } from '~/lib/.server/llm/context/getContextFiles';

describe('getContextFiles', () => {
  const allFiles = [
    '/home/project/src/pages/Home.tsx',
    '/home/project/src/components/Hero.tsx',
    '/home/project/src/components/Menu.tsx',
    '/home/project/src/index.css',
  ];

  it('selects Hero for header-related queries', () => {
    const result = getContextFiles('change the header color', allFiles);
    expect(result).toContain('/home/project/src/components/Hero.tsx');
    expect(result).toContain('/home/project/src/index.css');
  });

  it('boosts recently edited files', () => {
    const result = getContextFiles('make it better', allFiles, {
      recentlyEdited: ['/home/project/src/components/Menu.tsx'],
    });
    expect(result[0]).toBe('/home/project/src/components/Menu.tsx');
  });
});
```

---

## Verification Checklist

- [ ] `getContextFiles()` returns files for "change header color"
- [ ] Core bundle always included (pages, layout, styles)
- [ ] Recently edited files get +8 boost
- [ ] Grep finds "$14" in file contents
- [ ] Selection completes in <100ms
- [ ] `selectContext()` no longer makes LLM call
- [ ] Existing API interface preserved

---

## Rollback Plan

If issues occur:

1. Revert `select-context.ts` to use LLM call
2. Remove `app/lib/.server/llm/context/` directory
3. No database changes to revert

---

## Performance Benchmarks

Run after implementation:

```typescript
const start = performance.now();
const files = getContextFiles(query, allFiles, options);
const duration = performance.now() - start;
console.log(`Context selection: ${duration.toFixed(2)}ms`);
```

**Targets**:
- Core matching: <5ms
- Full selection with grep: <50ms
- Never exceed 100ms
