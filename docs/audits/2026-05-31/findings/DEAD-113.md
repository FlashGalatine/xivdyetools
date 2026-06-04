# DEAD-113: error-response.ts — last surviving DEAD-020 orphan (continuation of DEAD-020)

## Category
Orphaned File

## Location
- File(s): `apps/discord-worker/src/utils/error-response.ts` (~439 lines per the DEAD-020 inventory) + `src/utils/error-response.test.ts`
- Symbol(s): the file's ~23 exports (error codes + response builders)

## Evidence
**Continuation of 2026-02-28 DEAD-020**, which flagged **7** entire dead service/utility files. Re-verifying current
source, **6 of 7 were executed** (deleted) — `css-colors.ts`, `services/color-blending.ts`, `services/image-cache.ts`,
`services/pagination.ts`, `services/progress.ts`, `services/user-preferences.ts` are all **gone**. Only
`utils/error-response.ts` survives.

A production-only sweep finds no importer — the only non-test reference is the file's own JSDoc:
```
src/utils/error-response.ts:15:  * @module utils/error-response   ← self
```
The file is still imported solely by `src/utils/error-response.test.ts`. Command handlers build error embeds via
`utils/response.ts` (`messageResponse` + `errorEmbed`) and `t.t('common.error')`, never via this module's builders.

## Why It Exists
A generic error-message builder layer scaffolded during the V4 migration that no handler adopted. DEAD-020 recommended
REMOVE; the other six files were removed but this one was missed.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — zero production importers; tested-but-unused (same status as Feb) |
| **Blast Radius** | LOW — isolated; delete file + its test |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | None — discord-worker is a private app (no external npm consumers) |

## Recommendation
**REMOVE**

### Rationale
- Closes out DEAD-020 (the last of the 7 files). ~439 production lines + the test file removed.
- Eliminates a confusing second error-formatting path alongside the live `utils/response.ts`.

### If Removing
1. Delete `src/utils/error-response.ts` and `src/utils/error-response.test.ts`.
2. `pnpm --filter xivdyetools-discord-worker run type-check && run test`.
3. Mark DEAD-020 fully resolved.
