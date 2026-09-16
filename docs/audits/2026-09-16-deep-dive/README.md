# Deep-dive analysis — whole monorepo (2026-09-16)

**Branch/commit:** `main` @ `79a69d1f` (audit branch `worktree-deep-dive-2026-09-16`) · **Scope:** all 8 packages and 9 apps · **No source files were modified by the audit.**

Hidden-bug, refactoring and optimization pass over every deploy unit, two weeks after the 2026-09-02
deep-dive was remediated (PR #158) and after the 236 commits that followed it (colour wheels, harmony
convergence, extractor 4A, Swatch item links / show-all-pieces / glamour export, `.chara` resolution,
security sprints 0–2, dead-code cleanup). Method: uncached gates + coverage baselines, lead-pattern
grep over the 500 non-test source files, 18 parallel read-only Sonnet reviewers (one per deploy unit;
five slices for `web-app`, two each for `discord-worker` and `core`), coordinator verification of every
candidate at `file:line`, an Opus verification pass on the graded rows, then an ID. Totals and top items
are in `DEEP_DIVE_REPORT.md`.

| File | Purpose |
|---|---|
| `DEEP_DIVE_REPORT.md` | The catalog: BUG- / REFACTOR- / OPT- tables, positive controls, rejected suspicions, recommendations, status |
| `findings/<ID>.md` | One file per confirmed finding (location, evidence, fix direction, status) |
| `evidence/reviewer-brief.md` | The brief every reviewer followed (checklists, verification bar, output contract) |
| `evidence/review-<unit>.md` | Per-unit reviewer returns: module map, candidates, positive controls, rejected items, files covered |
| `evidence/gates-baseline-*.txt` | `turbo run build type-check lint --force` and `test --force` at the audit commit (all green) |
| `evidence/coverage-baseline.txt` | Uncached `test:coverage` across all workspaces (one flaky test — see BUG-001) |
| `evidence/bundle-*.txt`, `dead-code-check.txt` | Bundle-size gates (discord-worker, web-app) and the dead-code gate |
| `evidence/pattern-grep.txt`, `src-files.txt`, `hot-spots.txt`, `unit-lines.txt`, `cross-unit-dupes.txt` | Lead lists produced by `evidence/scripts/lead-grep.mjs` |
| `evidence/changed-src-since-e7ac4042.txt`, `commits-since-last-audit.txt` | 240 source files / 236 commits since the 2026-09-02 deep-dive — reviewers read these first |
| `REMEDIATION_PLAN.md` | Written by `remediation-planner` after the catalog is confirmed |

## Versions at the audit commit

| Unit | Version | Unit | Version |
|---|---|---|---|
| `@xivdyetools/types` | 3.2.0 | `web-app` | 5.10.0 |
| `@xivdyetools/logger` | 2.2.0 | `discord-worker` | 5.5.6 |
| `@xivdyetools/auth` | 2.0.2 | `moderation-worker` | 1.7.2 |
| `@xivdyetools/worker-kit` | 1.3.0 | `presets-api` | 2.3.4 |
| `@xivdyetools/core` | 5.2.0 | `oauth` | 3.1.0 |
| `@xivdyetools/svg` | 4.1.0 | `api-worker` | 0.14.1 |
| `@xivdyetools/bot-logic` | 4.2.0 | `og-worker` | 2.10.1 |
| `@xivdyetools/test-utils` | 2.0.0 (private) | `image-worker` | 1.3.1 |
| | | `stoat-worker` | 0.3.0 (parked) |

## Baseline at `79a69d1f`

| Gate | Result |
|---|---|
| `turbo run build type-check lint --force` | 45/45 tasks green (13 pre-existing lint warnings) |
| `turbo run test --force` | 25/25 tasks green |
| `turbo run test:coverage --force` | exit 1 — `@xivdyetools/test-utils` `createMockDye › generates unique IDs` failed on a random collision (BUG-001); every other workspace green and above its thresholds |
| discord-worker bundle | 2,284.3 KiB gzip / 74.4 % of the 3,072 KiB cap |
| web-app bundle | 41/41 chunks within budget; one-locale JS payload 1.99 / 2.15 MB |
| `pnpm dead-code:check` | 0 issues (554 production files) |

Coverage headline (statements / branches / functions / lines): web-app 79.7 / 65.8 / 76.6 / 81.2 (ratchet 78 / 63 / 74 / 79);
discord-worker 88.1 / 81.1 / 89.0 / 89.1; moderation-worker 91.9 / 83.3 / 93.0 / 92.0; every other unit ≥ 92 % statements.

## Totals

53 findings from 62 reviewer candidates: 43 bug-class (0 CRITICAL, 0 HIGH, 8 MEDIUM, 23 LOW, 12 untested-behaviour), 9 refactors, 1 optimization. Every gate is green at this commit apart from one flaky test the audit itself caught (BUG-007). Both reviewer HIGHs were downgraded on the facts by the Opus pass (`evidence/verifier-pass.md`); nine candidates were rejected or re-framed.

## Top items

1. **BUG-007 (MEDIUM)** — test-utils: `createMockDye()` draws random stainIDs over 254 values, so any test run has a ~0.4 % chance of a red that is nobody's fault; it fired in this audit's baseline.
2. **BUG-001 (MEDIUM)** — presets-api + moderation-worker: an author who signed in with XIVAuth only cannot be banned — both ban gates require a Discord snowflake and `xivauth_id` is never written.
3. **BUG-003 (MEDIUM)** — web-app: Swatch's "Submit to Community" is the one dynamic import without a `.catch()`; after a deploy a stale tab gets a silent dead click.
4. **BUG-002 (MEDIUM)** — web-app: the 4A extractor dropped share links while the encoder and og-worker's card remain — restore or retire deliberately.
5. **BUG-004 / BUG-005 (MEDIUM)** — web-app: the preset detail view fetches Universalis prices it never renders, and browser Back from a preset remounts the whole tool.
6. **BUG-006 (MEDIUM)** — bot-logic → discord-worker: off-grid heterochromia renders two identical "EYES · OFF GRID" rows with no left/right cue.
