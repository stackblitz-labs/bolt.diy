/*
 * Maximum tokens for response generation (updated for modern model capabilities)
 * This serves as a fallback when model-specific limits are unavailable
 * Most models support 32k-128k context, using conservative default for compatibility
 */
export const MAX_TOKENS = 32000;

/*
 * Provider-specific default completion token limits
 * Used as fallbacks when model doesn't specify maxCompletionTokens
 */
export const PROVIDER_COMPLETION_LIMITS: Record<string, number> = {
  OpenAI: 4096, // Standard GPT models (o1 models have much higher limits)
  Github: 4096, // GitHub Models use OpenAI-compatible limits
  Anthropic: 64000, // Claude Sonnet 4 supports 64k completion tokens
  Google: 8192, // Gemini 1.5 Pro/Flash standard limit
  Cerebras: 8192, // Cerebras ultra-fast inference models (Llama, Qwen) with 128k context
  Cloudflare: 8192, // Cloudflare Workers AI models (varies by model, supports OpenAI GPT, Llama, Mistral)
  Cohere: 4000,
  DeepSeek: 8192, // Conservative default for V2.5 models, V3 models support 128k+ context
  Groq: 8192, // Uses API-provided completion limits (no artificial caps)
  HuggingFace: 4096,
  Mistral: 8192, // Updated with dynamic discovery, models support 32k-256k context
  Ollama: 8192, // Enhanced with intelligent model family detection
  OpenRouter: 8192,
  Perplexity: 8192, // Updated to support 127k context models
  Together: 8192, // Now uses API-provided context_length
  xAI: 16000, // Grok models support 16k-32k completion tokens
  LMStudio: 8192,
  OpenAILike: 8192,
  AmazonBedrock: 8192,
  Hyperbolic: 8192,
};

// Re-export isReasoningModel from shared utilities for backward compatibility
export { isReasoningModel } from '~/lib/common/model-utils';

// limits the number of model responses that can be returned in a single request
export const MAX_RESPONSE_SEGMENTS = 2;

export interface File {
  type: 'file';
  content: string;
  isBinary: boolean;
  isLocked?: boolean;
  lockedByFolder?: string;
}

export interface Folder {
  type: 'folder';
  isLocked?: boolean;
  lockedByFolder?: string;
}

type Dirent = File | Folder;

export type FileMap = Record<string, Dirent | undefined>;

export const IGNORE_PATTERNS = [
  'node_modules/**',
  '.git/**',
  'dist/**',
  'build/**',
  '.next/**',
  'coverage/**',
  '.cache/**',
  '.vscode/**',
  '.idea/**',
  '**/*.log',
  '**/.DS_Store',
  '**/npm-debug.log*',
  '**/yarn-debug.log*',
  '**/yarn-error.log*',
  '**/*lock.json',
  '**/*lock.yml',
];
