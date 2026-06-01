# Stale Test Code Summary

## Overview
- **Total Findings:** 2 (DEAD-101 scaffolding, DEAD-110 disabled tests) — plus the 8 test files removed with DEAD-092–099.

## Findings
| ID | Item | Recommendation |
|----|------|----------------|
| DEAD-101 | Stale `vi.mock()` calls for dead modules in live tool/component tests | REMOVE with their target modules |
| DEAD-110 | 4 permanently disabled `test.skip('…')` blocks in `e2e/collection-manager.spec.ts` (115/126/138/159) | FIX or DELETE |

## DEAD-101 stale-mock inventory
| Stale mock | In | Target (dead) |
|------------|----|----|
| `vi.mock('../colorblindness-display')` | `accessibility-tool.test.ts:209` | DEAD-096 |
| `vi.mock('../color-distance-matrix')` | `comparison-tool.test.ts:206` | DEAD-097 |
| `vi.mock('../color-interpolation-display')` | `gradient-tool.test.ts:234` | DEAD-092 |
| `vi.mock('../dye-filters')` | extractor/gradient/harmony/mixer tool tests | DEAD-100 |
| `vi.mock('@services/tool-panel-builders')` `buildFiltersPanel: vi.fn()` | ~8 component tests | DEAD-100 (filters half) |

## Notes
- The 8 test files for DEAD-092–099 are themselves stale (they test prod-unreachable code) and are removed *with* their sources.
- For the `tool-panel-builders` mocks, keep the `buildMarketPanel: vi.fn()` half — that function is live.
- Distinguish DEAD-110's named `test.skip('…')` (permanently disabled, dead) from the bare `test.skip();` runtime guards in
  `dye-comparison.spec.ts` / `ui-interactions.spec.ts` (intentional skip-if-absent — **not** dead).
- Healthy signal: **0 TODO/FIXME** comments in `src`, and commented-out code is negligible (the heuristic scan mostly caught
  section-header comments like `// Import services`).
