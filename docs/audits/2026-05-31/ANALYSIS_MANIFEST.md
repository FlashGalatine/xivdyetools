# Dead Code Analysis Manifest

- **Project:** `xivdyetools-web-app` (apps/web-app) — v4.10.0
- **Analysis Date:** 2026-05-31
- **Auditor:** Claude Code (Opus 4.8)
- **Scope:** `apps/web-app` only (a leaf application — its internal exports are not consumed by other monorepo packages, so internal-only unused code is safe to flag)
- **Depth:** Exhaustive (hand-built import-graph reachability + symbol-level export sweep + dependency scan + git history archaeology + cross-reference against the prior 2026-02-28 audit)
- **Analysis Status:** ✅ Complete

## Relationship to prior audits

This is a **web-app-only follow-up** to the ecosystem-wide dead-code audit of **2026-02-28** (`../2026-02-28/`), which filed
`DEAD-001`–`DEAD-085` (web-app was `DEAD-001`–`DEAD-019`, grade **B**). Those web-app removals were **largely executed**
(`app-layout.ts`/DEAD-001 is gone). New finding IDs here **continue the global registry at `DEAD-086`** to avoid collision.

Several findings are explicit **continuations** of still-open 2026-02-28 items, or are **constrained by** prior adjudications:

| This audit | Relationship | Prior finding |
|------------|--------------|---------------|
| DEAD-104 (unused constants) | continuation — REMOVE rec never executed | DEAD-012 |
| DEAD-107 (barrel over-exports) | continuation | DEAD-016 |
| DEAD-105 (types.ts state interfaces) | **constrained — prior KEEP, do not remove** | DEAD-018 |
| DEAD-106 (category-icons over-exports) | thematic continuation | DEAD-013 / DEAD-014 |

## Tooling

- knip / ts-prune / depcheck are **not currently installed**, and there is no knip config. All detection here is hand-built
  (PowerShell import-graph traversal resolving the Vite aliases `@ @components @services @shared @v4 @mockups`).
- The 2026-02-28 audit *had* run knip — its raw output remains at `../2026-02-28/evidence/` (knip-report.txt, depcheck-report.json, tsc-unused.txt) and is a useful cross-check.
- Git history was used for staleness and supersession dating.

## Method summary

1. **Reachability** from the true entry (`src/index.html → /main.ts`), excluding the `import.meta.env.DEV`-guarded mockup branch
   from the production root. All 137 non-test `.ts` files classified: 110 prod / 13 dev-mockup / 8 test-only / 6 orphaned.
2. **Symbol sweep** over `services/` + `shared/` exports (146 candidates), split into genuinely-dead vs over-exported.
3. **Dependency scan**, **legacy-marker / skipped-test / commented-code sweeps**, **git staleness**, **prior-audit cross-ref**.

## Deliverables

- `DEAD_CODE_REPORT.md` — executive summary, health grade, full finding table, quick wins, cleanup waves.
- `findings/DEAD-086.md … DEAD-112.md` — one file per finding (27 findings).
- `by-category/` — 8 category summaries.
- `evidence/` — raw scan output: reachability, symbol-sweep, dependency-scan, git-staleness, line-counts.

## Headline numbers

- **~14 of 137 non-test source files (~10%) dead in production.**
- **~8,320 lines** of removable dead/stale code (≈6,046 production source + ≈2,274 stale test), plus **~4,443 lines** of
  dev-only mockups slated for **relocation** (DEAD-112), not deletion.
- **Health grade: C** (regression from Feb's **B**), driven almost entirely by the un-deleted v3 preset stack.

## Action taken this pass

Per user direction, **only one change is executed**: relocating `src/mockups/` → `../../historical/web-app/20260531-Mockups/`
and removing the now-dangling dev loader/alias (DEAD-112). All other findings are **documented, not actioned**.
