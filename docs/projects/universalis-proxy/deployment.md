# Deployment Guide

**Setting up and deploying the Universalis Proxy**

---

## Prerequisites

- Node.js 18+
- Cloudflare account with Workers subscription
- Wrangler CLI (`npm install -g wrangler`)
- Authenticated with Cloudflare (`wrangler login`)

---

## Initial Setup

### 1. Clone and Install

```bash
cd xivdyetools-universalis-proxy
npm install
```

### 2. Create KV Namespaces

Create two KV namespaces for caching:

```bash
# Price data cache (short TTL)
wrangler kv:namespace create "PRICE_CACHE"

# Static data cache (long TTL)
wrangler kv:namespace create "STATIC_CACHE"
```

Note the namespace IDs from the output.

### 3. Configure wrangler.toml

Update `wrangler.toml` with your namespace IDs:

```toml
name = "xivdyetools-universalis-proxy"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[kv_namespaces]]
binding = "PRICE_CACHE"
id = "<your-price-cache-id>"
preview_id = "<your-price-cache-preview-id>"

[[kv_namespaces]]
binding = "STATIC_CACHE"
id = "<your-static-cache-id>"
preview_id = "<your-static-cache-preview-id>"
```

---

## Local Development

### Start Dev Server

```bash
npm run dev
```

The proxy runs on `http://localhost:8787` by default.

### Test Endpoints

```bash
# Health check
curl http://localhost:8787/health

# Market data (example)
curl http://localhost:8787/api/Gilgamesh/5111,5112
```

---

## Deployment

### Deploy to Staging

```bash
npm run deploy
```

This deploys to a staging subdomain for testing.

### Deploy to Production

```bash
npm run deploy:production
```

**Pre-deployment checklist**:
- [ ] All tests passing (`npm test`)
- [ ] Type check passes (`npm run type-check`)
- [ ] KV namespaces configured
- [ ] Tested in staging environment

---

## Environment Configuration

### Required KV Bindings

| Binding | Purpose | TTL Strategy |
|---------|---------|--------------|
| `PRICE_CACHE` | Market price data | 5 min fresh, 1 min stale |
| `STATIC_CACHE` | Item metadata | 24h fresh, 1h stale |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_ITEMS` | 100 | Maximum items per request |
| `MAX_RESPONSE_SIZE` | 5242880 | Max response size (5MB) |
| `PRICE_TTL` | 300 | Price cache TTL in seconds |
| `STATIC_TTL` | 86400 | Static cache TTL in seconds |

Set variables via Wrangler:

```bash
wrangler vars set MAX_ITEMS 100
```

---

## Custom Domain

### 1. Add Route in wrangler.toml

```toml
routes = [
  { pattern = "universalis-proxy.xivdyetools.com/*", zone_name = "xivdyetools.com" }
]
```

### 2. Configure DNS

Add a CNAME record in Cloudflare DNS:

```
Type: CNAME
Name: universalis-proxy
Target: <your-worker>.workers.dev
Proxy: Yes (orange cloud)
```

---

## Monitoring

### View Logs

```bash
wrangler tail
```

Real-time logs show:
- Request paths
- Cache hits/misses
- Error messages
- Performance timing

### Analytics

View Worker Analytics in Cloudflare Dashboard:
- Request volume
- Error rates
- CPU time
- Response latency

---

## Troubleshooting

### Cache Not Working

**Symptoms**: Every request shows `X-Cache-Status: MISS`

**Checks**:
1. Verify KV namespaces are configured in `wrangler.toml`
2. Check KV binding names match code
3. Verify Cache API is enabled (Workers > Settings)

### Upstream Timeouts

**Symptoms**: 504 Gateway Timeout errors

**Checks**:
1. Verify Universalis API is up (check status page)
2. Check if specific servers are overloaded
3. Increase timeout if needed

### Memory Issues

**Symptoms**: Worker crashes or slow responses

**Checks**:
1. Check response size limits (5MB max)
2. Monitor in-flight request count
3. Verify cleanup routine is running

---

## Rollback

If a deployment causes issues:

```bash
# List recent deployments
wrangler deployments list

# Rollback to previous version
wrangler rollback
```

---

## Related Documentation

- [Overview](overview.md) - Proxy architecture
- [Caching Strategy](caching.md) - Cache layer details
- [Environment Variables](../../developer-guides/environment-variables.md) - All project env vars
