# Developer Guides

**Technical guides for contributing to XIV Dye Tools**

---

## Getting Started

| Guide | Description |
|-------|-------------|
| [Local Setup](local-setup.md) | Set up your development environment |
| [Monorepo Setup](monorepo-setup.md) | Understanding the multi-project structure |
| [Contributing](contributing.md) | Contribution workflow and guidelines |

---

## Development

| Guide | Description |
|-------|-------------|
| [Testing](testing.md) | Testing strategy and running tests |
| [Deployment](deployment.md) | Deployment procedures |
| [Release Process](release-process.md) | Version bumping and publishing |

---

## Reference

| Guide | Description |
|-------|-------------|
| [Environment Variables](environment-variables.md) | All env vars in one place |
| [Logging Standards](logging-standards.md) | Consistent logging across packages |
| [Troubleshooting](troubleshooting.md) | Common issues and solutions |

---

## Quick Start

This is a **pnpm monorepo with Turborepo**. There is one install and one lockfile at the root —
never `cd` into a package and run `npm install`.

### 1. Clone and install

```bash
git clone https://github.com/FlashGalatine/xivdyetools.git
cd xivdyetools
pnpm install                 # installs every workspace project
```

Requires Node 22+ and pnpm 11.

### 2. Verify the workspace builds

```bash
pnpm turbo run build         # respects dependency order
pnpm turbo run test
```

### 3. Work on something

```bash
pnpm --filter xivdyetools-web-app run dev          # Vite, localhost:5173
pnpm --filter xivdyetools-discord-worker run dev   # Wrangler local
```

### 4. Make changes

Create a feature branch, write tests alongside the change, and open a pull request. See
[Contributing](contributing.md) for commit format and the PR checklist.

---

## Command Quick Reference

All commands run from the **repository root**, filtered to a target. Filters accept either the
`package.json` name or a directory glob.

### Workspace-wide

```bash
pnpm turbo run build                  # Build all, in dependency order
pnpm turbo run test                   # Test all
pnpm turbo run type-check             # Type-check all
pnpm turbo run lint                   # Lint all

pnpm turbo run build --filter='./packages/*'
pnpm turbo run test  --filter='./apps/*'
```

### Filtered to one project

```bash
pnpm turbo run build test --filter=@xivdyetools/core
pnpm turbo run test --filter=xivdyetools-discord-worker

# Include a target's dependencies with a trailing ...
pnpm turbo run build --filter=xivdyetools-web-app...

# A single test file
pnpm --filter @xivdyetools/core exec vitest run src/path/to/file.test.ts
```

### Web app

```bash
pnpm --filter xivdyetools-web-app run dev            # localhost:5173
pnpm --filter xivdyetools-web-app run build
pnpm --filter xivdyetools-web-app run test:e2e       # Playwright
pnpm --filter xivdyetools-web-app run check-bundle-size
pnpm --filter xivdyetools-web-app run validate:i18n
```

### Workers

```bash
pnpm --filter xivdyetools-discord-worker run dev
pnpm --filter xivdyetools-discord-worker run register-commands
pnpm --filter xivdyetools-presets-api run db:migrate:local
pnpm --filter xivdyetools-api-worker run docs:dev    # VitePress docs site
```

> ⚠️ **Deploy scripts do not mean the same thing on every worker.** A bare `deploy` targets the
> `-dev` worker on most of them, but `oauth`'s top-level config *is* production. Read
> [Deployment](deployment.md) before deploying anything by hand.

---

## Architecture Overview

See [Architecture Documentation](../architecture/overview.md) for:
- Project relationships
- Service bindings
- Data flows
- API contracts

---

## Related Documentation

- [Architecture](../architecture/overview.md) - System design
- [Projects](../projects/index.md) - Per-project technical docs
- [Specifications](../specifications/index.md) - Feature specs
