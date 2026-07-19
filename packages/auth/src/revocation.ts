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
 * Minimal structural interface for the revocation store.
 * Cloudflare's KVNamespace satisfies this.
 */
export interface RevocationStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
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
 * TTL matches token expiry so entries auto-cleanup once the token would have
 * expired naturally.
 *
 * @returns true if the revocation was recorded
 */
export async function revokeToken(
  jti: string,
  expiresAt: number,
  store: RevocationStore | undefined
): Promise<boolean> {
  if (!store || !jti) return false;

  try {
    const now = Math.floor(Date.now() / 1000);
    const ttl = Math.max(expiresAt - now, 60); // Minimum 60 seconds
    await store.put(`revoked:${jti}`, '1', { expirationTtl: ttl });
    return true;
  } catch {
    return false;
  }
}
