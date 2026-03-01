# DEAD-057: 11 unused preset response sub-types

## Category
Unused Exports (Types)

## Location
- File(s): `packages/types/src/preset/response.ts`
- Line(s): 33–179
- Symbol(s): `PresetSubmitCreatedResponse`, `PresetSubmitDuplicateResponse`, `PresetSubmitErrorResponse`, `PresetEditDuplicateInfo`, `PresetEditSuccessResponse`, `PresetEditDuplicateResponse`, `PresetEditErrorResponse`, `VoteSuccessResponse`, `VoteErrorResponse`, `ModerationSuccessResponse`, `ModerationErrorResponse`

## Evidence
Monorepo-wide grep for each symbol returns **zero** import hits across all apps and packages (excluding test files). Consumers universally import the **union types** (`PresetSubmitResponse`, `PresetEditResponse`, `VoteResponse`, `ModerationResponse`) and never destructure into their constituent sub-types.

Two symbols appeared only as string mentions in code comments:
- `PresetSubmitCreatedResponse` — mentioned in `discord-worker/src/handlers/commands/preset.ts:463` (comment only)
- `PresetEditSuccessResponse` — mentioned in `discord-worker/src/handlers/commands/preset.ts:773` (comment only)

All 4 union types that compose these sub-types are actively consumed by 3–5 projects.

## Why They Exist
Standard discriminated union pattern: define sub-types for each variant, then export a union. The sub-types exist for type narrowing at definition time, but consumers only need the union.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — zero import hits across entire monorepo |
| **Blast Radius** | NONE — removing exports doesn't affect unions (they're type aliases) |
| **Reversibility** | EASY — types only, no runtime impact |
| **Hidden Consumers** | UNLIKELY — no external npm consumers since types is workspace-internal |

## Recommendation
**MARK @internal**

### Rationale
These sub-types have value as documentation and for type narrowing in `response.ts` itself. They should be kept in the file but removed from the barrel export. Add `@internal` JSDoc tag and stop re-exporting from `preset/index.ts`.

### If Removing from Barrel
1. Remove the 11 symbols from `src/preset/index.ts` re-exports
2. Remove corresponding re-exports from `src/index.ts`
3. Keep the type definitions in `response.ts` (they compose the unions)
4. Run monorepo-wide `type-check` to confirm no breakage
