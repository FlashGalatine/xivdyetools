/**
 * JWT Revocation Utilities (KV-backed jti blacklist)
 *
 * REFACTOR-001 (2026-07-18 audit): moved from the oauth worker so revocation
 * lives beside the verification primitives it complements. Uses a structural
 * KV type so the package stays runtime-agnostic (no hard dependency on
 * @cloudflare/workers-types).
 *
 * @module revocation
 */

/**
 * How long past `exp` a token may still be presented to a refresh endpoint.
 *
 * FINDING-001 (2026-08-21 security audit): this constant is shared by BOTH
 * sides of the revocation contract. `/auth/refresh` must not honour a token
 * that is older than `exp + REFRESH_GRACE_SECONDS`, and `revokeToken()` keeps
 * the blacklist entry alive for exactly that long — otherwise a revoked
 * token becomes refreshable the moment it expires (the blacklist entry is
 * gone but the refresh grace window is still open).
 *
 * 15 minutes comfortably covers clock skew and in-flight requests; the old
 * 24 h window turned every leaked 1 h token into a day-long re-mint ticket.
 */
export const REFRESH_GRACE_SECONDS = 15 * 60;

/**
 * Minimal structural interface for the revocation store.
 * Cloudflare's KVNamespace satisfies this.
 */
export interface RevocationStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

/** Options for {@link revokeToken}. */
export interface RevokeTokenOptions {
  /**
   * Seconds past `expiresAt` during which the token must still be treated as
   * revoked. Defaults to {@link REFRESH_GRACE_SECONDS}; only override it when
   * the refresh endpoint's grace window is overridden to the same value.
   */
  graceSeconds?: number;
}

/**
 * Check if a token has been revoked.
 *
 * Intentionally fail-open: a store error returns `false` (token not revoked)
 * rather than throwing or blocking the request. This keeps auth functional
 * during KV outages at the cost of briefly allowing a revoked token through.
 * Callers that require strict revocation must handle store unavailability
 * separately.
 */
export async function isTokenRevoked(
  jti: string,
  store: RevocationStore | undefined
): Promise<boolean> {
  if (!store || !jti) return false;

  try {
    const revoked = await store.get(`revoked:${jti}`);
    return revoked !== null;
  } catch {
    return false;
  }
}

/**
 * Revoke a token by adding its JTI to the blacklist.
 *
 * TTL = remaining token lifetime + the refresh grace window (FINDING-001), so
 * the entry outlives every moment at which the token could still be accepted
 * — by `verifyJWT` (until `exp`) or by a grace-period refresh (until
 * `exp + graceSeconds`). Entries still auto-clean afterwards.
 *
 * @returns true if the revocation was recorded
 */
export async function revokeToken(
  jti: string,
  expiresAt: number,
  store: RevocationStore | undefined,
  options: RevokeTokenOptions = {}
): Promise<boolean> {
  if (!store || !jti) return false;

  const graceSeconds = options.graceSeconds ?? REFRESH_GRACE_SECONDS;

  try {
    const now = Math.floor(Date.now() / 1000);
    const ttl = Math.max(expiresAt + graceSeconds - now, 60); // Minimum 60 seconds
    await store.put(`revoked:${jti}`, '1', { expirationTtl: ttl });
    return true;
  } catch {
    return false;
  }
}
