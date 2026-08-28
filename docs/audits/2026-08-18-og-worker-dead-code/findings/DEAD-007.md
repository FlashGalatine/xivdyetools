# [DEAD-007]: Unused imports — `normalizeMatchingMethod` (index.ts), `ColorConverter` (dye-helpers.ts); duplicated `@xivdyetools/core` import statement; two unused `beforeEach` in tests

## Category
Unused Import

## Location
- `src/index.ts:17` `import { DEFAULT_MATCHING_METHOD, normalizeMatchingMethod } from '@xivdyetools/core';` and `:24` `import { extractLocaleCode } from '@xivdyetools/core';`
- `src/services/svg/dye-helpers.ts:12` `ColorConverter`
- `src/index.test.ts:8`, `src/og-data-generator.test.ts:7` — `beforeEach`

## Evidence
`pnpm exec tsc --noEmit --noUnusedLocals --noUnusedParameters` → 4 × TS6133 (`evidence/tsc-unused.txt`). Masked in CI because og-worker's tsconfig turns those flags off (DEAD-008). `normalizeMatchingMethod` *is* used — but in `dye-helpers.deltaForAlgorithm`, not at the route boundary the `types.ts:52` comment ("legacy URL values … normalise at the boundary via normalizeMatchingMethod") describes; the index.ts import is a fossil of that intent.

## Removal Risk Assessment
| Factor | Assessment |
|---|---|
| **Confidence** | HIGH (compiler-verified) |
| **Blast Radius** | NONE |
| **Reversibility** | EASY |

## Recommendation
**REMOVE** (3 prod lines, 2 test lines); merge the two `@xivdyetools/core` imports into one; reword the types.ts:52 comment to say normalisation happens in `deltaForAlgorithm`.
