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

    Note over OAuth,WebApp: 7. Bounce the code back to the SPA (never a token)
    OAuth->>WebApp: 302 to the allowlisted redirect_uri<br/>?code=&csrf=&state=[&provider=][&return_path=]

    Note over WebApp,OAuth: 8. SPA completes the exchange
    WebApp->>OAuth: POST /auth/callback<br/>{ code, code_verifier, state }
    OAuth->>OAuth: Verify the signed state, bind code_verifier to code_challenge
    OAuth->>OAuth: Sign JWT with HS256 (JWT_SECRET)
    OAuth->>WebApp: { success, token, user, expires_at }

    Note over WebApp,Presets: 9. Authenticated requests
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
  "iss": "https://auth.xivdyetools.app",
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
        Presets->>Presets: Set status = "pending"
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
| Build tree (startup) | O(n log n) | ~2ms for 125 dyes (Facewear colours are excluded — not tradeable) |
| Nearest neighbor query | O(log n) | <0.1ms |
| k-nearest neighbors | O(k log n) | <0.5ms for k=5 |

---

## Voting Flow

Users vote on community presets to curate the best content. There is **one kind of vote** — a
toggleable upvote. There is no downvote: the votes table holds at most one row per
`(preset_id, user_discord_id)` and `presets.vote_count` is recomputed from it.

```mermaid
sequenceDiagram
    participant User
    participant Client as Web App / Discord
    participant Presets as Presets API
    participant DB as D1 Database

    Note over User,Client: 1. User views preset
    User->>Client: View preset detail

    Note over Client,Presets: 2. Check existing vote
    Client->>Presets: GET /api/v1/votes/:presetId/check
    Presets->>DB: SELECT 1 FROM votes WHERE preset_id AND user_discord_id
    Presets->>Client: { has_voted: true | false }

    Note over User,Client: 3. User votes
    User->>Client: Click the vote button

    Note over Client,Presets: 4. Submit vote (no body)
    Client->>Presets: POST /api/v1/votes/:presetId
    Presets->>DB: SELECT id FROM presets WHERE id = ? AND status = 'approved'

    Note over Presets,DB: 5. One atomic batch — D1 rejects explicit transactions
    Presets->>DB: db.batch([<br/>  INSERT INTO votes … ON CONFLICT DO NOTHING,<br/>  UPDATE presets SET vote_count = (SELECT COUNT(*) …) RETURNING vote_count<br/>])

    Presets->>Client: 200 OK { success: true, new_vote_count }
```

`DELETE /api/v1/votes/:presetId` removes the vote through the mirror-image batch. A repeat
`POST` answers `409` with `{ success: true, already_voted: true, new_vote_count }`.

---

## Market Price Flow

Fetching real-time FFXIV market prices from Universalis via the caching proxy, which lives
inside `api-worker` under `/universalis` (and `/api/v2` for compatibility).

```mermaid
sequenceDiagram
    participant Client as Web App / Discord Worker
    participant Proxy as api-worker /universalis
    participant EdgeCache as Cache API (Edge)
    participant API as Universalis API

    Note over Client,Proxy: 1. Request price data
    Client->>Proxy: GET /universalis/aggregated/{dc}/{itemIds}

    Note over Proxy,EdgeCache: 2. Check the cache
    Proxy->>EdgeCache: Look up the synthetic cache key
    alt Fresh hit
        EdgeCache->>Proxy: { data, age }
        Proxy->>Client: Return cached data
    else Stale but inside the SWR window
        EdgeCache->>Proxy: { data, age }
        Proxy->>Client: Return stale data immediately
        Proxy->>API: Revalidate in the background (waitUntil)
    end

    Note over Proxy: 3. Request coalescing
    Proxy->>Proxy: Check inflight requests
    alt Same request in flight
        Proxy->>Proxy: Wait for existing request
        Proxy->>Client: Return shared response
    end

    Note over Proxy,API: 4. Fetch from Universalis
    Proxy->>API: GET /api/v2/aggregated/{dc}/{itemIds}

    alt Response size check
        API->>Proxy: Response (check < 5MB)
    end

    Note over Proxy,EdgeCache: 5. Store and return
    Proxy->>EdgeCache: Store with the endpoint's TTL
    Proxy->>Client: Return price data
```

### Caching Strategy

There is **one** cache layer: the Cloudflare Cache API. The proxy used to write a second
copy to KV; that layer was removed to stay clear of the free-tier KV write limits, so KV in
`api-worker` now only backs rate limiting.

| Endpoint | TTL | Stale-while-revalidate |
|----------|-----|------------------------|
| `/aggregated/:dc/:itemIds` (prices) | 5 min | +2 min |
| `/data-centers` | 24 h | +6 h |
| `/worlds` | 24 h | +6 h |

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
    User->>Discord: /extractor color color:#FF6B6B

    Note over Discord,Worker: 2. HTTP Interaction
    Discord->>Worker: POST / (signed payload)

    Note over Worker: 3. Verify signature
    Worker->>Worker: Ed25519 verification
    alt Invalid signature
        Worker->>Discord: 401 Unauthorized
    end

    Note over Worker: 4. Rate limit check
    Worker->>Worker: Check the command's RL_* rate-limit binding for the user<br/>(KV counter only when the binding is unbound)

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
