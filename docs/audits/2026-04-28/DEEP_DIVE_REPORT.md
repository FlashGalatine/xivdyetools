# Deep-Dive Analysis Report — 2026-04-28 (Delta from 2026-04-07)

## Executive Summary

- **Project:** xivdyetools monorepo (11 packages + 9 applications)
- **Analysis Date:** 2026-04-28
- **Auditor:** Claude Opus 4.7
- **New Findings:** 10 (4 bugs, 3 refactoring, 1 optimization, 2 architecture)
- **Critical/High Issues:** 0
- **Companion audit (same date):** [i18n audit suite](./README.md)

This is a **delta-focused** deep-dive following the 2026-04-07 full-monorepo audit (only 21 days prior). The prior audit closed almost everything it raised; this report covers what surfaced since, with extra weight on the three priority areas:

1. The newly-added projects `@xivdyetools/worker-middleware` and `xivdyetools-api-worker`.
2. Patch 7.5 dye consolidation (itemIDs 52254 / 52255 / 52256 framework live as of today).
3. og-worker English-only display names — flagged by today's i18n audit, included here as a refactoring concern.

**Key finding:** No production-impacting bugs. The single MEDIUM bug (BUG-001) is a structured-logging consistency gap in the new api-worker; the rest of the MEDIUMs are forward-looking (test fixture drift before it bites, missing middleware in the two oldest workers, Patch 7.5 test gaps).

---

## Prior Findings Status (2026-04-07)

### Verified Still Resolved ✅

The 2026-04-07 report listed many findings as `**FIXED**` / `**NO ISSUE**` / `**CLOSED**`. Spot-checks confirmed those statuses still hold; no regressions found in this audit's scope.

### Carryovers from 2026-04-07 (no change in status)

| Prior ID | Title | Status today | Notes |
|----------|-------|--------------|-------|
| REFACTOR-002 (orig. 2026-03-18) | Inconsistent test file locations (colocated `*.test.ts` vs `__tests__/`) | **STILL DEFERRED** | Mixed pattern persists: `packages/core/src/services/dye/__tests__/` (folder), `apps/presets-api/tests/` (top-level), `apps/discord-worker/src/handlers/commands/*.test.ts` (colocated). High effort to unify; no action proposed. |
| ARCH-005 | No TypeScript project references | **STILL DEFERRED** | `tsconfig.base.json` has no `references` or `composite` keys; `tsconfig.build.json` files use independent `outDir`. Turborepo handles orchestration; TS project refs would require a multi-package refactor with marginal benefit. |

### Newly Resolved Since 2026-04-07

None observed in scope. (The prior audit's table was already comprehensive.)

---

## New Findings

### Bugs (4)

| ID | Title | Severity | Package/App |
|----|-------|----------|-------------|
| [BUG-001](bugs/BUG-001.md) | api-worker uses bare `console.error` for unhandled errors instead of structured logger pattern | **MED** | api-worker |
| [BUG-002](bugs/BUG-002.md) | Latent: `TranslationProvider.getDyeName()` returns `null` for Patch 7.5 consolidated itemIDs (52254/52255/52256) | LOW | core |
| [BUG-003](bugs/BUG-003.md) | Test fixtures use stale `'Crafting'` acquisition string after `colors_xiv.json` rename | **MED** | core (test fixtures) |
| [BUG-004](bugs/BUG-004.md) | api-worker `kvLimiter` cached at module scope without binding validation (pattern inconsistency) | LOW | api-worker |

### Refactoring Opportunities (3)

| ID | Title | Priority | Package/App |
|----|-------|----------|-------------|
| [REFACTOR-001](refactoring/REFACTOR-001.md) | og-worker hardcodes English `TOOL_NAMES`/`HARMONY_NAMES`/`VISION_NAMES`/`SHEET_NAMES`; link previews never localize | **MED** | og-worker, core |
| [REFACTOR-002](refactoring/REFACTOR-002.md) | og-worker and universalis-proxy lack the standard `@xivdyetools/worker-middleware` stack (request ID, logger) | **MED** | og-worker, universalis-proxy |
| [REFACTOR-003](refactoring/REFACTOR-003.md) | `getLogger`/`getRequestId` use `Context<any, any, any>` instead of leveraging Hono module augmentation | LOW | worker-middleware |

### Optimization Opportunities (1)

| ID | Title | Impact | Package/App |
|----|-------|--------|-------------|
| [OPT-001](optimization/OPT-001.md) | api-worker calls `LocalizationService.setLocale()` per-request without memoization | LOW | api-worker |

#### Observational Note (not filed as a finding)

- **OPT-002:** discord-worker bundle is ~8 MiB (per project memory), within the paid plan's 10 MiB ceiling but trending upward. CI's 5 MiB threshold already triggers a ⚠️ warning per [.github/workflows/ci.yml](../../.github/workflows/ci.yml) (added in 2026-04-07's ARCH-004 fix). Continue monitoring; no action.

### Architecture Concerns (2)

| ID | Title | Severity | Package/App |
|----|-------|----------|-------------|
| [ARCH-001](architecture/ARCH-001.md) | api-worker CORS `maxAge: 86400` is long for an evolving public API; presets-api/oauth precedent is 3600 | LOW | api-worker |
| [ARCH-002](architecture/ARCH-002.md) | No end-to-end tests for Patch 7.5 consolidation flow or Facewear synthetic-ID invariant | **MED** | core, discord-worker |

---

## Top Recommended Actions

Ranked by ratio of impact to effort (highest first):

### Immediate (this week)

1. **Replace `console.error` with structured logger in api-worker** ([BUG-001](bugs/BUG-001.md)). Single-file change; aligns api-worker with the 2026-04-07 observability pattern. **Effort: LOW.**
2. **Update test fixtures from `'Crafting'` → `'The Firmament'`** ([BUG-003](bugs/BUG-003.md)). 8 string replacements + 1 contract test. Prevents silent fixture/filter drift after `colors_xiv.json` rename. **Effort: LOW.**
3. **Reduce api-worker CORS `maxAge` from 86400 to 3600** ([ARCH-001](architecture/ARCH-001.md)). Single number change; matches the 2026-04-07 ARCH-002 precedent. **Effort: TRIVIAL.**

### Short term (next minor release)

4. **Add request-id and logger middleware to og-worker and universalis-proxy** ([REFACTOR-002](refactoring/REFACTOR-002.md)). ~10 lines per worker. Closes the cross-worker observability gap. **Effort: LOW.**
5. **Localize og-worker display names by adding `tools`/`harmonies`/`visions`/`sheets` to core locales** ([REFACTOR-001](refactoring/REFACTOR-001.md)). Cross-references today's [I18N_AUDIT.md](./I18N_AUDIT.md). **Effort: LOW–MEDIUM** (mostly translation work).
6. **Add Facewear synthetic-ID invariant test and Patch 7.5 fan-out integration test** ([ARCH-002](architecture/ARCH-002.md)). Cheap insurance against regressions in two pipelines that have a documented bug history. **Effort: LOW + MEDIUM.**

### Defensive / cleanup (when convenient)

7. **Drop module-scope `kvLimiter` singleton in api-worker rate-limit middleware** ([BUG-004](bugs/BUG-004.md)). Pattern consistency with `presets-api`. **Effort: TRIVIAL.**
8. **Add consolidated-ID fallback to `TranslationProvider.getDyeName()`** ([BUG-002](bugs/BUG-002.md)). Defensive hardening; not currently triggered. **Effort: LOW** (Option A: ~10 lines + 1 test).
9. **Replace `Context<any, any, any>` in worker-middleware helpers with module augmentation** ([REFACTOR-003](refactoring/REFACTOR-003.md)). Type-safety improvement for downstream callers. **Effort: LOW.**
10. **Set api-worker locale once per request via middleware** ([OPT-001](optimization/OPT-001.md)). Low immediate impact; eliminates a fragility class. **Effort: LOW.**

---

## Reading Guide

- **For a quick overview:** this report's [Executive Summary](#executive-summary) + the three "Top Recommended Actions" sections above.
- **For full methodology and scope:** [ANALYSIS_MANIFEST.md](./ANALYSIS_MANIFEST.md).
- **For individual finding details:** click any finding ID in the tables above to open the per-finding file with code excerpts, impact analysis, and recommended fix.
- **For cross-referenced i18n findings:** [I18N_AUDIT.md](./I18N_AUDIT.md), [HARDCODED_STRINGS.md](./HARDCODED_STRINGS.md). REFACTOR-001 in this report and the og-worker section in I18N_AUDIT cite the same code; the framing differs (refactoring vs i18n parity).
- **For prior context:** [2026-04-07/DEEP_DIVE_REPORT.md](../2026-04-07/DEEP_DIVE_REPORT.md) is the closest precedent and uses the same finding ID conventions.

---

**Conclusion:** The monorepo's code quality remains strong. No production-impacting issues; all findings are addressable with low effort. The bulk of the MEDIUM-priority items (BUG-001, BUG-003, REFACTOR-001, REFACTOR-002, ARCH-002) are quick wins that further harden the patterns established in 2026-04-07's middleware extraction and test-coverage push.
