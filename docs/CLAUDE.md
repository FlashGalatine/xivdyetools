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

**12 Active Projects** - see [versions.md](versions.md) for current versions

| Project | Type | Quick Link |
|---------|------|------------|
| `xivdyetools-core` | npm library | [Overview](projects/core/overview.md) |
| `xivdyetools-web-app` | Vite + Lit | [Overview](projects/web-app/overview.md) |
| `xivdyetools-discord-worker` | CF Worker | [Overview](projects/discord-worker/overview.md) |
| `xivdyetools-oauth` | CF Worker | [Overview](projects/oauth/overview.md) |
| `xivdyetools-presets-api` | CF Worker + D1 | [Overview](projects/presets-api/overview.md) |
| `xivdyetools-universalis-proxy` | CF Worker | [Overview](projects/universalis-proxy/overview.md) |

Changes to core require publishing to npm before consumers can use them.

---

## Commands

### xivdyetools-core (Library)
```bash
cd xivdyetools-core
npm run build              # Compile TypeScript + build locales
npm test                   # Run vitest
npm run test:coverage      # Test with coverage (90% threshold)
npm run test:integration   # Integration tests only
npm run lint               # ESLint check
npm run type-check         # TypeScript check only
npm run docs               # Generate TypeDoc
```

### xivdyetools-web-app (Web App)
```bash
cd xivdyetools-web-app
npm run dev                # Start dev server (localhost:5173)
npm run build              # Production build
npm run test               # Run vitest
npm run preview            # Preview production build
npm run build:css          # Rebuild Tailwind CSS
```

### xivdyetools-discord-worker (Discord Bot)
```bash
cd xivdyetools-discord-worker
npm run dev                # Wrangler local dev server
npm run deploy             # Deploy to Cloudflare (staging)
npm run deploy:production  # Deploy to production
npm run test               # Run vitest
npm run register-commands  # Register slash commands
npm run upload-emojis      # Upload emoji mappings
```

### xivdyetools-oauth (Auth Worker)
```bash
cd xivdyetools-oauth
npm run dev                # Local dev server (port 8788)
npm run deploy             # Deploy to Cloudflare
npm run type-check         # TypeScript validation
```

### xivdyetools-presets-api (Presets Worker)
```bash
cd xivdyetools-presets-api
npm run dev                # Local dev server (port 8787)
npm run deploy             # Deploy to staging
npm run deploy:production  # Deploy to production
npm run db:migrate:local   # Apply schema to local D1
npm run db:migrate         # Apply schema to production D1
```

### xivdyetools-universalis-proxy (Market Data Proxy)
```bash
cd xivdyetools-universalis-proxy
npm run dev                # Local dev server
npm run deploy             # Deploy to staging
npm run deploy:production  # Deploy to production
npm run test               # Run vitest
npm run type-check         # TypeScript validation
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
import { ColorService, DyeService, dyeDatabase } from 'xivdyetools-core';

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
