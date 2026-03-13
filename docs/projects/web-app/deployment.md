# Web App Deployment

> XIV Dye Tools web app v4.3.1

## Platform

The web app is deployed to **Cloudflare Pages** (not Workers). It is installable as a PWA (Progressive Web App).

## Build

```bash
# From monorepo root
pnpm --filter xivdyetools-web-app run build
```

- **Build tool:** Vite 6
- **Output directory:** `dist/`
- **Bundle size:** ~8 MiB (gzip: ~2.4 MiB) — well within Cloudflare Pages limits

### Largest dependencies

| Dependency | Size |
|---|---|
| resvg-wasm | ~2.4 MiB |
| photon-wasm | ~1.6 MiB |
| skin/hair color JSONs | ~1 MiB each |

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
| **Production** | Cloudflare Pages with custom domain |
| **Preview** | Automatic preview deployments on PRs |
| **Development** | `pnpm --filter xivdyetools-web-app run dev` (localhost:5173) |

## CI/CD

Deployment is handled by a **path-filtered GitHub Actions workflow**.

- Triggers on push to `main` when `apps/web-app/**` changes
- Also triggers when shared packages change (`core`, `types`, etc.)
- Manual dispatch is available via `workflow_dispatch`

## CORS Configuration

The web app connects to several backend workers. All of them whitelist the web app's origin.

| Worker | Purpose |
|---|---|
| OAuth worker | Authentication |
| Presets API | Community presets |
| Universalis proxy | Market prices |
| OG worker | Social preview images |

## Related Documentation

- [Overview](overview.md)
- [Tools](tools.md)
- [Components](components.md)
