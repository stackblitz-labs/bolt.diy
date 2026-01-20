# Data Model: Hybrid Context Selection

**Feature**: 001-hybrid-context-selection
**Date**: January 19, 2026
**Spec**: [spec.md](./spec.md)

---

## Overview

This feature introduces local context selection without new persistent data models. All entities are runtime configuration or in-memory state passed between functions.

---

## Entities

### 1. ContextOptions

**Purpose**: Configuration object passed to the context selection function.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `recentlyEdited` | `string[]` | No | File paths edited in the current chat session |
| `chatHistory` | `string[]` | No | Previous user messages for mention detection |
| `maxFiles` | `number` | No | Maximum files to return (default: 12) |

**Validation Rules**:
- `recentlyEdited` paths must be valid file paths (if provided)
- `maxFiles` must be positive integer between 1 and 30

**Example**:
```typescript
{
  recentlyEdited: ['/home/project/src/components/Hero.tsx'],
  chatHistory: ['change the hero section', 'make it bolder'],
  maxFiles: 12
}
```

---

### 2. ScoredFile

**Purpose**: Internal representation of a file with its computed relevance score.

| Field | Type | Description |
|-------|------|-------------|
| `path` | `string` | Absolute file path |
| `score` | `number` | Computed relevance score |
| `signals` | `string[]` | Debug info: which signals contributed |

**Example**:
```typescript
{
  path: '/home/project/src/components/Hero.tsx',
  score: 23,
  signals: ['core', 'keyword:hero', 'recentlyEdited']
}
```

---

### 3. CorePatterns (Configuration)

**Purpose**: Static list of file path patterns that are always included in context.

| Property | Type | Description |
|----------|------|-------------|
| `patterns` | `string[]` | Glob-like patterns to match |

**Default Values**:
```typescript
[
  'pages/',
  'App.tsx',
  'main.tsx',
  'index.css',
  'styles/',
  'data/',
  'Layout',
  'Footer'
]
```

**Notes**:
- Patterns use simple substring matching (not full glob)
- Case-sensitive matching
- Extensible per template type (future enhancement)

---

### 4. KeywordMap (Configuration)

**Purpose**: Mapping from user query keywords to relevant file patterns.

| Property | Type | Description |
|----------|------|-------------|
| `[keyword]` | `string[]` | File patterns associated with keyword |

**Default Values**:
```typescript
{
  'header': ['Hero', 'Layout', 'Navbar'],
  'hero': ['Hero', 'Home'],
  'headline': ['Hero'],
  'banner': ['Hero'],
  'menu': ['Menu', 'MenuPreview', 'data/'],
  'dish': ['Menu', 'MenuPreview', 'data/'],
  'food': ['Menu', 'MenuPreview'],
  'price': ['Menu', 'MenuPreview', 'data/'],
  'footer': ['Footer'],
  'contact': ['Footer', 'data/'],
  'hours': ['Footer', 'data/'],
  'about': ['About', 'Story'],
  'story': ['Story', 'About'],
  'color': ['index.css', 'styles/', 'tailwind.config', 'guidelines/'],
  'font': ['index.css', 'styles/'],
  'style': ['index.css', 'styles/'],
  'button': ['Hero', 'ui/Button'],
  'navigation': ['Layout', 'Navbar'],
  'logo': ['Layout', 'Hero']
}
```

**Notes**:
- Keywords are matched case-insensitively
- Multiple keywords can match the same file
- Patterns use substring matching

---

### 5. BoostWeights (Configuration)

**Purpose**: Numeric weights for different scoring signals.

| Signal | Default Weight | Description |
|--------|----------------|-------------|
| `core` | 10 | File matches core bundle pattern |
| `recentlyEdited` | 8 | File was edited in current session |
| `keywordMatch` | 5 | File matches keyword from user query |
| `grepMatch` | 5 | File contains specific text from query |
| `chatMention` | 3 | File was mentioned in chat history |

**Validation**:
- All weights must be non-negative integers
- Core weight should be highest to ensure base context

---

## Existing Entities (Referenced, Not Modified)

### FileMap (from constants.ts)

```typescript
export interface File {
  type: 'file';
  content: string;
  isBinary: boolean;
  isLocked?: boolean;
  lockedByFolder?: string;
}

export interface Folder {
  type: 'folder';
  isLocked?: boolean;
  lockedByFolder?: string;
}

type Dirent = File | Folder;

export type FileMap = Record<string, Dirent | undefined>;
```

**Usage**: Input to `getContextFiles()` for grep operations; output from `selectContext()` with filtered files.

---

### Message (from ai package)

```typescript
interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string | ContentPart[];
  id?: string;
  annotations?: Annotation[];
}
```

**Usage**: Input to extract user query and chat history.

---

## Entity Relationships

```
┌─────────────────────────────────────────────────────────────────┐
│                       Runtime Flow                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐     ┌──────────────────┐                      │
│  │ FileMap      │────▶│ getContextFiles()│                      │
│  │ (all files)  │     │                  │                      │
│  └──────────────┘     │  Uses:           │                      │
│                       │  - CorePatterns  │                      │
│  ┌──────────────┐     │  - KeywordMap    │     ┌────────────┐   │
│  │ Message[]    │────▶│  - BoostWeights  │────▶│ ScoredFile[]│  │
│  │ (chat)       │     │                  │     └────────────┘   │
│  └──────────────┘     │  Input:          │           │          │
│                       │  - ContextOptions│           │          │
│  ┌──────────────┐     │                  │           ▼          │
│  │ContextOptions│────▶│                  │     ┌────────────┐   │
│  │              │     └──────────────────┘     │ FileMap    │   │
│  └──────────────┘                              │ (filtered) │   │
│                                                └────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## State Transitions

No persistent state transitions. All processing is stateless within a single request.

**Session State** (managed externally):
- `recentlyEdited[]` grows as files are edited during chat session
- Resets when a new chat session starts

---

## Validation Rules Summary

| Entity | Rule | Error Handling |
|--------|------|----------------|
| ContextOptions.maxFiles | 1-30 | Default to 12 if out of range |
| File paths | Must exist in FileMap | Skip non-existent paths |
| User query | Non-empty string | Return core bundle only |
| FileMap | At least one file | Return empty result |

---

## Notes

1. **No Database Changes**: This feature operates entirely in-memory
2. **No New Persistence**: recentlyEdited tracked by existing FilesStore
3. **Configuration Static**: CorePatterns and KeywordMap are compile-time constants
4. **Extensibility**: Future template-specific configs can override defaults
