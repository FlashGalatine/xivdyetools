# Dead-code audit — xivdyetools, preview of the 2026-10-04 batch merge (2026-10-04)

**64 findings: 46 cleanup entries and 18 KEEP decisions** across all 17 workspaces plus root scripts and CI.
- The cleanup covers **1,554 source lines and 2,217 dedicated test lines**.
- Two findings were introduced by open PRs: DEAD-001 by #225 and DEAD-002 by #227. The other 62 are already on `main`.
- Fourteen of the KEEP entries are published package API, which only a planned major release can remove.
- **No source files were modified by the audit.**

**What was audited:** not `main`, but a **local, never-pushed preview branch**, `preview/integration-2026-10-04@1e842b20`. It is `main@8ecb878f` with the 13 PRs open on 2026-10-04 merged in, so it is the code that will be on `main` after the batch merge. The exact heads, merge order and conflicts are in [evidence/preview-branch.md](evidence/preview-branch.md).

**What else the preview found:** running the full gate on it also found one **merge-batch blocker**, which is not a dead-code finding.
- **What:** a comment that PR #224 adds to presets-api breaks a moderation-worker contract test.
- **Why CI missed it:** neither PR's affected-only CI runs that pairing.
- See the report's *Merge-batch results*.

| File | Purpose |
|---|---|
| [DEAD_CODE_REPORT.md](DEAD_CODE_REPORT.md) | Catalog, merge-batch results, quick wins, KEEP register, evidence and baseline, rejected suspicions |
| [CLEANUP_PLAN.md](CLEANUP_PLAN.md) | Sprint 0 inside the open PRs, then 10 one-unit sprints, plus the package-major backlog |
| [findings/](findings/) | 64 finding records (DEAD-001 – DEAD-064) |
| [evidence/](evidence/) | Gate and tool logs, per-unit reviewer reports (`review-*.md`), every verifier verdict (`verdicts.tsv`, `workflow-result.json`), bundle sizes, and the scripts used (`scripts/`) |

The `wrangler --dry-run` output directories (`evidence/bundle-before-*/`, tens of MB of bundled fonts and WASM) are kept locally only, as in the earlier dead-code audits. The `evidence/bundle-*.log` files record the sizes.

## Top items

1. **DEAD-001 (HIGH/LOW)** — moderation-worker: five strings orphaned by PR #225's button rewrite. Delete them inside #225 before the merge.
2. **DEAD-004 (HIGH/LOW)** — web-app: 337 lines of shadow-root CSS for the pre-5.0 Accessibility tool that no template emits.
3. **DEAD-017/018 (HIGH/LOW)** — web-app: WorldService lookups and IndexedDBService getAll/count/deleteDatabase that only tests call (157 source + 300 test lines).
4. **DEAD-041 (HIGH/NONE)** — test-utils: the `integration/` suite tests its own copies of presets-api's auth, never the real code (795 lines).
5. **DEAD-003 (HIGH/LOW)** — web-app: six context-action types that nothing emits, still handled in five tools.
6. **DEAD-047 (KEEP, MAJOR)** — core: the `HarmonyGenerator` find* family (660 source + 1,080 test lines), test-only, kept for core's next major.

## Versions at snapshot (preview branch)

| Unit | Version | Unit | Version |
|---|---|---|---|
| apps/api-worker | 0.16.1 | packages/auth | 2.0.2 |
| apps/discord-worker | 5.8.0 | packages/bot-logic | 4.5.0 |
| apps/image-worker | 1.3.3 | packages/core | 5.8.0 |
| apps/moderation-worker | 1.8.0 | packages/logger | 2.2.1 |
| apps/oauth | 3.1.2 | packages/svg | 4.3.0 |
| apps/og-worker | 2.11.1 | packages/test-utils | 2.0.1 |
| apps/presets-api | 2.4.0 | packages/types | 3.2.0 |
| apps/stoat-worker | 0.3.2 | packages/worker-kit | 1.4.1 |
| apps/web-app | 5.14.0 | | |
