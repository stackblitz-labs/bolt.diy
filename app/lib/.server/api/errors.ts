import { InvalidToolInputError, NoSuchToolError, ToolChoiceViolationError } from 'ai';
import {
  getProjectPatchInputHint,
  getProjectReplaceLinesInputHint,
  getProjectWriteInputHint,
} from '~/lib/.server/llm/project-tool-input';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('api.errors');

/**
 * Error shape returned by the chat/llmcall routes.
 *
 * This is a wire contract, not an internal detail: Chat.client.tsx parses the
 * failure body and reads `statusCode`, `isRetryable`, `provider` and `message`
 * to pick the alert type (authentication / rate_limit / quota / network). Adding
 * a field is safe; renaming or removing one silently degrades every error alert
 * in the UI to "Request Failed".
 */
export interface ApiErrorBody {
  error: true;
  message: string;
  statusCode: number;
  isRetryable: boolean;
  provider: string;
}

/**
 * A failure with a deliberate HTTP status, so the wrapper does not have to guess.
 *
 * Anything thrown that is *not* an ApiError becomes a 500. That is why a plain
 * `throw new Error('bad input')` in a route used to surface as an opaque server
 * error: there was no way to say "this one is the client's fault".
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly isRetryable: boolean;
  readonly provider?: string;

  constructor(
    message: string,
    options: { status?: number; code?: string; isRetryable?: boolean; provider?: string; cause?: unknown } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });

    this.name = 'ApiError';
    this.status = options.status ?? 500;
    this.code = options.code ?? 'internal_error';
    this.isRetryable = options.isRetryable ?? this.status >= 500;
    this.provider = options.provider;
  }

  /**
   * The wire body for this failure.
   *
   * A getter rather than a plain field because subclasses (PayloadTooLargeError,
   * ValidationError, …) override `name`, so anything identifying this error by
   * its `name` must not be matching on it. See `isTypedApiError` in security.ts.
   */
  get body(): ApiErrorBody {
    return {
      error: true,
      message: this.message,
      statusCode: this.status,
      isRetryable: this.isRetryable,
      provider: this.provider ?? 'unknown',
    };
  }
}

/** The request body could not be parsed, or failed schema validation. */
export class ValidationError extends ApiError {
  readonly issues: string[];

  constructor(message: string, issues: string[] = []) {
    super(message, { status: 400, code: 'invalid_request', isRetryable: false });
    this.name = 'ValidationError';
    this.issues = issues;
  }
}

/** The body exceeded the route's byte budget. */
export class PayloadTooLargeError extends ApiError {
  constructor(limitBytes: number) {
    super(`Request body is too large. The limit is ${formatBytes(limitBytes)}.`, {
      status: 413,
      code: 'payload_too_large',
      isRetryable: false,
    });
    this.name = 'PayloadTooLargeError';
  }
}

/** The client stopped sending before the body was complete. */
export class RequestTimeoutError extends ApiError {
  constructor(timeoutMs: number) {
    super(`Request body timed out after ${Math.round(timeoutMs / 1000)}s.`, {
      status: 408,
      code: 'request_timeout',
      isRetryable: true,
    });
    this.name = 'RequestTimeoutError';
  }
}

/** The client disconnected mid-body. Not an error worth a stack trace. */
export class RequestAbortedError extends ApiError {
  constructor() {
    super('Request cancelled.', { status: 499, code: 'client_closed_request', isRetryable: false });
    this.name = 'RequestAbortedError';
  }
}

/**
 * Credentials problems, normalised across providers.
 *
 * Every provider phrases this differently ("Incorrect API key", "invalid x-api-key",
 * 401, 403), so the routes matched on substrings of the provider's message. Keep
 * provider diagnostics out of the client response because they can contain
 * request URLs or credential data.
 */
export function toMissingCredentialError(provider: string, providerMessage?: string): ApiError {
  if (providerMessage) {
    logger.warn('Provider credential error');
  }

  return new ApiError('Invalid or missing API key', {
    status: 401,
    code: 'missing_api_key',
    isRetryable: false,
    provider,
  });
}

const streamErrorReasons: Array<[RegExp, string]> = [
  [/unsupported|unrecognized|unknown (?:tool|model)|not supported/, 'unsupported'],
  [/parameter|schema|validation|invalid request/, 'invalid-parameters'],
  [/tool.call|tool choice|tool input|tool execution|required tool/, 'tool-call'],
  [/timeout|timed out|abort/, 'timeout-or-abort'],
  [/unauthorized|api key|authentication/, 'authentication'],
  [/rate.limit|too many requests/, 'rate-limit'],
  [/certificate|tls|ssl/, 'tls'],
  [/fetch failed|network|connection|socket/, 'network'],
];

function getStreamErrorReason(message: string) {
  return streamErrorReasons.find(([pattern]) => pattern.test(message))?.[1];
}

function getStreamErrorStatus(error: unknown) {
  if (error && typeof error === 'object' && 'statusCode' in error) {
    const { statusCode } = error;

    if (typeof statusCode === 'number' && Number.isInteger(statusCode)) {
      return statusCode;
    }
  }

  return undefined;
}

function getStreamErrorType(error: unknown, fallback: string) {
  if (!(error instanceof Error)) {
    return fallback;
  }

  const className = error.constructor?.name;

  return className && /^[a-zA-Z][a-zA-Z0-9_]{0,60}$/.test(className) ? className : fallback;
}

/** Converts a streaming provider error to a client-safe hint without forwarding diagnostics. */
export function toSafeStreamErrorMessage(error: unknown): string {
  if (InvalidToolInputError.isInstance(error) && error.toolName === 'agent_plan') {
    logger.warn('Invalid build plan arguments');

    return 'Invalid build plan arguments. Include a goal, steps, requiresPreview, and criteria with a unique id and a description for each criterion.';
  }

  if (InvalidToolInputError.isInstance(error) && error.toolName === 'project_write_file') {
    const hint = getProjectWriteInputHint(error.toolInput);
    logger.warn(`Invalid project file write arguments. ${hint}`);

    return `Invalid file write arguments. ${hint}`;
  }

  if (InvalidToolInputError.isInstance(error) && error.toolName === 'project_patch_file') {
    const hint = getProjectPatchInputHint(error.toolInput);
    logger.warn(`Invalid project patch arguments. ${hint}`);

    return `Invalid patch arguments. ${hint}`;
  }

  if (InvalidToolInputError.isInstance(error) && error.toolName === 'project_replace_lines') {
    const hint = getProjectReplaceLinesInputHint(error.toolInput);
    logger.warn(`Invalid numbered edit arguments. ${hint}`);

    return `Invalid numbered edit arguments. ${hint}`;
  }

  const providerMessage = error instanceof Error ? error.message : String(error);
  const normalizedMessage = providerMessage.toLowerCase();

  const statusCode = getStreamErrorStatus(error);

  const retryable =
    error && typeof error === 'object' && 'isRetryable' in error && typeof error.isRetryable === 'boolean'
      ? error.isRetryable
      : 'unknown';

  const cause = error instanceof Error ? error.cause : undefined;

  const reason =
    getStreamErrorReason(normalizedMessage) ??
    (cause instanceof Error ? getStreamErrorReason(cause.message.toLowerCase()) : undefined) ??
    'unclassified';

  // Keep provider messages, tool arguments and request/response details out of logs.
  logger.error(
    `Streaming provider error (type=${getStreamErrorType(error, 'UnknownError')}, status=${statusCode ?? 'unknown'}, retryable=${retryable}, reason=${reason}, causeType=${getStreamErrorType(cause, 'none')}, causeStatus=${getStreamErrorStatus(cause) ?? 'unknown'})`,
  );

  if ((error instanceof Error && error.name === 'TimeoutError') || /timeout|timed\s*out/.test(normalizedMessage)) {
    return 'Custom error: The AI provider stopped responding before the next step completed. Completed file changes and tool results are preserved. Retry to continue, or select a different model.';
  }

  if (ToolChoiceViolationError.isInstance(error)) {
    if (error.finishReason === 'length') {
      return 'Custom error: The model reached its output limit before completing a required tool call. Retry with a smaller edit or select a model with a larger output budget.';
    }

    return 'Custom error: The selected model returned text instead of the required tool call, so the build could not continue. Retry or select a model that reliably supports tool calling.';
  }

  if (InvalidToolInputError.isInstance(error) || normalizedMessage.startsWith('invalid input for tool ')) {
    return 'Custom error: The model supplied invalid tool arguments. Retry the tool call using its declared input schema.';
  }

  if (NoSuchToolError.isInstance(error) || normalizedMessage.startsWith('model tried to call unavailable tool ')) {
    return 'Custom error: The model requested an unavailable tool. Use one of the supplied tools instead.';
  }

  if (providerMessage.includes('model') && providerMessage.includes('not found')) {
    return 'Custom error: Invalid model selected. Please check that the model name is correct and available.';
  }

  if (normalizedMessage.includes('prompt not found') || normalizedMessage.includes('prompt now found')) {
    return 'Custom error: The selected prompt template could not be loaded. Check Settings → Features → Prompt Library, then retry.';
  }

  if (providerMessage.includes('Invalid JSON response')) {
    return 'Custom error: The AI service returned an invalid response. This may be due to an invalid model name, API rate limiting, or server issues. Try selecting a different model or check your API key.';
  }

  if (
    providerMessage.includes('API key') ||
    providerMessage.includes('unauthorized') ||
    providerMessage.includes('authentication')
  ) {
    return 'Custom error: Invalid or missing API key. Please check your API key configuration.';
  }

  if (providerMessage.includes('token') && providerMessage.includes('limit')) {
    return 'Custom error: Token limit exceeded. The conversation is too long for the selected model. Try using a model with larger context window or start a new conversation.';
  }

  if (statusCode === 429 || normalizedMessage.includes('rate limit') || providerMessage.includes('429')) {
    if (isUpstreamSharedPoolRateLimit(error)) {
      return 'Custom error: The selected free model is rate-limited by its upstream provider pool. Retry shortly, add your own OpenRouter provider key to use your own limits, or choose another model.';
    }

    return 'Custom error: API rate limit exceeded, or the provider rejected the request for account reasons. Check your provider account and try again.';
  }

  if (providerMessage.includes('network') || providerMessage.includes('timeout')) {
    return 'Custom error: Network error. Please check your internet connection and try again.';
  }

  return 'Custom error: The AI provider request failed. Check your provider settings and try again.';
}

/** Wraps a plain-text provider stream so late failures become a safe text chunk. */
export function toSafeTextStream(stream: ReadableStream<string>): ReadableStream<Uint8Array> {
  const reader = stream.getReader();
  const encoder = new TextEncoder();

  let failed = false;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (failed) {
        controller.close();
        return;
      }

      try {
        const { done, value } = await reader.read();

        if (done) {
          reader.releaseLock();
          controller.close();

          return;
        }

        controller.enqueue(encoder.encode(value));
      } catch {
        failed = true;
        logger.error('Streaming provider error');
        reader.releaseLock();
        controller.enqueue(
          encoder.encode('Custom error: The AI provider request failed. Check your provider settings and try again.'),
        );
        controller.close();
      }
    },
    async cancel(reason) {
      await reader.cancel(reason);
    },
  });
}

/** Returns a fixed client-safe token-limit response. */
export function toTokenLimitError(provider: string): ApiError {
  return new ApiError(
    'Token limit exceeded. Try reducing your request size or using a model with higher token limits.',
    {
      status: 400,
      code: 'token_limit_exceeded',
      isRetryable: false,
      provider,
    },
  );
}

/** Identifies provider token-limit diagnostics without forwarding their text. */
export function isTokenLimitFailure(error: unknown): error is Error {
  if (!(error instanceof Error) || isTypedFailure(error)) {
    return false;
  }

  const message = error.message.toLowerCase();

  return (
    /\bmax[_ -]?tokens?\b/.test(message) ||
    /\btoken\s+limit\s+(?:exceeded|exceeds|reached)\b/.test(message) ||
    /\b(?:maximum|max)\s+context\s+length\b/.test(message) ||
    /\bcontext\s+length\b.{0,40}\b(?:exceed(?:ed|s)?|maximum|limit)\b/.test(message) ||
    /\btoo\s+many\s+tokens\b/.test(message) ||
    /\brequested\s+tokens\b.{0,40}\b(?:exceed(?:ed|s)?|maximum|limit)\b/.test(message)
  );
}

function isTypedFailure(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && 'status' in error;
}

/**
 * True when OpenRouter reports a 429 caused by a free model's shared upstream
 * pool rather than by the user's own quota. The payload is inspected only to
 * choose a better hint; none of it is forwarded to the client.
 */
function isUpstreamSharedPoolRateLimit(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('responseBody' in error)) {
    return false;
  }

  const { responseBody } = error as { responseBody?: unknown };

  if (typeof responseBody !== 'string') {
    return false;
  }

  try {
    const parsed = JSON.parse(responseBody);
    return parsed?.error?.metadata?.limit_source === 'upstream_provider_shared_pool';
  } catch {
    return false;
  }
}

/**
 * Builds the failure response for a caught error.
 *
 * Deliberately does not echo the raw error message for unexpected errors: a
 * thrown Error from deep inside the provider SDK can contain the request URL,
 * which for several providers embeds the key in a query string. Known ApiErrors
 * carry their own vetted message; anything else becomes a generic string.
 */
export function toApiErrorResponse(error: unknown, fallbackProvider = 'unknown'): Response {
  if (error instanceof ApiError) {
    return Response.json(
      {
        error: true,
        message: error.message,
        statusCode: error.status,
        isRetryable: error.isRetryable,
        provider: error.provider ?? fallbackProvider,
      } satisfies ApiErrorBody,
      { status: error.status, headers: { 'Content-Type': 'application/json' } },
    );
  }

  /*
   * Aborts surface as a generic 500 everywhere else, which makes a user pressing
   * "stop" look like a server fault. 499 is the conventional client-closed code
   * and is not retryable.
   */
  if (isAbortError(error)) {
    return Response.json(
      {
        error: true,
        message: 'Request cancelled.',
        statusCode: 499,
        isRetryable: false,
        provider: fallbackProvider,
      } satisfies ApiErrorBody,
      { status: 499, headers: { 'Content-Type': 'application/json' } },
    );
  }

  logger.error('Unhandled route error');

  return Response.json(
    {
      error: true,
      message: 'An unexpected error occurred',
      statusCode: 500,
      isRetryable: true,
      provider: fallbackProvider,
    } satisfies ApiErrorBody,
    { status: 500, headers: { 'Content-Type': 'application/json' } },
  );
}

export function isAbortError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.code === 'client_closed_request';
  }

  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${Math.round(bytes / (1024 * 1024))} MB`;
  }

  return `${Math.round(bytes / 1024)} KB`;
}
