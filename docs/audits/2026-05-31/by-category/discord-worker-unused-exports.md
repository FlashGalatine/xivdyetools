# Discord Worker — Unused Exports Summary (2026-06-03 extension)

## Overview
- **Total Findings:** 6 (DEAD-115 – DEAD-120)
- **Two classes:** newly-found test-only exports (115/116/117) vs still-open February continuations (118/119/120)
- **Estimated Lines Removable:** ~355 production + test blocks

⚠️ All symbol-level findings were verified by **whole-monorepo grep** (each symbol resolved to definition + test only).
Confirm each removal with `tsc --noEmit` before deleting — type-only usages can hide from grep.

## Findings
| ID | Location | Kind | Continues | Confidence | Recommendation |
|----|----------|------|-----------|------------|----------------|
| DEAD-115 | `services/emoji.ts` (3 fns) | test-only export | — (new) | HIGH | REMOVE |
| DEAD-116 | `utils/response.ts` `embedResponse` + `autocompleteResponse` | test-only export | DEAD-026 (embedResponse) | HIGH | REMOVE |
| DEAD-117 | `services/budget/price-cache.ts` (2 fns) | test-only export (barrel re-exported) | — (new) | MED-HIGH | REMOVE WITH CAUTION |
| DEAD-118 | 5 files (image/budget/preferences/preset/verify types) | dead type/const/fn exports | DEAD-026 (7 of 8) | HIGH | REMOVE |
| DEAD-119 | `utils/discord-api.ts` InteractionContext + deadline | unused OOP/API layer | DEAD-024 | HIGH | REMOVE |
| DEAD-120 | `services/component-context.ts` 7 UI builders | unused component builders | DEAD-025 | HIGH | REMOVE |

## Notes
- **`getCachedPrices` is NOT dead** (DEAD-117) — it has one internal caller (`fetchWithCache`). Keep it; only
  `getCachedPriceWithStale` + `invalidateCachedPrice` are unused.
- DEAD-026's 8th symbol (`embedResponse`) is filed under DEAD-116 (grouped with its file-sibling `autocompleteResponse`),
  so DEAD-118 covers the remaining 7. Removing 116 + 118 closes DEAD-026.
- DEAD-119/120 keep the live cores of their files (`sendMessage`/`editOriginalResponse`/`sendFollowup`;
  `createContext`/`getContext`/`refreshContext`).
