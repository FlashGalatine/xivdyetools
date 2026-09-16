# Coordinated cleanup plan — 2026-09-15

**Sources:** [dead-code catalog](DEAD_CODE_REPORT.md), 21 entries; [current security catalog](../2026-09-15-security/SECURITY_AUDIT_REPORT.md), 6 open findings. **Status basis:** 27 current entries — 23 outstanding actions, 4 KEEP, 0 executed here, 0 superseded. Historical plan reconciliation is recorded below; stale historical status tables are not assumed current.

**Ordering:** current security priorities first; then Confidence × Blast for cleanup; one deploy unit per release step; the header-helper cascade follows its trigger. Implementation and releases have not begun. This plan is a reviewable proposal, not authorization to merge or deploy.

## Execution status (2026-09-16)

All 17 cleanup entries are executed on branch `cleanup/dead-code-2026-09-15` (base `c40e7e63`), one commit per deploy unit, each re-verified at that base before editing (an Opus verifier re-confirmed all 17 verdicts; two corrections: DEAD-006 had a second test caller outside the recorded span, DEAD-015's lines had shifted by one). Every commit passed its unit gate; the branch passed the whole-graph gate (`pnpm turbo run build type-check lint test`: 62/62), `pnpm test:scripts` (107/107), `pnpm dead-code:check`, `pnpm docs:check-versions` (34 claims) and `pnpm docs:check-links` (875 links). Per-commit reviews found no defects.

| Sprint | Unit | Findings | Commit | Version |
|---|---|---|---|---|
| 0 | auth / discord-worker / presets-api (security) | FINDING-001–003 | PR #183 `c40e7e63`; FINDING-003 byte-HMAC follow-up in draft PR #184 | — |
| 1 | presets-api | security FINDING-004/005 in PR #183; DEAD-013/014/015 | `8f7b292b` | 2.3.4 |
| 2 | og-worker | security FINDING-006 in PR #183 | `3095b8ce` (PR #183) | — |
| 3 | web-app | DEAD-001–007 | `2d1695af` | 5.9.1 |
| 4 | discord-worker | DEAD-008 | `4f4e5c13` | 5.5.6 (5.5.5 reserved by PR #184) |
| 5 | moderation-worker | DEAD-009/010/012 | `c6aa8c73` | 1.7.2 |
| 6 | api-worker | DEAD-016 | `6fce09cf` | 0.14.1 |
| 7 | image-worker | DEAD-017 | `f9b469af` | 1.3.1 |
| 8 | moderation-worker | DEAD-011 (cascade) | `225df738` | 1.7.2 (same release as Sprint 5) |

Bundle effect, measured like-for-like inside the worktree ([evidence](evidence/bundle-after-c40e7e63-cleanup.md)): four workers byte-identical (already tree-shaken or type-only), moderation-worker −0.12 KiB gzip. Web-app coverage rose 79.44/65.45/76.15/80.89 → 79.57/65.56/76.27/81.02 (st/br/fn/ln) with thresholds unchanged. Two living-doc lines the findings did not list were also fixed (`docs/projects/presets-api/moderation.md` no longer documents `truncateUnicodeSafe`; `apps/image-worker/CLAUDE.md` describes the new empty `Env`). The four KEEP entries (DEAD-018–021) are unchanged. Merge, publish and deploy remain separate decisions.

## Sprint 0 — existing security priorities

These are separate releases using the acceptance checks in the [security plan](../2026-09-15-security/REMEDIATION_PLAN.md). Do not hold them for optional cleanup.

| Qualified ID | Unit | Tier | Action |
|---|---|---|---|
| 2026-09-15-security/FINDING-001 | auth | P0 | Implement the bounded Discord request reader; preserve verification behavior; publish the package, then separately roll out each bot consumer |
| 2026-09-15-security/FINDING-003 | discord-worker | P0 | Bound the independent GitHub webhook reader; its own unit release |
| 2026-09-15-security/FINDING-002 | presets-api | P0 | Enforce reviewed image revisions; separately roll out the Discord action producer afterward |

**Ends with:** `pnpm turbo run build type-check lint test --filter=@xivdyetools/auth` → version decision → merge → Actions **Publish Packages to npm**. Each consumer gets a separate `pnpm turbo run build type-check lint test --filter=<consumer>` and its own deployment workflow. The two app fixes use their respective filters and `deploy-discord-worker.yml` / `deploy-presets-api.yml`. Preserve the API-first, fail-closed preview-action rollout described in the security plan. No credential rotation is currently confirmed as required there.

## Sprint 1 — presets-api: correctness, then bounded cleanup

The security fixes own the behavior; unused helpers do not replace them. There is no fix-versus-delete conflict in the reviewed paths.

| ID | Tier / Confidence × Blast | Action |
|---|---|---|
| 2026-09-15-security/FINDING-004 | P1 | Apply the owner-edit concurrency guard from the security catalog |
| 2026-09-15-security/FINDING-005 | P1 | Apply the moderator-revert concurrency guard from the security catalog |
| DEAD-013 | P3 / HIGH × LOW | Remove unused Unicode truncation and its dedicated tests |
| DEAD-014 | P3 / HIGH × LOW | Remove unused duplicate-response helper and its dedicated test |
| DEAD-015 | P3 / HIGH × NONE | Remove VoteRow and the literal-only assertion |

**Ends with:** `pnpm turbo run build type-check lint test --filter=xivdyetools-presets-api`, direct `pnpm --filter xivdyetools-presets-api run lint:dead`, the security acceptance tests, then the unit version/changelog decision → PR → merge → `deploy-presets-api.yml`. Re-measure with `pnpm --filter xivdyetools-presets-api exec wrangler deploy --dry-run` before release. No schema/table is removed by these dead-code items.

## Sprint 2 — og-worker: existing log-minimization work

| ID | Tier | Action |
|---|---|---|
| 2026-09-15-security/FINDING-006 | P2 | Apply the scoped logging change from the security catalog |

**Ends with:** `pnpm turbo run build type-check lint test --filter=xivdyetools-og-worker`, direct local Knip including production mode, version/changelog decision → PR → `deploy-og-worker.yml`. No OG dead-code removal was confirmed in this audit.

## Sprint 3 — web-app: unused methods

| ID | Confidence × Blast | Action |
|---|---|---|
| DEAD-001 | HIGH × LOW | Remove getWithContext and its dependent return-type alias together |
| DEAD-002 | HIGH × LOW | Remove isSaved |
| DEAD-003 | HIGH × LOW | Remove getBaseUrl |
| DEAD-004 | HIGH × LOW | Remove getRequiredColor; update comments and docs/projects/web-app/theming.md:39 |
| DEAD-005 | HIGH × LOW | Remove BaseComponent.setStyle |
| DEAD-006 | HIGH × LOW | Remove EmptyState.setOptions and its dedicated tests |
| DEAD-007 | HIGH × LOW | Remove the two unused OfflineBanner APIs and their dedicated tests |

**Ends with:** `pnpm turbo run build type-check lint test --filter=xivdyetools-web-app`, `pnpm --filter xivdyetools-web-app run build:check`, `pnpm dead-code:check`, plus a coverage comparison without lowering the web-app ratchet. The type alias in DEAD-001 is mandatory compile hygiene of the same edit, not a separately deployable runtime cascade. Update unit release records and use a PR; merge runs `deploy-web-app.yml`.

## Sprint 4 — discord-worker: unused preference helper

| ID | Confidence × Blast | Action |
|---|---|---|
| DEAD-008 | HIGH × LOW | Remove getPreference; preserve whole-object preference/default behavior |

**Ends with:** `pnpm turbo run build type-check lint test --filter=xivdyetools-discord-worker`, direct `lint:dead`, a same-environment bundle dry run, unit version/changelog decision → PR → `deploy-discord-worker.yml`. It follows the Sprint 0 security rollouts; command schemas do not change.

## Sprint 5 — moderation-worker: unused wrappers

| ID | Confidence × Blast | Action |
|---|---|---|
| DEAD-009 | HIGH × LOW; caution | Delete exported unbatched wrappers; preserve the live SQL statement builders, batched operations and audit-log tests |
| DEAD-010 | HIGH × LOW | Delete fetch logging wrappers and their own tests; retain header helper temporarily |
| DEAD-012 | HIGH × LOW | Delete getMeta and its own tests; preserve translation behavior and metadata shape |

**Ends with:** `pnpm turbo run build type-check lint test --filter=xivdyetools-moderation-worker`, direct `lint:dead`, and `pnpm dead-code:check`; compare the ban/unban regression tests before/after. Update unit release records → PR → `deploy-moderation-worker.yml`.

## Sprint 6 — api-worker: test-local type

| ID | Confidence × Blast | Action |
|---|---|---|
| DEAD-016 | HIGH × NONE; refactor first | Move/inline CacheConfigKey in its test, then remove the production export |

**Ends with:** `pnpm turbo run build type-check lint test --filter=xivdyetools-api-worker` and direct `lint:dead`. This includes the API docs build/type-check path. No runtime saving is expected; it can wait for the unit's next normal release.

## Sprint 7 — image-worker: empty binding contract

| ID | Confidence × Blast | Action |
|---|---|---|
| DEAD-017 | HIGH × NONE; refactor first | Replace the inert environment member with an explicit empty binding contract and fix the two fixtures |

**Ends with:** `pnpm turbo run build type-check lint test --filter=xivdyetools-image-worker`, its binding/configuration invariants and direct `lint:dead`. No service-binding route or decoder behavior changes. No runtime saving is expected; it can wait for the next normal image-worker release.

## Sprint 8 — moderation-worker: terminal header cascade

**Prerequisite:** Sprint 5 is complete and its results recorded. Re-run tracked references to prove no caller was added meanwhile.

| ID | Confidence × Blast | Action |
|---|---|---|
| DEAD-011 | HIGH × LOW; conditional | Remove sanitizeHeaders, its private header-name list, and only the header-test block; preserve live URL/error sanitization |

**Ends with:** `pnpm turbo run build type-check lint test --filter=xivdyetools-moderation-worker`, direct `lint:dead`, `pnpm dead-code:check`, the same-environment bundle dry run, then unit release records → PR → `deploy-moderation-worker.yml`. There is no dependency-package pruning or MAJOR removal scheduled.

## KEEP register

| ID | Item | Reason | Revisit trigger |
|---|---|---|---|
| DEAD-018 | Six core public API methods | Published/public contract; external usage unverified | Independently justified core major plus registry/consumer check |
| DEAD-019 | Stoat scaffolding | Parked product; planned behavior | Explicit resumption or retirement |
| DEAD-020 | Four worker fallback adapters | Reachable development/test/degradation behavior | Replacement design and prior operational evidence gate satisfied |
| DEAD-021 | Discord response assertion type | Types real handler-response tests | Approved test-support reorganization |

## Prior catalogs, supersession and status limits

- **Superseded current actions:** none. No new removal conflicts with the six current security fixes.
- The four prior dead-code KEEP items receive new IDs in this audit (see each finding's Supersedes line); their historical IDs are not additional work.
- The [2026-09-02 deep-dive plan](../2026-09-02-deep-dive/REMEDIATION_PLAN.md) contains completed-sprint annotations that contradict its broad OPEN table. Its response/REST remainder of `REFACTOR-001` still needs a shared-package design decision and must follow security fixes. This audit neither authorizes that redesign nor silently reschedules its completed locale work.
- Historical `webapp-v4-16/17/18` test backlog needs status reconciliation before scheduling: current tracked result-card and layout test files exist, so the older “suite does not exist” descriptions cannot be treated as fresh evidence. The preset-tool/detail coverage gap and remaining acceptance criteria were not re-audited here. `OPT-005/009` likewise retain their historical owner pending status refresh. These are recorded deferred inputs, not discarded findings or new dead-code claims.
- See [prior-catalog reconciliation](evidence/prior-catalog-reconciliation.md). The current security plan remains the detailed authority for its acceptance/rollout requirements. This plan coordinates the confirmed current records and the cleanup scope; it does not claim a fresh 250-row deep-dive reconciliation.

## Standing guidance

- Re-grep every candidate immediately before editing. Use the exact measured test blocks in [test-removal-spans.json](evidence/test-removal-spans.json); preliminary reviewer estimates are not deletion boundaries.
- Use one commit per task, or a small single-unit sprint. Stage only authorized paths; do not disturb another session's changes. No commits were made by this audit.
- At every sprint boundary, record the exact gate result. Before merge, run `pnpm turbo run build type-check lint test`, `pnpm test:scripts`, `pnpm dead-code:check`, `pnpm docs:check-versions` and `pnpm docs:check-links`; add web bundle/coverage checks for web changes.
- Public package removals remain isolated MAJOR work unless a current publication check proves a different version rule applies. No npm API removal is scheduled here.
- After cleanup, compare source/test line deltas and the same bundle environment. Covered-code deletion changes coverage percentages; keep meaningful behavior tests and the existing coverage ratchet.
- Update the finding and report status after each completed action. Merge/publish/deploy require their own authorization; an audit request is not that authorization.


