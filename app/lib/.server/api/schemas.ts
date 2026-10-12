import { z } from 'zod';
import { ValidationError } from './errors';
import type { FileMap } from '~/lib/.server/llm/constants';
import type { Messages } from '~/lib/.server/llm/stream-text';
import type { DesignScheme } from '~/types/design-scheme';
import type { ProviderInfo } from '~/types/model';

/**
 * Request limits for the model routes.
 *
 * These bound *work*, not just memory. `maxLLMSteps` in particular multiplies
 * provider calls: `stopWhen: isStepCount(maxLLMSteps)` allows that many full
 * model round-trips per HTTP request, so an unbounded client-supplied value is a
 * direct spend multiplier. Everything here is a ceiling on what a single request
 * can cost.
 */
export const REQUEST_LIMITS = {
  /** Whole-body ceiling. Generous because `files` carries project contents. */
  MAX_CHAT_BODY_BYTES: 16 * 1024 * 1024,

  /** Inline data URLs may use most of the chat body budget; JSON overhead still counts. */
  MAX_ATTACHMENT_URL_CHARS: 16 * 1024 * 1024,
  MAX_LLMCALL_BODY_BYTES: 1 * 1024 * 1024,
  MAX_MESSAGES: 500,
  MAX_PARTS_PER_MESSAGE: 1000,

  /** Per text part. A large pasted file still fits; a runaway does not. */
  MAX_TEXT_PART_CHARS: 1_000_000,
  MAX_ATTACHMENTS_PER_MESSAGE: 20,
  MAX_URL_CHARS: 8192,
  MAX_ID_CHARS: 256,
  MAX_PROMPT_ID_CHARS: 128,
  MAX_PATH_CHARS: 1024,
  MAX_FILES: 5000,
  MAX_FILE_CONTENT_CHARS: 4 * 1024 * 1024,

  /**
   * Provider round-trips allowed per request. The settings UI defaults to 5;
   * this ceiling is well above any sane configuration while still stopping a
   * crafted request from asking for thousands.
   */
  MAX_LLM_STEPS: 50,
  MAX_SUPABASE_URL_CHARS: 2048,
  MAX_ANON_KEY_CHARS: 512,
} as const;

/**
 * A single UI message part.
 *
 * Intentionally loose: the SDK adds part types between versions, and a strict
 * union here would reject valid conversations the moment it does that. The
 * fields that actually matter for cost and safety — the text length and the
 * attachment count — are bounded by the refinements below.
 */
const uiMessagePartSchema = z
  .looseObject({
    type: z.string().max(128),
    text: z.string().max(REQUEST_LIMITS.MAX_TEXT_PART_CHARS).optional(),
    url: z.string().optional(),
    mediaType: z.string().max(255).optional(),
    filename: z.string().max(REQUEST_LIMITS.MAX_PATH_CHARS).optional(),
    mimeType: z.string().max(255).optional(),
  })
  .refine((part) => part.type !== 'file' || typeof part.url === 'string', { message: 'file parts must carry a url' })
  .refine(
    (part) =>
      part.url === undefined ||
      part.url.length <=
        (part.url.startsWith('data:') ? REQUEST_LIMITS.MAX_ATTACHMENT_URL_CHARS : REQUEST_LIMITS.MAX_URL_CHARS),
    { message: 'url is too long' },
  );

/**
 * A UIMessage.
 *
 * `content` is accepted alongside `parts` because persisted v4 messages still
 * carry it, and `migrateLegacyMessages` / `getMessageText` read it as a
 * fallback. Rejecting it would break resuming an older conversation.
 */
const uiMessageSchema = z
  .looseObject({
    id: z.string().max(REQUEST_LIMITS.MAX_ID_CHARS).optional(),
    role: z.enum(['system', 'user', 'assistant']),
    parts: z.array(uiMessagePartSchema).max(REQUEST_LIMITS.MAX_PARTS_PER_MESSAGE).optional(),
    content: z.union([z.string(), z.array(z.unknown())]).optional(),
    experimental_attachments: z.array(z.unknown()).max(REQUEST_LIMITS.MAX_ATTACHMENTS_PER_MESSAGE).optional(),
  })
  .refine(
    (message) =>
      (message.parts?.filter((part) => part.type === 'file').length ?? 0) +
        (message.experimental_attachments?.length ?? 0) <=
      REQUEST_LIMITS.MAX_ATTACHMENTS_PER_MESSAGE,
    { message: `at most ${REQUEST_LIMITS.MAX_ATTACHMENTS_PER_MESSAGE} attachments per message` },
  )
  .refine((message) => Array.isArray(message.parts) || message.content !== undefined, {
    message: 'message must include parts or legacy content',
  });

const fileEntrySchema = z
  .looseObject({
    type: z.enum(['file', 'folder']),
    content: z.string().max(REQUEST_LIMITS.MAX_FILE_CONTENT_CHARS).optional(),
    isBinary: z.boolean().optional(),
    isLocked: z.boolean().optional(),
    lockedByFolder: z.string().max(REQUEST_LIMITS.MAX_PATH_CHARS).optional(),
  })
  .refine((entry) => entry.type !== 'file' || typeof entry.content === 'string', {
    message: 'file entries must carry content',
  });

const fileMapSchema = z
  .record(z.string().max(REQUEST_LIMITS.MAX_PATH_CHARS), fileEntrySchema)
  .refine((files) => Object.keys(files).length <= REQUEST_LIMITS.MAX_FILES, {
    message: `at most ${REQUEST_LIMITS.MAX_FILES} files`,
  });

const designSchemeSchema = z.looseObject({
  palette: z.record(z.string().max(64), z.string().max(64)),
  features: z.array(z.string().max(64)).max(64),
  font: z.array(z.string().max(64)).max(64),
});

const providerSchema = z.looseObject({
  name: z.string().min(1).max(128),
});

const supabaseSchema = z.looseObject({
  isConnected: z.boolean(),
  hasSelectedProject: z.boolean(),
  credentials: z
    .looseObject({
      anonKey: z.string().max(REQUEST_LIMITS.MAX_ANON_KEY_CHARS).optional(),
      supabaseUrl: z.string().max(REQUEST_LIMITS.MAX_SUPABASE_URL_CHARS).optional(),
    })
    .optional(),
});

/*
 * Body of POST /api/chat.
 *
 * Matches what Chat.client.tsx sends (see the `bodyRef` there): messages plus
 * files, promptId, contextOptimization, chatMode, designScheme, supabase and
 * maxLLMSteps.
 *
 * The client still includes `apiKeys` in that body, but the server reads
 * credentials from the cookie and must never take them from the request, where
 * they would land in any log that touches the body. The transform below drops
 * them at the boundary so nothing downstream can pick them up by accident —
 * including a future `logger.debug(body)`.
 */
export const chatRequestSchema = z
  .looseObject({
    messages: z.array(uiMessageSchema).min(1, 'at least one message is required').max(REQUEST_LIMITS.MAX_MESSAGES),
    files: fileMapSchema.optional(),
    promptId: z.string().max(REQUEST_LIMITS.MAX_PROMPT_ID_CHARS).optional(),
    contextOptimization: z.boolean().optional(),
    chatMode: z.enum(['discuss', 'build']).optional(),
    designScheme: designSchemeSchema.optional(),
    supabase: supabaseSchema.optional(),
    maxLLMSteps: z.number().int().min(1).max(REQUEST_LIMITS.MAX_LLM_STEPS).optional(),
    webSearchEnabled: z.boolean().optional(),
    connectorEnabled: z
      .object({
        github: z.boolean().optional(),
        gitlab: z.boolean().optional(),
        vercel: z.boolean().optional(),
        netlify: z.boolean().optional(),
        supabase: z.boolean().optional(),
        browserUseCloud: z.boolean().optional(),
      })
      .optional(),
    toolEnabled: z.record(z.string().max(256), z.boolean()).optional(),
    plugins: z
      .array(
        z.object({
          id: z.string().regex(/^[a-z0-9-]{1,49}\.[a-z0-9-]{1,49}$/),
          adapter: z.literal('text-utils'),
          tools: z
            .array(z.enum(['count', 'transform']))
            .min(1)
            .max(2),
        }),
      )
      .max(20)
      .optional(),
  })
  .transform(({ apiKeys: _discarded, ...rest }) => rest);

export type ChatRequest = z.infer<typeof chatRequestSchema>;

/** Body of POST /api/llmcall, in both its streaming and non-streaming modes. */
export const llmCallRequestSchema = z.looseObject({
  system: z.string().max(REQUEST_LIMITS.MAX_TEXT_PART_CHARS).optional(),
  message: z.string().max(REQUEST_LIMITS.MAX_TEXT_PART_CHARS),
  model: z.string().min(1).max(256),
  provider: providerSchema,
  streamOutput: z.boolean().optional(),
});

export type LlmCallRequest = z.infer<typeof llmCallRequestSchema>;

/** Body of POST /api/enhancer. */
export const enhancerRequestSchema = z.looseObject({
  message: z.string().min(1).max(REQUEST_LIMITS.MAX_TEXT_PART_CHARS),
  model: z.string().min(1).max(256),
  provider: providerSchema,
});

export type EnhancerRequest = z.infer<typeof enhancerRequestSchema>;

/**
 * Parses `body` against `schema`, converting a Zod failure into a ValidationError.
 *
 * Reports the first few issue paths only. A single malformed field can produce
 * dozens of issues once it is nested inside an array, and a 400 whose body is
 * 4 KB of Zod paths is not something a user can act on.
 */
export function parseBody<S extends z.ZodType>(schema: S, body: unknown, label: string): z.output<S> {
  const result = schema.safeParse(body);

  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`);

    throw new ValidationError(`Invalid ${label} request.`, issues);
  }

  return result.data;
}

/**
 * Narrows validated messages back to the SDK type.
 *
 * The schema proves the shape is bounded and well-formed; this cast is where
 * that proof is converted back into the SDK's own type. Kept as a named
 * function so there is exactly one place where a validated body becomes a typed
 * one, rather than a cast at every use site.
 */
export function asMessages(validated: ChatRequest['messages']): Messages {
  return validated as unknown as Messages;
}

export function asFileMap(validated: ChatRequest['files']): FileMap | undefined {
  return validated as unknown as FileMap | undefined;
}

export function asDesignScheme(validated: ChatRequest['designScheme']): DesignScheme | undefined {
  return validated as DesignScheme | undefined;
}

export function asProviderInfo(validated: LlmCallRequest['provider'] | EnhancerRequest['provider']): ProviderInfo {
  return validated as unknown as ProviderInfo;
}

/**
 * True when a message looks like a persisted v4 message rather than a current one.
 *
 * Kept as a named predicate because the migration module is the thing that
 * actually understands the two shapes, and a route guessing at this would drift
 * from it.
 */
export function isLegacyMessage(message: { parts?: unknown; content?: unknown }): boolean {
  return !Array.isArray(message.parts) && message.content !== undefined;
}
