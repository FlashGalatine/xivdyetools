## 7. Worktrees, branches, finishing (xivdyetools)

Read before worktree creation, branch finishing, verification, or test-driven development
(Claude examples: the corresponding `superpowers` skills). Those optional skills are generic; the
facts below are what they don't know about this repo. `xivdyetools/CLAUDE.md` § *Working in this
checkout* is the short form; this file is the trap list.

### Worktrees

- **Location:** worktrees live at `xivdyetools/.claude/worktrees/<name>` on a fresh branch,
  whichever agent creates them; the repo `.gitignore` covers that path (the directory name is
  historical — every agent uses it so cleanup has one place to look). Use the runtime's native
  worktree support where it has one (Claude example: `EnterWorktree`), otherwise
  `git worktree add .claude/worktrees/<name> -b <branch> origin/main`. Never ignore `.claude/`
  wholesale: `.claude/skills` is a tracked symlink to `.agents/skills`.
- **Install per worktree:** `node_modules` is not shared. Run `pnpm install --frozen-lockfile` inside
  the worktree before any build/test, or every workspace import fails with "cannot find module".
- **Removal half-deletes on Windows:** `git worktree remove` stops partway with *Filename too long*
  and leaves a broken worktree. This checkout already has `core.longpaths=true`; a fresh clone
  needs `git config core.longpaths true` (`LongPathsEnabled=1` in the OS is not enough — git reads
  its own setting). Git deregisters before it deletes, so `git worktree list` no longer shows
  it — purge the leftovers with `robocopy <empty-dir> <worktree>/node_modules /MIR` then
  `Remove-Item -Recurse -Force`; no further git command is needed.
- **Shared checkout:** another session usually has the main checkout open. Never `git stash` for a
  baseline (it swept up and reverted their edits once); stage only your own paths and commit with
  `git commit --only -- <paths>`. Never switch branches in the main checkout — that is what the
  worktree is for.
- **Base ref:** branch off `origin/main`. Long-lived `*-prep` integration branches exist only during
  a coordinated wave (none as of 2026-09-01); if one is active, branch off it and target it in the PR.

### Verification gates (what "green" means here)

`pnpm turbo run build type-check lint test` is the whole-graph gate; `--filter=...<unit>` (leading dots) scopes it
to a unit and its dependents. It hides gates inside `lint`/`test` that a generic "run the tests"
misses:

| Unit | Extra gate | Where it lives |
|---|---|---|
| web-app | bundle budget | `pnpm --filter xivdyetools-web-app run build:check` — not part of `build` |
| web-app | locale parity + order | `run validate:i18n`; orphan keys + public metadata are vitest files under `src/__tests__/` |
| web-app | no hardcoded UI strings, knip | both inside `lint` (`eslint src && knip`) |
| core / svg / bot-logic | knip with `includeEntryExports` | inside `lint`; an unimported barrel export fails unless tagged `/** @public */` |
| og-worker | knip + `knip --production` | that *is* its `lint` |
| discord-worker / og-worker | CJK font coverage + static font instances | `font-coverage.test.ts`, `font-faces.test.ts` — any new CJK glyph in any locale string turns them red until `scripts/subset-cjk-fonts.py` reruns |
| every worker | wrangler config invariants | a CI-only step in `ci.yml` — replicate by reading the diff of any `wrangler.toml` |
| repo | gitleaks | `gitleaks git --no-banner --redact --log-opts="origin/main..HEAD"` before pushing |

Single test file: `pnpm --filter <pkg-name> exec vitest run src/path/file.test.ts` (never `npm test
path`). Package names are `@xivdyetools/<pkg>` for packages, `xivdyetools-<app>` for apps.
Green-test traps (vacuous assertions, flush-count flakes, CI 5× slower) are in `tests-coverage.md`.

### Finishing a branch

- **Merging to `main` is the production deploy** (`deploy-*.yml` on push, path-filtered). There is no
  staging; `*-beta.yml` workflows deploy other branches to beta. So the branch-finishing options are
  "open a PR" or "keep the branch" — never "merge locally into main and push".
- `main` is protected; CI runs on every PR whatever its base, and on pushes to `main` / `*-prep`.
  A red gate that CI shows only after push (knip, i18n, font-coverage, bundle) is why the PR pre-merge
  pass in `../README.md` runs the gates on a trial merge first.
- **Done ≠ merged.** The PR checklist in `docs/developer-guides/contributing.md` adds: version bump +
  `CHANGELOG.md` for every project touched, `CHANGELOG-laymans.md` for user-facing web-app/bot changes
  (machine-parsed — `changelog-contract.md`), deploy workflow `paths:` filter when a new shared-package
  dependency was added, slash-command shape changes flagged (CI runs `register-commands` on the
  discord/moderation deploys, not by hand).
- **D1 schema changes** ship a migration file that is applied **by hand with `wrangler d1 execute
  --file`** before the dependent deploy. Never `wrangler d1 migrations apply`: `d1_migrations` is
  empty, so it would replay every file (`docs/historical/20260828-PostMerge5.0/POST_MERGE_CHECKLIST.md`).
- **Package version bumps** follow `release-mechanics.md` (unpublished local version → fold in, no
  extra bump; published → MAJOR for removals). Publishing is Actions-only after the merge.
- Commit messages: `<type>(<scope>): <claim>` with scope = app/package directory name; root
  `CHANGELOG-laymans.md` edits are their own commit.
