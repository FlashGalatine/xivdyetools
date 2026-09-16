# Dead-code audit — xivdyetools (2026-09-15)

**17 cleanup candidates and 4 KEEP decisions** across all 17 workspaces. Proposed cleanup covers **197 source lines and 527 dedicated test lines**; no source files were modified by the audit. Baseline checks pass after stale dependency outputs were refreshed; root Knip retains its three documented exceptions.

**Executed 2026-09-16:** all 17 cleanup entries landed on `cleanup/dead-code-2026-09-15` (seven unit commits, base `c40e7e63`); see the [execution status](CLEANUP_PLAN.md#execution-status-2026-09-16) in the plan and the per-finding Status lines.

Snapshot: `main@0332fcc5768a4477301ed5b15590eee16a772f87`. Standard depth; the existing untracked security audit was preserved.

| File | Purpose |
|---|---|
| [DEAD_CODE_REPORT.md](DEAD_CODE_REPORT.md) | Verified catalog, quick wins, KEEP register, validation and limits |
| [CLEANUP_PLAN.md](CLEANUP_PLAN.md) | Ordered unit-level cleanup with prior-catalog coordination |
| [findings/](findings/) | 21 evidence-backed finding records |
| [evidence/](evidence/) | Exact commands/logs, reviewer reports, syntax references, measured spans and local bundle baselines |

`evidence/bundle-before-*/` (the seven `wrangler --dry-run` output directories, 46 MB of bundled fonts and WASM) is kept locally only, matching the 2026-09-01 audit; the `evidence/bundle-*.log` files record the measured sizes.

## Top items

1. **DEAD-001–007 (HIGH)** — web-app: eight unused methods; five have no test caller either.
2. **DEAD-009 (HIGH)** — moderation-worker: remove test-only wrappers while retaining live batched moderation behavior.
3. **DEAD-010–011 (HIGH)** — moderation-worker: retire unused logging wrappers, then their header-helper cascade.
4. **DEAD-018–021 (KEEP)** — preserve public API, parked features, reachable fallbacks and useful assertion types.

## Versions at snapshot

| Unit | Version |
|---|---|
| apps/api-worker | 0.14.0 |
| apps/discord-worker | 5.5.1 |
| apps/image-worker | 1.3.0 |
| apps/moderation-worker | 1.7.0 |
| apps/oauth | 3.1.0 |
| apps/og-worker | 2.10.0 |
| apps/presets-api | 2.3.0 |
| apps/stoat-worker | 0.3.0 |
| apps/web-app | 5.9.0 |
| packages/auth | 2.0.1 |
| packages/bot-logic | 4.2.0 |
| packages/core | 5.2.0 |
| packages/logger | 2.2.0 |
| packages/svg | 4.1.0 |
| packages/test-utils | 2.0.0 |
| packages/types | 3.2.0 |
| packages/worker-kit | 1.3.0 |
