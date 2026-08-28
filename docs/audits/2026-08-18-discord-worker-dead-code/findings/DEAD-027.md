# [DEAD-027]: test-utils — ~500 lines of unused factory/constant extras in otherwise-live files, plus a pass-through `utils/crypto.ts` and a duplicated `randomId` barrel path

## Category
Unused Export (TEST-ONLY) / REDUNDANT-RE-EXPORT

## Location
`packages/test-utils/src/`:

| File | Unused extras | ~Lines | Live symbols kept |
|---|---|---|---|
| `factories/dye.ts` | `createMockDyes`, `createMetallicDye`, `createPastelDye`, `createDarkDye`, `getMockDyeById`, `getMockDyesByIds` | ~90 of 255 | `createMockDye` (×7) — note the 22 external `mockDyes` hits are web-app's own `__tests__/mocks/services` fixture |
| `factories/preset.ts` | `createMockPresets`, `createCuratedPreset`, `createPresetWithStatus`, `presetToRow`, `rowToPreset`, `createMockPreset` | ~120 of 238 | `createMockPresetRow` (×5), `createMockSubmission` (×3) |
| `factories/category.ts` | `createMockCategory`, `createMockCategories`, `createCuratedCategory`, `categoryToRow`, `DEFAULT_CATEGORIES` | ~100 of 140 | `createMockCategoryRow` (×1) |
| `constants/pkce.ts` | `INVALID_*`, `MIN/MAX_VERIFIER_LENGTH`, `S256_CHALLENGE_LENGTH`, `VERIFIER_PATTERN`, `generateCodeChallenge`, `isValid*Format` | ~90 of 119 | `VALID_CODE_VERIFIER` (×3), `VALID_CODE_CHALLENGE` (×4) |
| `auth/headers.ts` | `jsonHeaders`, `authenticatedJsonHeaders`, `mergeHeaders`, `authHeadersWithSignature` | ~80 of 134 | `authHeaders` (×2) |
| `auth/jwt.ts` | `createJWTWithExpiration`, `FullJWTPayload`, `TestJWTPayload` | ~30 | `createTestJWT` (×3), `createExpiredJWT` (×2) |
| `utils/crypto.ts` | whole file — 6-function pass-through of `@xivdyetools/auth/encoding` (root barrel re-publishes all six via `export * from './utils'`); `base64UrlDecodeBytes`, `base64UrlDecode`, `hexToBytes` unused even internally | 15 | internal callers `auth/jwt.ts:26`, `auth/signature.ts:28` can import `@xivdyetools/auth/encoding` directly |
| `factories/index.ts:15-18` | `randomId`, `randomStringId` re-export (already exported via `utils/index.ts` → root; no consumer uses either) | 5 | — |

## Evidence
Same named-import tally as DEAD-026; each symbol grepped with `-w` across tracked files.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH (workspace-private) |
| **Blast Radius** | LOW — same files stay; only unused members go |
| **Reversibility** | EASY |

## Recommendation
**REMOVE** (a natural second wave after DEAD-026; do it in one commit per file so the diff stays reviewable).
