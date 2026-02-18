# 02 — Tool Selection & Rationale

## Decision: pnpm Workspaces + Turborepo

### Why pnpm Over npm Workspaces

| Factor | pnpm | npm workspaces |
|--------|------|----------------|
| **`workspace:*` on publish** | Auto-replaces with real version (e.g., `^1.7.0`) | Requires manual version replacement |
| **Dependency isolation** | Strict — each package only sees declared deps | Hoisting can mask missing declarations |
| **Disk usage** | Content-addressable store, symlinked | Full copies per project |
| **Install speed** | Measurably faster, especially repeat installs | Slower, no content store |
| **Maturity** | Well-established workspace protocol | Workspaces work but less refined |

**The killer feature is `workspace:*` → real version on publish.** Since all 7 libraries still need to publish to npm (the web app is deployed separately, external consumers may exist), pnpm's automatic version resolution during `pnpm publish` eliminates the most error-prone step.

### Why Not Nx

- Nx requires `project.json` files per project, an `nx.json` config, and potentially a plugin system — more config surface for a 15-package repo
- Turborepo's `turbo.json` is a single file that handles the same dependency-aware task running
- Nx's "affected" analysis is more powerful, but Turborepo's `--filter=...[HEAD^]` covers the required use cases
- As a solo-developer project, the lower learning curve matters

### Why Not Lerna

- Lerna is largely deprecated in its original form; modern Lerna delegates to Nx under the hood
- Adds a layer of abstraction over pnpm workspaces without clear benefit
- Turborepo is more actively maintained and widely adopted

### Why Not Bun

- Fastest installs and excellent workspace support
- However, less mature ecosystem and potential compatibility issues with Wrangler's module resolution
- Not worth the risk for a production system serving live Discord bot users

## Turborepo Pipeline Design

### turbo.json

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"],
      "inputs": [
        "src/**",
        "tsconfig.json",
        "tsconfig.build.json",
        "package.json"
      ]
    },
    "type-check": {
      "dependsOn": ["^build"],
      "cache": true,
      "inputs": ["src/**", "tsconfig.json"]
    },
    "lint": {
      "cache": true,
      "inputs": ["src/**", "eslint.config.*"]
    },
    "test": {
      "dependsOn": ["^build"],
      "cache": true,
      "inputs": ["src/**", "tests/**", "vitest.config.*"],
      "outputs": ["coverage/**"]
    },
    "deploy": {
      "dependsOn": ["build", "type-check"],
      "cache": false,
      "persistent": false
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

### How `dependsOn: ["^build"]` Works

The `^` prefix means "run this task in all upstream dependencies first." When you run:

```bash
pnpm turbo run build --filter=discord-worker
```

Turborepo automatically resolves the dependency graph and builds in order:

1. `types`, `crypto`, `logger` (Level 0 — parallel)
2. `auth`, `rate-limiter` (Level 1 — parallel)
3. `core` (Level 2 — depends on types + logger)
4. `discord-worker` (Level 3 — depends on all above)

### Caching Strategy

Turborepo caches task outputs based on input file hashes. When files haven't changed, tasks are skipped:

- **Local cache**: `node_modules/.cache/turbo/` (default)
- **Remote cache**: Turborepo remote caching (free tier) for CI
  - Enable with: `npx turbo login && npx turbo link`
  - CI pipelines pull cached results, dramatically reducing build times

**Cache invalidation inputs** are declared per-task in `turbo.json`. For example, `build` caches are invalidated when `src/**`, `tsconfig.json`, or `package.json` change.

### Typical Developer Workflows

```bash
# Build everything
pnpm turbo run build

# Build a specific package and its dependencies
pnpm turbo run build --filter=discord-worker

# Test only what changed since last commit
pnpm turbo run test --filter=...[HEAD^]

# Lint + test + build for a PR (affected packages only)
pnpm turbo run lint test build --filter=...[main]

# Run a specific worker in dev mode
pnpm turbo run dev --filter=discord-worker
# or directly:
cd apps/discord-worker && pnpm run dev
```
