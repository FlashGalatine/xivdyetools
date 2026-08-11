# Contributing

**Branch conventions, commit format, and what a pull request needs to pass**

---

## Before you start

Get the workspace running first — see [Local Setup](local-setup.md) and
[Monorepo Setup](monorepo-setup.md). Everything below assumes `pnpm install` has succeeded from
the repository root.

---

## Branches

Work happens on a feature branch off `main`; `main` is protected and deploys on merge (see
[Deployment](deployment.md)). Long-running initiative branches (e.g. `monorepo-2.0-prep`) exist
for coordinated multi-project work and are merged as a unit.

Because **merging to `main` is the deploy**, a branch is not "done" until it is releasable: CI
green, versions bumped, changelogs written, and any out-of-band steps (slash-command
registration, D1 migrations) identified. See [Release Process](release-process.md).

---

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/), scoped by workspace project:

```
<type>(<scope>): <imperative summary>
```

| Type | Use for |
|------|---------|
| `feat` | New capability |
| `fix` | Bug fix |
| `refactor` | Restructuring with no behaviour change |
| `test` | Adding or repairing tests |
| `docs` | Documentation only |
| `chore` | Tooling, dependencies, config |
| `revert` | Reverting a previous commit |

The scope is the package or app directory name — `web-app`, `presets-api`, `discord-worker`,
`core`, `types`, `svg`, `test-utils`. Omit it for changes that genuinely span the workspace.

Write the summary as a claim about behaviour, not a description of the diff:

```
✅ fix(presets-api): pending preview images now reach the moderator queue
✅ feat(web-app): shared 1-primary + 2-secondary category selector
❌ fix(presets-api): update preset-service.ts
❌ feat: changes
```

---

## Code style

Enforced by tooling, so let the tools decide:

```bash
pnpm turbo run lint          # ESLint 10 flat config + typescript-eslint
pnpm --filter <project> run lint:fix
```

Prettier 3 handles formatting. TypeScript is strict, ES2022, bundler resolution, from the shared
`tsconfig.base.json`.

### `verbatimModuleSyntax`

The base tsconfig enables `verbatimModuleSyntax`, so **type-only imports must be marked**:

```typescript
import type { Dye } from '@xivdyetools/types';   // ✅
import { Dye } from '@xivdyetools/types';        // ❌ compile error if only used as a type
```

This is the most common first-contribution compile failure.

### Match the surrounding code

Comment density, naming, and idiom vary by package — follow whatever the file you are editing
already does rather than importing conventions from elsewhere.

---

## Testing

Vitest for everything; Playwright for `web-app` E2E.

```bash
pnpm turbo run test                                    # everything
pnpm turbo run test --filter=@xivdyetools/core         # one package
pnpm --filter @xivdyetools/core exec vitest run src/path/to/file.test.ts   # one file
pnpm --filter xivdyetools-web-app run test:e2e         # Playwright
```

New behaviour needs a test. Bug fixes need a test that fails before the fix — a regression guard
that never went red is not a guard. See [Testing](testing.md) for the fuller strategy.

---

## Pre-commit hooks

The repo uses [pre-commit](https://pre-commit.com/) with **detect-secrets** as the headline hook,
baselined against `.secrets.baseline`.

```bash
pip install pre-commit detect-secrets
pre-commit install
pre-commit run --all-files      # manual full pass
```

If detect-secrets flags a genuine false positive, update the baseline deliberately — do not
bypass the hook.

---

## Pull request checklist

- [ ] `pnpm turbo run lint type-check test build` passes for the affected projects
- [ ] New behaviour is covered by a test; bug fixes have a regression guard
- [ ] Type-only imports use `import type`
- [ ] Version bumped and `CHANGELOG.md` updated for every project you changed
- [ ] User-visible web-app changes are in `CHANGELOG-laymans.md`
- [ ] If a new shared-package dependency was added, the relevant deploy workflow's `paths:` filter includes it
- [ ] Slash-command shape changes are flagged so `register-commands` gets run
- [ ] D1 schema changes ship a migration, applied before the dependent code
- [ ] Documentation in `docs/` reflects the change — especially [versions.md](../versions.md)

---

## Documentation conventions

`docs/` has a living tier and an archived tier, and the distinction matters:

| Tier | Directories | Rule |
|------|-------------|------|
| **Living** | `architecture/`, `projects/`, `developer-guides/`, `user-guides/`, `maintainer/`, `operations/`, `reference/`, `specifications/`, plus the root files | Must stay accurate. Update when the code changes. |
| **Archived** | `audits/`, `historical/`, `research/`, `brainstorming/`, `superpowers/` | Dated snapshots. **Do not retro-edit** — stale facts are what makes them an archive. |

When a fact changes in code, grep the living tier for it. Version numbers, dye counts, theme
counts, and command counts are all duplicated across several index files by design (they serve
different audiences) and all of them drift together.

---

## Related Documentation

- [Local Setup](local-setup.md) — getting the workspace running
- [Testing](testing.md) — test strategy and coverage expectations
- [Release Process](release-process.md) — version bumping and publishing
- [Deployment](deployment.md) — how merges reach production
- [Troubleshooting](troubleshooting.md) — common failures and their causes
- [Logging Standards](logging-standards.md) — structured logging conventions
