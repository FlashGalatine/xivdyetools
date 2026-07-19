# [REFACTOR-004]: Match-quality thresholds duplicated 4× with inconsistent boundary semantics

## Priority
MEDIUM

## Category
Cross-package duplication / magic values / behavioral inconsistency

## Location
- `packages/bot-logic/src/color-math.ts:54-61` — `QUALITY_TIERS`, matched with `distance <= maxDistance` (L76)
- `packages/svg/src/palette-grid.ts:50-68` — exported `MATCH_QUALITIES` + `getMatchQuality`, matched with `<=` (L63)
- `packages/svg/src/palette-grid.ts:392-398` — a **second inline copy in the same file** using `<`
- `packages/svg/src/budget-comparison.ts:163-169` — `getDistanceQualityKey` using `<`

## Current State
The RGB-distance quality tiers (perfect = 0, excellent ≤ 10, good ≤ 25, fair ≤ 50, approximate beyond) are hardcoded in four places across two packages, using two different comparison operators:

```ts
// bot-logic/color-math.ts:54-59  — inclusive (<=)
const QUALITY_TIERS = [
  { maxDistance: 0,  info: { key: 'perfect', ... } },
  { maxDistance: 10, info: { key: 'excellent', ... } },
  ...
];
// matched: if (distance <= maxDistance) return info;

// svg/budget-comparison.ts:163-169 — exclusive (<)
function getDistanceQualityKey(distance: number) {
  if (distance === 0) return 'perfect';
  if (distance < 10) return 'excellent';
  if (distance < 25) return 'good';
  if (distance < 50) return 'fair';
  return 'approximate';
}
```

## Issues
1. **Observable inconsistency at boundaries:** a distance of exactly **10** is "excellent" per bot-logic and palette-grid's exported `getMatchQuality`, but "good" per budget-comparison and palette-grid's inline copy; likewise at 25 and 50. A Discord embed (labeled via bot-logic) and its attached image (labeled via svg) can disagree about the *same* match in the *same* response.
2. **Four maintenance points** for one product decision; a future threshold tune (e.g. switching to Delta-E) must be applied identically in four spots, with no compiler assistance.
3. `palette-grid.ts` contradicts *itself* — the exported helper and the inline badge logic in one file use different operators.

## Proposed Refactoring
Create a single source of truth and delete the copies:

1. Define the tiers once — either in `@xivdyetools/bot-logic` (svg → bot-logic is acyclic: bot-logic → core/types; svg → core/types) or, for maximal neutrality, alongside color types in `@xivdyetools/types`:
   ```ts
   export const MATCH_QUALITY_TIERS = [
     { key: 'perfect',     maxDistance: 0 },
     { key: 'excellent',   maxDistance: 10 },
     { key: 'good',        maxDistance: 25 },
     { key: 'fair',        maxDistance: 50 },
     { key: 'approximate', maxDistance: Infinity },
   ] as const;
   export function classifyMatchDistance(d: number): MatchQualityKey { /* <= semantics */ }
   ```
2. Re-export display metadata (emoji, shortLabel) per package where presentation differs, keyed by the shared `key`.
3. Standardize on `<=` (bot-logic's current semantics) and document the choice; add boundary tests at 0, 10, 25, 50.

## Benefits
- Embed text and generated images always agree on quality labels.
- One place to tune thresholds or migrate the distance metric.
- Removes ~40 duplicated lines and a same-file self-contradiction.

## Effort Estimate
Small — ~1-2 hours: add shared constant + classifier, swap four call sites, boundary tests, version bumps for the affected packages.

## Risk Assessment
Low. The only behavior change is at exact boundary values (10/25/50) for the three call sites currently using `<` — a one-tier label shift on knife-edge distances, invisible to users except as *increased* consistency. No API signatures change if the existing exported names are kept as thin wrappers.

> Source: evidence/shared-packages-analysis.md (2026-07-18 deep-dive, shared-packages area)

## Status

**DONE 2026-07-19** — `MATCH_QUALITY_TIERS` + `classifyMatchDistance` added to `@xivdyetools/types` (color module) with inclusive `<=` semantics; all four copies (bot-logic QUALITY_TIERS, palette-grid's exported helper AND its inline badge copy, budget-comparison's getDistanceQualityKey) now delegate to it. Boundary distances (exactly 10/25/50) are classified identically everywhere; per-package display metadata (emoji, labels) stays local.
