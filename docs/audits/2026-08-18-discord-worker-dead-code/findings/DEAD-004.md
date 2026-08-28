# [DEAD-004]: 20 dead / test-only exports scattered across discord-worker services & utils (~300 lines + tests)

## Category
Unused Export (DEAD + TEST-ONLY)

## Location
All under `apps/discord-worker/src/`:

| Symbol | File:lines | Class | ~Lines |
|---|---|---|---|
| `resolvePreference` | services/preferences.ts:297-314 | DEAD (0 refs incl. tests; `resolveBlendingMode/Matching/Count` are the live specialisations) | 28 |
| `hasPreferences`, `resolveMarket` | services/preferences.ts:274-282, 364-372 | TEST-ONLY | 23 |
| `UserWorldPreference` | types/budget.ts:141-150 | DEAD (pre-v4 `budget:world:v1:` blob; `preferences.ts:498` parses inline) | 10 |
| `createHexButton` | handlers/buttons/copy.ts:150-179 (+ barrel) | TEST-ONLY (`createCopyButtons` is the live builder) | 27 (+22 test) |
| `MAX_COLLECTION_NAME_LENGTH`, `MAX_COLLECTION_DESCRIPTION_LENGTH`, `sanitizeCollectionName`, `sanitizeCollectionDescription` | utils/sanitize.ts:15-16, 81-99 | TEST-ONLY (`/collection` deleted in v5, cfb5f85) | 22 |
| `SUPPORTED_LOCALES`, `LocaleInfo`, `getLocaleInfo`, `formatLocaleDisplay` | services/i18n.ts:35-73, 165-171 | TEST-ONLY (the `/preferences language` choices are hard-coded in `commands/schemas.ts:602`) | 40 |
| `FONT_FAMILIES`, `getFontWithCjkFallback`, `hasCjkFont` | services/fonts.ts:53-55, 101-131 | TEST-ONLY + duplicate of `@xivdyetools/svg` `FONTS` | 35 |
| `safeSendFollowUp`, `deleteOriginalResponse` | utils/discord-api.ts:265-309 | TEST-ONLY | 44 |
| `renderSvgToDataUrl` | services/svg/renderer.ts:122-130 | TEST-ONLY | 9 |
| `isPresetFavorited` | services/preset-favorites.ts:194-205 | TEST-ONLY | 12 |
| `getConfiguredBackend` | services/rate-limiter.ts:210-215 | TEST-ONLY | 6 |
| `getHarmonyTypeChoices` (barrel line) | handlers/commands/harmony.ts:168, index.ts:14 | TEST-ONLY (schema hard-codes choices) | 2 |
| `searchDyes`, `getAllDyes`, `getCategories` | services/budget/budget-calculator.ts:291-345 | TEST-ONLY 1-line `dyeService` wrappers | 9 |
| `getQuickPickChoices` | services/budget/quick-picks.ts:190-196 | TEST-ONLY | 8 |
| `InteractionResponseType.UPDATE_MESSAGE`, `.MODAL` | types/env.ts | DEAD enum members (mirror the Discord enum — trim optional) | 2 |

## Evidence
Zero-non-test-reference scan over every `export` in non-test src (command in `evidence/track-A-discord-worker.md` §8), each then grepped monorepo-wide with `-w`. knip only reported the first block (`resolvePreference`, `createHexButton`, `UserWorldPreference`, the budget wrappers, enum members); the TEST-ONLY tier is invisible to it because test files are entries.

## Why It Exists
Leftovers of removed 4.x commands (`/collection`, `/match`), pre-5.0 preference blobs, and helpers written "for completeness" whose only caller became their own unit test.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH (each grepped individually) |
| **Blast Radius** | LOW — each removal deletes a function + its `describe` block; no cross-file ripple except the two barrels |
| **Reversibility** | EASY |
| **Hidden Consumers** | None; `resetRateLimiterInstance` and `registryCommandNames` are legit test hooks and are deliberately **not** on this list |

## Recommendation
**REMOVE**

### Rationale
~300 source lines and roughly as many test lines whose tests can only ever pass (they test code no runtime path executes). Removing them also shrinks the exported surface future audits have to walk.

### If Removing
1. Delete each symbol and its dedicated test cases (files listed in the track notes).
2. Drop `getHarmonyTypeChoices` from `handlers/commands/index.ts`; drop `createHexButton` from `handlers/buttons/index.ts`.
3. `pnpm turbo run test type-check lint --filter=xivdyetools-discord-worker`.
