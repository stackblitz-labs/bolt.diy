# Implementation Plan: Website Information Collection Agent

**Feature Branch**: `001-info-collection-agent`  
**Created**: 2025-12-09  
**Spec Reference**: [spec.md](./spec.md)

---

## Executive Summary

This plan details how to build an LLM-based conversational agent that collects website generation information from authenticated users. The agent uses the existing chat infrastructure with Vercel AI SDK tools for structured data extraction.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Technology Decisions](#2-technology-decisions)
3. [Data Model](#3-data-model)
4. [Implementation Tasks](#4-implementation-tasks)
5. [File Structure](#5-file-structure)
6. [Detailed Implementation Guide](#6-detailed-implementation-guide)
7. [Testing Strategy](#7-testing-strategy)
8. [Deployment Considerations](#8-deployment-considerations)

---

## 1. Architecture Overview

### System Flow Diagram

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Chat UI       │────▶│  API Route       │────▶│  LLM Provider   │
│  (existing)     │     │  /api/chat       │     │  (OpenAI/etc)   │
└─────────────────┘     └────────┬─────────┘     └────────┬────────┘
                                 │                        │
                                 │ Tool Calls             │ Tool Results
                                 ▼                        ▼
                        ┌────────────────────────────────────────┐
                        │    Info Collection Tools               │
                        │  ┌─────────────────────────────────┐   │
                        │  │ collectWebsiteUrl               │   │
                        │  │ collectGoogleMapsUrl            │   │
                        │  │ collectWebsiteDescription       │   │
                        │  │ updateCollectedInfo             │   │
                        │  │ finalizeCollection              │   │
                        │  │ deleteCollectionSession         │   │
                        │  └─────────────────────────────────┘   │
                        └─────────────────┬──────────────────────┘
                                          │
                                          ▼
                        ┌──────────────────────────────────────┐
                        │    Supabase Database                 │
                        │  ┌────────────────────────────────┐  │
                        │  │ info_collection_sessions       │  │
                        │  └────────────────────────────────┘  │
                        └─────────────────┬────────────────────┘
                                          │
                                          ▼ (async queue)
                        ┌──────────────────────────────────────┐
                        │    Crawler Service (future)          │
                        │    (production_master_map output)    │
                        └──────────────────────────────────────┘
```

### Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Agent Type | LLM-based with tools | Natural language handling, flexible conversation flow |
| State Storage | Supabase PostgreSQL | Persistent, queryable, existing infra |
| Tool Framework | Vercel AI SDK tools | Already in use, type-safe, streaming support |
| Crawler Integration | Async queue | Non-blocking, resilient to crawler failures |

---

## 2. Technology Decisions

### Stack Alignment

| Component | Technology | Existing Codebase Reference |
|-----------|------------|----------------------------|
| LLM Integration | Vercel AI SDK (`ai`) | `app/routes/api.chat.ts` |
| Tool Definition | `tool()` from `ai` | `app/lib/services/mcpService.ts` |
| Database | Supabase/PostgreSQL | `supabase/migrations/*.sql` |
| State Management | Nanostores (client) | `app/lib/stores/*.ts` |
| Auth | Better Auth | `app/lib/auth/guards.server.ts` |
| Validation | Zod | Used throughout codebase |

### AI SDK Tool Pattern (from research)

Best practices applied:
1. **Function calling schemas** - Define fields in JSON/Zod schema for reliable structured output
2. **Multi-step tool calling** - Use `maxSteps` to allow conversation flow
3. **Message history access** - Tools receive full `messages` context
4. **Structured output** - Use `Output.object()` for final data package

---

## 3. Data Model

### Database Schema: `info_collection_sessions`

```sql
-- Migration: 20251209_info_collection_sessions.sql

CREATE TABLE IF NOT EXISTS info_collection_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User identification (Better Auth)
  user_id VARCHAR(255) NOT NULL,
  
  -- Collected data
  website_url TEXT,
  website_url_validated BOOLEAN DEFAULT FALSE,
  google_maps_url TEXT,
  google_maps_url_validated BOOLEAN DEFAULT FALSE,
  website_description TEXT,
  
  -- Session state
  status VARCHAR(30) NOT NULL DEFAULT 'in_progress' 
    CHECK (status IN ('in_progress', 'completed', 'crawler_queued', 'crawler_completed', 'cancelled')),
  
  -- Conversation tracking
  chat_id VARCHAR(255),  -- Links to existing chat for context
  current_step VARCHAR(50) DEFAULT 'website_url'
    CHECK (current_step IN ('website_url', 'google_maps_url', 'description', 'review', 'completed')),
  
  -- Crawler integration
  crawler_job_id UUID,
  crawler_output JSONB,  -- production_master_map schema
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_ics_user_id ON info_collection_sessions(user_id);
CREATE INDEX idx_ics_status ON info_collection_sessions(status);
CREATE INDEX idx_ics_user_status ON info_collection_sessions(user_id, status);

-- RLS Policy
ALTER TABLE info_collection_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY ics_user_isolation ON info_collection_sessions
  FOR ALL
  USING (user_id = current_setting('app.current_user_id', TRUE));

-- Updated_at trigger
CREATE TRIGGER update_ics_updated_at
  BEFORE UPDATE ON info_collection_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### TypeScript Types

```typescript
// app/types/info-collection.ts

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

export type InfoCollectionStatus = 
  | 'in_progress' 
  | 'completed' 
  | 'crawler_queued' 
  | 'crawler_completed' 
  | 'cancelled';

export type CollectionStep = 
  | 'website_url' 
  | 'google_maps_url' 
  | 'description' 
  | 'review' 
  | 'completed';

// Crawler output follows production_master_map schema
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
    // ... rest of production_master_map schema
  };
  // ... additional fields
}

// Data package for crawler input
export interface CrawlerDataPackage {
  sessionId: string;
  userId: string;
  websiteUrl: string | null;
  googleMapsUrl: string | null;
  userDescription: string;
  createdAt: string;
}
```

---

## 4. Implementation Tasks

### Task Breakdown

| # | Task | Estimated Time | Dependencies |
|---|------|----------------|--------------|
| T1 | Create database migration | 30 min | None |
| T2 | Create TypeScript types | 20 min | T1 |
| T3 | Create Supabase service layer | 1 hour | T1, T2 |
| T4 | Create URL validation utilities | 30 min | None |
| T5 | Create info collection tools | 2 hours | T2, T3, T4 |
| T6 | Create system prompt for agent | 30 min | T5 |
| T7 | Integrate tools with chat API | 1 hour | T5, T6 |
| T8 | Create client-side store | 30 min | T2 |
| T9 | Create session management UI | 1 hour | T8 |
| T10 | Create API route for sessions | 30 min | T3 |
| T11 | Write unit tests | 1 hour | All |
| T12 | Write integration tests | 1 hour | All |

**Total Estimated Time**: ~10 hours

---

## 5. File Structure

```
app/
├── lib/
│   ├── services/
│   │   └── infoCollectionService.ts     # T3: Database operations
│   ├── tools/
│   │   └── infoCollectionTools.ts       # T5: AI SDK tools
│   ├── stores/
│   │   └── infoCollection.ts            # T8: Client state
│   └── prompts/
│       └── infoCollectionPrompt.ts      # T6: System prompt
├── routes/
│   ├── api.info-collection.ts           # T10: REST endpoints
│   └── api.chat.ts                      # T7: Modified (tool registration)
├── types/
│   └── info-collection.ts               # T2: TypeScript types
├── utils/
│   └── urlValidation.ts                 # T4: URL validators
└── components/
    └── chat/
        └── InfoCollectionStatus.tsx     # T9: Status UI component

supabase/
└── migrations/
    └── 20251209_info_collection_sessions.sql  # T1: DB schema

tests/
├── unit/
│   ├── infoCollectionService.test.ts    # T11
│   └── urlValidation.test.ts            # T11
└── integration/
    └── infoCollectionFlow.test.ts       # T12
```

---

## 6. Detailed Implementation Guide

### T1: Database Migration

**File**: `supabase/migrations/20251209000000_info_collection_sessions.sql`

```sql
-- Info Collection Sessions Schema
-- Stores user-provided information for website generation

CREATE TABLE IF NOT EXISTS info_collection_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  
  -- Collected data
  website_url TEXT,
  website_url_validated BOOLEAN DEFAULT FALSE,
  google_maps_url TEXT,
  google_maps_url_validated BOOLEAN DEFAULT FALSE,
  website_description TEXT,
  
  -- Session state
  status VARCHAR(30) NOT NULL DEFAULT 'in_progress' 
    CHECK (status IN ('in_progress', 'completed', 'crawler_queued', 'crawler_completed', 'cancelled')),
  chat_id VARCHAR(255),
  current_step VARCHAR(50) DEFAULT 'website_url'
    CHECK (current_step IN ('website_url', 'google_maps_url', 'description', 'review', 'completed')),
  
  -- Crawler integration
  crawler_job_id UUID,
  crawler_output JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indexes for common queries
CREATE INDEX idx_ics_user_id ON info_collection_sessions(user_id);
CREATE INDEX idx_ics_status ON info_collection_sessions(status);
CREATE INDEX idx_ics_user_status ON info_collection_sessions(user_id, status);
CREATE INDEX idx_ics_user_active ON info_collection_sessions(user_id) 
  WHERE status = 'in_progress';

-- Enable RLS
ALTER TABLE info_collection_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only access their own sessions
CREATE POLICY ics_user_isolation ON info_collection_sessions
  FOR ALL
  USING (user_id = current_setting('app.current_user_id', TRUE));

-- Service role bypass for server-side operations
CREATE POLICY ics_service_bypass ON info_collection_sessions
  FOR ALL
  TO service_role
  USING (true);

-- Updated_at trigger (uses existing function from phase1_core)
CREATE TRIGGER update_ics_updated_at
  BEFORE UPDATE ON info_collection_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE info_collection_sessions IS 'User information collection sessions for website generation';
COMMENT ON COLUMN info_collection_sessions.crawler_output IS 'Enriched data following production_master_map schema';
```

---

### T2: TypeScript Types

**File**: `app/types/info-collection.ts`

```typescript
/**
 * Types for Website Information Collection Agent
 * Based on spec: specs/001-info-collection-agent/spec.md
 */

import { z } from 'zod';

// ============================================================================
// Session Status & Steps
// ============================================================================

export const InfoCollectionStatusSchema = z.enum([
  'in_progress',
  'completed', 
  'crawler_queued',
  'crawler_completed',
  'cancelled'
]);
export type InfoCollectionStatus = z.infer<typeof InfoCollectionStatusSchema>;

export const CollectionStepSchema = z.enum([
  'website_url',
  'google_maps_url', 
  'description',
  'review',
  'completed'
]);
export type CollectionStep = z.infer<typeof CollectionStepSchema>;

// ============================================================================
// Session Data
// ============================================================================

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

// ============================================================================
// Crawler Integration Types
// ============================================================================

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

// ============================================================================
// Tool Input/Output Schemas (Zod)
// ============================================================================

export const WebsiteUrlInputSchema = z.object({
  url: z.string().url().optional(),
  hasWebsite: z.boolean().describe('Whether user has an existing website'),
});

export const GoogleMapsUrlInputSchema = z.object({
  url: z.string().optional(),
  hasListing: z.boolean().describe('Whether user has a Google Maps listing'),
});

export const DescriptionInputSchema = z.object({
  description: z.string().min(1).describe('User description of desired website'),
});

export const UpdateFieldInputSchema = z.object({
  field: z.enum(['websiteUrl', 'googleMapsUrl', 'websiteDescription']),
  value: z.string(),
});

export const SessionActionInputSchema = z.object({
  action: z.enum(['confirm', 'cancel', 'edit']),
});

// ============================================================================
// API Response Types
// ============================================================================

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
```

---

### T3: Supabase Service Layer

**File**: `app/lib/services/infoCollectionService.ts`

```typescript
/**
 * Info Collection Service
 * Database operations for website information collection sessions
 */

import { createClient } from '@supabase/supabase-js';
import type {
  InfoCollectionSession,
  InfoCollectionSessionRow,
  InfoCollectionStatus,
  CollectionStep,
  CrawlerDataPackage,
  CrawlerOutput,
} from '~/types/info-collection';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('InfoCollectionService');

// ============================================================================
// Configuration
// ============================================================================

const getSupabaseClient = () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  
  if (!url || !key) {
    throw new Error('Missing Supabase configuration');
  }
  
  return createClient(url, key);
};

// ============================================================================
// Row <-> Entity Mapping
// ============================================================================

function rowToSession(row: InfoCollectionSessionRow): InfoCollectionSession {
  return {
    id: row.id,
    userId: row.user_id,
    websiteUrl: row.website_url,
    websiteUrlValidated: row.website_url_validated,
    googleMapsUrl: row.google_maps_url,
    googleMapsUrlValidated: row.google_maps_url_validated,
    websiteDescription: row.website_description,
    status: row.status,
    chatId: row.chat_id,
    currentStep: row.current_step,
    crawlerJobId: row.crawler_job_id,
    crawlerOutput: row.crawler_output,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

// ============================================================================
// Service Class
// ============================================================================

export class InfoCollectionService {
  private supabase = getSupabaseClient();
  
  /**
   * Create a new info collection session
   */
  async createSession(userId: string, chatId?: string): Promise<InfoCollectionSession> {
    logger.debug(`Creating session for user: ${userId}`);
    
    const { data, error } = await this.supabase
      .from('info_collection_sessions')
      .insert({
        user_id: userId,
        chat_id: chatId || null,
        status: 'in_progress',
        current_step: 'website_url',
      })
      .select()
      .single();
    
    if (error) {
      logger.error('Failed to create session', error);
      throw new Error(`Failed to create session: ${error.message}`);
    }
    
    return rowToSession(data);
  }
  
  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<InfoCollectionSession | null> {
    const { data, error } = await this.supabase
      .from('info_collection_sessions')
      .select()
      .eq('id', sessionId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to get session: ${error.message}`);
    }
    
    return rowToSession(data);
  }
  
  /**
   * Get active session for user (most recent in_progress)
   */
  async getActiveSession(userId: string): Promise<InfoCollectionSession | null> {
    const { data, error } = await this.supabase
      .from('info_collection_sessions')
      .select()
      .eq('user_id', userId)
      .eq('status', 'in_progress')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get active session: ${error.message}`);
    }
    
    return rowToSession(data);
  }
  
  /**
   * Get all sessions for user
   */
  async getUserSessions(userId: string): Promise<InfoCollectionSession[]> {
    const { data, error } = await this.supabase
      .from('info_collection_sessions')
      .select()
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      throw new Error(`Failed to get user sessions: ${error.message}`);
    }
    
    return data.map(rowToSession);
  }
  
  /**
   * Update website URL
   */
  async updateWebsiteUrl(
    sessionId: string, 
    url: string | null, 
    validated: boolean
  ): Promise<InfoCollectionSession> {
    const { data, error } = await this.supabase
      .from('info_collection_sessions')
      .update({
        website_url: url,
        website_url_validated: validated,
        current_step: 'google_maps_url',
      })
      .eq('id', sessionId)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to update website URL: ${error.message}`);
    }
    
    return rowToSession(data);
  }
  
  /**
   * Update Google Maps URL
   */
  async updateGoogleMapsUrl(
    sessionId: string,
    url: string | null,
    validated: boolean
  ): Promise<InfoCollectionSession> {
    const { data, error } = await this.supabase
      .from('info_collection_sessions')
      .update({
        google_maps_url: url,
        google_maps_url_validated: validated,
        current_step: 'description',
      })
      .eq('id', sessionId)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to update Google Maps URL: ${error.message}`);
    }
    
    return rowToSession(data);
  }
  
  /**
   * Update website description
   */
  async updateDescription(
    sessionId: string,
    description: string
  ): Promise<InfoCollectionSession> {
    const { data, error } = await this.supabase
      .from('info_collection_sessions')
      .update({
        website_description: description,
        current_step: 'review',
      })
      .eq('id', sessionId)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to update description: ${error.message}`);
    }
    
    return rowToSession(data);
  }
  
  /**
   * Update a specific field (for corrections)
   */
  async updateField(
    sessionId: string,
    field: 'websiteUrl' | 'googleMapsUrl' | 'websiteDescription',
    value: string
  ): Promise<InfoCollectionSession> {
    const fieldMap = {
      websiteUrl: 'website_url',
      googleMapsUrl: 'google_maps_url',
      websiteDescription: 'website_description',
    };
    
    const { data, error } = await this.supabase
      .from('info_collection_sessions')
      .update({ [fieldMap[field]]: value })
      .eq('id', sessionId)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to update field: ${error.message}`);
    }
    
    return rowToSession(data);
  }
  
  /**
   * Complete session and queue crawler
   */
  async completeSession(sessionId: string): Promise<{
    session: InfoCollectionSession;
    crawlerPackage: CrawlerDataPackage;
  }> {
    const { data, error } = await this.supabase
      .from('info_collection_sessions')
      .update({
        status: 'crawler_queued',
        current_step: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to complete session: ${error.message}`);
    }
    
    const session = rowToSession(data);
    
    // Build crawler data package
    const crawlerPackage: CrawlerDataPackage = {
      sessionId: session.id,
      userId: session.userId,
      websiteUrl: session.websiteUrl,
      googleMapsUrl: session.googleMapsUrl,
      userDescription: session.websiteDescription || '',
      createdAt: session.createdAt,
    };
    
    logger.info(`Session ${sessionId} completed, crawler package ready`);
    
    return { session, crawlerPackage };
  }
  
  /**
   * Update session with crawler output
   */
  async updateCrawlerOutput(
    sessionId: string,
    crawlerJobId: string,
    output: CrawlerOutput
  ): Promise<InfoCollectionSession> {
    const { data, error } = await this.supabase
      .from('info_collection_sessions')
      .update({
        crawler_job_id: crawlerJobId,
        crawler_output: output,
        status: 'crawler_completed',
      })
      .eq('id', sessionId)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to update crawler output: ${error.message}`);
    }
    
    return rowToSession(data);
  }
  
  /**
   * Delete session (FR-015)
   */
  async deleteSession(sessionId: string, userId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('info_collection_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('user_id', userId);
    
    if (error) {
      throw new Error(`Failed to delete session: ${error.message}`);
    }
    
    logger.info(`Session ${sessionId} deleted by user ${userId}`);
    return true;
  }
  
  /**
   * Cancel session
   */
  async cancelSession(sessionId: string): Promise<InfoCollectionSession> {
    const { data, error } = await this.supabase
      .from('info_collection_sessions')
      .update({ status: 'cancelled' })
      .eq('id', sessionId)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to cancel session: ${error.message}`);
    }
    
    return rowToSession(data);
  }
}

// Singleton export
export const infoCollectionService = new InfoCollectionService();
```

---

### T4: URL Validation Utilities

**File**: `app/utils/urlValidation.ts`

```typescript
/**
 * URL Validation Utilities
 * For website and Google Maps URL format validation
 */

export interface UrlValidationResult {
  isValid: boolean;
  normalizedUrl: string | null;
  error?: string;
}

/**
 * Validate and normalize a website URL
 * Accepts http:// or https:// URLs
 */
export function validateWebsiteUrl(input: string): UrlValidationResult {
  if (!input || input.trim() === '') {
    return { isValid: false, normalizedUrl: null, error: 'URL cannot be empty' };
  }
  
  let url = input.trim();
  
  // Add https:// if no protocol specified
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }
  
  try {
    const parsed = new URL(url);
    
    // Must have a valid hostname
    if (!parsed.hostname || parsed.hostname.length < 3) {
      return { isValid: false, normalizedUrl: null, error: 'Invalid domain name' };
    }
    
    // Must have at least one dot in hostname (basic domain check)
    if (!parsed.hostname.includes('.')) {
      return { isValid: false, normalizedUrl: null, error: 'Invalid domain format' };
    }
    
    return { isValid: true, normalizedUrl: parsed.href };
  } catch {
    return { isValid: false, normalizedUrl: null, error: 'Invalid URL format' };
  }
}

/**
 * Validate and normalize a Google Maps URL
 * Accepts various Google Maps URL formats:
 * - google.com/maps/...
 * - maps.google.com/...
 * - goo.gl/maps/...
 * - maps.app.goo.gl/...
 */
export function validateGoogleMapsUrl(input: string): UrlValidationResult {
  if (!input || input.trim() === '') {
    return { isValid: false, normalizedUrl: null, error: 'URL cannot be empty' };
  }
  
  let url = input.trim();
  
  // Add https:// if no protocol specified
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }
  
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    
    // Valid Google Maps hostnames
    const validHostnames = [
      'google.com',
      'www.google.com',
      'maps.google.com',
      'goo.gl',
      'maps.app.goo.gl',
    ];
    
    // Check for Google Maps specific patterns
    const isGoogleMaps = 
      validHostnames.some(h => hostname === h || hostname.endsWith(`.${h}`)) &&
      (parsed.pathname.includes('/maps') || hostname.includes('goo.gl'));
    
    if (!isGoogleMaps) {
      return { 
        isValid: false, 
        normalizedUrl: null, 
        error: 'Not a valid Google Maps URL. Please provide a link from Google Maps.' 
      };
    }
    
    return { isValid: true, normalizedUrl: parsed.href };
  } catch {
    return { isValid: false, normalizedUrl: null, error: 'Invalid URL format' };
  }
}

/**
 * Extract place ID from Google Maps URL if present
 */
export function extractPlaceId(url: string): string | null {
  try {
    const parsed = new URL(url);
    
    // Check for place_id in query params
    const placeId = parsed.searchParams.get('place_id');
    if (placeId) return placeId;
    
    // Check for place ID in path (format: /place/ChIJ...)
    const pathMatch = parsed.pathname.match(/\/place\/([A-Za-z0-9_-]+)/);
    if (pathMatch) return pathMatch[1];
    
    return null;
  } catch {
    return null;
  }
}
```

---

### T5: Info Collection Tools

**File**: `app/lib/tools/infoCollectionTools.ts`

```typescript
/**
 * Info Collection Tools for AI SDK
 * LLM-callable tools for collecting website generation information
 */

import { tool } from 'ai';
import { z } from 'zod';
import { infoCollectionService } from '~/lib/services/infoCollectionService';
import { validateWebsiteUrl, validateGoogleMapsUrl } from '~/utils/urlValidation';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('InfoCollectionTools');

// ============================================================================
// Tool Context Type (passed from API route)
// ============================================================================

export interface ToolContext {
  userId: string;
  sessionId?: string;
  chatId?: string;
}

// ============================================================================
// Tool Factory
// ============================================================================

export function createInfoCollectionTools(context: ToolContext) {
  return {
    /**
     * Start or get the info collection session
     */
    startInfoCollection: tool({
      description: 'Start a new website information collection session or resume an existing one. Call this when user wants to generate/create a website.',
      inputSchema: z.object({}),
      execute: async () => {
        logger.debug('startInfoCollection called', { userId: context.userId });
        
        // Check for existing active session
        let session = await infoCollectionService.getActiveSession(context.userId);
        
        if (!session) {
          // Create new session
          session = await infoCollectionService.createSession(
            context.userId, 
            context.chatId
          );
        }
        
        return {
          sessionId: session.id,
          currentStep: session.currentStep,
          existingData: {
            websiteUrl: session.websiteUrl,
            googleMapsUrl: session.googleMapsUrl,
            description: session.websiteDescription,
          },
          message: session.currentStep === 'website_url' 
            ? 'Started new session. Ask user about their existing website.'
            : `Resumed session at step: ${session.currentStep}`,
        };
      },
    }),

    /**
     * Collect website URL from user
     */
    collectWebsiteUrl: tool({
      description: 'Record whether user has an existing website and collect the URL if they do. Call after asking about existing website.',
      inputSchema: z.object({
        sessionId: z.string().describe('The session ID from startInfoCollection'),
        hasWebsite: z.boolean().describe('Whether the user has an existing website'),
        url: z.string().optional().describe('The website URL if user has one'),
      }),
      execute: async ({ sessionId, hasWebsite, url }) => {
        logger.debug('collectWebsiteUrl called', { sessionId, hasWebsite, url });
        
        if (!hasWebsite) {
          // User has no website, skip to next step
          const session = await infoCollectionService.updateWebsiteUrl(
            sessionId,
            null,
            false
          );
          return {
            success: true,
            message: 'No existing website noted. Proceed to ask about Google Maps listing.',
            nextStep: session.currentStep,
          };
        }
        
        if (!url) {
          return {
            success: false,
            message: 'User indicated they have a website but no URL provided. Ask for the URL.',
            requiresUrl: true,
          };
        }
        
        // Validate URL format
        const validation = validateWebsiteUrl(url);
        
        if (!validation.isValid) {
          return {
            success: false,
            message: `Invalid URL: ${validation.error}. Ask user to provide a valid website URL.`,
            error: validation.error,
          };
        }
        
        const session = await infoCollectionService.updateWebsiteUrl(
          sessionId,
          validation.normalizedUrl,
          true
        );
        
        return {
          success: true,
          normalizedUrl: validation.normalizedUrl,
          message: 'Website URL recorded. Proceed to ask about Google Maps listing.',
          nextStep: session.currentStep,
        };
      },
    }),

    /**
     * Collect Google Maps URL from user
     */
    collectGoogleMapsUrl: tool({
      description: 'Record whether user has a Google Maps business listing and collect the URL if they do.',
      inputSchema: z.object({
        sessionId: z.string().describe('The session ID'),
        hasListing: z.boolean().describe('Whether user has a Google Maps business listing'),
        url: z.string().optional().describe('The Google Maps URL if user has one'),
      }),
      execute: async ({ sessionId, hasListing, url }) => {
        logger.debug('collectGoogleMapsUrl called', { sessionId, hasListing, url });
        
        if (!hasListing) {
          const session = await infoCollectionService.updateGoogleMapsUrl(
            sessionId,
            null,
            false
          );
          return {
            success: true,
            message: 'No Google Maps listing noted. Proceed to ask for website description.',
            nextStep: session.currentStep,
          };
        }
        
        if (!url) {
          return {
            success: false,
            message: 'User has a listing but no URL provided. Ask for the Google Maps link.',
            requiresUrl: true,
          };
        }
        
        const validation = validateGoogleMapsUrl(url);
        
        if (!validation.isValid) {
          return {
            success: false,
            message: `Invalid Google Maps URL: ${validation.error}. Ask user to provide a valid Google Maps link.`,
            error: validation.error,
          };
        }
        
        const session = await infoCollectionService.updateGoogleMapsUrl(
          sessionId,
          validation.normalizedUrl,
          true
        );
        
        return {
          success: true,
          normalizedUrl: validation.normalizedUrl,
          message: 'Google Maps URL recorded. Proceed to ask for website description.',
          nextStep: session.currentStep,
        };
      },
    }),

    /**
     * Collect website description
     */
    collectDescription: tool({
      description: 'Record the user description of their desired website. Any non-empty description is accepted.',
      inputSchema: z.object({
        sessionId: z.string().describe('The session ID'),
        description: z.string().min(1).describe('User description of desired website'),
      }),
      execute: async ({ sessionId, description }) => {
        logger.debug('collectDescription called', { sessionId, descLength: description.length });
        
        const session = await infoCollectionService.updateDescription(
          sessionId,
          description.trim()
        );
        
        return {
          success: true,
          message: 'Description recorded. Present summary to user for confirmation.',
          nextStep: session.currentStep,
          collectedData: {
            websiteUrl: session.websiteUrl,
            googleMapsUrl: session.googleMapsUrl,
            description: session.websiteDescription,
          },
        };
      },
    }),

    /**
     * Update a specific field (for corrections)
     */
    updateCollectedInfo: tool({
      description: 'Update a previously collected field when user wants to make a correction.',
      inputSchema: z.object({
        sessionId: z.string().describe('The session ID'),
        field: z.enum(['websiteUrl', 'googleMapsUrl', 'websiteDescription']),
        newValue: z.string().describe('The corrected value'),
      }),
      execute: async ({ sessionId, field, newValue }) => {
        logger.debug('updateCollectedInfo called', { sessionId, field });
        
        // Validate if URL field
        if (field === 'websiteUrl') {
          const validation = validateWebsiteUrl(newValue);
          if (!validation.isValid) {
            return { success: false, error: validation.error };
          }
          newValue = validation.normalizedUrl!;
        } else if (field === 'googleMapsUrl') {
          const validation = validateGoogleMapsUrl(newValue);
          if (!validation.isValid) {
            return { success: false, error: validation.error };
          }
          newValue = validation.normalizedUrl!;
        }
        
        const session = await infoCollectionService.updateField(
          sessionId,
          field,
          newValue
        );
        
        return {
          success: true,
          message: `${field} updated successfully.`,
          updatedSession: {
            websiteUrl: session.websiteUrl,
            googleMapsUrl: session.googleMapsUrl,
            description: session.websiteDescription,
          },
        };
      },
    }),

    /**
     * Finalize the collection and queue crawler
     */
    finalizeCollection: tool({
      description: 'Complete the information collection after user confirms all data is correct. This saves the data and queues it for crawler processing.',
      inputSchema: z.object({
        sessionId: z.string().describe('The session ID'),
        confirmed: z.boolean().describe('Whether user confirmed the collected information'),
      }),
      execute: async ({ sessionId, confirmed }) => {
        logger.debug('finalizeCollection called', { sessionId, confirmed });
        
        if (!confirmed) {
          return {
            success: false,
            message: 'User did not confirm. Ask what they would like to change.',
            action: 'await_correction',
          };
        }
        
        const { session, crawlerPackage } = await infoCollectionService.completeSession(
          sessionId
        );
        
        // TODO: Queue crawler job here when crawler service is integrated
        // await crawlerQueue.enqueue(crawlerPackage);
        
        logger.info('Collection finalized', { 
          sessionId, 
          hasWebsite: !!session.websiteUrl,
          hasGoogleMaps: !!session.googleMapsUrl,
        });
        
        return {
          success: true,
          message: 'Information collected successfully! Your data has been saved and website generation will begin shortly.',
          sessionId: session.id,
          status: session.status,
          crawlerPackage,
        };
      },
    }),

    /**
     * Delete a session (FR-015)
     */
    deleteSession: tool({
      description: 'Delete an information collection session when user requests it.',
      inputSchema: z.object({
        sessionId: z.string().describe('The session ID to delete'),
      }),
      execute: async ({ sessionId }) => {
        logger.debug('deleteSession called', { sessionId });
        
        await infoCollectionService.deleteSession(sessionId, context.userId);
        
        return {
          success: true,
          message: 'Session deleted successfully.',
        };
      },
    }),

    /**
     * Get current session state
     */
    getSessionState: tool({
      description: 'Get the current state of the info collection session.',
      inputSchema: z.object({
        sessionId: z.string().describe('The session ID'),
      }),
      execute: async ({ sessionId }) => {
        const session = await infoCollectionService.getSession(sessionId);
        
        if (!session) {
          return { success: false, error: 'Session not found' };
        }
        
        return {
          success: true,
          session: {
            id: session.id,
            currentStep: session.currentStep,
            status: session.status,
            websiteUrl: session.websiteUrl,
            googleMapsUrl: session.googleMapsUrl,
            description: session.websiteDescription,
          },
        };
      },
    }),
  };
}

// Type export for use in API route
export type InfoCollectionTools = ReturnType<typeof createInfoCollectionTools>;
```

---

### T6: System Prompt for Agent

**File**: `app/lib/prompts/infoCollectionPrompt.ts`

```typescript
/**
 * System Prompt for Info Collection Agent
 * Guides the LLM through the information collection flow
 */

export const INFO_COLLECTION_SYSTEM_PROMPT = `You are a friendly website generation assistant helping users collect information for their new business website.

## Your Role
Guide users through providing information about their business so we can generate a professional website. Be conversational, helpful, and understanding when users don't have all the information.

## Information to Collect
1. **Existing Website URL** (optional) - Ask if they have a current website
2. **Google Maps Business Listing** (optional) - Ask if they have a Google Maps listing for their business
3. **Website Description** (required) - What they want their new website to be like

## Conversation Flow

### Step 1: Existing Website
- Start by asking: "Do you have an existing website for your business?"
- If YES: Ask for the URL and use the \`collectWebsiteUrl\` tool
- If NO: Use \`collectWebsiteUrl\` with hasWebsite=false and proceed to Step 2

### Step 2: Google Maps Listing  
- Ask: "Do you have a Google Maps business listing?"
- If YES: Ask for the link and use the \`collectGoogleMapsUrl\` tool
- If NO: Use \`collectGoogleMapsUrl\` with hasListing=false and proceed to Step 3

### Step 3: Website Description
- Ask: "Tell me about the website you'd like. What kind of business is it? What style or features are you looking for?"
- Accept any description - there's no minimum length requirement
- Use the \`collectDescription\` tool to record their response

### Step 4: Review & Confirm
- Present a summary of all collected information
- Ask if everything looks correct
- If user wants to change something, use \`updateCollectedInfo\`
- When confirmed, use \`finalizeCollection\`

## Guidelines
- Be conversational and friendly, not robotic
- Accept variations of "no" (e.g., "I don't have one", "not yet", "skip")
- If a URL is invalid, explain the issue clearly and ask again
- Don't require excessive detail - any description is acceptable
- If user wants to update something, allow them to without restarting
- Confirm understanding after each piece of information

## Tool Usage
- Always call \`startInfoCollection\` first to get/create a session
- Pass the sessionId to all subsequent tool calls
- Handle tool errors gracefully and communicate clearly with the user

## Example Responses
- "Great! I see you have a website at example.com. Now, do you have a Google Maps listing for your business?"
- "No website yet? No problem! Do you have a Google Maps business listing?"
- "Thanks for that description! Let me summarize what we have..."
- "I couldn't validate that URL. Could you double-check and share the correct link?"`;

/**
 * Generate a context-aware prompt addition based on session state
 */
export function getSessionContextPrompt(session: {
  currentStep: string;
  websiteUrl: string | null;
  googleMapsUrl: string | null;
  description: string | null;
}): string {
  const parts: string[] = ['## Current Session State'];
  
  parts.push(`Current step: ${session.currentStep}`);
  
  if (session.websiteUrl) {
    parts.push(`Website URL collected: ${session.websiteUrl}`);
  }
  if (session.googleMapsUrl) {
    parts.push(`Google Maps URL collected: ${session.googleMapsUrl}`);
  }
  if (session.description) {
    parts.push(`Description collected: "${session.description.substring(0, 100)}${session.description.length > 100 ? '...' : ''}"`);
  }
  
  return parts.join('\n');
}
```

---

### T7: Integrate Tools with Chat API

**File Modification**: `app/routes/api.chat.ts`

Add the following to integrate info collection tools:

```typescript
// Add imports at top of file
import { createInfoCollectionTools } from '~/lib/tools/infoCollectionTools';
import { INFO_COLLECTION_SYSTEM_PROMPT } from '~/lib/prompts/infoCollectionPrompt';

// Inside chatAction function, after authentication:
async function chatAction({ context, request }: ActionFunctionArgs) {
  // ... existing code ...
  
  // After requireSessionOrError, get userId for tools
  const session = await requireSessionOrError(request);
  const userId = session.user?.id;
  
  // Detect if this is an info collection conversation
  // (You can customize this detection logic)
  const isInfoCollectionMode = messages.some(m => 
    m.content.toLowerCase().includes('generate website') ||
    m.content.toLowerCase().includes('create website') ||
    m.content.toLowerCase().includes('build website') ||
    m.content.toLowerCase().includes('new website')
  );
  
  // Create info collection tools if in that mode
  const infoCollectionTools = isInfoCollectionMode && userId 
    ? createInfoCollectionTools({ userId, chatId: chatId.get() })
    : {};
  
  // Merge with existing MCP tools
  const allTools = {
    ...mcpService.toolsWithoutExecute,
    ...infoCollectionTools,
  };
  
  // Modify system prompt if in info collection mode
  const systemPromptAddition = isInfoCollectionMode 
    ? `\n\n${INFO_COLLECTION_SYSTEM_PROMPT}`
    : '';
  
  // ... rest of existing chat logic, using allTools instead of just mcpService.toolsWithoutExecute
}
```

---

### T8: Client-Side Store

**File**: `app/lib/stores/infoCollection.ts`

```typescript
/**
 * Client-side store for info collection state
 */

import { atom, map } from 'nanostores';
import type { InfoCollectionSession, CollectionStep } from '~/types/info-collection';

// Current active session
export const activeSession = atom<InfoCollectionSession | null>(null);

// Loading states
export const isLoadingSession = atom<boolean>(false);

// Collection progress for UI
export const collectionProgress = map<{
  step: CollectionStep;
  completedSteps: CollectionStep[];
  websiteUrl: string | null;
  googleMapsUrl: string | null;
  description: string | null;
}>({
  step: 'website_url',
  completedSteps: [],
  websiteUrl: null,
  googleMapsUrl: null,
  description: null,
});

// Actions
export function setActiveSession(session: InfoCollectionSession | null) {
  activeSession.set(session);
  
  if (session) {
    collectionProgress.set({
      step: session.currentStep,
      completedSteps: getCompletedSteps(session.currentStep),
      websiteUrl: session.websiteUrl,
      googleMapsUrl: session.googleMapsUrl,
      description: session.websiteDescription,
    });
  }
}

export function clearSession() {
  activeSession.set(null);
  collectionProgress.set({
    step: 'website_url',
    completedSteps: [],
    websiteUrl: null,
    googleMapsUrl: null,
    description: null,
  });
}

// Helper to determine completed steps
function getCompletedSteps(currentStep: CollectionStep): CollectionStep[] {
  const stepOrder: CollectionStep[] = [
    'website_url',
    'google_maps_url',
    'description',
    'review',
    'completed',
  ];
  
  const currentIndex = stepOrder.indexOf(currentStep);
  return stepOrder.slice(0, currentIndex);
}

// Fetch session from API
export async function fetchActiveSession(): Promise<void> {
  isLoadingSession.set(true);
  
  try {
    const response = await fetch('/api/info-collection/active');
    
    if (response.ok) {
      const data = await response.json();
      setActiveSession(data.session);
    } else {
      setActiveSession(null);
    }
  } catch (error) {
    console.error('Failed to fetch active session:', error);
    setActiveSession(null);
  } finally {
    isLoadingSession.set(false);
  }
}
```

---

### T9: Session Management UI Component

**File**: `app/components/chat/InfoCollectionStatus.tsx`

```typescript
/**
 * Info Collection Status Component
 * Shows progress indicator during information collection flow
 */

import { useStore } from '@nanostores/react';
import { collectionProgress, isLoadingSession } from '~/lib/stores/infoCollection';
import type { CollectionStep } from '~/types/info-collection';

const STEP_LABELS: Record<CollectionStep, string> = {
  website_url: 'Existing Website',
  google_maps_url: 'Google Maps',
  description: 'Description',
  review: 'Review',
  completed: 'Complete',
};

const STEP_ORDER: CollectionStep[] = [
  'website_url',
  'google_maps_url',
  'description',
  'review',
  'completed',
];

export function InfoCollectionStatus() {
  const progress = useStore(collectionProgress);
  const isLoading = useStore(isLoadingSession);
  
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-bolt-elements-background-depth-2 rounded-lg">
        <div className="i-svg-spinners:ring-resize text-bolt-elements-item-contentAccent" />
        <span className="text-sm text-bolt-elements-textSecondary">Loading...</span>
      </div>
    );
  }
  
  const currentIndex = STEP_ORDER.indexOf(progress.step);
  
  return (
    <div className="px-4 py-3 bg-bolt-elements-background-depth-2 rounded-lg">
      <div className="text-xs text-bolt-elements-textSecondary mb-2 font-medium">
        Website Information Collection
      </div>
      
      {/* Progress Steps */}
      <div className="flex items-center gap-1">
        {STEP_ORDER.slice(0, -1).map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          
          return (
            <div key={step} className="flex items-center">
              {/* Step indicator */}
              <div
                className={`
                  w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium
                  transition-colors duration-200
                  ${isCompleted 
                    ? 'bg-green-500 text-white' 
                    : isCurrent 
                      ? 'bg-bolt-elements-item-contentAccent text-white'
                      : 'bg-bolt-elements-background-depth-3 text-bolt-elements-textTertiary'
                  }
                `}
              >
                {isCompleted ? (
                  <span className="i-ph:check-bold" />
                ) : (
                  index + 1
                )}
              </div>
              
              {/* Connector line */}
              {index < STEP_ORDER.length - 2 && (
                <div
                  className={`
                    w-8 h-0.5 mx-1
                    ${index < currentIndex 
                      ? 'bg-green-500' 
                      : 'bg-bolt-elements-background-depth-3'
                    }
                  `}
                />
              )}
            </div>
          );
        })}
      </div>
      
      {/* Current step label */}
      <div className="mt-2 text-sm text-bolt-elements-textPrimary">
        {STEP_LABELS[progress.step]}
      </div>
      
      {/* Collected data preview */}
      {(progress.websiteUrl || progress.googleMapsUrl || progress.description) && (
        <div className="mt-3 pt-3 border-t border-bolt-elements-borderColor">
          <div className="text-xs text-bolt-elements-textTertiary space-y-1">
            {progress.websiteUrl && (
              <div className="flex items-center gap-2">
                <span className="i-ph:globe text-green-500" />
                <span className="truncate">{progress.websiteUrl}</span>
              </div>
            )}
            {progress.googleMapsUrl && (
              <div className="flex items-center gap-2">
                <span className="i-ph:map-pin text-green-500" />
                <span className="truncate">Google Maps linked</span>
              </div>
            )}
            {progress.description && (
              <div className="flex items-center gap-2">
                <span className="i-ph:text-aa text-green-500" />
                <span className="truncate">Description added</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

### T10: API Route for Sessions

**File**: `app/routes/api.info-collection.ts`

```typescript
/**
 * Info Collection API Routes
 * REST endpoints for session management
 */

import { type ActionFunctionArgs, type LoaderFunctionArgs, json } from '@remix-run/cloudflare';
import { requireSessionOrError } from '~/lib/auth/guards.server';
import { infoCollectionService } from '~/lib/services/infoCollectionService';
import type { InfoCollectionResponse, SessionListResponse } from '~/types/info-collection';

/**
 * GET /api/info-collection - List user sessions
 * GET /api/info-collection?active=true - Get active session
 * GET /api/info-collection/:id - Get specific session
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const session = await requireSessionOrError(request);
  const userId = session.user?.id;
  
  if (!userId) {
    return json({ error: 'User ID not found' }, { status: 400 });
  }
  
  const url = new URL(request.url);
  const active = url.searchParams.get('active') === 'true';
  const sessionId = url.pathname.split('/').pop();
  
  try {
    // Get active session
    if (active) {
      const activeSession = await infoCollectionService.getActiveSession(userId);
      return json<InfoCollectionResponse>({
        success: true,
        session: activeSession || undefined,
      });
    }
    
    // Get specific session by ID
    if (sessionId && sessionId !== 'info-collection') {
      const targetSession = await infoCollectionService.getSession(sessionId);
      
      if (!targetSession || targetSession.userId !== userId) {
        return json({ error: 'Session not found' }, { status: 404 });
      }
      
      return json<InfoCollectionResponse>({
        success: true,
        session: targetSession,
      });
    }
    
    // List all sessions
    const sessions = await infoCollectionService.getUserSessions(userId);
    return json<SessionListResponse>({
      sessions,
      total: sessions.length,
    });
  } catch (error) {
    console.error('Info collection loader error:', error);
    return json({ error: 'Failed to load sessions' }, { status: 500 });
  }
}

/**
 * POST /api/info-collection - Create new session
 * DELETE /api/info-collection/:id - Delete session
 */
export async function action({ request }: ActionFunctionArgs) {
  const session = await requireSessionOrError(request);
  const userId = session.user?.id;
  
  if (!userId) {
    return json({ error: 'User ID not found' }, { status: 400 });
  }
  
  const method = request.method;
  
  try {
    if (method === 'POST') {
      // Create new session
      const body = await request.json().catch(() => ({}));
      const chatId = body.chatId as string | undefined;
      
      const newSession = await infoCollectionService.createSession(userId, chatId);
      
      return json<InfoCollectionResponse>({
        success: true,
        session: newSession,
        message: 'Session created successfully',
      });
    }
    
    if (method === 'DELETE') {
      // Delete session
      const url = new URL(request.url);
      const sessionId = url.pathname.split('/').pop();
      
      if (!sessionId || sessionId === 'info-collection') {
        return json({ error: 'Session ID required' }, { status: 400 });
      }
      
      await infoCollectionService.deleteSession(sessionId, userId);
      
      return json<InfoCollectionResponse>({
        success: true,
        message: 'Session deleted successfully',
      });
    }
    
    return json({ error: 'Method not allowed' }, { status: 405 });
  } catch (error) {
    console.error('Info collection action error:', error);
    return json({ error: 'Operation failed' }, { status: 500 });
  }
}
```

---

## 7. Testing Strategy

### Unit Tests

**File**: `tests/unit/urlValidation.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { validateWebsiteUrl, validateGoogleMapsUrl, extractPlaceId } from '~/utils/urlValidation';

describe('validateWebsiteUrl', () => {
  it('accepts valid URLs with https', () => {
    const result = validateWebsiteUrl('https://example.com');
    expect(result.isValid).toBe(true);
    expect(result.normalizedUrl).toBe('https://example.com/');
  });
  
  it('adds https to URLs without protocol', () => {
    const result = validateWebsiteUrl('example.com');
    expect(result.isValid).toBe(true);
    expect(result.normalizedUrl).toBe('https://example.com/');
  });
  
  it('rejects invalid URLs', () => {
    const result = validateWebsiteUrl('not a url');
    expect(result.isValid).toBe(false);
    expect(result.error).toBeDefined();
  });
  
  it('rejects empty input', () => {
    const result = validateWebsiteUrl('');
    expect(result.isValid).toBe(false);
  });
});

describe('validateGoogleMapsUrl', () => {
  it('accepts google.com/maps URLs', () => {
    const result = validateGoogleMapsUrl('https://www.google.com/maps/place/Test');
    expect(result.isValid).toBe(true);
  });
  
  it('accepts goo.gl/maps URLs', () => {
    const result = validateGoogleMapsUrl('https://goo.gl/maps/abc123');
    expect(result.isValid).toBe(true);
  });
  
  it('accepts maps.app.goo.gl URLs', () => {
    const result = validateGoogleMapsUrl('https://maps.app.goo.gl/abc123');
    expect(result.isValid).toBe(true);
  });
  
  it('rejects non-Google Maps URLs', () => {
    const result = validateGoogleMapsUrl('https://example.com');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Google Maps');
  });
});

describe('extractPlaceId', () => {
  it('extracts place_id from query params', () => {
    const placeId = extractPlaceId('https://www.google.com/maps?place_id=ChIJabc123');
    expect(placeId).toBe('ChIJabc123');
  });
  
  it('extracts place_id from path', () => {
    const placeId = extractPlaceId('https://www.google.com/maps/place/ChIJabc123');
    expect(placeId).toBe('ChIJabc123');
  });
  
  it('returns null for URLs without place_id', () => {
    const placeId = extractPlaceId('https://www.google.com/maps');
    expect(placeId).toBeNull();
  });
});
```

### Integration Tests

**File**: `tests/integration/infoCollectionFlow.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { infoCollectionService } from '~/lib/services/infoCollectionService';

// Mock Supabase client for tests
// vi.mock('@supabase/supabase-js', () => ({...}));

describe('Info Collection Flow', () => {
  const testUserId = 'test-user-123';
  let sessionId: string;
  
  beforeEach(async () => {
    // Create a test session
    const session = await infoCollectionService.createSession(testUserId);
    sessionId = session.id;
  });
  
  afterEach(async () => {
    // Cleanup
    try {
      await infoCollectionService.deleteSession(sessionId, testUserId);
    } catch {}
  });
  
  it('completes full collection flow', async () => {
    // Step 1: Website URL
    let session = await infoCollectionService.updateWebsiteUrl(
      sessionId,
      'https://example.com',
      true
    );
    expect(session.currentStep).toBe('google_maps_url');
    expect(session.websiteUrl).toBe('https://example.com');
    
    // Step 2: Google Maps
    session = await infoCollectionService.updateGoogleMapsUrl(
      sessionId,
      'https://goo.gl/maps/test',
      true
    );
    expect(session.currentStep).toBe('description');
    
    // Step 3: Description
    session = await infoCollectionService.updateDescription(
      sessionId,
      'A modern restaurant website'
    );
    expect(session.currentStep).toBe('review');
    
    // Step 4: Complete
    const { session: completed, crawlerPackage } = await infoCollectionService.completeSession(
      sessionId
    );
    expect(completed.status).toBe('crawler_queued');
    expect(crawlerPackage.websiteUrl).toBe('https://example.com');
    expect(crawlerPackage.userDescription).toBe('A modern restaurant website');
  });
  
  it('handles partial flow (no URLs)', async () => {
    // Skip website
    let session = await infoCollectionService.updateWebsiteUrl(sessionId, null, false);
    expect(session.currentStep).toBe('google_maps_url');
    
    // Skip Google Maps
    session = await infoCollectionService.updateGoogleMapsUrl(sessionId, null, false);
    expect(session.currentStep).toBe('description');
    
    // Add description and complete
    session = await infoCollectionService.updateDescription(sessionId, 'Just a description');
    
    const { crawlerPackage } = await infoCollectionService.completeSession(sessionId);
    expect(crawlerPackage.websiteUrl).toBeNull();
    expect(crawlerPackage.googleMapsUrl).toBeNull();
    expect(crawlerPackage.userDescription).toBe('Just a description');
  });
  
  it('allows field updates', async () => {
    // Set initial URL
    await infoCollectionService.updateWebsiteUrl(sessionId, 'https://old.com', true);
    
    // Update it
    const session = await infoCollectionService.updateField(
      sessionId,
      'websiteUrl',
      'https://new.com'
    );
    expect(session.websiteUrl).toBe('https://new.com');
  });
});
```

---

## 8. Deployment Considerations

### Environment Variables

Add to `.env` / Cloudflare secrets:

```env
# Already configured
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_KEY=your-service-key

# No new env vars needed for this feature
```

### Database Migration

Run migration:

```bash
# Local development
pnpm supabase migration up

# Production
pnpm supabase db push --linked
```

### Crawler Integration (Future)

The `completeSession` method returns a `CrawlerDataPackage`. When the crawler service is ready:

1. Create a queue (e.g., Cloudflare Queue, SQS)
2. Publish `crawlerPackage` to the queue
3. Crawler processes and calls back with results
4. Update session via `updateCrawlerOutput`

```typescript
// Future integration point in infoCollectionService.completeSession:
// await crawlerQueue.send(crawlerPackage);
```

---

## Summary

This plan provides a complete, detailed implementation guide for the Website Information Collection Agent. Key highlights:

1. **LLM-based tools** using Vercel AI SDK for natural conversation
2. **Persistent storage** in Supabase for session recovery
3. **Async crawler integration** for non-blocking enrichment
4. **Progressive UI** showing collection progress
5. **Full test coverage** for URL validation and flow

**Estimated Total Time**: ~10 hours

**Next Step**: Run `/speckit.implement` or start with T1 (database migration)

