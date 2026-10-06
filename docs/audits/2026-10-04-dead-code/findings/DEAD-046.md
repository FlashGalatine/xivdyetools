# DEAD-046: The turbo.json `deploy` task (lines 130-134) has no caller: 5 lines
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** root (CI/scripts) · **Semver:** NONE · **Category:** Dead Path · **Origin:** MAIN

## Location
- `turbo.json:130` — tasks.deploy

## Evidence
- No tracked file runs `turbo run deploy` / `turbo deploy`: no package.json script, workflow, doc or skill. All 7 worker `deploy` scripts are called through `pnpm --filter ... run deploy` or the deploy-*.yml workflows, which bypass turbo.
  - Commands: git ls-files (excl docs/audits) | xargs grep -E 'turbo (run )?deploy|turbo run [a-z -]*deploy' -> no hits.; git ls-files '*package.json' | xargs grep '"deploy"' -> 7 apps, all `wrangler deploy`, none run through turbo.; turbo.json:130-134 is `deploy: {dependsOn:[build,type-check], cache:false, persistent:false}`.
- Origin: `git show 8ecb878f:turbo.json` already has the deploy task at line 130. No commit in 8ecb878f..HEAD touches turbo.json. `git log -S'"deploy": {' -- turbo.json` traces it to 133a513c (the monorepo scaffold).

## Fix
**REMOVE.** Calling it a guardrail gets it backwards. While the task exists, a stray `pnpm turbo run deploy` runs a bare `wrangler deploy` in all 7 workers. For oauth that bare deploy is production, and for og-worker it is the routed beta worker. Removing the task should make turbo refuse with an unknown-task error; confirm that locally with `pnpm turbo run deploy --dry-run` after the edit.

Steps: 1) turbo.json: delete lines 130-134 (the `deploy` block) and the blank line 135, and fix the trailing comma on the preceding `clean` block. 2) Leave the 7 apps/*/package.json `deploy` scripts as they are. 3) Check `pnpm turbo run deploy --dry-run` now errors as an unknown task. 4) `pnpm turbo run build type-check lint test && pnpm dead-code:check && pnpm docs:check-links`.

## Status
REMOVED, NOT DEPLOYED — `26e43a64` (branch `fix/remediation-2026-10-04-sprint20`, root 2.3.2; PR #276, open, on PR #264).
