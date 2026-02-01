/*
 * Project types for user project tables feature
 * Generated from specs/001-user-project-tables/data-model.md
 */

// Import FileMap type for snapshots
import type { FileMap } from '~/lib/stores/files';
import type { JSONValue } from 'ai';
import type { BusinessData, GeneratedContent } from './crawler';

export type ProjectStatus = 'draft' | 'published' | 'archived';

export const PROJECT_STATUS_VALUES = ['draft', 'published', 'archived'] as const satisfies ProjectStatus[];

export interface Project {
  id: string;
  user_id: string;
  tenant_id: string | null;
  name: string;
  description: string | null;
  status: ProjectStatus;
  url_id: string | null;
  business_profile?: BusinessProfile | null; // Crawler data stored directly on projects table
  created_at: string;
  updated_at: string;
}

export interface ProjectMessage {
  id: string;
  project_id: string;
  message_id: string;
  sequence_num: number;
  role: 'user' | 'assistant' | 'system';
  content: unknown; // JSON content matching Vercel AI SDK Message format
  annotations: JSONValue[] | null;
  created_at: string;
}

export interface ProjectSnapshot {
  id: string;
  project_id: string;
  files: FileMap;
  summary: string | null;
  created_at: string;
  updated_at: string;
}

// Request/Response types for API
export interface CreateProjectInput {
  name: string;
  description?: string;
  gmaps_url?: string;
  address?: Record<string, unknown>;
  session_id?: string; // Crawler session ID (1:1 with project)
  businessProfile?: BusinessProfile; // Crawler data and generated content
}

// Business profile data from crawler API
export interface BusinessProfile {
  session_id?: string;
  gmaps_url?: string;
  crawled_at?: string;

  // ─── Legacy Fields (existing projects) ───────────────────────────
  /** Raw Google Maps data from /crawl endpoint */
  crawled_data?: BusinessData;

  /** AI-generated content from /generate-website-content endpoint */
  generated_content?: GeneratedContent;

  // ─── Enhanced Fields (new crawls) ────────────────────────────────
  /**
   * Markdown profile generated from Google Maps data.
   * Contains structured sections: Basic Info, Hours, Menu, Reviews, etc.
   * Pre-formatted for LLM prompt injection.
   */
  google_maps_markdown?: string;

  /**
   * Markdown from crawling the restaurant's existing website.
   * Contains visual style descriptions, layout analysis, and content sections.
   * Optional - only populated if restaurant has a website.
   */
  website_markdown?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  status?: ProjectStatus;
}

export interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  url_id: string | null;
  updated_at: string;
  message_count: number;
  has_snapshot: boolean;
}

export interface ProjectWithDetails extends Project {
  business_profile?: BusinessProfile | null;
}

export interface ProjectsListResponse {
  projects: ProjectSummary[];
  total: number;
  limit: number;
  offset: number;
}

export interface MessagesListResponse {
  messages: ProjectMessage[];
  total: number;
}

export interface SaveSnapshotRequest {
  files: FileMap;
  summary?: string;
}

export interface SaveSnapshotResponse {
  updated_at: string;
}

export interface SaveMessagesResponse {
  saved_count: number;
}

// API error response
export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// Common API status codes
export const PROJECT_ERROR_CODES = {
  NOT_FOUND: 'PROJECT_NOT_FOUND',
  UNAUTHORIZED: 'PROJECT_UNAUTHORIZED',
  LIMIT_REACHED: 'PROJECT_LIMIT_REACHED',
  INVALID_INPUT: 'PROJECT_INVALID_INPUT',
  SNAPSHOT_TOO_LARGE: 'SNAPSHOT_TOO_LARGE',
  SAVE_FAILED: 'SAVE_FAILED',

  // RLS and authentication-related error codes
  RLS_CONTEXT_FAILED: 'RLS_CONTEXT_FAILED',
  DATABASE_UNAUTHORIZED: 'DATABASE_UNAUTHORIZED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

// Pagination params
export interface PaginationParams {
  limit?: number;
  offset?: number;
}

// Input for saving messages
export interface SaveMessagesInput {
  messages: Omit<ProjectMessage, 'id' | 'created_at'>[];
}
