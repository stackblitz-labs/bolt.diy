/**
 * Server-side GitHub template fetching utilities.
 *
 * Extracts and adapts logic from api.github-template.ts for use in
 * projectGenerationService.ts to prime LLM with template files.
 */

import ignore from 'ignore';
import JSZip from 'jszip';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('github-template-fetcher');

/**
 * Default ignore patterns applied when a template doesn't have a .bolt/ignore file.
 *
 * These patterns exclude files that are typically read-only configuration or
 * boilerplate that the LLM doesn't need to customize. This reduces context usage
 * by ~70-80%, leaving more room for business data and LLM reasoning.
 */
const DEFAULT_IGNORE_PATTERNS = [
  // Configuration files - use but don't modify
  'vite.config.*',
  'tsconfig*.json',
  'tailwind.config.*',
  'postcss.config.*',
  'eslint.config.*',
  '.prettierrc*',

  // Build/Deploy configuration
  '.gitignore',
  'README.md',
  '.github/',

  // UI component libraries (shadcn/ui style) - use but don't modify
  'src/components/ui/',
  'components/ui/',
  'src/lib/utils.ts',
  'lib/utils.ts',

  // Public assets (images, favicons) - reference but don't include content
  'public/',
];

/**
 * Represents a file fetched from a GitHub template repository.
 */
export interface TemplateFile {
  name: string;
  path: string;
  content: string;
}

/**
 * Result of applying ignore patterns to template files.
 */
export interface FilteredTemplateFiles {
  /** Files to include in the template priming message */
  includedFiles: TemplateFile[];

  /** Files excluded by .bolt/ignore patterns (read-only references) */
  ignoredFiles: TemplateFile[];

  /** Content of the .bolt/ignore file if found */
  ignoreContent: string | null;
}

/**
 * Fetches all files from a GitHub repository using the zipball approach.
 *
 * Downloads the entire repository as a zip file in 2 API calls, avoiding
 * GitHub's secondary rate limits that occur with individual file fetching.
 *
 * @param githubRepo - Repository in "owner/repo" format (e.g., "neweb-learn/Bamboobistro")
 * @param githubToken - Optional GitHub personal access token for rate limiting
 * @returns Array of template files with their content
 */
async function fetchTemplateFromGitHubZip(githubRepo: string, githubToken?: string): Promise<TemplateFile[]> {
  const baseUrl = 'https://api.github.com';

  logger.info(`[TEMPLATE_FETCH] Fetching zipball for: ${githubRepo}`);

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'website-agent',
    ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
  };

  // 1. Get repository info to find default branch
  const repoResponse = await fetch(`${baseUrl}/repos/${githubRepo}`, { headers });

  if (!repoResponse.ok) {
    throw new Error(`Repository not found: ${githubRepo} (${repoResponse.status})`);
  }

  const repoData = (await repoResponse.json()) as { default_branch: string };
  const defaultBranch = repoData.default_branch;

  logger.debug(`[TEMPLATE_FETCH] Default branch: ${defaultBranch}`);

  // 2. Fetch the zipball (entire repo in one call)
  const zipUrl = `${baseUrl}/repos/${githubRepo}/zipball/${defaultBranch}`;
  const zipResponse = await fetch(zipUrl, { headers });

  if (!zipResponse.ok) {
    throw new Error(`Failed to fetch zipball: ${zipResponse.status}`);
  }

  const zipArrayBuffer = await zipResponse.arrayBuffer();

  // 3. Extract with JSZip
  const zip = await JSZip.loadAsync(zipArrayBuffer);

  // Find the root folder name (GitHub adds a prefix like "owner-repo-commit/")
  let rootFolderName = '';
  zip.forEach((relativePath) => {
    if (!rootFolderName && relativePath.includes('/')) {
      rootFolderName = relativePath.split('/')[0];
    }
  });

  // 4. Extract files (excluding .git, applying size limits)
  const filePromises = Object.keys(zip.files).map(async (filename) => {
    const zipEntry = zip.files[filename];

    // Skip directories
    if (zipEntry.dir) {
      return null;
    }

    // Remove the root folder from the path
    let normalizedPath = filename;

    if (rootFolderName && filename.startsWith(rootFolderName + '/')) {
      normalizedPath = filename.substring(rootFolderName.length + 1);
    }

    // Skip empty paths
    if (!normalizedPath) {
      return null;
    }

    // Skip .git directory
    if (normalizedPath.startsWith('.git/') || normalizedPath === '.git') {
      return null;
    }

    // Check if this is a binary file by extension
    const binaryExtensions = [
      '.png',
      '.jpg',
      '.jpeg',
      '.gif',
      '.ico',
      '.woff',
      '.woff2',
      '.ttf',
      '.eot',
      '.mp3',
      '.mp4',
      '.webm',
      '.pdf',
      '.zip',
      '.tar',
      '.gz',
    ];
    const ext = normalizedPath.substring(normalizedPath.lastIndexOf('.')).toLowerCase();

    if (binaryExtensions.includes(ext)) {
      // Skip binary files for now (we could base64 encode them if needed)
      return null;
    }

    // Skip lock files - never customized, waste of context
    const isLockFile =
      normalizedPath.endsWith('package-lock.json') ||
      normalizedPath.endsWith('yarn.lock') ||
      normalizedPath.endsWith('pnpm-lock.yaml');

    if (isLockFile) {
      logger.debug(`[TEMPLATE_FETCH] Skipping lock file: ${normalizedPath}`);
      return null;
    }

    try {
      // Get the file content as string
      const content = await zipEntry.async('string');

      // Skip very large files (>100KB)
      if (content.length > 100000) {
        logger.debug(`[TEMPLATE_FETCH] Skipping large file: ${normalizedPath} (${content.length} bytes)`);
        return null;
      }

      return {
        name: normalizedPath.split('/').pop() || '',
        path: normalizedPath,
        content,
      };
    } catch {
      // File might be binary or have encoding issues
      logger.debug(`[TEMPLATE_FETCH] Skipping non-text file: ${normalizedPath}`);
      return null;
    }
  });

  const results = await Promise.all(filePromises);
  const files = results.filter((f): f is TemplateFile => f !== null);

  logger.info(`[TEMPLATE_FETCH] Successfully fetched ${files.length} files from zipball`);

  return files;
}

/**
 * Fetches all files from a GitHub repository using the Contents API.
 *
 * This is a fallback method that fetches files individually. It may hit
 * GitHub's secondary rate limits for repositories with many files.
 *
 * @param githubRepo - Repository in "owner/repo" format (e.g., "neweb-learn/Bamboobistro")
 * @param githubToken - Optional GitHub personal access token for rate limiting
 * @returns Array of template files with their content
 */
async function fetchTemplateFromGitHubContents(githubRepo: string, githubToken?: string): Promise<TemplateFile[]> {
  const baseUrl = 'https://api.github.com';

  logger.info(`[TEMPLATE_FETCH] Fetching repository via Contents API: ${githubRepo}`);

  // Get repository info to find default branch
  const repoResponse = await fetch(`${baseUrl}/repos/${githubRepo}`, {
    headers: {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'website-agent',
      ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
    },
  });

  if (!repoResponse.ok) {
    throw new Error(`Repository not found: ${githubRepo} (${repoResponse.status})`);
  }

  const repoData = (await repoResponse.json()) as { default_branch: string };
  const defaultBranch = repoData.default_branch;

  logger.debug(`[TEMPLATE_FETCH] Default branch: ${defaultBranch}`);

  // Get the tree recursively
  const treeResponse = await fetch(`${baseUrl}/repos/${githubRepo}/git/trees/${defaultBranch}?recursive=1`, {
    headers: {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'website-agent',
      ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
    },
  });

  if (!treeResponse.ok) {
    throw new Error(`Failed to fetch repository tree: ${treeResponse.status}`);
  }

  const treeData = (await treeResponse.json()) as { tree: Array<{ path: string; type: string; size: number }> };

  // Filter for files only (not directories) and apply size limits
  const files = treeData.tree.filter((item) => {
    if (item.type !== 'blob') {
      return false;
    }

    // Skip .git directory
    if (item.path.startsWith('.git/')) {
      return false;
    }

    // Skip lock files - never customized, waste of context
    const isLockFile =
      item.path.endsWith('package-lock.json') ||
      item.path.endsWith('yarn.lock') ||
      item.path.endsWith('pnpm-lock.yaml');

    if (isLockFile) {
      return false;
    }

    // Limit size to 100KB
    if (item.size >= 100000) {
      return false;
    }

    return true;
  });

  logger.info(`[TEMPLATE_FETCH] Found ${files.length} files to fetch`);

  // Fetch file contents in batches to avoid overwhelming the API
  const batchSize = 10;
  const fileContents: TemplateFile[] = [];

  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    const batchPromises = batch.map(async (file) => {
      try {
        const contentResponse = await fetch(`${baseUrl}/repos/${githubRepo}/contents/${file.path}`, {
          headers: {
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'website-agent',
            ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
          },
        });

        if (!contentResponse.ok) {
          logger.warn(`[TEMPLATE_FETCH] Failed to fetch ${file.path}: ${contentResponse.status}`);
          return null;
        }

        const contentData = (await contentResponse.json()) as { content: string };
        const content = atob(contentData.content.replace(/\s/g, ''));

        return {
          name: file.path.split('/').pop() || '',
          path: file.path,
          content,
        };
      } catch (error) {
        logger.warn(`[TEMPLATE_FETCH] Error fetching ${file.path}:`, error);
        return null;
      }
    });

    const batchResults = await Promise.all(batchPromises);
    fileContents.push(...(batchResults.filter(Boolean) as TemplateFile[]));

    // Add a small delay between batches to be respectful to the API
    if (i + batchSize < files.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  logger.info(`[TEMPLATE_FETCH] Successfully fetched ${fileContents.length} files`);

  return fileContents;
}

/**
 * Fetches all files from a GitHub repository.
 *
 * Uses the zipball approach (2 API calls) by default to avoid GitHub's
 * secondary rate limits. Falls back to the Contents API if zipball fails.
 *
 * @param githubRepo - Repository in "owner/repo" format (e.g., "neweb-learn/Bamboobistro")
 * @param githubToken - Optional GitHub personal access token for rate limiting
 * @returns Array of template files with their content
 */
export async function fetchTemplateFromGitHub(githubRepo: string, githubToken?: string): Promise<TemplateFile[]> {
  try {
    // Try zipball first (fast, no rate limit issues)
    return await fetchTemplateFromGitHubZip(githubRepo, githubToken);
  } catch (error) {
    logger.warn('[TEMPLATE_FETCH] Zipball failed, falling back to Contents API:', error);

    return await fetchTemplateFromGitHubContents(githubRepo, githubToken);
  }
}

/**
 * Applies .bolt/ignore patterns to filter template files.
 *
 * When a template has a .bolt/ignore file, uses those patterns.
 * Otherwise, applies DEFAULT_IGNORE_PATTERNS to reduce context usage.
 *
 * @param files - All template files fetched from GitHub
 * @returns Filtered files split into included and ignored sets
 */
export function applyIgnorePatterns(files: TemplateFile[]): FilteredTemplateFiles {
  // Filter out .git files first
  const withoutGit = files.filter((f) => !f.path.startsWith('.git'));

  // Find the .bolt/ignore file
  const ignoreFile = withoutGit.find((f) => f.path === '.bolt/ignore');
  const ignoreContent = ignoreFile?.content ?? null;

  // Filter out .bolt directory from included files
  const withoutBolt = withoutGit.filter((f) => !f.path.startsWith('.bolt'));

  // Use custom patterns if available, otherwise use defaults
  const patterns = ignoreContent
    ? ignoreContent
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
    : DEFAULT_IGNORE_PATTERNS;

  const usingDefaults = !ignoreContent;

  if (usingDefaults) {
    logger.debug('[TEMPLATE_FETCH] No .bolt/ignore found, applying default ignore patterns');
  }

  const ig = ignore().add(patterns);

  const includedFiles: TemplateFile[] = [];
  const ignoredFiles: TemplateFile[] = [];

  for (const file of withoutBolt) {
    if (ig.ignores(file.path)) {
      ignoredFiles.push(file);
    } else {
      includedFiles.push(file);
    }
  }

  logger.debug(
    `[TEMPLATE_FETCH] Applied ${usingDefaults ? 'default' : 'custom'} ignore patterns: ${includedFiles.length} included, ${ignoredFiles.length} ignored`,
  );

  return {
    includedFiles,
    ignoredFiles,
    ignoreContent,
  };
}
