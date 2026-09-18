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

// `apps/image-worker` (Sprint 15) and `apps/presets-api` (Sprint 16) consume the
// two functions; the raw table is `@public` because nothing in-repo imports it by
// name (its own test does, which knip counts as an entry — not a justification).

export {
  detectImageFormat,
  sniffImageType,
  /** @public — the published table; in-repo consumers reach it only through detectImageFormat */
  IMAGE_MAGIC_BYTES,
  type ImageFormat,
} from './detect.js';
