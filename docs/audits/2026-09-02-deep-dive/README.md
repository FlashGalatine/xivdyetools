# Deep-dive analysis — whole monorepo (2026-09-02)

**Branch/commit:** `main` @ `e7ac4042` (audit branch `worktree-deep-dive-2026-09-02`) · **Scope:** all 8 packages and 9 apps · **No source files were modified by the audit.**

Hidden-bug, refactoring and optimization pass over every deploy unit, run after the 5.0 launch and the
2026-09-01 dead-code remediation (PR #157). Method: uncached gates + coverage baselines, lead-pattern grep
over tracked sources, 18 parallel read-only reviewers (one per deploy unit, three layers each for
`web-app` and `discord-worker`, two for `core`), then coordinator verification of every candidate at
`file:line` before an ID was assigned. Totals and top items are in `DEEP_DIVE_REPORT.md`.

| File | Purpose |
|---|---|
| `DEEP_DIVE_REPORT.md` | The catalog: BUG- / REFACTOR- / OPT- tables, positive controls, rejected suspicions, recommendations, status |
| `findings/<ID>.md` | One file per confirmed finding (location, evidence, fix direction, status) |
| `evidence/reviewer-brief.md` | The brief every reviewer followed (checklists, verification bar, output contract) |
| `evidence/review-<unit>.md` | Per-unit reviewer returns: module map, candidates, positive controls, rejected items, files covered |
| `evidence/gates-baseline-*.txt` | `turbo run build type-check lint` and `test` at the audit commit (all green) |
| `evidence/coverage-baseline-*.txt` | Uncached `test:coverage` runs (packages, apps) |
| `evidence/pattern-grep.txt`, `src-files.txt`, `hot-spots.txt`, `dir-map.txt` | Lead lists produced by `evidence/scripts/lead-grep.sh` |
| `evidence/commits-since-last-audit.txt` | 583 commits since the 2026-08-09 pre-release deep-dive |
| `REMEDIATION_PLAN.md` | Written by `remediation-planner` after the catalog is confirmed |

## Versions at the audit commit

| Unit | Version | Unit | Version |
|---|---|---|---|
| `@xivdyetools/types` | 2.0.1 | `web-app` | 5.0.1 |
| `@xivdyetools/logger` | 2.1.2 | `discord-worker` | 5.1.1 |
| `@xivdyetools/auth` | 2.0.1 | `moderation-worker` | 1.6.1 |
| `@xivdyetools/worker-kit` | 1.2.1 | `presets-api` | 2.2.1 |
| `@xivdyetools/core` | 4.0.2 | `oauth` | 3.0.1 |
| `@xivdyetools/svg` | 3.0.1 | `api-worker` | 0.10.1 |
| `@xivdyetools/bot-logic` | 3.0.0 | `og-worker` | 2.4.0 |
| `@xivdyetools/test-utils` | 1.3.1 (private) | `image-worker` | 1.2.1 |
| | | `stoat-worker` | 0.2.3 (parked) |

## Totals

250 findings from 252 reviewer candidates: 208 bug-class (14 HIGH, 64 MEDIUM, 74 LOW, plus 49 untested-behaviour), 29 refactors, 14 optimizations. Every gate is green at this commit — 9,695 tests pass uncached across all 17 units — so none of this is visible to CI.

## Top items

1. **BUG-016 (HIGH)** — web-app: the shared test mock sets `id === stainID`, inverting the documented dye id contract. It manufactures green for four separately-filed defects; fix it first and they turn red on their own.
2. **BUG-006 (HIGH)** — core → bot-logic → discord-worker: RYB blending maps green and blue to the same triple, so every green dye comes back blue on the bot's default `/mix` mode. Proven with a repro against the built package.
3. **BUG-012 (HIGH)** — web-app: "Inspect Dye in → Harmony" sends an item ID to a receiver that rejects every item ID. Broken for all 125 dyes, every time.
4. **BUG-013 (HIGH)** — discord-worker: moderation embeds resolve preset dyes through the item-ID map, so a moderator sees "1, 2, 3" instead of dye names while deciding whether to approve.
5. **BUG-009 (HIGH)** — web-app: opening a second modal clears the first one's listeners, so a confirmation dialog underneath becomes unanswerable by mouse.
6. **BUG-010 (HIGH)** — moderation-worker: `/preset moderate action:stats` prints "undefined" in all four counters, because the client reads `*_count` and the API returns bare names.
