# 03 — Target Repository Structure

## Directory Layout

```
xivdyetools/                              # Monorepo root
├── .github/
│   └── workflows/
│       ├── ci.yml                         # Lint + test + build (all packages, affected-only)
│       ├── publish-packages.yml           # npm publish for libraries (manual dispatch)
│       ├── deploy-discord-worker.yml      # Per-worker deploy workflows
│       ├── deploy-moderation-worker.yml
│       ├── deploy-presets-api.yml
│       ├── deploy-oauth.yml
│       ├── deploy-universalis-proxy.yml
│       ├── deploy-og-worker.yml
│       └── deploy-web-app.yml
├── .vscode/
│   ├── settings.json                      # TypeScript SDK, ESLint working dirs, search excludes
│   └── extensions.json                    # Recommended extensions
├── packages/                              # Shared libraries (publishable to npm)
│   ├── types/                             # @xivdyetools/types
│   │   ├── src/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsconfig.build.json
│   │   └── vitest.config.ts
│   ├── crypto/                            # @xivdyetools/crypto
│   ├── logger/                            # @xivdyetools/logger
│   ├── auth/                              # @xivdyetools/auth
│   ├── rate-limiter/                      # @xivdyetools/rate-limiter
│   ├── core/                              # @xivdyetools/core
│   │   ├── src/
│   │   ├── scripts/                       # build-locales.ts, generate-version.ts, copy-locales.ts
│   │   ├── dyenames.csv                   # Locale source data
│   │   ├── localize.yaml                  # Locale config
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsconfig.build.json
│   │   └── vitest.config.ts
│   └── test-utils/                        # @xivdyetools/test-utils
├── apps/                                  # Applications (NOT published to npm)
│   ├── web-app/                           # Vite + Lit + Tailwind SPA
│   │   ├── src/
│   │   ├── assets/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   ├── vitest.config.ts
│   │   └── playwright.config.ts
│   ├── discord-worker/                    # Main Discord bot (Cloudflare Worker)
│   │   ├── src/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   └── wrangler.toml                  # Worker-specific: bindings, routes, secrets
│   ├── moderation-worker/                 # Moderation bot (Cloudflare Worker)
│   │   ├── src/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   └── wrangler.toml
│   ├── presets-api/                        # Community presets REST API
│   │   ├── src/
│   │   ├── schema.sql
│   │   ├── migrations/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   └── wrangler.toml
│   ├── oauth/                             # Discord OAuth + JWT worker
│   │   ├── src/
│   │   ├── schema/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   └── wrangler.toml
│   ├── universalis-proxy/                 # CORS proxy for Universalis market data
│   │   ├── src/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   └── wrangler.toml
│   ├── og-worker/                         # Dynamic OpenGraph image generation
│   │   ├── src/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── wrangler.toml
│   └── maintainer/                        # Local dev tool (Vue 3 + Express, private)
│       ├── src/
│       ├── server/
│       ├── package.json
│       ├── tsconfig.json
│       └── vite.config.ts
├── docs/                                  # Centralized documentation (not a buildable app)
│   ├── architecture/
│   ├── api-contracts/
│   ├── deployment/
│   └── research/
│       └── monorepo-consolidation/        # This folder
├── package.json                           # Root: workspace config, shared devDeps, turbo scripts
├── pnpm-workspace.yaml                    # Workspace definition
├── turbo.json                             # Turborepo pipeline config
├── tsconfig.base.json                     # Shared TypeScript compiler options
├── eslint.config.js                       # Root ESLint flat config
├── prettier.config.js                     # Root Prettier config
├── .npmrc                                 # pnpm settings (NO auth tokens!)
├── .gitignore
├── CLAUDE.md                              # Updated workspace guidance
└── README.md
```

## Workspace Configuration

### pnpm-workspace.yaml

```yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

`docs/` is intentionally excluded — it's not a Node.js package and has no `package.json`.

### Root package.json

```json
{
  "name": "xivdyetools",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "type-check": "turbo run type-check",
    "format": "prettier --write \"**/*.{ts,tsx,json,md}\"",
    "format:check": "prettier --check \"**/*.{ts,tsx,json,md}\"",
    "clean": "turbo run clean"
  },
  "devDependencies": {
    "turbo": "^2.x",
    "typescript": "^5.9.3",
    "eslint": "^9.39.2",
    "@eslint/js": "^9.39.2",
    "typescript-eslint": "^8.53.1",
    "prettier": "^3.7.4",
    "rimraf": "^6.1.2"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "packageManager": "pnpm@10.x"
}
```

### What Gets Hoisted vs Per-Project

**Hoisted to root `devDependencies`** (used by nearly all projects):
- `typescript`, `eslint`, `prettier`, `rimraf`, `turbo`

**NOT hoisted — `vitest` stays per-project:**
- `presets-api` and `oauth` require Vitest 3.x (for `@cloudflare/vitest-pool-workers` compatibility)
- All other projects use Vitest 4.x
- Each project declares its own `vitest` and `@vitest/coverage-v8` version

**Per-project `devDependencies`** (only needed by specific projects):
- `wrangler` — only workers
- `@cloudflare/workers-types` — only workers
- `@cloudflare/vitest-pool-workers` — only presets-api and oauth
- `@playwright/test` — only web-app
- `@vitejs/plugin-vue` — only maintainer
- `vite` — only web-app and maintainer
- `tsx` — only core (for build scripts)
- `csv-parse`, `yaml` — only core (locale build)
- `typedoc` — only core (docs generation)
- `husky`, `lint-staged` — only root (pre-commit hooks)

**Per-project `dependencies`** (runtime, never hoisted):
- All `@xivdyetools/*` packages use `workspace:*`
- `hono` — per-worker (could technically hoist but cleaner per-project)
- `spectral.js` — only core
- `@resvg/resvg-wasm`, `@cf-wasm/photon` — only discord-worker and og-worker
- `discord-interactions` — only auth
- `@upstash/redis` — only rate-limiter

## .npmrc Configuration

```ini
# Use pnpm's strict dependency resolution
strict-peer-dependencies=false
auto-install-peers=true

# IMPORTANT: No auth tokens in this file!
# npm publish authentication is handled via:
#   - CI: NPM_TOKEN environment variable in GitHub Actions
#   - Local: `npm login` or NPM_TOKEN env var
```

### Security: Auth Token Migration

**Current state:** Every library has `.npmrc` with a plaintext npm auth token. This token is in git history.

**Required actions before migration:**
1. Revoke the current token on npmjs.com
2. Generate a new token
3. Add `NPM_TOKEN` as a GitHub Actions secret
4. For local publishing: use `npm login` or set `NPM_TOKEN` env var
5. Add `.npmrc` to `.gitignore` (for any local auth-containing copies)

## VS Code Workspace Settings

### .vscode/settings.json

```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "eslint.workingDirectories": [
    { "pattern": "packages/*" },
    { "pattern": "apps/*" }
  ],
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.wrangler": true,
    "**/coverage": true
  },
  "files.exclude": {
    "**/node_modules": true
  }
}
```

### .vscode/extensions.json

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "nicolo-ribaudo.pnpm-vscode"
  ]
}
```
