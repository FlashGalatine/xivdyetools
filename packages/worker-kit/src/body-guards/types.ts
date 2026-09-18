/**
 * Types for the request-body guard factory.
 *
 * REFACTOR-009 (docs/audits/2026-09-16-deep-dive): `apps/oauth` and
 * `apps/presets-api` each carried a near-copy of the same two middleware. The
 * only things that actually differed between them were the size cap, the
 * response bodies, and presets-api's single exempt route — so every one of
 * those is an option here and nothing else is.
 *
 * @module
 */

import type { Context, Env, MiddlewareHandler } from 'hono';

/**
 * Builds the response for a request the guards reject on size.
 *
 * The factory never invents a body: the consumer owns the status code and the
 * exact JSON shape, which is what lets two workers with different error
 * envelopes share one implementation.
 */
export type BodyGuardResponder<E extends Env = Env> = (
  c: Context<E>
) => Response | Promise<Response>;

/**
 * Builds the response for a body that is not parseable JSON, or whose
 * structure fails the depth / prototype-pollution check.
 *
 * `message` is `'Invalid JSON syntax'` for a parse failure, otherwise the
 * structure validator's own message (`'Invalid JSON structure'` or
 * `` `JSON nesting exceeds maximum depth of ${maxDepth}` ``).
 */
export type InvalidJsonResponder<E extends Env = Env> = (
  c: Context<E>,
  message: string
) => Response | Promise<Response>;

/**
 * One request shape that is allowed a different body-size cap, and that the
 * JSON depth guard skips entirely.
 *
 * Declared as data rather than a per-request factory so the underlying
 * `bodyLimit()` middleware is constructed once, and so the depth guard can ask
 * the single `match` question without building a size limit it would discard.
 */
export interface BodyGuardExemption<E extends Env = Env> {
  /** True for the request shape that is exempt (e.g. a binary upload route). */
  match: (c: Context<E>) => boolean;
  /** The size cap, in bytes, that applies instead of the default one. */
  maxSize: number;
  /** The response for an exempt request that exceeds {@link BodyGuardExemption.maxSize}. */
  onTooLarge: BodyGuardResponder<E>;
}

/** Options for {@link bodyGuards}. */
export interface BodyGuardsOptions<E extends Env = Env> {
  /** Default maximum request body size, in bytes. */
  maxSize: number;
  /** Maximum JSON nesting depth. Defaults to 10. */
  maxDepth?: number;
  /** The response for a request that exceeds {@link BodyGuardsOptions.maxSize}. */
  onTooLarge: BodyGuardResponder<E>;
  /** The response for unparseable or structurally invalid JSON. */
  onInvalidJson: InvalidJsonResponder<E>;
  /** Optional single exempt request shape — a different cap, and no JSON check. */
  exempt?: BodyGuardExemption<E>;
}

/**
 * The two middleware {@link bodyGuards} returns. They are separate because
 * both consumers mount them as two `app.use()` calls, and because the size
 * guard must be able to run on routes the depth guard has nothing to say about.
 */
export interface BodyGuardMiddleware<E extends Env = Env> {
  /** Rejects oversized bodies (Content-Length first, then the stream). */
  bodySizeLimit: MiddlewareHandler<E>;
  /** Rejects malformed / over-deep / prototype-polluting JSON on mutations. */
  jsonDepthLimit: MiddlewareHandler<E>;
}
