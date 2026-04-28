# Deep-Dive Analysis Manifest — 2026-04-28

- **Project:** xivdyetools monorepo (11 packages + 9 applications)
- **Analysis Date:** 2026-04-28
- **Scope:** Full monorepo, **delta-focused** since 2026-04-07
- **Auditor:** Claude Opus 4.7
- **Audit Type:** Deep-Dive Code Analysis (bugs, refactoring, optimization, architecture)
- **Companion audit (same date):** [i18n audit suite](./README.md) — `I18N_AUDIT.md`, `LOCALE_PARITY.md`, `FONT_SUBSET_AUDIT.md`, `HARDCODED_STRINGS.md`

## Prior Audit Cross-References

| Date | Type | Scope | Findings |
|------|------|-------|----------|
| 2026-04-07 | Combined (Security + Deep-Dive) | Full monorepo | 15 new + 39 prior verified ([report](../2026-04-07/DEEP_DIVE_REPORT.md)) |
| 2026-03-18 | Deep-Dive | Full monorepo | 39 (18 bugs, 10 refactoring, 6 optimization, 5 architecture) |
| 2026-02-18 | Security | Full monorepo | Security-focused |
| 2026-02-06 | Deep-Dive + Security | discord-worker focused | Per-project findings |
| 2026-01-25 | Deep-Dive | core + cross-project | Per-project findings |
| 2026-01-22 | Combined | @xivdyetools/core only | 6 findings |

## Why a Deep-Dive Three Weeks After 2026-04-07?

The 2026-04-07 audit closed almost all of its predecessor's 39 findings and the 15 new ones it raised. This audit is a **delta check**: surface only what's new since, verify still-open items, and document the remaining areas where Patch 7.5 work plus newly-extracted packages introduce fresh surface area. The three priority focus areas requested by the user:

1. **`@xivdyetools/worker-middleware`** (extracted 2026-04-07) and **`xivdyetools-api-worker`** (added 2026-04-07) — least review history.
2. **Patch 7.5 dye consolidation** — itemIDs 52254 / 52255 / 52256 framework live as of 2026-04-28.
3. **og-worker English-only display names** — first surfaced by today's [`I18N_AUDIT.md`](./I18N_AUDIT.md), folded into this deep-dive as a refactoring concern.

## Packages Analyzed (Full Monorepo)

### Shared Libraries (`packages/`)

| Package | Read priority | Notes |
|---------|---------------|-------|
| `@xivdyetools/types` | Light | Stable |
| `@xivdyetools/crypto` | Light | Stable |
| `@xivdyetools/logger` | Light | Stable |
| `@xivdyetools/auth` | Light | No new findings since 2026-04-07 |
| `@xivdyetools/rate-limiter` | Medium | Cross-referenced from worker-middleware |
| `@xivdyetools/core` | **Heavy** | Patch 7.5 consolidation, `TranslationProvider`, test fixtures |
| `@xivdyetools/svg` | Light | Stable |
| `@xivdyetools/bot-logic` | Light | Stable |
| `@xivdyetools/bot-i18n` | Light | Stable |
| `@xivdyetools/color-blending` | Light | Stable |
| `@xivdyetools/test-utils` | Light | Stable |
| **`@xivdyetools/worker-middleware`** | **Heavy** | Newly extracted 2026-04-07 — priority focus |

### Applications (`apps/`)

| Project | Read priority | Notes |
|---------|---------------|-------|
| `discord-worker` | Medium | Confirmed middleware compliance |
| `moderation-worker` | Light | Confirmed middleware compliance |
| `presets-api` | Medium | Reference pattern for middleware adoption |
| `oauth` | Light | Confirmed middleware compliance |
| **`api-worker`** | **Heavy** | Newly added 2026-04-07 — priority focus |
| **`og-worker`** | **Heavy** | Localization gap from i18n audit |
| `universalis-proxy` | Medium | Middleware gap surfaced |
| `web-app` | Medium | `getDyeName` caller analysis for BUG-002 |
| `stoat-worker` | Light | Stable; deferred Phase 2 work acknowledged |
| `maintainer` | Light | Local dev tool only |

## Methodology

1. **Verify open prior findings.** Re-checked each item left open or deferred from [2026-04-07/DEEP_DIVE_REPORT.md](../2026-04-07/DEEP_DIVE_REPORT.md) — see "Prior Findings Status" in the [main report](./DEEP_DIVE_REPORT.md).
2. **Targeted scout sweeps** of the three priority areas via parallel Explore subagents. Scout claims were treated as candidates, then verified against the cited code before formalizing.
3. **Light cross-cutting sweeps** for: `console.*` outside [packages/logger/](../../../packages/logger/), `Context<any, any, any>` patterns, fail-open vs fail-closed defaults in middleware, wrangler config drift across the seven workers, `workspace:*` consistency, CI bundle-size thresholds, TS project references.
4. **Each candidate verified before formalizing.** Severities are calibrated against the precedent in [2026-04-07/DEEP_DIVE_REPORT.md](../2026-04-07/DEEP_DIVE_REPORT.md). Two candidates were downgraded during verification (BUG-002 from MEDIUM to LOW after caller analysis showed the gap is latent only; BUG-004 from MEDIUM to LOW because CF Workers don't swap KV bindings).

## Findings Summary

| Category | Count | Severities |
|----------|-------|------------|
| Bugs | 4 | 1 MED, 3 LOW |
| Refactoring | 3 | 2 MED, 1 LOW |
| Optimization | 1 | 1 LOW |
| Architecture | 2 | 1 MED, 1 LOW |
| **Total new findings** | **10** | 4 MED, 6 LOW (0 HIGH, 0 CRITICAL) |
| Carryovers (no separate file) | 2 | REFACTOR (test file locations), ARCH-005 (TS project refs) |
| Observational notes | 1 | OPT-002 bundle headroom |

See [DEEP_DIVE_REPORT.md](./DEEP_DIVE_REPORT.md) for the full report.

## Key Source Files Read

### Patch 7.5 consolidation
- [`packages/core/src/config/consolidated-ids.ts`](../../../packages/core/src/config/consolidated-ids.ts) — `CONSOLIDATED_DYES`, `getMarketItemID`, `getConsolidatedDyeName`, `isConsolidationActive`
- [`packages/core/src/services/localization/TranslationProvider.ts`](../../../packages/core/src/services/localization/TranslationProvider.ts) — `getDyeName(itemID, locale)` general lookup
- [`packages/core/src/services/dye/DyeDatabase.ts`](../../../packages/core/src/services/dye/DyeDatabase.ts) — confirmed 52254/52255/52256 are NOT merged into `allDyes()`
- [`packages/core/scripts/dyenames.csv`](../../../packages/core/scripts/dyenames.csv) — confirmed no rows for consolidated IDs
- 8 test files under [`packages/core/src/services/dye/__tests__/`](../../../packages/core/src/services/dye/__tests__/) — fixture drift

### Newly extracted / added projects
- [`packages/worker-middleware/src/logger.ts`](../../../packages/worker-middleware/src/logger.ts), [`request-id.ts`](../../../packages/worker-middleware/src/request-id.ts), `rate-limit.ts`
- [`apps/api-worker/src/index.ts`](../../../apps/api-worker/src/index.ts) — global middleware chain, error handler
- [`apps/api-worker/src/middleware/rate-limit.ts`](../../../apps/api-worker/src/middleware/rate-limit.ts) — module-scope KV singleton
- [`apps/api-worker/src/routes/dyes.ts`](../../../apps/api-worker/src/routes/dyes.ts), [`match.ts`](../../../apps/api-worker/src/routes/match.ts) — locale handling

### Cross-cutting
- [`apps/og-worker/src/index.ts`](../../../apps/og-worker/src/index.ts), [`og-data-generator.ts`](../../../apps/og-worker/src/og-data-generator.ts) — middleware gap, hardcoded English
- [`apps/universalis-proxy/src/index.ts`](../../../apps/universalis-proxy/src/index.ts) — middleware gap
- All `apps/*/wrangler.toml` (read at scout time) — confirmed `nodejs_compat` removed everywhere; compatibility dates aligned at 2024-12-01
- 30+ `getDyeName` callers across `apps/web-app/src/components/` — caller analysis for BUG-002

## What Was NOT Re-Audited

Out of scope for this delta-focused pass:

- Areas where 2026-04-07 logged a clean fix (BUG-001 through BUG-018, OPT-001 through OPT-006, ARCH-001 through ARCH-004, REFACTOR-001 through REFACTOR-010 from the prior audit) unless a new signal warranted re-checking.
- The XIVAuth (Rails) and stoatchat (Rust) projects in the parent workspace — separate audit cadences.
- Generated locale JSONs — covered by today's companion [I18N_AUDIT.md](./I18N_AUDIT.md).
- Build artifacts (`dist/`, `coverage/`).

## Conclusion

No critical or high-severity issues. The monorepo continues to demonstrate the strong code-quality posture established by the 2026-04-07 audit. The 10 new findings are evenly split between code hygiene (BUG-001, BUG-004, REFACTOR-002, REFACTOR-003, ARCH-001) and forward-looking defensive work for areas the previous audit didn't reach (BUG-002 latent, BUG-003 fixture drift, REFACTOR-001 og-worker, OPT-001 locale, ARCH-002 test gaps).

**Next steps:** Remediate findings as a separate task. The OPEN status on each finding file is intended to be updated to RESOLVED when the corresponding fix lands, mirroring the convention established in [2026-04-07/](../2026-04-07/).
