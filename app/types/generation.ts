import type { RestaurantThemeId } from '~/types/restaurant-theme';

export type GenerationPhase = 'template_selection' | 'content_generation' | 'file_injection' | 'snapshot_save';

export type GenerationStatus = 'pending' | 'in_progress' | 'completed' | 'error';

export interface GenerationProgress {
  phase: GenerationPhase;
  status: GenerationStatus;
  message: string;
  percentage: number;
  startedAt: number;
  templateName?: string;
  error?: string;
}

export interface GenerationRequest {
  projectId: string;
}

export interface GeneratedFile {
  path: string;
  content: string;
  size: number;
}

export type GenerationErrorCode =
  | 'PROJECT_NOT_FOUND'
  | 'NO_BUSINESS_PROFILE'
  | 'TEMPLATE_SELECTION_FAILED'
  | 'GENERATION_FAILED'
  | 'SNAPSHOT_SAVE_FAILED'
  | 'INTERNAL_ERROR';

export interface GenerationResult {
  success: boolean;
  projectId: string;
  template: {
    name: string;
    themeId: RestaurantThemeId;
    title: string;
    reasoning?: string;
  };
  files: GeneratedFile[];
  snapshot?: {
    savedAt: string;
    fileCount: number;
    sizeMB: number;
  } | null;
  timing?: {
    phase1Ms: number;
    phase2Ms: number;
    totalMs: number;
  };
  error?: string;
}

export type GenerationSSEEvent =
  | { event: 'progress'; data: GenerationProgress }
  | { event: 'template_selected'; data: { name: string; themeId: RestaurantThemeId; reasoning: string } }
  | { event: 'file'; data: GeneratedFile }
  | { event: 'complete'; data: GenerationResult }
  | { event: 'error'; data: { message: string; code: GenerationErrorCode; retryable: boolean } }
  | { event: 'heartbeat'; data: { timestamp: number } };

export interface FastModelConfig {
  [providerName: string]: {
    model: string;
    contextWindow: number;
    costPer1MTokens: number;
  };
}
