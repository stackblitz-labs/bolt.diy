/*
 * API Route: Crawler Generate Content
 *
 * Proxies requests to the HuskIT/crawler API's /generate-website-content endpoint.
 * This route generates AI-powered website content from extracted business data.
 *
 * POST /api/crawler/generate
 * Body: { session_id: string }
 *
 * See: specs/001-crawler-api-integration/
 */

import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node';
import { getSession } from '~/lib/auth/session.server';
import { generateWebsiteContent } from '~/lib/services/crawlerClient.server';
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
    const { session_id } = body as { session_id?: string };

    // Validate required fields
    if (!session_id || typeof session_id !== 'string') {
      return json(
        { error: { code: 'INVALID_INPUT', message: 'session_id is required and must be a string' } },
        { status: 400 },
      );
    }

    // Log crawler configuration for debugging
    logger.info(`[API] Calling crawler API`, {
      sessionId: session_id,
      crawlerUrl: process.env.CRAWLER_API_URL || 'http://localhost:4999',
    });

    // Call crawler API
    const startTime = Date.now();
    const result = await generateWebsiteContent(session_id);
    const duration = Date.now() - startTime;

    // Log the generation attempt
    logger.info(`[API] Crawler content generation`, {
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
              message: 'AI content generation timed out. Please try again.',
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
              message: 'Unable to reach content generation service. Please ensure the crawler service is running.',
              details: result.error,
            },
          },
          { status: 502 },
        );
      }

      // Crawler API returned 4xx error (user error - invalid session, etc.)
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
            message: result.error || 'Content generation failed',
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
    logger.error(`[API] Crawler generation error`, {
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
