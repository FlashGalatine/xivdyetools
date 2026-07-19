# [REFACTOR-015]: Static-wrapper API duplication across ColorConverter / LocalizationService / ColorService

## Priority
LOW

## Category
Architecture / API surface duplication

## Location
- `packages/core/src/services/color/ColorConverter.ts` (~40 `static X() { return this.getDefault().X(...) }` pairs across 1,486 lines)
- `packages/core/src/services/LocalizationService.ts` (~20 static/instance pairs across 627 lines)
- `packages/core/src/services/ColorService.ts` (806 lines of pure re-delegation facade)
- Concrete drift example: `packages/core/src/services/ColorService.ts:68-82` vs `packages/core/src/services/color/ColorConverter.ts:101-119`

## Current State
Every conversion/localization method exists up to three times: instance method, static singleton wrapper, and (for conversions) a `ColorService` facade wrapper. All are hand-written and must be kept in sync manually.

## Issues
1. **Type drift has already happened.** `ColorService.getCacheStats()`'s declared return type (`:68-75`) omits the `rgbToLab`/`rgbToOklab` counters that `ColorConverter.getCacheStats()` returns (`:101-119`). The spread at `:78-81` includes them at *runtime*, but the declared type hides them — TypeScript consumers cannot see two of the seven caches.
2. Every new method requires three hand-written copies (plus JSDoc ×3), tripling the surface to review and keep consistent.
3. The static-singleton tier is what makes the caches and locale state process-global — the enabling condition for BUG-005 (cache poisoning) and the locale race merged into BUG-006. Consumers cannot opt into isolated instances through the facade.

## Proposed Refactoring
Staged, to respect the published API:
1. **Now (non-breaking):** fix the `ColorService.getCacheStats` declared return type to include `rgbToLab` and `rgbToOklab`.
2. **Next minor:** stop adding new methods to the facade tiers; document `ColorConverter` instance usage as the primary API and the statics as convenience-only.
3. **Next major:** collapse to a single tier — either instance-only (consumers hold a `ColorConverter`/`LocalizationService` instance; a module-level default export covers the common case) or generate the static wrappers mechanically so drift is impossible.

## Benefits
- Smaller API surface to audit; declared-type drift like the `getCacheStats` omission becomes structurally impossible.
- Clears the path to non-global caches/locale state (root-cause remediation for BUG-005 / BUG-006-class issues).
- Removes ~1,000 lines of pure delegation boilerplate.

## Effort Estimate
HIGH (public API touched across all consumers: web-app, discord-worker, svg, bot-logic)

## Risk Assessment
MEDIUM — any tier removal is breaking and must ride a major version with a migration note. Step 1 (type fix) is zero-risk and should be done immediately.

> Source: evidence/core-analysis.md (2026-07-18 deep-dive, core area)

## Status

**DONE (step 1) 2026-07-19** — `ColorService.getCacheStats` declared type now includes rgbToLab/rgbToOklab. Steps 2/3 (facade freeze, tier collapse) remain deliberately deferred to a future minor/major per the staged plan.
