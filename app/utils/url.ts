/**
 * URL validation utilities with SSRF protection.
 */

function isBlockedIPv4(hostname: string): boolean {
  const octets = hostname.split('.').map(Number);

  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return false;
  }

  const [first, second] = octets;

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 100 && second >= 64 && second <= 127) ||
    first >= 224
  );
}

function isBlockedIPv6(hostname: string): boolean {
  const address = hostname.replace(/^\[|\]$/g, '').toLowerCase();

  if (address === '::' || address === '::1' || address.startsWith('fc') || address.startsWith('fd')) {
    return true;
  }

  if (/^fe[89ab]/.test(address) || address.startsWith('ff')) {
    return true;
  }

  const mappedDottedV4 = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);

  if (mappedDottedV4) {
    return isBlockedIPv4(mappedDottedV4[1]);
  }

  const mappedHexV4 = address.match(/^::ffff:([\da-f]{1,4}):([\da-f]{1,4})$/);

  if (mappedHexV4) {
    const high = Number.parseInt(mappedHexV4[1], 16);
    const low = Number.parseInt(mappedHexV4[2], 16);
    const ipv4 = [high >> 8, high & 255, low >> 8, low & 255].join('.');

    return isBlockedIPv4(ipv4);
  }

  return false;
}

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
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');

  if (
    url.username ||
    url.password ||
    (url.port && url.port !== '80' && url.port !== '443') ||
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    return false;
  }

  if (isBlockedIPv4(hostname) || (hostname.includes(':') && isBlockedIPv6(url.hostname))) {
    return false;
  }

  return true;
}
