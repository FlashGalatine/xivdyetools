# [REFACTOR-005]: `@xivdyetools/color-blending` depends on all of `@xivdyetools/core` for one function, contradicting the documented dependency graph

## Priority
MEDIUM

## Category
Architecture / dependency hygiene / documentation drift

## Location
- `packages/color-blending/package.json:31-33` — `"@xivdyetools/core": "workspace:*"` is the package's **sole** dependency
- `packages/color-blending/src/blending.ts:13, 53-54` — the only use: `ColorService.hexToRgb(h1)` / `ColorService.hexToRgb(h2)`
- Contradicted docs: workspace root `CLAUDE.md` dependency map — `@xivdyetools/color-blending (→ types)`
- Related duplication: `packages/color-blending/src/conversions.ts` (own rgbToHsl/hslToRgb/rgbToHex/LAB/OKLAB suite), `packages/svg/src/base.ts:58-72` (third hexToRgb/rgbToHex copy)

## Current State
The workspace CLAUDE.md documents color-blending as a light Level-2 package depending only on `@xivdyetools/types`. In reality it declares a dependency on the entire `@xivdyetools/core` — dye database JSON (136 entries), k-d tree, 6-language i18n, Universalis API client — to call `ColorService.hexToRgb` twice in `blendColors`:

```ts
// packages/color-blending/src/blending.ts:13, 53-54
import { ColorService } from '@xivdyetools/core';
...
const rgb1 = ColorService.hexToRgb(h1);
const rgb2 = ColorService.hexToRgb(h2);
```

Meanwhile the package *already implements* a full conversion suite in `conversions.ts` (RGB↔LAB/OKLAB/RYB/HSL, plus its own `rgbToHex` at L279-282) — everything except hex→RGB parsing.

## Issues
1. **Doc/architecture mismatch:** the dependency map used for planning and publish ordering is wrong for this package.
2. **Bundle weight:** any consumer wanting only blending pulls core; tree-shaking must strip the dye DB and i18n, which depends on core's `sideEffects` correctness — fragile for browser bundles.
3. **Publish coupling:** every core release potentially forces a color-blending compatibility check for a function that hasn't changed in years.
4. **Triplicated primitives:** hexToRgb/rgbToHex now live in core, svg/base.ts, and (rgbToHex) color-blending — three drift points for the same 10 lines.

## Proposed Refactoring
1. Add a local `hexToRgb` to `packages/color-blending/src/conversions.ts` (~8 lines, mirroring `svg/base.ts:58-65`, including `#`-stripping which `blendColors` already handles at L49-50). Decide validation behavior: replicate core's strict validation (throw on malformed hex) or document lenient parsing.
2. Replace the two `ColorService.hexToRgb` calls; delete the core import and the `package.json` dependency (keep `@xivdyetools/types` if types are referenced, matching the documented graph).
3. Bump minor version; update the root CLAUDE.md map if instead the decision is to *keep* the core dependency (not recommended).
4. Optional follow-up: promote a single shared `hexToRgb`/`rgbToHex` pair into `@xivdyetools/types` or a micro color-primitives module and collapse the three copies.

## Benefits
- Restores the documented layering; color-blending becomes a true leaf over types.
- Smaller browser bundles for blending-only consumers; no reliance on shaking out the dye DB.
- Decouples release cadence from core.

## Effort Estimate
Trivial-to-small — under 1 hour including tests (existing blending tests already cover the conversion round-trips).

## Risk Assessment
Low. The single behavioral consideration is error handling for invalid hex input: core's `hexToRgb` throws `AppError(INVALID_*)`; a lenient local parser would return NaN channels instead. Matching core's throw-on-invalid keeps observable behavior identical for all current callers.

> Source: evidence/shared-packages-analysis.md (2026-07-18 deep-dive, shared-packages area)

## Status

**DONE 2026-07-19** — color-blending gained a local strict `hexToRgb` in conversions.ts (throws on malformed input, accepts #RGB/#RRGGBB) and the `@xivdyetools/core` dependency was deleted from package.json; the package now has zero internal runtime deps, matching the documented graph. Lockfile updated.
