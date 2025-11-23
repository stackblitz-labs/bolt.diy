/**
 * Internal Places Data Service Client
 *
 * Wraps REST API calls to the internal Places Data Service, providing
 * type-safe interfaces for crawler operations, cache management, and quota tracking.
 *
 * Based on specs/001-places-crawler/contracts/crawler-service.openapi.yaml
 *
 * @module internalPlacesClient.server
 */

import { getInternalPlacesServiceConfig } from '~/lib/config/env.server';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('InternalPlacesClient');

/*
 * ============================================================================
 * Type Definitions (from OpenAPI contract)
 * ============================================================================
 */

export type SectionType = 'identity' | 'contact' | 'hours' | 'menu' | 'reviews' | 'media';

export type SourceType = 'maps' | 'website' | 'social';

export type CrawlStatus = 'pending' | 'completed' | 'failed' | 'invalidated';

export type CrawlErrorCode =
  | 'INVALID_INPUT'
  | 'PLACE_NOT_FOUND'
  | 'QUOTA_EXCEEDED'
  | 'UPSTREAM_ERROR'
  | 'NO_SOURCE_DATA';

export type QuotaStateType = 'healthy' | 'warning' | 'exhausted';

export type CompletenessLevel = 'complete' | 'partial' | 'missing';

export interface SourceUsed {
  type: SourceType;
  timestamp: string; // ISO 8601 datetime
}

export interface SectionData {
  data: Record<string, any>;
  completeness: CompletenessLevel;
}

export interface QuotaState {
  percentage: number;
  state: QuotaStateType;
}

export interface CrawlError {
  code: CrawlErrorCode;
  message: string;
  remediation: string;
}

/*
 * ============================================================================
 * Request/Response Interfaces
 * ============================================================================
 */

export interface CrawlRequest {
  tenantId: string; // UUID
  sourceUrl?: string; // HTTPS URL
  placeId?: string;
  forceRefresh?: boolean;
  requestedSections?: SectionType[];
  correlationId?: string; // UUID
}

export interface CrawlResult {
  tenantId: string; // UUID
  placeId: string;
  sourcesUsed: SourceUsed[];
  freshness: string; // ISO 8601 datetime
  cacheHit: boolean;
  sections: {
    identity?: SectionData;
    contact?: SectionData;
    hours?: SectionData;
    menu?: SectionData;
    reviews?: SectionData;
    media?: SectionData;
  };
  missingSections: SectionType[];
  quotaState?: QuotaState;
  error?: CrawlError;
}

export interface InvalidateCacheRequest {
  tenantId: string; // UUID
  placeId: string;
  reason: 'operator_request' | 'stale_data' | 'compliance' | 'other';
  requestedBy?: string; // Operator ID or automation handle
}

export interface QuotaLedger {
  apiKeyAlias: string;
  dailyLimit: number;
  dailyConsumed: number;
  minuteLimit?: number;
  minuteConsumed?: number;
  warningThreshold: number; // Default 0.8
  resetAt: string; // ISO 8601 datetime
  updatedAt: string; // ISO 8601 datetime
}

/*
 * ============================================================================
 * HTTP Client Configuration
 * ============================================================================
 */

interface FetchOptions {
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number; // milliseconds
}

/**
 * Build request headers with authentication
 */
function buildHeaders(customHeaders?: Record<string, string>): Record<string, string> {
  const config = getInternalPlacesServiceConfig();

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.token}`,
    ...customHeaders,
  };
}

/**
 * Perform HTTP request with timeout and error handling
 */
async function fetchWithTimeout<T>(endpoint: string, options: FetchOptions, timeout: number = 30000): Promise<T> {
  const config = getInternalPlacesServiceConfig();
  const url = `${config.url}${endpoint}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    logger.debug(`Fetching ${options.method} ${url}`);

    const response = await fetch(url, {
      method: options.method,
      headers: buildHeaders(options.headers),
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Parse error response if available
      let errorData: CrawlError | null = null;

      try {
        errorData = (await response.json()) as CrawlError;
      } catch {
        // Non-JSON error response
      }

      throw new InternalPlacesClientError(
        `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        errorData,
      );
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    return (await response.json()) as T;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof InternalPlacesClientError) {
      throw error;
    }

    if ((error as any).name === 'AbortError') {
      logger.error(`Request to ${url} timed out after ${timeout}ms`);
      throw new InternalPlacesClientError(`Request timeout after ${timeout}ms`, 0, null);
    }

    logger.error(`Request to ${url} failed:`, error);
    throw new InternalPlacesClientError(`Network error: ${(error as Error).message}`, 0, null);
  }
}

/*
 * ============================================================================
 * Custom Error Class
 * ============================================================================
 */

export class InternalPlacesClientError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public crawlError: CrawlError | null,
  ) {
    super(message);
    this.name = 'InternalPlacesClientError';
  }

  /**
   * Check if error is a quota exhaustion error
   */
  isQuotaExceeded(): boolean {
    return this.statusCode === 429 || this.crawlError?.code === 'QUOTA_EXCEEDED';
  }

  /**
   * Check if error is a client input error
   */
  isClientError(): boolean {
    return this.statusCode >= 400 && this.statusCode < 500;
  }

  /**
   * Check if error is a server/upstream error
   */
  isServerError(): boolean {
    return this.statusCode >= 500 || this.crawlError?.code === 'UPSTREAM_ERROR';
  }
}

/*
 * ============================================================================
 * Public API Methods
 * ============================================================================
 */

/**
 * Fetch normalized business profile for a tenant
 *
 * POST /crawler/fetch
 *
 * @param request - Crawl request parameters
 * @returns Normalized crawl result with provenance and cache metadata
 * @throws {InternalPlacesClientError} On HTTP errors or validation failures
 */
export async function fetchPlaceProfile(request: CrawlRequest): Promise<CrawlResult> {
  logger.info(`Fetching place profile for tenant ${request.tenantId}, placeId: ${request.placeId || 'TBD'}`);

  const result = await fetchWithTimeout<CrawlResult>(
    '/crawler/fetch',
    {
      method: 'POST',
      body: request,
    },
    30000, // 30s timeout for crawler operations
  );

  logger.info(
    `Fetch complete for ${result.placeId}: cache=${result.cacheHit}, sources=${result.sourcesUsed.length}, missing=${result.missingSections.length}`,
  );

  return result;
}

/**
 * Force invalidate cached payload for a tenant/place pair
 *
 * POST /crawler/cache/invalidate
 *
 * @param request - Cache invalidation request
 * @throws {InternalPlacesClientError} On HTTP errors (404 if no cache entry exists)
 */
export async function invalidateCache(request: InvalidateCacheRequest): Promise<void> {
  logger.info(
    `Invalidating cache for tenant ${request.tenantId}, placeId: ${request.placeId}, reason: ${request.reason}`,
  );

  await fetchWithTimeout<void>(
    '/crawler/cache/invalidate',
    {
      method: 'POST',
      body: request,
    },
    10000, // 10s timeout for cache operations
  );

  logger.info(`Cache invalidated for ${request.placeId}`);
}

/**
 * Retrieve current quota ledger state
 *
 * GET /crawler/quota?apiKeyAlias={alias}
 *
 * @param apiKeyAlias - API key bucket identifier
 * @returns Current quota counters and thresholds
 * @throws {InternalPlacesClientError} On HTTP errors (404 if unknown alias)
 */
export async function getQuotaLedger(apiKeyAlias: string): Promise<QuotaLedger> {
  logger.debug(`Fetching quota ledger for alias: ${apiKeyAlias}`);

  const result = await fetchWithTimeout<QuotaLedger>(
    `/crawler/quota?apiKeyAlias=${encodeURIComponent(apiKeyAlias)}`,
    {
      method: 'GET',
    },
    5000, // 5s timeout for quota queries
  );

  logger.debug(
    `Quota ledger retrieved: ${result.dailyConsumed}/${result.dailyLimit} (${((result.dailyConsumed / result.dailyLimit) * 100).toFixed(1)}%)`,
  );

  return result;
}

/*
 * ============================================================================
 * Utility Functions
 * ============================================================================
 */

/**
 * Calculate quota percentage from ledger
 */
export function calculateQuotaPercentage(ledger: QuotaLedger): number {
  if (ledger.dailyLimit === 0) {
    return 0;
  }

  return (ledger.dailyConsumed / ledger.dailyLimit) * 100;
}

/**
 * Determine quota state from percentage
 */
export function getQuotaState(percentage: number, threshold: number = 0.8): QuotaStateType {
  if (percentage >= 100) {
    return 'exhausted';
  }

  if (percentage >= threshold * 100) {
    return 'warning';
  }

  return 'healthy';
}

/**
 * Format time until quota reset
 */
export function formatTimeUntilReset(resetAt: string): string {
  const now = new Date();
  const reset = new Date(resetAt);
  const diffMs = reset.getTime() - now.getTime();

  if (diffMs <= 0) {
    return 'now';
  }

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

/**
 * Check if service is configured and enabled
 */
export function isServiceEnabled(): boolean {
  try {
    const config = getInternalPlacesServiceConfig();
    return config.enabled && !!config.url && !!config.token;
  } catch {
    return false;
  }
}
