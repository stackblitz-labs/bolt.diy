/**
 * URL validation utilities with SSRF protection.
 */

const PRIVATE_IP_PATTERNS = [
  /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, // Loopback
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, // Class A private
  /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/, // Class B private
  /^192\.168\.\d{1,3}\.\d{1,3}$/, // Class C private
  /^169\.254\.\d{1,3}\.\d{1,3}$/, // Link-local
  /^0\.0\.0\.0$/, // Unspecified
];

const BLOCKED_HOSTNAMES = new Set(['localhost', '[::1]', '0.0.0.0']);

export function isValidUrl(input: string): boolean {
  try {
    const url = new URL(input);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isAllowedUrl(input: string): boolean {
  if (!isValidUrl(input)) {
    return false;
  }

  const url = new URL(input);
  const hostname = url.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return false;
  }

  if (PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(hostname))) {
    return false;
  }

  return true;
}
