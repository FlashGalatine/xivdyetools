# Dead Code Paths, Legacy & Duplicates — Summary

## Overview
- **Total Findings:** 6
- **Recommended for Removal:** 1 REMOVE (partial) · 4 REFACTOR FIRST · 1 KEEP (register)
- **Estimated removable:** ~110 source lines now; ~40 more after overload migration; ~65-line internal duplicate

## Findings

| ID | Location | What | Confidence | Recommendation |
|----|----------|------|------------|----------------|
| DEAD-009 | discord-worker `index.ts:1028-1092` | local `DiscordInteraction` duplicating `types/env.ts` (65 lines) | HIGH | **REFACTOR FIRST** |
| DEAD-010 | discord-worker | stale "legacy commands" comments; unreachable `ENVIRONMENT==='development'` branch; **KEEP register** for the KV read-side migrations (with the missing `budget:world:v1:*` cleanup step) and the `about` one-release carry; `stats.ts:462` defect | HIGH / MED | **REMOVE** (comments/branch) · **KEEP** (compat) |
| DEAD-032 | core `band-calibration.ts` barrel exports, `RATIO_BANDS`, undiscoverable script | calibration tooling on the runtime barrel | HIGH | **REFACTOR FIRST** |
| DEAD-035 | core dual-signature overloads (APIService ctor, `findClosestDye`, `findClosestDyes`, `findDyesWithinDistance`) + stale `'rgb'` default | legacy arms with no production caller | HIGH | **REFACTOR FIRST** (migrate then remove) |
| DEAD-013 (part) | bot-logic `executeMixer` | `MixerResult.matches` — dead runtime work per `/mixer` | HIGH | **REMOVE** |
| DEAD-037 | cross-scope | consolidation register of *live* duplicates (SUPPORTED_LOCALES ×3, VISION_TYPES ×2, CATEGORY_DISPLAY ×3, HMAC ×4, race tables ×4, svg↔core colour math, `'cie2000'`/`'ciede2000'`, …) | — | **KEEP** / tickets |

## Notes
- `grep @deprecated packages/core/src` → **0 hits**: core has legacy arms but never labels them.
- No commented-out code blocks (≥5 lines) and no skipped tests anywhere in scope.
- Feature-flag-like checks (`isUniversalisEnabled`, `isApiEnabled`) are binding-presence checks, not flags — nothing permanently on/off.
