# 09 — Phased Migration Plan

## Timeline Overview

| Phase | Duration | Description |
|-------|----------|-------------|
| 0 | 1-2 hours | Preparation: revoke tokens, normalize versions, tag repos |
| 1 | 1 hour | Scaffold monorepo: pnpm-workspace, turbo.json, shared configs |
| 2 | 2-3 hours | Migrate libraries in dependency order |
| 3 | 3-4 hours | Migrate applications |
| 4 | 30 min | Migrate docs |
| 5 | 2-3 hours | CI/CD setup and testing |
| 6 | 1-2 hours | Staging deploy and verification |
| 7 | 30 min | Production cutover and cleanup |

**Total estimated effort: 12-16 hours** (can be spread across multiple sessions).

## Phase 0: Preparation

**Goal**: Clean up the current state before creating the monorepo.

### 0.1 Revoke Exposed npm Token

The `.npmrc` files in all 7 libraries contain the same plaintext npm auth token. This token is in git history and must be revoked.

1. Go to npmjs.com → Access Tokens
2. Revoke the exposed token (already done — token was revoked)
3. Generate a new automation token for CI
4. Store the new token securely (1Password, GitHub Secrets)

### 0.2 Normalize Third-Party Versions

Update all projects to consistent versions before migration:

```bash
# In presets-api and oauth: upgrade vitest 3.x → 4.x
pnpm add -D vitest@^4.0.15 @vitest/coverage-v8@^4.0.15

# In universalis-proxy and auth: upgrade typescript 5.7 → 5.9
pnpm add -D typescript@^5.9.3

# In all workers: upgrade to latest wrangler
pnpm add -D wrangler@latest

# In presets-api and og-worker: upgrade hono
pnpm add hono@latest
```

Verify each project builds and tests after upgrading.

### 0.3 Tag All Existing Repos

In each repository:
```bash
git tag archive/pre-monorepo
git push origin archive/pre-monorepo
```

This creates a permanent reference point for the pre-monorepo state.

### 0.4 Update @xivdyetools/* to Latest

Ensure all consumers use the latest published version of each library. This step is technically optional (the monorepo will override with `workspace:*` anyway), but ensures the pre-migration state is clean.

---

## Phase 1: Scaffold Monorepo

**Goal**: Create the empty monorepo structure with all configuration files.

### 1.1 Create Repository

```bash
mkdir xivdyetools && cd xivdyetools
git init
```

### 1.2 Create Root Configuration Files

Create these files (contents defined in earlier documents):
- `pnpm-workspace.yaml` — workspace definition
- `package.json` — root workspace config + shared devDeps
- `turbo.json` — Turborepo pipeline
- `tsconfig.base.json` — shared TypeScript options
- `eslint.config.js` — root ESLint flat config
- `prettier.config.js` — root Prettier config
- `.npmrc` — pnpm settings (NO auth tokens)
- `.gitignore` — standard ignores + `.npmrc`, `.wrangler`
- `.vscode/settings.json` — workspace IDE config
- `.vscode/extensions.json` — recommended extensions

### 1.3 Create Directory Structure

```bash
mkdir -p packages apps docs
```

### 1.4 Install and Verify

```bash
pnpm install
pnpm turbo run build  # Should succeed (nothing to build yet)
```

### 1.5 Initial Commit

```bash
git add .
git commit -m "chore: scaffold monorepo with pnpm + turborepo"
```

---

## Phase 2: Migrate Libraries

**Goal**: Copy all 7 library packages into `packages/`, converting to workspace protocol.

**Order matters** — migrate in dependency order so each package can be tested as it's added.

### 2.1 Level 0: types, crypto, logger (parallel — no internal deps)

For each package:

1. Copy source files into `packages/<name>/`:
   - `src/`
   - `package.json` (will be modified)
   - `tsconfig.json`, `tsconfig.build.json`
   - `vitest.config.ts`
   - `README.md`
   - Any data files (e.g., `src/data/` for types)
2. **Do NOT copy**: `node_modules/`, `dist/`, `.npmrc`, `.git/`
3. Modify `package.json`:
   - Remove devDeps that are now at root (typescript, vitest, rimraf, etc.)
   - Keep package-specific devDeps
4. Modify `tsconfig.json`: change to `"extends": "../../tsconfig.base.json"`
5. Verify:
   ```bash
   pnpm install
   pnpm turbo run build test --filter=@xivdyetools/types
   pnpm turbo run build test --filter=@xivdyetools/crypto
   pnpm turbo run build test --filter=@xivdyetools/logger
   ```

### 2.2 Level 1: auth, rate-limiter

1. Copy source files (same process as above)
2. In `package.json`, change `"@xivdyetools/crypto": "^1.0.0"` to `"@xivdyetools/crypto": "workspace:*"`
3. Verify:
   ```bash
   pnpm turbo run build test --filter=@xivdyetools/auth
   pnpm turbo run build test --filter=@xivdyetools/rate-limiter
   ```

### 2.3 Level 2: core, test-utils

**core** is the most complex — it has the locale build pipeline:

1. Copy source files PLUS:
   - `scripts/` (build-locales.ts, generate-version.ts, copy-locales.ts)
   - `dyenames.csv`
   - `localize.yaml`
2. Convert deps to `workspace:*`:
   ```json
   "@xivdyetools/types": "workspace:*",
   "@xivdyetools/logger": "workspace:*"
   ```
3. Update build script: change `npm run` to direct script references (or keep as-is — `pnpm run` works the same way)
4. Keep `tsx`, `csv-parse`, `yaml` in core's devDependencies (not hoisted — only core needs them)
5. Verify the multi-step build:
   ```bash
   pnpm turbo run build --filter=@xivdyetools/core
   ```
6. Run tests:
   ```bash
   pnpm turbo run test --filter=@xivdyetools/core
   ```

**test-utils**: Straightforward — convert workspace deps and verify.

### 2.4 Full Library Verification

```bash
pnpm turbo run build test lint type-check --filter='./packages/*'
```

All 7 libraries should build and test successfully.

### 2.5 Commit

```bash
git add packages/
git commit -m "feat: migrate all 7 @xivdyetools libraries to monorepo"
```

---

## Phase 3: Migrate Applications

**Goal**: Copy all 8 apps into `apps/`, converting to workspace protocol.

Apps can be migrated in any order since they don't depend on each other at build time. Recommended order: simplest to most complex.

### 3.1 universalis-proxy (simplest — 1 workspace dep)

1. Copy `src/`, `package.json`, `tsconfig.json`, `vitest.config.ts`, `wrangler.toml`
2. Convert: `"@xivdyetools/rate-limiter": "workspace:*"`
3. Add `"private": true` to package.json
4. Verify:
   ```bash
   pnpm turbo run build test --filter=universalis-proxy
   cd apps/universalis-proxy && pnpm wrangler dev  # Test locally
   ```

### 3.2 oauth

1. Copy files including `schema/` directory
2. Convert 4 workspace deps
3. Verify D1 and KV bindings work with `wrangler dev`

### 3.3 presets-api

1. Copy files including `schema.sql`, `migrations/`
2. Convert 5 workspace deps
3. Verify service binding to discord-worker (name must match)

### 3.4 moderation-worker

1. Copy files
2. Convert 4 workspace deps
3. Verify service binding to presets-api

### 3.5 og-worker

1. Copy files
2. Convert 2 workspace deps
3. Test WASM loading (`@resvg/resvg-wasm`)

### 3.6 discord-worker (most complex)

1. Copy files including fonts (`src/fonts/*.ttf`)
2. Convert 6 workspace deps (5 deps + 1 devDep)
3. Keep `[[rules]]` for `.ttf` files in `wrangler.toml`
4. **Critical tests**:
   - SVG rendering with CJK fonts
   - WASM module loading (resvg, photon)
   - Service bindings (PRESETS_API, UNIVERSALIS_PROXY)
   - Path alias `@/` resolution in vitest

### 3.7 web-app

1. Copy files including `assets/`, Playwright config
2. Convert 3 workspace deps + 1 devDep
3. Verify:
   - Vite dev server works with workspace-linked packages
   - Path aliases resolve correctly
   - Tailwind CSS compilation
   - Playwright E2E tests (if infrastructure allows)

### 3.8 maintainer

1. Copy files
2. Convert `"@xivdyetools/core": "file:../xivdyetools-core"` to `"workspace:*"`
3. Add `"private": true`
4. Verify `concurrently` dev script (Vue client + Express server)

### 3.9 Commit

```bash
git add apps/
git commit -m "feat: migrate all 8 applications to monorepo"
```

---

## Phase 4: Migrate Docs

1. Copy `xivdyetools-apps/docs/` content to `docs/` at monorepo root
2. Update any internal links that reference old paths
3. Commit:
   ```bash
   git add docs/
   git commit -m "docs: migrate centralized documentation"
   ```

---

## Phase 5: CI/CD Setup

### 5.1 GitHub Repository Setup

1. Create the GitHub repository (if not already done)
2. Push the monorepo
3. Configure GitHub Actions secrets:
   - `NPM_TOKEN` — new npm automation token
   - `CLOUDFLARE_API_TOKEN` — Cloudflare API token
   - `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID
   - `TURBO_TOKEN` — Turborepo remote cache token (optional)

### 5.2 Create Workflow Files

Create all workflow files as defined in [08-cicd-migration.md](./08-cicd-migration.md):
- `.github/workflows/ci.yml`
- `.github/workflows/publish-packages.yml`
- `.github/workflows/deploy-discord-worker.yml`
- `.github/workflows/deploy-moderation-worker.yml`
- `.github/workflows/deploy-presets-api.yml`
- `.github/workflows/deploy-oauth.yml`
- `.github/workflows/deploy-universalis-proxy.yml`
- `.github/workflows/deploy-og-worker.yml`
- `.github/workflows/deploy-web-app.yml`

### 5.3 Test CI Pipeline

1. Push a commit that touches a library (e.g., add a comment in `packages/types/src/index.ts`)
2. Verify CI runs lint/test/build for types and all its dependents
3. Push a commit that only touches an app (e.g., `apps/universalis-proxy/`)
4. Verify CI only tests that app and its direct dependencies

### 5.4 Test npm Publish (Dry Run)

```bash
cd packages/types
pnpm publish --dry-run
```

Verify that `workspace:*` references are replaced with real version numbers in the published package.

---

## Phase 6: Staging Deploy and Verification

### 6.1 Deploy Each Worker to Staging

From the monorepo root:

```bash
cd apps/universalis-proxy && pnpm wrangler deploy
cd apps/oauth && pnpm wrangler deploy
cd apps/presets-api && pnpm wrangler deploy
cd apps/discord-worker && pnpm wrangler deploy
cd apps/moderation-worker && pnpm wrangler deploy
cd apps/og-worker && pnpm wrangler deploy
```

### 6.2 Smoke Test

- [ ] Discord bot responds to `/harmony` (tests core, SVG rendering, fonts)
- [ ] Discord bot responds to `/budget` (tests Universalis proxy service binding)
- [ ] Discord bot responds to `/preset` (tests presets API service binding)
- [ ] Web app loads and renders tools (tests web-app + core)
- [ ] OAuth flow works (tests oauth worker + KV)
- [ ] Moderation bot responds to commands (tests moderation service binding)
- [ ] OG images generate for shared links (tests og-worker + core)

### 6.3 Deploy to Production

Once staging is verified, deploy to production one worker at a time:

```bash
cd apps/universalis-proxy && pnpm wrangler deploy --env production
cd apps/oauth && pnpm wrangler deploy --env production
# ... etc.
```

---

## Phase 7: Cleanup

### 7.1 Update CLAUDE.md Files

- Root `CLAUDE.md`: Update for monorepo structure, remove multi-repo workflow references
- Per-project `CLAUDE.md` files: Update paths, remove npm publish instructions
- Add monorepo-specific guidance (pnpm commands, turbo filters)

### 7.2 Deprecate Old Repos

Add to each old repo's README:

```markdown
> **This repository has been archived.**
> Development has moved to the [xivdyetools monorepo](https://github.com/FlashGalatine/xivdyetools).
```

### 7.3 Archive Old Repos

After 3 months of stable monorepo operation:
1. Set each old repo to "Archived" on GitHub
2. This makes them read-only but preserves all history and tags

---

## Risk Mitigation Summary

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Service binding name mismatch | Low | High (bot goes down) | Verify `wrangler.toml` names unchanged, test staging first |
| WASM module resolution failure | Medium | High (SVG rendering breaks) | Test in dev mode first, fallback to `node-linker=hoisted` |
| Font file resolution through symlinks | Medium | Medium (CJK text renders wrong) | Test CJK rendering, copy fonts locally if needed |
| Breaking live Discord bot | Low | High | Don't delete old repos until monorepo deploys verified |
| `workspace:*` publish failure | Low | Medium | Test with `--dry-run` before first real publish |
| Vitest version upgrade breaks tests | Medium | Low | Fix before migration in Phase 0 |
| CI build times increase | Low | Low | Turborepo caching + affected-only filtering |
