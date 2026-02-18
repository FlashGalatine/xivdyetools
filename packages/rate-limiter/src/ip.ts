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
   * @default true
   */
  trustXForwardedFor?: boolean;
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
 * // Default: trusts X-Forwarded-For as fallback
 * const ip = getClientIp(request);
 *
 * // Strict: only trusts CF-Connecting-IP
 * const ip = getClientIp(request, { trustXForwardedFor: false });
 * ```
 */
export function getClientIp(
  request: Request,
  options: GetClientIpOptions = {}
): string {
  const { trustXForwardedFor = true } = options;

  // Cloudflare's CF-Connecting-IP is the true client IP
  const cfIp = request.headers.get('CF-Connecting-IP');
  if (cfIp) {
    return normalizeIp(cfIp.trim());
  }

  // X-Forwarded-For contains a chain of IPs, first is the client
  // FINDING-003: Only trust if explicitly opted in (default true for compat)
  if (trustXForwardedFor) {
    const xForwardedFor = request.headers.get('X-Forwarded-For');
    if (xForwardedFor) {
      const firstIp = xForwardedFor.split(',')[0];
      if (firstIp) {
        return normalizeIp(firstIp.trim());
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
function normalizeIp(ip: string): string {
  return ip.toLowerCase();
}
