/**
 * Types for Website Information Collection Agent
 * Based on spec: specs/001-info-collection-agent/spec.md
 */

import { z } from 'zod';

/*
 * ============================================================================
 * Session Status & Steps
 * ============================================================================
 */

export const infoCollectionStatusSchema = z.enum([
  'in_progress',
  'completed',
  'crawler_queued',
  'crawler_completed',
  'cancelled',
]);
export type InfoCollectionStatus = z.infer<typeof infoCollectionStatusSchema>;

export const collectionStepSchema = z.enum(['website_url', 'google_maps_url', 'description', 'review', 'completed']);
export type CollectionStep = z.infer<typeof collectionStepSchema>;

/*
 * ============================================================================
 * Session Data
 * ============================================================================
 */

export interface InfoCollectionSession {
  id: string;
  userId: string;

  // Collected data
  websiteUrl: string | null;
  websiteUrlValidated: boolean;
  googleMapsUrl: string | null;
  googleMapsUrlValidated: boolean;
  websiteDescription: string | null;

  // Session state
  status: InfoCollectionStatus;
  chatId: string | null;
  currentStep: CollectionStep;

  // Crawler integration
  crawlerJobId: string | null;
  crawlerOutput: CrawlerOutput | null;

  // Timestamps
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

// Database row shape (snake_case)
export interface InfoCollectionSessionRow {
  id: string;
  user_id: string;
  website_url: string | null;
  website_url_validated: boolean;
  google_maps_url: string | null;
  google_maps_url_validated: boolean;
  website_description: string | null;
  status: InfoCollectionStatus;
  chat_id: string | null;
  current_step: CollectionStep;
  crawler_job_id: string | null;
  crawler_output: CrawlerOutput | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

/*
 * ============================================================================
 * Crawler Integration Types
 * ============================================================================
 */

/** Data package sent to crawler service */
export interface CrawlerDataPackage {
  sessionId: string;
  userId: string;
  websiteUrl: string | null;
  googleMapsUrl: string | null;
  userDescription: string;
  createdAt: string;
}

/**
 * Crawler output following production_master_map schema
 * @see docs/crawler-integration/production-schema.md
 */
export interface CrawlerOutput {
  business_intelligence: {
    core_identity: {
      legal_name: string;
      brand_display_name: string;
      tagline_inferred: string;
    };
    industry_context: {
      primary_category: string;
      price_tier: 'Budget' | 'Standard' | 'Premium' | 'Luxury';
      catalog_type: 'Service_List' | 'Menu_Food_Drink' | 'Portfolio_Projects';
      operational_highlights: string[];
    };
    nap_logistics: {
      full_address: string;
      phone_clickable: string;
      booking_action_url: string;
      service_area_text: string;
    };
    social_ecosystem: {
      facebook_url: string | null;
      instagram_url: string | null;
      whatsapp_number: string | null;
      linkedin_url: string | null;
      tiktok_url: string | null;
    };
    reputation_snapshot: {
      total_reviews: number;
      average_rating: number;
      trust_badge_text: string;
    };
  };
  brand_strategy: {
    inferred_usp: string;
    target_audience_persona: string;
    tone_of_voice: string;
    visual_style_prompt: string;
  };
  visual_asset_strategy: {
    color_palette_extracted: {
      primary_hex: string;
      accent_hex: string;
      is_dark_mode_suitable: boolean;
    };
    typography_vibe: 'Serif_Elegant' | 'Sans_Clean' | 'Display_Playful' | 'Monospace_Technical';
  };
}

/*
 * ============================================================================
 * Tool Input/Output Schemas (Zod)
 * ============================================================================
 */

export const websiteUrlInputSchema = z.object({
  url: z.string().url().optional(),
  hasWebsite: z.boolean().describe('Whether user has an existing website'),
});

export const googleMapsUrlInputSchema = z.object({
  url: z.string().optional(),
  hasListing: z.boolean().describe('Whether user has a Google Maps listing'),
});

export const descriptionInputSchema = z.object({
  description: z.string().min(1).describe('User description of desired website'),
});

export const updateFieldInputSchema = z.object({
  field: z.enum(['websiteUrl', 'googleMapsUrl', 'websiteDescription']),
  value: z.string(),
});

export const sessionActionInputSchema = z.object({
  action: z.enum(['confirm', 'cancel', 'edit']),
});

/*
 * ============================================================================
 * API Response Types
 * ============================================================================
 */

export interface InfoCollectionResponse {
  success: boolean;
  session?: InfoCollectionSession;
  message?: string;
  error?: string;
}

export interface SessionListResponse {
  sessions: InfoCollectionSession[];
  total: number;
}

/*
 * ============================================================================
 * Data Stream Annotations
 * ============================================================================
 */

/** Annotation sent via data stream to update client-side session state */
export interface SessionUpdateAnnotation {
  type: 'sessionUpdate';
  session: InfoCollectionSession;
}

/*
 * ============================================================================
 * Website Generation Types
 * ============================================================================
 */

import type { RestaurantThemeId } from './restaurant-theme';

/** Result of the website generation pipeline */
export interface GenerationResult {
  success: boolean;
  sessionId: string;

  /** Selected template/theme info */
  template: {
    name: string;
    themeId: RestaurantThemeId;
    title: string;
    reasoning?: string;
  };

  /** Crawler data used for generation */
  crawlerOutput: CrawlerOutput;

  /** Messages to inject into chat for template loading */
  chatInjection: {
    /** Assistant message with template files */
    assistantMessage: string;

    /** User message with content instructions */
    userMessage: string;
  };

  /** Error message if generation failed */
  error?: string;
}

/** Annotation sent via data stream when generation completes */
export interface GenerationCompleteAnnotation {
  type: 'generationComplete';
  result: GenerationResult;
}

/** Annotation sent via data stream to inject template files into WebContainer */
export interface TemplateInjectionAnnotation {
  type: 'templateInjection';
  chatInjection: {
    assistantMessage: string;
    userMessage: string;
  };
  generation?: {
    templateName: string;
    themeId: string;
    title: string;
    reasoning?: string;
    businessName?: string;
    category?: string;
  };
}
