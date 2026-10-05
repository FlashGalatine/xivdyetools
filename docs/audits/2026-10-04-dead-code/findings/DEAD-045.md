# DEAD-045: The qs override in pnpm-workspace.yaml:11 names a package nothing installs: 1 line, plus the comment on line 7 and lockfile line 10
**Confidence:** HIGH · **Blast radius:** MEDIUM · **Deploy unit:** root (CI/scripts) · **Semver:** NONE · **Category:** Legacy · **Origin:** MAIN

## Location
- `pnpm-workspace.yaml:11` — overrides.qs

## Evidence
- The qs floor at pnpm-workspace.yaml:11 has nothing to act on. No qs@ entry exists in pnpm-lock.yaml, only the overrides header at line 10, and `pnpm why -r qs` prints nothing, while the seroval control check resolves.
  - Commands: grep -n -E 'qs@|^  qs:' pnpm-lock.yaml -> only line 10 (overrides block). `pnpm why -r qs` -> empty, exit 0. `pnpm why -r seroval` -> seroval@1.6.2 via revolt.js.; git ls-files (excl docs/audits) | xargs grep -w qs -> only pnpm-workspace.yaml:7,11, monorepo-setup.md:78, CHANGELOG.md:532 (history).
- Origin: `git show 8ecb878f:pnpm-workspace.yaml` already has qs at line 11, and `git show 8ecb878f:pnpm-lock.yaml` has no qs@. PR #233 edited pnpm-workspace.yaml for the undici override only. CHANGELOG.md:532 records that qs came in through the retired apps/api-docs vitepress chain.

## Fix
**REMOVE WITH CAUTION.** The lockfile records its own overrides block, so pnpm-lock.yaml line 10 must be regenerated in the same commit. Otherwise CI's `pnpm install --frozen-lockfile` fails with a config mismatch on every workflow. Re-run `pnpm why -r qs` right before removing. If the maintainer prefers to keep it as a pre-emptive floor, keep it and say so in the comment.

Steps: 1) pnpm-workspace.yaml: delete line 11 (`qs: '>=6.15.2'`) and change line 7 to 'rollup and seroval are security floors'. 2) Run `pnpm install` so pnpm-lock.yaml line 10 drops out of the overrides block, then confirm `pnpm install --frozen-lockfile` passes. 3) docs/developer-guides/monorepo-setup.md:78: drop `qs` from the overrides row. Leave CHANGELOG.md:532 alone (history). 4) `pnpm turbo run build type-check lint test && pnpm dead-code:check && pnpm docs:check-links`.

## Status
OPEN
