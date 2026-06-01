# Dead Code Analysis Report — web-app (2026-05-31 follow-up)

## Executive Summary

- **Project:** `xivdyetools-web-app` v4.10.0
- **Analysis Date:** 2026-05-31
- **Analysis Depth:** Exhaustive (import-graph reachability + symbol-level export sweep + dependency scan + git archaeology + cross-reference vs the 2026-02-28 audit)
- **Total Findings:** 27 (`DEAD-086` – `DEAD-112`, continuing the global registry past `DEAD-085`)
- **Recommended Removals:** 17 (HIGH/MED) · **Refactor/de-export:** 2 · **Fix:** 1 · **Keep/Monitor:** 6 · **Relocate (done):** 1
- **Estimated Dead/Stale Lines:** ~8,320 (≈6,046 production source + ≈2,274 stale test), plus ~4,443 dev-only mockup lines relocated
- **Estimated Dead Files:** 14 fully removable (6 orphaned + 8 test-only) + the deprecated `dye-filters.ts`

This is a **web-app-only follow-up** to the ecosystem-wide **2026-02-28** audit (`../2026-02-28/`, findings `DEAD-001`–`DEAD-085`;
web-app was `DEAD-001`–`DEAD-019`, grade **B**). Those web-app removals were largely executed (`app-layout.ts` is gone). This pass
captures residue that accumulated **after** that snapshot — overwhelmingly the **v3 preset stack**, which Feb's DEAD-004 still
treated as live.

## Health Score

**Code Freshness: C** (regression from Feb's **B**)
- ~6,046 production-source dead lines of ≈73k (~8%), up from Feb's ~5%.
- 14 removable dead files (6 orphaned + 8 test-only); 1 deprecated file behind a barrel.
- **The regression is almost entirely one cause:** the v3 preset trio + helpers (`preset-tool/​detail-view/​card`,
  `auth-button`, `my-submissions-panel`, `tools-dropdown` = 3,221 lines) was stranded by the v4 migration (~2026-02-18) and
  never deleted.
- Healthy signals persist: **0 TODO/FIXME** in `src`, negligible commented-out code, **no orphaned CSS**.

## Summary by Category

| Category | Findings | Remove | Keep/Monitor | Lines (approx) |
|----------|----------|--------|--------------|----------------|
| Orphaned files (A) | DEAD-086–091 | 6 | 0 | 3,221 |
| Test-only files (B) | DEAD-092–099 | 8 | 0 | 4,357 (incl. tests) |
| Deprecated barrel chain (C) | DEAD-100 | 1 | 0 | 792 |
| Stale test scaffolding (D) | DEAD-101 | (with targets) | 0 | — |
| Unused exports (E) | DEAD-102–107 | 3 + 2 de-export | 1 monitor | several hundred |
| Dependencies (F) | DEAD-108–109 | 3 + fix 2 | 0 | — |
| Disabled tests (G) | DEAD-110 | 4 blocks | 0 | — |
| Legacy/deprecated (H) | DEAD-111 | (logger maybe) | 5 | — |
| Dev mockups (I) | DEAD-112 | relocate (done) | — | 4,443 |

## Quick Wins (HIGH confidence, safe to remove)

| ID | Description | Lines |
|----|-------------|-------|
| DEAD-086 | `preset-tool.ts` (v3) — largest single dead file | 1,524 |
| DEAD-087/088 | `preset-detail-view.ts` + `preset-card.ts` (v3) | 615 |
| DEAD-089/090 | `my-submissions-panel.ts` + `tools-dropdown.ts` | 725 |
| DEAD-091 | `auth-button.ts` (cascade after 086) | 357 |
| DEAD-092–099 | 8 test-only components + their tests | 4,357 |

## Recommended Removals (MEDIUM — verify first)

| ID | Description | Verify before removing |
|----|-------------|------------------------|
| DEAD-100 | `buildFiltersPanel` + `dye-filters.ts` (deprecated) | `tsc --noEmit`; keep `buildMarketPanel` |
| DEAD-102 | `shared/utils.ts` ~30 unused helpers | `tsc --noEmit` per symbol |
| DEAD-103 | `shared/error-handler.ts` free functions | keep `ErrorHandler`; `tsc` |
| DEAD-104 | `shared/constants.ts` unused constants (continues DEAD-012) | reconcile w/ DEAD-012; `tsc` |
| DEAD-108 | 3 unused devDependencies | `pnpm why` + build |

## Keep / Monitor

| ID | Item | Reason |
|----|------|--------|
| DEAD-105 | `types.ts` `AppState`/`ComparisonState`/`HarmonyState`/`MatcherState` | **DEAD-018 adjudicated KEEP**; don't override on heuristic |
| DEAD-106 | `category-icons.ts` icon constants | file is LIVE (`getCategoryIcon` used) — de-export only |
| DEAD-107 | `services/index.ts` barrel over-exports | cosmetic; de-export, low priority |
| DEAD-111 | route redirects, result-card legacy actions, config migration fields | intentional back-compat (user-facing) |

## Prior-Audit Cross-Reference (2026-02-28)

| This audit | Relationship | Prior |
|------------|--------------|-------|
| DEAD-104 | continuation — REMOVE rec never executed; constants still present | DEAD-012 |
| DEAD-107 | continuation — barrel surface still oversized | DEAD-016 |
| DEAD-105 | **constrained — prior KEEP, not overridden** | DEAD-018 |
| DEAD-106 | thematic continuation (icon lookups) | DEAD-013 / DEAD-014 |
| (context) | Feb's `preset-tool.ts` "live" assumption no longer holds → now DEAD-086 | DEAD-004 |

## Dependency Cleanup

| Package | Status | Action |
|---------|--------|--------|
| `@testing-library/dom` | unused | remove (verify) |
| `@testing-library/user-event` | unused | remove (verify) |
| `@xivdyetools/test-utils` | unused | remove (verify) |
| `@tailwindcss/postcss` | mis-placed in `dependencies` | move to `devDependencies` |
| `cross-env` | phantom (used in script, undeclared) | add to `devDependencies` |

## Cleanup Execution Plan (documented; NOT executed this pass except Wave 6)

> Per the engagement ("we won't delete/archive anything yet"), Waves 1–5 are documented for later. Only Wave 6 (mockup
> relocation, DEAD-112) was executed.

### Wave 1 — Safe deletes (no cascade)
`preset-detail-view.ts`, `preset-card.ts`, `my-submissions-panel.ts`, `tools-dropdown.ts` (DEAD-087/088/089/090). Then test.

### Wave 2 — Cascade
`preset-tool.ts` (DEAD-086) → then `auth-button.ts` (DEAD-091). Then test.

### Wave 3 — Test-only pairs
DEAD-092–099: delete each source + its test; strip the matching stale `vi.mock()` (DEAD-101). Then test.

### Wave 4 — Deprecated chain
DEAD-100: remove `buildFiltersPanel` export + barrel line (keep `buildMarketPanel`) → delete `dye-filters.ts` + test → fix the
`tool-panel-builders` mocks. `tsc` + test.

### Wave 5 — Unused exports + deps
DEAD-102/103/104 (confirm each with `tsc --noEmit`), then de-export DEAD-106/107; DEAD-108/109 dependency edits.
**Hold DEAD-105** pending a human decision that supersedes DEAD-018.

### Wave 6 — Mockup relocation ✅ DONE
DEAD-112: `src/mockups/**` → `docs/historical/web-app/20260531-Mockups/`; remove the `main.ts` DEV loader + `@mockups` alias/path.

## Post-Cleanup Verification (for each wave, when executed)
- [ ] `pnpm --filter xivdyetools-web-app run type-check`
- [ ] `pnpm --filter xivdyetools-web-app run test -- --run`
- [ ] `pnpm --filter xivdyetools-web-app run lint`
- [ ] `pnpm --filter xivdyetools-web-app run build:check` (includes `check-bundle-size` — measure the reduction)
- [ ] `pnpm --filter xivdyetools-web-app run test:e2e` (chromium)

## Recommendations (preventing future accumulation)
1. **Add `knip` to CI** for web-app (the Feb audit ran it; it is no longer wired in). A `knip.json` rooted at `src/main.ts`
   would have caught the entire v3 preset stack the day it was orphaned.
2. **Delete the old twin in the same PR as the v4 replacement** — the residue here all dates to the 2026-02-18 migration commit.
3. **Treat "tested but unreachable" as dead** — 8 components + ~30 utils were kept alive only by their own green tests.
4. **Re-run this sweep quarterly**; reconcile against open prior findings (DEAD-012/016 are still open from February).
