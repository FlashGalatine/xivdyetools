/**
 * Rate-limit key scope redaction
 *
 * 2026-08-29 FINDING-010: the `key` passed to `RateLimiter.check()` is a
 * client IP (`getClientIp()`) or a Discord user id — exactly the kind of
 * per-client identifier `apps/web-app/PRIVACY.md` promises is never
 * collected. Every backend logs the key on its fail-open / backend-error
 * path so an operator can see the limiter is degraded, which put that
 * promise's contents into `wrangler tail` and, once Workers Logs is
 * enabled on a script, a retained log store.
 *
 * `scopeRateLimitKey()` is the one place that trade-off gets made, so the
 * six call sites (`middleware/rate-limit.ts` x2, and the fail-open paths of
 * the three fallible backends) cannot drift apart on what "safe to log"
 * means. The property that matters: a caller reading the log line learns
 * *which bucket class* failed (the public IP limiter, the Discord command
 * limiter, …) and nothing about *which client*.
 *
 * Do NOT widen this to return a hash of the key. A hashed IP is still an
 * IP-shaped identifier — the digest is stable per client, so two log lines
 * for the same caller can still be correlated. That correlation is exactly
 * the capability this function declines to provide, not an implementation
 * detail of how it declines to provide it.
 */

/**
 * A Discord snowflake is 17-19 decimal digits today (64-bit id, epoch
 * 2015-01-01). Widened a little on both sides so a length change upstream
 * doesn't silently stop being recognised as an id shape.
 */
const SNOWFLAKE_RE = /^\d{15,20}(?::|$)/;

/** Loose IPv4 shape — enough to name the bucket, not to validate an address. */
const IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/;

/** Loose IPv6 shape (hex groups joined by `:`, `::` compression allowed). */
const IPV6_RE = /^[0-9a-f]{0,4}(:[0-9a-f]{0,4}){2,7}$/i;

/**
 * Classify a bare (unprefixed) rate-limit key by shape, without ever
 * returning the key — or any substring of it — itself.
 */
function classifyBareKey(key: string): string {
  if (!key) {
    return 'empty';
  }
  if (key === 'unknown') {
    // getClientIp()'s own sentinel for "no CF-Connecting-IP header" — this
    // is not per-client, so it is already safe to pass through unchanged.
    return 'unknown';
  }
  if (IPV4_RE.test(key) || IPV6_RE.test(key)) {
    return 'ip';
  }
  if (SNOWFLAKE_RE.test(key)) {
    return 'id';
  }
  return 'unscoped';
}

/**
 * Reduce a rate-limit key to a short, non-identifying scope string that is
 * safe to place in a log line.
 *
 * @param key - The raw key as passed to `RateLimiter.check()` (or
 *   `checkOnly()`), e.g. `getClientIp(request)` or a Discord user id.
 * @param keyPrefix - The backend's own configured `keyPrefix`, if any (e.g.
 *   `'public:ip:'`). This string is chosen by the deploying code, never
 *   derived from request data, so it is always safe to log verbatim — when
 *   it is present (after trimming its trailing `:`/`|` separator) it already
 *   answers "which bucket class", and `key` is discarded entirely without
 *   inspecting it. When absent (or `''`, e.g. `CloudflareRateLimiter`'s
 *   default), `key` is classified by shape instead — see
 *   {@link classifyBareKey}.
 * @returns A short, non-empty, non-identifying scope string. Never equal to
 *   the raw key and never a hash of it.
 */
export function scopeRateLimitKey(key: string, keyPrefix?: string): string {
  const scope = keyPrefix?.replace(/[:|]+$/, '');
  return scope ? scope : classifyBareKey(key);
}
