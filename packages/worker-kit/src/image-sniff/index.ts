/**
 * @xivdyetools/worker-kit/image-sniff
 *
 * Magic-byte image format detection — PNG, JPEG, GIF, WebP and BMP — with no
 * Hono or Workers dependency, so a route can identify an upload by its content
 * instead of trusting the declared `Content-Type`.
 *
 * REFACTOR-008 (docs/audits/2026-09-16-deep-dive) — `apps/image-worker`'s table
 * is the source of truth; the second, three-format copy in `apps/presets-api`
 * is retired against this one.
 *
 * @example
 * ```typescript
 * import { sniffImageType } from '@xivdyetools/worker-kit/image-sniff';
 *
 * const kind = sniffImageType(bytes, ['png', 'jpeg', 'webp']);
 * if (kind === null) return reject('Unsupported image format');
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
// consumers: `apps/presets-api` and `apps/image-worker` adopt it in Sprint 16
// of the 2026-09-16 deep-dive remediation. Drop the tag from each specifier as
// its in-repo consumer lands.

export {
  /** @public — consumed by Sprint 16 */
  detectImageFormat,
  /** @public — consumed by Sprint 16 */
  sniffImageType,
  /** @public — consumed by Sprint 16 */
  IMAGE_MAGIC_BYTES,
  /** @public — consumed by Sprint 16 */
  type ImageFormat,
} from './detect.js';
