# 08 — CI/CD Migration Strategy

## Current State

| Project | CI/CD | Workflows |
|---------|-------|-----------|
| `@xivdyetools/core` | GitHub Actions | ci.yml (test matrix), publish.yml (npm), integration-tests.yml, test-coverage.yml, docs.yml |
| `web-app` | GitHub Actions | playwright.yml (E2E) |
| `discord-worker` | GitHub Actions | deploy.yml |
| **All other projects** | **None** | — |

## Target State

Three types of workflows in the monorepo:

1. **ci.yml** — Runs on every push/PR: lint, type-check, test, build (affected packages only)
2. **deploy-\*.yml** — Per-worker deploy workflows, triggered by path changes or manual dispatch
3. **publish-packages.yml** — npm publish for libraries, manual dispatch only

## 1. Main CI Workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 2  # Needed for turbo affected detection

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint (affected only)
        run: pnpm turbo run lint --filter='...[HEAD^]'

      - name: Type Check (affected only)
        run: pnpm turbo run type-check --filter='...[HEAD^]'

      - name: Test (affected only)
        run: pnpm turbo run test --filter='...[HEAD^]'

      - name: Build (affected only)
        run: pnpm turbo run build --filter='...[HEAD^]'
```

### How `--filter='...[HEAD^]'` Works

Turborepo compares the current commit to `HEAD^` (previous commit) to determine which packages have changed files. The `...` prefix means "include all downstream dependents." So if `@xivdyetools/types` changes:

1. `types` itself is affected (changed files)
2. `core`, `test-utils` are affected (depend on types)
3. `discord-worker`, `web-app`, etc. are affected (depend on core/test-utils)

This means a single types change correctly triggers tests across the entire dependency tree, while changes to `universalis-proxy` only test that one package.

## 2. Per-Worker Deploy Workflows

Each worker gets its own deploy workflow. The `paths` filter ensures deploys only trigger when the worker or its dependencies change.

### Template (discord-worker example)

```yaml
# .github/workflows/deploy-discord-worker.yml
name: Deploy Discord Worker

on:
  push:
    branches: [main]
    paths:
      - 'apps/discord-worker/**'
      - 'packages/core/**'
      - 'packages/types/**'
      - 'packages/logger/**'
      - 'packages/auth/**'
      - 'packages/rate-limiter/**'
      - 'packages/crypto/**'
  workflow_dispatch:
    inputs:
      environment:
        description: 'Deploy environment'
        type: choice
        options:
          - production
          - staging
        default: production

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment || 'production' }}
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: Build dependencies
        run: pnpm turbo run build --filter=discord-worker

      - name: Type check
        run: pnpm turbo run type-check --filter=discord-worker

      - name: Run tests
        run: pnpm turbo run test --filter=discord-worker

      - name: Deploy
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          workingDirectory: apps/discord-worker
          command: deploy ${{ inputs.environment == 'staging' && '' || '--env production' }}
```

### Path Filters Per Worker

| Worker | Paths that trigger deploy |
|--------|--------------------------|
| discord-worker | `apps/discord-worker/**`, `packages/core/**`, `packages/types/**`, `packages/logger/**`, `packages/auth/**`, `packages/rate-limiter/**`, `packages/crypto/**` |
| moderation-worker | `apps/moderation-worker/**`, `packages/types/**`, `packages/logger/**`, `packages/auth/**`, `packages/rate-limiter/**` |
| presets-api | `apps/presets-api/**`, `packages/types/**`, `packages/logger/**`, `packages/auth/**`, `packages/rate-limiter/**`, `packages/crypto/**` |
| oauth | `apps/oauth/**`, `packages/types/**`, `packages/logger/**`, `packages/rate-limiter/**`, `packages/crypto/**` |
| universalis-proxy | `apps/universalis-proxy/**`, `packages/rate-limiter/**` |
| og-worker | `apps/og-worker/**`, `packages/core/**`, `packages/types/**` |
| web-app | `apps/web-app/**`, `packages/core/**`, `packages/types/**`, `packages/logger/**` |

## 3. npm Publish Workflow

```yaml
# .github/workflows/publish-packages.yml
name: Publish Package to npm

on:
  workflow_dispatch:
    inputs:
      package:
        description: 'Package to publish'
        required: true
        type: choice
        options:
          - types
          - crypto
          - logger
          - auth
          - rate-limiter
          - core
          - test-utils

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write  # Required for npm provenance
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          registry-url: 'https://registry.npmjs.org'

      - run: pnpm install --frozen-lockfile

      - name: Build package and dependencies
        run: pnpm turbo run build --filter=@xivdyetools/${{ inputs.package }}

      - name: Test package
        run: pnpm turbo run test --filter=@xivdyetools/${{ inputs.package }}

      - name: Publish
        working-directory: packages/${{ inputs.package }}
        run: pnpm publish --provenance --access public --no-git-checks
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**`--no-git-checks`**: Required because pnpm's default publish behavior checks if the git working directory is clean and on a tagged commit. In a monorepo, this check is overly strict since other packages' changes may be uncommitted.

**Publishing flow:**
1. Bump version in `packages/<name>/package.json`
2. Commit and push to main
3. Trigger the publish workflow manually, selecting the package
4. Workflow builds, tests, and publishes with provenance

## GitHub Actions Secrets Inventory

| Secret | Used By | Purpose |
|--------|---------|---------|
| `CLOUDFLARE_API_TOKEN` | All deploy workflows | Wrangler authentication |
| `CLOUDFLARE_ACCOUNT_ID` | All deploy workflows | Cloudflare account targeting |
| `NPM_TOKEN` | publish-packages.yml | npm registry authentication |

Worker-specific secrets (DISCORD_TOKEN, BOT_API_SECRET, etc.) are configured via `wrangler secret put` directly in Cloudflare, not in GitHub Actions.

## Turborepo Remote Caching

Enable remote caching to share build caches between CI runs and local development:

```bash
# One-time setup
pnpm turbo login
pnpm turbo link
```

In CI, add the Turborepo token:

```yaml
env:
  TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
  TURBO_TEAM: ${{ vars.TURBO_TEAM }}
```

This dramatically reduces CI build times — if a package hasn't changed since the last CI run, its cached build output is downloaded instead of rebuilt.

## Migration from Existing Workflows

| Existing Workflow | Action |
|-------------------|--------|
| `core/.github/workflows/ci.yml` | Replaced by monorepo `ci.yml` |
| `core/.github/workflows/publish.yml` | Replaced by `publish-packages.yml` |
| `core/.github/workflows/integration-tests.yml` | Folded into `ci.yml` test step |
| `core/.github/workflows/test-coverage.yml` | Folded into `ci.yml` test step |
| `core/.github/workflows/docs.yml` | Can be a separate workflow or removed |
| `web-app/.github/workflows/playwright.yml` | Add as a separate job in `ci.yml` or keep standalone |
| `discord-worker/.github/workflows/deploy.yml` | Replaced by `deploy-discord-worker.yml` |
