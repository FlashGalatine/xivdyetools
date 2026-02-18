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
 * // Bot auth headers with signature
 * const botHeaders = await authHeadersWithSignature(
 *   'bot-token',
 *   'user-id',
 *   'username'
 * );
 *
 * // Use in requests
 * const response = await fetch('/api/protected', { headers });
 * ```
 */

import { createBotSignature, TEST_SIGNING_SECRET } from './signature.js';

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
  userName?: string
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

/**
 * Creates auth headers with HMAC signature for bot authentication
 *
 * @param token - The bot API token
 * @param userId - Discord user ID (optional)
 * @param userName - Discord username (optional)
 * @param signingSecret - The signing secret (defaults to TEST_SIGNING_SECRET)
 * @returns Headers object with signature
 */
export async function authHeadersWithSignature(
  token: string,
  userId?: string,
  userName?: string,
  signingSecret: string = TEST_SIGNING_SECRET
): Promise<Record<string, string>> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const userIdStr = userId ?? '';
  const userNameStr = userName ?? '';

  const signature = await createBotSignature(
    timestamp,
    userIdStr,
    userNameStr,
    signingSecret
  );

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'X-Request-Signature': signature,
    'X-Request-Timestamp': timestamp,
  };

  if (userId) {
    headers['X-User-Discord-ID'] = userId;
  }

  if (userName) {
    headers['X-User-Discord-Name'] = userName;
  }

  return headers;
}

/**
 * Creates JSON content headers
 *
 * @returns Headers object with Content-Type: application/json
 */
export function jsonHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
  };
}

/**
 * Merges multiple header objects
 *
 * @param headerObjects - Header objects to merge
 * @returns Merged headers object
 */
export function mergeHeaders(
  ...headerObjects: Record<string, string>[]
): Record<string, string> {
  return Object.assign({}, ...headerObjects);
}

/**
 * Creates authenticated JSON request headers
 *
 * @param token - The bearer token
 * @param userId - Optional Discord user ID
 * @param userName - Optional Discord username
 * @returns Headers object with auth and content-type
 */
export function authenticatedJsonHeaders(
  token: string,
  userId?: string,
  userName?: string
): Record<string, string> {
  return mergeHeaders(jsonHeaders(), authHeaders(token, userId, userName));
}
