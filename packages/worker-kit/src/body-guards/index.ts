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
// Everything here is tagged because this subpath shipped ahead of its
// consumers: `apps/oauth` adopts it in Sprint 14 and `apps/presets-api` in
// Sprint 16 of the 2026-09-16 deep-dive remediation. Drop the tag from each
// specifier as its in-repo consumer lands.
//
// Only `BodyGuardsOptions`, `BodyGuardResponder`, `InvalidJsonResponder` and
// `BodyGuardExemption` make knip fail today — the others are already "used" by
// this module's own test file, which knip counts as an entry. That is an
// artifact of how knip sees tests, not evidence that those four are more
// public than the rest, so every specifier carries the tag.

export { /** @public — consumed by Sprint 14 and Sprint 16 */ bodyGuards } from './body-guards.js';

export type {
  /** @public — consumed by Sprint 14 and Sprint 16 */
  BodyGuardsOptions,
  /** @public — consumed by Sprint 14 and Sprint 16 */
  BodyGuardMiddleware,
  /** @public — consumed by Sprint 14 and Sprint 16 */
  BodyGuardResponder,
  /** @public — consumed by Sprint 14 and Sprint 16 */
  InvalidJsonResponder,
  /** @public — consumed by Sprint 16 (the preview-image upload route) */
  BodyGuardExemption,
} from './types.js';
