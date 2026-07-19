# [REFACTOR-014]: Hex-normalization block duplicated three times in ColorConverter

## Priority
LOW

## Category
Duplication

## Location
- `packages/core/src/services/color/ColorConverter.ts:150-158` (cache-key normalization in `hexToRgb`)
- `packages/core/src/services/color/ColorConverter.ts:166-173` (second normalization *in the same function* for parsing)
- `packages/core/src/services/color/ColorConverter.ts:390-398` (`hexToHsv` cache-key normalization)

## Current State
The uppercase / strip-`#` / expand-shorthand (`#RGB` → `RRGGBB`) sequence is written out three times. Inside `hexToRgb` the *same string* is computed twice back-to-back — once with `.toUpperCase()` for the cache key, then again without it for parsing (relying on `parseInt` case-insensitivity, a needless asymmetry):

```ts
// ColorConverter.ts:151-157 (cache key)
let hexForCache = hex.toUpperCase().replace('#', '');
if (hexForCache.length === 3) {
  hexForCache = hexForCache.split('').map((c) => c + c).join('');
}
// ColorConverter.ts:167-173 (parse source — same work again, minus toUpperCase)
let normalizedHex = hex.replace('#', '');
if (normalizedHex.length === 3) {
  normalizedHex = normalizedHex.split('').map((char) => char + char).join('');
}
```

## Issues
1. Three copies of the same normalization that must stay consistent (cache-key correctness depends on it — cf. the prior CORE-BUG-001 hue-normalization cache-key incident).
2. `hexToRgb` does the `split/map/join` allocation dance twice per uncached call for no reason.
3. Case handling is asymmetric between the two copies within `hexToRgb`.

## Proposed Refactoring
```ts
/** Uppercased, #-stripped, shorthand-expanded hex — used as cache key AND parse source */
private static normalizeHexKey(hex: string): string {
  let h = hex.toUpperCase().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return h;
}
```
Use it in `hexToRgb` (once, for both cache key and `parseInt` source) and in `hexToHsv`.

## Benefits
- Single source of truth for hex normalization → cache keys cannot drift from parse input.
- Removes one redundant string-processing pass per uncached `hexToRgb` call.

## Effort Estimate
LOW (mechanical; conversion tests already cover shorthand and case variants)

## Risk Assessment
None meaningful — pure refactor of already-validated input (`isValidHexColor` gate precedes it).

> Source: evidence/core-analysis.md (2026-07-18 deep-dive, core area)

## Status

**DONE 2026-07-19** — `normalizeHexKey` is the single normalization used as both cache key and parse source in hexToRgb/hexToHsv.
