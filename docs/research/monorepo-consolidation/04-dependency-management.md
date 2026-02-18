# 04 — Dependency Management Strategy

## workspace:* Conversion Table

Every `@xivdyetools/*` dependency across all projects converts from a pinned npm version to `workspace:*`.

When `pnpm publish` is run on a library, `workspace:*` is automatically replaced with the real version (e.g., `^1.7.0`). This eliminates version drift entirely.

### Library → Library Dependencies

| Consumer | Dependency | Current Version | Monorepo |
|----------|-----------|----------------|----------|
| `@xivdyetools/auth` | `@xivdyetools/crypto` | `^1.0.0` | `workspace:*` |
| `@xivdyetools/core` | `@xivdyetools/types` | `^1.7.0` | `workspace:*` |
| `@xivdyetools/core` | `@xivdyetools/logger` | `^1.1.0` | `workspace:*` |
| `@xivdyetools/test-utils` | `@xivdyetools/types` | `^1.1.1` | `workspace:*` |
| `@xivdyetools/test-utils` | `@xivdyetools/crypto` | `^1.0.0` | `workspace:*` |

### App → Library Dependencies

| App | Dependency | Current Version | Monorepo |
|-----|-----------|----------------|----------|
| discord-worker | `@xivdyetools/auth` | `^1.0.2` | `workspace:*` |
| discord-worker | `@xivdyetools/core` | `^1.16.0` | `workspace:*` |
| discord-worker | `@xivdyetools/logger` | `^1.1.2` | `workspace:*` |
| discord-worker | `@xivdyetools/rate-limiter` | `^1.3.0` | `workspace:*` |
| discord-worker | `@xivdyetools/types` | `^1.1.1` | `workspace:*` |
| discord-worker (dev) | `@xivdyetools/test-utils` | `^1.0.3` | `workspace:*` |
| moderation-worker | `@xivdyetools/auth` | `^1.0.2` | `workspace:*` |
| moderation-worker | `@xivdyetools/logger` | `^1.1.2` | `workspace:*` |
| moderation-worker | `@xivdyetools/rate-limiter` | `^1.3.0` | `workspace:*` |
| moderation-worker | `@xivdyetools/types` | `^1.1.1` | `workspace:*` |
| moderation-worker (dev) | `@xivdyetools/test-utils` | `^1.0.3` | `workspace:*` |
| presets-api | `@xivdyetools/auth` | `^1.0.0` | `workspace:*` |
| presets-api | `@xivdyetools/crypto` | `^1.0.0` | `workspace:*` |
| presets-api | `@xivdyetools/logger` | `^1.0.2` | `workspace:*` |
| presets-api | `@xivdyetools/rate-limiter` | `^1.0.0` | `workspace:*` |
| presets-api | `@xivdyetools/types` | `^1.1.1` | `workspace:*` |
| presets-api (dev) | `@xivdyetools/test-utils` | `^1.0.3` | `workspace:*` |
| oauth | `@xivdyetools/crypto` | `^1.0.0` | `workspace:*` |
| oauth | `@xivdyetools/logger` | `^1.1.2` | `workspace:*` |
| oauth | `@xivdyetools/rate-limiter` | `^1.3.0` | `workspace:*` |
| oauth | `@xivdyetools/types` | `^1.1.1` | `workspace:*` |
| oauth (dev) | `@xivdyetools/test-utils` | `^1.0.3` | `workspace:*` |
| universalis-proxy | `@xivdyetools/rate-limiter` | `^1.3.0` | `workspace:*` |
| og-worker | `@xivdyetools/core` | `^1.15.1` | `workspace:*` |
| og-worker | `@xivdyetools/types` | `^1.7.0` | `workspace:*` |
| web-app | `@xivdyetools/core` | `^1.14.0` | `workspace:*` |
| web-app | `@xivdyetools/logger` | `^1.1.0` | `workspace:*` |
| web-app | `@xivdyetools/types` | `^1.7.0` | `workspace:*` |
| web-app (dev) | `@xivdyetools/test-utils` | `^1.1.0` | `workspace:*` |
| maintainer | `@xivdyetools/core` | `file:../xivdyetools-core` | `workspace:*` |

**Total: 33 dependency references** converting to `workspace:*`.

## npm Publishing

### Packages That Publish to npm

All 7 libraries under `packages/`:

| Package | Publish? | Reason |
|---------|----------|--------|
| `@xivdyetools/types` | Yes | External type consumers |
| `@xivdyetools/crypto` | Yes | Used by auth, test-utils |
| `@xivdyetools/logger` | Yes | Multi-runtime logging |
| `@xivdyetools/auth` | Yes | JWT/HMAC verification |
| `@xivdyetools/rate-limiter` | Yes | Rate limiting backends |
| `@xivdyetools/core` | Yes | Color algorithms, dye database |
| `@xivdyetools/test-utils` | Yes | Cloudflare mocks |

### Packages That Do NOT Publish

All 8 apps under `apps/` are deployed directly (Wrangler, Vite build) and never published to npm:

| Package | Deploy Method |
|---------|--------------|
| web-app | Cloudflare Pages (Vite build) |
| discord-worker | `wrangler deploy` |
| moderation-worker | `wrangler deploy` |
| presets-api | `wrangler deploy` |
| oauth | `wrangler deploy` |
| universalis-proxy | `wrangler deploy` |
| og-worker | `wrangler deploy` |
| maintainer | Local only (`private: true`) |

These should all have `"private": true` in their `package.json`.

## Third-Party Version Normalization

### Vitest Split: 3.x and 4.x Must Coexist

`@cloudflare/vitest-pool-workers` does **NOT** support Vitest 4.x yet (only 2.0.x – 3.2.x). There is an [active PR (cloudflare/workers-sdk#11632)](https://github.com/cloudflare/workers-sdk/issues/11064) working on Vitest 4 support, but it has not shipped as of February 2026.

**Projects that MUST stay on Vitest 3.x:**
- `presets-api` — uses `@cloudflare/vitest-pool-workers` for miniflare-based testing
- `oauth` — uses `@cloudflare/vitest-pool-workers` for miniflare-based testing

**Projects that can use Vitest 4.x:**
- All 7 libraries (standard Vitest, no Cloudflare pool)
- `discord-worker`, `moderation-worker`, `universalis-proxy`, `og-worker` (standard Vitest)
- `web-app` (standard Vitest with jsdom)
- `maintainer` (standard Vitest)

pnpm handles this naturally — each package declares its own `vitest` version in its `package.json`, and pnpm resolves them independently. **Do NOT use `pnpm.overrides` for vitest** since it would force a single version globally.

### Other Dependencies to Normalize

| Dependency | Current Range | Target | Notes |
|-----------|--------------|--------|-------|
| `vitest` (non-CF-pool projects) | 4.0.13 – 4.0.18 | `^4.0.15` | Align within 4.x |
| `vitest` (CF-pool projects) | 3.2.4 | `^3.2.4` | **Keep on 3.x** until CF ships v4 adapter |
| `wrangler` | 4.59.1 – 4.63.0 | Latest 4.x | Minor version differences, easy upgrade |
| `typescript` | 5.7.2 – 5.9.3 | `^5.9.3` | universalis-proxy and auth need upgrading |
| `hono` | 4.11.7 – 4.11.9 | Latest 4.x | Trivial upgrade |
| `@cloudflare/workers-types` | Various 4.x | Latest | Pin to same date suffix |

### Enforcing Consistent Versions (Selective)

Use pnpm `overrides` in root `package.json` for deps that CAN be unified:

```json
{
  "pnpm": {
    "overrides": {
      "typescript": "^5.9.3"
    }
  }
}
```

**Do NOT override `vitest`** — presets-api and oauth need 3.x while everything else uses 4.x. Once `@cloudflare/vitest-pool-workers` supports Vitest 4, this can be revisited.

## Maintainer's `file:` Dependency

**Current state:** `maintainer/package.json` has:
```json
"@xivdyetools/core": "file:../xivdyetools-core"
```

**Monorepo state:** This naturally becomes:
```json
"@xivdyetools/core": "workspace:*"
```

This is a clean improvement — `workspace:*` is the proper pnpm mechanism for what `file:` was hacking around.
