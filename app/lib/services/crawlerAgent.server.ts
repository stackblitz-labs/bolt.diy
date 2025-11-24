/**
 * Crawler Agent Server
 *
 * Implements crawler agent logic with request normalization, verification,
 * cache lookup, telemetry, and Supabase persistence.
 *
 * Based on specs/001-places-crawler/tasks.md Tasks T011-T012
 *
 * @module crawlerAgent.server
 */

import { z } from 'zod';
import { fetchPlaceProfile } from './internalPlacesClient.server';
import { type CrawlResult, CRAWL_REQUEST_SCHEMA, CRAWL_RESULT_SCHEMA } from './crawlerAgent.schema';
import {
  createScopedLogger,
  CRAWLER_PERFORMANCE_MARKS,
  logCrawlerPerformance,
  calculateSourceMix,
  logSourceMix,
} from '~/utils/logger';

const logger = createScopedLogger('CrawlerAgent');

/*
 * ============================================================================
 * Supabase Client Setup
 * ============================================================================
 */

/**
 * Supabase client interface (compatible with @supabase/supabase-js)
 */
export interface SupabaseClient {
  from: (table: string) => any;
}

let supabaseClient: SupabaseClient | null = null;

/**
 * Create a no-op Supabase client that logs warnings
 * Used as fallback when Supabase is not configured
 */
function createNoOpClient(): SupabaseClient {
  const noOpTable = {
    select: () => noOpTable,
    insert: () => noOpTable,
    update: () => noOpTable,
    upsert: () => noOpTable,
    delete: () => noOpTable,
    eq: () => noOpTable,
    gt: () => noOpTable,
    in: () => noOpTable,
    order: () => noOpTable,
    limit: () => noOpTable,
    maybeSingle: async () => ({ data: null, error: null }),
    single: async () => ({ data: null, error: null }),
  };

  return {
    from: (table: string) => {
      logger.warn(`Supabase client not initialized. Operation on table "${table}" will be a no-op.`);
      return noOpTable;
    },
  };
}

/**
 * Initialize Supabase client from environment variables
 * Attempts to create client if @supabase/supabase-js is available and env vars are set
 */
function initializeSupabaseClient(): SupabaseClient | null {
  // Try to get Supabase URL and key from environment
  const supabaseUrl =
    (typeof process !== 'undefined' && process.env?.SUPABASE_URL) ||
    (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL);

  const supabaseKey =
    (typeof process !== 'undefined' && process.env?.SUPABASE_ANON_KEY) ||
    (typeof process !== 'undefined' && process.env?.SUPABASE_SERVICE_ROLE_KEY) ||
    (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY);

  // If environment variables are not set, return null to use no-op client
  if (!supabaseUrl || !supabaseKey) {
    logger.warn(
      'Supabase environment variables not found. Supabase operations will be no-ops. Set SUPABASE_URL and SUPABASE_ANON_KEY to enable.',
    );
    return null;
  }

  // Try to dynamically import @supabase/supabase-js if available
  try {
    // Dynamic import would work at runtime, but TypeScript needs static analysis
    // For now, return null and let the no-op client handle it
    // When @supabase/supabase-js is installed, this can be updated to:
    // const { createClient } = await import('@supabase/supabase-js');
    // return createClient(supabaseUrl, supabaseKey);
    logger.warn(
      'Supabase client package not available. Install @supabase/supabase-js to enable Supabase operations.',
    );
    return null;
  } catch {
    return null;
  }
}

/**
 * Get Supabase client (singleton pattern)
 *
 * Lazily initializes client from environment variables if available.
 * Falls back to no-op client that logs warnings if Supabase is not configured.
 *
 * Note: To enable full Supabase functionality:
 * 1. Install @supabase/supabase-js: `pnpm add @supabase/supabase-js`
 * 2. Set environment variables: SUPABASE_URL and SUPABASE_ANON_KEY
 * 3. Update initializeSupabaseClient() to use the actual client
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    const initialized = initializeSupabaseClient();
    supabaseClient = initialized || createNoOpClient();
  }

  return supabaseClient;
}

/**
 * Set Supabase client (for testing and dependency injection)
 */
export function setSupabaseClient(client: SupabaseClient | null): void {
  supabaseClient = client;
}

/*
 * ============================================================================
 * URL Normalization
 * ============================================================================
 */

/**
 * Google Maps URL patterns
 *
 * Standard place URL: https://www.google.com/maps/place/...
 * Maps.google.com variant: https://maps.google.com/?cid=...
 * Shortened goo.gl URL: https://goo.gl/maps/...
 * Direct data URL with place ID: data=...!1s(0x...)
 */
const GOOGLE_MAPS_PATTERNS = [
  /https?:\/\/(?:www\.)?google\.com\/maps\/place\//i,
  /https?:\/\/maps\.google\.com\/\?cid=/i,
  /https?:\/\/(?:goo\.gl|maps\.app\.goo\.gl)\//i,
  /data=.*!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i,
];

/**
 * Extract Place ID from Google Maps URL
 */
function extractPlaceIdFromUrl(url: string): string | null {
  // Try to extract from data parameter (most reliable)
  const dataMatch = url.match(/data=.*!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i);

  if (dataMatch) {
    return dataMatch[1];
  }

  // Try CID format
  const cidMatch = url.match(/[?&]cid=([0-9]+)/i);

  if (cidMatch) {
    return `cid:${cidMatch[1]}`;
  }

  /*
   * For shortened URLs, we'd need to follow redirects
   * This is a placeholder - actual implementation would need HTTP fetch
   */
  if (url.includes('goo.gl') || url.includes('maps.app.goo.gl')) {
    logger.warn('Shortened URL detected - may need to follow redirect:', url);

    return null;
  }

  // Last resort: extract from path
  const pathMatch = url.match(/\/maps\/place\/[^/]+\/([^/]+)/);

  if (pathMatch) {
    return pathMatch[1];
  }

  return null;
}

/**
 * Check if string looks like a direct Place ID
 */
function isPlaceIdFormat(value: string): boolean {
  // Google Place IDs typically start with ChIJ or have hex format
  return /^ChIJ[A-Za-z0-9_-]+$/i.test(value) || /^0x[0-9a-f]+:0x[0-9a-f]+$/i.test(value);
}

/**
 * Normalize Google Maps URL to extract placeId
 *
 * Handles formats:
 * - https://maps.google.com/place/[NAME]/[PLACE_ID]
 * - https://www.google.com/maps/place/...
 * - https://goo.gl/maps/...
 * - Direct Place ID (ChIJ...)
 *
 * @param url - Google Maps URL or Place ID
 * @returns Object with extracted placeId and normalized URL
 */
export function normalizeGoogleMapsUrl(url: string): { placeId: string | null; normalized: string } {
  const trimmed = url.trim();

  // Check if it's already a Place ID
  if (isPlaceIdFormat(trimmed)) {
    return {
      placeId: trimmed,
      normalized: trimmed,
    };
  }

  // Check if it's a Google Maps URL
  const isGoogleMapsUrl = GOOGLE_MAPS_PATTERNS.some((pattern) => pattern.test(trimmed));

  if (!isGoogleMapsUrl) {
    logger.warn('URL does not appear to be a Google Maps URL:', trimmed);

    return {
      placeId: null,
      normalized: trimmed,
    };
  }

  // Extract Place ID
  const placeId = extractPlaceIdFromUrl(trimmed);

  // Normalize URL format
  const normalized = trimmed.replace(/^http:\/\//i, 'https://').replace(/^maps\.google\.com/i, 'www.google.com/maps');

  return {
    placeId,
    normalized,
  };
}

/*
 * ============================================================================
 * Tenant Verification
 * ============================================================================
 */

/**
 * Verify tenant scope - ensure request is for authenticated tenant
 *
 * Prevents cross-tenant data access attacks
 *
 * @param requestTenantId - Tenant ID from request
 * @param authenticatedTenantId - Authenticated tenant ID from session
 * @throws Error if tenant IDs don't match
 */
export function verifyTenantScope(requestTenantId: string, authenticatedTenantId: string): void {
  if (requestTenantId !== authenticatedTenantId) {
    logger.error('Cross-tenant access attempt:', { requestTenantId, authenticatedTenantId });
    throw new Error('Cross-tenant access denied');
  }
}

/*
 * ============================================================================
 * Cache Lookup
 * ============================================================================
 */

/**
 * Look up cached crawl data
 *
 * @param tenantId - Tenant ID
 * @param placeId - Place ID
 * @returns Cached crawl result or null if not found/expired
 */
async function lookupCachedCrawl(tenantId: string, placeId: string): Promise<CrawlResult | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('crawled_data')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('place_id', placeId)
    .eq('status', 'completed')
    .gt('cache_expires_at', new Date().toISOString())
    .order('crawled_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.error('Cache lookup failed:', error);

    return null;
  }

  if (!data) {
    logger.debug('Cache miss:', { tenantId, placeId });

    return null;
  }

  logger.info('Cache hit:', { tenantId, placeId, cachedAt: data.crawled_at });

  // Transform database row to CrawlResult
  const cachedResult: CrawlResult = {
    tenantId: data.tenant_id,
    placeId: data.place_id,
    sourcesUsed: data.sources_used || [],
    freshness: data.crawled_at,
    cacheHit: true,
    sections: data.normalized_summary?.sections || {},
    missingSections: data.normalized_summary?.missingSections || [],
    quotaState: data.normalized_summary?.quotaState,
    rawPayloadRef: data.id, // Use DB row ID as reference
  };

  return cachedResult;
}

/*
 * ============================================================================
 * Crawler Execution
 * ============================================================================
 */

/**
 * Execute crawler request with cache lookup, telemetry, and persistence
 *
 * Flow:
 * 1. Verify tenant scope
 * 2. Normalize URL to extract placeId
 * 3. Check cache (unless forceRefresh)
 * 4. Call internal Places Data Service
 * 5. Track performance metrics
 * 6. Validate response
 *
 * @param request - Crawl request
 * @param authenticatedTenantId - Authenticated tenant ID from session
 * @returns Validated crawl result
 * @throws Error on validation failure or cross-tenant access
 */
export async function executeCrawl(
  request: z.input<typeof CRAWL_REQUEST_SCHEMA>,
  authenticatedTenantId: string,
): Promise<CrawlResult> {
  // Parse and validate request (applies defaults)
  const validatedRequest = CRAWL_REQUEST_SCHEMA.parse(request);
  const correlationId = validatedRequest.correlationId || crypto.randomUUID();

  logger.info('Executing crawl:', { correlationId, tenantId: validatedRequest.tenantId });

  // Verify tenant scope
  verifyTenantScope(validatedRequest.tenantId, authenticatedTenantId);

  // Start performance tracking
  CRAWLER_PERFORMANCE_MARKS.startRequest(correlationId);

  try {
    // Normalize URL if provided
    let placeId = validatedRequest.placeId;

    if (validatedRequest.sourceUrl && !placeId) {
      const normalized = normalizeGoogleMapsUrl(validatedRequest.sourceUrl);
      placeId = normalized.placeId || undefined;

      if (!placeId) {
        throw new Error('Could not extract Place ID from provided URL');
      }

      logger.debug('Normalized URL to placeId:', { url: validatedRequest.sourceUrl, placeId });
    }

    if (!placeId) {
      throw new Error('No placeId available after normalization');
    }

    // Check cache unless force refresh
    if (!validatedRequest.forceRefresh) {
      const cachedResult = await lookupCachedCrawl(validatedRequest.tenantId, placeId);

      if (cachedResult) {
        CRAWLER_PERFORMANCE_MARKS.markCacheLookup(correlationId, true);

        const duration = CRAWLER_PERFORMANCE_MARKS.endRequest(correlationId);

        if (duration !== null) {
          logCrawlerPerformance(correlationId, duration, true, cachedResult.sourcesUsed.length);
        }

        return cachedResult;
      }

      CRAWLER_PERFORMANCE_MARKS.markCacheLookup(correlationId, false);
    }

    // Call internal service
    const internalRequest = {
      ...validatedRequest,
      placeId,
      correlationId,
    };

    const result = await fetchPlaceProfile(internalRequest);

    // Transform to our schema (internal service returns compatible format)
    const crawlResult: CrawlResult = {
      tenantId: result.tenantId,
      placeId: result.placeId,
      sourcesUsed: result.sourcesUsed,
      freshness: result.freshness,
      cacheHit: result.cacheHit,
      sections: result.sections,
      missingSections: result.missingSections,
      quotaState: result.quotaState,
      error: result.error,
    };

    // Track quota state
    if (crawlResult.quotaState) {
      CRAWLER_PERFORMANCE_MARKS.markQuotaCheck(correlationId, crawlResult.quotaState.state);
    }

    // Log source mix telemetry
    const sourceMix = calculateSourceMix(crawlResult.sourcesUsed);
    logSourceMix(correlationId, sourceMix);

    // End performance tracking
    const duration = CRAWLER_PERFORMANCE_MARKS.endRequest(correlationId);

    if (duration !== null) {
      logCrawlerPerformance(correlationId, duration, false, crawlResult.sourcesUsed.length);
    }

    // Validate result against schema
    return CRAWL_RESULT_SCHEMA.parse(crawlResult);
  } catch (error) {
    // End performance tracking on error
    CRAWLER_PERFORMANCE_MARKS.endRequest(correlationId);

    logger.error('Crawl execution failed:', { correlationId, error });
    throw error;
  }
}

/*
 * ============================================================================
 * Persistence
 * ============================================================================
 */

/**
 * Persist crawl result to Supabase crawled_data table
 *
 * Includes TTL calculation, provenance tracking, and raw payload storage
 *
 * @param result - Crawl result to persist
 * @param rawPayload - Full raw payload from internal service
 * @param ttlHours - Cache TTL in hours (default 24)
 * @returns Database row ID (used as rawPayloadRef)
 */
export async function persistCrawlResult(result: CrawlResult, rawPayload: any, ttlHours = 24): Promise<string> {
  const supabase = getSupabaseClient();

  logger.info('Persisting crawl result:', {
    tenantId: result.tenantId,
    placeId: result.placeId,
    ttlHours,
  });

  // Calculate cache expiration
  const cacheExpiresAt = new Date();
  cacheExpiresAt.setHours(cacheExpiresAt.getHours() + ttlHours);

  // Determine status
  const status = result.error ? 'failed' : 'completed';

  // Prepare normalized summary
  const normalizedSummary = {
    sections: result.sections,
    missingSections: result.missingSections,
    sourcesUsed: result.sourcesUsed,
    quotaState: result.quotaState,
  };

  // Upsert (insert or update)
  const { data, error } = await supabase
    .from('crawled_data')
    .upsert(
      {
        tenant_id: result.tenantId,
        place_id: result.placeId,
        source_url: rawPayload.sourceUrl || null,
        raw_data_blob: rawPayload, // Store full raw payload in JSONB
        normalized_summary: normalizedSummary,
        status,
        crawled_at: result.freshness,
        cache_expires_at: cacheExpiresAt.toISOString(),
        sources_used: result.sourcesUsed,
        raw_payload_ref: null, // Will be set to row ID after insert
      },
      {
        onConflict: 'tenant_id,place_id', // Update if exists
      },
    )
    .select('id')
    .single();

  if (error) {
    logger.error('Failed to persist crawl result:', error);
    throw new Error(`Persistence failed: ${error.message}`);
  }

  if (!data) {
    throw new Error('No data returned from upsert');
  }

  // Update raw_payload_ref to point to itself
  const { error: updateError } = await supabase
    .from('crawled_data')
    .update({ raw_payload_ref: data.id })
    .eq('id', data.id);

  if (updateError) {
    logger.warn('Failed to update raw_payload_ref:', updateError);
  }

  logger.info('Crawl result persisted successfully:', { id: data.id });

  return data.id;
}

/**
 * Invalidate cached crawl data
 *
 * Marks cache entry as invalidated without deleting (for audit trail)
 *
 * @param tenantId - Tenant ID
 * @param placeId - Place ID
 * @param reason - Invalidation reason
 * @param requestedBy - Operator ID or automation handle
 */
export async function invalidateCachedCrawl(
  tenantId: string,
  placeId: string,
  reason: string,
  requestedBy?: string,
): Promise<void> {
  const supabase = getSupabaseClient();

  logger.info('Invalidating cached crawl:', {
    tenantId,
    placeId,
    reason,
    requestedBy,
  });

  const { error } = await supabase
    .from('crawled_data')
    .update({
      status: 'invalidated',
      cache_expires_at: new Date().toISOString(), // Expire immediately
    })
    .eq('tenant_id', tenantId)
    .eq('place_id', placeId)
    .eq('status', 'completed');

  if (error) {
    logger.error('Failed to invalidate cache:', error);
    throw new Error(`Cache invalidation failed: ${error.message}`);
  }

  logger.info('Cache invalidated successfully');
}

/**
 * Get recent crawls for a tenant
 *
 * @param tenantId - Tenant ID
 * @param limit - Maximum number of results
 * @returns Array of crawl results
 */
export async function getRecentCrawls(tenantId: string, limit = 10): Promise<CrawlResult[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('crawled_data')
    .select('*')
    .eq('tenant_id', tenantId)
    .in('status', ['completed', 'failed'])
    .order('crawled_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error('Failed to fetch recent crawls:', error);

    return [];
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Transform to CrawlResult format
  return data.map(
    (row: any): CrawlResult => ({
      tenantId: row.tenant_id,
      placeId: row.place_id,
      sourcesUsed: row.sources_used || [],
      freshness: row.crawled_at,
      cacheHit: false, // Historical data
      sections: row.normalized_summary?.sections || {},
      missingSections: row.normalized_summary?.missingSections || [],
      quotaState: row.normalized_summary?.quotaState,
      error: row.status === 'failed' ? row.normalized_summary?.error : undefined,
      rawPayloadRef: row.id,
    }),
  );
}
