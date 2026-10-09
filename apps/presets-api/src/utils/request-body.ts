/**
 * Reading a JSON request body that must be an object.
 *
 * BUG-064 (2026-10-04 deep-dive): `c.req.json()` resolves to whatever the body
 * parses to — `null`, an array, a string, a number — and `jsonDepthLimit` lets
 * all of them through. Every handler that reads fields off the result (`body.name`,
 * `body.status`, `body.reason`) then threw a TypeError on `null`, which the
 * global onError answered as an opaque 500. A body that is valid JSON but not
 * an object is as unusable as one that does not parse, so it gets the same answer.
 */

import type { Context } from 'hono';

/**
 * Parse the request body as a JSON object.
 *
 * @returns the parsed object, or `null` when the body does not parse or is not
 *   a plain JSON object (`null`, an array or a scalar) — answer that with
 *   `invalidJsonResponse`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- any Hono app's context, as api-response.ts takes
export async function readJsonObject<T extends object>(c: Context<any, any, any>): Promise<T | null> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return null;
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return null;
  }
  return body as T;
}
