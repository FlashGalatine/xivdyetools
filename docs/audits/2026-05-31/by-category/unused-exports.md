# Unused Exports Summary (symbol-level)

## Overview
- **Total Findings:** 6 (DEAD-102 – DEAD-107)
- **Candidate symbols:** 146 (see `../evidence/symbol-sweep.txt`)
- **Two classes:** genuinely-dead (delete) vs over-exported (de-export)

⚠️ **All symbol-level findings are HEURISTIC** (whole-word grep). The TypeScript compiler is the source of truth — confirm each
removal with `tsc --noEmit --noUnusedLocals`. Type-only and internal-only usages cause false positives.

## Findings
| ID | Location | Kind | Confidence | Recommendation |
|----|----------|------|------------|----------------|
| DEAD-102 | `shared/utils.ts` (~30 helpers) | genuinely dead (tested-but-unused) | MED-HIGH | REMOVE per-symbol + tests |
| DEAD-103 | `shared/error-handler.ts` (validators/result helpers) | genuinely dead | MEDIUM | REMOVE free fns; KEEP `ErrorHandler` |
| DEAD-104 | `shared/constants.ts` (unused constants) | genuinely dead — **continues DEAD-012** | MED-HIGH | REMOVE (reconcile w/ DEAD-012) |
| DEAD-105 | `shared/types.ts` (`AppState`,`ComparisonState`,`HarmonyState`,`MatcherState`) | **contested** | LOW | **MONITOR** — DEAD-018 said KEEP |
| DEAD-106 | `shared/category-icons.ts` (icon constants) | over-export (file LIVE) | HIGH | DE-EXPORT, keep file |
| DEAD-107 | `services/index.ts` (~40 barrel re-exports) | over-export — **continues DEAD-016** | MEDIUM | DE-EXPORT (low priority) |

## Prior-audit cross-references
- **DEAD-104 ⟶ DEAD-012**: the ~30 unused constants were recommended REMOVE in Feb but never executed; still present.
- **DEAD-107 ⟶ DEAD-016**: dead barrel re-exports in `services/index.ts` flagged in Feb; the surface is still oversized.
- **DEAD-105 ⟶ DEAD-018**: Feb adjudicated these state interfaces as **KEEP ("needed")**. This audit does **not** override that
  on heuristic evidence — downgraded to MONITOR.

## Notes
- High value: DEAD-102/103/104 (real source + test removable).
- Low value / cosmetic: DEAD-106/107 (drop `export`, no behaviour change). Do these last, batched.
