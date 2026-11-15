import type { ActionFunctionArgs } from 'react-router';
import { z } from 'zod';
import { getTrustedClientIP } from '~/lib/security';
import { validatePublicHttpUrl, webFetch, webSearch } from '~/lib/services/webTools.server';

const MAX_BODY_BYTES = 4_096;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMITS = { search: 20, fetch: 30 } as const;
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

const searchRequestSchema = z
  .object({
    operation: z.literal('search'),
    query: z.string().trim().min(1).max(500),
    limit: z.number().int().min(1).max(10).optional(),
  })
  .strict();

const fetchRequestSchema = z.object({ url: z.string().min(1).max(2_048) }).strict();

function bodyError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

async function readJsonBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();

  if (contentType !== 'application/json') {
    throw bodyError('Content-Type must be application/json', 415);
  }

  const declaredLength = Number(request.headers.get('content-length'));

  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    throw bodyError('Request body exceeds the 4 KB limit', 413);
  }

  if (!request.body) {
    throw bodyError('Request body is required', 400);
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];

  let size = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      size += value.byteLength;

      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw bodyError('Request body exceeds the 4 KB limit', 413);
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  try {
    const bytes = new Uint8Array(size);

    let offset = 0;

    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);

    return JSON.parse(text);
  } catch {
    throw bodyError('Request body must be valid JSON', 400);
  }
}

function applyRateLimit(request: Request, context: ActionFunctionArgs['context'], operation: keyof typeof RATE_LIMITS) {
  const now = Date.now();
  const clientIp = getTrustedClientIP(request, context) ?? 'unidentified-client';
  const key = `${clientIp}:${operation}`;
  const prior = rateLimitStore.get(key);
  const entry = prior && prior.resetAt > now ? prior : { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };

  if (rateLimitStore.size > 1_000) {
    for (const [storedKey, value] of rateLimitStore) {
      if (value.resetAt <= now) {
        rateLimitStore.delete(storedKey);
      }
    }
  }

  if (entry.count >= RATE_LIMITS[operation]) {
    return Response.json(
      { error: 'Rate limit exceeded. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.max(1, Math.ceil((entry.resetAt - now) / 1000))) } },
    );
  }

  entry.count++;
  rateLimitStore.set(key, entry);

  return undefined;
}

function errorResponse(error: unknown): Response {
  if (error instanceof Response) {
    return error;
  }

  const message = error instanceof Error ? error.message : 'Web operation failed';
  const status = /timed out/i.test(message) ? 504 : 502;
  console.error('Web tool error:', message);

  return Response.json({ error: message }, { status });
}

export async function action({ request, context }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: { Allow: 'POST' } });
  }

  try {
    const body = await readJsonBody(request);

    if (typeof body === 'object' && body !== null && 'operation' in body && body.operation === 'search') {
      const parsed = searchRequestSchema.safeParse(body);

      if (!parsed.success) {
        return Response.json({ error: parsed.error.issues[0]?.message ?? 'Invalid search request' }, { status: 400 });
      }

      const rateLimitResponse = applyRateLimit(request, context, 'search');

      if (rateLimitResponse) {
        return rateLimitResponse;
      }

      const results = await webSearch(parsed.data.query, parsed.data.limit ?? 8);

      return Response.json({ success: true, data: { query: parsed.data.query, source: 'DuckDuckGo', results } });
    }

    const parsed = fetchRequestSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? 'URL is required' }, { status: 400 });
    }

    try {
      validatePublicHttpUrl(parsed.data.url);
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : 'URL is not allowed' }, { status: 400 });
    }

    const rateLimitResponse = applyRateLimit(request, context, 'fetch');

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const data = await webFetch(parsed.data.url);

    return Response.json({ success: true, data });
  } catch (error) {
    return errorResponse(error);
  }
}
