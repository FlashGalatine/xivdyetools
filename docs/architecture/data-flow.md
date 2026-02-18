# Data Flow

**Sequence diagrams for key user journeys in the XIV Dye Tools ecosystem**

---

## Authentication Flow (PKCE OAuth)

The web app authenticates users via Discord OAuth with PKCE for security.

```mermaid
sequenceDiagram
    participant User
    participant WebApp as Web App
    participant OAuth as OAuth Worker
    participant Discord as Discord API
    participant Presets as Presets API

    Note over User,Presets: 1. User initiates login
    User->>WebApp: Click "Login with Discord"

    Note over WebApp: 2. Generate PKCE credentials
    WebApp->>WebApp: Generate code_verifier (random 43-128 chars)
    WebApp->>WebApp: code_challenge = SHA256(code_verifier)
    WebApp->>WebApp: Store code_verifier in sessionStorage

    Note over WebApp,OAuth: 3. Start OAuth flow
    WebApp->>OAuth: GET /auth/discord?code_challenge=...&redirect_uri=...

    Note over OAuth,Discord: 4. Discord authorization
    OAuth->>Discord: Redirect to Discord OAuth consent
    Discord->>User: Show authorization screen
    User->>Discord: Approve access
    Discord->>OAuth: GET /auth/callback?code=AUTH_CODE

    Note over OAuth,Discord: 5. Exchange code for tokens
    OAuth->>Discord: POST /oauth2/token (code + client_secret)
    Discord->>OAuth: { access_token, refresh_token }

    Note over OAuth,Discord: 6. Fetch user info
    OAuth->>Discord: GET /users/@me (Bearer access_token)
    Discord->>OAuth: { id, username, global_name, avatar }

    Note over OAuth: 7. Create JWT
    OAuth->>OAuth: Sign JWT with HS256 (JWT_SECRET)
    OAuth->>WebApp: Redirect with ?token=JWT

    Note over WebApp,Presets: 8. Authenticated requests
    WebApp->>WebApp: Store JWT in localStorage
    WebApp->>Presets: GET /api/v1/presets/mine (Authorization: Bearer JWT)
    Presets->>Presets: Verify JWT signature
    Presets->>WebApp: { presets: [...] }
```

### JWT Payload Structure

```json
{
  "sub": "user-uuid",
  "iat": 1702684800,
  "exp": 1702688400,
  "iss": "https://oauth.xivdyetools.com",
  "username": "User#1234",
  "global_name": "Display Name",
  "avatar": "avatar_hash",
  "auth_provider": "discord",
  "discord_id": "123456789012345678"
}
```

---

## Preset Submission Flow

Users submit community presets which go through moderation before publishing.

```mermaid
sequenceDiagram
    participant User
    participant Client as Web App / Discord
    participant Presets as Presets API
    participant Mod as Moderation Service
    participant Discord as Discord (Notifications)

    Note over User,Client: 1. User creates preset
    User->>Client: Create preset (name, colors, category)

    Note over Client,Presets: 2. Submit to API
    Client->>Presets: POST /api/v1/presets<br/>{ name, colors[], category, description }

    Note over Presets: 3. Authentication check
    Presets->>Presets: Verify Bot API Key or JWT

    Note over Presets: 4. Rate limit check
    Presets->>Presets: Query submissions today for user
    alt Over limit (10/day)
        Presets->>Client: 429 Too Many Requests
    end

    Note over Presets: 5. Duplicate detection
    Presets->>Presets: Generate dye_signature (sorted IDs)
    Presets->>Presets: Check existing presets
    alt Duplicate found
        Presets->>Client: 409 Conflict
    end

    Note over Presets,Mod: 6. Content moderation
    Presets->>Mod: Check name & description

    Note over Mod: 6a. Local profanity filter
    Mod->>Mod: Check against word lists (6 languages)

    Note over Mod: 6b. Perspective API (optional)
    Mod->>Mod: ML toxicity scoring

    alt Content flagged
        Mod->>Presets: { flagged: true, reason: "..." }
        Presets->>Presets: Set status = "pending_review"
        Presets->>Discord: Notify moderators
    else Content clean
        Mod->>Presets: { flagged: false }
        Presets->>Presets: Set status = "approved"
    end

    Note over Presets: 7. Save to database
    Presets->>Presets: INSERT into presets table
    Presets->>Presets: Auto-upvote for author

    Presets->>Client: 201 Created { preset, status }
```

### Moderation Pipeline Detail

```
Input: { name: "My Preset", description: "A cool outfit" }
           │
           ▼
┌─────────────────────────┐
│  Local Profanity Filter │ ◄── Fast, runs first
│  (6 language word lists)│
└───────────┬─────────────┘
            │
            ▼ (if passed)
┌─────────────────────────┐
│   Perspective API       │ ◄── ML-based, optional
│   (toxicity scoring)    │
└───────────┬─────────────┘
            │
            ▼ (if flagged)
┌─────────────────────────┐
│   Manual Review Queue   │ ◄── Moderator decision
│   (approve/reject)      │
└─────────────────────────┘
```

---

## Color Matching Flow

Core functionality for finding the closest FFXIV dye to any color.

```mermaid
sequenceDiagram
    participant User
    participant Client as Web App / Discord
    participant Core as @xivdyetools/core

    Note over User,Client: 1. User provides color
    User->>Client: Enter hex color (#FF6B6B)

    Note over Client,Core: 2. Initialize services
    Client->>Core: new DyeService(dyeDatabase)

    Note over Core: 3. k-d tree lookup
    Core->>Core: Convert hex to RGB
    Core->>Core: Query k-d tree (O(log n) nearest neighbor)
    Core->>Core: Calculate deltaE (color difference)

    Note over Core: 4. Return matches
    Core->>Client: [{<br/>  dye: { id, name, hex, category },<br/>  distance: 12.5,<br/>  deltaE: 8.2<br/>}, ...]

    Note over Client,User: 5. Display results
    Client->>User: Show closest dye with comparison
```

### k-d Tree Performance

| Operation | Time Complexity | Typical Time |
|-----------|-----------------|--------------|
| Build tree (startup) | O(n log n) | ~2ms for 136 dyes |
| Nearest neighbor query | O(log n) | <0.1ms |
| k-nearest neighbors | O(k log n) | <0.5ms for k=5 |

---

## Voting Flow

Users vote on community presets to curate the best content.

```mermaid
sequenceDiagram
    participant User
    participant Client as Web App / Discord
    participant Presets as Presets API
    participant DB as D1 Database

    Note over User,Client: 1. User views preset
    User->>Client: View preset detail

    Note over Client,Presets: 2. Check existing vote
    Client->>Presets: GET /api/v1/presets/:id
    Presets->>DB: SELECT * FROM votes WHERE preset_id AND user_id
    Presets->>Client: { preset, userVote: "up" | "down" | null }

    Note over User,Client: 3. User votes
    User->>Client: Click upvote/downvote

    Note over Client,Presets: 4. Submit vote
    Client->>Presets: POST /api/v1/votes/:presetId<br/>{ vote: "up" | "down" }

    Note over Presets,DB: 5. Transaction
    Presets->>DB: BEGIN TRANSACTION
    Presets->>DB: INSERT/UPDATE votes
    Presets->>DB: UPDATE presets SET upvotes/downvotes
    Presets->>DB: COMMIT

    Presets->>Client: 200 OK { newUpvotes, newDownvotes }
```

---

## Market Price Flow

Fetching real-time FFXIV market prices from Universalis via the caching proxy.

```mermaid
sequenceDiagram
    participant Client as Web App
    participant Proxy as Universalis Proxy
    participant EdgeCache as Cache API (Edge)
    participant KV as KV Storage (Global)
    participant API as Universalis API

    Note over Client,Proxy: 1. Request price data
    Client->>Proxy: GET /api/{server}/{itemId}

    Note over Proxy,EdgeCache: 2. Check edge cache
    Proxy->>EdgeCache: Check Cache API
    alt Edge cache hit
        EdgeCache->>Proxy: { data, age }
        Proxy->>Client: Return cached data
    end

    Note over Proxy,KV: 3. Check KV cache
    Proxy->>KV: Get from KV storage
    alt KV hit (< 5 min for prices)
        KV->>Proxy: { data, timestamp }
        Proxy->>EdgeCache: Store in edge cache
        Proxy->>Client: Return cached data
    end

    Note over Proxy: 4. Request coalescing
    Proxy->>Proxy: Check inflight requests
    alt Same request in flight
        Proxy->>Proxy: Wait for existing request
        Proxy->>Client: Return shared response
    end

    Note over Proxy,API: 5. Fetch from Universalis
    Proxy->>API: GET /api/v2/{server}/{itemId}

    alt Response size check
        API->>Proxy: Response (check < 5MB)
    end

    Note over Proxy,KV: 6. Dual-layer caching
    Proxy->>KV: Store with 5-min TTL (prices)
    Proxy->>EdgeCache: Store for edge caching
    Proxy->>Client: Return price data
```

### Caching Strategy

| Cache Layer | TTL (Prices) | TTL (Static) | Purpose |
|-------------|--------------|--------------|---------|
| Edge Cache (Cache API) | 5 min | 24h | Low-latency regional caching |
| KV Storage | 5 min | 24h | Global persistence across edges |
| Stale-while-revalidate | +1 min | +1h | Serve stale during refresh |

### Request Coalescing

When multiple clients request the same data simultaneously:
```
Request 1 ──┐
Request 2 ──┼──► Single upstream request ──► Shared response
Request 3 ──┘
```
This prevents thundering herd on the Universalis API.

---

## Discord Interaction Flow

How Discord bot commands are processed.

```mermaid
sequenceDiagram
    participant User
    participant Discord as Discord
    participant Worker as Discord Worker
    participant Core as @xivdyetools/core

    Note over User,Discord: 1. User runs command
    User->>Discord: /match #FF6B6B

    Note over Discord,Worker: 2. HTTP Interaction
    Discord->>Worker: POST / (signed payload)

    Note over Worker: 3. Verify signature
    Worker->>Worker: Ed25519 verification
    alt Invalid signature
        Worker->>Discord: 401 Unauthorized
    end

    Note over Worker: 4. Rate limit check
    Worker->>Worker: Check KV counter for user

    Note over Worker: 5. Defer response
    Worker->>Discord: { type: 5 } (DEFERRED_CHANNEL_MESSAGE)

    Note over Worker,Core: 6. Process command
    Worker->>Core: DyeService.findClosestDye("#FF6B6B")
    Core->>Worker: { dye, distance, deltaE }

    Note over Worker: 7. Generate response image
    Worker->>Worker: Build SVG comparison
    Worker->>Worker: Render to PNG (resvg-wasm)

    Note over Worker,Discord: 8. Send follow-up
    Worker->>Discord: PATCH /webhooks/{id}/{token}<br/>{ embeds, files: [png] }

    Discord->>User: Display result with image
```

---

## Related Documentation

- [Service Bindings](service-bindings.md) - Worker-to-worker communication details
- [API Contracts](api-contracts.md) - Request/response specifications
- [Overview](overview.md) - High-level architecture diagram
