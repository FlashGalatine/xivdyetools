# Discord Worker — Orphaned / Stale Files Summary (2026-06-03 extension)

## Overview
- **Total Findings:** 2 (DEAD-113, DEAD-114)
- **Recommended for Removal:** 2
- **Estimated Lines Removable:** ~439 production (error-response.ts) + the integration test helper

Both are leftovers of February findings that were *partly* executed. The big DEAD-020 sweep (7 dead files) and DEAD-030
(integration utils) were mostly cleaned up; these are the residue.

## Findings
| ID | File | Continues | Confidence | Recommendation |
|----|------|-----------|------------|----------------|
| DEAD-113 | `utils/error-response.ts` (+ test) | DEAD-020 (6/7 already deleted) | HIGH | REMOVE |
| DEAD-114 | `test-utils.integration.ts` | DEAD-030 | HIGH | REMOVE |

## Notes
- DEAD-020 is now **6/7 resolved** — `css-colors.ts`, `services/color-blending.ts`, `services/image-cache.ts`,
  `services/pagination.ts`, `services/progress.ts`, `services/user-preferences.ts` are all gone. Only `error-response.ts` remains.
- Live error formatting goes through `utils/response.ts` (`messageResponse` + `errorEmbed`), not these builders.
- `test-utils.ts` (without `.integration`) is the live test helper; the `.integration` variant has zero importers.
