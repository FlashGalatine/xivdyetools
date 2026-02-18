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

---

## Binding Configuration

### xivdyetools-discord-worker

**wrangler.toml:**
```toml
[[services]]
binding = "PRESETS_API"
service = "xivdyetools-presets-api"
environment = "production"

[[kv_namespaces]]
binding = "KV"
id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

[[analytics_engine_datasets]]
binding = "ANALYTICS"
dataset = "xivdyetools_analytics"
```

**TypeScript Env interface:**
```typescript
interface Env {
  // Service Bindings
  PRESETS_API?: Fetcher;          // Worker-to-worker call

  // KV Namespaces
  KV: KVNamespace;                // Rate limits, user prefs, stats

  // Analytics
  ANALYTICS?: AnalyticsEngineDataset;

  // Secrets
  DISCORD_TOKEN: string;
  DISCORD_PUBLIC_KEY: string;
  BOT_API_SECRET: string;
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
environment = "production"
```

**TypeScript Env interface:**
```typescript
interface Env {
  // D1 Database
  DB: D1Database;

  // Service Bindings
  DISCORD_WORKER?: Fetcher;       // For notifications

  // Secrets
  BOT_API_SECRET: string;
  JWT_SECRET: string;
  PERSPECTIVE_API_KEY?: string;
}
```

### xivdyetools-oauth

**wrangler.toml:**
```toml
# OAuth worker is standalone - no service bindings to other workers
# (Consumers call OAuth, not the other way around)
```

---

## Service Binding Map

```
xivdyetools-discord-worker
├── PRESETS_API ────────────► xivdyetools-presets-api
│   └── Used for: Preset CRUD, voting, listing
│
├── KV (Namespace Binding)
│   └── Used for: Rate limiting, favorites, collections, stats
│
└── ANALYTICS (Analytics Engine)
    └── Used for: Command usage tracking

xivdyetools-presets-api
├── DB (D1 Binding) ─────────► xivdyetools-presets database
│   └── Tables: presets, categories, votes, moderation_log, rate_limits
│
├── DISCORD_WORKER ──────────► xivdyetools-discord-worker
│   └── Used for: Sending notifications (approval, moderation alerts)
│
└── KV (Namespace Binding)
    └── Used for: Response caching

xivdyetools-oauth
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

```typescript
// In xivdyetools-presets-api

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
