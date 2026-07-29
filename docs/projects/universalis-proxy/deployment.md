# Deployment Guide

**Environments and deploy procedure for the Universalis Proxy**

---

## Prerequisites

- Node.js 22+
- pnpm 10+ (the repo pins the exact version via `packageManager`)
- Wrangler CLI (ships as a devDependency — no global install needed)
- Authenticated with Cloudflare (`npx wrangler login`)

There is **no storage to provision**: the worker has no KV, D1, or R2 bindings, and no secrets. Caching uses the Cloudflare Cache API, which needs no setup.

---

## Environments (`wrangler.toml`)

The config deliberately splits dev and production into **two separate workers** (BUG-008, 2026-07-18 audit):

| | Default (top-level) env | `[env.production]` |
|---|---|---|
| Worker name | `xivdyetools-universalis-proxy-dev` | `xivdyetools-universalis-proxy` |
| Routes | **none** | `proxy.xivdyetools.app`, `proxy.xivdyetools.projectgalatine.com` (custom domains) |
| `ENVIRONMENT` | `development` | `production` |
| `ALLOWED_ORIGINS` | localhost origins (5173, 3000) | `https://xivdyetools.app`, `https://xivdyetools.projectgalatine.com` |
| `RATE_LIMIT_REQUESTS` | 60/min | 30/min |

Because the default env is a differently-named worker with no routes, a plain `wrangler deploy` **cannot** overwrite the production worker or its custom domains with dev vars. Production is reachable only via `--env production`.

Other notable config: `compatibility_date = "2024-12-01"`; `nodejs_compat` is deliberately absent (ARCH-001 — the worker uses no Node.js APIs).

---

## Local Development

```bash
# From the monorepo root
pnpm --filter xivdyetools-universalis-proxy run dev
```

The proxy runs on `http://localhost:8787`.

```bash
# Health check
curl http://localhost:8787/health

# Market data
curl "http://localhost:8787/api/v2/aggregated/Crystal/5808"
```

> **Expect `X-Cache: MISS` on every local request** — the Cache API is unavailable under `wrangler dev`, so local runs always hit upstream. This is normal.

---

## Deployment

Deploys happen two ways:

1. **CI (normal path)** — `.github/workflows/deploy-universalis-proxy.yml` is path-filtered: pushes to `main` touching this worker deploy it automatically (plus manual `workflow_dispatch`).
2. **Manual**:

```bash
pnpm --filter xivdyetools-universalis-proxy run deploy              # dev worker (no routes)
pnpm --filter xivdyetools-universalis-proxy run deploy:production   # production worker
```

**Pre-deployment checklist**:

- [ ] `pnpm --filter xivdyetools-universalis-proxy run lint`
- [ ] `pnpm --filter xivdyetools-universalis-proxy run test`
- [ ] `pnpm --filter xivdyetools-universalis-proxy run type-check`
- [ ] If a new caller host was added: update `ALLOWED_ORIGINS` under `[env.production.vars]`

**Post-deploy smoke test**:

```bash
curl -H "Origin: https://xivdyetools.app" \
  "https://proxy.xivdyetools.app/api/v2/aggregated/Crystal/5808"
# Expect: 200, Access-Control-Allow-Origin, X-Cache header
```

Then confirm `@xivdyetools/core`'s Universalis constants and the web-app env still point at the proxy URL.

---

## Custom Domains

Both production hostnames are declared directly in `wrangler.toml` as `custom_domain = true` routes:

```toml
[env.production]
routes = [
  { pattern = "proxy.xivdyetools.app", custom_domain = true },
  { pattern = "proxy.xivdyetools.projectgalatine.com", custom_domain = true }
]
```

Cloudflare manages the DNS records for custom domains automatically — no manual CNAME setup is required.

---

## Monitoring

### View Logs

```bash
npx wrangler tail --env production
```

Structured JSON logs include per-request `requestId` entries (via `@xivdyetools/worker-middleware`) and `cache_result` hit/miss events (OPT-002).

### Analytics

Worker analytics in the Cloudflare dashboard: request volume, error rates, CPU time, latency.

---

## Troubleshooting

### Every request is a MISS

- **Local dev**: expected — the Cache API doesn't exist under `wrangler dev`.
- **Production**: remember the Cache API is *regional*; a request served by a different edge location than the one that cached the entry is a legitimate `MISS`. Check `X-Cache` across repeated requests from the same region before concluding caching is broken.

### 429 responses

Per-IP rate limit (30/min in production). The limiter is per-isolate and best-effort — clients should honor `Retry-After`. Raise `RATE_LIMIT_REQUESTS` in `[env.production.vars]` if legitimate traffic is being throttled.

### 502 "Response too large"

Upstream response exceeded the 5 MB streamed byte budget (BUG-065). Usually means a query for far too many items — the 100-item cap should prevent this; if it recurs, inspect the upstream payload.

### Upstream errors / CORS on errors

Universalis 429s and 5xx are proxied with their status (429 preserves `Retry-After`) — and unlike upstream, **every** proxy response carries CORS headers, so browser callers can always read the error.

---

## Rollback

```bash
# List recent deployments
npx wrangler deployments list --env production

# Roll back to the previous version
npx wrangler rollback --env production
```

Worker rollback is instant and config-free — there is no storage schema or binding state to migrate.

---

## Related Documentation

- [Overview](overview.md) - Proxy architecture
- [Caching Strategy](caching.md) - Cache layer details
- [Environment Variables](../../developer-guides/environment-variables.md) - All project env vars
