import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getOpenAILikeModel } from './base-provider';
import GitHubProvider from './providers/github';
import GroqProvider from './providers/groq';
import OpenAIProvider from './providers/openai';
import PerplexityProvider from './providers/perplexity';
import XAIProvider from './providers/xai';

/*
 * Characterization tests for the provider wire format, written against the
 * currently installed AI SDK v4 so that upgrading to v7 turns a silent behavior
 * change into a failing test.
 *
 * The specific hazard: in @ai-sdk/openai v4 the callable form
 *
 *     openai(model)
 *
 * talks to POST {baseURL}/chat/completions. In v4 of the package the callable
 * is retargeted to the Responses API and the Chat Completions route only
 * remains reachable as openai.chat(model). The callable is not marked
 * deprecated, so both forms type check and nothing warns. This repo has 11
 * createOpenAI call sites, so a silent retarget would move every
 * OpenAI-compatible provider onto a different API with no compile error, no
 * runtime error, and no failing test unless one of these exists.
 *
 * These assert the CURRENT v4 behavior on purpose. When the SDK is upgraded
 * they are expected to fail, and that failure is the signal to switch the call
 * sites to .chat(model) deliberately rather than by accident.
 */

type FetchCall = { url: string; init?: RequestInit };

const calls: FetchCall[] = [];

let originalFetch: typeof globalThis.fetch;

/**
 * Records the outgoing request and returns a well-formed but trivial stream so
 * the SDK's parsing does not throw before we can assert. Only the URL matters.
 */
function recordingFetch(): typeof globalThis.fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

    calls.push({ url, init });

    const sse = [
      'data: {"id":"1","object":"chat.completion.chunk","created":1,"model":"test","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}',
      'data: {"id":"1","object":"chat.completion.chunk","created":1,"model":"test","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}}',
      'data: [DONE]',
      '',
    ].join('\n\n');

    return new Response(sse, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }) as unknown as typeof globalThis.fetch;
}

function lastUrl(): string {
  return calls[calls.length - 1]?.url ?? '';
}

beforeEach(() => {
  calls.length = 0;
  originalFetch = globalThis.fetch;
  globalThis.fetch = recordingFetch();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

/**
 * Drive doStream far enough to trigger the HTTP call. Failures after the
 * request is made are irrelevant here, which is why the promise is not awaited
 * strictly.
 */
async function requestUrl(model: any): Promise<string> {
  const prompt = [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }];

  try {
    /*
     * `mode` exists only on the v1 call options; v4's LanguageModelV4CallOptions
     * takes only `prompt`. Passing it unconditionally makes the provider throw
     * before it issues a request, which would fail these tests with an empty
     * URL and hide the endpoint change we actually want to catch. Branching on
     * specificationVersion keeps the request going on both so the assertion
     * reports the real URL.
     */
    const options = model?.specificationVersion === 'v1' ? { mode: { type: 'regular' }, prompt } : { prompt };

    /*
     * v1 returns a sync iterable of stream parts straight from doStream, while
     * v4 returns a promise of `{ stream, request, response }`. Await first and
     * unwrap, otherwise the request is never observed on v4 and the assertion
     * fails with an empty URL instead of the real endpoint.
     */
    const returned = await model.doStream(options);
    const stream = returned?.stream ?? returned;

    if (typeof stream?.[Symbol.asyncIterator] === 'function') {
      for await (const chunk of stream) {
        void chunk;
        break;
      }
    }
  } catch {
    /* the request is what we are asserting on, not the parse result */
  }

  return lastUrl();
}

describe('OpenAI provider wire format (characterization, v4)', () => {
  it('talks to /chat/completions, not the Responses API', async () => {
    const model = getOpenAILikeModel('https://api.openai.com/v1', 'test-key', 'gpt-4o');
    const url = await requestUrl(model);

    expect(url).toContain('/chat/completions');
    expect(url).not.toContain('/responses');
  });

  it('sends the requested model id in the request body', async () => {
    const model = getOpenAILikeModel('https://api.openai.com/v1', 'test-key', 'gpt-4o-mini');
    await requestUrl(model);

    const body = calls[0]?.init?.body;

    expect(typeof body === 'string' ? body : JSON.stringify(body)).toContain('gpt-4o-mini');
  });

  it('honours a custom baseURL, including one with a trailing slash', async () => {
    const withSlash = getOpenAILikeModel('https://api.hyperbolic.xyz/v1/', 'k', 'model-a');
    const urlA = await requestUrl(withSlash);

    expect(urlA.startsWith('https://api.hyperbolic.xyz/v1/')).toBe(true);
    expect(urlA).toContain('/chat/completions');
  });

  it('honours a baseURL with no version segment', async () => {
    const model = getOpenAILikeModel('https://api.perplexity.ai/', 'k', 'sonar');
    const url = await requestUrl(model);

    expect(url.startsWith('https://api.perplexity.ai/')).toBe(true);
    expect(url).toContain('/chat/completions');
  });
});

describe('real provider instances still target Chat Completions (characterization, v4)', () => {
  const cases: Array<[string, any, Record<string, string>, string]> = [
    ['OpenAI', OpenAIProvider, { OPENAI_API_KEY: 'k' }, 'api.openai.com'],
    ['GitHub', GitHubProvider, { GITHUB_API_KEY: 'k' }, 'models.github.ai'],
    ['Groq', GroqProvider, { GROQ_API_KEY: 'k' }, 'api.groq.com'],
    ['Perplexity', PerplexityProvider, { PERPLEXITY_API_KEY: 'k' }, 'api.perplexity.ai'],
    ['xAI', XAIProvider, { XAI_API_KEY: 'k' }, 'api.x.ai'],
  ];

  it.each(cases)('%s uses /chat/completions', async (name, providerClass, env, host) => {
    const instance = new providerClass();

    const model = instance.getModelInstance({
      model: 'test-model',
      serverEnv: env as any,
    });

    const url = await requestUrl(model);

    expect(url).toContain(host);
    expect(url).toContain('/chat/completions');
    expect(url).not.toContain('/responses');
  });
});
