# Web App Deployment

> XIV Dye Tools web app v5.0.0

## Platform

The web app is deployed to **Cloudflare Pages** (not Workers). It is installable as a PWA (Progressive Web App).

## Build

```bash
# From monorepo root
pnpm --filter xivdyetools-web-app run build
```

- **Build tool:** Vite 8
- **Output directory:** `dist/`
- **Beta build:** `VITE_APP_ENV=beta pnpm --filter xivdyetools-web-app run build` (beta branding + `noindex`; `node scripts/check-beta-build.js` asserts it)
- The web app bundles no WASM — resvg / Photon live in the Workers. `pnpm run check-bundle-size` validates `dist/` against the limits in `scripts/`.

### Code splitting

- Tool components are lazy-loaded via dynamic imports
- Each tool gets its own chunk
- Vendor chunks: `vendor-lit`, `vendor-core`, `vendor-spectral`

### Bundle size monitoring

```bash
pnpm --filter xivdyetools-web-app run check-bundle-size
```

## Environments

| Environment | Details |
|---|---|
| **Production** | Cloudflare Pages project `xivdyetools` → `xivdyetools.app` (`deploy-web-app.yml`, on push to `main`) |
| **Beta** | Second Pages project `xivdyetools-beta` → `beta.xivdyetools.app` (`deploy-web-app-beta.yml`, non-`main` pushes; `--branch=beta` is load-bearing and fails silently without it; beta talks to **production** presets data — oauth + presets-api CORS allowlists carry the beta origin) |
| **Development** | `pnpm --filter xivdyetools-web-app run dev` (localhost:5173) |

## CI/CD

Deployment is handled by a **path-filtered GitHub Actions workflow**.

- Triggers on push to `main` when `apps/web-app/**` changes
- Also triggers when shared packages change (`core`, `types`, etc.)
- Manual dispatch is available via `workflow_dispatch`
- Both workflows run the shared Pages smoke test (`apps/web-app/scripts/smoke-test-pages.js`) against the deployment just made — the production job asserts it is **not** a beta build (`--expect-robots none`), the beta job asserts the `noindex` header end-to-end. Beware overlapping `_headers` patterns merge, and an SPA catch-all plus `immutable` on `/assets/*` can cache an HTML fallback under a `.js` URL (see `docs/operations/`).

## CORS Configuration

The web app connects to several backend workers. All of them whitelist the web app's origin.

| Worker | Purpose |
|---|---|
| OAuth worker (`auth.xivdyetools.app`) | Authentication |
| Presets API (`api.xivdyetools.app`) | Community presets |
| api-worker `/universalis` (`data.xivdyetools.app`, absorbed the universalis-proxy; `cors({ origin: '*' })`) | Market prices |
| OG worker (`og.xivdyetools.app`, routes on `xivdyetools.app/<tool>/*`) | Social preview images |

## Related Documentation

- [Overview](overview.md)
- [Tools](tools.md)
- [Components](components.md)
