/**
 * Request header builders for testing API authentication
 *
 * Provides helper functions to build authentication headers
 * for testing API endpoints.
 *
 * @example
 * ```typescript
 * // JWT auth headers
 * const headers = authHeaders(jwt);
 *
 * // Use in requests
 * const response = await fetch('/api/protected', { headers });
 * ```
 */

/**
 * Creates basic auth headers with a bearer token
 *
 * @param token - The bearer token (JWT or API key)
 * @param userId - Optional Discord user ID
 * @param userName - Optional Discord username
 * @returns Headers object
 */
export function authHeaders(
  token: string,
  userId?: string,
  userName?: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  if (userId) {
    headers['X-User-Discord-ID'] = userId;
  }

  if (userName) {
    headers['X-User-Discord-Name'] = userName;
  }

  return headers;
}
