# Service Bindings

**Cloudflare Worker-to-Worker communication in the XIV Dye Tools ecosystem**

---

## Overview

Cloudflare Service Bindings enable zero-latency, zero-cost communication between Workers. Instead of making HTTP requests that traverse the public internet, Service Bindings call Workers directly within Cloudflare's network.

```
┌─────────────────────────┐     Service Binding      ┌─────────────────────────┐
│  xivdyetools-discord-   │ ─────────────────────► │  xivdyetools-presets-   │
│  worker                 │    (No HTTP overhead)   │  api                    │
└─────────────────────────┘                         └─────────────────────────┘
```

`discord-worker` holds two further outbound bindings: `IMAGE_WORKER` →
`xivdyetools-image-worker` (photon-backed pixel extraction for `/extractor`; see
`docs/operations/IMAGE_WORKER_SPLIT.md`) and `UNIVERSALIS_PROXY` →
`xivdyetools-api-worker` (market-board prices for `/budget`). Unlike `presets-api`,
`image-worker` has no public surface at all — it is reachable *only* via these bindings.

---

## Binding Configuration

### xivdyetools-discord-worker

**wrangler.toml** (binding names are the same in the top-level beta block and under
`[env.production]`; no `[[services]]` block in this repo declares an `environment` key):
```toml
[[services]]
binding = "PRESETS_API"
service = "xivdyetools-presets-api"

[[services]]
binding = "UNIVERSALIS_PROXY"
service = "xivdyetools-api-worker"

[[services]]
binding = "IMAGE_WORKER"
service = "xivdyetools-image-worker"

[[kv_namespaces]]
binding = "KV"
id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

[[analytics_engine_datasets]]
binding = "ANALYTICS"
dataset = "xivdyetools_bot_analytics"   # `…_beta` on the top-level beta worker

# One native rate-limit binding per distinct effective limit (FINDING-007)
[[ratelimits]]
name = "RL_15"
namespace_id = "1043"
simple = { limit = 15, period = 60 }
```

**TypeScript Env interface** (`apps/discord-worker/src/types/env.ts`, abridged):
```typescript
interface Env {
  // Service Bindings
  PRESETS_API?: Fetcher;          // Preset CRUD, voting, listing
  UNIVERSALIS_PROXY?: Fetcher;    // Market-board prices for /budget (→ api-worker)
  IMAGE_WORKER?: Fetcher;         // Photon-backed pixel extraction for /extractor

  // KV Namespaces
  KV: KVNamespace;                // Analytics counters, user prefs, favourites

  // Analytics
  ANALYTICS?: AnalyticsEngineDataset;

  // Native rate limiting — one per tier, all optional (KV fallback in dev/tests)
  RL_5?: RateLimitBinding;
  RL_10?: RateLimitBinding;
  RL_15?: RateLimitBinding;
  RL_20?: RateLimitBinding;
  RL_30?: RateLimitBinding;
  RL_70?: RateLimitBinding;

  // Secrets
  DISCORD_TOKEN: string;
  DISCORD_PUBLIC_KEY: string;
  BOT_API_SECRET?: string;
}
```

### xivdyetools-presets-api

**wrangler.toml:**
```toml
[[d1_databases]]
binding = "DB"
database_name = "xivdyetools-presets"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

[[services]]
binding = "DISCORD_WORKER"
service = "xivdyetools-discord-worker"

[[services]]
binding = "IMAGE_WORKER"
service = "xivdyetools-image-worker"

[[r2_buckets]]
binding = "THUMBNAILS"
bucket_name = "xivdyetools-presets-preview-thumbnails"

# Shared with the oauth worker — same namespace id
[[kv_namespaces]]
binding = "TOKEN_BLACKLIST"
id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

[[ratelimits]]
name = "RL_PUBLIC"
namespace_id = "1011"
simple = { limit = 100, period = 60 }
```

**TypeScript Env interface** (`apps/presets-api/src/types.ts`, abridged):
```typescript
interface Env {
  // D1 Database
  DB: D1Database;

  // Service Bindings
  DISCORD_WORKER?: Fetcher;       // For notifications
  IMAGE_WORKER: Fetcher;          // POST /thumbnail — preview-image encoding

  // R2
  THUMBNAILS: R2Bucket;           // Moderated preview images (shots.xivdyetools.app)

  // KV (shared with oauth)
  TOKEN_BLACKLIST?: KVNamespace;  // Revoked jti list + `botnonce:` replay cache

  // Native rate limiting
  RL_PUBLIC?: RateLimit;

  // Secrets
  BOT_API_SECRET: string;
  BOT_SIGNING_SECRET?: string;
  MODERATOR_IDS: string;
  JWT_SECRET?: string;
  PERSPECTIVE_API_KEY?: string;
}
```

### xivdyetools-moderation-worker

**wrangler.toml:**
```toml
[[services]]
binding = "PRESETS_API"
service = "xivdyetools-presets-api"

[[d1_databases]]
binding = "DB"
database_name = "xivdyetools-presets"   # the same database presets-api owns

[[kv_namespaces]]
binding = "KV"

[[ratelimits]]
name = "RL_COMMAND"
namespace_id = "1031"
simple = { limit = 25, period = 60 }

[[ratelimits]]
name = "RL_AUTOCOMPLETE"
namespace_id = "1032"
simple = { limit = 70, period = 60 }
```

### xivdyetools-oauth-worker

**wrangler.toml:**
```toml
# No outbound service bindings — consumers call OAuth, not the other way around.
[[d1_databases]]
binding = "DB"
database_name = "xivdyetools-users"

[[kv_namespaces]]
binding = "TOKEN_BLACKLIST"   # shared with presets-api

[[ratelimits]]
name = "RL_AUTH_10"           # plus RL_AUTH_20 and RL_AUTH_30
namespace_id = "1021"
simple = { limit = 10, period = 60 }
```

---

## Service Binding Map

```
xivdyetools-discord-worker
├── PRESETS_API ────────────► xivdyetools-presets-api
│   └── Used for: Preset CRUD, voting, listing
│
├── UNIVERSALIS_PROXY ──────► xivdyetools-api-worker
│   └── Used for: Market-board prices for /budget (the /universalis routes)
│
├── IMAGE_WORKER ────────────► xivdyetools-image-worker
│   └── Used for: Photon-backed pixel extraction for /extractor (image-worker has
│       no public surface, see docs/operations/IMAGE_WORKER_SPLIT.md)
│
├── KV (Namespace Binding)
│   └── Used for: User preferences, preset favourites, analytics counters,
│       announced-version memo, and the rate-limit fallback when RL_* is unbound
│
├── RL_5 … RL_70 (native rate-limit bindings)
│   └── Used for: Per-user command limits (one binding per tier)
│
└── ANALYTICS (Analytics Engine)
    └── Used for: Command usage tracking

xivdyetools-moderation-worker
├── PRESETS_API ────────────► xivdyetools-presets-api
│   └── Used for: Preset moderation actions
│
├── DB (D1 Binding) ─────────► xivdyetools-presets database (shared with presets-api)
│   └── Used for: banned_users + moderation_log writes (one batch)
│
├── KV (Namespace Binding)
│   └── Shared with the production discord-worker namespace
│
└── RL_COMMAND, RL_AUTOCOMPLETE (native rate-limit bindings)

xivdyetools-presets-api
├── DB (D1 Binding) ─────────► xivdyetools-presets database
│   └── Tables: categories, presets, votes, moderation_log, banned_users,
│       failed_notifications, submission_events
│
├── DISCORD_WORKER ──────────► xivdyetools-discord-worker
│   └── Used for: Sending notifications (approval, moderation alerts)
│
├── IMAGE_WORKER ────────────► xivdyetools-image-worker
│   └── Used for: POST /thumbnail — cropping/encoding preview uploads to WebP
│
├── THUMBNAILS (R2 Binding)
│   └── Used for: Moderated preview images, served from shots.xivdyetools.app
│
├── TOKEN_BLACKLIST (Namespace Binding, shared with oauth)
│   └── Used for: Revoked-JWT jti checks and bot-signature nonce replay
│       (`botnonce:` keys, 120 s)
│
└── RL_PUBLIC (native rate-limit binding)

xivdyetools-oauth-worker
├── DB (D1 Binding) ─────────► xivdyetools-users database
├── TOKEN_BLACKLIST (Namespace Binding, shared with presets-api)
├── RL_AUTH_10 / _20 / _30 (native rate-limit bindings)
└── (No outbound service bindings - receives calls only)
    └── Called by: Web app, Presets API (for JWT verification)
```

---

## Usage Patterns

### Calling a Service Binding

```typescript
// In xivdyetools-discord-worker

export async function fetchPresets(env: Env): Promise<Preset[]> {
  const request = new Request('https://internal/api/v1/presets', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${env.BOT_API_SECRET}`,
      'X-User-Discord-ID': userId,
      'X-User-Discord-Name': username
    }
  });

  // Prefer Service Binding (zero latency, zero cost)
  if (env.PRESETS_API) {
    const response = await env.PRESETS_API.fetch(request);
    return response.json();
  }

  // Fallback to HTTP (for local development)
  const response = await fetch(
    `${env.PRESETS_API_URL}/api/v1/presets`,
    { headers: request.headers }
  );
  return response.json();
}
```

### Sending Notifications via Service Binding

> **Illustrative only.** `notifyModerators` was deleted from presets-api on
> 2026-09-01 (dead-code audit DEAD-009) — it had no caller, and its
> `MODERATION_WEBHOOK_URL` / `OWNER_DISCORD_ID` / `DISCORD_BOT_TOKEN` /
> `DISCORD_BOT_WEBHOOK_URL` variables went with it. The shape below is kept
> because it is still the right pattern for a service-binding call; it is not a
> description of code that exists.

```typescript
// Pattern example — no longer present in xivdyetools-presets-api

async function notifyModerators(
  env: Env,
  preset: Preset
): Promise<void> {
  const request = new Request('https://internal/webhooks/moderation', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.INTERNAL_WEBHOOK_SECRET}`
    },
    body: JSON.stringify({
      type: 'new_submission',
      preset
    })
  });

  if (env.DISCORD_WORKER) {
    await env.DISCORD_WORKER.fetch(request);
  }
}
```

---

## Benefits of Service Bindings

| Aspect | Service Binding | HTTP Fetch |
|--------|-----------------|------------|
| **Latency** | ~0ms (same network) | 50-200ms (internet) |
| **Cost** | Free (included) | Billed as subrequest |
| **Reliability** | Direct call | Subject to network issues |
| **Security** | Internal only | Requires auth/TLS |

---

## Development Considerations

### Local Development

Service Bindings don't work in local development (`wrangler dev`). Use fallback URLs:

```typescript
// Environment variables for local dev
const PRESETS_API_URL = 'http://localhost:8787';  // Local presets-api
const OAUTH_URL = 'http://localhost:8788';        // Local oauth
```

### Testing Service Bindings

Use `@xivdyetools/test-utils` mock Fetcher:

```typescript
import { createMockFetcher } from '@xivdyetools/test-utils';

const mockPresetsApi = createMockFetcher({
  '/api/v1/presets': {
    body: JSON.stringify({ presets: [] }),
    status: 200
  }
});

const env = {
  PRESETS_API: mockPresetsApi,
  // ... other bindings
};
```

---

## Related Documentation

- [API Contracts](api-contracts.md) - Headers and payloads for inter-service calls
- [Data Flow](data-flow.md) - Sequence diagrams showing service interactions
- [Dependency Graph](dependency-graph.md) - Package dependencies
