# Discord Worker — Legacy / Deprecated Summary (2026-06-03 extension)

## Overview
- **Total Findings:** 5 (DEAD-121 – DEAD-125)
- **Recommended for Removal now:** 0 — all are intentional shims/markers (KEEP/Monitor)
- These are documented for tracking, not deletion. None is "dead" in the accidental sense.

## Findings
| ID | Item | Continues | Status | Recommendation |
|----|------|-----------|--------|----------------|
| DEAD-121 | `types/preset.ts` 4 `@deprecated` re-export blocks (15 types) | — | **still consumed** by preset.ts / preset-api.ts | KEEP-MONITOR (migrate → remove next major) |
| DEAD-122 | `preferences.ts` legacy KV migration shim | supersedes DEAD-029 | **live** (runs on preference reads) | KEEP-MONITOR (retire after sunset) |
| DEAD-123 | `favorites`/`collection`/`language` commands | DEAD-031 | **live + now `@deprecated`** (→ /preset, /preferences) | KEEP-MONITOR (retire on schedule) |
| DEAD-124 | `extractor.ts:263` TODO (v4 matching/market options) | — | unimplemented marker | MONITOR (implement or file issue) |
| DEAD-125 | empty `modals/index.ts` + `handleModal` fallback | — | intentional future scaffolding | KEEP-MONITOR |

## Notes
- **`PresetPreviousValues`** is the one member of DEAD-121's deprecated blocks with zero consumers — it is delete-now under
  **DEAD-118**, not migration debt.
- DEAD-122 must outlive the un-migrated user base — removing it prematurely loses persisted language/world prefs.
- DEAD-123's `@deprecated` JSDoc is **new since February** — an explicit retirement signal. Track `/stats` legacy-vs-v4 usage.
- These shims are why discord-worker still shows residual "legacy" surface despite the big DEAD-020/021/022 cleanups landing.
