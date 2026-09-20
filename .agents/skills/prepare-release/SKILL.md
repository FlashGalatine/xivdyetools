---
name: prepare-release
description: Use when asked to prepare, prep, or cut a release / version bump of a xivdyetools app, worker, or package (or a coordinated release wave), check release readiness, or get a unit "ready for release".
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Skill, Agent
---

# Prepare Release (xivdyetools)

Before delegating or running command blocks, read `../audit-shared/model-routing.md`. It defines the Claude/Codex runtime mapping, coordinator rules, and shell/tool conventions for this workflow.

Get one or more deploy units release-ready on the current branch: gates green, changelog
complete, version bumped, `docs/versions.md` updated, player notes written, committed. **This
skill does not deploy or publish** — merging to `main` deploys apps, Actions publishes packages.
Canon: `docs/developer-guides/release-process.md` (+ `contributing.md` for commit style);
mechanics in `../audit-shared/release-mechanics.md`. Runs from the monorepo root `xivdyetools/`.

## Parameters

| Param | Values |
|---|---|
| UNITS | one or more deploy units (`apps/og-worker`, `packages/core`, …) or `wave` (everything changed since `origin/main`) |
| BUMP | `patch` (fixes, dependency bumps, lint sweeps) · `minor` (new capability, absorbed subpaths) · `major` (a consumer must change code / behaviour changes) · explicit `x.y.z` · default: inferred from the unit's `[Unreleased]` block |
| DRY_RUN | `true` → report Steps 1–6, touch nothing |

## Step 0 — load

Read `../audit-shared/units.md`, `release-mechanics.md`, `changelog-contract.md`,
`model-routing.md`. For a `wave`,
also the root `CHANGELOG.md` "Deploy sequence" block and the archived 5.0 checklist
`docs/historical/20260828-PostMerge5.0/POST_MERGE_CHECKLIST.md` §0 (order and hand-run steps live
there; the living list of user-run items is `docs/operations/OPEN_ITEMS.md`).

## Step 1 — pre-flight (read-only)

Read-only fact gathering → a `collector` agent per unit returns one fact sheet (current version,
path-scoped log, the `[Unreleased]` block verbatim, published npm version, open PRs).
Follow the coordinator rules for delegation.

```bash
git fetch origin --quiet; git branch --show-current; git status --porcelain        # clean apart from release files
git log --format='%h %s' <last-bump-commit>..HEAD -- <unit>                         # scope by PATH; origin/main..HEAD is hundreds of commits on a long branch
node -e 'console.log(require("./<unit>/package.json").version)'
sed -n '/^## \[Unreleased\]/,/^## \[/p' <unit>/CHANGELOG.md                           # current draft (may be empty/missing — then entries are written under the new version)
npm view @xivdyetools/<pkg> version 2>/dev/null                                      # packages only: published vs local
gh pr list --state open --json number,title 2>/dev/null | head -c 2000               # optional; skip silently if gh is absent
git tag --list | head -3                                                             # repo uses no tags today — don't start
```
If the version was already bumped after the last shipped version and nothing user-visible landed
since, say so: fold the new entries into that unshipped version instead of bumping again.

## Step 2 — gates (green or stop; fix through the resolver skills, not inline)

This step produces the most command output. When delegated, use bounded `collector`
assignments per unit within the runtime's capacity. Return green/red per gate plus the first
failure line of any red one; keep full logs in evidence files. Follow the coordinator rules
for delegation, and sequence gates that would build or write the same shared dependencies.

```bash
pnpm turbo run build type-check lint test --filter=<name>...      # trailing `...` = unit AND its dependencies (workers have no build script; without `...` nothing is built)
pnpm --filter <name> run test:coverage 2>&1 | tail -15             # vitest enforces the unit's own thresholds
pnpm --filter xivdyetools-web-app run build:check                  # web-app bundle budget
pnpm --filter <name> exec wrangler deploy --dry-run --outdir "<TMP>/<log-id>-dry" > /dev/null   # workers: bundle compiles; discord-worker ≤ 3,072 KiB gzip
```
Locale/card text changed → `python scripts/subset-cjk-fonts.py` in og-worker and discord-worker
+ their `font-coverage.test.ts` green. Red → load the `test-resolver` or `build-resolver` skill
by name and re-run. Never lower a ratchet or skip a gate to ship.

## Step 3 — changelog completeness

Table in chat: `| commit | covered by entry? | action |` for the path-scoped log vs the unit's
`[Unreleased]` block. A `wave` fans this out — one `worker` agent per unit returns only that
table (its own path-scoped log + `[Unreleased]` block, no file writes). **Writing the entries
and confirming them with the user stays with the coordinator on every model.** Add what's missing in Keep-a-Changelog sections, house style "what broke
and why it mattered" (see recent `packages/core/CHANGELOG.md` entries). Then `[Unreleased]` →
`## [x.y.z] - YYYY-MM-DD` (keep an empty `[Unreleased]` header only where the file already does).
Confirm the block with the user before writing.

## Step 4 — version + matrix

- **Apps**: `package.json` `version` only (web-app shows `__APP_VERSION__`; workers informational;
  bump when behaviour changed). No other copies of the version exist in the unit.
- **Packages**: version rule (`release-mechanics.md`) — local version still unpublished → fold, no
  bump; published → semver per the release-process definitions above. Choosing the bump for an
  **already-published** package is `verifier` work (it is irreversible once Actions publishes):
  route it according to the coordinator rules, giving it the changelog block and the
  package's public exports. Consumers use `workspace:*`.
- **`docs/versions.md`**: update the current-version table row, the unit's version-history
  section, and the compatibility matrix if a package bumped.
- **Wave order**: packages by tier (types → logger/auth → worker-kit/core → svg → bot-logic), then apps.

## Step 5 — player notes (only when user-visible)

Load the `changelog-laymans` skill by name with `<root|web-app> <version>`. Dependency bumps, lint
sweeps and security-only patches are **folded out** of both laymans files by policy. Do not
create per-worker laymans files — nothing reads them.

## Step 6 — summary + confirm

```
Release prep — <unit> <old> → <new> (<bump>) on <branch>
Gates: build/type-check/lint/test ✓ · coverage ✓ · bundle ✓ · fonts ✓/n-a
Changelog: <n> entries (<m> added) · versions.md ✓ · laymans: <root|web-app|folded out>
Files: <unit>/package.json, <unit>/CHANGELOG.md, docs/versions.md[, laymans file(s)]
Commit: chore(<scope>): <new> — <one-line claim>
```
Explicit yes before committing.

## Step 7 — commit (no push, no tag)

```bash
git commit --only -- <unit>/package.json <unit>/CHANGELOG.md docs/versions.md [apps/web-app/CHANGELOG-laymans.md] \
  -m "chore(<scope>): <new> — <claim about behaviour>"        # scope = directory name; --only: another session shares the checkout
git commit --only -- CHANGELOG-laymans.md -m "docs(changelog): player notes for <product version>"   # root laymans always separate (webhook)
```
Push only on request. Then state what happens next: merge to `main` → `deploy-<unit>.yml`
(discord-worker's job runs `register-commands`), Actions "Publish Packages to npm" in tier order
for bumped packages, D1 migrations by hand if schema changed, the `docs/operations/OPEN_ITEMS.md` user-run items.

## Rules

- Gates → changelog → version/matrix → notes → commit, in that order.
- Steps 6 and 7 are never delegated: approval is given to this session, and the coordinator
  holds the `--only` path list (`../audit-shared/model-routing.md`).
- Release files only; never `git add -A`; bumps may ride the feature commit when the user prefers
  (house practice) — ask when unclear.
- No deploy/publish from here; bare `wrangler deploy` is production on `oauth` and live beta on
  `og-worker`/`discord-worker`.
