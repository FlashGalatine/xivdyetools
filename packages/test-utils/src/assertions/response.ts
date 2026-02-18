/**
 * Response assertion helpers for API testing
 *
 * Provides utilities for asserting HTTP response status and body.
 *
 * @example
 * ```typescript
 * const response = await app.request('/api/presets');
 *
 * // Assert status and get typed body
 * const body = await assertJsonResponse<{ presets: Preset[] }>(response, 200);
 * expect(body.presets).toHaveLength(1);
 *
 * // Assert error response
 * const error = await assertErrorResponse(response, 400);
 * expect(error.error).toBe('Validation failed');
 * ```
 */

// Note: We use a dynamic import approach to avoid hard dependency on vitest
// Tests should import { expect } from 'vitest' separately

/**
 * Assert response has expected status and return JSON body
 *
 * @param response - The Response object
 * @param expectedStatus - Expected HTTP status code
 * @returns The parsed JSON body
 * @throws If status doesn't match
 */
export async function assertJsonResponse<T>(
  response: Response,
  expectedStatus: number
): Promise<T> {
  if (response.status !== expectedStatus) {
    const body = await response.text();
    throw new Error(
      `Expected status ${expectedStatus}, got ${response.status}. Body: ${body}`
    );
  }

  return response.json() as Promise<T>;
}

/**
 * Error response shape
 */
export interface ErrorResponse {
  error: string;
  code?: string;
  details?: Record<string, unknown>;
}

/**
 * Assert response is an error with expected status
 *
 * @param response - The Response object
 * @param expectedStatus - Expected HTTP status code
 * @returns The parsed error body
 * @throws If status doesn't match
 */
export async function assertErrorResponse(
  response: Response,
  expectedStatus: number
): Promise<ErrorResponse> {
  return assertJsonResponse<ErrorResponse>(response, expectedStatus);
}

/**
 * Assert response is OK (2xx status)
 *
 * @param response - The Response object
 * @returns The parsed JSON body
 * @throws If status is not 2xx
 */
export async function assertOkResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Expected OK response, got ${response.status}. Body: ${body}`
    );
  }

  return response.json() as Promise<T>;
}

/**
 * Assert response is a redirect
 *
 * @param response - The Response object
 * @param expectedLocation - Optional expected Location header value
 * @returns The Location header value
 * @throws If not a redirect or location doesn't match
 */
export function assertRedirectResponse(
  response: Response,
  expectedLocation?: string
): string {
  const redirectStatuses = [301, 302, 303, 307, 308];

  if (!redirectStatuses.includes(response.status)) {
    throw new Error(
      `Expected redirect status (3xx), got ${response.status}`
    );
  }

  const location = response.headers.get('Location');

  if (!location) {
    throw new Error('Expected Location header in redirect response');
  }

  if (expectedLocation && location !== expectedLocation) {
    throw new Error(
      `Expected location "${expectedLocation}", got "${location}"`
    );
  }

  return location;
}

/**
 * Assert response has specific headers
 *
 * @param response - The Response object
 * @param expectedHeaders - Headers to check
 * @throws If any header is missing or doesn't match
 */
export function assertHeaders(
  response: Response,
  expectedHeaders: Record<string, string>
): void {
  for (const [key, value] of Object.entries(expectedHeaders)) {
    const actual = response.headers.get(key);
    if (actual !== value) {
      throw new Error(
        `Expected header "${key}" to be "${value}", got "${actual}"`
      );
    }
  }
}

/**
 * Assert response has CORS headers
 *
 * @param response - The Response object
 * @param origin - Expected allowed origin
 */
export function assertCorsHeaders(response: Response, origin?: string): void {
  const acao = response.headers.get('Access-Control-Allow-Origin');

  if (!acao) {
    throw new Error('Expected Access-Control-Allow-Origin header');
  }

  if (origin && acao !== origin && acao !== '*') {
    throw new Error(
      `Expected CORS origin "${origin}" or "*", got "${acao}"`
    );
  }
}

/**
 * Assert response is JSON content type
 *
 * @param response - The Response object
 * @throws If Content-Type is not application/json
 */
export function assertJsonContentType(response: Response): void {
  const contentType = response.headers.get('Content-Type');

  if (!contentType?.includes('application/json')) {
    throw new Error(
      `Expected Content-Type application/json, got "${contentType}"`
    );
  }
}
