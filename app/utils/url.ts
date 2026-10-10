/**
 * URL validation utilities with SSRF protection.
 *
 * Note: these checks operate on the URL's hostname only. They cannot see what a
 * public hostname resolves to (DNS rebinding), so server code that fetches
 * user-supplied URLs must also re-validate every redirect hop — see
 * `safeFetch` in `~/lib/.server/web-search/fetch-page`.
 */

const PRIVATE_IPV4_PATTERNS = [
  /^0\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, // "This" network (0.0.0.0/8)
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, // Class A private
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3}$/, // Carrier-grade NAT (100.64.0.0/10)
  /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, // Loopback
  /^169\.254\.\d{1,3}\.\d{1,3}$/, // Link-local / cloud metadata
  /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/, // Class B private
  /^192\.0\.0\.\d{1,3}$/, // IETF protocol assignments
  /^192\.168\.\d{1,3}\.\d{1,3}$/, // Class C private
  /^198\.1[89]\.\d{1,3}\.\d{1,3}$/, // Benchmarking (198.18.0.0/15)
  /^(22[4-9]|2[3-5]\d)\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, // Multicast and reserved (224.0.0.0/3)
];

const PRIVATE_IPV6_PATTERNS = [
  /^::1?$/, // Loopback and unspecified
  /^f[cd][0-9a-f]{2}:/, // Unique local (fc00::/7)
  /^fe[89ab][0-9a-f]:/, // Link-local (fe80::/10)
  /^ff[0-9a-f]{2}:/, // Multicast
];

const BLOCKED_HOSTNAMES = new Set(['localhost', 'localhost.localdomain', 'ip6-localhost', 'ip6-loopback']);

export function isValidUrl(input: string): boolean {
  try {
    const url = new URL(input);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Converts the hex tail of an IPv4-mapped IPv6 address (`::ffff:7f00:1`) back
 * to dotted IPv4 so it can be checked against the IPv4 rules.
 */
function mappedIpv6ToIpv4(ipv6: string): string | null {
  const match = ipv6.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);

  if (!match) {
    return null;
  }

  const high = parseInt(match[1], 16);
  const low = parseInt(match[2], 16);

  return [high >> 8, high & 0xff, low >> 8, low & 0xff].join('.');
}

function isPrivateHostname(hostname: string): boolean {
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.localhost')) {
    return true;
  }

  // WHATWG URL keeps IPv6 hosts in brackets, e.g. "[::1]"
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    const ipv6 = hostname.slice(1, -1);
    const mappedIpv4 = mappedIpv6ToIpv4(ipv6);

    if (mappedIpv4) {
      return PRIVATE_IPV4_PATTERNS.some((pattern) => pattern.test(mappedIpv4));
    }

    return PRIVATE_IPV6_PATTERNS.some((pattern) => pattern.test(ipv6));
  }

  return PRIVATE_IPV4_PATTERNS.some((pattern) => pattern.test(hostname));
}

export function isAllowedUrl(input: string): boolean {
  if (!isValidUrl(input)) {
    return false;
  }

  const url = new URL(input);

  // Credentials in URLs are a common way to smuggle requests past naive filters
  if (url.username || url.password) {
    return false;
  }

  // Strip a trailing dot so "localhost." is treated like "localhost"
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');

  return !isPrivateHostname(hostname);
}
