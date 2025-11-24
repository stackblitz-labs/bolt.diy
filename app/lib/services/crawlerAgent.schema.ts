/**
 * Zod schemas for Crawler Agent
 *
 * Defines validation schemas matching the OpenAPI contract at
 * specs/001-places-crawler/contracts/crawler-service.openapi.yaml
 *
 * Based on specs/001-places-crawler/tasks.md Task T010
 *
 * @module crawlerAgent.schema
 */

import { z } from 'zod';

/*
 * ============================================================================
 * Enum Schemas
 * ============================================================================
 */

/**
 * Section types for restaurant data
 */
export const SECTION_TYPE_SCHEMA = z.enum(['identity', 'contact', 'hours', 'menu', 'reviews', 'media']);

export type SectionType = z.infer<typeof SECTION_TYPE_SCHEMA>;

/**
 * Source types for data provenance
 */
export const SOURCE_TYPE_SCHEMA = z.enum(['maps', 'website', 'social']);

export type SourceType = z.infer<typeof SOURCE_TYPE_SCHEMA>;

/**
 * Completeness levels for sections
 */
export const COMPLETENESS_LEVEL_SCHEMA = z.enum(['complete', 'partial', 'missing']);

export type CompletenessLevel = z.infer<typeof COMPLETENESS_LEVEL_SCHEMA>;

/**
 * Quota state types
 */
export const QUOTA_STATE_TYPE_SCHEMA = z.enum(['healthy', 'warning', 'exhausted']);

export type QuotaStateType = z.infer<typeof QUOTA_STATE_TYPE_SCHEMA>;

/**
 * Crawl error codes (deterministic error types)
 */
export const CRAWL_ERROR_CODE_SCHEMA = z.enum([
  'INVALID_INPUT',
  'PLACE_NOT_FOUND',
  'QUOTA_EXCEEDED',
  'UPSTREAM_ERROR',
  'NO_SOURCE_DATA',
]);

export type CrawlErrorCode = z.infer<typeof CRAWL_ERROR_CODE_SCHEMA>;

/**
 * PCC toast types
 */
export const PCC_TOAST_TYPE_SCHEMA = z.enum(['info', 'warning', 'error', 'success']);

export type PCCToastType = z.infer<typeof PCC_TOAST_TYPE_SCHEMA>;

/**
 * ARIA roles for accessibility
 */
export const ARIA_ROLE_SCHEMA = z.enum(['status', 'alert']);

export type AriaRole = z.infer<typeof ARIA_ROLE_SCHEMA>;

/*
 * ============================================================================
 * Component Schemas
 * ============================================================================
 */

/**
 * Source used entry for provenance tracking
 */
export const SOURCE_USED_SCHEMA = z.object({
  type: SOURCE_TYPE_SCHEMA,
  timestamp: z.string().datetime(), // ISO 8601 datetime
  confidence: z.number().min(0).max(1).optional(), // 0-1 confidence score
});

export type SourceUsed = z.infer<typeof SOURCE_USED_SCHEMA>;

/**
 * Section data with completeness tracking
 */
export const SECTION_DATA_SCHEMA = z.object({
  data: z.record(z.any()), // Flexible object for section-specific data
  completeness: COMPLETENESS_LEVEL_SCHEMA,
  source: SOURCE_TYPE_SCHEMA.optional(), // Which source provided this data
});

export type SectionData = z.infer<typeof SECTION_DATA_SCHEMA>;

/**
 * Sections container (all sections optional)
 */
export const SECTIONS_SCHEMA = z.object({
  identity: SECTION_DATA_SCHEMA.optional(),
  contact: SECTION_DATA_SCHEMA.optional(),
  hours: SECTION_DATA_SCHEMA.optional(),
  menu: SECTION_DATA_SCHEMA.optional(),
  reviews: SECTION_DATA_SCHEMA.optional(),
  media: SECTION_DATA_SCHEMA.optional(),
});

export type Sections = z.infer<typeof SECTIONS_SCHEMA>;

/**
 * Quota state telemetry
 */
export const QUOTA_STATE_SCHEMA = z.object({
  percentage: z.number().min(0).max(100), // 0-100 percentage of quota used
  state: QUOTA_STATE_TYPE_SCHEMA,
});

export type QuotaState = z.infer<typeof QUOTA_STATE_SCHEMA>;

/**
 * Crawl error with remediation guidance
 */
export const CRAWL_ERROR_SCHEMA = z.object({
  code: CRAWL_ERROR_CODE_SCHEMA,
  message: z.string().min(1), // Human-readable error message
  remediation: z.string().min(1), // Actionable guidance for user
  ctaId: z.string().optional(), // CTA button identifier for PCC UI
});

export type CrawlError = z.infer<typeof CRAWL_ERROR_SCHEMA>;

/*
 * ============================================================================
 * Request/Response Schemas
 * ============================================================================
 */

/**
 * Crawl request schema with validation
 */
export const CRAWL_REQUEST_SCHEMA = z
  .object({
    tenantId: z.string().uuid('tenantId must be a valid UUID'),
    sourceUrl: z.string().url('sourceUrl must be a valid URL').optional(),
    placeId: z.string().min(1, 'placeId must not be empty').optional(),
    forceRefresh: z.boolean().optional().default(false),
    requestedSections: z.array(SECTION_TYPE_SCHEMA).optional(),
    correlationId: z.string().uuid('correlationId must be a valid UUID').optional(),
  })
  .refine((data) => data.sourceUrl || data.placeId, {
    message: 'Either sourceUrl or placeId must be provided',
    path: ['sourceUrl'],
  });

export type CrawlRequest = z.infer<typeof CRAWL_REQUEST_SCHEMA>;

/**
 * Crawl result schema
 */
export const CRAWL_RESULT_SCHEMA = z.object({
  tenantId: z.string().uuid(),
  placeId: z.string().min(1),
  sourcesUsed: z.array(SOURCE_USED_SCHEMA),
  freshness: z.string().datetime(), // When data was fetched
  cacheHit: z.boolean(),
  sections: SECTIONS_SCHEMA,
  missingSections: z.array(SECTION_TYPE_SCHEMA),
  quotaState: QUOTA_STATE_SCHEMA.optional(),
  error: CRAWL_ERROR_SCHEMA.optional(),
  rawPayloadRef: z.string().optional(), // Reference to raw payload in DB
});

export type CrawlResult = z.infer<typeof CRAWL_RESULT_SCHEMA>;

/*
 * ============================================================================
 * PCC UI Schemas (FR-011 Accessibility)
 * ============================================================================
 */

/**
 * PCC Toast DTO for accessibility-compliant notifications
 *
 * FR-011 Requirements:
 * - Destructive toasts (error, warning) must stay visible ≥6 seconds
 * - Must include ARIA role (status or alert)
 * - Keyboard dismissible (Escape key)
 * - Screen reader accessible
 */
export const PCC_TOAST_SCHEMA = z.object({
  id: z.string().min(1), // Unique toast identifier
  type: PCC_TOAST_TYPE_SCHEMA,
  message: z.string().min(1), // Toast content
  duration: z.number().min(6000, 'Duration must be at least 6000ms per FR-011'), // Minimum 6s
  role: ARIA_ROLE_SCHEMA, // ARIA role for accessibility
  ctaLabel: z.string().optional(), // CTA button label
  ctaId: z.string().optional(), // CTA action identifier
  dismissible: z.boolean().default(true), // Can be dismissed by user
});

export type PCCToast = z.infer<typeof PCC_TOAST_SCHEMA>;

/**
 * Provenance badge data for PCC UI
 */
export const PROVENANCE_BADGE_SCHEMA = z.object({
  section: SECTION_TYPE_SCHEMA,
  sources: z.array(SOURCE_USED_SCHEMA).min(1), // At least one source
  tooltip: z.string().optional(), // Formatted tooltip text
});

export type ProvenanceBadge = z.infer<typeof PROVENANCE_BADGE_SCHEMA>;

/**
 * "Needs data" chip for missing sections
 */
export const NEEDS_DATA_CHIP_SCHEMA = z.object({
  section: SECTION_TYPE_SCHEMA,
  label: z.string().min(1), // Chip label text
  ariaLabel: z.string().min(1), // Accessibility label
  guidance: z.string().optional(), // Optional guidance text
});

export type NeedsDataChip = z.infer<typeof NEEDS_DATA_CHIP_SCHEMA>;

/*
 * ============================================================================
 * Error Code to Toast Configuration Mapping
 * ============================================================================
 */

/**
 * Configuration for mapping error codes to PCC toasts
 */
export interface ErrorToastConfig {
  type: PCCToastType;
  duration: number;
  role: AriaRole;
  getMessage: (error: CrawlError) => string;
  ctaLabel?: string;
  ctaId?: string;
}

/**
 * Error code to toast configuration mapping
 *
 * Maps each CrawlErrorCode to deterministic toast behavior
 */
export const ERROR_TOAST_CONFIG: Record<CrawlErrorCode, ErrorToastConfig> = {
  INVALID_INPUT: {
    type: 'error',
    duration: 6000,
    role: 'alert',
    getMessage: (error) => `${error.message}. ${error.remediation}`,
    ctaLabel: 'Review Input',
    ctaId: 'review-input',
  },
  PLACE_NOT_FOUND: {
    type: 'error',
    duration: 6000,
    role: 'alert',
    getMessage: (error) => `${error.message}. ${error.remediation}`,
    ctaLabel: 'Try Different URL',
    ctaId: 'retry-url',
  },
  QUOTA_EXCEEDED: {
    type: 'error',
    duration: 8000, // Longer for critical errors
    role: 'alert',
    getMessage: (error) => `${error.message}. ${error.remediation}`,
    ctaLabel: 'View Quota Status',
    ctaId: 'view-quota',
  },
  UPSTREAM_ERROR: {
    type: 'error',
    duration: 6000,
    role: 'alert',
    getMessage: (error) => `${error.message}. ${error.remediation}`,
    ctaLabel: 'Retry',
    ctaId: 'retry-crawl',
  },
  NO_SOURCE_DATA: {
    type: 'warning',
    duration: 7000,
    role: 'alert',
    getMessage: (error) => `${error.message}. ${error.remediation}`,
    ctaLabel: 'Provide Data Manually',
    ctaId: 'manual-input',
  },
};

/**
 * Create PCC toast from crawl error
 */
export function createToastFromError(error: CrawlError): PCCToast {
  const config = ERROR_TOAST_CONFIG[error.code];

  return {
    id: `toast-${error.code}-${Date.now()}`,
    type: config.type,
    message: config.getMessage(error),
    duration: config.duration,
    role: config.role,
    ctaLabel: config.ctaLabel || error.ctaId,
    ctaId: config.ctaId || error.ctaId,
    dismissible: true,
  };
}

/**
 * Create provenance badge from section data
 */
export function createProvenanceBadge(section: SectionType, sources: SourceUsed[]): ProvenanceBadge {
  const tooltip = sources
    .map((source) => {
      const timestamp = new Date(source.timestamp).toLocaleString();
      return `${source.type} • ${timestamp}`;
    })
    .join('\n');

  return {
    section,
    sources,
    tooltip,
  };
}

/**
 * Create "needs data" chip from missing section
 */
export function createNeedsDataChip(section: SectionType, guidance?: string): NeedsDataChip {
  const sectionLabels: Record<SectionType, string> = {
    identity: 'Identity',
    contact: 'Contact',
    hours: 'Hours',
    menu: 'Menu',
    reviews: 'Reviews',
    media: 'Media',
  };

  const label = sectionLabels[section];

  return {
    section,
    label: `${label} needs data`,
    ariaLabel: `Request ${label} data`,
    guidance,
  };
}

/*
 * ============================================================================
 * Validation Helpers
 * ============================================================================
 */

/**
 * Validate and parse crawl request
 */
export function parseCrawlRequest(data: unknown): CrawlRequest {
  return CRAWL_REQUEST_SCHEMA.parse(data);
}

/**
 * Validate and parse crawl result
 */
export function parseCrawlResult(data: unknown): CrawlResult {
  return CRAWL_RESULT_SCHEMA.parse(data);
}

/**
 * Safe parse with error formatting
 */
export function safeParseCrawlRequest(
  data: unknown,
): { success: true; data: CrawlRequest } | { success: false; error: string } {
  const result = CRAWL_REQUEST_SCHEMA.safeParse(data);

  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    const errorMessage = Object.entries(errors)
      .map(([field, messages]) => `${field}: ${messages?.join(', ')}`)
      .join('; ');

    return { success: false, error: errorMessage };
  }

  return { success: true, data: result.data };
}

/**
 * Safe parse crawl result
 */
export function safeParseCrawlResult(
  data: unknown,
): { success: true; data: CrawlResult } | { success: false; error: string } {
  const result = CRAWL_RESULT_SCHEMA.safeParse(data);

  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    const errorMessage = Object.entries(errors)
      .map(([field, messages]) => `${field}: ${messages?.join(', ')}`)
      .join('; ');

    return { success: false, error: errorMessage };
  }

  return { success: true, data: result.data };
}
