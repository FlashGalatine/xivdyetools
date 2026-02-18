# 07 — Wrangler + pnpm Compatibility Investigation

## Overview

Cloudflare Wrangler has official support for pnpm workspaces and monorepo setups. As of Wrangler 4.x (2025), the tool intelligently detects where to store cache files regardless of the package manager, improving compatibility with pnpm's symlink-based `node_modules` without requiring configuration.

However, there are specific edge cases to test. This document catalogs known issues and mitigation strategies.

## Known Issues

### 1. pnpm Symlink Resolution

**What**: pnpm uses a content-addressable store with symlinks in `node_modules`. Some tools that expect a flat `node_modules` layout may fail to resolve dependencies through symlinks.

**Impact on this project**: Wrangler bundles worker code using esbuild internally. esbuild generally handles symlinks well, but there are edge cases:
- WASM modules loaded via `import` may not resolve through symlinks
- Binary files declared in `[[rules]]` (like `.ttf` fonts in discord-worker) need testing

**Mitigation**: If any resolution issues occur, add to root `.npmrc`:
```ini
node-linker=hoisted
```
This makes pnpm fall back to npm-style flat `node_modules`, at the cost of losing strict dependency isolation. This is the nuclear option — try without it first.

**Selective mitigation**: pnpm allows per-package settings via `.pnpmfile.cjs` hooks, but this is complex. The simpler approach is to test each worker and only fall back to hoisted if needed.

### 2. WASM Module Loading

**Affected packages**:
- `discord-worker` uses `@resvg/resvg-wasm` (2.4 MiB) and `@cf-wasm/photon` (1.6 MiB)
- `og-worker` uses `@resvg/resvg-wasm` (2.4 MiB)

**What to test**: WASM modules are typically loaded at runtime via `WebAssembly.instantiate()` or import statements. Wrangler needs to find and bundle these `.wasm` files correctly.

**Test procedure**:
1. After migrating discord-worker to monorepo, run `wrangler dev` from `apps/discord-worker/`
2. Execute a command that triggers SVG rendering (e.g., `/harmony`)
3. Verify the generated image is correct
4. If WASM fails to load, check wrangler output for resolution errors

**Known fix if needed**: Add explicit WASM import paths in the worker or use Wrangler's `rules` configuration to handle `.wasm` files:
```toml
[[rules]]
type = "CompiledWasm"
globs = ["**/*.wasm"]
fallthrough = true
```

### 3. Binary File Rules (.ttf fonts)

**Affected**: `discord-worker` has a `[[rules]]` entry for font files:
```toml
[[rules]]
type = "Data"
globs = ["**/*.ttf"]
fallthrough = true
```

**Concern**: pnpm symlinks workspace packages, so `@xivdyetools/core`'s font files (in `packages/core/src/fonts/`) would be resolved through symlinks. Wrangler's esbuild plugin needs to follow these symlinks to find the `.ttf` files.

**Test procedure**:
1. Migrate discord-worker with its font-dependent SVG rendering
2. Run `wrangler dev` and test localized dye name rendering (CJK characters)
3. Verify `NotoSansSC-Subset.ttf` and `NotoSansKR-Subset.ttf` load correctly

**Mitigation if needed**: Copy font files into the worker's `src/` directory rather than importing from `packages/core/`. This eliminates the symlink chain.

### 4. Service Binding Names

**Not a pnpm issue, but critical for monorepo migration**.

Service bindings in `wrangler.toml` reference workers by their **deployed name**, not by their workspace package name:

```toml
[[services]]
binding = "PRESETS_API"
service = "xivdyetools-presets-api"   # This is the deployed worker name
```

The deployed worker name comes from the `name` field in each `wrangler.toml`:
- `discord-worker/wrangler.toml` → `name = "xivdyetools-discord-worker"`
- `presets-api/wrangler.toml` → `name = "xivdyetools-presets-api"`
- `moderation-worker/wrangler.toml` → `name = "xivdyetools-moderation-worker"`
- `universalis-proxy/wrangler.toml` → `name = "xivdyetools-universalis-proxy"`

These names must **not change** during migration. Since `wrangler.toml` files are copied as-is, this should be safe, but verify after first deploy.

### 5. wrangler-action in CI with pnpm

The `cloudflare/wrangler-action` GitHub Action has had issues with pnpm workspaces ([Issue #181](https://github.com/cloudflare/wrangler-action/issues/181)). The fix (merged) detects `pnpm-workspace.yml` and appends `-w` when installing wrangler.

**Mitigation**: Use a recent version of `cloudflare/wrangler-action@v3` which includes this fix, or install wrangler explicitly via pnpm before running the action:

```yaml
- run: pnpm install --frozen-lockfile
- uses: cloudflare/wrangler-action@v3
  with:
    apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    workingDirectory: apps/discord-worker
    command: deploy
    # Skip wrangler-action's install — we already have it
    wranglerVersion: ''
```

### 6. Workers Build Cache in Monorepos

Cloudflare's Workers Build Cache may not work optimally with pnpm monorepos ([Community thread](https://community.cloudflare.com/t/workers-build-cache-not-working-as-expected-in-monorepos-pnpm/803213)). Since we deploy via GitHub Actions (not Cloudflare's built-in CI), this is not directly relevant, but worth noting if Cloudflare's build system is ever used.

## Testing Checklist

Before declaring the migration complete, verify each of these:

- [ ] `pnpm install` at root resolves all dependencies
- [ ] `pnpm turbo run build` builds all packages in correct order
- [ ] `wrangler dev` works from each worker's directory:
  - [ ] `apps/discord-worker/` — test SVG rendering with CJK fonts
  - [ ] `apps/moderation-worker/`
  - [ ] `apps/presets-api/` — test D1 queries
  - [ ] `apps/oauth/` — test OAuth flow
  - [ ] `apps/universalis-proxy/` — test proxied requests
  - [ ] `apps/og-worker/` — test OG image generation
- [ ] WASM modules load correctly in discord-worker and og-worker
- [ ] Font files (`.ttf`) load correctly for CJK rendering
- [ ] Service bindings work between workers (test locally with `wrangler dev --remote`)
- [ ] `wrangler deploy` succeeds from each worker's directory
- [ ] `pnpm publish --dry-run` from `packages/core/` replaces `workspace:*` with real versions
- [ ] `pnpm turbo run test` passes for all packages

## Recommendation

Start with **default pnpm settings** (strict symlinked `node_modules`). Run through the testing checklist above. Only fall back to `node-linker=hoisted` if specific resolution failures occur.

The Cloudflare team has actively improved Wrangler's compatibility with non-npm package managers, and the community has many successful Turborepo + pnpm + Wrangler monorepo setups. The most likely pain points are WASM module resolution and binary file handling, both of which have known workarounds.

## Sources

- [Cloudflare Workers Monorepo Advanced Setups](https://developers.cloudflare.com/workers/ci-cd/builds/advanced-setups/)
- [Cloudflare Pages Monorepo Docs](https://developers.cloudflare.com/pages/configuration/monorepos/)
- [wrangler-action pnpm fix](https://github.com/cloudflare/wrangler-action/issues/181)
- [Workers Build Cache + pnpm discussion](https://community.cloudflare.com/t/workers-build-cache-not-working-as-expected-in-monorepos-pnpm/803213)
- [Turborepo + Cloudflare Workers gist](https://gist.github.com/danawoodman/0413b09a3f97db0b8eec6e6d707ef5b7)
- [HackerNoon: Monorepo with Vite, Cloudflare, pnpm, Turborepo](https://hackernoon.com/how-to-create-a-monorepo-with-vite-cloudflare-remix-pnpm-and-turborepo-no-build-step)
