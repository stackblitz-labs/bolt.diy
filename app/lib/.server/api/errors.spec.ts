import { describe, expect, it } from 'vitest';
import {
  toApiErrorResponse,
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
});
