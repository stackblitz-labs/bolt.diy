/*
 * API Route: Crawler Search
 *
 * Proxies requests to the Crawler API's /search-restaurant endpoint.
 * This route searches for a restaurant by name and address to verify existence.
 *
 * POST /api/crawler/search
 * Body: { business_name: string, address: string }
 *
 */

import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node';
import { getSession } from '~/lib/auth/session.server';
import { searchRestaurant } from '~/lib/services/crawlerClient.server';
import { logger } from '~/utils/logger';

/**
 * Loader: Handle GET requests to this route
 */
export async function loader(_request: LoaderFunctionArgs) {
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
    const { business_name, address } = body as { business_name?: string; address?: string };

    // Log what we received
    logger.info(`[API] Received crawler search request`, {
      business_name,
      address,
      userId: session.user.id,
    });

    // Validate required fields
    if (!business_name || typeof business_name !== 'string' || !business_name.trim()) {
      return json(
        {
          error: {
            code: 'INVALID_INPUT',
            message: 'business_name is required and must be a string',
          },
        },
        { status: 400 },
      );
    }

    if (!address || typeof address !== 'string' || !address.trim()) {
      return json(
        {
          error: {
            code: 'INVALID_INPUT',
            message: 'address is required and must be a string',
          },
        },
        { status: 400 },
      );
    }

    // Call crawler API
    const result = await searchRestaurant(business_name.trim(), address.trim());

    // Handle specific error cases
    if (!result.success) {
      const statusCode = result.statusCode;

      if (statusCode === 408 || result.error?.includes('timed out')) {
        return json(
          {
            error: {
              code: 'CRAWLER_TIMEOUT',
              message: 'Search request timed out. Please try again.',
              details: result.error,
            },
          },
          { status: 408 },
        );
      }

      if (statusCode === 503 || result.error?.includes('unavailable')) {
        return json(
          {
            error: {
              code: 'CRAWLER_UNAVAILABLE',
              message: 'Service is currently unavailable. Please try again later.',
              details: result.error,
            },
          },
          { status: 503 },
        );
      }

      return json(
        {
          error: {
            code: 'SEARCH_FAILED',
            message: result.error || 'Search failed',
            details: result.error,
          },
        },
        { status: statusCode || 500 },
      );
    }

    // Return successful response
    return json(result, { status: 200 });
  } catch (error) {
    logger.error(`[API] Crawler search error`, {
      error: error instanceof Error ? error.message : String(error),
    });

    return json(
      {
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred during search',
        },
      },
      { status: 500 },
    );
  }
}
