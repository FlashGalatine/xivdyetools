# [REFACTOR-003]: `web-app`'s `lint` task runs `--fix`, mutating source inside a cached Turbo task

## Priority
MEDIUM

## Category
Architecture / build correctness

## Location
- File: `apps/web-app/package.json` — the `lint` script
- Contrast: all 15 sibling workspaces

## Deploy Unit
`web-app` (build tooling; nothing user-facing)

## Current State

`web-app` is the only workspace whose lint task writes to the working tree:

```jsonc
// apps/web-app/package.json
"lint": "eslint src/**/*.ts --fix"
```

Every other workspace is read-only:

```
packages/auth        "lint": "eslint src"
packages/bot-logic   "lint": "eslint src"
packages/core        "lint": "eslint src"      + separate "lint:fix": "eslint src --fix"
packages/logger      "lint": "eslint src"
packages/svg         "lint": "eslint src"
packages/types       "lint": "eslint src"
packages/worker-kit  "lint": "eslint src"
packages/test-utils  "lint": "eslint src"
apps/api-worker      "lint": "eslint src/"
apps/discord-worker  "lint": "eslint src/"
apps/moderation-worker "lint": "eslint src/"
apps/oauth           "lint": "eslint src/"
apps/presets-api     "lint": "eslint src/"
apps/stoat-worker    "lint": "eslint src/"
```

`packages/core` shows the intended convention: `lint` checks, `lint:fix` fixes.

## Issues

1. **A verification gate that mutates what it verifies.** `pnpm turbo run lint` is the project's
   pre-commit and CI check. On `web-app` it silently rewrites source files, so "lint passed" can
   mean "lint edited your code until it passed". A developer can commit auto-fixes they never
   reviewed.
2. **It interacts badly with Turborepo caching.** Turbo caches task *outputs*; a task that
   mutates its own *inputs* is not idempotent. A cache hit skips the fixes, a cache miss applies
   them — so the tree's contents depend on cache state, which is not a property a build system
   should have.
3. **It can mask real failures.** `--fix` exits 0 when every reported problem was auto-fixable.
   CI reports green while the diff quietly grew.
4. **It is dangerous in CI specifically.** In a clean checkout the fixes are applied and then
   discarded, so CI validates code that differs from what is committed. The next developer's
   local run re-applies them.
5. **`src/**/*.ts` is shell-glob-dependent.** Unlike the siblings' directory argument, this relies
   on the shell expanding `**`, which behaves differently across `sh`, `bash` and PowerShell —
   the repo is developed on Windows and CI runs on Linux.

## Proposed Refactoring

Adopt the `packages/core` convention exactly:

```jsonc
"lint": "eslint src",
"lint:fix": "eslint src --fix",
```

This makes the check read-only, matches all 15 siblings, and drops the glob portability
problem.

Then confirm `turbo.json` does not declare outputs for `lint` (a pure check has none), so the
cache entry records only the pass/fail result.

Run once after the change to see whether anything was relying on the auto-fix:

```bash
pnpm --filter xivdyetools-web-app run lint
```

If it now reports violations, that is the real, previously-hidden lint debt. Fix it with an
explicit `pnpm --filter xivdyetools-web-app run lint:fix`, **review the diff**, and commit it as
its own clearly-labelled change — that review is the entire point of the split.

## Benefits

- The lint gate becomes trustworthy: green means the committed code is clean, not that a tool
  cleaned it.
- Turborepo's `lint` cache becomes sound, because the task stops mutating its inputs.
- All 16 workspaces share one convention, so `pnpm turbo run lint` behaves uniformly.
- Removes a cross-shell glob-expansion difference between Windows dev and Linux CI.

## Effort Estimate
**LOW** for the script change. Potentially MEDIUM follow-up if the first read-only run surfaces
accumulated violations — but that debt already exists; this only makes it visible.

## Risk Assessment

**Low, and strictly risk-reducing.** The only way this "breaks" anything is by revealing lint
errors that `--fix` had been silently papering over — which is the desired outcome, not a
regression.

Sequence it **early**, before the other `web-app` fixes: doing it first means every subsequent
change in this audit is linted honestly. It does not need a deploy — it is a tooling change with
no runtime effect — so it can land ahead of the release without touching the deploy schedule.
