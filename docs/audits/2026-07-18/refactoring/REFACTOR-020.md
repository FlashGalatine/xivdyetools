# [REFACTOR-020]: `estimateTextWidth` CJK detection misses fullwidth forms and Hangul Jamo

## Priority
LOW

## Category
Correctness of layout heuristic / i18n coverage

## Location
`packages/svg/src/base.ts:322-334` (`estimateTextWidth`); layout consumer: `packages/svg/src/dye-info-card.ts:121` (category badge sizing)

## Current State
`estimateTextWidth` doubles the width contribution of characters it classifies as CJK:

```ts
// packages/svg/src/base.ts:325-332
const isCJK =
  (code >= 0x3000 && code <= 0x9fff) ||   // CJK symbols, kana, Unified Ideographs
  (code >= 0xac00 && code <= 0xd7af) ||   // Hangul syllables
  (code >= 0xf900 && code <= 0xfaff);     // CJK Compatibility Ideographs
width += isCJK ? charWidth * 2 : charWidth;
```

## Issues
The range list omits blocks that render full-width in the bundled Noto CJK subsets and appear routinely in localized strings:

1. **Halfwidth and Fullwidth Forms (U+FF00-U+FFEF)** — fullwidth punctuation and alphanumerics ubiquitous in Japanese/Chinese text: `：`, `（）`, `！`, `Ａ-Ｚ`, `０-９`. These are counted at 1× width.
2. **Hangul Jamo (U+1100-U+11FF)** and **Hangul Compatibility Jamo (U+3130-U+318F** — partially covered by the 0x3000 range start but Jamo proper is not).
3. Conversely, the halfwidth katakana subrange inside U+FF00-FFEF (U+FF61-FF9F) is genuinely narrow — a blanket 2× for the block would slightly *over*-estimate those; acceptable for a heuristic, or excluded explicitly.

Concrete effect: `dye-info-card.ts:121` sizes the category badge as `estimateTextWidth(displayCategory, 8) + 20`. A localized category containing fullwidth punctuation or Jamo is under-measured, so the badge rectangle is too narrow and the centered text overflows its rounded background in the rendered PNG.

## Proposed Refactoring
Extend the wide ranges (and optionally carve out halfwidth katakana):

```ts
const isWide =
  (code >= 0x1100 && code <= 0x11ff) ||   // Hangul Jamo
  (code >= 0x3000 && code <= 0x9fff) ||   // existing
  (code >= 0xac00 && code <= 0xd7af) ||   // existing
  (code >= 0xf900 && code <= 0xfaff) ||   // existing
  (code >= 0xff00 && code <= 0xff60) ||   // Fullwidth forms (excl. halfwidth kana)
  (code >= 0xffe0 && code <= 0xffe6);     // Fullwidth signs (￠￡￥ etc.)
```
Rename the local flag to `isWide` (it is a width class, not a script test).

## Benefits
- Category badges and any future `estimateTextWidth` consumers size correctly for ja/zh/ko strings containing fullwidth punctuation — the exact locales the CJK font work (per project memory) was done to support.
- One-line-class change; keeps the deliberately simple heuristic (no font metrics dependency).

## Effort Estimate
Trivial — minutes, plus a couple of unit cases (`'色：赤'`, `'（テスト）'`, Jamo string) asserting doubled width.

## Risk Assessment
Very low. Widths only grow for the added ranges → badges get slightly wider, never clipping-inducing narrower. Pure-ASCII and existing-CJK measurements are unchanged.

> Source: evidence/shared-packages-analysis.md (2026-07-18 deep-dive, shared-packages area)
