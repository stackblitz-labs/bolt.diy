/**
 * Info Collection Service
 * Database operations for website information collection sessions
 */

import { createClient } from '@supabase/supabase-js';
import type {
  InfoCollectionSession,
  InfoCollectionSessionRow,
  CrawlerDataPackage,
  CrawlerOutput,
} from '~/types/info-collection';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('InfoCollectionService');

/*
 * ============================================================================
 * Configuration
 * ============================================================================
 */

const getSupabaseClient = () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    throw new Error('Missing Supabase configuration');
  }

  return createClient(url, key);
};

/*
 * ============================================================================
 * Row <-> Entity Mapping
 * ============================================================================
 */

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

/*
 * ============================================================================
 * Service Class
 * ============================================================================
 */

export class InfoCollectionService {
  private _supabase = getSupabaseClient();

  /**
   * Create a new info collection session
   */
  async createSession(userId: string, chatId?: string): Promise<InfoCollectionSession> {
    logger.debug(`Creating session for user: ${userId}`);

    const { data, error } = await this._supabase
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
    const { data, error } = await this._supabase.from('info_collection_sessions').select().eq('id', sessionId).single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      } // Not found

      throw new Error(`Failed to get session: ${error.message}`);
    }

    return rowToSession(data);
  }

  /**
   * Get active session for user (most recent in_progress)
   */
  async getActiveSession(userId: string): Promise<InfoCollectionSession | null> {
    const { data, error } = await this._supabase
      .from('info_collection_sessions')
      .select()
      .eq('user_id', userId)
      .eq('status', 'in_progress')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }

      throw new Error(`Failed to get active session: ${error.message}`);
    }

    return rowToSession(data);
  }

  /**
   * Get most recent completed session for user (crawler_queued or crawler_completed)
   * Used by the info collection gate to check if user can proceed to template selection
   */
  async getCompletedSession(userId: string): Promise<InfoCollectionSession | null> {
    const { data, error } = await this._supabase
      .from('info_collection_sessions')
      .select()
      .eq('user_id', userId)
      .in('status', ['crawler_queued', 'crawler_completed'])
      .order('completed_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }

      throw new Error(`Failed to get completed session: ${error.message}`);
    }

    return rowToSession(data);
  }

  /**
   * Get all sessions for user
   */
  async getUserSessions(userId: string): Promise<InfoCollectionSession[]> {
    const { data, error } = await this._supabase
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
  async updateWebsiteUrl(sessionId: string, url: string | null, validated: boolean): Promise<InfoCollectionSession> {
    const { data, error } = await this._supabase
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
  async updateGoogleMapsUrl(sessionId: string, url: string | null, validated: boolean): Promise<InfoCollectionSession> {
    const { data, error } = await this._supabase
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
  async updateDescription(sessionId: string, description: string): Promise<InfoCollectionSession> {
    const { data, error } = await this._supabase
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
    value: string,
  ): Promise<InfoCollectionSession> {
    const fieldMap = {
      websiteUrl: 'website_url',
      googleMapsUrl: 'google_maps_url',
      websiteDescription: 'website_description',
    };

    const { data, error } = await this._supabase
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
    const { data, error } = await this._supabase
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
    output: CrawlerOutput,
  ): Promise<InfoCollectionSession> {
    const { data, error } = await this._supabase
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
    const { error } = await this._supabase
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
    const { data, error } = await this._supabase
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

  /**
   * Store pending generation result (for serverless compatibility)
   * Stores in DB instead of in-memory Map to work across instances
   */
  async storePendingGeneration(sessionId: string, result: unknown): Promise<void> {
    const { error } = await this._supabase
      .from('info_collection_sessions')
      .update({ pending_generation: result })
      .eq('id', sessionId);

    if (error) {
      throw new Error(`Failed to store pending generation: ${error.message}`);
    }
  }

  /**
   * Retrieve and clear pending generation result
   */
  async retrievePendingGeneration(sessionId: string): Promise<unknown | undefined> {
    const { data, error } = await this._supabase
      .from('info_collection_sessions')
      .select('pending_generation')
      .eq('id', sessionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return undefined;
      }
      throw new Error(`Failed to retrieve pending generation: ${error.message}`);
    }

    const result = data.pending_generation;

    // Clear the field after retrieval
    if (result) {
      await this._supabase.from('info_collection_sessions').update({ pending_generation: null }).eq('id', sessionId);
    }

    return result;
  }
}

// Singleton export
export const infoCollectionService = new InfoCollectionService();
