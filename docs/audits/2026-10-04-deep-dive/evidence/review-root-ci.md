# Review: root-ci (scripts/ gates + .github/workflows)

Branch preview/integration-2026-10-04 @80262a2f. All four gates (`check-worker-logs`, `check-doc-versions`, `check-doc-links`, `check-dead-code`) were run read-only and exit 0 at this head.

## Map

| Module | Role |
|---|---|
| scripts/check-dead-code.ts (1715 lines) | test-only reachability gate: file / export / class-member granularity, masker, tag parser |
| scripts/check-doc-links.ts, check-doc-versions.ts, markdown-mask.ts | docs gates (relative links; version tables vs package.json) |
| scripts/check-worker-logs.ts | Workers Logs pinned off (PR-merged, FINDING-022) |
| scripts/coverage-report.ts | manual aggregate coverage report; not run in any workflow |
| ci.yml | audit / secret-scan / ci (affected filter + repo-wide gates) / e2e |
| deploy-*.yml (9) + 3 beta | path-filtered prod deploys (`environment: production`), shared beta deploys |
| publish-packages.yml, sync-dye-emojis.yml | manual npm OIDC publish; manual emoji sync |

## Candidates

### root-ci-01 BUG MEDIUM (operational) ci.yml:42-44
Claim: `concurrency: group: ci-${{ github.ref }}` with `cancel-in-progress: true` also applies to `main`, and the nightly `schedule` run resolves `github.ref` to `refs/heads/main`, so it shares that group.
Failing state: (a) the batch merge of 13 PRs pushes 13 commits to main within minutes; each push cancels the previous push's whole run (`ci` + `e2e` + secret-scan), so only the last commit is ever verified, and the `...[HEAD^]` filters only diff that last commit. (b) the 11:17 UTC schedule run starting while a push-run is in flight cancels it, and a push during the audit cancels the audit.
Wrong outcome: merged commits on main with no completed CI signal; the post-merge check is silently absent.
Tests miss it: n/a (workflow). Covered by test: no. Origin: MAIN.
```
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
```
Fix: `cancel-in-progress: ${{ github.event_name == 'pull_request' }}` (or add `github.event_name` to the group).

### root-ci-02 BUG MEDIUM (operational) publish-packages.yml:152-170
Claim: the Publish loop records a failure and continues (`FAILED+=("$pkg")`), so a dependent is still published after its dependency failed. Single-package dispatch also has no check that the `workspace:*` dependency versions already exist on npm.
Failing state: `all-modified` with core and svg both bumped; `pnpm publish` of core fails (transient 5xx); svg and bot-logic still publish. pnpm rewrites `workspace:*` to core's unpublished local version.
Wrong outcome: published `@xivdyetools/svg` / `bot-logic` that cannot be installed (unresolvable dep) until core is published; npm unpublish window is limited.
Covered by test: no. Origin: MAIN.
```
if pnpm --filter "$pkg" publish --provenance --access public --no-git-checks; then ...
else ... FAILED+=("$pkg")
```
Fix: `break` on the first failure in tier order (the list is already dependency-ordered), and have `detect` fail if a selected package depends on an unpublished workspace version.

### root-ci-03 BUG LOW (operational) deploy-*.yml `paths:` filters
Claim: no production deploy workflow includes `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `turbo.json` or `tsconfig.base.json` in its path filter (checked: deploy-oauth.yml:6-12, deploy-discord-worker.yml:6-17; the other seven are the same).
Failing state: a lockfile- or overrides-only change (e.g. a patched transitive of hono) merges; no worker redeploys.
Wrong outcome: the fix is not live until an unrelated change to that app or its packages lands.
Origin: MAIN. Covered by test: no. The package-level filters themselves are complete: I diffed each app's `workspace:` deps and transitive closure against its filter and found no missing package.
Fix: add the root files to each filter, or run a nightly drift check.

### root-ci-04 BUG LOW scripts/check-dead-code.ts:742, 1438, 1498 (vs 616-632, 668-674)
Claim: the docblock says the two `EXCLUDED_REFERRERS` files never count as referrers, and `referrerTexts` masks them. Only `findTestOnlyExports` (L823) uses it. `findOrphanModules` (L742-743) and `findTestOnlyMembers` (L1438, 1498) pass raw `texts`.
Failing state: `scripts/check-dead-code.test.ts` fixture strings such as `import type { A } from './types'` (:1781) and `from './helper'` (:1688) are read as test importers by `buildReferenceMap`. Unresolved relative specifiers fall back to basename matching, so every tracked `types.ts` / `helper.ts` gains a test referrer. Likewise the prose `.showShortcutsPanel` (L1329-1335) in the checker's own docblock counts as a production reference at member level.
Wrong outcome: a prod module with zero real importers but a colliding basename is reported as "imported by N test file(s)" (misleading), and a member whose name is mentioned in the checker's prose is exempted. Both are bounded by the checker's accepted under-report direction.
Covered by test: no (the 2026-09-02 fix covered the export path only). Origin: MAIN. Severity PLAUSIBLE: not reproduced on a real file.
Fix: use `referrerTexts(texts)` in all three scans.

### root-ci-05 UNTESTED/BUG LOW scripts/check-doc-versions.ts:14-36 (docblock) vs 143-161
Claim: the docblock promises failure for "a claim naming a version that is not semver". The code has no such branch: a non-matching `Version` cell (`5.7`, `5.7.0-beta.1`, `TBD`) fails `VERSION_CELL` and `continue`s, creating no claim.
Failing state: README has two tables listing core, and one row says `5.7`. The row is dropped, and `uncovered` stays empty because the other row covers core.
Wrong outcome: a malformed or prerelease version cell is never compared; the gate passes.
Test: check-doc-versions.test.ts:138 only asserts the workspaces' own versions are semver. Covered: no. Origin: MAIN.
Fix: in `extractDocVersions`, when the Version cell is non-empty and not a semver, push a claim with the raw text so `compareClaims` reports it.

### root-ci-06 REFACTOR LOW stale comments and docs
- `ci.yml:256`: "only discord-worker declares `check-bundle-size`" is stale; `apps/web-app/package.json:27` declares it too, so this turbo step also runs web-app's budget after Build. CLAUDE.md ("Not inside it: web-app's bundle budget") is also off.
- `apps/web-app/vitest.config.ts:57` says coverage-report holds apps to 80/80/80/75, while `scripts/coverage-report.ts:50` has `APP_BASELINE` branches = 80.
- `scripts/check-dead-code.ts:644` is an orphaned one-line docblock above the real `asReferrers` docblock.
Origin: MAIN.

## POSITIVE
- check-worker-logs.ts: fail-closed and complete. It strips comments, catches quoted keys, `streaming_` / `previews` tail consumers and CRLF, and treats an env defined only via subtables as production. The real configs pass: api, discord, image, moderation, oauth, og, presets-api.
- ci.yml: wrangler-config invariants and the repo-wide gates deliberately bypass the affected filter. `if: !cancelled()` on the logs gate is correct, and `id-token: write` is job-scoped on publish.
- Deploy path filters cover every app's transitive workspace deps (see root-ci-03).
- Beta workflows: guard step names the missing token, deploy is bare (never `--env production`), registration is guild-scoped; web-app smoke tests assert `--expect-robots`.
- check-doc-links resolves against `git ls-files` (case-exact, tracked-only); the version gate fails on uncovered workspaces, so it cannot pass vacuously.
- check-dead-code `isMainModule` realpath guard, `declarationLines` fallback, forbidden `@beta` / `@alias` tags, and the mandatory-reason tag parser.
- All actions are SHA-pinned, and the production deploy and sync-dye-emojis workflows use the `production` environment.

## REJECTED
- Basename fallback making `@xivdyetools/types` match every `types.ts` (check-dead-code.ts:718): documented limitation (CLAUDE.md, resolveAliasSpecifier docblock).
- Test-only chains (A test-only imports B, so B looks prod-referenced): a one-level-at-a-time design limit; knip catches B after A is deleted.
- Non-ASCII tracked paths breaking `git ls-files` parsing (check-doc-links.ts:81, check-dead-code.ts:92): zero quoted or non-ASCII tracked paths exist today.
- `<!--` inside a fence or inline code swallowing later links (markdown-mask.ts:35): under-report only, and no instance found.
- coverage-report `total[m].pct` as the string "Unknown": istanbul emits 100 for empty totals.
- WARN (within 5 points of baseline) exiting 0 in coverage-report: by design, and the script is not a CI gate.
- `status=$((status + $?))` aggregation (ci.yml wrangler step): correct, since `exit $status` is non-zero if any run failed.
- publish `all-modified` publishing when local < npm (publish-packages.yml:72): needs a manual dispatch and a deliberate downgrade.
- Pending deploy runs replaced under `cancel-in-progress: false`: each run checks out its own push SHA, so the last run converges to the final tree.

## COVERED
20 files read fully: ci.yml, deploy-api-worker, deploy-discord-worker, deploy-discord-worker-beta, deploy-image-worker, deploy-moderation-worker, deploy-oauth, deploy-og-worker, deploy-og-worker-beta, deploy-presets-api, deploy-web-app, deploy-web-app-beta, publish-packages, sync-dye-emojis, scripts/check-dead-code.ts, check-doc-links.ts, check-doc-versions.ts, check-worker-logs.ts, coverage-report.ts, markdown-mask.ts. Tests were skimmed via grep (`check-worker-logs.test.ts` test list, `check-doc-versions.test.ts`, fixture specifiers in `check-dead-code.test.ts`). Also read: `apps/web-app/scripts/check-bundle-size.js` header, turbo.json `check-bundle-size`, wrangler.toml observability blocks.
