/**
 * Template Registry Loader
 *
 * Loads, caches, and validates restaurant website templates from the registry.
 * Provides type-safe access to template metadata with automatic schema validation.
 *
 * Based on specs/001-phase1-plan/plan.md
 */

import fs from 'fs/promises';
import path from 'path';
import { validateTemplateRegistry, type TemplateRegistry, type TemplateMetadata } from './schema';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('TemplateRegistry');

/*
 * ============================================================================
 * CACHE CONFIGURATION
 * ============================================================================
 */

interface RegistryCache {
  registry: TemplateRegistry | null;
  loadedAt: number | null;
  ttl: number; // Time to live in milliseconds
}

const cache: RegistryCache = {
  registry: null,
  loadedAt: null,
  ttl: 1000 * 60 * 5, // 5 minutes default TTL
};

/*
 * ============================================================================
 * REGISTRY PATHS
 * ============================================================================
 */

const REGISTRY_PATH = path.join(process.cwd(), 'templates', 'registry.json');
const TEMPLATES_DIR = path.join(process.cwd(), 'templates');

/*
 * ============================================================================
 * REGISTRY LOADER
 * ============================================================================
 */

/**
 * Loads the template registry from disk with caching and validation
 */
export async function loadTemplateRegistry(options?: {
  bypassCache?: boolean;
  ttl?: number;
}): Promise<TemplateRegistry> {
  const { bypassCache = false, ttl = cache.ttl } = options || {};

  // Check cache validity
  if (!bypassCache && cache.registry && cache.loadedAt) {
    const cacheAge = Date.now() - cache.loadedAt;

    if (cacheAge < ttl) {
      logger.debug(`Returning cached registry (age: ${Math.round(cacheAge / 1000)}s)`);
      return cache.registry;
    }
  }

  logger.info('Loading template registry from disk...');

  try {
    // Read registry file
    const registryContent = await fs.readFile(REGISTRY_PATH, 'utf-8');
    const registryData = JSON.parse(registryContent);

    // Validate against Zod schema
    const validatedRegistry = validateTemplateRegistry(registryData);

    // Update cache
    cache.registry = validatedRegistry;
    cache.loadedAt = Date.now();
    cache.ttl = ttl;

    logger.info(`Loaded ${validatedRegistry.templates.length} templates (version ${validatedRegistry.version})`);

    return validatedRegistry;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      logger.error(`Registry file not found at ${REGISTRY_PATH}`);
      throw new RegistryNotFoundError(`Template registry not found. Run 'pnpm templates:seed' to create it.`);
    }

    logger.error('Failed to load template registry:', error);
    throw new RegistryLoadError(
      `Failed to load template registry: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

/**
 * Gets a specific template by ID from the registry
 */
export async function getTemplate(templateId: string): Promise<TemplateMetadata> {
  const registry = await loadTemplateRegistry();
  const template = registry.templates.find((t) => t.id === templateId);

  if (!template) {
    throw new TemplateNotFoundError(`Template '${templateId}' not found in registry`);
  }

  return template;
}

/**
 * Gets all templates from the registry
 */
export async function getAllTemplates(): Promise<TemplateMetadata[]> {
  const registry = await loadTemplateRegistry();
  return registry.templates;
}

/**
 * Finds templates matching specific criteria
 */
export async function findTemplates(criteria: {
  tone?: string[];
  requiredSections?: string[];
}): Promise<TemplateMetadata[]> {
  const registry = await loadTemplateRegistry();

  return registry.templates.filter((template) => {
    // Filter by tone if specified
    if (criteria.tone && criteria.tone.length > 0) {
      const hasMatchingTone = criteria.tone.some((tone) => template.tone.includes(tone));

      if (!hasMatchingTone) {
        return false;
      }
    }

    // Filter by required sections if specified
    if (criteria.requiredSections && criteria.requiredSections.length > 0) {
      const hasAllSections = criteria.requiredSections.every((section) => template.requiredSections.includes(section));

      if (!hasAllSections) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Checks if a template exists in the registry
 */
export async function templateExists(templateId: string): Promise<boolean> {
  try {
    await getTemplate(templateId);
    return true;
  } catch (error) {
    if (error instanceof TemplateNotFoundError) {
      return false;
    }

    throw error;
  }
}

/**
 * Validates that a template directory exists and contains required files
 */
export async function validateTemplateStructure(templateId: string): Promise<{
  valid: boolean;
  errors: string[];
}> {
  const errors: string[] = [];
  const templateDir = path.join(TEMPLATES_DIR, templateId);

  try {
    // Check if template directory exists
    const dirStats = await fs.stat(templateDir);

    if (!dirStats.isDirectory()) {
      errors.push(`Template path ${templateDir} is not a directory`);
      return { valid: false, errors };
    }

    // Check for required files (can be customized based on template structure)
    const requiredFiles = ['package.json', 'README.md'];

    for (const file of requiredFiles) {
      const filePath = path.join(templateDir, file);

      try {
        await fs.access(filePath);
      } catch {
        errors.push(`Missing required file: ${file}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  } catch {
    errors.push(`Template directory not found: ${templateDir}`);
    return { valid: false, errors };
  }
}

/**
 * Invalidates the registry cache, forcing a reload on next access
 */
export function invalidateCache(): void {
  cache.registry = null;
  cache.loadedAt = null;
  logger.debug('Registry cache invalidated');
}

/**
 * Gets the current cache status for monitoring
 */
export function getCacheStatus(): {
  cached: boolean;
  loadedAt: number | null;
  age: number | null;
  ttl: number;
} {
  return {
    cached: cache.registry !== null,
    loadedAt: cache.loadedAt,
    age: cache.loadedAt ? Date.now() - cache.loadedAt : null,
    ttl: cache.ttl,
  };
}

/*
 * ============================================================================
 * ERROR CLASSES
 * ============================================================================
 */

export class RegistryNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RegistryNotFoundError';
  }
}

export class RegistryLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RegistryLoadError';
  }
}

export class TemplateNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TemplateNotFoundError';
  }
}

/*
 * ============================================================================
 * EXPORTS
 * ============================================================================
 */

export type { TemplateRegistry, TemplateMetadata };
