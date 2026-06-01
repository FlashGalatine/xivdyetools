# Orphaned Files Summary

## Overview
- **Total Findings:** 6 (DEAD-086 – DEAD-091)
- **Recommended for Removal:** 6
- **Estimated Lines Removable:** ~3,221 (source; no tests exist for these)

Files reachable from neither `main.ts` nor any test. All are v3 residue stranded by the v4 migration that completed ~2026-02-18,
*after* the 2026-02-28 audit snapshot (whose DEAD-004 still treated `preset-tool.ts` as live).

## Findings
| ID | File | Lines | Last touched | Confidence | Recommendation |
|----|------|-------|--------------|------------|----------------|
| DEAD-086 | `components/preset-tool.ts` | 1524 | 2026-03-01 | HIGH | REMOVE |
| DEAD-087 | `components/preset-detail-view.ts` | 453 | 2026-03-01 | HIGH | REMOVE |
| DEAD-088 | `components/preset-card.ts` | 162 | 2026-02-18 | HIGH | REMOVE |
| DEAD-089 | `components/my-submissions-panel.ts` | 443 | 2026-02-28 | HIGH | REMOVE |
| DEAD-090 | `components/tools-dropdown.ts` | 282 | 2026-02-18 | HIGH | REMOVE |
| DEAD-091 | `components/auth-button.ts` | 357 | 2026-04-29 | HIGH | REMOVE (cascade after 086) |

## Notes
- **Cascade:** `auth-button.ts` (DEAD-091) is imported only by the orphaned `preset-tool.ts:14` — remove 086 first, then 091.
- The live replacements are the `components/v4/preset-*.ts` trio + `v4/v4-app-header.ts` (nav). `services/auth-service.ts` and
  `services/theme-service.ts`/`language-service.ts` are separate live modules and are unaffected.
