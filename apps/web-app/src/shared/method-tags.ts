/**
 * Matching-method display tags — identifiers, never localised.
 *
 * Mirrors core's `MATCHING_METHOD_TAGS`. It is kept as a local copy rather
 * than re-exported from core so the tags stay available where core is
 * mocked or minimal — `components/__tests__/swatch-tool.test.ts` mocks
 * `@xivdyetools/core` wholesale, and the verdict card would break if reading
 * a display string reached into the real package.
 *
 * It lives here rather than inside `swatch-tool.ts` so the parity gate can
 * read it without importing a Lit element: pulling the component in just to
 * see one constant evaluates the whole custom-element module, which fails
 * outside a DOM setup.
 *
 * ⚠️ Being a copy, this drifts silently. Core 5.1.0 proved it — when
 * `getDeltaE_Oklab` became ΔEOK2 the canonical `oklab` tag moved and nothing
 * here would have noticed, so the verdict card would have printed `ΔEOK`
 * beside a number on the ΔEOK2 scale while the OG cards, which read core's
 * map, printed `ΔEOK2` for the same match.
 * `__tests__/method-tags.parity.test.ts` compares the two and fails on any
 * divergence, so the copy keeps its mock-resilience without the drift.
 *
 * RGB DIST and DISTINGUISH % stay untranslated identifiers by decision
 * (2026-08-20 i18n audit).
 */
import type { MatchingMethod } from '@shared/tool-config-types';

export const METHOD_TAGS: Record<MatchingMethod, string> = {
  ciede2000: 'ΔE2000',
  oklab: 'ΔEOK2',
  cie76: 'ΔE76',
  redmean: 'REDMEAN',
  rgb: 'RGB DIST',
  distinguish: 'DISTINGUISH %',
};
