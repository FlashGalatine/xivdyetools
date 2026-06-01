# Deep-Dive Analysis Report — XIV Dye Tools

## Executive Summary

- **Project:** XIV Dye Tools monorepo
- **Analysis Date:** 2026-05-28
- **Total findings:** 2 bugs, 2 refactors, 1 optimization (plus cross-references to the i18n & security audits)
- **Overall code health:** **Strong.** The core algorithms are correct and already optimized; the
  notable defects are a latent library boundary bug and a build-pipeline inefficiency.

This codebase is unusually disciplined — most "deep dive" suspects (the k-d tree, the SQL layer,
the auth primitives) were investigated and found **correct and well-engineered**, with prior fixes
tagged inline (`CORE-BUG-003 FIX`, `BUG-010`, `FINDING-011`). The findings below are the residue.

## Summary by Category

### Hidden Bugs
| ID | Title | Severity | Type |
|----|-------|----------|------|
| [BUG-001](bugs/BUG-001.md) | `APIService` batch methods don't chunk; throw uncaught above 100 items | MEDIUM (latent) | Boundary / error-handling |
| [BUG-002](bugs/BUG-002.md) | og-worker casts string enum params without membership validation | LOW | Input validation |

### Refactoring Opportunities
| ID | Title | Priority | Effort |
|----|-------|----------|--------|
| [REFACTOR-001](refactoring/REFACTOR-001.md) | Consolidate the two divergent JWT verifiers | HIGH | MEDIUM |
| REFACTOR-002 | Scope KR font subset codepoints (see OPT-001 / i18n F-2) | MEDIUM | LOW |

### Optimization Opportunities
| ID | Title | Impact | Category |
|----|-------|--------|----------|
| [OPT-001](optimization/OPT-001.md) | KR subset font ~595 KiB recoverable | HIGH | Bundle size |

## Verified-Correct (investigated, no defect)

These were examined specifically because they're the kind of code that hides bugs — and held up:

- **k-d tree nearest-neighbour** (`utils/kd-tree.ts`): correct median-split build; far-side pruning
  `Math.abs(targetValue - nodeValue) <= best.distance` is sound and correctly interacts with
  `excludeData` (pruning is keyed off the best *non-excluded* distance, so excluded nodes can't
  cause a premature prune) and with splitting-plane duplicates (`<` split + `<=` prune). The
  `CORE-BUG-003 FIX` comment marks a previously-corrected pruning bug.
- **APIService cache + dedup** (`getPricesForItems`): parallel cache checks via `Promise.all`,
  uncached-only fetch, cache-key type prefixes to prevent collisions, datacenter sanitization.
  (Only the >100 chunking is missing — BUG-001.)
- **discord-worker `/budget`**: correctly chunks (`fetchPricesBatched`), dedups to consolidated
  market IDs, and filters `itemID > 0` before fetching — the prior 2026-02 bugs are fixed *here*
  (but the fix didn't reach core — BUG-001).
- **og-worker numeric param validation** (FINDING-011): all `parseInt` results NaN-guarded with 400.

## Existing optimizations worth preserving (don't regress)

- k-d tree **index-based construction** (no point-array slicing → less GC).
- 36×10° **hue buckets** for harmony lookups (70-90% speedup, per core docs).
- `@xivdyetools/auth` **CryptoKey LRU cache** (avoids re-`importKey` per request).
- universalis-proxy **request coalescing** + Cache-API SWR.
- presets-api **module-level in-flight dedup** for category list during CDN misses.

## Priority Matrix

### Immediate (high value, low effort)
- **OPT-001** — re-scope KR subset (~595 KiB) + re-subset for the 9 stale glyphs (i18n F-1). One commit.
- **BUG-002** — add enum validation in og-worker handlers (small, mirrors existing numeric guards).

### Plan next (high value, higher effort)
- **REFACTOR-001 / BUG-001** — consolidate JWT verifiers and fix `APIService` chunking. Both touch
  published library code with cross-service contracts; do behind tests, coordinate version bumps.

### Backlog
- Add CI guards: font-coverage check (i18n), `pnpm audit` gate (security), JWT contract test (refactor).

## Cross-References
- **i18n audit:** font staleness (9 glyphs) + KR bloat (OPT-001), og-worker localization inconsistency.
- **security audit:** FINDING-002 (oauth alg pinning) is resolved by REFACTOR-001.

## Recommendations
1. Treat `@xivdyetools/core` and `@xivdyetools/auth` as the canonical implementations and ensure
   per-worker reimplementations either don't exist (JWT) or are kept in sync (the budget chunking
   fix should be back-ported into core — BUG-001).
2. Add the three CI guards above so the fixed issues stay fixed.
3. No code was modified by this analysis — review and approve before remediation.
