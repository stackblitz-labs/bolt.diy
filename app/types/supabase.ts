import type { SelectableResourceConnectionState, ServiceStats } from '~/lib/stores/base';

export interface SupabaseUser {
  id: string;
  email: string;
  role: string;
  created_at: string;
  last_sign_in_at: string;
}

export interface SupabaseProject {
  id: string;
  name: string;
  organization_id: string;
  region: string;
  created_at: string;
  status: string;
  stats?: {
    database?: {
      tables: number;
      size: string;
      size_mb?: number;
    };
    storage?: {
      objects: number;
      size: string;
      buckets?: number;
      files?: number;
      used_gb?: number;
      available_gb?: number;
    };
    functions?: {
      count: number;
      deployed?: number;
      invocations?: number;
    };
    auth?: {
      users: number;
    };
  };
}

export interface SupabaseStats extends ServiceStats {
  projects: SupabaseProject[];
  totalProjects: number;
  lastUpdated?: string;
}

export interface SupabaseApiKey {
  name: string;
  api_key: string;
}

export interface SupabaseCredentials {
  anonKey?: string;
  supabaseUrl?: string;
}

export interface SupabaseMetadata extends Record<string, unknown> {
  credentials?: SupabaseCredentials;
}

export interface SupabaseConnectionStateNew extends SelectableResourceConnectionState<
  SupabaseUser,
  SupabaseStats,
  SupabaseProject,
  SupabaseMetadata
> {}

// Keep existing interface for backward compatibility during migration
export interface SupabaseConnectionState {
  user: SupabaseUser | null;
  token: string;
  stats?: SupabaseStats;
  selectedProjectId?: string;
  isConnected?: boolean;
  project?: SupabaseProject;
  credentials?: SupabaseCredentials;
}
