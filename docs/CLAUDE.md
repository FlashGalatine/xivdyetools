# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Documentation Bible

**For comprehensive documentation, see the [Documentation Bible](index.md):**

| Topic | Location |
|-------|----------|
| Ecosystem overview | [Architecture Overview](architecture/overview.md) |
| Current versions | [versions.md](versions.md) |
| Dependency graph | [Dependency Graph](architecture/dependency-graph.md) |
| Service bindings | [Service Bindings](architecture/service-bindings.md) |
| All environment variables | [Environment Variables](developer-guides/environment-variables.md) |
| Project deep dives | [Projects Index](projects/index.md) |
| Historical docs | [Historical Index](historical/index.md) |

## Monorepo Quick Reference

**20 Active Projects** (11 packages + 9 applications) — see [versions.md](versions.md) for current versions

### Applications

| Project | Type | Quick Link |
|---------|------|------------|
| `@xivdyetools/core` | npm library | [Overview](projects/core/overview.md) |
| `xivdyetools-web-app` | Vite + Lit | [Overview](projects/web-app/overview.md) |
| `xivdyetools-discord-worker` | CF Worker | [Overview](projects/discord-worker/overview.md) |
| `xivdyetools-moderation-worker` | CF Worker | [Overview](projects/moderation-worker/overview.md) |
| `xivdyetools-oauth` | CF Worker | [Overview](projects/oauth/overview.md) |
| `xivdyetools-api-worker` | CF Worker + KV | [Overview](projects/api-worker/overview.md) |
| `xivdyetools-presets-api` | CF Worker + D1 | [Overview](projects/presets-api/overview.md) |
| `xivdyetools-universalis-proxy` | CF Worker | [Overview](projects/universalis-proxy/overview.md) |
| `xivdyetools-og-worker` | CF Worker | [Overview](projects/og-worker/overview.md) |
| `xivdyetools-stoat-worker` | Node.js | — |
| `xivdyetools-maintainer` | Vue 3 + Vite | — |

### Shared Packages

| Package | Quick Link |
|---------|------------|
| `@xivdyetools/types` | [Overview](projects/types/overview.md) |
| `@xivdyetools/crypto` | — |
| `@xivdyetools/logger` | [Overview](projects/logger/overview.md) |
| `@xivdyetools/auth` | — |
| `@xivdyetools/rate-limiter` | — |
| `@xivdyetools/svg` | — |
| `@xivdyetools/bot-logic` | — |
| `@xivdyetools/bot-i18n` | — |
| `@xivdyetools/color-blending` | — |
| `@xivdyetools/test-utils` | [Overview](projects/test-utils/overview.md) |

Changes to packages require publishing to npm before consumers can use them (or use `workspace:*` protocol for monorepo-local resolution).

---

## Commands

All commands run from the **monorepo root** (`xivdyetools/`):

### Building & Testing

```bash
pnpm install                          # Install all workspace dependencies
pnpm turbo run build                  # Build all packages
pnpm turbo run test                   # Test all packages
pnpm turbo run type-check             # Type-check all packages
pnpm turbo run lint                   # Lint all packages
```

### Filtering to Specific Projects

```bash
# By package name
pnpm turbo run build --filter=@xivdyetools/core
pnpm turbo run test --filter=xivdyetools-discord-worker

# By directory
pnpm turbo run build --filter='./packages/*'
pnpm turbo run test --filter='./apps/*'

# Single test file
pnpm --filter @xivdyetools/core exec vitest run src/path/to/file.test.ts
```

### Dev Servers

```bash
pnpm --filter xivdyetools-web-app run dev          # localhost:5173
pnpm --filter xivdyetools-discord-worker run dev    # Wrangler local
pnpm --filter xivdyetools-oauth run dev             # localhost:8788
pnpm --filter xivdyetools-presets-api run dev       # localhost:8787
```

### Worker Deployment

```bash
pnpm --filter xivdyetools-discord-worker run deploy              # Staging
pnpm --filter xivdyetools-discord-worker run deploy:production   # Production
pnpm --filter xivdyetools-discord-worker run register-commands   # Register slash commands
```

### Publishing Libraries

```bash
pnpm turbo run build test --filter=@xivdyetools/<name>
# Bump version in packages/<name>/package.json
pnpm --filter @xivdyetools/<name> publish --provenance --access public --no-git-checks
```

---

## Architecture Quick Reference

For detailed architecture documentation, see:
- [Architecture Overview](architecture/overview.md) - Ecosystem diagram and component descriptions
- [Data Flow](architecture/data-flow.md) - OAuth, presets, and color matching flows
- [API Contracts](architecture/api-contracts.md) - Inter-service communication specs
- [Core Services](projects/core/services.md) - ColorService, DyeService, etc.
- [Core Algorithms](projects/core/algorithms.md) - k-d tree, K-means++, deltaE

---

## Key Patterns

### Service Usage (Core)
```typescript
// Types from @xivdyetools/types (since core v2.0.0)
import { Dye, RGB, HexColor } from '@xivdyetools/types';

// Services from @xivdyetools/core
import { ColorService, DyeService, dyeDatabase } from '@xivdyetools/core';

const rgb = ColorService.hexToRgb('#FF6B6B');  // Static
const dyeService = new DyeService(dyeDatabase); // Instance
```

### Service Bindings (Workers)
```typescript
if (env.PRESETS_API) {
  return env.PRESETS_API.fetch(request);
}
```

For more patterns, see [API Contracts](architecture/api-contracts.md).

---

## Cross-Project References

| Topic | Documentation |
|-------|---------------|
| Core library publishing | [Publishing Guide](projects/core/publishing.md) |
| Deployment workflow | [Deployment Guide](developer-guides/deployment.md) |
| Testing strategy | [Testing Guide](developer-guides/testing.md) |
| Feature specifications | [Specifications Index](specifications/index.md) |
| User guides | [User Guides Index](user-guides/index.md) |
