# [DEAD-017]: svg — duplicated `describe` blocks in `base.test.ts`, stale consumer docs, and stoat-worker's unused svg dependency

## Category
Stale Test / Stale Docs / Unused Dependency

## Location
- `packages/svg/src/base.test.ts` — **two** `describe('truncateText')` blocks (368-384, 450-470) and **two** `describe('estimateTextWidth')` blocks (385-412, 472-502) — ~50 duplicated lines from a merged file
- `packages/svg/README.md`, `packages/svg/CLAUDE.md` — both list `apps/stoat-worker` as a consumer; stoat-worker imports nothing from svg
- `apps/stoat-worker/package.json` — `@xivdyetools/svg` dependency unused (knip default mode; corroborated by grep). Also `@xivdyetools/core` and `@xivdyetools/worker-kit` flagged there — out of scope (parked app), noted in the report footer

## Evidence
`grep -n "describe('truncateText')\|describe('estimateTextWidth')" packages/svg/src/base.test.ts` → 4 hits. `git grep -l "@xivdyetools/svg" apps/stoat-worker/src` → 0.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH |
| **Blast Radius** | NONE |
| **Reversibility** | EASY |

## Recommendation
**REMOVE** the duplicate blocks (the `truncateText` ones go entirely with DEAD-014); fix the two docs; drop the stoat-worker svg dep when that app is next touched.
