/**
 * API Route: Site Generation with Crawler Integration
 *
 * Implements conversational flow for collecting place data via PCC chat,
 * executing crawler, and streaming progress via SSE.
 *
 * Based on specs/001-places-crawler/tasks.md Task T013
 *
 * @module api.site.generate
 */

import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { executeCrawl, persistCrawlResult } from '~/lib/services/crawlerAgent.server';
import { createToastFromError, type PCCToast, type QuotaState } from '~/lib/services/crawlerAgent.schema';
import { InternalPlacesClientError } from '~/lib/services/internalPlacesClient.server';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('api.site.generate');

type ConversationStateStore = Map<string, ConversationState>;

// TODO: Replace in-memory store with Cloudflare KV or Durable Objects
// Current limitation: State won't persist across worker restarts or scale across instances
// See: https://developers.cloudflare.com/kv/ or https://developers.cloudflare.com/durable-objects/

const globalWithConversationStore = globalThis as typeof globalThis & {
  __conversationStateStore?: ConversationStateStore;
};

const conversationStateStore =
  globalWithConversationStore.__conversationStateStore ?? new Map<string, ConversationState>();

if (!globalWithConversationStore.__conversationStateStore) {
  globalWithConversationStore.__conversationStateStore = conversationStateStore;
}

/**
 * Conversational state for data collection
 */
interface ConversationState {
  googleMapsUrl?: string;
  legacySite?: string;
  socialProfiles?: string[];
  ready: boolean;
  step: 'init' | 'collectUrl' | 'collectOptional' | 'ready' | 'crawling';
}

/**
 * SSE event types
 */
type SSEEvent =
  | { event: 'heartbeat'; data: { timestamp: number } }
  | { event: 'prompt'; data: { message: string; step: string } }
  | { event: 'crawl.start'; data: { correlationId: string } }
  | { event: 'crawl.progress'; data: { message: string; percentage: number } }
  | { event: 'crawl.complete'; data: CrawlCompleteData }
  | { event: 'crawl.error'; data: { message: string; code?: string } }
  | { event: 'toast'; data: PCCToast };

interface CrawlCompleteData {
  placeId: string;
  missingSections: string[];
  quotaState?: QuotaState;
  rawPayloadRef?: string;
}

/**
 * Action handler for site generation
 */
export async function action({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();
    const message = formData.get('message') as string;
    const tenantId = formData.get('tenantId') as string;
    const sessionId = formData.get('sessionId') as string;

    // Validate required fields
    if (!message || !tenantId) {
      return new Response('Missing required fields', {
        status: 400,
        statusText: 'Bad Request',
      });
    }

    // For now, use tenantId as authenticated tenant (in production, extract from auth session)
    const authenticatedTenantId = tenantId;

    logger.info('Site generation request received', {
      tenantId,
      sessionId,
      messageLength: message.length,
    });

    // Process conversation state
    const state = await collectInputs(message, tenantId, sessionId);

    if (!state.ready) {
      // Return SSE stream with prompt for missing data
      return eventStream(async (send) => {
        send({
          event: 'prompt',
          data: {
            message: getPromptForState(state),
            step: state.step,
          },
        });
      });
    }

    // Execute crawler with SSE progress streaming
    return eventStream(async (send) => {
      const correlationId = crypto.randomUUID();

      // Start heartbeat every 5 seconds
      const heartbeat = setInterval(() => {
        send({ event: 'heartbeat', data: { timestamp: Date.now() } });
      }, 5000);

      try {
        // Emit start event
        send({
          event: 'crawl.start',
          data: { correlationId },
        });

        logger.info('Starting crawler execution', { correlationId, tenantId });

        // Emit progress update
        send({
          event: 'crawl.progress',
          data: { message: 'Fetching place data...', percentage: 30 },
        });

        // Execute crawl
        const result = await executeCrawl(
          {
            tenantId,
            sourceUrl: state.googleMapsUrl!,
            forceRefresh: false,
            correlationId,
          },
          authenticatedTenantId,
        );

        logger.info('Crawler execution completed', {
          correlationId,
          placeId: result.placeId,
          cacheHit: result.cacheHit,
        });

        // Emit progress update
        send({
          event: 'crawl.progress',
          data: { message: 'Saving results...', percentage: 70 },
        });

        // Persist to Supabase (only if not from cache)
        let rawPayloadRef: string | undefined;

        if (!result.cacheHit) {
          rawPayloadRef = await persistCrawlResult(
            result,
            {
              sourceUrl: state.googleMapsUrl,
              fetchedAt: new Date().toISOString(),
              sections: result.sections,
            },
            24, // TTL: 24 hours
          );

          logger.info('Crawl result persisted', { correlationId, rawPayloadRef });
        }

        // Emit completion event
        send({
          event: 'crawl.complete',
          data: {
            placeId: result.placeId,
            missingSections: result.missingSections,
            quotaState: result.quotaState,
            rawPayloadRef: rawPayloadRef || result.rawPayloadRef,
          },
        });

        // Handle errors (crawler may return partial data with errors)
        if (result.error) {
          const toast = createToastFromError(result.error);
          send({ event: 'toast', data: toast });
          logger.warn('Crawler returned error', {
            correlationId,
            errorCode: result.error.code,
          });
        }
      } catch (error) {
        logger.error('Crawler execution failed', {
          correlationId,
          error: error instanceof Error ? error.message : String(error),
        });

        const crawlErrorPayload = getCrawlErrorPayload(error);

        send({
          event: 'crawl.error',
          data: crawlErrorPayload,
        });
      } finally {
        clearInterval(heartbeat);
      }
    });
  } catch (error) {
    logger.error('Site generation request failed', {
      error: error instanceof Error ? error.message : String(error),
    });

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

/**
 * Create SSE stream
 */
function eventStream(handler: (send: SendFn) => void | Promise<void>): Response {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const send: SendFn = (event: SSEEvent) => {
        const message = `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      try {
        await handler(send);
      } catch (error) {
        logger.error('SSE stream error', { error });
        send({
          event: 'crawl.error',
          data: {
            message: error instanceof Error ? error.message : 'Stream error',
          },
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

type SendFn = (event: SSEEvent) => void;

const SKIP_OPTIONAL_PATTERN = /\b(?:skip|skip optional|generate(?: it)? now|just(?: give)? maps)\b/i;
const URL_CANDIDATE_PATTERN = /((?:https?:\/\/)?(?:www\.)?[^\s<>'"]+\.[^\s<>'"]+)/gi;
const TRAILING_PUNCTUATION_PATTERN = /[)\]}>,.;!?]+$/;
const SOCIAL_DOMAINS = ['facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'linkedin.com', 'tiktok.com'];

function getCrawlErrorPayload(error: unknown): { message: string; code: string } {
  const fallbackMessage = error instanceof Error ? error.message : 'Unknown error occurred';

  if (error instanceof InternalPlacesClientError) {
    if (error.crawlError) {
      return {
        message: error.crawlError.message,
        code: error.crawlError.code,
      };
    }

    if (error.isQuotaExceeded()) {
      return { message: fallbackMessage, code: 'QUOTA_EXCEEDED' };
    }

    if (error.isClientError()) {
      return { message: fallbackMessage, code: 'INVALID_INPUT' };
    }

    if (error.isServerError()) {
      return { message: fallbackMessage, code: 'UPSTREAM_ERROR' };
    }
  }

  return {
    message: fallbackMessage,
    code: 'UPSTREAM_ERROR',
  };
}

/**
 * Collect inputs conversationally
 *
 * State machine for gathering required and optional data:
 * 1. init -> collectUrl: Ask for Google Maps URL
 * 2. collectUrl -> collectOptional: URL received, ask for optional data
 * 3. collectOptional -> ready: User skips or provides optional data
 */
export async function collectInputs(message: string, _tenantId: string, sessionId: string): Promise<ConversationState> {
  const normalizedMessage = message?.trim() ?? '';
  const state: ConversationState = { ...(await getConversationState(sessionId)) };

  state.step = state.step || 'init';
  state.ready = state.ready || false;

  const mapsUrl = extractGoogleMapsUrl(normalizedMessage);

  if (mapsUrl && state.googleMapsUrl !== mapsUrl) {
    state.googleMapsUrl = mapsUrl;
  }

  const websiteUrl = extractWebsiteUrl(normalizedMessage);

  if (websiteUrl && !state.legacySite) {
    state.legacySite = websiteUrl;
  }

  const socialUrls = extractSocialUrls(normalizedMessage);

  if (socialUrls.length > 0) {
    const existingProfiles = new Set(state.socialProfiles || []);
    socialUrls.forEach((url) => existingProfiles.add(url));
    state.socialProfiles = Array.from(existingProfiles);
  }

  const skipOptional = SKIP_OPTIONAL_PATTERN.test(normalizedMessage);

  if (!state.googleMapsUrl) {
    state.step = 'collectUrl';
    state.ready = false;
  } else if (skipOptional) {
    state.step = 'ready';
    state.ready = true;
  } else if (state.legacySite || (state.socialProfiles?.length ?? 0) > 0) {
    state.step = 'ready';
    state.ready = true;
  } else if (state.step !== 'ready') {
    state.step = 'collectOptional';
    state.ready = false;
  }

  await saveConversationState(sessionId, state);

  return state;
}

/**
 * Get prompt message based on conversation state
 */
function getPromptForState(state: ConversationState): string {
  switch (state.step) {
    case 'init':
    case 'collectUrl':
      return 'Please provide your Google Maps URL to get started. For example: https://maps.google.com/place/...';

    case 'collectOptional':
      return 'Great! I found your Google Maps listing. Would you like to provide:\n- Your existing website URL (optional)\n- Social media profiles (optional)\n\nOr type "skip" to proceed with just Google Maps data.';

    default:
      return 'Please provide your Google Maps URL to generate your website.';
  }
}

/**
 * Extract Google Maps URL from message
 */
export function extractGoogleMapsUrl(message: string): string | null {
  const candidates = collectUrlCandidates(message);

  for (const candidate of candidates) {
    const parsed = tryParseUrl(candidate);

    if (parsed && isGoogleMapsUrl(parsed)) {
      return parsed.toString();
    }
  }

  return null;
}

/**
 * Extract website URL from message (excluding Google Maps)
 */
export function extractWebsiteUrl(message: string): string | null {
  const candidates = collectUrlCandidates(message);

  for (const candidate of candidates) {
    const parsed = tryParseUrl(candidate);

    if (!parsed) {
      continue;
    }

    if (isGoogleMapsUrl(parsed) || isSocialHostname(parsed.hostname)) {
      continue;
    }

    return parsed.toString();
  }

  return null;
}

/**
 * Extract social media URLs from message
 */
export function extractSocialUrls(message: string): string[] {
  const candidates = collectUrlCandidates(message);
  const urls = new Set<string>();

  for (const candidate of candidates) {
    const parsed = tryParseUrl(candidate);

    if (parsed && isSocialHostname(parsed.hostname)) {
      const normalizedSocialUrl = `https://${parsed.host}${parsed.pathname}${parsed.search}${parsed.hash}`;
      urls.add(normalizedSocialUrl);
    }
  }

  return Array.from(urls);
}

async function getConversationState(sessionId: string): Promise<ConversationState> {
  if (!sessionId) {
    return {
      step: 'init',
      ready: false,
    };
  }

  return (
    conversationStateStore.get(sessionId) || {
      step: 'init',
      ready: false,
    }
  );
}

async function saveConversationState(sessionId: string, state: ConversationState): Promise<void> {
  if (!sessionId) {
    logger.warn('Missing sessionId when attempting to persist conversation state');
    return;
  }

  const clonedState: ConversationState = {
    ...state,
    socialProfiles: state.socialProfiles ? [...state.socialProfiles] : undefined,
  };

  conversationStateStore.set(sessionId, clonedState);

  logger.debug('Conversation state saved', { sessionId, step: state.step });
}

export function resetConversationStateStore(): void {
  conversationStateStore.clear();
}

function collectUrlCandidates(message: string): string[] {
  if (!message) {
    return [];
  }

  const candidates: string[] = [];
  let match: RegExpExecArray | null;
  URL_CANDIDATE_PATTERN.lastIndex = 0;

  while ((match = URL_CANDIDATE_PATTERN.exec(message)) !== null) {
    candidates.push(sanitizeUrlCandidate(match[1]));
  }

  return candidates;
}

function sanitizeUrlCandidate(raw: string): string {
  const trimmed = raw.replace(TRAILING_PUNCTUATION_PATTERN, '');

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function tryParseUrl(candidate: string): URL | null {
  try {
    return new URL(candidate);
  } catch {
    return null;
  }
}

function isGoogleMapsUrl(url: URL): boolean {
  const hostname = url.hostname.toLowerCase();

  if (hostname === 'maps.app.goo.gl' || hostname === 'goo.gl') {
    return true;
  }

  if (hostname === 'maps.google.com') {
    return true;
  }

  if (hostname === 'www.google.com' || hostname === 'google.com') {
    return url.pathname.toLowerCase().startsWith('/maps');
  }

  return false;
}

function isSocialHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return SOCIAL_DOMAINS.some((domain) => normalized === domain || normalized.endsWith(`.${domain}`));
}
