# Pre-Release Audit Manifest — Monorepo 2.0 / Web-App 5.0

- **Project:** xivdyetools (pnpm + Turborepo monorepo)
- **Analysis Date:** 2026-08-09
- **Branch:** `monorepo-2.0-prep` (working tree clean at `58dbe2f`)
- **Scope:** all 8 packages + all 8 apps — 16 workspaces, ~253,000 lines of TypeScript
- **Audits run:** deep-dive-analysis · security-audit · dead-code-finder · i18n-manager
- **Design record used as conformance baseline:**
  `XIVDyeTools-redesign-5.0/CLAUDE.md` (current-state record) and
  `XIVDyeTools-redesign-5.0/Decisions.md` (decision register)
- **Purpose:** pre-release soundness / stability check. **No code was modified.**

## Baseline Health (measured, not assumed)

| Gate | Command | Result |
|------|---------|--------|
| Type-check | `pnpm turbo run type-check` | ✅ **24/24 tasks pass** |
| Tests | `pnpm turbo run test --force` (uncached) | ✅ **24/24 tasks — 8,262 tests across 320 test files, all pass** |
| Build | implied by type-check + test task graph | ✅ passing |
| Dependency audit | `pnpm audit` | ⚠️ **18 advisories** (1 critical, 5 high, 10 moderate, 2 low) |

Per-workspace test files: core 41 · discord-worker 41 · web-app 76 · test-utils 27 ·
presets-api 17 · bot-logic 15 · moderation-worker 15 · og-worker 15 · api-worker 12 ·
oauth 11 · stoat-worker 11 · svg 11 · worker-kit 9 · logger 8 · auth 7 · types 4.

**Headline:** the repository is in good shape. Every correctness gate the project defines is
green. The findings below are overwhelmingly *conformance drift* (implementation vs. the 5.0
design record), *stale build artefacts*, and *dependency freshness* — not broken logic.

## Workspace Scale

| Workspace | Files | Lines |
|-----------|------:|------:|
| apps/web-app | 222 | 100,660 |
| apps/discord-worker | 109 | 29,839 |
| packages/core | 86 | 32,732 |
| apps/moderation-worker | 42 | 14,527 |
| apps/presets-api | 46 | 14,119 |
| packages/test-utils | 61 | 11,089 |
| apps/oauth | 28 | 7,670 |
| packages/svg | 29 | 7,402 |
| apps/og-worker | 39 | 7,223 |
| packages/bot-logic | 35 | 5,416 |
| apps/api-worker | 36 | 5,206 |
| packages/logger | 22 | 4,557 |
| packages/worker-kit | 25 | 4,232 |
| packages/types | 37 | 3,447 |
| apps/stoat-worker | 25 | 2,920 |
| packages/auth | 17 | 2,523 |

## Deploy Units in Scope

The release boundaries this codebase ships along — each is a candidate sprint.

| Deploy Unit | Type | Ships via |
|-------------|------|-----------|
| `@xivdyetools/types` | npm package | version bump + OIDC publish |
| `@xivdyetools/logger` | npm package | version bump + OIDC publish |
| `@xivdyetools/auth` | npm package | version bump + OIDC publish |
| `@xivdyetools/worker-kit` | npm package | version bump + OIDC publish |
| `@xivdyetools/core` | npm package | version bump + OIDC publish |
| `@xivdyetools/svg` | npm package | version bump + OIDC publish |
| `@xivdyetools/bot-logic` | npm package | version bump + OIDC publish |
| `@xivdyetools/test-utils` | workspace-private | not published |
| `discord-worker` | CF Worker | `wrangler deploy` (+ `register-commands` when schemas change) |
| `moderation-worker` | CF Worker | `wrangler deploy` |
| `presets-api` | CF Worker + D1 | `wrangler deploy` (+ migrations) |
| `oauth` | CF Worker + D1 | `wrangler deploy` |
| `api-worker` | CF Worker + assets | `wrangler deploy` |
| `og-worker` | CF Worker | `wrangler deploy` |
| `stoat-worker` | Node.js | **parked — no active investment** |
| `web-app` | Vite → CF Pages | build + Pages deploy |

## Finding Numbering

Each prefix restarts at `001` for this audit folder. `BUG-001` and `FINDING-001` coexisting is
correct, not a collision. Outside this folder, qualify every ID as
`2026-08-09-prerelease-monorepo-upgrade/BUG-001`.

## Evidence

Raw tool output is preserved in [`evidence/`](evidence/):

| File | Contents |
|------|----------|
| `type-check.txt` | Turborepo type-check run — 24/24 pass |
| `test-run-forced.txt` | Uncached full test run — per-workspace table, 8,262 tests / 320 files. *Condensed from 705 KB of raw scrollback; counts and per-task results retained, per-assertion output and ANSI escapes stripped.* |
| `test-run.txt` | First (cached) test run, retained for comparison — 23 of 24 tasks were cache hits, which is why the forced re-run was needed |
| `pnpm-audit.json` | Machine-readable dependency advisories (18) |
| `i18n-parity.txt` | Key parity / duplicate / interpolation analysis, all 3 locale trees |
| `font-subset-audit.txt` | Unscoped first pass + full font inventory — **superseded**, retained only to document the correction |
| `font-subset-scoped.txt` | **Authoritative** per-worker glyph coverage, scoped to each worker's own subsetter inputs |
| `potential-secrets.txt` | Hardcoded-secret scan — 0 hits. The scan parameters are recorded in the file; an empty result set *is* the evidence |

## Method Note — Scoping Matters

The first font pass pooled *all three* locale trees and reported ~1,500 missing glyphs across
both graphics workers. That was a **false positive**: each worker's `subset-cjk-fonts.py` reads
only its own inputs (`discord-worker` = core + bot-logic; `og-worker` = core + og card
strings), and neither renders `web-app` strings. Re-scoped to each subsetter's real inputs, the
true numbers are 128 missing glyphs in `discord-worker` and **zero** in `og-worker`. The scoped
run is the one to trust; the unscoped file is retained only to show the correction.
