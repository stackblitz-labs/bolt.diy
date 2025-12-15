/**
 * URL Validation Utilities
 * For website and Google Maps URL format validation
 */

export interface UrlValidationResult {
  isValid: boolean;
  normalizedUrl: string | null;
  error?: string;
}

/**
 * Validate and normalize a website URL
 * Accepts http:// or https:// URLs
 */
export function validateWebsiteUrl(input: string): UrlValidationResult {
  if (!input || input.trim() === '') {
    return { isValid: false, normalizedUrl: null, error: 'URL cannot be empty' };
  }

  let url = input.trim();

  // Add https:// if no protocol specified
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }

  try {
    const parsed = new URL(url);

    // Must have a valid hostname
    if (!parsed.hostname || parsed.hostname.length < 3) {
      return { isValid: false, normalizedUrl: null, error: 'Invalid domain name' };
    }

    // Must have at least one dot in hostname (basic domain check)
    if (!parsed.hostname.includes('.')) {
      return { isValid: false, normalizedUrl: null, error: 'Invalid domain format' };
    }

    return { isValid: true, normalizedUrl: parsed.href };
  } catch {
    return { isValid: false, normalizedUrl: null, error: 'Invalid URL format' };
  }
}

/**
 * Validate and normalize a Google Maps URL
 * Accepts various Google Maps URL formats:
 * - google.com/maps/...
 * - maps.google.com/...
 * - goo.gl/maps/...
 * - maps.app.goo.gl/...
 */
export function validateGoogleMapsUrl(input: string): UrlValidationResult {
  if (!input || input.trim() === '') {
    return { isValid: false, normalizedUrl: null, error: 'URL cannot be empty' };
  }

  let url = input.trim();

  // Add https:// if no protocol specified
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }

  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // Valid Google Maps hostnames
    const validHostnames = ['google.com', 'www.google.com', 'maps.google.com', 'goo.gl', 'maps.app.goo.gl'];

    // Check for Google Maps specific patterns
    const isGoogleMaps =
      validHostnames.some((h) => hostname === h || hostname.endsWith(`.${h}`)) &&
      (parsed.pathname.includes('/maps') || hostname.includes('goo.gl'));

    if (!isGoogleMaps) {
      return {
        isValid: false,
        normalizedUrl: null,
        error: 'Not a valid Google Maps URL. Please provide a link from Google Maps.',
      };
    }

    return { isValid: true, normalizedUrl: parsed.href };
  } catch {
    return { isValid: false, normalizedUrl: null, error: 'Invalid URL format' };
  }
}

/**
 * Extract place ID from Google Maps URL if present
 */
export function extractPlaceId(url: string): string | null {
  try {
    const parsed = new URL(url);

    // Check for place_id in query params
    const placeId = parsed.searchParams.get('place_id');

    if (placeId) {
      return placeId;
    }

    // Check for place ID in path (format: /place/ChIJ...)
    const pathMatch = parsed.pathname.match(/\/place\/([A-Za-z0-9_-]+)/);

    if (pathMatch) {
      return pathMatch[1];
    }

    return null;
  } catch {
    return null;
  }
}
