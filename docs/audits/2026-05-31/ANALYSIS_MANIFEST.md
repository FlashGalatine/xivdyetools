# Dead Code Analysis Manifest

- **Projects:**
  - **Part 1** (2026-05-31): `xivdyetools-web-app` (apps/web-app) — v4.10.0 → `DEAD-086`–`DEAD-112`
  - **Parts 2–4** (2026-06-03 extension): `xivdyetools-discord-worker` v4.6.0, `@xivdyetools/bot-i18n` v1.2.0,
    `@xivdyetools/bot-logic` v1.2.0 → `DEAD-113`–`DEAD-126`
- **Analysis Date:** 2026-05-31 (Part 1); 2026-06-03 (Parts 2–4 extension)
- **Auditor:** Claude Code (Opus 4.8)
- **Scope:** `apps/web-app` (leaf app — internal-only unused code is safe to flag) **plus** the 2026-06-03 extension covering
  `apps/discord-worker` (leaf app) and the **published** libraries `@xivdyetools/bot-i18n` + `@xivdyetools/bot-logic` (for these,
  "unused in the monorepo" ≠ dead — external npm consumers may exist, so their verdicts favor KEEP/`@internal`, not deletion)
- **Depth:** Exhaustive (hand-built import-graph reachability + symbol-level export sweep + dependency scan + git history archaeology + cross-reference against the prior 2026-02-28 audit). Parts 2–4 additionally re-verify every 2026-02-28 finding for those projects (executed vs still-open).
- **Analysis Status:** ✅ Complete (Part 1 + 2026-06-03 extension)

## Relationship to prior audits

Both passes here are follow-ups to the ecosystem-wide dead-code audit of **2026-02-28** (`../2026-02-28/`), which filed
`DEAD-001`–`DEAD-085`. **Part 1** (2026-05-31) followed up web-app (`DEAD-001`–`019`, grade **B**; removals largely executed,
`app-layout.ts`/DEAD-001 is gone) and continued the registry at `DEAD-086`. The **2026-06-03 extension** (Parts 2–4) follows up
discord-worker (`DEAD-020`–`031`), bot-i18n (`DEAD-032`–`035`), and bot-logic (`DEAD-036`–`041`), continuing at `DEAD-113`.

Several findings are explicit **continuations** of still-open 2026-02-28 items, or are **constrained by** prior adjudications:

| This audit | Relationship | Prior finding |
|------------|--------------|---------------|
| DEAD-104 (unused constants) | continuation — REMOVE rec never executed | DEAD-012 |
| DEAD-107 (barrel over-exports) | continuation | DEAD-016 |
| DEAD-105 (types.ts state interfaces) | **constrained — prior KEEP, do not remove** | DEAD-018 |
| DEAD-106 (category-icons over-exports) | thematic continuation | DEAD-013 / DEAD-014 |
| DEAD-113 (error-response.ts orphan) | continuation — 6/7 executed, this one remains | DEAD-020 |
| DEAD-114 (integration test utils) | continuation — still present | DEAD-030 |
| DEAD-116/118 (response + 7 dead exports) | continuation — all still present | DEAD-026 |
| DEAD-119 / DEAD-120 (discord-api / component-context) | continuation — still present | DEAD-024 / DEAD-025 |
| DEAD-123 (deprecated legacy commands) | continuation — now `@deprecated` | DEAD-031 |
| DEAD-126 (bot-i18n README drift) | follow-up — code removed, README stale | DEAD-032 |

> Full executed-vs-open status for all 22 prior findings of these 3 projects: see the **Carry-Forward Ledger** in
> `DEAD_CODE_REPORT.md` and `evidence/2026-06-03-carry-forward-status.txt`.

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

- `DEAD_CODE_REPORT.md` — Part 1 (web-app) report **plus** the appended 2026-06-03 extension (Parts 2–4 + carry-forward ledger).
- `findings/DEAD-086.md … DEAD-112.md` — Part 1 web-app findings (27).
- `findings/DEAD-113.md … DEAD-126.md` — 2026-06-03 extension findings (14: discord-worker DEAD-113–125, bot-i18n DEAD-126).
- `by-category/` — 8 web-app summaries **plus** `discord-worker-*.md` + `bot-packages-summary.md` for the extension.
- `evidence/` — Part 1 scan output **plus** `2026-06-03-carry-forward-status.txt` and `2026-06-03-discord-worker-symbol-sweep.txt`.

## Headline numbers

### Part 1 — web-app (2026-05-31)
- **~14 of 137 non-test source files (~10%) dead in production.**
- **~8,320 lines** of removable dead/stale code (≈6,046 production source + ≈2,274 stale test), plus **~4,443 lines** of
  dev-only mockups slated for **relocation** (DEAD-112), not deletion.
- **Health grade: C** (regression from Feb's **B**), driven almost entirely by the un-deleted v3 preset stack.

### Parts 2–4 — discord-worker + bot-* (2026-06-03)
- **14 new findings** (`DEAD-113`–`126`): 8 REMOVE, 5 KEEP/Monitor, 1 doc FIX.
- **≈770 removable production lines** + tests (dominated by `error-response.ts` ≈439).
- Of 22 prior findings, **9 executed / 6 open / 7 standing KEEP** since February.
- **Health:** discord-worker **C+ → B+**, bot-i18n **A-** (README drift only), bot-logic **A** (unchanged).

## Action taken this pass

**Nothing is executed in the 2026-06-03 extension** — it is documentation-only per the engagement (no code modified/deleted).
(Part 1's single executed change — the DEAD-112 mockup relocation to `../../historical/web-app/20260531-Mockups/` — stands.)
