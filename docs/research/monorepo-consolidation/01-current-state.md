# 01 — Current State: Architecture Audit

## Project Inventory

### NPM Libraries (7 packages)

All under `npm-@xivdyetools/`, published to npm under the `@xivdyetools` scope.

| Package | Version | Internal Deps | External Deps | Build | CI/CD |
|---------|---------|---------------|---------------|-------|-------|
| `@xivdyetools/types` | 1.7.0 | None | None | tsc | None |
| `@xivdyetools/crypto` | 1.0.0 | None | None | tsc | None |
| `@xivdyetools/logger` | 1.1.2 | None | None | tsc | None |
| `@xivdyetools/auth` | 1.0.2 | crypto | discord-interactions | tsc | None |
| `@xivdyetools/rate-limiter` | 1.3.0 | None | @upstash/redis | tsc | None |
| `@xivdyetools/test-utils` | 1.1.1 | types, crypto | vitest (peer) | tsc | None |
| `@xivdyetools/core` | 1.16.0 | types, logger | spectral.js | tsc + locale pipeline | GitHub Actions (4 workflows) |

**Key observation:** Only `core` has any CI/CD. The other 6 libraries ship without automated testing in pipelines.

### Applications (8 projects)

All under `xivdyetools-apps/`.

| Project | Type | Framework | @xivdyetools deps |
|---------|------|-----------|-------------------|
| `web-app` | Vite 7 SPA | Lit + Tailwind | core, logger, types |
| `discord-worker` | CF Worker | Hono | auth, core, logger, rate-limiter, types, test-utils |
| `moderation-worker` | CF Worker | Hono | auth, logger, rate-limiter, types, test-utils |
| `presets-api` | CF Worker + D1 | Hono | auth, crypto, logger, rate-limiter, types, test-utils |
| `oauth` | CF Worker + D1 | Hono | crypto, logger, rate-limiter, types, test-utils |
| `universalis-proxy` | CF Worker | Hono | rate-limiter |
| `og-worker` | CF Worker | Hono | core, types |
| `maintainer` | Vue 3 + Express | Vue 3 | core (via `file:` link) |

**Also present:** `stoat-worker` (appears in directory listing but details unknown), `docs` (documentation hub).

## Dependency Graph

```
Level 0 (no internal deps):
  @xivdyetools/types
  @xivdyetools/crypto
  @xivdyetools/logger

Level 1:
  @xivdyetools/auth         ← crypto
  @xivdyetools/rate-limiter ← (no internal deps, external: @upstash/redis)

Level 2:
  @xivdyetools/core         ← types, logger
  @xivdyetools/test-utils   ← types, crypto

Level 3 (applications):
  discord-worker       ← auth, core, logger, rate-limiter, types
  moderation-worker    ← auth, logger, rate-limiter, types
  presets-api          ← auth, crypto, logger, rate-limiter, types
  oauth                ← crypto, logger, rate-limiter, types
  web-app              ← core, logger, types
  og-worker            ← core, types
  universalis-proxy    ← rate-limiter
  maintainer           ← core (file: link)
```

## Version Drift

The most critical problem — consumers pin old library versions:

| Library | Published Version | discord-worker | moderation-worker | presets-api | oauth | web-app | og-worker |
|---------|------------------|----------------|-------------------|-------------|-------|---------|-----------|
| types | **1.7.0** | 1.1.1 | 1.1.1 | 1.1.1 | 1.1.1 | 1.7.0 | 1.7.0 |
| core | **1.16.0** | 1.16.0 | — | — | — | 1.14.0 | 1.15.1 |
| logger | **1.1.2** | 1.1.2 | 1.1.2 | 1.0.2 | 1.1.2 | 1.1.0 | — |
| auth | **1.0.2** | 1.0.2 | 1.0.2 | 1.0.0 | — | — | — |
| rate-limiter | **1.3.0** | 1.3.0 | 1.3.0 | 1.0.0 | 1.3.0 | — | — |
| test-utils | **1.1.1** | 1.0.3 | 1.0.3 | 1.0.3 | 1.0.3 | 1.1.0 | — |
| crypto | **1.0.0** | — | — | 1.0.0 | 1.0.0 | — | — |

**Worst drift:** `@xivdyetools/types` — 4 workers are 6 minor versions behind. `@xivdyetools/rate-limiter` in presets-api is 3 minor versions behind.

## Third-Party Version Drift

| Dependency | Lowest | Highest | Target |
|-----------|--------|---------|--------|
| vitest | 3.2.4 (presets-api, oauth) | 4.0.18 (auth) | 4.0.x |
| wrangler | 4.59.1 (presets-api, oauth) | 4.63.0 (moderation, universalis) | Latest 4.x |
| typescript | 5.7.2 (universalis-proxy, auth) | 5.9.3 (most) | 5.9.x |
| hono | 4.11.7 (presets-api, og-worker) | 4.11.9 (discord, oauth, moderation) | Latest 4.x |
| @cloudflare/workers-types | Various 4.x dates | Latest 4.x | Latest |

## Shared Infrastructure

### D1 Databases

| Database | ID | Used By |
|----------|-----|---------|
| xivdyetools-presets | `e17d68a1-5a44-4c88-b02b-07d053cbe321` | discord-worker, presets-api, moderation-worker |
| xivdyetools-users | `6e97b759-70dd-49a8-a93c-0541c7fe6c67` | oauth |

### KV Namespaces

| Namespace | ID | Used By |
|-----------|-----|---------|
| KV (prefs/favorites) | `1fcb7e037ccd4172a47fccd97cf8e753` | discord-worker, moderation-worker |
| TOKEN_BLACKLIST (prod) | `0d6f3be3b4704e91a83e6387b9769e45` | oauth |
| TOKEN_BLACKLIST (dev) | `891bbbe834ba4055a06b672b589094be` | oauth |

### Service Bindings (Worker-to-Worker)

| Source | Binding | Target |
|--------|---------|--------|
| discord-worker | `PRESETS_API` | xivdyetools-presets-api |
| discord-worker | `UNIVERSALIS_PROXY` | xivdyetools-universalis-proxy |
| presets-api | `DISCORD_WORKER` | xivdyetools-discord-worker |
| moderation-worker | `PRESETS_API` | xivdyetools-presets-api |

### Shared Secrets (must match across workers)

| Secret | Shared Between |
|--------|---------------|
| BOT_API_SECRET | discord-worker, moderation-worker, presets-api |
| BOT_SIGNING_SECRET | discord-worker, moderation-worker, presets-api |
| JWT_SECRET | oauth, presets-api |

## CI/CD Status

| Project | GitHub Actions | Workflows |
|---------|---------------|-----------|
| `@xivdyetools/core` | Yes | ci.yml, publish.yml, integration-tests.yml, test-coverage.yml, docs.yml |
| `web-app` | Yes | playwright.yml (E2E) |
| `discord-worker` | Yes | deploy.yml |
| All others | **None** | — |

## Build Characteristics

| Aspect | Pattern |
|--------|---------|
| Build tool | TypeScript compiler (tsc) for libraries; Wrangler for workers; Vite for web-app |
| Module format | ESM only (`"type": "module"`) across all projects |
| Exports style | Subpath exports (e.g., `@xivdyetools/types/color`) |
| Declarations | Full `.d.ts` with declaration maps and source maps |
| Build artifacts | `dist/` directory for all libraries |
| Test runner | Vitest across all projects |
| Linting | ESLint (only in `core` and `web-app`) |
| Formatting | Prettier (only in `core`) |

### Special Build: `@xivdyetools/core`

The `core` package has a multi-step build pipeline:

```bash
npm run build:version    # Generate src/version.ts from package.json
npm run build:locales    # Parse YAML + CSV → JSON locale files (6 languages)
tsc                      # TypeScript compilation
npm run copy:locales     # Copy locale JSON files to dist/
```

This pipeline must be preserved in the monorepo.
