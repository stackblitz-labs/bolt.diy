# Quickstart: Zip File Template Support

**Feature**: 003-zip-template-support
**Date**: 2026-01-30
**Purpose**: Implementation guidance and code patterns

## Prerequisites

Before starting implementation:

1. Ensure you have a sample zip file in `templates/` (e.g., `indochine-luxe.zip`)
2. Review the existing code:
   - `app/lib/.server/templates/github-template-fetcher.ts` - Pattern to follow
   - `app/lib/services/projectGenerationService.ts` - Integration point
   - `app/utils/selectStarterTemplate.ts` - Integration point

## Implementation Order

```
1. zip-template-fetcher.ts    (core extraction logic)
         ↓
2. template-resolver.ts       (unified resolution)
         ↓
3. index.ts                   (update exports)
         ↓
4. Unit tests                 (validate extraction)
         ↓
5. projectGenerationService.ts (integration)
         ↓
6. selectStarterTemplate.ts   (integration)
```

## Step 1: Create zip-template-fetcher.ts

**File**: `app/lib/.server/templates/zip-template-fetcher.ts`

```typescript
/**
 * Local zip file template fetcher.
 *
 * Extracts template files from zip archives in the templates/ directory.
 */

import fs from 'fs/promises';
import path from 'path';
import JSZip from 'jszip';
import { createScopedLogger } from '~/utils/logger';
import type { TemplateFile } from './github-template-fetcher';

const logger = createScopedLogger('zip-template-fetcher');

// ============================================================================
// TYPES
// ============================================================================

export type ZipTemplateErrorCode =
  | 'NOT_FOUND'
  | 'CORRUPTED'
  | 'EMPTY'
  | 'INVALID_PATH'
  | 'READ_ERROR'
  | 'FS_UNAVAILABLE';

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

export interface SkippedFile {
  path: string;
  reason: 'binary' | 'oversized' | 'filtered' | 'invalid_path';
}

export interface ZipExtractionResult {
  files: TemplateFile[];
  skipped: SkippedFile[];
  metadata: {
    zipFilename: string;
    strippedRootFolder: string | null;
    totalEntriesInZip: number;
    extractionMs: number;
  };
}

export interface ZipFetcherOptions {
  maxFileSize?: number;
  ignorePatterns?: string[];
  stripRootFolder?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const TEMPLATES_DIR = path.join(process.cwd(), 'templates');
const MAX_FILE_SIZE = 100 * 1024; // 100KB

const BINARY_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.svg',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.mp3', '.mp4', '.webm', '.wav', '.ogg',
  '.pdf', '.zip', '.tar', '.gz', '.rar',
];

const DEFAULT_IGNORE_PATTERNS = [
  '__MACOSX/',
  '.DS_Store',
  '.git/',
  'Thumbs.db',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
];

// ============================================================================
// HELPERS
// ============================================================================

export function templateNameToZipFilename(templateName: string): string {
  return templateName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    + '.zip';
}

export function getZipPath(templateName: string): string {
  const filename = templateNameToZipFilename(templateName);
  return path.join(TEMPLATES_DIR, filename);
}

export async function zipExists(zipPath: string): Promise<boolean> {
  try {
    await fs.access(zipPath);
    return true;
  } catch {
    return false;
  }
}

function isPathSafe(filePath: string): boolean {
  if (filePath.startsWith('/') || filePath.startsWith('\\')) {
    return false;
  }
  if (filePath.includes('..')) {
    return false;
  }
  if (/^[a-zA-Z]:/.test(filePath)) {
    return false;
  }
  return true;
}

function isBinaryFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return BINARY_EXTENSIONS.includes(ext);
}

function shouldIgnore(filePath: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    if (pattern.endsWith('/')) {
      if (filePath.startsWith(pattern) || filePath.includes('/' + pattern)) {
        return true;
      }
    } else {
      if (filePath === pattern || filePath.endsWith('/' + pattern)) {
        return true;
      }
    }
  }
  return false;
}

function findRootFolder(entries: string[]): string | null {
  const validEntries = entries.filter(e => !e.startsWith('__MACOSX'));
  const topLevel = new Set<string>();

  for (const entry of validEntries) {
    const parts = entry.split('/');
    if (parts.length > 1 && parts[0]) {
      topLevel.add(parts[0]);
    }
  }

  if (topLevel.size === 1) {
    return topLevel.values().next().value;
  }

  return null;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

export async function fetchTemplateFromZip(
  zipPath: string,
  options?: ZipFetcherOptions
): Promise<ZipExtractionResult> {
  const startTime = Date.now();
  const maxFileSize = options?.maxFileSize ?? MAX_FILE_SIZE;
  const ignorePatterns = [...DEFAULT_IGNORE_PATTERNS, ...(options?.ignorePatterns ?? [])];
  const stripRootFolder = options?.stripRootFolder ?? true;

  logger.info(`[ZIP_FETCH] Extracting: ${zipPath}`);

  // Check file exists
  if (!(await zipExists(zipPath))) {
    throw new ZipTemplateError(
      `Template zip file not found: ${zipPath}`,
      'NOT_FOUND',
      zipPath
    );
  }

  // Read zip file
  let zipBuffer: Buffer;
  try {
    zipBuffer = await fs.readFile(zipPath);
  } catch (error) {
    throw new ZipTemplateError(
      `Failed to read template zip: ${zipPath}`,
      'READ_ERROR',
      zipPath,
      error instanceof Error ? error : undefined
    );
  }

  // Parse zip
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(zipBuffer);
  } catch (error) {
    throw new ZipTemplateError(
      `Failed to extract template: invalid or corrupted zip file`,
      'CORRUPTED',
      zipPath,
      error instanceof Error ? error : undefined
    );
  }

  // Find root folder
  const entries = Object.keys(zip.files);
  const rootFolder = stripRootFolder ? findRootFolder(entries) : null;

  if (rootFolder) {
    logger.debug(`[ZIP_FETCH] Stripping root folder: ${rootFolder}`);
  }

  // Extract files
  const files: TemplateFile[] = [];
  const skipped: SkippedFile[] = [];

  const filePromises = entries.map(async (entryPath) => {
    const zipEntry = zip.files[entryPath];

    // Skip directories
    if (zipEntry.dir) {
      return;
    }

    // Normalize path
    let normalizedPath = entryPath;
    if (rootFolder && entryPath.startsWith(rootFolder + '/')) {
      normalizedPath = entryPath.substring(rootFolder.length + 1);
    }

    // Skip empty paths
    if (!normalizedPath) {
      return;
    }

    // Check path safety
    if (!isPathSafe(normalizedPath)) {
      skipped.push({ path: normalizedPath, reason: 'invalid_path' });
      logger.warn(`[ZIP_FETCH] Skipping unsafe path: ${normalizedPath}`);
      return;
    }

    // Check ignore patterns
    if (shouldIgnore(normalizedPath, ignorePatterns)) {
      skipped.push({ path: normalizedPath, reason: 'filtered' });
      return;
    }

    // Check binary
    if (isBinaryFile(normalizedPath)) {
      skipped.push({ path: normalizedPath, reason: 'binary' });
      return;
    }

    // Extract content
    try {
      const content = await zipEntry.async('string');

      // Check size
      if (content.length > maxFileSize) {
        skipped.push({ path: normalizedPath, reason: 'oversized' });
        logger.debug(`[ZIP_FETCH] Skipping large file: ${normalizedPath} (${content.length} bytes)`);
        return;
      }

      files.push({
        name: path.basename(normalizedPath),
        path: normalizedPath,
        content,
      });
    } catch {
      // Binary or encoding issue
      skipped.push({ path: normalizedPath, reason: 'binary' });
    }
  });

  await Promise.all(filePromises);

  // Check for empty result
  if (files.length === 0) {
    throw new ZipTemplateError(
      `Template zip file is empty: ${zipPath}`,
      'EMPTY',
      zipPath
    );
  }

  const extractionMs = Date.now() - startTime;

  logger.info(`[ZIP_FETCH] Extracted ${files.length} files in ${extractionMs}ms`);

  return {
    files,
    skipped,
    metadata: {
      zipFilename: path.basename(zipPath),
      strippedRootFolder: rootFolder,
      totalEntriesInZip: entries.length,
      extractionMs,
    },
  };
}
```

## Step 2: Create template-resolver.ts

**File**: `app/lib/.server/templates/template-resolver.ts`

```typescript
/**
 * Unified template resolver.
 *
 * Resolves templates from the best available source (local zip or GitHub).
 */

import { createScopedLogger } from '~/utils/logger';
import { fetchTemplateFromGitHub, type TemplateFile } from './github-template-fetcher';
import {
  fetchTemplateFromZip,
  getZipPath,
  zipExists,
  ZipTemplateError,
} from './zip-template-fetcher';

const logger = createScopedLogger('template-resolver');

// ============================================================================
// TYPES
// ============================================================================

export type TemplateSource =
  | { type: 'zip'; zipPath: string }
  | { type: 'github'; repo: string; branch?: string };

export interface ResolvedTemplate {
  files: TemplateFile[];
  source: TemplateSource;
  templateName: string;
}

export interface TemplateResolverOptions {
  githubRepo: string;
  githubToken?: string;
  preferZip?: boolean;
  zipOnly?: boolean;
}

// ============================================================================
// ENVIRONMENT DETECTION
// ============================================================================

let _fsAvailable: boolean | null = null;

export function canAccessFileSystem(): boolean {
  if (_fsAvailable !== null) {
    return _fsAvailable;
  }

  try {
    // Try to require fs - will fail in Cloudflare
    require('fs/promises');
    _fsAvailable = true;
  } catch {
    _fsAvailable = false;
  }

  return _fsAvailable;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

export async function resolveTemplate(
  templateName: string,
  options: TemplateResolverOptions
): Promise<ResolvedTemplate> {
  const { githubRepo, githubToken, preferZip = true, zipOnly = false } = options;

  logger.info(`[RESOLVE] Resolving template: ${templateName}`);

  // Try local zip first (if fs available and preferZip)
  if (preferZip && canAccessFileSystem()) {
    const zipPath = getZipPath(templateName);

    try {
      if (await zipExists(zipPath)) {
        logger.info(`[RESOLVE] Found local zip: ${zipPath}`);

        const result = await fetchTemplateFromZip(zipPath);

        return {
          files: result.files,
          source: { type: 'zip', zipPath },
          templateName,
        };
      } else {
        logger.debug(`[RESOLVE] No local zip at: ${zipPath}`);
      }
    } catch (error) {
      if (error instanceof ZipTemplateError) {
        logger.warn(`[RESOLVE] Zip extraction failed: ${error.message}`);
      } else {
        logger.error(`[RESOLVE] Unexpected error with zip:`, error);
      }

      // If zipOnly, rethrow
      if (zipOnly) {
        throw error;
      }

      // Otherwise continue to GitHub fallback
    }
  }

  // GitHub fallback
  if (zipOnly) {
    throw new Error(
      `Template zip not available and zipOnly=true: ${templateName}`
    );
  }

  logger.info(`[RESOLVE] Falling back to GitHub: ${githubRepo}`);

  const files = await fetchTemplateFromGitHub(githubRepo, githubToken);

  return {
    files,
    source: { type: 'github', repo: githubRepo },
    templateName,
  };
}
```

## Step 3: Update index.ts Exports

**File**: `app/lib/.server/templates/index.ts`

```typescript
/**
 * Template utilities for server-side template fetching and LLM priming.
 */

// Existing exports
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

## Step 4: Integration in projectGenerationService.ts

**Change in** `app/lib/services/projectGenerationService.ts`:

```typescript
// Before (line ~398):
const allFiles = await fetchTemplateFromGitHub(template.githubRepo, githubToken);

// After:
import { resolveTemplate } from '~/lib/.server/templates';

// ...

const resolved = await resolveTemplate(template.name, {
  githubRepo: template.githubRepo,
  githubToken,
});
const allFiles = resolved.files;

logger.info(`[TEMPLATE_PRIMING] Template loaded from ${resolved.source.type}`);
```

## Step 5: Integration in selectStarterTemplate.ts

**Change in** `app/utils/selectStarterTemplate.ts`:

```typescript
// Before (getGitHubRepoContent function):
const response = await fetch(`/api/github-template?repo=${encodeURIComponent(repoName)}`);

// After (new function):
import { resolveTemplate, canAccessFileSystem } from '~/lib/.server/templates';

// In getTemplates():
// If running server-side with fs access, use resolveTemplate
// Otherwise, use the API endpoint as before
```

**Note**: `selectStarterTemplate.ts` is client-side code. The resolver is server-side only. For client-side template loading, continue using the `/api/github-template` endpoint. The zip support is primarily for `projectGenerationService.ts` which runs server-side.

## Testing

### Unit Test Example

**File**: `tests/unit/templates/zip-template-fetcher.test.ts`

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import path from 'path';
import {
  fetchTemplateFromZip,
  templateNameToZipFilename,
  getZipPath,
  ZipTemplateError,
} from '~/lib/.server/templates/zip-template-fetcher';

describe('zip-template-fetcher', () => {
  describe('templateNameToZipFilename', () => {
    it('converts template name to kebab-case', () => {
      expect(templateNameToZipFilename('Indochine Luxe')).toBe('indochine-luxe.zip');
      expect(templateNameToZipFilename('Bold Feast v2')).toBe('bold-feast-v2.zip');
    });
  });

  describe('fetchTemplateFromZip', () => {
    const testZipPath = path.join(process.cwd(), 'templates', 'indochine-luxe.zip');

    it('extracts files from valid zip', async () => {
      const result = await fetchTemplateFromZip(testZipPath);

      expect(result.files.length).toBeGreaterThan(0);
      expect(result.files[0]).toHaveProperty('name');
      expect(result.files[0]).toHaveProperty('path');
      expect(result.files[0]).toHaveProperty('content');
    });

    it('strips root folder', async () => {
      const result = await fetchTemplateFromZip(testZipPath);

      // Paths should not start with 'indochine-luxe/'
      for (const file of result.files) {
        expect(file.path).not.toMatch(/^indochine-luxe\//);
      }
    });

    it('filters binary files', async () => {
      const result = await fetchTemplateFromZip(testZipPath);

      for (const file of result.files) {
        expect(file.path).not.toMatch(/\.(png|jpg|woff2?)$/);
      }
    });

    it('throws NOT_FOUND for missing zip', async () => {
      await expect(
        fetchTemplateFromZip('/nonexistent/path.zip')
      ).rejects.toThrow(ZipTemplateError);
    });
  });
});
```

## Verification Checklist

- [ ] `templates/indochine-luxe.zip` exists and contains valid files
- [ ] `fetchTemplateFromZip` extracts files correctly
- [ ] Root folder stripping works (`indochine-luxe/src/App.tsx` → `src/App.tsx`)
- [ ] Binary files are skipped
- [ ] `__MACOSX/` entries are filtered
- [ ] Path traversal attempts are rejected
- [ ] `resolveTemplate` tries zip first, falls back to GitHub
- [ ] Cloudflare environment detection works
- [ ] Unit tests pass
- [ ] Integration with `projectGenerationService.ts` works
- [ ] Template priming produces same result as GitHub fetch
