# Sprint 0 status — 2026-09-15

**Scope:** only Sprint 0 of [CLEANUP_PLAN.md](CLEANUP_PLAN.md). Later dead-code cleanup sprints were not executed.

The original plan predates the separate security-remediation rollout. Live GitHub checks confirmed [PR #183](https://github.com/FlashGalatine/xivdyetools/pull/183) merged as `c40e7e63`, auth publication succeeded, and the production presets, moderation and Discord deployment runs succeeded at that revision.

| Finding | Current status |
|---|---|
| FINDING-001 | Bounded Discord reader already implemented and published in auth 2.0.2; both bot consumers deployed by the security task |
| FINDING-002 | Atomic pending-image revision guard and legacy-button refresh already implemented and deployed; authenticated moderator acceptance remains pending |
| FINDING-003 | Stream cap already deployed; this task found and fixed the remaining original-byte HMAC requirement in [draft PR #184](https://github.com/FlashGalatine/xivdyetools/pull/184), commit `863decb3`. Automatic beta deployment passed; production follow-up is pending |

## Work performed here

The GitHub webhook now authenticates its bounded byte buffer before decoding UTF-8. Four real-HMAC endpoint cases failed before the change: BOM/malformed bytes caused valid raw signatures to fail and signatures for normalized text to pass. The fix preserves the existing byte cap, early cancellation, string callers and short-secret behavior. Discord 5.5.5 is prepared.

Validation passed: 22 focused tests; 62 whole-graph tasks (59 cached, three fresh Discord tasks); 1,273 Discord tests with unchanged coverage thresholds; 107 script tests; script type-check, dead-code and documentation gates; production bundle dry run at 2,283.12 KiB gzip; independent review; zero Gitleaks findings in the new commit. The worktree is `xivdyetools/.claude/worktrees/sprint-0-completion`, branch `fix/sprint-0-webhook-bytes`.

All checks on PR #184 subsequently passed for commit `863decb3`, including the browser end-to-end suite (7m59s), build/type-check/lint/tests, dependency security audit and Gitleaks ([CI run](https://github.com/FlashGalatine/xivdyetools/actions/runs/35013603127)).

The branch push triggered the configured beta deployment, which passed for the reviewed commit ([run](https://github.com/FlashGalatine/xivdyetools/actions/runs/35013570178)); the log confirms `xivdyetools-discord-worker-dev`, version ID `02d7ec18-1083-4365-b21a-e18231e204d3`. No production merge/deployment or live moderation mutation was performed by this task. Sprint 0 must not be marked fully released until the follow-up is merged/deployed and authenticated moderation acceptance is recorded. The original audit and plan remain unchanged as historical snapshots.
