# 04 — Authentication & Rate Limiting

## Access Tiers

The API uses a two-tier access model. No tier requires user identity (OAuth/JWT) — this is a developer API, not an end-user API.

### Tier 1: Anonymous (No Key)

- **Rate limit:** 60 requests/minute per IP address
- **No registration required** — ideal for trying the API, small personal projects, or quick integrations
- **Identification:** `CF-Connecting-IP` header (Cloudflare provides this automatically)

### Tier 2: Registered (API Key)

- **Rate limit:** 300 requests/minute per API key
- **Requires registration** — simple form, links Discord account for accountability
- **Identification:** API key passed via `X-API-Key` header or `?apikey=` query parameter
- **Benefits:** 5x rate limit, usage analytics dashboard, priority support

### Tier Comparison

| Feature | Anonymous | Registered |
|---------|-----------|-----------|
| Rate limit | 60/min | 300/min |
| Registration | None | Discord OAuth |
| Key required | No | Yes |
| Usage analytics | No | Yes |
| Support | Community | Priority |
| Cost | Free | Free |

## API Key Design

### Key Format

```
xdt_live_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4
xdt_test_f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3
```

| Component | Description |
|-----------|-------------|
| `xdt_` | Prefix — identifies this as an XIV Dye Tools API key |
| `live_` / `test_` | Environment — `live` for production, `test` for development |
| 32 hex chars | Random bytes — 128 bits of entropy |

**Total length:** 41 characters (e.g., `xdt_live_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4`)

The `xdt_` prefix enables:
- GitHub secret scanning to detect leaked keys
- Quick visual identification in logs
- Easy regex matching for key extraction

### Key Storage (D1)

```sql
CREATE TABLE api_keys (
  id          TEXT PRIMARY KEY,                     -- UUID
  key_hash    TEXT NOT NULL UNIQUE,                 -- SHA-256 hash (never store plaintext)
  key_prefix  TEXT NOT NULL,                        -- First 8 chars for identification (e.g., "xdt_live")
  owner_discord_id TEXT NOT NULL,                   -- Discord user ID
  owner_name  TEXT NOT NULL,                        -- Discord display name
  label       TEXT,                                 -- User-defined label (e.g., "My Glamour App")
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  last_used   TEXT,
  request_count INTEGER DEFAULT 0,
  is_active   BOOLEAN DEFAULT TRUE,
  tier        TEXT DEFAULT 'registered'             -- For future paid tiers
);

CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_owner ON api_keys(owner_discord_id);
```

**Security:** Only the SHA-256 hash of the key is stored. The plaintext key is shown once at creation time and never again. This follows the same pattern as GitHub personal access tokens.

### Key Lifecycle

1. **Creation:** User authenticates via Discord OAuth → fills label → key generated → plaintext shown once
2. **Usage:** Key sent in `X-API-Key` header → hashed → looked up in D1 → validated
3. **Rotation:** User can regenerate a key (old key immediately invalidated)
4. **Revocation:** User or admin can deactivate a key
5. **Deletion:** User can permanently delete a key and its usage data

### Keys Per User

- **Maximum 5 keys per Discord account** — allows separate keys for different projects
- **Each key has independent rate limits** — but shares the per-user hard limit

## Rate Limiting Implementation

### Backend

Reuse `@xivdyetools/rate-limiter` with the `KVRateLimiter` backend (Cloudflare KV).

```typescript
import { KVRateLimiter, type RateLimitConfig } from '@xivdyetools/rate-limiter';

const rateLimiter = new KVRateLimiter({
  kv: env.RATE_LIMIT,
  keyPrefix: 'api:',
});

const ANONYMOUS_CONFIG: RateLimitConfig = {
  maxRequests: 60,
  windowMs: 60_000, // 1 minute
  burstAllowance: 5,
  failOpen: true,
};

const REGISTERED_CONFIG: RateLimitConfig = {
  maxRequests: 300,
  windowMs: 60_000,
  burstAllowance: 20,
  failOpen: true,
};
```

### Rate Limit Key Strategy

| Tier | Key Format | Example |
|------|-----------|---------|
| Anonymous | `api:ip:{ip}` | `api:ip:203.0.113.42` |
| Registered | `api:key:{keyPrefix}` | `api:key:xdt_live` |

### Rate Limit Response Headers

Every response includes standard rate limit headers (reuse `getRateLimitHeaders()` from the rate-limiter package):

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 42
X-RateLimit-Reset: 1702684860
Retry-After: 30            # Only on 429 responses
```

### 429 Response Body

```json
{
  "success": false,
  "error": "RATE_LIMITED",
  "message": "Rate limit exceeded. 60 requests per minute allowed for anonymous access. Register for an API key to get 300 requests per minute.",
  "retryAfter": 30,
  "requestId": "abc-123"
}
```

## Abuse Prevention

### Global Hard Limit

Regardless of API key, a global per-IP hard limit of **600 requests/minute** prevents key sharing or key-stuffing attacks. This is checked before the API key lookup.

### Ban List

Abusive IPs or API keys can be added to a KV-based ban list:

```typescript
// KV key format
ban:ip:{ip}       // IP ban
ban:key:{keyHash} // Key ban
```

Banned requests receive a 403 response with no body (to avoid leaking information).

### Suspicious Activity Detection

Log and alert on:
- API key used from >10 distinct IPs in 5 minutes (potential key sharing)
- Single IP cycling through >3 different API keys (potential key stuffing)
- Sustained >80% rate limit utilization (potential scraping)

These are logged to Cloudflare Analytics Engine for review — not automatically banned.

## Request Flow

```
Request arrives
    │
    ├── Check global IP hard limit (600/min)
    │   └── Exceeded? → 429
    │
    ├── Check IP ban list
    │   └── Banned? → 403
    │
    ├── Extract API key (X-API-Key header or ?apikey= param)
    │   │
    │   ├── Key present?
    │   │   ├── Hash key → look up in D1
    │   │   │   ├── Not found? → 401 Invalid API key
    │   │   │   ├── Inactive? → 401 Key revoked
    │   │   │   └── Valid → Check registered rate limit (300/min)
    │   │   │       ├── Exceeded? → 429
    │   │   │       └── Pass → Continue to handler
    │   │   └── Update last_used + request_count (async, fire-and-forget)
    │   │
    │   └── No key?
    │       └── Check anonymous rate limit (60/min per IP)
    │           ├── Exceeded? → 429
    │           └── Pass → Continue to handler
    │
    └── Handler processes request → Response with rate limit headers
```

## Future Considerations

- **Paid tier:** If demand warrants, a paid tier (1000+/min, SLA, webhook notifications) can be added by extending the `tier` column in the API keys table
- **OAuth scopes:** If write operations are ever exposed, API keys could gain scopes (e.g., `read:dyes`, `write:presets`)
- **API key rotation grace period:** Allow old and new key to both work for 5 minutes during rotation
