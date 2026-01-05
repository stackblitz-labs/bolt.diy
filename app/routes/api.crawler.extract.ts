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
import { extractBusinessData } from '~/lib/services/crawlerClient.server';
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
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const { session_id, google_maps_url } = body as { session_id?: string; google_maps_url?: string };

    // Log what we received for debugging
    logger.info(`[API] Received crawler extract request`, {
      hasSessionId: !!session_id,
      sessionIdValue: session_id,
      sessionType: typeof session_id,
      hasUrl: !!google_maps_url,
      urlValue: google_maps_url ? google_maps_url.substring(0, 50) + '...' : undefined,
      urlType: typeof google_maps_url,
      urlTrimmed: google_maps_url?.trim(),
    });

    // Validate required fields
    if (!session_id || typeof session_id !== 'string') {
      logger.warn(`[API] Invalid session_id`, {
        received: session_id,
        type: typeof session_id,
      });

      return json(
        {
          error: {
            code: 'INVALID_INPUT',
            message: 'session_id is required and must be a string',
            details: `Received: ${typeof session_id} (${session_id ? 'defined' : 'undefined'})`,
          },
        },
        { status: 400 },
      );
    }

    if (!google_maps_url || typeof google_maps_url !== 'string') {
      logger.warn(`[API] Invalid google_maps_url`, {
        received: google_maps_url,
        type: typeof google_maps_url,
      });

      return json(
        {
          error: {
            code: 'INVALID_INPUT',
            message: 'google_maps_url is required and must be a string',
            details: `Received: ${typeof google_maps_url} (${google_maps_url ? 'defined' : 'undefined'})`,
          },
        },
        { status: 400 },
      );
    }

    // Check if URL is empty after trimming
    const trimmedUrl = google_maps_url.trim();

    if (!trimmedUrl) {
      logger.warn(`[API] Empty google_maps_url after trim`);

      return json(
        {
          error: {
            code: 'INVALID_INPUT',
            message: 'google_maps_url cannot be empty or whitespace only',
          },
        },
        { status: 400 },
      );
    }

    // Validate Google Maps URL format
    let url: URL;

    try {
      url = new URL(google_maps_url);

      logger.info(`[API] URL parsing successful`, {
        hostname: url.hostname,
        validHostnames: ['google.com', 'www.google.com', 'maps.app.goo.gl', 'goo.gl'],
        isValid: ['google.com', 'www.google.com', 'maps.app.goo.gl', 'goo.gl'].includes(url.hostname),
      });
    } catch (parseError) {
      logger.error(`[API] URL parsing failed`, {
        url: google_maps_url,
        error: parseError instanceof Error ? parseError.message : String(parseError),
      });

      return json(
        {
          error: {
            code: 'INVALID_INPUT',
            message: 'Invalid URL format provided',
            details: parseError instanceof Error ? parseError.message : 'Failed to parse URL',
          },
        },
        { status: 400 },
      );
    }

    const validHostnames = ['google.com', 'www.google.com', 'maps.app.goo.gl', 'goo.gl'];

    if (!validHostnames.includes(url.hostname)) {
      logger.warn(`[API] Invalid URL hostname`, {
        hostname: url.hostname,
        validHostnames,
      });

      return json(
        {
          error: {
            code: 'INVALID_INPUT',
            message: 'Invalid Google Maps URL format. URL must be from google.com, maps.app.goo.gl, or goo.gl',
            details: `Received hostname: ${url.hostname}`,
          },
        },
        { status: 400 },
      );
    }

    // Log crawler configuration for debugging
    logger.info(`[API] Calling crawler API`, {
      sessionId: session_id,
      crawlerUrl: process.env.CRAWLER_API_URL || 'http://localhost:4999',
      googleMapsUrl: google_maps_url.substring(0, 50) + '...', // Sanitize URL
    });

    // Call crawler API
    const startTime = Date.now();
    const result = await extractBusinessData(session_id, google_maps_url);
    const duration = Date.now() - startTime;

    // Log the extraction attempt
    logger.info(`[API] Crawler extraction`, {
      sessionId: session_id,
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
        sessionId: session_id,
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

    // Return successful response
    return json(result, { status: 200 });
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
