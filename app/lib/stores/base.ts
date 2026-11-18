/**
 * Base types for service connection stores
 *
 * These interfaces provide a consistent structure across all service integrations
 * (Netlify, Vercel, GitHub, Supabase, etc.) while allowing service-specific extensions.
 */

/**
 * Base connection state that all service stores implement
 *
 * @template TUser - The user/account type returned by the service API
 * @template TStats - The statistics/resources type for the service
 * @template TMetadata - Optional service-specific metadata (token types, rate limits, etc.)
 */
export interface ServiceConnectionState<
  TUser = unknown,
  TStats extends ServiceStats = ServiceStats,
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
> {
  /** Currently connected user/account (null if not connected) */
  user: TUser | null;

  /** API access token for the service */
  token: string;

  /** Service statistics and resources (projects, repos, sites, etc.) */
  stats?: TStats;

  /** Additional service-specific data (optional) */
  metadata?: TMetadata;
}

/**
 * Extended state for services that support resource/project selection
 *
 * Used by services like Supabase where you select a specific project to work with.
 *
 * @template TUser - The user/account type
 * @template TStats - The statistics type  
 * @template TResource - The selectable resource type (project, site, etc.)
 * @template TMetadata - Optional service-specific metadata
 */
export interface SelectableResourceConnectionState<
  TUser = unknown,
  TStats extends ServiceStats = ServiceStats,
  TResource = unknown,
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
> extends ServiceConnectionState<TUser, TStats, TMetadata> {
  /** ID of the currently selected resource */
  selectedResourceId?: string;

  /** Full details of the selected resource */
  selectedResource?: TResource;
}

/**
 * Base stats interface with optional lastUpdated timestamp
 *
 * All service-specific stats types should extend this to ensure
 * consistent lastUpdated tracking across tabs.
 */
export interface ServiceStats {
  /** ISO 8601 timestamp of when stats were last fetched */
  lastUpdated?: string;
}

/**
 * Standard shape for connection loading states
 */
export interface ConnectionLoadingState {
  /** Whether an initial connection attempt is in progress */
  isConnecting: boolean;

  /** Whether stats/resources are being fetched */
  isFetchingStats: boolean;
}

/**
 * Helper type for connection atoms pattern used across stores
 */
export interface ConnectionAtoms<TConnection> {
  /** Main connection state atom */
  connection: TConnection;

  /** Loading state atom */
  isConnecting: boolean;

  /** Stats fetching state atom */
  isFetchingStats: boolean;
}

/**
 * Standard function signature for initializing connections
 */
export type InitializeConnection = () => void | Promise<void>;

/**
 * Standard function signature for fetching stats
 */
export type FetchStats = (token: string) => Promise<void>;

/**
 * Standard function signature for updating connection state
 */
export type UpdateConnection<TConnection> = (updates: Partial<TConnection>) => void;
