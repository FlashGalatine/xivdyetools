# DEAD-064: Character/dye types only consumed by core internals

## Category
Unused Exports (Types) — Orphan Risk

## Location
- File(s): `packages/types/src/color/colorblind.ts`, `packages/types/src/character/index.ts`, `packages/types/src/dye/dye.ts`, `packages/types/src/dye/database.ts`
- Symbol(s): `Matrix3x3`, `Race`, `SharedColorCategory`, `RaceSpecificColorCategory`, `LocalizedDye`, `DyeDatabase`

## Evidence

| Symbol | Direct Consumers (from types) | Through Core | Notes |
|--------|-------------------------------|-------------|-------|
| `Matrix3x3` | 0 | Core re-exports, 0 downstream | Used internally within core's colorblind module |
| `Race` | 0 | Core re-exports, 0 downstream | Core's `CharacterColorService` uses it; apps use string race names |
| `SharedColorCategory` | 0 | Core re-exports, 0 downstream | Only in core's `CharacterColorService` |
| `RaceSpecificColorCategory` | 0 | Core re-exports, 0 downstream | Only in core's `CharacterColorService` |
| `LocalizedDye` | 0 | Core re-exports, 0 downstream | Used internally by core's `DyeService.ts`; apps use `getLocalizedDyeName()` |
| `DyeDatabase` | 0 | Core re-exports, 0 downstream | Apps use core's `DyeDatabase` class, not the types interface |

All 6 types are consumed by `packages/core` — they import directly from `@xivdyetools/types` and use them in internal services. Removing these types from the types package would break core's build.

However, no app or non-core package ever imports these types (not from types, not from core's re-export).

## Why They Exist
These define internal contracts consumed by core:
- `Matrix3x3`: 3x3 color transformation matrix type for colorblind simulation
- `Race` / category types: Character color system types
- `LocalizedDye`: Dye with localized name (used by DyeService return values)
- `DyeDatabase`: Interface for the dye data structure (core implements the class)

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | MEDIUM — zero app consumers, but core depends on them |
| **Blast Radius** | HIGH if removed from types — core breaks |
| **Reversibility** | EASY |
| **Hidden Consumers** | Core is a real consumer |

## Recommendation
**KEEP — mark @internal if desired**

### Rationale
These types define internal contracts between types and core. They're architecturally correct — types provides the definitions, core consumes them. The fact that no app imports them directly is expected (apps use core's higher-level API). 

However, exporting them from the types barrel adds 6 items to the public API surface. Consider:
1. **Option A (recommended):** Keep in barrel, add `@internal` JSDoc tags to signal they're not for app consumption
2. **Option B:** Remove from main barrel, keep only in subpath exports (only affects `@xivdyetools/types` main import, not `@xivdyetools/types/dye` etc.)
3. **Option C:** Move to `@xivdyetools/core` since only core uses them (poor separation of concerns)
