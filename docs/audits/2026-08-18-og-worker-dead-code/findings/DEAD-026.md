# [DEAD-026]: `types.ts` `VisionType` duplicates `@xivdyetools/types`' `VisionType`; `index.ts` `VALID_*` arrays hand-copy the unions

## Category
Unused Type (duplication)

## Location
- `src/types.ts:56-61` `VisionType` (identical member list to core's — og-data-generator/translator import core's `as CoreVisionType` and cast between them)
- `src/types.ts:29-50` `ToolId`, `HarmonyType` (kebab-case route form — legitimately local)
- `src/index.ts:79-98` `VALID_HARMONY_TYPES`, `VALID_ALGORITHMS`, `VALID_VISION_TYPES` as `readonly string[]` literals

## Evidence
`translator.ts:10` `VisionType as CoreVisionType` + `:51` `vision as CoreVisionType`; `og-data-generator.ts:18, 72` the same dance. Two nominally different types with the same five members, bridged by casts. The `VALID_*` arrays repeat `HarmonyType`'s ten and `VisionType`'s five members by hand (BUG-002 introduced them for `.includes()` on `string`); a `satisfies readonly HarmonyType[]` or a `Set` derived from one source would keep them from drifting (adding a harmony type today means editing three places: the union, the array, and `IDEAL_OFFSETS`).

## Recommendation
**REFACTOR (LOW)** — re-export core's `VisionType` from types.ts and drop the casts; type the `VALID_*` arrays against the unions (`const VALID_HARMONY_TYPES = [...] as const satisfies readonly HarmonyType[]` then `.includes(x as HarmonyType)`). Cosmetic; do it if the file is open anyway.
