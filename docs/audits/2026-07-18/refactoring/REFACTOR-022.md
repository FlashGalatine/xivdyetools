# [REFACTOR-022]: accessibility-comparison labels hardcoded in English while sibling generators are localizable

## Priority
LOW

## Category
i18n consistency across the SVG package

## Location
`packages/svg/src/accessibility-comparison.ts:86-107` (`VISION_LABELS` constant); pattern to mirror: `PaletteGridLabels` in `packages/svg/src/palette-grid.ts:92-118`, `BudgetSvgLabels` in `packages/svg/src/budget-comparison.ts:83-114`, `startLabel`/`endLabel` in `packages/svg/src/gradient.ts:38-42`

## Current State
The ecosystem is 6-language (`en/ja/de/fr/ko/zh`), and the other SVG generators accept caller-supplied label objects so the Discord bot can render fully localized images. The accessibility comparison generator instead bakes its vision-type names and descriptions in as compile-time English constants:

```ts
// packages/svg/src/accessibility-comparison.ts:86-107
const VISION_LABELS: Record<AllVisionTypes, { label: string; description: string }> = {
  normal:       { label: 'Normal Vision',  description: 'Full color perception' },
  protanopia:   { label: 'Protanopia',     description: 'Red-blind (~1% of males)' },
  deuteranopia: { label: 'Deuteranopia',   description: 'Green-blind (~1% of males)' },
  tritanopia:   { label: 'Tritanopia',     description: 'Blue-blind (rare)' },
  achromatopsia:{ label: 'Achromatopsia',  description: 'Total colorblindness (very rare)' },
};
```
`AccessibilityComparisonOptions` (L50-59) exposes no labels field.

## Issues
1. A Japanese/Korean/Chinese user running `/accessibility` gets an image whose surrounding embed text is localized but whose card labels are English — a mixed-language artifact unique to this one generator.
2. The medical terms and prevalence notes ("~1% of males") are precisely the strings that benefit from translation; bot-i18n already carries locale infrastructure to supply them.
3. Inconsistency raises the cost of the eventual i18n pass: every other generator already follows the labels-object convention, so this one file is the odd one out.

## Proposed Refactoring
Mirror the established pattern with a backward-compatible optional field:

```ts
export type VisionLabels = Record<AllVisionTypes, { label: string; description: string }>;

export interface AccessibilityComparisonOptions {
  dyeHex: string;
  dyeName: string;
  visionTypes?: VisionType[];
  width?: number;
  /** Translated vision-type labels; defaults to English. */
  labels?: Partial<VisionLabels>;
}

// in the generator:
const labels: VisionLabels = { ...VISION_LABELS, ...options.labels };
```
Ensure the label/description text elements use `FONTS.primaryCjk` (as the other generators do for localized text) so supplied CJK strings actually render — verify against the existing font subsets per the project's CJK-subsetting constraints.

Then add the five keys to bot-i18n locale files and pass them from the discord-worker accessibility command.

## Benefits
- Fully localized accessibility cards; removes the last hardcoded-English generator in the package.
- Zero breaking change (labels optional, defaults preserved).

## Effort Estimate
Small — ~1 hour in the svg package; plus the usual locale-file additions (6 languages × 10 strings) and, if new CJK glyphs are introduced, a font re-subset check per project memory ("If new dyes are added, fonts need re-subsetting" applies to any new CJK strings).

## Risk Assessment
Very low for the package change (additive option, defaulted). The only operational caution is font-subset coverage for the new translated strings — a known, documented pipeline in this workspace.

> Source: evidence/shared-packages-analysis.md (2026-07-18 deep-dive, shared-packages area)
