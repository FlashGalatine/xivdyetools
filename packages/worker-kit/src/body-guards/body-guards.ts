/**
 * `bodyGuards()` — the shared request-body guard factory.
 *
 * SEC-003 (JSON depth limiting) + SEC-004 (body size limits), previously
 * duplicated as two near-identical middleware modules in `apps/oauth` and
 * `apps/presets-api` (REFACTOR-009, docs/audits/2026-09-16-deep-dive).
 *
 * @module
 */

import { bodyLimit } from 'hono/body-limit';
import type { Context, Env, MiddlewareHandler } from 'hono';
import { validateStructure } from './structure.js';
import type {
  BodyGuardExemption,
  BodyGuardMiddleware,
  BodyGuardResponder,
  BodyGuardsOptions,
} from './types.js';

/** Depth budget applied when a caller does not set one. */
const DEFAULT_MAX_DEPTH = 10;

/**
 * Methods whose bodies are structurally checked.
 *
 * DELETE and GET are excluded because neither consumer has ever accepted a
 * JSON body on them; widening this would change behaviour for both, so it is
 * deliberately not an option.
 */
const MUTATION_METHODS = ['POST', 'PATCH', 'PUT'];

/**
 * Build the size-limit middleware for one cap.
 *
 * Hono's `bodyLimit` is the engine on purpose: with a `Content-Length` header
 * (and no `Transfer-Encoding`) it decides on the header alone; without one it
 * counts the stream and cuts it at the cap, so an oversized chunked body is
 * refused while bytes arrive rather than after the whole thing has been
 * buffered (FINDING-004 / PAPI-3, 2026-08-21 security audit). A header that
 * understates the body is therefore trusted — a route that must not be lied
 * to keeps its own post-read backstop, as presets-api's upload does.
 */
function sizeGuard<E extends Env>(
  maxSize: number,
  onTooLarge: BodyGuardResponder<E>
): MiddlewareHandler<E> {
  return bodyLimit({
    maxSize,
    onError: (c: Context<E>) => onTooLarge(c),
  });
}

/**
 * Create the request body size guard and the JSON structure guard for one
 * Worker.
 *
 * Neither guard produces a response body of its own — every rejection is
 * rendered by a caller-supplied responder — so two Workers with different
 * error envelopes share one implementation without either changing a byte of
 * what it returns.
 *
 * @example
 * ```typescript
 * const { bodySizeLimit, jsonDepthLimit } = bodyGuards<{ Bindings: Env }>({
 *   maxSize: 10 * 1024,
 *   onTooLarge: (c) =>
 *     c.json({ error: 'Payload too large', message: 'Request body too large' }, 413),
 *   onInvalidJson: (c, message) =>
 *     c.json({ success: false, error: 'Invalid request body', message }, 400),
 * });
 *
 * app.use('/auth/*', bodySizeLimit);
 * app.use('/auth/*', jsonDepthLimit);
 * ```
 */
export function bodyGuards<E extends Env = Env>(
  options: BodyGuardsOptions<E>
): BodyGuardMiddleware<E> {
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const exemption: BodyGuardExemption<E> | undefined = options.exempt;

  const enforceDefaultSize = sizeGuard<E>(options.maxSize, options.onTooLarge);
  const enforceExemptSize = exemption
    ? sizeGuard<E>(exemption.maxSize, exemption.onTooLarge)
    : undefined;

  const bodySizeLimit: MiddlewareHandler<E> = (c, next) => {
    if (enforceExemptSize && exemption?.match(c)) {
      return enforceExemptSize(c, next);
    }
    return enforceDefaultSize(c, next);
  };

  const jsonDepthLimit: MiddlewareHandler<E> = async (c, next) => {
    if (!MUTATION_METHODS.includes(c.req.method)) {
      return next();
    }

    // An exempt request carries bytes this guard has nothing to say about.
    if (exemption?.match(c)) {
      return next();
    }

    const contentType = c.req.header('content-type');
    if (!contentType?.includes('application/json')) {
      return next();
    }

    // Read the body text — Hono caches this, so a downstream `c.req.json()`
    // still works.
    let text: string;
    try {
      text = await c.req.text();
    } catch {
      return next();
    }

    if (!text) {
      return next();
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return options.onInvalidJson(c, 'Invalid JSON syntax');
    }

    const error = validateStructure(parsed, maxDepth, 0);
    if (error) {
      return options.onInvalidJson(c, error);
    }

    await next();
  };

  return { bodySizeLimit, jsonDepthLimit };
}
