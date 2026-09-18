/**
 * @xivdyetools/worker-kit/body-guards
 *
 * Request-body guards for Hono Workers: a streaming size cap (SEC-004) and a
 * JSON depth / prototype-pollution check (SEC-003), configured per Worker so
 * each keeps its own error envelope.
 *
 * REFACTOR-009 (docs/audits/2026-09-16-deep-dive) — extracted from the two
 * near-copies in `apps/oauth` and `apps/presets-api`.
 *
 * @example
 * ```typescript
 * import { bodyGuards } from '@xivdyetools/worker-kit/body-guards';
 *
 * const { bodySizeLimit, jsonDepthLimit } = bodyGuards<{ Bindings: Env }>({
 *   maxSize: 100 * 1024,
 *   onTooLarge: (c) =>
 *     c.json({ success: false, error: 'PAYLOAD_TOO_LARGE', message: '…' }, 413),
 *   onInvalidJson: (c, message) =>
 *     c.json({ success: false, error: 'BAD_REQUEST', message }, 400),
 *   exempt: {
 *     match: (c) => c.req.method === 'POST' && UPLOAD_PATH.test(c.req.path),
 *     maxSize: 5 * 1024 * 1024,
 *     onTooLarge: (c) =>
 *       c.json({ success: false, error: 'VALIDATION_ERROR', message: '…' }, 400),
 *   },
 * });
 * ```
 *
 * @packageDocumentation
 */

// A `@public` JSDoc tag on a specifier below means: published API, deliberately
// kept even though no workspace in this monorepo imports it. The root
// `knip.jsonc` gate (`pnpm run lint:dead`, part of `lint`) reports every
// untagged barrel export that nothing consumes, so a new export must either
// gain a consumer or be tagged on purpose — see root CLAUDE.md's Tooling →
// knip bullet and this repo's root `knip.jsonc`.
//
// `apps/oauth` (Sprint 14) and `apps/presets-api` (Sprint 16) consume
// `bodyGuards`. The four option types below keep the tag because consumers
// pass option literals and never import the type names, so knip would report
// them unused; `BodyGuardMiddleware` is reached through the factory's return
// type and needs none.

export { bodyGuards } from './body-guards.js';

export type {
  /** @public — option types of the published factory; consumers pass literals and import nothing */
  BodyGuardsOptions,
  BodyGuardMiddleware,
  /** @public */
  BodyGuardResponder,
  /** @public */
  InvalidJsonResponder,
  /** @public */
  BodyGuardExemption,
} from './types.js';
