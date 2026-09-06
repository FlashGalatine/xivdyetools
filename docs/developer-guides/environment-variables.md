# Environment Variables

**Single source of truth for all XIV Dye Tools environment configuration**

---

## Overview

Environment variables are configured differently based on the project type:

| Project Type | Configuration Method |
|--------------|---------------------|
| Web App | `.env` files, `import.meta.env` |
| Cloudflare Workers | `wrangler.toml` (vars) + `wrangler secret put` (secrets) |
| stoat-worker (Node.js) | `process.env` / `.env` |
| Shared packages | None (environment-agnostic) |

---

## xivdyetools-web-app

### Build-time Variables (.env)

```bash
# .env.local (create this file, not committed)
VITE_OAUTH_WORKER_URL=http://localhost:8788        # oauth worker (default: https://auth.xivdyetools.app)
VITE_PRESETS_API_URL=http://localhost:8787         # presets-api (default: https://api.xivdyetools.app)
VITE_UNIVERSALIS_PROXY_URL=http://localhost:8790   # optional; production uses https://data.xivdyetools.app/universalis
VITE_API_WORKER_URL=http://localhost:8790          # api-worker origin for /v1/chara/* and POST /v1/telemetry
```

`VITE_API_WORKER_URL` is resolved by `src/services/api-worker-origin.ts`: the env value wins
(trailing slash stripped), otherwise `https://data.xivdyetools.app` in a production build and
`http://localhost:8790` in dev. Those four `VITE_*` names, plus Vite's own `DEV` / `PROD`, are
the **only** `import.meta.env` keys the app reads.

`VITE_APP_ENV=beta` at build time produces the beta build (`beta.xivdyetools.app` branding, `noindex`); `scripts/check-beta-build.js` asserts it.

### Production Values (compiled-in defaults)

```bash
VITE_OAUTH_WORKER_URL=https://auth.xivdyetools.app
VITE_PRESETS_API_URL=https://api.xivdyetools.app
VITE_API_WORKER_URL=https://data.xivdyetools.app
# Universalis: https://data.xivdyetools.app/universalis (api-worker's absorbed proxy routes)
```

---

## xivdyetools-discord-worker

### wrangler.toml Variables

All four are declared **explicitly in both blocks** — `vars` are not inheritable, so a named environment that omits one simply does not have it.

```toml
# top-level = the BETA bot; [env.production.vars] repeats all four
[vars]
ENVIRONMENT = "development"          # "development" (beta) | "production" (live bot)
DISCORD_CLIENT_ID = "..."            # the environment's own Discord application
PRESETS_API_URL = "https://api.xivdyetools.app"
ANNOUNCEMENT_CHANNEL_ID = "..."      # release-announcement channel (differs per environment)
```

`ENVIRONMENT` is read by exactly one thing: `validateEnv` (`src/utils/env-validation.ts`). When it reads `production` the six `RL_*` rate-limit bindings become **required**, and `src/index.ts` refuses every request with `500 {"error":"Service misconfigured"}` — `/health` included — while any of them is unbound, the same as for a missing `DISCORD_TOKEN` (FINDING-013, `docs/audits/2026-08-29-security`). Losing a tier is otherwise silent: worker-kit routes the orphaned commands to the next larger tier, and Workers Logs are off on this script. On the beta worker (`development`) they stay optional and the limiter falls back to KV.

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

(`ANNOUNCEMENT_CHANNEL_ID` is a **var**, not a secret — see the `[vars]` block above.)

Bindings: `KV`, `ANALYTICS`, the six `[[ratelimits]]` tiers `RL_5`/`RL_10`/`RL_15`/`RL_20`/`RL_30`/`RL_70` (**required in production** — see `ENVIRONMENT` above), and service bindings `PRESETS_API` → `xivdyetools-presets-api`, `UNIVERSALIS_PROXY` → `xivdyetools-api-worker`, `IMAGE_WORKER` → `xivdyetools-image-worker`. The top-level `wrangler.toml` block is the beta bot (`xivdyetools-discord-worker-dev`); production lives under `[env.production]`.

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

## xivdyetools-oauth-worker (`apps/oauth`)

### wrangler.toml Variables

```toml
[vars]
ENVIRONMENT = "production"        # "development" | "production"
DISCORD_CLIENT_ID = "your-client-id"
XIVAUTH_CLIENT_ID = "phx-..."     # XIVAuth application id (the second provider)
FRONTEND_URL = "https://xivdyetools.app"
WORKER_URL = "https://auth.xivdyetools.app"
JWT_EXPIRY = "3600"               # Seconds (default: 1 hour)
```

The redirect / CORS allowlist also carries `https://beta.xivdyetools.app`. Note `oauth`'s
top-level block **is** production (bare `wrangler deploy` = production); `[env.development]`
is the only non-production env — `[env.preview]` was deleted by FINDING-029 (2026-08-21
security audit), and `ENVIRONMENT` must read `development` or `production`, with anything
other than `development` getting the production gates.

Bindings: `DB` (D1 `xivdyetools-users`), `TOKEN_BLACKLIST` (KV — the revoked-jti list, shared
with presets-api), and the `RL_AUTH_10` / `RL_AUTH_20` / `RL_AUTH_30` rate-limit bindings.

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

Bindings: `DB` (D1), `DISCORD_WORKER` (service → `xivdyetools-discord-worker`, notifications), `IMAGE_WORKER` (service → `xivdyetools-image-worker`, `POST /thumbnail`), `THUMBNAILS` (R2 bucket `xivdyetools-presets-preview-thumbnails`, served at `shots.xivdyetools.app`), `TOKEN_BLACKLIST` (KV — the oauth worker's jti blacklist, shared so revoked tokens are rejected here too; FINDING-002). `JWT_ISSUER` pins the accepted `iss` claim (FINDING-015). `CACHE_PURGE_ZONE_ID` (production var, `ec1fb94c…` — the `xivdyetools.app` zone id behind `shots.xivdyetools.app`) is the purge target for FINDING-018; it is config, not a secret, and pairs with the `CACHE_PURGE_API_TOKEN` secret below. Top-level block = `xivdyetools-presets-api-dev`; production under `[env.production]`.

### Secrets

| Secret | Required | Description |
|--------|----------|-------------|
| `BOT_API_SECRET` | ✅ Yes | Shared with Discord worker |
| `JWT_SECRET` | ✅ Yes | Shared with OAuth worker |
| `MODERATOR_IDS` | No | Comma-separated user IDs |
| `BOT_SIGNING_SECRET` | No | HMAC signing key for bot request verification |
| `PERSPECTIVE_API_KEY` | No | Google Perspective API for ML moderation. **⚠️ Service shuts down 2026-12-31** — delete the secret before then; with it set and the API gone, every preset submission fails closed into the moderator queue (FINDING-005). See `DEPRECATIONS.md` |
| `CACHE_PURGE_API_TOKEN` | No | API token scoped to *Zone → Cache Purge* on the `xivdyetools.app` zone — enables single-file edge purge of deleted/replaced preview images (FINDING-018); pairs with the `CACHE_PURGE_ZONE_ID` **var** (see above). Without it the 1-day `s-maxage` is the bound. Set on production 2026-08-21 |
| `INTERNAL_WEBHOOK_SECRET` | No | Shared secret for the `DISCORD_WORKER` service-binding notification call |

### Setting Secrets

```bash
cd xivdyetools-presets-api

wrangler secret put BOT_API_SECRET
wrangler secret put JWT_SECRET
wrangler secret put MODERATOR_IDS
wrangler secret put PERSPECTIVE_API_KEY  # Optional
wrangler secret put CACHE_PURGE_API_TOKEN --env production  # Optional — preview-image edge purge (FINDING-018); CACHE_PURGE_ZONE_ID is a wrangler.toml var, not a secret
```

### Local Development (.dev.vars)

```bash
BOT_API_SECRET=local-api-secret
JWT_SECRET=development-jwt-secret-min-32-chars
MODERATOR_IDS=123456789,987654321
```

---

## xivdyetools-api-worker

> The standalone `xivdyetools-universalis-proxy` worker was **merged into `api-worker` on
> 2026-07-31**; its behaviour lives on behind the `/universalis` and `/api/v2` compatibility
> routes, and the `api-docs` VitePress site became this worker's static assets. Anywhere older
> notes say `cd xivdyetools-universalis-proxy` or `cd xivdyetools-api-docs`, use
> `apps/api-worker`.

### wrangler.toml Variables

```toml
[vars]
ENVIRONMENT = "production"                              # "development" | "production"
API_VERSION = "v1"
UNIVERSALIS_API_BASE = "https://universalis.app/api/v2" # upstream for the proxy routes
RATE_LIMIT_REQUESTS = "30"                              # per-IP memory limit, /universalis aggregated
RATE_LIMIT_WINDOW_SECONDS = "60"                        # (the dev block uses 60 requests)
XIVAPI_BASE = "https://v2.xivapi.com"
XIVAPI_VERSION = "latest"
```

**Cache TTLs are code constants, not vars.** The proxy's per-endpoint TTL and
stale-while-revalidate windows live in `apps/api-worker/src/universalis/config/cache.ts`
(`aggregated` 300 s / 120 s SWR; `data-centers` and `worlds` 86 400 s / 21 600 s SWR). There is
no `PRICE_TTL`, `STATIC_TTL`, `MAX_ITEMS` or `MAX_RESPONSE_SIZE` variable.

### `/v1/chara/*` variables

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

### Bindings

`api-worker` binds **one** KV namespace, `RATE_LIMIT`, and it is only the fallback for the
`/v1/*` rate limiter (see the rate-limit table below). The absorbed Universalis proxy caches
in the **Cache API** — the second, KV-backed cache layer it once had was removed to stay clear
of the free tier's KV write limits — so there is nothing to create with
`wrangler kv namespace create` beyond `RATE_LIMIT`, which already exists in both environments.

| Binding | Kind | Notes |
|---------|------|-------|
| `RATE_LIMIT` | KV | Fallback counters for `/v1/*` and `POST /v1/telemetry` |
| `API_RATE_LIMITER` | Rate limit | 65 / 60 s per IP on `/v1/*` |
| `TELEMETRY_RATE_LIMITER` | Rate limit | 240 / 60 s per IP on `POST /v1/telemetry` |
| `ANALYTICS` | Analytics Engine | `xivdyetools_web_analytics` (`_dev` on the dev worker); absent → telemetry is accepted and discarded |
| `ASSETS` | Static assets | **Production only** — the VitePress developer docs on `developers.xivdyetools.app`; run `pnpm build:docs` before deploying |

`api-worker` has no secrets.

---

## xivdyetools-og-worker

### wrangler.toml Variables

```toml
[vars]
APP_BASE_URL = "https://xivdyetools.app"          # beta worker: https://beta.xivdyetools.app
OG_IMAGE_BASE_URL = "https://og.xivdyetools.app/og"  # beta: https://og-beta.xivdyetools.app/og
```

Both are required (`Env` in `apps/og-worker/src/types.ts` declares them non-optional). The only
binding is `ANALYTICS` (Analytics Engine, `xivdyetools_og_analytics` / `…_beta`). **No secrets.**

Note the top-level block is the *routed* beta worker on `beta.xivdyetools.app`, so a bare
`wrangler deploy` is live — see [DEPLOY_ENVIRONMENTS](../operations/DEPLOY_ENVIRONMENTS.md).

---

## xivdyetools-moderation-worker

### wrangler.toml Variables

```toml
[vars]
ENVIRONMENT = "development"                       # "development" (dev worker) | "production"
DISCORD_CLIENT_ID = "1453806659708129374"         # its own Discord application, not the main bot's
PRESETS_API_URL = "https://api.xivdyetools.app"
```

All three are declared in **both** blocks — `vars` are not inheritable. As on discord-worker,
`validateEnv` requires the rate-limit bindings only when `ENVIRONMENT` reads `production`.

### Secrets (set via `wrangler secret put`)

| Secret | Required | Description |
|--------|----------|-------------|
| `DISCORD_TOKEN` | ✅ Yes | Moderation bot token |
| `DISCORD_PUBLIC_KEY` | ✅ Yes | Ed25519 public key for interaction verification |
| `MODERATOR_IDS` | ✅ Yes | Comma-separated moderator Discord user IDs (validated as snowflakes) |
| `MODERATION_CHANNEL_ID` | ✅ Yes | Channel the `/preset` moderation commands are restricted to |
| `BOT_API_SECRET` | No | Shared secret for presets-api |
| `BOT_SIGNING_SECRET` | No | HMAC signing key for v2 bot request verification |
| `SUBMISSION_LOG_CHANNEL_ID` | No | Channel for all submissions |

`validateEnv` (`src/utils/env-validation.ts`) treats the four ✅ rows plus `DISCORD_CLIENT_ID`
and `PRESETS_API_URL` as hard requirements, and also fails when the `KV`, `DB` or `PRESETS_API`
bindings are missing.

Bindings: `PRESETS_API` (service → `xivdyetools-presets-api`), `DB` (D1 — the *same*
`xivdyetools-presets` database presets-api owns), `KV`, and the `RL_COMMAND` / `RL_AUTOCOMPLETE`
rate-limit bindings.

---

## xivdyetools-image-worker

**No variables, no secrets** — `ENVIRONMENT` is declared on the `Env` type, but no `wrangler.toml` block sets it in any environment (only tests assign it), so never branch on it here
— and no bindings at all. The worker is reachable only through its callers' `IMAGE_WORKER`
service bindings, so there is nothing to configure. See
[IMAGE_WORKER_SPLIT](../operations/IMAGE_WORKER_SPLIT.md).

---

## xivdyetools-stoat-worker

Node.js, not a Worker — configuration comes from `process.env` (`apps/stoat-worker/src/config.ts`).

| Variable | Required | Description |
|----------|----------|-------------|
| `BOT_TOKEN` | ✅ Yes | Revolt bot token — `loadConfig()` throws without it |
| `STATS_AUTHORIZED_USERS` | No | Comma-separated Stoat ULIDs allowed to view stats (validated at startup) |
| `UPSTASH_REDIS_REST_URL` | No | Upstash rate-limit backend; falls back to memory when unset |
| `UPSTASH_REDIS_REST_TOKEN` | No | Paired with the URL above |

The bot is **parked** and has no deploy workflow.

---

## Rate-limit bindings (FINDING-003, 2026-08-21 audit)

Per-client abuse limiting uses the native **Workers Rate Limiting binding** (`[[ratelimits]]`, GA 2025-09) via `CloudflareRateLimiter` from `@xivdyetools/worker-kit/rate-limiter`. Bindings need no resource creation — they deploy with the worker. Each binding carries ONE fixed `{ limit, period }`, so workers with several limits bind one tier per distinct limit. `namespace_id` must be unique per account; the allocation is:

| Worker | Binding | limit / period | namespace_id (prod / dev) | Fallback when absent |
|--------|---------|----------------|---------------------------|----------------------|
| api-worker | `API_RATE_LIMITER` | 65 / 60 s (60 + 5 burst per IP on `/v1/*`, except `/v1/telemetry`) | 1001 / 1002 | KV `RATE_LIMIT` |
| api-worker | `TELEMETRY_RATE_LIMITER` | 240 / 60 s per IP on `POST /v1/telemetry` — its own bucket, so web-app beacons behind a shared NAT address never 429 `/v1/chara/*` | 1003 / 1004 | KV `RATE_LIMIT` (`telemetry:ip:` prefix) |
| presets-api | `RL_PUBLIC` | 100 / 60 s per IP on `/api/*` | 1011 / 1012 | per-isolate memory |
| oauth | `RL_AUTH_10` / `RL_AUTH_20` / `RL_AUTH_30` | 10 / 20 / 30 per 60 s per IP+path (`OAUTH_LIMITS`) | 1021-1023 (top-level = prod), 1024-1026 (development) — the preview tier (1027-1029) went with the deleted `[env.preview]` block (FINDING-029) | KV `TOKEN_BLACKLIST` (`rl:` prefix), then memory |
| moderation-worker | `RL_COMMAND` / `RL_AUTOCOMPLETE` | 25 / 70 per 60 s per Discord user | 1031-1032 / 1033-1034 | KV `KV` |
| discord-worker | `RL_5` / `RL_10` / `RL_15` / `RL_20` / `RL_30` / `RL_70` | 5 / 10 / 15 / 20 / 30 / 70 per 60 s per Discord user + command — one tier per distinct effective limit in `DISCORD_COMMAND_LIMITS` (FINDING-007) | 1041-1046 (production), 1051-1056 (top-level beta) | KV `KV` — logs a one-time warning when no tier is bound |

Why: KV allows one write per second per key and the read-modify-write counter swallows the resulting 429s, so a single fast client never reaches a 60 s threshold (FINDING-003). KV/memory remain only as fallbacks for environments without the binding.

## Shared Secrets

These secrets must match across services:

| Secret | Services | Purpose |
|--------|----------|---------|
| `JWT_SECRET` | oauth, presets-api | JWT signing (oauth) and verification (presets-api) |
| `BOT_API_SECRET` | discord-worker, moderation-worker, presets-api | Bot-to-API auth |
| `BOT_SIGNING_SECRET` | discord-worker, moderation-worker, presets-api | HMAC key for the v2 bot request signature |
| `MODERATOR_IDS` | discord-worker, moderation-worker, presets-api | Moderator access |
| `INTERNAL_WEBHOOK_SECRET` | presets-api, discord-worker | Authenticates the `DISCORD_WORKER` service-binding notification call |

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
```

(No `[[services]]` block in this repo sets `environment` — each named env declares its own
bindings.)

### Analytics Engine

```toml
[[analytics_engine_datasets]]
binding = "ANALYTICS"
dataset = "xivdyetools_bot_analytics"   # og-worker: xivdyetools_og_analytics,
                                        # api-worker: xivdyetools_web_analytics
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
