/*
 * Crawler Client Service
 * Server-only HTTP client for HuskIT/crawler API
 *
 * This service provides a typed interface to the crawler API endpoints:
 * - POST /crawl - Extract business data from Google Maps URL
 * - POST /generate-website-content - Generate AI-powered website content
 *
 * Environment configuration:
 * - CRAWLER_API_URL: Base URL for crawler API (default: http://localhost:4999)
 * - CRAWLER_TIMEOUT: Request timeout in milliseconds (default: 60000ms = 60s)
 *
 * See: specs/001-crawler-api-integration/
 */

import { logger } from '~/utils/logger';
import type {
  CrawlRequest,
  CrawlResponse,
  GenerateContentResponse,
  SearchRestaurantResponse,
  GenerateGoogleMapsMarkdownResponse,
  CrawlWebsiteMarkdownRequest,
  CrawlWebsiteMarkdownResponse,
} from '~/types/crawler';

// Environment configuration
const CRAWLER_API_URL = process.env.CRAWLER_API_URL || 'http://localhost:4999';
const CRAWLER_TIMEOUT = 300_000; // 5 minutes

/**
 * Private helper: Fetch with timeout support
 * Uses AbortController to cancel requests that exceed timeoutMs
 */
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    return response;
  } catch (error) {
    clearTimeout(timeoutId);

    // Check if it's an abort error (timeout)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }

    // Re-throw other errors
    throw error;
  }
}

/**
 * Extract business data from Google Maps
 *
 * Supports multiple input methods:
 * 1. Google Maps URL (full or share link)
 * 2. Business Name + Address
 * 3. Website URL
 * 4. Verified Data (via Search)
 *
 * @param payload - Crawl request payload
 * @returns CrawlResponse with extracted business data or error
 */
export async function extractBusinessData(
  payload: Omit<CrawlRequest, 'session_id'> & { session_id: string },
): Promise<CrawlResponse> {
  const startTime = Date.now();
  const { session_id: sessionId, ...rest } = payload;

  try {
    logger.info(`[Crawler] Extracting business data`, {
      sessionId,
      method: payload.google_maps_url ? 'URL' : payload.business_name ? 'Name+Address' : 'Other',
      payload: rest,
    });

    const response = await fetchWithTimeout(
      `${CRAWLER_API_URL}/crawl`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
      CRAWLER_TIMEOUT,
    );

    const duration = Date.now() - startTime;

    if (!response.ok) {
      logger.error(`[Crawler] Extraction failed`, {
        sessionId,
        status: response.status,
        statusText: response.statusText,
        duration: `${duration}ms`,
      });

      // Try to parse error body for more details
      let errorDetails = `Crawler API returned ${response.status}: ${response.statusText}`;

      try {
        const errorBody = await response.json();

        if (typeof errorBody === 'object' && errorBody !== null) {
          const body = errorBody as Record<string, unknown>;

          if (typeof body.error === 'string') {
            errorDetails = body.error;
          } else if (typeof body.message === 'string') {
            errorDetails = body.message;
          } else if (typeof body.detail === 'string') {
            errorDetails = body.detail;
          }
        }
      } catch {
        // Use status text if JSON parsing fails
      }

      return {
        success: false,
        error: errorDetails,
        statusCode: response.status, // Include status code
      };
    }

    const data: unknown = await response.json();

    logger.info(`[Crawler] Extraction successful`, {
      sessionId,
      duration: `${duration}ms`,
      hasData: !!(data as any)?.data,
    });

    return data as CrawlResponse;
  } catch (error) {
    const duration = Date.now() - startTime;

    // Handle timeout specifically
    if (error instanceof Error && error.message.includes('timed out')) {
      logger.error(`[Crawler] Extraction timed out`, {
        sessionId,
        duration: `${duration}ms`,
      });

      return {
        success: false,
        error: `Request timed out after ${CRAWLER_TIMEOUT}ms`,
        statusCode: 408, // Request Timeout
      };
    }

    // Handle network errors (ECONNREFUSED, ENOTFOUND, etc.)
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`[Crawler] Network error`, {
      sessionId,
      error: errorMessage,
      duration: `${duration}ms`,
      crawlerUrl: CRAWLER_API_URL, // Log which URL we're trying
    });

    return {
      success: false,
      error: `Crawler API unavailable (${errorMessage})`,
      statusCode: 503, // Service Unavailable
    };
  }
}

/**
 * Generate AI-powered website content
 *
 * Calls the crawler API's /generate-website-content endpoint to generate:
 * - Brand strategy (USP, target audience, tone, visual style)
 * - Visual assets (colors, typography, logo)
 * - Business identity (name, tagline, description)
 * - Industry context (categories, pricing tier)
 * - Content sections (hero, about, products, etc.)
 *
 * Prerequisites: extractBusinessData must have been called with the same sessionId
 *
 * @param sessionId - Unique session ID (must match previous extractBusinessData call)
 * @returns GenerateContentResponse with AI-generated content or error
 */
export async function generateWebsiteContent(sessionId: string): Promise<GenerateContentResponse> {
  const startTime = Date.now();

  try {
    logger.info(`[Crawler] Generating website content`, {
      sessionId,
    });

    const response = await fetchWithTimeout(
      `${CRAWLER_API_URL}/generate-website-content`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId,
        }),
      },
      CRAWLER_TIMEOUT,
    );

    const duration = Date.now() - startTime;

    if (!response.ok) {
      logger.error(`[Crawler] Generation failed`, {
        sessionId,
        status: response.status,
        statusText: response.statusText,
        duration: `${duration}ms`,
      });

      // Try to parse error body for more details
      let errorDetails = `Crawler API returned ${response.status}: ${response.statusText}`;

      try {
        const errorBody = await response.json();

        if (typeof errorBody === 'object' && errorBody !== null) {
          const body = errorBody as Record<string, unknown>;

          if (typeof body.error === 'string') {
            errorDetails = body.error;
          } else if (typeof body.message === 'string') {
            errorDetails = body.message;
          } else if (typeof body.detail === 'string') {
            errorDetails = body.detail;
          }
        }
      } catch {
        // Use status text if JSON parsing fails
      }

      return {
        success: false,
        session_id: sessionId,
        error: errorDetails,
        statusCode: response.status, // Include status code
      };
    }

    const data: unknown = await response.json();

    logger.info(`[Crawler] Generation successful`, {
      sessionId,
      duration: `${duration}ms`,
      hasContent: !!(data as any)?.data,
    });

    return data as GenerateContentResponse;
  } catch (error) {
    const duration = Date.now() - startTime;

    // Handle timeout specifically
    if (error instanceof Error && error.message.includes('timed out')) {
      logger.error(`[Crawler] Generation timed out`, {
        sessionId,
        duration: `${duration}ms`,
      });

      return {
        success: false,
        session_id: sessionId,
        error: `Request timed out after ${CRAWLER_TIMEOUT}ms`,
        statusCode: 408, // Request Timeout
      };
    }

    // Handle network errors (ECONNREFUSED, ENOTFOUND, etc.)
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`[Crawler] Network error`, {
      sessionId,
      error: errorMessage,
      duration: `${duration}ms`,
      crawlerUrl: CRAWLER_API_URL, // Log which URL we're trying
    });

    return {
      success: false,
      session_id: sessionId,
      error: `Crawler API unavailable (${errorMessage})`,
      statusCode: 503, // Service Unavailable
    };
  }
}

/**
 * Search for a restaurant to verify its details
 *
 * Calls the crawler API's /search-restaurant endpoint to:
 * - Search for a business by name and address
 * - Return potential matches with place_id and data_id
 *
 * @param businessName - Name of the business to search for
 * @param address - Address or location context
 * @returns SearchRestaurantResponse with verified data or error
 */
export async function searchRestaurant(businessName: string, address: string): Promise<SearchRestaurantResponse> {
  const startTime = Date.now();

  try {
    logger.info(`[Crawler] Searching for restaurant`, {
      businessName,
      address,
    });

    const response = await fetchWithTimeout(
      `${CRAWLER_API_URL}/search-restaurant`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          business_name: businessName,
          address,
        }),
      },
      CRAWLER_TIMEOUT,
    );

    const duration = Date.now() - startTime;

    if (!response.ok) {
      logger.error(`[Crawler] Search failed`, {
        businessName,
        status: response.status,
        statusText: response.statusText,
        duration: `${duration}ms`,
      });

      let errorDetails = `Crawler API returned ${response.status}: ${response.statusText}`;

      try {
        const errorBody = await response.json();

        if (typeof errorBody === 'object' && errorBody !== null) {
          const body = errorBody as Record<string, unknown>;

          if (typeof body.error === 'string') {
            errorDetails = body.error;
          } else if (typeof body.message === 'string') {
            errorDetails = body.message;
          }
        }
      } catch {
        // Use status text if JSON parsing fails
      }

      return {
        success: false,
        error: errorDetails,
        statusCode: response.status,
      };
    }

    const data: unknown = await response.json();

    logger.info(`[Crawler] Search successful`, {
      businessName,
      duration: `${duration}ms`,
      hasData: !!(data as any)?.data,
    });

    return data as SearchRestaurantResponse;
  } catch (error) {
    const duration = Date.now() - startTime;

    if (error instanceof Error && error.message.includes('timed out')) {
      logger.error(`[Crawler] Search timed out`, {
        businessName,
        duration: `${duration}ms`,
      });

      return {
        success: false,
        error: `Request timed out after ${CRAWLER_TIMEOUT}ms`,
        statusCode: 408,
      };
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`[Crawler] Network error during search`, {
      businessName,
      error: errorMessage,
      duration: `${duration}ms`,
    });

    return {
      success: false,
      error: `Crawler API unavailable (${errorMessage})`,
      statusCode: 503,
    };
  }
}

// ─── Markdown Generation Methods ─────────────────────────────────────

const MARKDOWN_TIMEOUT = 120_000; // 120 seconds for LLM Vision processing

/**
 * Generate markdown profile from previously crawled Google Maps data.
 *
 * Prerequisites: extractBusinessData() must have been called with the same sessionId.
 * Caching: Crawler API caches results per session_id.
 *
 * @param sessionId - Session ID from prior /crawl operation
 * @returns Markdown profile or error
 */
export async function generateGoogleMapsMarkdown(sessionId: string): Promise<GenerateGoogleMapsMarkdownResponse> {
  const startTime = Date.now();

  try {
    logger.info(`[Crawler] Generating Google Maps markdown`, { sessionId });

    const response = await fetchWithTimeout(
      `${CRAWLER_API_URL}/generate-google-maps-markdown`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      },
      MARKDOWN_TIMEOUT,
    );
    logger.info(`[Crawler] Google Maps markdown response`, {
      sessionId,
      status: response.status,
      ok: response.ok,
    });

    const duration = Date.now() - startTime;

    if (!response.ok) {
      logger.error(`[Crawler] Google Maps markdown failed`, {
        sessionId,
        status: response.status,
        duration: `${duration}ms`,
      });

      let errorDetails = `Crawler API returned ${response.status}`;

      try {
        const errorBody = await response.json();

        if (typeof errorBody === 'object' && errorBody !== null) {
          const body = errorBody as Record<string, unknown>;

          if (typeof body.error === 'string') {
            errorDetails = body.error;
          }
        }
      } catch {
        /* ignore */
        logger.error(`[Crawler] Error parsing error body`, { response });
      }

      return {
        success: false,
        error: errorDetails,
        statusCode: response.status,
      };
    }

    const rawData = (await response.json()) as Record<string, unknown>;

    // Debug logging to investigate response structure and error
    logger.info(`[Crawler] Raw markdown response`, {
      sessionId,
      keys: Object.keys(rawData),
      hasMarkdown: !!rawData.markdown,
      hasData: !!rawData.data,
      hasDataMarkdown: !!(rawData.data as Record<string, unknown> | undefined)?.markdown,
      success: rawData.success,
      error: rawData.error, // <-- Log the actual error message
    });

    const data = rawData as unknown as GenerateGoogleMapsMarkdownResponse;

    if (data.success) {
      logger.info(`[Crawler] Google Maps markdown success`, { sessionId, duration: `${duration}ms` });
    } else {
      logger.warn(`[Crawler] Google Maps markdown returned failure`, {
        sessionId,
        duration: `${duration}ms`,
        error: data.error,
      });
    }

    return data;
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('timed out')) {
      logger.error(`[Crawler] Google Maps markdown timed out`, { sessionId, duration: `${duration}ms` });

      return { success: false, error: `Timed out after ${MARKDOWN_TIMEOUT}ms`, statusCode: 408 };
    }

    logger.error(`[Crawler] Google Maps markdown network error`, {
      sessionId,
      error: errorMessage,
      duration: `${duration}ms`,
    });

    return { success: false, error: `Crawler unavailable (${errorMessage})`, statusCode: 503 };
  }
}

/**
 * Crawl a website and generate rich markdown with visual analysis.
 *
 * Uses LLM Vision to describe images, layout, and visual style.
 * Timeout: 120 seconds to accommodate Vision processing.
 *
 * @param request - Website URL, session ID, and options
 * @returns Website markdown or error
 */
export async function crawlWebsiteMarkdown(
  request: CrawlWebsiteMarkdownRequest,
): Promise<CrawlWebsiteMarkdownResponse> {
  const startTime = Date.now();

  try {
    logger.info(`[Crawler] Crawling website for markdown`, {
      url: request.url,
      sessionId: request.session_id,
    });

    const response = await fetchWithTimeout(
      `${CRAWLER_API_URL}/crawl-website-markdown`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: request.url,
          max_pages: request.max_pages ?? 1,
          session_id: request.session_id,
          enable_visual_analysis: request.enable_visual_analysis ?? true,
        }),
      },
      MARKDOWN_TIMEOUT,
    );

    const duration = Date.now() - startTime;

    if (!response.ok) {
      logger.error(`[Crawler] Website markdown failed`, {
        url: request.url,
        status: response.status,
        duration: `${duration}ms`,
      });

      let errorDetails = `Crawler API returned ${response.status}`;

      try {
        const errorBody = await response.json();

        if (typeof errorBody === 'object' && errorBody !== null) {
          const body = errorBody as Record<string, unknown>;

          if (typeof body.error === 'string') {
            errorDetails = body.error;
          }
        }
      } catch {
        /* ignore */
      }

      return {
        success: false,
        error: errorDetails,
        statusCode: response.status,
      };
    }

    const data = (await response.json()) as CrawlWebsiteMarkdownResponse;
    logger.info(`[Crawler] Website markdown success`, {
      url: request.url,
      duration: `${duration}ms`,
    });

    return data;
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('timed out')) {
      logger.error(`[Crawler] Website markdown timed out`, {
        url: request.url,
        duration: `${duration}ms`,
      });

      return { success: false, error: `Timed out after ${MARKDOWN_TIMEOUT}ms`, statusCode: 408 };
    }

    logger.error(`[Crawler] Website markdown network error`, {
      url: request.url,
      error: errorMessage,
      duration: `${duration}ms`,
    });

    return { success: false, error: `Crawler unavailable (${errorMessage})`, statusCode: 503 };
  }
}
