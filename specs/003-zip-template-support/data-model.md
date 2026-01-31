# Data Model: Zip File Template Support

**Feature**: 003-zip-template-support
**Date**: 2026-01-30
**Purpose**: Define entities, types, and data structures

## Core Entities

### 1. TemplateFile (Existing - Unchanged)

The fundamental unit of template content. Already defined in `github-template-fetcher.ts`.

```typescript
/**
 * Represents a single file from a template.
 * Used by both GitHub and Zip fetchers.
 */
export interface TemplateFile {
  /** Filename only (e.g., "App.tsx") */
  name: string;

  /** Relative path from project root (e.g., "src/App.tsx") */
  path: string;

  /** File content as UTF-8 string */
  content: string;
}
```

### 2. ZipExtractionResult (New)

Result of extracting a zip file, including metadata for logging/debugging.

```typescript
/**
 * Result of extracting files from a zip archive.
 */
export interface ZipExtractionResult {
  /** Successfully extracted files */
  files: TemplateFile[];

  /** Files that were skipped (binary, oversized, filtered) */
  skipped: SkippedFile[];

  /** Metadata about the extraction */
  metadata: {
    /** Original zip filename */
    zipFilename: string;

    /** Root folder that was stripped (if any) */
    strippedRootFolder: string | null;

    /** Total files in zip (before filtering) */
    totalEntriesInZip: number;

    /** Extraction duration in milliseconds */
    extractionMs: number;
  };
}

/**
 * A file that was skipped during extraction.
 */
export interface SkippedFile {
  path: string;
  reason: 'binary' | 'oversized' | 'filtered' | 'invalid_path';
}
```

### 3. TemplateSource (New)

Discriminated union representing where a template was loaded from.

```typescript
/**
 * Source information for a loaded template.
 */
export type TemplateSource =
  | { type: 'zip'; zipPath: string }
  | { type: 'github'; repo: string; branch?: string };
```

### 4. ResolvedTemplate (New)

Combined result of template resolution, including source information.

```typescript
/**
 * A fully resolved template with files and source information.
 */
export interface ResolvedTemplate {
  /** The template files ready for priming */
  files: TemplateFile[];

  /** Where the template was loaded from */
  source: TemplateSource;

  /** Template name from STARTER_TEMPLATES */
  templateName: string;
}
```

### 5. ZipTemplateError (New)

Structured error for zip template operations.

```typescript
/**
 * Error codes for zip template operations.
 */
export type ZipTemplateErrorCode =
  | 'NOT_FOUND'      // Zip file doesn't exist
  | 'CORRUPTED'      // Zip file is invalid/corrupted
  | 'EMPTY'          // Zip file has no extractable files
  | 'INVALID_PATH'   // Path traversal attempt detected
  | 'READ_ERROR'     // Filesystem read error
  | 'FS_UNAVAILABLE'; // Filesystem not available (Cloudflare)

/**
 * Error class for zip template operations.
 */
export class ZipTemplateError extends Error {
  constructor(
    message: string,
    public readonly code: ZipTemplateErrorCode,
    public readonly zipPath?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ZipTemplateError';
  }
}
```

## Configuration Types

### 6. ZipFetcherOptions (New)

Options for the zip fetcher function.

```typescript
/**
 * Options for fetching a template from a zip file.
 */
export interface ZipFetcherOptions {
  /** Maximum file size in bytes (default: 100KB) */
  maxFileSize?: number;

  /** Additional patterns to ignore (in addition to defaults) */
  ignorePatterns?: string[];

  /** Whether to strip root folder wrapper (default: true) */
  stripRootFolder?: boolean;
}
```

### 7. TemplateResolverOptions (New)

Options for the template resolver.

```typescript
/**
 * Options for resolving a template from any source.
 */
export interface TemplateResolverOptions {
  /** GitHub repository in "owner/repo" format */
  githubRepo: string;

  /** GitHub personal access token for API calls */
  githubToken?: string;

  /** Prefer zip over GitHub even if both available (default: true) */
  preferZip?: boolean;

  /** Skip GitHub fallback if zip fails (default: false) */
  zipOnly?: boolean;
}
```

## Constants

### File Filtering

```typescript
/**
 * File extensions considered binary (not extracted as text).
 */
export const BINARY_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.svg',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.mp3', '.mp4', '.webm', '.wav', '.ogg',
  '.pdf', '.zip', '.tar', '.gz', '.rar',
  '.exe', '.dll', '.so', '.dylib',
] as const;

/**
 * Patterns to ignore during extraction.
 */
export const DEFAULT_IGNORE_PATTERNS = [
  '__MACOSX/',        // MacOS metadata
  '.DS_Store',        // MacOS file
  '.git/',            // Git directory
  'Thumbs.db',        // Windows thumbnail cache
] as const;

/**
 * Lock files to exclude.
 */
export const LOCK_FILES = [
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
] as const;

/**
 * Maximum file size for extraction (100KB).
 */
export const MAX_FILE_SIZE = 100 * 1024;
```

## Type Guards

```typescript
/**
 * Type guard to check if a value is a ZipTemplateError.
 */
export function isZipTemplateError(error: unknown): error is ZipTemplateError {
  return error instanceof Error && error.name === 'ZipTemplateError';
}

/**
 * Type guard to check if a source is from zip.
 */
export function isZipSource(source: TemplateSource): source is { type: 'zip'; zipPath: string } {
  return source.type === 'zip';
}
```

## Relationships

```
┌─────────────────┐
│ STARTER_TEMPLATES │
│ (constants.ts)   │
└────────┬────────┘
         │ name
         ▼
┌─────────────────┐      ┌──────────────────┐
│ Template Name   │─────▶│ Zip Filename     │
│ "Indochine Luxe"│      │ "indochine-luxe.zip" │
└────────┬────────┘      └────────┬─────────┘
         │                        │
         │ resolve                │ extract
         ▼                        ▼
┌─────────────────┐      ┌──────────────────┐
│ ResolvedTemplate│◀─────│ ZipExtractionResult │
│ - files[]       │      │ - files[]        │
│ - source        │      │ - skipped[]      │
└────────┬────────┘      │ - metadata       │
         │               └──────────────────┘
         │ prime
         ▼
┌─────────────────┐
│ LLM Priming     │
│ (assistant msg) │
└─────────────────┘
```

## Validation Rules

### Template Name Validation

```typescript
/**
 * Validates that a template name can be converted to a valid zip filename.
 */
function validateTemplateName(name: string): boolean {
  // Must be non-empty
  if (!name || name.trim().length === 0) return false;

  // Must produce a valid kebab-case filename
  const filename = templateNameToZipFilename(name);
  return filename.length > 4; // At least "x.zip"
}
```

### Path Validation

```typescript
/**
 * Validates that a file path is safe (no traversal, no absolute paths).
 */
function validatePath(filePath: string): boolean {
  // No empty paths
  if (!filePath || filePath.trim().length === 0) return false;

  // No absolute paths
  if (filePath.startsWith('/') || filePath.startsWith('\\')) return false;

  // No path traversal
  if (filePath.includes('..')) return false;

  // No Windows drive letters
  if (/^[a-zA-Z]:/.test(filePath)) return false;

  return true;
}
```

## State Transitions

This feature is stateless - each extraction is independent. No persistent state changes.

```
┌──────────┐     zip exists?     ┌──────────────┐
│ Request  │ ──────────────────▶ │ Extract Zip  │
│ Template │                     └──────┬───────┘
└────┬─────┘                            │
     │                                  │ success
     │ no zip                           ▼
     │                           ┌──────────────┐
     └──────────────────────────▶│ Return Files │
                                 └──────────────┘
                                        │
     ┌──────────────────────────────────┘
     │ zip failed
     ▼
┌──────────────┐
│ Fetch GitHub │ ─────────────────▶ [Return Files]
└──────────────┘
```
