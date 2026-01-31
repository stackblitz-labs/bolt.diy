/**
 * Unified template resolver.
 *
 * Resolves templates from the best available source (local zip or GitHub).
 * Prioritizes local zip files for faster loading and offline capability.
 */

import { createScopedLogger } from '~/utils/logger';
import { fetchTemplateFromGitHub, type TemplateFile } from './github-template-fetcher';
import { fetchTemplateFromZip, getZipPath, zipExists, ZipTemplateError } from './zip-template-fetcher';

const logger = createScopedLogger('template-resolver');

/*
 * ============================================================================
 * TYPES
 * ============================================================================
 */

/**
 * Source information for a loaded template.
 */
export type TemplateSource = { type: 'zip'; zipPath: string } | { type: 'github'; repo: string; branch?: string };

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

/*
 * ============================================================================
 * ENVIRONMENT DETECTION
 * ============================================================================
 */

let _fsAvailable: boolean | null = null;

/**
 * Checks if the current environment has filesystem access.
 *
 * Returns false in Cloudflare Workers/Pages where fs is unavailable.
 * Caches the result after first check.
 */
export function canAccessFileSystem(): boolean {
  if (_fsAvailable !== null) {
    return _fsAvailable;
  }

  try {
    // Dynamic require - will fail in Cloudflare where fs is not available
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('fs/promises');
    _fsAvailable = true;
  } catch {
    _fsAvailable = false;
  }

  return _fsAvailable;
}

/**
 * Resets the cached filesystem availability check.
 * Useful for testing.
 */
export function resetFsAvailabilityCache(): void {
  _fsAvailable = null;
}

/*
 * ============================================================================
 * MAIN FUNCTION
 * ============================================================================
 */

/**
 * Resolves a template from the best available source.
 *
 * Checks for local zip file first (if filesystem available),
 * then falls back to GitHub fetch.
 *
 * @param templateName - Template name from STARTER_TEMPLATES (e.g., "Indochine Luxe")
 * @param options - Resolution options including GitHub fallback config
 * @returns Promise resolving to resolved template with files and source info
 * @throws Error if no source available or all sources fail
 */
export async function resolveTemplate(
  templateName: string,
  options: TemplateResolverOptions,
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

        logger.info(`[RESOLVE] Extracted ${result.files.length} files from zip in ${result.metadata.extractionMs}ms`);

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
        logger.warn(`[RESOLVE] Zip extraction failed: ${error.message} (code: ${error.code})`);
      } else {
        logger.error(`[RESOLVE] Unexpected error with zip:`, error);
      }

      // If zipOnly, rethrow
      if (zipOnly) {
        throw error;
      }

      // Otherwise continue to GitHub fallback
    }
  } else if (preferZip && !canAccessFileSystem()) {
    logger.debug('[RESOLVE] Filesystem not available, skipping zip check');
  }

  // GitHub fallback
  if (zipOnly) {
    throw new Error(`Template zip not available and zipOnly=true: ${templateName}`);
  }

  logger.info(`[RESOLVE] Falling back to GitHub: ${githubRepo}`);

  const files = await fetchTemplateFromGitHub(githubRepo, githubToken);

  logger.info(`[RESOLVE] Fetched ${files.length} files from GitHub`);

  return {
    files,
    source: { type: 'github', repo: githubRepo },
    templateName,
  };
}
