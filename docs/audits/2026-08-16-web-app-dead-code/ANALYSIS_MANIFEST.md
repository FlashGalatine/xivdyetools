# Dead Code Analysis Manifest — web-app

- **Project:** `apps/web-app` (xivdyetools-web-app 5.0.0 — Vite + Lit + Tailwind v4)
- **Analysis Date:** 2026-08-16
- **Branch:** `monorepo-2.0-prep` at `950660e`
- **Scope:** `apps/web-app/` only — `src/`, `public/`, `assets/`, `scripts/`, `functions/`, `e2e/`, root config, `package.json`
- **Depth:** standard (symbol-level: exports, types, CSS, i18n keys, deps, config, assets)
- **Prior sweeps:** `2026-02-28` (monorepo), `2026-05-31`, `2026-08-09-prerelease-monorepo-upgrade` (monorepo; web-app found clean at *file* level — DEAD-001…005 there are already closed by commits `98d136b`, `f0d50bd`, `23aef5c`, `7bbbe5e`)
- **Finding numbering:** `DEAD-001` restarts in this folder; qualify as `2026-08-16-web-app-dead-code/DEAD-nnn` elsewhere
- **Analysis Status:** Complete — 29 findings; see [DEAD_CODE_REPORT.md](DEAD_CODE_REPORT.md). **No code was modified.**

## Evidence

| File | Contents |
|------|----------|
| `evidence/knip-report.txt` | knip 6.32 default mode (test files as entries) |
| `evidence/knip-production-report.txt` | knip `--production` (test files ignored → test-only symbols) |
| `evidence/tsc-unused.txt` | `tsc --noUnusedLocals --noUnusedParameters` — 19 hits (15 non-test) |
| `evidence/depcheck-report.json` | depcheck (alias false positives noted in the report) |
| `evidence/i18n-unused-keys.txt` | output of the repo's own `scripts/analyze-unused-keys.js` (507) |
| `evidence/i18n-unused-keys-full.txt` | stricter tiered dump (632; HIGH/MEDIUM-HIGH/MEDIUM/LOW) |
| `evidence/barrel-classification.txt` | per-name classification of the services barrel re-exports |
| `evidence/shadow-dom-css-check.md` | **empirical** computed-style probe of the built app (Playwright) |
| `evidence/agent-report-ts-symbols.md` | verification pass — TS symbols, private members, legacy markers |
| `evidence/agent-report-css.md` | verification pass — dead / unreachable CSS |
| `evidence/agent-report-i18n.md` | verification pass — 472 dead keys + 160 false positives |
| `evidence/agent-report-non-source.md` | verification pass — scripts, e2e, test infra, `public/`, config, docs |

## Execution Status

| Wave | Status | Commit | Notes |
|------|--------|--------|-------|
| 1 — isolated deletions (DEAD-001..007, 013, 014, 019 `v4-utilities.css`, 023, 024, 027, 029 + `convert-icons-to-webp.js`) | **DONE 2026-08-16** | `b1c4af4` | +29 / −3,830; ~3.9 MB of assets; two prod 404s fixed on the way. DEAD-027's three fixture exports were re-checked and are live — kept. |
| 2 — symbol removals (DEAD-008, 009, 010, 011, 012, 015, 016, 017, 028) + `noUnusedLocals`/`noUnusedParameters` → `true` | **DONE 2026-08-16** | see `git log` (the commit after `b1c4af4`) | +53 / −2,104 across 48 files. Main entry chunk 101.9 → 87.8 kB, `modals` 277 → 273 kB. Coverage after: 71.81 / 56.37 / 65.62 / 72.9 vs ratchet 71 / 55 / 65 / 72 — **no ratchet change needed**. Judgment calls: `destroyV4Layout` removed (SPA never unmounts; `languageUnsubscribe`/`configUnsubscribe` holders went with it); `DisplayOptionsChangeCallback` KEPT (it types the live `applyDisplayOptions` `onChange` — the report's DROP-EXPORT-ONLY verdict was right, my first cut was wrong); `createInfoIcon` stays exported (its tests exercise it directly); type exports in the DROP-EXPORT-ONLY list were left exported (idiomatic, zero cost) — only value symbols lost `export`; `dye-grid._isFocused` deleted with a breadcrumb comment (initial roving-tabindex is a separate a11y follow-up, not done here); `findHarmonyDyes` in `harmony-generator.ts` is now consumed only by tests after `findHarmonyDyesInternal` went — left in place, flagged. |
| 3 — CSS (DEAD-019 remainder, 020 with the shadow-side move first, 021) + i18n (DEAD-022) + DEAD-030 | **DONE 2026-08-16** | see `git log` (the commit after `b3b7f25`) | 472 i18n keys pruned from all six locales (1,528 → 1,056 keys; en 77.4 → 57.2 KB; validator green, 1,012 literal refs). CSS: `globals.css` 916 → 577, `v4-layout.css` 863 → 25 (host/print only), `themes.css` 532 → 446, `v4-utilities.css` gone (Wave 1); new `tool-content.css` loaded in BOTH scopes; built CSS 80.8 → 63.1 kB. `tailwind.config.js` `content`/`heading`/`numeric` removed. New DEAD-030 (`HarmonyType` never constructed → `harmony-type.ts` + `info-tooltip.ts` + tests deleted). Verification: 18 before/after screenshots pixel-identical except the intended `.number` change; `/swatch` `.number` now computes Fragment Mono + `tabular-nums` inside the shell (was Onest/normal). Coverage 71.76/56.3/65.82/72.85 vs ratchet 71/55/65/72 — no change. One load-sensitive test (`extractor-tool.test.ts` 'caps the roll at twenty entries') got a 20 s timeout: it sits at the 5 s edge under coverage instrumentation only when the whole suite competes; assertions untouched. |
| 4 — corrections + guardrails (DEAD-018, 025, 026 `analyze-unused-keys.js`, knip in CI, `validate-i18n.js` orphan gate) | pending | | |
