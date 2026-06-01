# Test-Only Files Summary

## Overview
- **Total Findings:** 8 (DEAD-092 – DEAD-099)
- **Recommended for Removal:** 8 (source + test together)
- **Estimated Lines Removable:** ~2,440 source + ~1,917 test = ~4,357

These components are **unreachable from production** but each is still imported by its own `*.test.ts`. The passing tests
disguise dead code as covered code — the import graph, not the test result, reveals the truth. All were superseded by
`v4/result-card.ts` / `v4/*-modal.ts` in the v4 migration.

## Findings
| ID | Source | src/test lines | Replaced by | Stale mock to remove |
|----|--------|---------------|-------------|----------------------|
| DEAD-092 | `color-interpolation-display.ts` | 616/296 | result-card / inline | `gradient-tool.test.ts:234` |
| DEAD-093 | `color-display.ts` | 475/346 | `v4/result-card.ts` | — |
| DEAD-094 | `theme-switcher.ts` | 278/261 | `v4/theme-modal.ts` | — |
| DEAD-095 | `language-selector.ts` | 267/271 | `v4/language-modal.ts` | — |
| DEAD-096 | `colorblindness-display.ts` | 232/198 | `v4/result-card.ts` | `accessibility-tool.test.ts:209` |
| DEAD-097 | `color-distance-matrix.ts` | 220/204 | `v4/result-card.ts` | `comparison-tool.test.ts:206` |
| DEAD-098 | `v4/glass-panel.ts` | 203/95 | unused Lit element | — |
| DEAD-099 | `loading-spinner.ts` | 149/246 | inline SVG in market-board | — |

## Notes
- Remove each **source + its test together**, and strip the corresponding stale `vi.mock()` (see DEAD-101 / `stale-test-code.md`).
- `DEAD-098` is the odd one: a registered `<v4-glass-panel>` element never rendered in any prod template.
- `DEAD-099`'s test (246 lines) is larger than the source (149) it covers — pure overhead.
