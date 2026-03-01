# DEAD-060: Orphaned preset/character types — zero consumers

## Category
Unused Exports (Types)

## Location
- File(s): `packages/types/src/preset/core.ts`, `packages/types/src/preset/community.ts`, `packages/types/src/character/index.ts`
- Symbol(s): `ResolvedPreset` (L93), `AuthenticatedPresetSubmission` (L104), `CharacterColorCategory` (L68)

## Evidence

### `ResolvedPreset`
Monorepo-wide grep returns **zero** import hits. The type extends `PresetPalette` with resolved dye data but no consumer ever imports it. Only core's deprecated barrel re-exports it.

### `AuthenticatedPresetSubmission`
Monorepo-wide grep returns **zero** hits — not imported anywhere, not even by core's internal services. The type extends `PresetSubmission` with an `authContext` field, but actual authentication is handled differently (middleware injects `AuthContext` separately).

### `CharacterColorCategory`
Monorepo-wide grep returns **zero** hits outside `packages/types/`. This union type combines `SharedColorCategory | RaceSpecificColorCategory`, but consumers use the constituent types directly rather than the union. Even core's `CharacterColorService` imports the individual sub-types, not this union.

## Why They Exist
- `ResolvedPreset`: Designed for a preset display feature that uses core's `PresetService` directly instead
- `AuthenticatedPresetSubmission`: Over-specified — real auth uses middleware pattern
- `CharacterColorCategory`: Convenience union that nobody needed

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — verified zero hits for all 3 |
| **Blast Radius** | NONE |
| **Reversibility** | EASY |
| **Hidden Consumers** | NONE |

## Recommendation
**REMOVE** (`ResolvedPreset`, `AuthenticatedPresetSubmission`) / **MARK @internal** (`CharacterColorCategory`)

### Rationale
`ResolvedPreset` and `AuthenticatedPresetSubmission` were speculative types never adopted. `CharacterColorCategory` could serve future use as a convenience union, but should be marked `@internal` until consumed.

### If Removing
1. Remove `ResolvedPreset` from `src/preset/core.ts` and `src/preset/index.ts`
2. Remove `AuthenticatedPresetSubmission` from `src/preset/community.ts` and `src/preset/index.ts`
3. Mark `CharacterColorCategory` with `@internal` in `src/character/index.ts`
4. Remove all 3 from `src/index.ts` barrel
