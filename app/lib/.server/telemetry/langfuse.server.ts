import { Langfuse } from 'langfuse';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('langfuse');

// Types
export interface LangfuseTraceContext {
  traceId: string;
  userId?: string;
  sessionId?: string;
  parentObservationId?: string;
}

export interface GenerationMetadata {
  model: string;
  provider: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  latencyMs?: number;
  input?: { systemPrompt?: string; messages?: Array<{ role: string; content: string }> };
  output?: string;
  finishReason?: string;
}

// Singleton client
let langfuseInstance: Langfuse | null = null;

/**
 * Get or create Langfuse client singleton.
 * Returns null if Langfuse is disabled or credentials are missing.
 */
export function getLangfuseClient(env?: Env): Langfuse | null {
  if (env?.LANGFUSE_ENABLED !== 'true') {
    return null;
  }

  if (!env?.LANGFUSE_PUBLIC_KEY || !env?.LANGFUSE_SECRET_KEY) {
    logger.warn('Langfuse enabled but credentials missing');
    return null;
  }

  if (langfuseInstance) {
    return langfuseInstance;
  }

  try {
    langfuseInstance = new Langfuse({
      publicKey: env.LANGFUSE_PUBLIC_KEY,
      secretKey: env.LANGFUSE_SECRET_KEY,
      baseUrl: env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com',
      flushAt: 1,
      flushInterval: 0,
    });
    return langfuseInstance;
  } catch (error) {
    logger.error('Failed to initialize Langfuse:', error);
    return null;
  }
}

/**
 * Check if Langfuse is enabled and properly configured.
 */
export function isLangfuseEnabled(env?: Env): boolean {
  return env?.LANGFUSE_ENABLED === 'true' && !!env?.LANGFUSE_PUBLIC_KEY && !!env?.LANGFUSE_SECRET_KEY;
}

/**
 * Create a new trace for a request.
 * Returns null if Langfuse is not configured.
 */
export function createTrace(
  env: Env | undefined,
  options: {
    name: string;
    userId?: string;
    sessionId?: string;
    metadata?: Record<string, unknown>;
    input?: unknown;
  },
): LangfuseTraceContext | null {
  const client = getLangfuseClient(env);

  if (!client) {
    return null;
  }

  try {
    const trace = client.trace({
      name: options.name,
      userId: options.userId,
      sessionId: options.sessionId,
      metadata: options.metadata,
      input: options.input,
    });
    return { traceId: trace.id, userId: options.userId, sessionId: options.sessionId };
  } catch (error) {
    logger.error('Failed to create trace:', error);
    return null;
  }
}

/**
 * Create a generation span within a trace.
 * Returns an object with end() callback to finalize the generation.
 */
export function createGeneration(
  env: Env | undefined,
  traceContext: LangfuseTraceContext,
  options: {
    name: string;
    model: string;
    modelParameters?: Record<string, unknown>;
    input?: unknown;
    startTime?: Date;
  },
): { generationId: string; end: (metadata: Partial<GenerationMetadata>) => void } | null {
  const client = getLangfuseClient(env);

  if (!client) {
    return null;
  }

  try {
    const startTime = options.startTime || new Date();
    const generation = client.generation({
      traceId: traceContext.traceId,
      parentObservationId: traceContext.parentObservationId,
      name: options.name,
      model: options.model,
      modelParameters: options.modelParameters as
        | { [key: string]: string | number | boolean | string[] | null }
        | null
        | undefined,
      input: options.input,
      startTime,
    });

    return {
      generationId: generation.id,
      end: (metadata: Partial<GenerationMetadata>) => {
        try {
          generation.end({
            output: metadata.output,
            usage: {
              promptTokens: metadata.promptTokens,
              completionTokens: metadata.completionTokens,
              totalTokens: metadata.totalTokens,
            },
            metadata: { provider: metadata.provider || '', finishReason: metadata.finishReason || '' },
          });
        } catch (error) {
          logger.error('Failed to end generation:', error);
        }
      },
    };
  } catch (error) {
    logger.error('Failed to create generation:', error);
    return null;
  }
}

/**
 * Flush all pending traces to Langfuse.
 * Call this with ctx.waitUntil() before returning response on Cloudflare edge.
 */
export async function flushTraces(env?: Env): Promise<void> {
  const client = getLangfuseClient(env);

  if (!client) {
    return;
  }

  try {
    await client.flushAsync();
    logger.debug('Traces flushed successfully');
  } catch (error) {
    logger.error('Failed to flush traces:', error);
  }
}
