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
VITE_OAUTH_WORKER_URL=http://localhost:8788        # oauth worker (default: https://auth.xivdyetools.app)
VITE_PRESETS_API_URL=http://localhost:8787         # presets-api (default: https://api.xivdyetools.app)
VITE_UNIVERSALIS_PROXY_URL=http://localhost:8790   # optional; production uses https://data.xivdyetools.app/universalis
```

`VITE_APP_ENV=beta` at build time produces the beta build (`beta.xivdyetools.app` branding, `noindex`); `scripts/check-beta-build.js` asserts it.

### Production Values (compiled-in defaults)

```bash
VITE_OAUTH_WORKER_URL=https://auth.xivdyetools.app
VITE_PRESETS_API_URL=https://api.xivdyetools.app
# Universalis: https://data.xivdyetools.app/universalis (api-worker's absorbed proxy routes)
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
| `MODERATION_CHANNEL_ID` | No | Channel for pending presets / preview images |
| `SUBMISSION_LOG_CHANNEL_ID` | No | Channel for all submissions |
| `MODERATION_BOT_TOKEN` | No | Moderation bot token — Discord routes button clicks to the posting application |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | No | Preferred rate-limit backend (KV fallback) |
| `ANNOUNCEMENT_CHANNEL_ID` | No | Release-announcement channel — a **var**, declared under `[env.production.vars]` (vars are not inherited) |

Bindings: `KV`, `DB` (D1 `xivdyetools-presets`), `ANALYTICS`, and service bindings `PRESETS_API` → `xivdyetools-presets-api`, `UNIVERSALIS_PROXY` → `xivdyetools-api-worker`, `IMAGE_WORKER` → `xivdyetools-image-worker`. The top-level `wrangler.toml` block is the beta bot (`xivdyetools-discord-worker-dev`); production lives under `[env.production]`.

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
FRONTEND_URL = "https://xivdyetools.app"
WORKER_URL = "https://auth.xivdyetools.app"
JWT_EXPIRY = "3600"               # Seconds (default: 1 hour)
```

The redirect / CORS allowlist also carries `https://beta.xivdyetools.app` (2.6.0). Note `oauth`'s top-level block **is** production (bare `wrangler deploy` = production); `[env.development]` / `[env.preview]` are the non-production envs.

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
[env.production]
vars = { ENVIRONMENT = "production", API_VERSION = "v1", CORS_ORIGIN = "https://xivdyetools.app", ADDITIONAL_CORS_ORIGINS = "https://xiv-colorexplorer.pages.dev,https://xivdyetools.projectgalatine.com,https://beta.xivdyetools.app", JWT_ISSUER = "https://auth.xivdyetools.app" }
```

Bindings: `DB` (D1), `DISCORD_WORKER` (service → `xivdyetools-discord-worker`, notifications), `IMAGE_WORKER` (service → `xivdyetools-image-worker`, `POST /thumbnail`), `THUMBNAILS` (R2 bucket `xivdyetools-presets-preview-thumbnails`, served at `shots.xivdyetools.app`), `TOKEN_BLACKLIST` (KV — the oauth worker's jti blacklist, shared so revoked tokens are rejected here too; FINDING-002). `JWT_ISSUER` pins the accepted `iss` claim (FINDING-015). Top-level block = `xivdyetools-presets-api-dev`; production under `[env.production]`.

### Secrets

| Secret | Required | Description |
|--------|----------|-------------|
| `BOT_API_SECRET` | ✅ Yes | Shared with Discord worker |
| `JWT_SECRET` | ✅ Yes | Shared with OAuth worker |
| `MODERATOR_IDS` | No | Comma-separated user IDs |
| `BOT_SIGNING_SECRET` | No | HMAC signing key for bot request verification |
| `PERSPECTIVE_API_KEY` | No | Google Perspective API for ML moderation |
| `MODERATION_WEBHOOK_URL` / `DISCORD_BOT_WEBHOOK_URL` / `INTERNAL_WEBHOOK_SECRET` | No | Notification webhooks |

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

## Universalis proxy vars (now part of xivdyetools-api-worker)

> The standalone `xivdyetools-universalis-proxy` worker was **merged into `api-worker` on
> 2026-07-31**; its behaviour lives on behind the `/universalis` and `/api/v2` compatibility
> routes. The variables and KV bindings below now belong to `apps/api-worker/wrangler.toml`.
> Where the commands below say `cd xivdyetools-universalis-proxy`, use
> `apps/api-worker` instead.

### wrangler.toml Variables

```toml
[vars]
ENVIRONMENT = "production"        # "development" | "production"
PRICE_TTL = "300"                 # Price cache TTL in seconds (default: 5 min)
STATIC_TTL = "86400"              # Static cache TTL in seconds (default: 24h)
MAX_ITEMS = "100"                 # Max items per request
MAX_RESPONSE_SIZE = "5242880"     # Max response size in bytes (5MB)
```

### `/v1/chara/*` variables (api-worker, 0.7.0)

The `.chara` equipment-resolution routes (web-app Swatch Matcher 11a/11c) talk to XIVAPI v2 server-side — no secrets, plain vars in both `wrangler.toml` envs:

```toml
XIVAPI_BASE = "https://v2.xivapi.com"   # upstream origin
XIVAPI_VERSION = "latest"               # game-version key: `latest` or a key from /api/version.
                                        # ALSO the row-cache namespace. After a patch, search
                                        # returns 503 on the new key until ingested — keep the
                                        # old key until a probe answers 200, then roll forward.
# XIVAPI_SCHEMA = "exdschema@2:rev:<sha>"  # optional schema pin (field renames land unannounced)
```

No new bindings: the per-key row cache is the Cache API (store `chara-resolve`), not KV. Korean/Chinese item names are build-time JSON (`apps/api-worker/scripts/build-item-names.mjs`), not a runtime fetch.

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
cd apps/api-worker

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
FRONTEND_URL=https://xivdyetools.app
WORKER_URL=https://auth.xivdyetools.app
CORS_ORIGIN=https://xivdyetools.app
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
