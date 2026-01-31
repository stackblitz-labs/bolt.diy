/**
 * Local zip file template fetcher.
 *
 * Extracts template files from zip archives in the templates/ directory.
 * Provides an alternative to GitHub-based template fetching for faster
 * loading and offline capability.
 */

import fs from 'fs/promises';
import path from 'path';
import JSZip from 'jszip';
import { createScopedLogger } from '~/utils/logger';
import type { TemplateFile } from './github-template-fetcher';

const logger = createScopedLogger('zip-template-fetcher');

/*
 * ============================================================================
 * TYPES
 * ============================================================================
 */

/**
 * Error codes for zip template operations.
 */
export type ZipTemplateErrorCode =
  | 'NOT_FOUND'
  | 'CORRUPTED'
  | 'EMPTY'
  | 'INVALID_PATH'
  | 'READ_ERROR'
  | 'FS_UNAVAILABLE';

/**
 * Custom error class for zip template operations.
 */
export class ZipTemplateError extends Error {
  constructor(
    message: string,
    readonly code: ZipTemplateErrorCode,
    readonly zipPath?: string,
    readonly cause?: Error,
  ) {
    super(message);
    this.name = 'ZipTemplateError';
  }
}

/**
 * A file that was skipped during extraction.
 */
export interface SkippedFile {
  path: string;
  reason: 'binary' | 'oversized' | 'filtered' | 'invalid_path';
}

/**
 * Result of extracting a zip template.
 */
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

/**
 * Options for zip template fetching.
 */
export interface ZipFetcherOptions {
  maxFileSize?: number;
  ignorePatterns?: string[];
  stripRootFolder?: boolean;
}

/*
 * ============================================================================
 * CONSTANTS
 * ============================================================================
 */

const TEMPLATES_DIR = path.join(process.cwd(), 'templates');
const MAX_FILE_SIZE = 100 * 1024; // 100KB

const BINARY_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.ico',
  '.webp',
  '.svg',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.otf',
  '.mp3',
  '.mp4',
  '.webm',
  '.wav',
  '.ogg',
  '.pdf',
  '.zip',
  '.tar',
  '.gz',
  '.rar',
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

/*
 * ============================================================================
 * HELPERS
 * ============================================================================
 */

/**
 * Converts a template display name to its corresponding zip filename.
 * E.g., "Indochine Luxe" → "indochine-luxe.zip"
 */
export function templateNameToZipFilename(templateName: string): string {
  return (
    templateName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '') + '.zip'
  );
}

/**
 * Gets the full path to a template zip file.
 */
export function getZipPath(templateName: string): string {
  const filename = templateNameToZipFilename(templateName);
  return path.join(TEMPLATES_DIR, filename);
}

/**
 * Checks if a zip file exists at the given path.
 */
export async function zipExists(zipPath: string): Promise<boolean> {
  try {
    await fs.access(zipPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates that a file path is safe (no path traversal).
 */
function isPathSafe(filePath: string): boolean {
  // Reject absolute paths
  if (filePath.startsWith('/') || filePath.startsWith('\\')) {
    return false;
  }

  // Reject path traversal
  if (filePath.includes('..')) {
    return false;
  }

  // Reject Windows absolute paths
  if (/^[a-zA-Z]:/.test(filePath)) {
    return false;
  }

  return true;
}

/**
 * Checks if a file is binary based on its extension.
 */
function isBinaryFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return BINARY_EXTENSIONS.includes(ext);
}

/**
 * Checks if a file should be ignored based on patterns.
 */
function shouldIgnore(filePath: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    if (pattern.endsWith('/')) {
      // Directory pattern
      if (filePath.startsWith(pattern) || filePath.includes('/' + pattern)) {
        return true;
      }
    } else {
      // File pattern
      if (filePath === pattern || filePath.endsWith('/' + pattern)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Finds the common root folder in zip entries, if any.
 * Returns null if there are multiple top-level entries.
 */
function findRootFolder(entries: string[]): string | null {
  const validEntries = entries.filter((e) => !e.startsWith('__MACOSX'));
  const topLevel = new Set<string>();

  for (const entry of validEntries) {
    const parts = entry.split('/');

    if (parts.length > 1 && parts[0]) {
      topLevel.add(parts[0]);
    }
  }

  if (topLevel.size === 1) {
    return topLevel.values().next().value ?? null;
  }

  return null;
}

/*
 * ============================================================================
 * MAIN FUNCTION
 * ============================================================================
 */

/**
 * Extracts template files from a local zip archive.
 *
 * @param zipPath - Full path to the zip file
 * @param options - Extraction options
 * @returns Extraction result with files and metadata
 */
export async function fetchTemplateFromZip(zipPath: string, options?: ZipFetcherOptions): Promise<ZipExtractionResult> {
  const startTime = Date.now();
  const maxFileSize = options?.maxFileSize ?? MAX_FILE_SIZE;
  const ignorePatterns = [...DEFAULT_IGNORE_PATTERNS, ...(options?.ignorePatterns ?? [])];
  const stripRootFolder = options?.stripRootFolder ?? true;

  logger.info(`[ZIP_FETCH] Extracting: ${zipPath}`);

  // Check file exists
  if (!(await zipExists(zipPath))) {
    throw new ZipTemplateError(`Template zip file not found: ${zipPath}`, 'NOT_FOUND', zipPath);
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
      error instanceof Error ? error : undefined,
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
      error instanceof Error ? error : undefined,
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
    throw new ZipTemplateError(`Template zip file is empty: ${zipPath}`, 'EMPTY', zipPath);
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
