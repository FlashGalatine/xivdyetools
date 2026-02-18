# XIV Dye Tools — Monorepo Consolidation

Research and planning documents for migrating the XIV Dye Tools ecosystem from ~15 independent repositories into a single monorepo.

## Why Migrate?

### Current Pain Points

1. **Manual publish-then-install workflow** — Changing a shared library requires publishing to npm, then updating the version in every consuming project's `package.json` and running `npm install`. This is the #1 source of "why isn't my change showing up?" bugs.
2. **Version drift** — Apps pin outdated library versions (e.g., `@xivdyetools/types` is at v1.7.0 but most workers still depend on v1.1.1). Changes in the types package don't reach consumers until manually updated.
3. **Inconsistent tooling** — Each project independently manages its TypeScript, Vitest, Wrangler, and ESLint versions. Some projects have CI/CD, most don't. Some have linting, most don't.
4. **Duplicated node_modules** — Each project installs its own copy of shared dependencies (typescript, vitest, hono, etc.), wasting disk space and causing inconsistencies.
5. **No cross-project CI** — A breaking change in `@xivdyetools/types` won't be caught until it's published and consumed. There's no way to test downstream impact before publishing.

### Expected Benefits

- **Single `pnpm install`** — One command installs everything for all 15 packages
- **`workspace:*` protocol** — Libraries are always resolved from local source, eliminating version drift
- **Turborepo caching** — Only rebuild/retest what actually changed (and its dependents)
- **Unified CI/CD** — A single GitHub Actions pipeline that tests the entire dependency graph
- **Consistent tooling** — Shared ESLint, Prettier, and TypeScript configs at the root
- **Atomic cross-package changes** — Change a type in `@xivdyetools/types` and fix all consumers in the same PR

## Document Index

| # | Document | Description |
|---|----------|-------------|
| 01 | [Current State](./01-current-state.md) | Architecture audit: all 15 projects, dependency graph, version drift |
| 02 | [Tool Selection](./02-tool-selection.md) | pnpm + Turborepo: why chosen, comparison with alternatives |
| 03 | [Repository Structure](./03-repository-structure.md) | Target directory layout, workspace config, root package.json |
| 04 | [Dependency Management](./04-dependency-management.md) | workspace:* conversion table, npm publishing, version normalization |
| 05 | [TypeScript Config](./05-typescript-config.md) | Shared tsconfig.base.json, per-project extension patterns |
| 06 | [Shared Tooling](./06-shared-tooling.md) | ESLint, Prettier, Vitest shared configuration |
| 07 | [Wrangler + pnpm Compatibility](./07-wrangler-pnpm-compatibility.md) | Investigation of symlink issues, WASM modules, fallback strategies |
| 08 | [CI/CD Migration](./08-cicd-migration.md) | GitHub Actions workflows, per-worker deploys, npm publish |
| 09 | [Migration Plan](./09-migration-plan.md) | Phased migration steps with risk mitigation |
| 10 | [Git History Strategy](./10-git-history-strategy.md) | Hybrid approach: fresh repo + archived originals |

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Package manager | **pnpm** | Best `workspace:*` protocol, strict isolation, auto-replaces workspace refs on publish |
| Task runner | **Turborepo** | Simple `turbo.json` config, respects dependency graph, remote caching |
| Git history | **Hybrid** | Fresh monorepo + archived old repos as permanent read-only references |
| TypeScript | **Shared base, no project references** | Turborepo handles build order; composite adds friction without benefit |
| Linting | **Root ESLint flat config** | Single source of truth, per-project extensions where needed |

## Scope

**In scope:** All 7 `@xivdyetools/*` npm libraries and 8 applications under `xivdyetools-apps/`.

**Out of scope:** XIVAuth (Rails) and stoatchat (Rust) — unrelated projects that remain independent.
