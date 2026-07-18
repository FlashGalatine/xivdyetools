# [REFACTOR-009]: og-worker's `services/svg/base.ts` is a drifted fork of `@xivdyetools/svg` — consolidate on the package

## Priority

MEDIUM

## Category

Duplication / drift between app-local code and a published workspace package

## Location

- `apps/og-worker/src/services/svg/base.ts` (entire file, ~260 lines) vs `packages/svg/src/base.ts`
- Third copy of color helpers: `apps/og-worker/src/services/svg/mixer.ts:50-64` (`hexToRgb`, `rgbToHex` re-implemented again)
- Font-name duplication: `apps/og-worker/src/services/fonts.ts:67-78` (`FONT_FAMILIES`) vs `base.ts:245-251` (`FONTS`)
- Drift symptom sites: `apps/og-worker/src/services/svg/harmony.ts:295-296`, `swatch.ts:262-263`, `gradient.ts:187-188` (naive `.length` truncation)

## Current State

og-worker ships its own `escapeXml`, `hexToRgb`, `rgbToHex`, `getLuminance`, `getContrastTextColor`, `createSvgDocument`, `rect`, `circle`, `line`, `text`, `group`, `linearGradient`, `THEME`, `FONTS` — byte-for-byte (or near) duplicates of `@xivdyetools/svg`'s `base.ts`. og-worker does **not** depend on the package.

## Issues

1. **Functional drift already exists:** the package gained CJK-aware `estimateTextWidth` / `truncateText` (CJK glyphs counted at ~2× width, proper ellipsis); og-worker's generators still truncate localized dye names by raw character count:

   ```ts
   // harmony.ts:295-296
   const truncatedName =
     matchDisplayName.length > 14 ? matchDisplayName.slice(0, 12) + '..' : matchDisplayName;
   ```

   A 10-character Japanese name is roughly twice the pixel width of a 10-char Latin name, so CJK names overflow their 110 px swatch columns in OG images — while the Discord bot (which uses the package) truncates correctly.
2. Every future THEME/FONTS/primitive change must be made twice (three times counting mixer.ts's private copies), and only the package copy has the package's test coverage.
3. `FONTS` (base.ts) and `FONT_FAMILIES` (fonts.ts) encode the same family names independently — a rename desyncs SVG output from loaded font buffers.

## Proposed Refactoring

1. Add `"@xivdyetools/svg": "workspace:*"` to og-worker.
2. Delete `apps/og-worker/src/services/svg/base.ts`; re-export what generators need from the package (family names already match: `Onest`, `Space Grotesk`, `Habibi`, CJK fallbacks).
3. Replace all `.length`-based truncation with the package's `truncateText` / `estimateTextWidth`.
4. Delete mixer.ts's private `hexToRgb`/`rgbToHex`; import from the package (or `@xivdyetools/core`'s `ColorService`).
5. Collapse `FONT_FAMILIES` to re-export the package's `FONTS` (single source for family names).

The og-specific layout modules (`og-card.ts`, per-tool generators) remain local — only the primitives layer moves.

## Benefits

- Fixes the CJK-overflow rendering defect for ja/ko/zh dye names as a side effect.
- One source of truth for SVG primitives/theme/fonts across discord-worker, stoat-worker, and og-worker; og-worker inherits package tests and future fixes.
- Removes ~300 duplicated lines.

## Effort Estimate

Small-Medium (half a day): dependency add, mechanical import swap, truncation call-site updates, re-run og-worker snapshot tests (expect intentional diffs where CJK truncation improves).

## Risk Assessment

Low. Function signatures are identical; visual output changes only where truncation behavior improves (verify via existing SVG snapshot tests + a manual render of a ja/ko/zh swatch card). Bundle size unchanged (same code, one copy).

> Source: evidence/edge-workers-analysis.md (2026-07-18 deep-dive, edge-workers area)
