/*
 * API Route: Crawler Extract
 *
 * Proxies requests to the HuskIT/crawler API's /crawl endpoint.
 * This route extracts business data from Google Maps URLs.
 *
 * POST /api/crawler/extract
 * Body: { session_id: string, google_maps_url: string }
 *
 * See: specs/001-crawler-api-integration/
 */

import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node';
import { getSession } from '~/lib/auth/session.server';
import {
  extractBusinessData,
  generateGoogleMapsMarkdown,
  crawlWebsiteMarkdown,
} from '~/lib/services/crawlerClient.server';
import type { CrawlRequest } from '~/types/crawler';
import { logger } from '~/utils/logger';

/**
 * Loader: Handle GET requests to this route
 * Remix may try to fetch this route during navigation/prefetching
 */
export async function loader(_request: LoaderFunctionArgs) {
  // This endpoint only supports POST requests
  return json(
    {
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'This endpoint only supports POST requests',
      },
    },
    { status: 405 },
  );
}

export async function action({ request }: ActionFunctionArgs) {
  // Only accept POST requests
  if (request.method !== 'POST') {
    return json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Only POST method is allowed' } }, { status: 405 });
  }

  // Check authentication
  const session = await getSession(request);

  if (!session || !session.user) {
    return json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
  }

  try {
    // Parse request body
    const body = await request.json();
    const payload = body as CrawlRequest;

    // Deconstruct for validation
    const {
      session_id: sessionId,
      google_maps_url: googleMapsUrl,
      business_name: businessName,
      address,
      website_url: websiteUrl,
      place_id: placeId,
    } = payload;

    // Log what we received
    logger.info(`[API] Received crawler extract request`, {
      sessionId,
      hasUrl: !!googleMapsUrl,
      hasNameAddress: !!(businessName && address),
      hasWebsite: !!websiteUrl,
      hasPlaceId: !!placeId,
    });

    // Validate session_id
    if (!sessionId || typeof sessionId !== 'string') {
      return json(
        {
          error: {
            code: 'INVALID_INPUT',
            message: 'session_id is required',
          },
        },
        { status: 400 },
      );
    }

    // Validation strategy: At least one valid input method must be present
    const hasValidUrl = googleMapsUrl && typeof googleMapsUrl === 'string' && googleMapsUrl.trim().length > 0;
    const hasValidNameAddress =
      businessName &&
      typeof businessName === 'string' &&
      businessName.trim().length > 0 &&
      address &&
      typeof address === 'string' &&
      address.trim().length > 0;
    const hasValidWebsite = websiteUrl && typeof websiteUrl === 'string' && websiteUrl.trim().length > 0;

    if (!hasValidUrl && !hasValidNameAddress && !hasValidWebsite) {
      return json(
        {
          error: {
            code: 'INVALID_INPUT',
            message: 'Must provide either google_maps_url OR (business_name AND address) OR website_url',
          },
        },
        { status: 400 },
      );
    }

    // Optional: Validate URL format if provided
    if (hasValidUrl) {
      try {
        const urlObj = new URL(googleMapsUrl!);
        const validHostnames = ['google.com', 'www.google.com', 'maps.google.com', 'maps.app.goo.gl', 'goo.gl'];

        if (!validHostnames.includes(urlObj.hostname)) {
          logger.warn(`[API] Invalid URL hostname`, { hostname: urlObj.hostname });

          // We allow it to proceed if other methods are valid, or return error if it's the only method
          if (!hasValidNameAddress && !hasValidWebsite) {
            return json(
              { error: { code: 'INVALID_INPUT', message: 'Invalid Google Maps URL hostname' } },
              { status: 400 },
            );
          }
        }
      } catch {
        if (!hasValidNameAddress && !hasValidWebsite) {
          return json({ error: { code: 'INVALID_INPUT', message: 'Invalid URL format' } }, { status: 400 });
        }
      }
    }

    // Log crawler configuration for debugging
    logger.info(`[API] Calling crawler API`, {
      sessionId,
      crawlerUrl: process.env.CRAWLER_API_URL || 'http://localhost:4999',
      googleMapsUrl: googleMapsUrl?.substring(0, 50) + '...', // Sanitize URL
    });

    // Call crawler API
    const startTime = Date.now();

    // Pass the already parsed payload which matches the expected type
    const result = await extractBusinessData({
      session_id: sessionId,
      google_maps_url: googleMapsUrl,
      business_name: businessName,
      address,
      website_url: websiteUrl,
      place_id: placeId,
    });
    const duration = Date.now() - startTime;

    // Log the extraction attempt
    logger.info(`[API] Crawler extraction`, {
      sessionId,
      userId: session.user.id,
      duration: `${duration}ms`,
      success: result.success,
    });

    // Handle specific error cases
    if (!result.success) {
      // Extract status code if available
      const statusCode = (result as any).statusCode;

      // Timeout
      if (result.error?.includes('timed out')) {
        return json(
          {
            error: {
              code: 'CRAWLER_TIMEOUT',
              message: 'Data extraction timed out. Please try again or continue with manual entry.',
              details: result.error,
            },
          },
          { status: 408 },
        );
      }

      // Network/crawler unavailable (ECONNREFUSED, ENOTFOUND, etc.)
      if (
        result.error?.includes('unavailable') ||
        result.error?.includes('ECONNREFUSED') ||
        result.error?.includes('ENOTFOUND')
      ) {
        return json(
          {
            error: {
              code: 'CRAWLER_UNAVAILABLE',
              message: 'Unable to reach data extraction service. Please ensure the crawler service is running.',
              details: result.error,
            },
          },
          { status: 502 },
        );
      }

      // Crawler API returned 4xx error (user error - invalid URL, etc.)
      if (statusCode && statusCode >= 400 && statusCode < 500) {
        return json(
          {
            error: {
              code: 'CRAWLER_VALIDATION_ERROR',
              message: result.error || 'Invalid request to crawler service',
              details: result.error,
            },
          },
          { status: 400 },
        );
      }

      // Crawler API returned 5xx error (server error)
      if (statusCode && statusCode >= 500) {
        return json(
          {
            error: {
              code: 'CRAWLER_SERVER_ERROR',
              message: 'Crawler service encountered an error. Please try again later.',
              details: result.error,
            },
          },
          { status: 502 },
        );
      }

      // Generic/unknown error
      logger.error(`[API] Unknown crawler error`, {
        sessionId,
        error: result.error,
        statusCode,
      });

      return json(
        {
          error: {
            code: 'CRAWLER_ERROR',
            message: result.error || 'Data extraction failed',
            details: result.error,
          },
        },
        { status: 500 },
      );
    }

    /*
     * ─── Generate Markdown in Parallel ─────────────────────────────────
     * After successful extractBusinessData(), call markdown endpoints
     */
    const crawledWebsiteUrl = result.data?.website;

    const [gmapsMarkdownResult, websiteMarkdownResult] = await Promise.allSettled([
      generateGoogleMapsMarkdown(sessionId),
      crawledWebsiteUrl
        ? crawlWebsiteMarkdown({
            url: crawledWebsiteUrl,
            session_id: sessionId,
            enable_visual_analysis: true,
          })
        : Promise.resolve({ success: false, error: 'No website URL' } as const),
    ]);

    // Extract markdown values
    const googleMapsMarkdown =
      gmapsMarkdownResult.status === 'fulfilled' && gmapsMarkdownResult.value.success
        ? gmapsMarkdownResult.value.markdown
        : undefined;

    const websiteMarkdown =
      websiteMarkdownResult.status === 'fulfilled' &&
      websiteMarkdownResult.value.success &&
      'data' in websiteMarkdownResult.value
        ? websiteMarkdownResult.value.data?.markdown
        : undefined;

    // Log results
    logger.info(`[API] Markdown generation complete`, {
      sessionId,
      hasGoogleMapsMarkdown: !!googleMapsMarkdown,
      hasWebsiteMarkdown: !!websiteMarkdown,
      gmapsError:
        gmapsMarkdownResult.status === 'rejected'
          ? gmapsMarkdownResult.reason
          : gmapsMarkdownResult.value.success
            ? undefined
            : gmapsMarkdownResult.value.error,
      websiteError:
        websiteMarkdownResult.status === 'rejected'
          ? websiteMarkdownResult.reason
          : websiteMarkdownResult.value.success
            ? undefined
            : websiteMarkdownResult.value.error,
    });

    // Return enhanced response with markdown fields
    return json(
      {
        ...result,
        google_maps_markdown: googleMapsMarkdown,
        website_markdown: websiteMarkdown,
      },
      { status: 200 },
    );
  } catch (error) {
    // Handle unexpected errors
    logger.error(`[API] Crawler extraction error`, {
      error: error instanceof Error ? error.message : String(error),
    });

    return json(
      {
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred',
        },
      },
      { status: 500 },
    );
  }
}
