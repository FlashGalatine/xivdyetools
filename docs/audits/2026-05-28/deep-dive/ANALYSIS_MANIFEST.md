# Deep-Dive Analysis Manifest

- **Project:** XIV Dye Tools monorepo (`xivdyetools/`)
- **Analysis Date:** 2026-05-28
- **Scope:** `@xivdyetools/core` algorithms (k-d tree, APIService/Universalis batching), worker request handlers (og-worker, discord-worker budget), build tooling (font subsetting), cross-file data consistency
- **Method:** Static review. No code modified. Findings documented before any change.

## Focus Areas

1. **Hidden bugs** — correctness issues that evade unit tests (cold-cache paths, boundary conditions, unvalidated casts).
2. **Refactoring** — duplication and drift risk in security-sensitive primitives.
3. **Optimization** — bundle size and request efficiency.

## Notable Verified-Correct Components (not defects)

- **k-d tree** (`packages/core/src/utils/kd-tree.ts`): median-split construction; far-side pruning `|target-node| <= best.distance` is correct and handles `excludeData` (pruning keyed off best *non-excluded* distance) and splitting-plane duplicates. No correctness bug.
- **Auth primitives** (`@xivdyetools/auth`): HS256 pinning, timing-safe verify, length-safe equality. (See security audit.)
- **SQL layer** (presets-api): fully parameterized, ORDER BY whitelisted, LIKE escaped. (See security audit.)

## Findings Index

| ID | Title | Severity/Priority |
|----|-------|-------------------|
| BUG-001 | `APIService` batch methods don't chunk; throw uncaught above 100 items | MEDIUM (latent) |
| BUG-002 | og-worker casts string enum params without membership validation | LOW |
| REFACTOR-001 | Two divergent JWT verifier implementations | HIGH priority / MEDIUM effort |
| REFACTOR-002 | KR font subset codepoint scoping (shared with i18n audit) | MEDIUM priority / LOW effort |
| OPT-001 | KR subset font ~595 KiB recoverable | HIGH impact / LOW effort |
| OPT-002 | (Observation) existing optimizations are strong — see report | — |
