# API Contracts: Zip File Template Support

**Feature**: 003-zip-template-support
**Date**: 2026-01-30
**Purpose**: Define internal function contracts (no new HTTP endpoints)

## Overview

This feature does not add new HTTP API endpoints. Instead, it adds internal TypeScript function contracts that integrate with existing code. The contracts below define the function signatures, parameters, and return types.

## Function Contracts

### 1. fetchTemplateFromZip

**Location**: `app/lib/.server/templates/zip-template-fetcher.ts`

```typescript
/**
 * Extracts template files from a local zip archive.
 *
 * @param zipPath - Absolute path to the zip file
 * @param options - Extraction options
 * @returns Promise resolving to extraction result with files and metadata
 * @throws ZipTemplateError if extraction fails
 *
 * @example
 * const result = await fetchTemplateFromZip('/path/to/templates/indochine-luxe.zip');
 * console.log(result.files.length); // 45
 */
export async function fetchTemplateFromZip(
  zipPath: string,
  options?: ZipFetcherOptions
): Promise<ZipExtractionResult>;
```

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `zipPath` | `string` | Yes | - | Absolute path to the zip file |
| `options.maxFileSize` | `number` | No | `102400` | Max file size in bytes (100KB) |
| `options.ignorePatterns` | `string[]` | No | `[]` | Additional patterns to ignore |
| `options.stripRootFolder` | `boolean` | No | `true` | Strip single root folder wrapper |

#### Return Type

```typescript
interface ZipExtractionResult {
  files: TemplateFile[];
  skipped: SkippedFile[];
  metadata: {
    zipFilename: string;
    strippedRootFolder: string | null;
    totalEntriesInZip: number;
    extractionMs: number;
  };
}
```

#### Errors

| Error Code | Condition | HTTP Equivalent |
|------------|-----------|-----------------|
| `NOT_FOUND` | Zip file doesn't exist at path | 404 |
| `CORRUPTED` | JSZip cannot parse the file | 400 |
| `EMPTY` | Zip has no extractable files | 400 |
| `INVALID_PATH` | Path traversal detected | 400 |
| `READ_ERROR` | Filesystem read error | 500 |

---

### 2. resolveTemplate

**Location**: `app/lib/.server/templates/template-resolver.ts`

```typescript
/**
 * Resolves a template from the best available source.
 *
 * Checks for local zip file first (if filesystem available),
 * then falls back to GitHub fetch.
 *
 * @param templateName - Template name from STARTER_TEMPLATES
 * @param options - Resolution options including GitHub fallback config
 * @returns Promise resolving to resolved template with files and source info
 * @throws Error if no source available or all sources fail
 *
 * @example
 * const template = await resolveTemplate('Indochine Luxe', {
 *   githubRepo: 'neweb-learn/Indochineluxe',
 *   githubToken: process.env.GITHUB_TOKEN,
 * });
 * console.log(template.source.type); // 'zip' or 'github'
 */
export async function resolveTemplate(
  templateName: string,
  options: TemplateResolverOptions
): Promise<ResolvedTemplate>;
```

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `templateName` | `string` | Yes | - | Template name from STARTER_TEMPLATES |
| `options.githubRepo` | `string` | Yes | - | GitHub repo in "owner/repo" format |
| `options.githubToken` | `string` | No | - | GitHub PAT for API calls |
| `options.preferZip` | `boolean` | No | `true` | Try zip before GitHub |
| `options.zipOnly` | `boolean` | No | `false` | Don't fallback to GitHub |

#### Return Type

```typescript
interface ResolvedTemplate {
  files: TemplateFile[];
  source: TemplateSource;
  templateName: string;
}

type TemplateSource =
  | { type: 'zip'; zipPath: string }
  | { type: 'github'; repo: string; branch?: string };
```

---

### 3. templateNameToZipFilename

**Location**: `app/lib/.server/templates/zip-template-fetcher.ts`

```typescript
/**
 * Converts a template name to its expected zip filename.
 *
 * @param templateName - Template name from STARTER_TEMPLATES
 * @returns Kebab-case zip filename
 *
 * @example
 * templateNameToZipFilename('Indochine Luxe'); // 'indochine-luxe.zip'
 * templateNameToZipFilename('Bold Feast v2'); // 'bold-feast-v2.zip'
 */
export function templateNameToZipFilename(templateName: string): string;
```

---

### 4. getZipPath

**Location**: `app/lib/.server/templates/zip-template-fetcher.ts`

```typescript
/**
 * Gets the absolute filesystem path for a template's zip file.
 *
 * @param templateName - Template name from STARTER_TEMPLATES
 * @returns Absolute path to expected zip file location
 *
 * @example
 * getZipPath('Indochine Luxe');
 * // '/path/to/project/templates/indochine-luxe.zip'
 */
export function getZipPath(templateName: string): string;
```

---

### 5. zipExists

**Location**: `app/lib/.server/templates/zip-template-fetcher.ts`

```typescript
/**
 * Checks if a zip file exists at the given path.
 *
 * @param zipPath - Absolute path to check
 * @returns Promise resolving to true if file exists
 *
 * @example
 * const exists = await zipExists('/path/to/templates/indochine-luxe.zip');
 */
export async function zipExists(zipPath: string): Promise<boolean>;
```

---

### 6. canAccessFileSystem

**Location**: `app/lib/.server/templates/template-resolver.ts`

```typescript
/**
 * Checks if the current environment has filesystem access.
 *
 * Returns false in Cloudflare Workers/Pages where fs is unavailable.
 *
 * @returns true if fs module is available
 *
 * @example
 * if (canAccessFileSystem()) {
 *   // Safe to use fs operations
 * }
 */
export function canAccessFileSystem(): boolean;
```

---

## Integration with Existing Functions

### Modified: fetchTemplateFromGitHub (Unchanged Interface)

The existing function signature remains unchanged:

```typescript
// app/lib/.server/templates/github-template-fetcher.ts
export async function fetchTemplateFromGitHub(
  githubRepo: string,
  githubToken?: string
): Promise<TemplateFile[]>;
```

### Modified: applyIgnorePatterns (Unchanged Interface)

The existing function signature remains unchanged:

```typescript
// app/lib/.server/templates/github-template-fetcher.ts
export function applyIgnorePatterns(
  files: TemplateFile[]
): FilteredTemplateFiles;
```

## Module Exports

### Updated: app/lib/.server/templates/index.ts

```typescript
// Existing exports (unchanged)
export {
  fetchTemplateFromGitHub,
  applyIgnorePatterns,
  type TemplateFile,
  type FilteredTemplateFiles,
} from './github-template-fetcher';

export {
  buildTemplateFilesMessage,
  buildCustomizationMessage,
  buildTemplatePrimingMessages,
  type TemplatePrimingMessages,
} from './template-primer';

// New exports
export {
  fetchTemplateFromZip,
  templateNameToZipFilename,
  getZipPath,
  zipExists,
  ZipTemplateError,
  type ZipExtractionResult,
  type ZipFetcherOptions,
  type SkippedFile,
  type ZipTemplateErrorCode,
} from './zip-template-fetcher';

export {
  resolveTemplate,
  canAccessFileSystem,
  type ResolvedTemplate,
  type TemplateSource,
  type TemplateResolverOptions,
} from './template-resolver';
```

## Sequence Diagram

```
┌─────────┐     ┌──────────────┐     ┌─────────────────┐     ┌────────────────┐
│ Caller  │     │ Resolver     │     │ Zip Fetcher     │     │ GitHub Fetcher │
└────┬────┘     └──────┬───────┘     └────────┬────────┘     └───────┬────────┘
     │                 │                      │                      │
     │ resolveTemplate │                      │                      │
     │────────────────▶│                      │                      │
     │                 │                      │                      │
     │                 │ canAccessFileSystem()?                      │
     │                 │──────┐               │                      │
     │                 │      │               │                      │
     │                 │◀─────┘ true          │                      │
     │                 │                      │                      │
     │                 │ zipExists(path)?     │                      │
     │                 │─────────────────────▶│                      │
     │                 │                      │                      │
     │                 │◀─────────────────────│ true                 │
     │                 │                      │                      │
     │                 │ fetchTemplateFromZip │                      │
     │                 │─────────────────────▶│                      │
     │                 │                      │                      │
     │                 │◀─────────────────────│ ZipExtractionResult  │
     │                 │                      │                      │
     │◀────────────────│ ResolvedTemplate     │                      │
     │  (source: zip)  │                      │                      │
     │                 │                      │                      │
     │                 │                      │                      │
     │                 │ [If zip fails/missing]                      │
     │                 │                      │                      │
     │                 │ fetchTemplateFromGitHub                     │
     │                 │─────────────────────────────────────────────▶
     │                 │                      │                      │
     │                 │◀─────────────────────────────────────────────│
     │                 │                      │           TemplateFile[]
     │◀────────────────│ ResolvedTemplate     │                      │
     │ (source: github)│                      │                      │
     │                 │                      │                      │
```
