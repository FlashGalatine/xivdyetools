# [REFACTOR-012]: Facewear synthetic ID hash is collision-prone with no collision detection

## Priority
LOW

## Category
Latent-bug hardening / data integrity

## Location
- `packages/core/src/services/dye/DyeDatabase.ts:252-260` (char-code-sum hash)
- `packages/core/src/services/dye/DyeDatabase.ts:324-331` (silent `dyesByIdMap.set` overwrite on collision)

## Current State
Facewear entries with `itemID: null` get synthetic IDs derived from a plain character-code sum of the name:

```ts
// DyeDatabase.ts:254-259
const nameHash = String(normalizedDye.name)
  .split('')
  .reduce((acc, char) => acc + char.charCodeAt(0), 0);
normalizedDye.id = -(1000 + nameHash);
normalizedDye.itemID = normalizedDye.id;
```

Verified 2026-07-18: the 11 current Facewear names produce 11 unique IDs (`-1629 Silver, -1390 Gold, -1477 Black, -1513 White, -1407 Grey, -1283 Red, -1392 Blue, -1497 Green, -1507 Brass, -1632 Purple, -1520 Brown`).

## Issues
1. A character-code **sum** collides for all anagrams and many non-anagram pairs; the occupied ID space is dense (`Gold = -1390` vs `Blue = -1392` differ by 2). New Facewear color names added in future patches can silently collide.
2. On collision, `this.dyesByIdMap.set(dye.id, dye)` (`:326`) silently overwrites the earlier entry — one Facewear dye becomes unreachable by ID with no error, and `getDyeById` returns the wrong dye.
3. `initialize()` has no uniqueness assertion of any kind for IDs.

## Proposed Refactoring
Cheap insurance in `initialize()` — detect rather than change the hash (synthetic IDs are quasi-API since consumers may persist them, so changing the function is a breaking change):
```ts
if (this.dyesByIdMap.has(dye.id)) {
  this.logger.error(`Synthetic/duplicate dye ID collision: ${dye.id} (${dye.name})`);
  // or throw AppError(DATABASE_LOAD_FAILED, ...) to fail fast at load time
}
this.dyesByIdMap.set(dye.id, dye);
```
Longer term (next major, coordinated with consumers): switch to a real string hash — djb2 already exists in-repo (`generateChecksum`, `utils/index.ts:913-922`).

## Benefits
- A future Facewear addition that collides fails loudly at load time instead of silently corrupting ID lookups.
- Zero behavior change for current data.

## Effort Estimate
LOW (a few lines in `initialize()` plus one test with two colliding names)

## Risk Assessment
LOW for detection-only. MEDIUM for changing the hash function (breaking for any consumer that persisted synthetic IDs) — defer that to a major version.

> Source: evidence/core-analysis.md (2026-07-18 deep-dive, core area)
