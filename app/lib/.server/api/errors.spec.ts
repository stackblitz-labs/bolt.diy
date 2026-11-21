import { APICallError, InvalidToolInputError, NoSuchToolError, ToolChoiceViolationError } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import {
  toApiErrorResponse,
  ApiError,
  isTokenLimitFailure,
  toMissingCredentialError,
  toSafeStreamErrorMessage,
  toSafeTextStream,
  toTokenLimitError,
} from './errors';

describe('toMissingCredentialError', () => {
  it('does not serialize provider diagnostics into the 401 response', async () => {
    const secretDiagnostic = 'https://provider.example/?api_key=secret-value';
    const response = toApiErrorResponse(toMissingCredentialError('Example', secretDiagnostic));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      message: 'Invalid or missing API key',
      statusCode: 401,
      isRetryable: false,
      provider: 'Example',
    });
    expect(JSON.stringify(body)).not.toContain(secretDiagnostic);
    expect(JSON.stringify(body)).not.toContain('secret-value');
  });
});

describe('toSafeStreamErrorMessage', () => {
  it('classifies wrapped errors without logging their messages, names or payloads', () => {
    using log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const cause = new APICallError({
      message: 'TLS certificate rejected: private-details',
      url: 'https://provider.example/',
      requestBodyValues: { prompt: 'private-prompt' },
      statusCode: 502,
    });

    const error = new Error('Wrapped provider failure: private-value', { cause });
    error.name = 'PrivateErrorName';

    toSafeStreamErrorMessage(error);

    const logs = log.mock.calls.flat().join(' ');
    expect(logs).toContain('type=Error');
    expect(logs).toContain('reason=tls, causeType=APICallError, causeStatus=502');
    expect(logs).not.toMatch(/private-|PrivateErrorName/);
  });

  it('explains when the output limit cuts off a required call before completion', () => {
    const error = new ToolChoiceViolationError({
      toolChoice: { type: 'required' },
      finishReason: 'length',
      provider: 'ollama.responses',
      modelId: 'example',
      content: [{ type: 'reasoning', text: 'private-reasoning' }],
    });

    const message = toSafeStreamErrorMessage(error);
    expect(message).toContain('reached its output limit before completing a required tool call');
    expect(message).not.toContain('private-reasoning');
  });

  it.each([
    ['{"newText":"private-source', 'For a full-file replacement, use project_write_file'],
    [
      JSON.stringify({
        path: 'src/App.tsx',
        startLine: 1,
        endLine: 2,
        expectedRevision: 'private-source',
        newText: '',
      }),
      'Copy the entire revision from the latest numbered read',
    ],
  ])('gives safe recovery advice for invalid numbered edits', (toolInput, hint) => {
    const error = new InvalidToolInputError({
      toolName: 'project_replace_lines',
      toolInput,
      cause: new Error('invalid'),
    });

    const message = toSafeStreamErrorMessage(error);
    expect(message).toContain(hint);
    expect(message).not.toContain('private-source');
  });

  it.each(['{}', '{"content":"unfinished-private-content'])(
    'gives recovery advice for missing or incomplete file write arguments',
    (toolInput) => {
      const error = new InvalidToolInputError({
        toolName: 'project_write_file',
        toolInput,
        cause: new Error('invalid'),
      });

      const hint = toSafeStreamErrorMessage(error);

      expect(hint).toContain('complete JSON object with path and content');
      expect(hint).toContain('smaller complete files');
      expect(hint).not.toContain('unfinished-private-content');
    },
  );

  it('explains tool validation failures without exposing raw arguments or provider details', () => {
    const invalid = new InvalidToolInputError({
      toolName: 'project_list_paths',
      toolInput: 'secret-value',
      cause: new Error('invalid schema'),
    });

    const missing = new NoSuchToolError({ toolName: 'secret-value' });

    expect(toSafeStreamErrorMessage(invalid)).toContain('invalid tool arguments');
    expect(toSafeStreamErrorMessage(missing)).toContain('unavailable tool');
    expect(toSafeStreamErrorMessage(invalid)).not.toContain('secret-value');
    expect(toSafeStreamErrorMessage(missing)).not.toContain('secret-value');
    expect(toSafeStreamErrorMessage(invalid.message)).toContain('invalid tool arguments');
    expect(toSafeStreamErrorMessage(missing.message)).toContain('unavailable tool');
    expect(toSafeStreamErrorMessage(missing.message)).not.toContain('secret-value');
  });

  it('recognizes a provider 429 even when its message does not mention the status', () => {
    const error = Object.assign(new Error('Provider returned error: secret-value'), { statusCode: 429 });

    expect(toSafeStreamErrorMessage(error)).toContain('API rate limit exceeded');
    expect(toSafeStreamErrorMessage(error)).not.toContain('secret-value');
  });

  it('recognizes capitalized rate-limit messages', () => {
    expect(toSafeStreamErrorMessage(new Error('Rate limit exceeded: free-models-per-day'))).toContain(
      'API rate limit exceeded',
    );
  });

  it('explains an upstream shared-pool 429 without echoing the provider payload', () => {
    const error = Object.assign(new Error('[Google AI Studio] model is temporarily rate-limited upstream'), {
      statusCode: 429,
      responseBody: JSON.stringify({
        error: {
          message: 'Provider returned error',
          code: 429,
          metadata: { limit_source: 'upstream_provider_shared_pool', user_id: 'secret-user' },
        },
      }),
    });

    const hint = toSafeStreamErrorMessage(error);

    expect(hint).toContain('upstream provider pool');
    expect(hint).toContain('provider key');
    expect(hint).not.toContain('secret-user');
    expect(hint).not.toContain('Provider returned error');
  });

  it('keeps the generic rate-limit hint for ordinary 429s', () => {
    const error = Object.assign(new Error('Too many requests'), { statusCode: 429 });

    expect(toSafeStreamErrorMessage(error)).toContain('API rate limit exceeded');
  });

  it('returns a generic message instead of an unknown provider diagnostic', () => {
    const diagnostic = 'Request https://provider.example/?api_key=secret-value failed';
    const responseMessage = toSafeStreamErrorMessage(new Error(diagnostic));

    expect(responseMessage).toBe(
      'Custom error: The AI provider request failed. Check your provider settings and try again.',
    );
    expect(responseMessage).not.toContain(diagnostic);
    expect(responseMessage).not.toContain('secret-value');
  });

  it('retains safe credential guidance without echoing provider details', () => {
    const responseMessage = toSafeStreamErrorMessage(
      new Error('Invalid API key https://provider.example/?api_key=secret-value'),
    );

    expect(responseMessage).toContain('Invalid or missing API key');
    expect(responseMessage).not.toContain('provider.example');
    expect(responseMessage).not.toContain('secret-value');
  });

  it('identifies SDK chunk timeouts as an unfinished provider step, preserving safe recovery guidance', () => {
    const hint = toSafeStreamErrorMessage(new DOMException('Chunk timeout of 45000ms exceeded', 'TimeoutError'));
    expect(hint).toContain('provider stopped responding');
    expect(hint).toContain('tool results are preserved');
    expect(hint).not.toContain('internet connection');
  });
});

describe('toSafeTextStream', () => {
  it('replaces a post-response provider stream error with generic text', async () => {
    const diagnostic = 'https://provider.example/?api_key=secret-value';

    let pulls = 0;

    const upstream = new ReadableStream<string>({
      pull(controller) {
        if (pulls++ === 0) {
          controller.enqueue('partial response');
        } else {
          controller.error(new Error(diagnostic));
        }
      },
    });

    // Construct the HTTP response before consuming the stream, matching the route's timing.
    const response = new Response(toSafeTextStream(upstream), {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });

    const body = await response.text();

    expect(body).toContain('partial response');
    expect(body).toContain('The AI provider request failed');
    expect(body).not.toContain(diagnostic);
    expect(body).not.toContain('secret-value');
  });
});

describe('toTokenLimitError', () => {
  it('returns a fixed client message without provider diagnostics', async () => {
    const response = toApiErrorResponse(toTokenLimitError('Example'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      message: 'Token limit exceeded. Try reducing your request size or using a model with higher token limits.',
      statusCode: 400,
      provider: 'Example',
    });
    expect(JSON.stringify(body)).not.toContain('https://provider.example');
  });

  it('recognizes provider token diagnostics but leaves typed failures alone', () => {
    expect(isTokenLimitFailure(new Error('max_tokens exceeded at https://provider.example?key=secret'))).toBe(true);
    expect(isTokenLimitFailure(new Error('max_tokens exceeded'))).toBe(true);
    expect(isTokenLimitFailure(new Error('maximum context length is 4097 tokens'))).toBe(true);
    expect(isTokenLimitFailure(new Error('Access token expired'))).toBe(false);
    expect(isTokenLimitFailure(new Error('Invalid API token'))).toBe(false);
    expect(isTokenLimitFailure(new ApiError('Typed token failure', { status: 400, code: 'token_limit' }))).toBe(false);
  });
});
