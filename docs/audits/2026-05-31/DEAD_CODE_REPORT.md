# Dead Code Analysis Report — web-app (2026-05-31) + discord-worker & bot-* (2026-06-03 extension)

> **This folder now holds two appended dead-code follow-ups that share the global `DEAD-NNN` registry:**
> - **Part 1 — web-app** (2026-05-31): findings `DEAD-086`–`DEAD-112` (immediately below).
> - **Parts 2–4 — discord-worker + bot-i18n + bot-logic** (2026-06-03 extension): findings `DEAD-113`–`DEAD-126`
>   (appended at the **end** of this file under the "2026-06-03 Extension" heading).
>
> Both are *delta follow-ups* to the ecosystem-wide **2026-02-28** audit (`../2026-02-28/`, `DEAD-001`–`DEAD-085`), each
> re-verifying its slice of those prior findings (web-app = `DEAD-001`–`019`; discord-worker = `DEAD-020`–`031`;
> bot-i18n = `DEAD-032`–`035`; bot-logic = `DEAD-036`–`041`) and continuing the registry rather than restarting.

# Part 1 — Web App (DEAD-086–112)

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

---

# 2026-06-03 Extension — discord-worker + bot-* (Parts 2–4)

## Extension Executive Summary

- **Projects:** `xivdyetools-discord-worker` v4.6.0, `@xivdyetools/bot-logic` v1.2.0, `@xivdyetools/bot-i18n` v1.2.0
- **Analysis Date:** 2026-06-03
- **Analysis Depth:** Exhaustive delta (per-symbol monorepo-wide grep sweeps + `tsc` reasoning + carry-forward re-verification
  of every 2026-02-28 finding for these three projects). Tooling note matches Part 1: knip/ts-prune/depcheck are not installed;
  detection is hand-built.
- **New Findings:** 14 (`DEAD-113`–`DEAD-126`, continuing the registry past `DEAD-112`)
- **Recommended Removals:** 8 (`DEAD-113`–`120`) · **Keep/Monitor:** 4 (`DEAD-121/122/123/125`) · **Monitor:** 1 (`DEAD-124`) · **Fix (docs):** 1 (`DEAD-126`)
- **Estimated removable lines:** ≈770 production source + their tests (dominated by `error-response.ts` ≈439)
- **Headline:** This is overwhelmingly a **clean-up confirmation**. The big February items for discord-worker were **executed** —
  the entire `src/locales/` duplicate (DEAD-021, ~4,422 lines), 6 of 7 dead service/util files (DEAD-020, ~1,450 lines),
  the legacy `mixer.ts` handler (DEAD-022), the `discord-interactions` devDep (DEAD-023), and the legacy KV language setters
  (DEAD-029) are all gone. What remains is a long tail of smaller still-open exports + intentional deprecation shims.

## Health Scores

| Project | Feb grade | Now | Rationale |
|---------|:---:|:---:|-----------|
| discord-worker | **C+** | **B+** | ~6,300 of the ~6,800 Feb dead lines were removed; remaining dead is ≈770 lines (one orphan file + test-only exports). 0 production TODOs except one (DEAD-124). |
| @xivdyetools/bot-logic | A | **A** | Unchanged — every export is published-API KEEP; zero legacy markers in source (DEAD-041 resolved). |
| @xivdyetools/bot-i18n | (clean) | **A-** | Code is clean (DEAD-032/034/035 executed); the only defect is a stale **README** documenting 3 removed functions (DEAD-126). |

---

# Part 2 — Discord Worker (DEAD-113–125)

## Discord Worker — Summary by Category

| Category | Findings | Remove | Keep/Monitor | Lines (approx) |
|----------|----------|--------|--------------|----------------|
| Orphaned file (cont. DEAD-020) | DEAD-113 | 1 | 0 | ~439 |
| Stale test code (cont. DEAD-030) | DEAD-114 | 1 | 0 | test-only |
| Unused exports — new | DEAD-115, 116, 117 | 3 | 0 | ~105 |
| Unused exports — continuations | DEAD-118 (026), 119 (024), 120 (025) | 3 | 0 | ~250 |
| Legacy/deprecated | DEAD-121, 122, 123, 124, 125 | 0 | 5 | (shims/markers) |
| **Total** | **13** | **8** | **5** | **≈770** |

## Discord Worker — Quick Wins (HIGH confidence)

| ID | Description | Lines |
|----|-------------|-------|
| DEAD-113 | `utils/error-response.ts` — last surviving DEAD-020 orphan | ~439 |
| DEAD-114 | `test-utils.integration.ts` — abandoned integration harness | test |
| DEAD-115 | `emoji.ts` 3 test-only fns (`getDyeEmojiOrFallback`/`hasDyeEmoji`/`getEmojiCount`) | ~25 |
| DEAD-116 | `response.ts` `embedResponse` (cont. 026) + `autocompleteResponse` (new) | ~30 |
| DEAD-118 | 7 remaining DEAD-026 dead type/const/fn exports across 5 files | ~minor |
| DEAD-119 | `discord-api.ts` `InteractionContext` + deadline helpers (cont. 024) | ~100 |
| DEAD-120 | `component-context.ts` 7 unused UI builders (cont. 025) | ~125 |

## Discord Worker — Recommended Removals (verify first)

| ID | Description | Verify before removing |
|----|-------------|------------------------|
| DEAD-117 | `price-cache.ts` `getCachedPriceWithStale` + `invalidateCachedPrice` | **Keep `getCachedPrices`** (has 1 internal caller); `tsc` |

## Discord Worker — Keep / Monitor

| ID | Item | Reason |
|----|------|--------|
| DEAD-121 | `types/preset.ts` 4 `@deprecated` re-export blocks | migration debt — **still consumed** by `preset.ts`/`preset-api.ts`; migrate then remove at next major |
| DEAD-122 | `preferences.ts` legacy KV migration shim | **live** back-compat (runs on every preference read); retire only after a migration sunset |
| DEAD-123 | `favorites`/`collection`/`language` commands (now `@deprecated`) | live, user-facing; routed in `index.ts`; retire on a deliberate schedule (cont. DEAD-031) |
| DEAD-124 | `extractor.ts:263` TODO | only production TODO; implement or file an issue |
| DEAD-125 | empty `modals/index.ts` + `handleModal` "Unknown modal" fallback | intentional future-modal scaffolding |

---

# Part 3 — bot-i18n (DEAD-126)

| ID | Title | Action | Reason |
|----|-------|--------|--------|
| DEAD-126 | README documents 3 removed functions (`translate`, `getAvailableLocales`, `isLocaleSupported`) | **FIX** | DEAD-032 removed them from code; the **published** README still shows them — consumers copy-pasting hit import errors |

> bot-i18n code is clean: the unused locale key sections (DEAD-034: `buttons`/`pagination`/`components`/`status`/`matching`)
> are **gone** from all 6 locale JSONs, and the 5 unused discord-worker re-exports (DEAD-035) are **gone**. `LocaleData` /
> `TranslatorLogger` (DEAD-033) remain exported — **KEEP** (published API).

---

# Part 4 — bot-logic (no new findings)

bot-logic re-confirms its February grade-**A** verdict: every barrel export is intentional published-SDK surface and there is
**zero** dead code in the traditional sense. Spot-checks: `resolveCssColorName` (DEAD-036) is **not** in the public barrel
(internal-only, as Feb recommended); `HARMONY_TYPES`/`VISION_TYPES` (DEAD-037) and all Input/Result/`EmbedData` types
(DEAD-038/039/040) remain KEEP; a sweep for `REFACTOR`/`HACK`/`FIXME`/`@deprecated`/`TODO` across `packages/bot-logic/src`
returns **0 matches** (DEAD-041 resolved). No `DEAD-NNN` IDs were filed for bot-logic this pass.

---

## Prior-Audit Carry-Forward Ledger (2026-02-28 → 2026-06-03)

Status of every February finding for these three projects (see also `evidence/2026-06-03-carry-forward-status.txt`):

| Feb ID | Project | Feb rec | Status now | This pass |
|--------|---------|---------|------------|-----------|
| DEAD-020 | discord-worker | REMOVE 7 files | **6/7 executed**; `error-response.ts` remains | → DEAD-113 |
| DEAD-021 | discord-worker | REMOVE `src/locales/` | **EXECUTED** (dir gone) | resolved |
| DEAD-022 | discord-worker | REMOVE `mixer.ts` | **EXECUTED** (only `mixer-v4.ts` exists) | resolved |
| DEAD-023 | discord-worker | REMOVE devDep | **EXECUTED** (absent from package.json) | resolved |
| DEAD-024 | discord-worker | REMOVE InteractionContext | **OPEN** (def+test only) | → DEAD-119 |
| DEAD-025 | discord-worker | REMOVE 7 builders | **OPEN** (def+test only) | → DEAD-120 |
| DEAD-026 | discord-worker | REMOVE 8 exports | **OPEN** (all 8 still present) | → DEAD-118 (7) + DEAD-116 (embedResponse) |
| DEAD-027 | discord-worker | KEEP (params) | unchanged | KEEP (cross-ref) |
| DEAD-028 | discord-worker | KEEP (test-only) | unchanged | KEEP (cross-ref) |
| DEAD-029 | discord-worker | REMOVE KV lang setters | **EXECUTED** (functions gone) | resolved |
| DEAD-030 | discord-worker | REMOVE integration utils | **OPEN** (file present) | → DEAD-114 |
| DEAD-031 | discord-worker | KEEP/Monitor legacy cmds | **OPEN** + now `@deprecated` | → DEAD-123 |
| DEAD-032 | bot-i18n | REMOVE 3 functions | **EXECUTED in code**; README stale | → DEAD-126 |
| DEAD-033 | bot-i18n | KEEP types | unchanged | KEEP (cross-ref) |
| DEAD-034 | bot-i18n | REMOVE locale sections | **EXECUTED** (sections gone) | resolved |
| DEAD-035 | bot-i18n | REMOVE 5 re-exports | **EXECUTED** (re-exports gone) | resolved |
| DEAD-036–040 | bot-logic | KEEP (published API) | unchanged | KEEP (cross-ref) |
| DEAD-041 | bot-logic | clean REFACTOR markers | **EXECUTED** (0 markers) | resolved |

**Net:** of the 22 February findings for these projects, **9 were executed**, **6 remain open** (re-filed as DEAD-113/114/116/118/119/120/123 + the DEAD-126 doc follow-up), and **7 were standing KEEPs** (DEAD-027/028/033/036–040).

## Extension Cleanup Plan (documented; NOT executed — audit only)

> Per the engagement, nothing is deleted this pass. Waves below are for a later cleanup PR.

### Wave A — Safe deletes (no cascade)
`utils/error-response.ts` + test (DEAD-113); `test-utils.integration.ts` (DEAD-114); emoji 3 fns + tests (DEAD-115);
`response.ts` `embedResponse`/`autocompleteResponse` + tests (DEAD-116). Then `type-check` + `test`.

### Wave B — Continuation removals (verify with `tsc`)
DEAD-118 (7 DEAD-026 symbols across 5 files), DEAD-119 (`discord-api.ts` InteractionContext), DEAD-120
(`component-context.ts` builders), DEAD-117 (price-cache pair — **keep `getCachedPrices`**). Then `type-check` + `test`.
This lets DEAD-020/024/025/026/030 all be marked resolved.

### Wave C — Docs + deprecation hygiene
DEAD-126 (fix bot-i18n README, re-publish with next bump). Add removal-target versions to the DEAD-121/123 `@deprecated`
markers; decide a sunset for DEAD-122's migration; resolve DEAD-124's TODO (implement or file an issue).

## Extension Post-Cleanup Verification (per wave, when executed)
- [ ] `pnpm --filter xivdyetools-discord-worker run type-check`
- [ ] `pnpm --filter xivdyetools-discord-worker run test -- --run` (and `run test:integration`)
- [ ] `pnpm --filter xivdyetools-discord-worker run lint`
- [ ] `pnpm turbo run build test --filter=@xivdyetools/bot-i18n` after the README/version change
- [ ] bot-logic: no changes needed
