# Environment Variables

**Single source of truth for all XIV Dye Tools environment configuration**

---

## Overview

Environment variables are configured differently based on the project type:

| Project Type | Configuration Method |
|--------------|---------------------|
| Web App | `.env` files, `import.meta.env` |
| Cloudflare Workers | `wrangler.toml` (vars) + `wrangler secret put` (secrets) |
| Core Library | None (environment-agnostic) |
| Universalis Proxy | `wrangler.toml` (vars) + KV bindings |

---

## xivdyetools-web-app

### Build-time Variables (.env)

```bash
# .env.local (create this file, not committed)
VITE_OAUTH_URL=http://localhost:8788
VITE_PRESETS_API_URL=http://localhost:8787
VITE_ANALYTICS_ID=optional-analytics-id
```

### Production Values

```bash
VITE_OAUTH_URL=https://oauth.xivdyetools.com
VITE_PRESETS_API_URL=https://presets.xivdyetools.com
```

---

## xivdyetools-discord-worker

### wrangler.toml Variables

```toml
[vars]
ENVIRONMENT = "production"    # "development" | "production"
```

### Secrets (set via `wrangler secret put`)

| Secret | Required | Description |
|--------|----------|-------------|
| `DISCORD_TOKEN` | ✅ Yes | Bot token for API calls |
| `DISCORD_PUBLIC_KEY` | ✅ Yes | Ed25519 public key for verification |
| `BOT_API_SECRET` | No | Shared secret for presets API |
| `INTERNAL_WEBHOOK_SECRET` | No | Webhook authentication |
| `STATS_AUTHORIZED_USERS` | No | Comma-separated user IDs |
| `MODERATOR_IDS` | No | Comma-separated moderator user IDs |
| `MODERATION_CHANNEL_ID` | No | Channel for pending presets |
| `SUBMISSION_LOG_CHANNEL_ID` | No | Channel for all submissions |

### Setting Secrets

```bash
cd xivdyetools-discord-worker

# Required
wrangler secret put DISCORD_TOKEN
wrangler secret put DISCORD_PUBLIC_KEY

# Optional
wrangler secret put BOT_API_SECRET
wrangler secret put MODERATOR_IDS
```

### Local Development (.dev.vars)

```bash
# .dev.vars (not committed)
DISCORD_TOKEN=your-bot-token
DISCORD_PUBLIC_KEY=your-public-key
BOT_API_SECRET=local-secret
```

---

## xivdyetools-oauth

### wrangler.toml Variables

```toml
[vars]
ENVIRONMENT = "production"        # "development" | "production"
DISCORD_CLIENT_ID = "your-client-id"
FRONTEND_URL = "https://app.xivdyetools.com"
WORKER_URL = "https://oauth.xivdyetools.com"
JWT_EXPIRY = "3600"               # Seconds (default: 1 hour)
```

### Secrets

| Secret | Required | Description |
|--------|----------|-------------|
| `DISCORD_CLIENT_SECRET` | ✅ Yes | Discord OAuth client secret |
| `JWT_SECRET` | ✅ Yes | HMAC key for JWT signing (min 32 bytes) |

### Setting Secrets

```bash
cd xivdyetools-oauth

wrangler secret put DISCORD_CLIENT_SECRET
wrangler secret put JWT_SECRET
```

### Generating JWT Secret

```bash
# Generate secure random key
openssl rand -hex 32
```

### Local Development (.dev.vars)

```bash
DISCORD_CLIENT_SECRET=your-client-secret
JWT_SECRET=development-jwt-secret-min-32-chars
```

---

## xivdyetools-presets-api

### wrangler.toml Variables

```toml
[vars]
ENVIRONMENT = "production"        # "development" | "production"
API_VERSION = "v1"
CORS_ORIGIN = "https://app.xivdyetools.com"
```

### Secrets

| Secret | Required | Description |
|--------|----------|-------------|
| `BOT_API_SECRET` | ✅ Yes | Shared with Discord worker |
| `JWT_SECRET` | ✅ Yes | Shared with OAuth worker |
| `MODERATOR_IDS` | No | Comma-separated user IDs |
| `PERSPECTIVE_API_KEY` | No | Google Perspective API for ML moderation |

### Setting Secrets

```bash
cd xivdyetools-presets-api

wrangler secret put BOT_API_SECRET
wrangler secret put JWT_SECRET
wrangler secret put MODERATOR_IDS
wrangler secret put PERSPECTIVE_API_KEY  # Optional
```

### Local Development (.dev.vars)

```bash
BOT_API_SECRET=local-api-secret
JWT_SECRET=development-jwt-secret-min-32-chars
MODERATOR_IDS=123456789,987654321
```

---

## xivdyetools-universalis-proxy

### wrangler.toml Variables

```toml
[vars]
ENVIRONMENT = "production"        # "development" | "production"
PRICE_TTL = "300"                 # Price cache TTL in seconds (default: 5 min)
STATIC_TTL = "86400"              # Static cache TTL in seconds (default: 24h)
MAX_ITEMS = "100"                 # Max items per request
MAX_RESPONSE_SIZE = "5242880"     # Max response size in bytes (5MB)
```

### KV Bindings

The proxy requires two KV namespaces:

```toml
[[kv_namespaces]]
binding = "PRICE_CACHE"
id = "your-price-cache-namespace-id"

[[kv_namespaces]]
binding = "STATIC_CACHE"
id = "your-static-cache-namespace-id"
```

### Creating KV Namespaces

```bash
cd xivdyetools-universalis-proxy

# Create namespaces
wrangler kv:namespace create "PRICE_CACHE"
wrangler kv:namespace create "STATIC_CACHE"

# Note the IDs and update wrangler.toml
```

### Local Development

For local development, use:

```bash
# Create local namespaces
wrangler kv:namespace create "PRICE_CACHE" --preview
wrangler kv:namespace create "STATIC_CACHE" --preview
```

Update `wrangler.toml` with the preview IDs for local testing.

---

## Shared Secrets

These secrets must match across services:

| Secret | Services | Purpose |
|--------|----------|---------|
| `JWT_SECRET` | oauth, presets-api | JWT verification |
| `BOT_API_SECRET` | discord-worker, presets-api | Bot-to-API auth |
| `MODERATOR_IDS` | discord-worker, presets-api | Moderator access |

**Important:** Use the same value for these secrets in all services!

---

## Environment-Specific Configuration

### Development

```bash
# Typical local development setup
ENVIRONMENT=development
FRONTEND_URL=http://localhost:5173
WORKER_URL=http://localhost:8788
CORS_ORIGIN=http://localhost:5173
```

### Production

```bash
ENVIRONMENT=production
FRONTEND_URL=https://app.xivdyetools.com
WORKER_URL=https://oauth.xivdyetools.com
CORS_ORIGIN=https://app.xivdyetools.com
```

---

## Cloudflare Bindings

In addition to environment variables, Workers use Cloudflare bindings:

### KV Namespaces

```toml
[[kv_namespaces]]
binding = "KV"
id = "your-kv-namespace-id"
```

### D1 Databases

```toml
[[d1_databases]]
binding = "DB"
database_name = "xivdyetools-presets"
database_id = "your-database-id"
```

### Service Bindings

```toml
[[services]]
binding = "PRESETS_API"
service = "xivdyetools-presets-api"
environment = "production"
```

### Analytics Engine

```toml
[[analytics_engine_datasets]]
binding = "ANALYTICS"
dataset = "xivdyetools_analytics"
```

---

## Security Best Practices

1. **Never commit secrets** - Use `.dev.vars` (gitignored) for local dev
2. **Rotate secrets periodically** - Especially JWT_SECRET
3. **Use different secrets per environment** - Don't share dev/prod secrets
4. **Minimum JWT_SECRET length** - At least 32 characters (256 bits)
5. **Limit MODERATOR_IDS** - Only trusted users

---

## Related Documentation

- [Local Setup](local-setup.md) - Development environment
- [Deployment](deployment.md) - Deployment procedures
- [Troubleshooting](troubleshooting.md) - Common issues
