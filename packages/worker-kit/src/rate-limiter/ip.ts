/**
 * IP Address Utilities
 *
 * Helpers for extracting client IP addresses from HTTP requests.
 * Handles Cloudflare's CF-Connecting-IP header and X-Forwarded-For.
 */

/**
 * Options for {@link getClientIp}
 */
export interface GetClientIpOptions {
  /**
   * Whether to trust the X-Forwarded-For header as a fallback.
   *
   * **Security warning:** X-Forwarded-For is a client-controlled header
   * and can be trivially spoofed. Only trust it when your infrastructure
   * (reverse proxy, CDN) guarantees it is overwritten before reaching
   * your application. In Cloudflare Workers, prefer CF-Connecting-IP
   * which is set by Cloudflare and cannot be forged by clients.
   *
   * Set to `false` to ignore X-Forwarded-For entirely, falling back to
   * 'unknown' when CF-Connecting-IP is absent.
   *
   * @default false
   */
  trustXForwardedFor?: boolean;

  /**
   * Group valid IPv6 addresses by their canonical /64 network address.
   * IPv4-mapped IPv6 is normalized to dotted IPv4 to retain per-client keys.
   * Invalid literals retain the default trimmed, lowercase output.
   * @default false
   */
  ipv6Prefix64?: boolean;
}

/**
 * Extract client IP address from request headers
 *
 * Priority order:
 * 1. CF-Connecting-IP (Cloudflare's true client IP — cannot be spoofed)
 * 2. X-Forwarded-For (first IP in chain — **spoofable**, see options)
 * 3. 'unknown' fallback
 *
 * FINDING-006: All returned IPs are normalized to lowercase for consistent
 * comparison, since IPv6 hex digits are case-insensitive (RFC 5952).
 *
 * @param request - The incoming HTTP request
 * @param options - Configuration options
 * @returns Client IP address (normalized to lowercase) or 'unknown'
 *
 * @example
 * ```typescript
 * // Default: only trusts CF-Connecting-IP
 * const ip = getClientIp(request);
 *
 * // Opt in to shared IPv6 /64 rate-limit buckets
 * const networkIp = getClientIp(request, { ipv6Prefix64: true });
 * ```
 */
export function getClientIp(request: Request, options: GetClientIpOptions = {}): string {
  // FINDING-006: Default to false — XFF is client-controlled and spoofable
  const { trustXForwardedFor = false, ipv6Prefix64 = false } = options;

  // Cloudflare's CF-Connecting-IP is the true client IP
  const cfIp = request.headers.get('CF-Connecting-IP');
  if (cfIp) {
    return normalizeIp(cfIp.trim(), ipv6Prefix64);
  }

  // X-Forwarded-For contains a chain of IPs, first is the client
  // Only trust if explicitly opted in (default false).
  if (trustXForwardedFor) {
    const xForwardedFor = request.headers.get('X-Forwarded-For');
    if (xForwardedFor) {
      const firstIp = xForwardedFor.split(',')[0];
      if (firstIp) {
        return normalizeIp(firstIp.trim(), ipv6Prefix64);
      }
    }
  }

  return 'unknown';
}

/**
 * Normalize an IP address for consistent comparison.
 *
 * Converts to lowercase so IPv6 addresses with mixed-case hex digits
 * (e.g. `2001:DB8::1` vs `2001:db8::1`) produce identical rate-limit keys.
 */
function normalizeIp(ip: string, ipv6Prefix64: boolean): string {
  const normalized = ip.toLowerCase();
  if (!ipv6Prefix64) return normalized;

  const words = parseIpv6(normalized);
  if (!words) return normalized;

  // IPv4-mapped addresses describe individual IPv4 clients, not one /64.
  if (words.slice(0, 5).every((word) => word === 0) && words[5] === 0xffff) {
    return [words[6] >> 8, words[6] & 0xff, words[7] >> 8, words[7] & 0xff].join('.');
  }

  const network = [...words.slice(0, 4), 0, 0, 0, 0];
  // RFC 5952: compress the longest zero run, preferring the first on ties.
  let bestStart = 0;
  let bestLength = 0;
  for (let start = 0; start < network.length; start++) {
    if (network[start] !== 0) continue;
    let end = start;
    while (end < network.length && network[end] === 0) end++;
    if (end - start > bestLength) {
      bestStart = start;
      bestLength = end - start;
    }
    start = end - 1;
  }
  const before = network
    .slice(0, bestStart)
    .map((word) => word.toString(16))
    .join(':');
  const after = network
    .slice(bestStart + bestLength)
    .map((word) => word.toString(16))
    .join(':');
  return `${before}::${after}`;
}

/** Parse a complete IPv6 literal; never accept a partially parsed address. */
function parseIpv6(ip: string): number[] | null {
  if (!ip.includes(':')) return null;
  let hex = ip;
  if (ip.includes('.')) {
    const lastColon = ip.lastIndexOf(':');
    const octets = ip.slice(lastColon + 1).split('.');
    if (
      octets.length !== 4 ||
      octets.some((octet) => !/^(0|[1-9][0-9]{0,2})$/.test(octet) || Number(octet) > 255)
    )
      return null;
    const bytes = octets.map(Number);
    hex = `${ip.slice(0, lastColon + 1)}${((bytes[0] << 8) | bytes[1]).toString(16)}:${((bytes[2] << 8) | bytes[3]).toString(16)}`;
  }

  const halves = hex.split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const explicit = [...left, ...right];
  if (explicit.some((word) => !/^[0-9a-f]{1,4}$/.test(word))) return null;
  // A compression marker must replace at least one word; otherwise exactly eight.
  if (halves.length === 2 ? explicit.length >= 8 : explicit.length !== 8) return null;
  return [
    ...left.map((word) => parseInt(word, 16)),
    ...Array<number>(8 - explicit.length).fill(0),
    ...right.map((word) => parseInt(word, 16)),
  ];
}
