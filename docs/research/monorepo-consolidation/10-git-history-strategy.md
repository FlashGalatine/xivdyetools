# 10 — Git History & Repository Transition Strategy

## Decision: Hybrid Approach

**Fresh monorepo repo** with old repos archived as permanent read-only references.

This gives the best of both worlds:
- Clean, readable monorepo history starting from day one
- Full original history preserved in archived repos for `git blame` archaeology

## Why Not Merge History

Merging 15+ repos with `git filter-repo` + `git merge --allow-unrelated-histories` is technically possible but produces:

- **Interleaved commit graph**: Commits from unrelated projects appear interspersed, making `git log` confusing
- **Messy blame**: `git blame` shows merge commits and path-rewriting artifacts
- **Duplicated context**: Commit messages reference issues/PRs from different repos, creating dead links
- **Significant effort**: Each repo needs path rewriting (`git filter-repo --to-subdirectory-filter packages/types/`), conflict resolution, and testing

For a solo-developer project, this complexity provides minimal value over simply referencing the archived repos when historical context is needed.

## Migration Steps

### Step 1: Tag All Current Repos

Before any migration work, create a reference tag in every repository:

```bash
# In each repo:
git tag archive/pre-monorepo -m "Final state before monorepo consolidation"
git push origin archive/pre-monorepo
```

### Step 2: Create Fresh Monorepo

```bash
mkdir xivdyetools && cd xivdyetools
git init
```

### Step 3: Copy Source Files (Not Git History)

For each project, copy files into the monorepo structure:

```bash
# Example for @xivdyetools/types
cp -r /path/to/npm-@xivdyetools/types/src packages/types/src
cp /path/to/npm-@xivdyetools/types/package.json packages/types/
cp /path/to/npm-@xivdyetools/types/tsconfig*.json packages/types/
cp /path/to/npm-@xivdyetools/types/vitest.config.ts packages/types/
# etc.
```

Exclude: `.git/`, `node_modules/`, `dist/`, `.npmrc`

### Step 4: Initial Commit

```bash
git add .
git commit -m "feat: consolidate XIV Dye Tools into monorepo

Migrated from independent repositories:
- @xivdyetools/types (v1.7.0)
- @xivdyetools/crypto (v1.0.0)
- @xivdyetools/logger (v1.1.2)
- @xivdyetools/auth (v1.0.2)
- @xivdyetools/rate-limiter (v1.3.0)
- @xivdyetools/core (v1.16.0)
- @xivdyetools/test-utils (v1.1.1)
- web-app (v4.1.5)
- discord-worker (v4.0.1)
- moderation-worker (v1.1.4)
- presets-api (v1.4.12)
- oauth (v2.3.5)
- universalis-proxy (v1.3.5)
- og-worker (v1.0.2)
- maintainer (v1.0.1)

Original repositories archived with tag 'archive/pre-monorepo'.
"
```

### Step 5: Push to GitHub

```bash
git remote add origin https://github.com/FlashGalatine/xivdyetools.git
git push -u origin main
```

## Archiving Old Repos

### Immediate Actions (Day 1)

Add a deprecation notice to each old repo's README:

```markdown
---

> **This repository has been archived.**
>
> All development has moved to the [xivdyetools monorepo](https://github.com/FlashGalatine/xivdyetools).
>
> This repo is preserved as a read-only reference for git history prior to the monorepo consolidation.
> The final pre-monorepo state is tagged as `archive/pre-monorepo`.
```

### After Stability Period (3 months)

Once the monorepo has been running stably in production for ~3 months:

1. Set each old repo to **Archived** on GitHub (Settings → Danger Zone → Archive)
2. This makes them read-only: no pushes, PRs, or issue creation
3. All history, tags, branches, issues, and PRs remain accessible
4. URLs remain stable (no link rot)

### Repos to Archive

| Repository | GitHub URL (assumed) |
|------------|---------------------|
| xivdyetools-core | FlashGalatine/xivdyetools-core |
| xivdyetools-types | FlashGalatine/xivdyetools-types |
| xivdyetools-crypto | FlashGalatine/xivdyetools-crypto |
| xivdyetools-logger | FlashGalatine/xivdyetools-logger |
| xivdyetools-auth | FlashGalatine/xivdyetools-auth |
| xivdyetools-rate-limiter | FlashGalatine/xivdyetools-rate-limiter |
| xivdyetools-test-utils | FlashGalatine/xivdyetools-test-utils |
| xivdyetools-web-app | FlashGalatine/xivdyetools (or similar) |
| xivdyetools-discord-worker | FlashGalatine/xivdyetools-discord-worker |
| xivdyetools-moderation-worker | FlashGalatine/xivdyetools-moderation-worker |
| xivdyetools-presets-api | FlashGalatine/xivdyetools-presets-api |
| xivdyetools-oauth | FlashGalatine/xivdyetools-oauth |
| xivdyetools-universalis-proxy | FlashGalatine/xivdyetools-universalis-proxy |
| xivdyetools-og-worker | FlashGalatine/xivdyetools-og-worker |
| xivdyetools-docs | FlashGalatine/xivdyetools-docs |

## Branch Strategy for the Monorepo

### Branches

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready code. All deploys come from here. |
| `develop` | Integration branch (optional). Useful if you want a staging gate. |
| Feature branches | `feat/<description>`, `fix/<description>`, `chore/<description>` |

### Workflow

1. Create feature branch from `main` (or `develop` if using)
2. Make changes across any number of packages
3. CI runs automatically on push/PR (lint, test, build — affected only)
4. Merge to `main`
5. Deploy workflows trigger automatically based on changed paths
6. npm publish triggered manually when a library needs a new version

### No Per-Package Branches

Unlike multi-repo, there's no need for per-package branches. Turborepo's `--filter` handles selective builds. A single branch can contain changes across `packages/types`, `apps/discord-worker`, and `docs/` simultaneously — and CI will test everything correctly.

## Referencing Old History

When you need to check the git history of a specific file before the monorepo:

1. Find the archived repo (e.g., `FlashGalatine/xivdyetools-core`)
2. Browse to the `archive/pre-monorepo` tag
3. Use `git log` or GitHub's blame view on the relevant file
4. The full commit history is preserved, including all branches and tags

This is an infrequent need that doesn't justify the complexity of merged history.
