# [DEAD-024]: `presets.ts` declares a local `PresetPalette` interface and casts `presetData`, though `@xivdyetools/types` exports `PresetPalette` / `PresetData`

## Category
Unused Type (duplicate of a shared type)

## Location
- `src/services/svg/presets.ts:213-218` `interface PresetPalette { id; name; category; dyes: number[] }`
- `src/services/svg/presets.ts:226` `(presetData as { palettes: PresetPalette[] }).palettes`
- `packages/types/src/preset/core.ts:70` `export interface PresetPalette`, `:101` `export interface PresetData`

## Evidence
`grep -rn "export interface PresetPalette" packages/types/src` → present and exported. The local four-field interface is a subset of the shared one; the `as` cast bypasses the JSON's real type. If `presets.json`'s shape changes (e.g. `dyes` becomes objects), the shared type breaks loudly across the monorepo and this file keeps compiling.

## Recommendation
**REFACTOR** — `import type { PresetData } from '@xivdyetools/types'` and `(presetData as PresetData).palettes` (or, if core's JSON import is typed well enough, no cast at all). ~6 lines.
