# The preview branch this audit read, and its gate results

This audit did not read `main`. It read a **local, never-pushed integration branch**,
`preview/integration-2026-10-04`. That branch is `main@8ecb878f` with the 13 PRs that were open on
2026-10-04 merged into it, in this order, with `git merge --no-ff` against these exact head commits:

| Order | PR | Branch | Head |
|---|---|---|---|
| 1 | #226 | `claude/security-audit-96f7ce` | `065e2987` |
| 2 | #223 | `fix/security-2026-10-03-sprint2` | `ffd22726` |
| 3 | #230 | `fix/security-2026-10-03-sprint8` (stacked on #223) | `7517a35d` |
| 4 | #224 | `fix/security-2026-10-03-sprint3` | `e34ea70a` |
| 5 | #225 | `fix/security-2026-10-03-sprint4` | `3a69828c` |
| 6 | #227 | `fix/security-2026-10-03-sprint5` | `4ebd09f2` |
| 7 | #228 | `fix/security-2026-10-03-sprint6` | `9073d0df` |
| 8 | #229 | `fix/security-2026-10-03-sprint7` | `1eaefd63` |
| 9 | #231 | `fix/security-2026-10-03-sprint9` | `7c97fc1d` |
| 10 | #232 | `fix/security-2026-10-03-sprint10` | `6e8c7d81` |
| 11 | #233 | `fix/security-2026-10-03-sprint11` | `600f0568` |
| 12 | #234 | `fix/security-2026-10-03-sprint12` | `01465700` |
| 13 | #235 | `docs/discord-alternatives-2026-10-refresh` | `b5f551e0` |

Preview HEAD: `1e842b20`. If a PR head moves after 2026-10-04, this snapshot no longer matches it.

## Merge conflicts

All conflicts were in the three files that every release touches, and none was in code:

- `README.md` and `docs/versions.md` version rows: resolved by keeping each row's higher version.
  - #225 conflicted in `README.md` only.
  - #227, #228, #229, #231, #232 and #234 conflicted in both files.
  - `pnpm docs:check-versions` passes on the result.
- Root `CHANGELOG-laymans.md` (#227 against #223 + #230): resolved by keeping all three entries,
  newest first: 5.10.4, 5.10.3, 5.10.2.

The real merges will hit the same conflicts, resolved the same way.

`pnpm install --frozen-lockfile` passes, so the open PRs' lockfile changes agree.

## Gate results on the preview branch

| Command | Result | Log |
|---|---|---|
| `pnpm turbo run build type-check lint test --continue --concurrency=2` | **exit 1: 61 of 62 tasks pass; `xivdyetools-moderation-worker#test` fails** (1 test of 763) | [gates-before.txt](gates-before.txt) |
| `pnpm dead-code:check` | exit 0; 597 production / 550 test files; 26 test-only, 6 entrypoint and 7 public exemptions | [dead-code-check.txt](dead-code-check.txt) |
| `pnpm exec knip` (root) | exit 1 with exactly the 3 documented web-app items | [root-knip.txt](root-knip.txt) |
| `pnpm workers:check-logs` | exit 0; all 7 worker configs pin Workers Logs off | [root-workers-check-logs.txt](root-workers-check-logs.txt) |
| `pnpm test:scripts` | exit 0; 133 tests pass | [root-test-scripts.txt](root-test-scripts.txt) |
| `pnpm type-check:scripts` | exit 0 | [root-type-check-scripts.txt](root-type-check-scripts.txt) |
| `pnpm docs:check-versions` | exit 0 | [root-docs-check-versions.txt](root-docs-check-versions.txt) |
| `pnpm docs:check-links` | exit 0; 957 links across 249 documents | [root-docs-check-links.txt](root-docs-check-links.txt) |

### The failing test: a merge-batch blocker, not a dead-code finding

- **Test:** `apps/moderation-worker/tests/moderation-stats-contract.test.ts:57`, "declares exactly the keys presets-api returns".
- **How it works:** the test reads `apps/presets-api/src/handlers/moderation.ts` as text. It matches from the
  file's first `SELECT` up to `as actions_last_week`, then collects every `as <word>` alias in that span.
- **What changed:** PR #224 added the comment `// review writes neither (same shape as the revert route above).`
  at `apps/presets-api/src/handlers/moderation.ts:390`. That line sits inside the span, so the test
  collects the extra alias `the`.
- **Cause:** PR #224 alone causes this; no other PR is involved.
  - Its head `e34ea70a` has the comment.
  - PR #224 does not touch `apps/moderation-worker`.
- **Why CI missed it:** CI runs only the affected workspaces.
  - moderation-worker is not a package dependent of presets-api; the two workers talk through a service binding.
  - So #224's CI never ran this test, and #225's CI ran it against `main`, which has no such comment.
- **When it fails:** once #224 is on `main`, the next CI run that includes moderation-worker fails (for example #225's).
- **Fix:** in PR #224, reword the comment so it no longer contains `as <word>`. Optionally, also anchor the
  test's match to the stats statement itself (in PR #225, which owns moderation-worker), so a future
  comment cannot break it.

## After the Sprint 0 fixes (2026-10-04)

Two commits were pushed to the open PRs and then merged into this preview branch: preview HEAD `80262a2f`, still local and never pushed.

| PR | Commit | Change |
|---|---|---|
| #224 | `10a1cb77` | The comment at `apps/presets-api/src/handlers/moderation.ts:390` now reads "mirrors the revert route above". |
| #225 | `ea264d49` | DEAD-001: the five orphaned `preset.moderation.*` strings deleted. The 1.8.0 changelog test count was also corrected from 761 to 763. |

Re-run results:

| Command | Result | Log |
|---|---|---|
| `pnpm turbo run build type-check lint test --continue --concurrency=2` | **exit 0, 62 of 62 tasks** | [gates-after-pr-fixes.txt](gates-after-pr-fixes.txt) |
| `pnpm dead-code:check` | exit 0 | — |

- 56 of the tasks were served from cache.
- The presets-api and moderation-worker `type-check`, `lint` and `test` tasks re-ran: 946 and 763 tests pass.

**Head SHAs have moved.** If the PRs are compared against this audit, the current heads are:
- #224: `10a1cb77`;
- #225: `ea264d49`;
- every other PR is unchanged from the table above.
