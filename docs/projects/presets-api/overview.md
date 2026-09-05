# Presets API Overview

**xivdyetools-presets-api** — community preset management API. Current version:
[docs/versions.md](../../versions.md); release history:
[`apps/presets-api/CHANGELOG.md`](../../../apps/presets-api/CHANGELOG.md).

> **Since the 5.0 wave:** preset dyes are stainIDs (3–6 per preset), the `community` category is
> retired and `appearance` / `zones` / `raids-trials` added, presets carry a primary + up to two
> secondary categories, an `example_link`, and a moderated preview image (R2 `THUMBNAILS` bucket,
> thumbnails via the `IMAGE_WORKER` service binding). The schema sketch below is abridged —
> [database.md](database.md) is the authority on columns and indexes.

---

## What is the Presets API?

A Cloudflare Worker + D1 database that provides a REST API for community dye preset submissions, voting, and moderation. Used by both the web app and Discord bot.

---

## Quick Start (Development)

```bash
# From the monorepo root (xivdyetools/)
pnpm install

# Apply the schema to the local D1
pnpm --filter xivdyetools-presets-api run db:migrate:local

# Start the local dev server (port 8787)
pnpm --filter xivdyetools-presets-api run dev

# Deploy — bare deploy is the routeless DEV worker; production needs --env production
pnpm --filter xivdyetools-presets-api run deploy
pnpm --filter xivdyetools-presets-api run deploy:production
```

Secrets are set once per environment from `apps/presets-api/` — see
[Environment Variables](#environment-variables) below for the full list.

---

## Architecture

### Request Flow

```
Request → Auth Middleware → Handler → D1 Database
              │
              ▼
      Moderation Pipeline (for submissions)
              │
              ├── Local Profanity Filter
              ├── Perspective API (optional)
              └── Manual Review Queue
```

### Project Structure

```
src/
├── index.ts                 # Hono app, CORS, routes
├── types.ts                 # Env bindings, domain types
├── middleware/
│   └── auth.ts              # Bot API + JWT authentication
├── handlers/
│   ├── presets.ts           # CRUD operations
│   ├── votes.ts             # Voting system
│   ├── categories.ts        # Category listing
│   └── moderation.ts        # Review queue, approve/reject
├── services/
│   ├── preset-service.ts    # Business logic
│   ├── moderation-service.ts # Content filtering
│   └── rate-limit-service.ts # Submission limits
└── data/
    └── profanity/           # Multi-language word lists
```

---

## API Endpoints

### Public (No Auth)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/presets` | GET | List presets (with filtering) |
| `/api/v1/presets/:id` | GET | Get single preset |
| `/api/v1/presets/featured` | GET | Get featured presets |
| `/api/v1/categories` | GET | List categories |

### Authenticated

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/presets` | POST | Submit new preset |
| `/api/v1/presets/mine` | GET | Get user's presets |
| `/api/v1/votes/:id` | POST | Vote on preset |
| `/api/v1/votes/:id` | DELETE | Remove vote |

### Moderator Only

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/moderation/pending` | GET | Get review queue |
| `/api/v1/moderation/:id/status` | PATCH | Approve/reject |

---

## Database Schema (D1)

```sql
-- Main presets table (abridged — see database.md and schema.sql)
CREATE TABLE presets (
  id TEXT PRIMARY KEY,                       -- UUID v4
  name TEXT NOT NULL,                        -- 2-50 chars
  description TEXT NOT NULL,                 -- 10-200 chars
  category_id TEXT NOT NULL,                 -- primary category slug
  secondary_categories TEXT NOT NULL DEFAULT '[]', -- up to two more slugs
  dyes TEXT NOT NULL,                        -- JSON array of 3-6 stainIDs
  dye_signature TEXT,                        -- sorted dyes JSON, partial UNIQUE
  tags TEXT NOT NULL,
  example_link TEXT,
  preview_image_key TEXT,
  preview_image_status TEXT NOT NULL DEFAULT 'none',
  author_discord_id TEXT, author_name TEXT,
  vote_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',             -- pending | approved | rejected | flagged | hidden
  is_curated INTEGER DEFAULT 0,
  previous_values TEXT,
  created_at TEXT, updated_at TEXT,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Categories (slug-keyed)
CREATE TABLE categories (
  id TEXT PRIMARY KEY,        -- 'jobs', 'grand-companies', 'seasons', 'events',
  name TEXT NOT NULL,         -- 'aesthetics', 'appearance', 'zones', 'raids-trials'
  description TEXT NOT NULL,
  icon TEXT, is_curated INTEGER DEFAULT 0, display_order INTEGER DEFAULT 0
);

-- Votes (one per user per preset; there is no vote direction and no downvotes)
CREATE TABLE votes (
  preset_id TEXT NOT NULL,
  user_discord_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (preset_id, user_discord_id),
  FOREIGN KEY (preset_id) REFERENCES presets(id) ON DELETE CASCADE
);

-- Moderation audit log
CREATE TABLE moderation_log (
  id TEXT PRIMARY KEY,
  preset_id TEXT,                -- NULL for the user-level ban / unban (migration 0013)
  moderator_discord_id TEXT NOT NULL,
  action TEXT NOT NULL,          -- approve | reject | flag | unflag | requeue | revert
                                 -- | ban | unban | hide | restore (moderation-worker)
  reason TEXT,
  target_discord_id TEXT,        -- the moderated user (migration 0013)
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (preset_id) REFERENCES presets(id) ON DELETE CASCADE
);

-- Append-only per-user quota log (migrations 0011 / 0012)
CREATE TABLE submission_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_discord_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('submission', 'flagged_edit', 'preview_upload', 'text_edit')),
  preset_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
```

---

## Moderation Pipeline

### Three-Layer Filtering

1. **Local Profanity Filter** (fast, always runs)
   - Word lists in 6 languages
   - A hit short-circuits the pipeline and files the preset as `pending` — it never refuses the write

2. **Perspective API** (optional, ML-based)
   - `TOXICITY`, `SEVERE_TOXICITY`, `IDENTITY_ATTACK`, `INSULT`, `PROFANITY`; flags at ≥ 0.7
   - Requires `PERSPECTIVE_API_KEY`; **fail-closed** — with a key set, an error or timeout also
     queues the preset for a moderator (FINDING-005)

3. **Manual Review** (for anything not cleared above)
   - Moderators approve/reject
   - Audit trail in `moderation_log`

### Flow

```
Submission → Local Filter ─[hit]────────────────────────┐
                  │                                     │
               [clean]                                  │
                  ▼                                     │
           Perspective API ─[≥ 0.7 or unavailable]──────┤
                  │                                     │
               [clean]                                  ▼
                  ▼                            status = 'pending'
        status = 'approved'                  → moderation channel
         (auto-approved)                      → moderator decides
```

Nothing on this path rejects a submission outright: the preset is always created, and the only
question the pipeline answers is `approved` vs `pending`.

---

## Rate Limiting

Three layers — per-IP (100/min), per-user (100/min) and four per-user daily quotas. The submission
quota is 10 per UTC day, counted in D1 as
`max(presets rows created today, 'submission' rows in submission_events today)`
(`getEffectiveSubmissionCountToday()` in `src/services/rate-limit-service.ts`) — the append-only
event log is what stops an author refilling the quota by deleting their own presets (FINDING-008).

See [rate-limiting.md](rate-limiting.md) for the backends, the other three quotas, the failure modes
and both 429 body shapes.

---

## Authentication

Two methods supported:

### Bot API (Discord Worker)

```http
Authorization: Bearer <BOT_API_SECRET>
X-User-Discord-ID: 123456789
X-User-Discord-Name: User#1234
```

### JWT (Web App)

```http
Authorization: Bearer <JWT_TOKEN>
```

JWT is verified using shared `JWT_SECRET` with OAuth worker.

---

## Environment Variables

**wrangler.toml** (top-level block is `xivdyetools-presets-api-dev`; production under `[env.production]` — a bare `wrangler deploy` no longer touches production):
```toml
[env.production]
vars = { ENVIRONMENT = "production", API_VERSION = "v1", CORS_ORIGIN = "https://xivdyetools.app", ADDITIONAL_CORS_ORIGINS = "https://xiv-colorexplorer.pages.dev,https://xivdyetools.projectgalatine.com,https://beta.xivdyetools.app", JWT_ISSUER = "https://auth.xivdyetools.app", CACHE_PURGE_ZONE_ID = "…" }
```

`JWT_ISSUER` pins the expected `iss` claim and must start with `https://` in production
(FINDING-015). `CACHE_PURGE_ZONE_ID` is the `xivdyetools.app` zone behind
`shots.xivdyetools.app` — config, not a secret, which is why it lives here (FINDING-018).

**Bindings:**

| Binding | Type | Purpose |
|---------|------|---------|
| `DB` | D1 (`xivdyetools-presets`) | Presets, votes, categories, moderation log, bans, quotas |
| `DISCORD_WORKER` | Service Binding | Moderation notifications (`POST /webhooks/preset-submission`) |
| `IMAGE_WORKER` | Service Binding | `POST /thumbnail` — crops/encodes preview images to WebP |
| `THUMBNAILS` | R2 (`xivdyetools-presets-preview-thumbnails`) | Moderated preview images |
| `TOKEN_BLACKLIST` | KV (shared with `apps/oauth`) | Revoked JWT `jti`s, plus the 120 s `botnonce:` replay cache |
| `RL_PUBLIC` | Workers Rate Limiting (`[[ratelimits]]`, 100 / 60 s) | Backs both the per-IP and per-user limiters |

`validateEnv` makes **all six** required in production, along with `JWT_SECRET`, `JWT_ISSUER` and
`INTERNAL_WEBHOOK_SECRET` — each of them degrades silently rather than loudly when missing, which is
the reason for the check (FINDING-013).

**Secrets:**
```bash
wrangler secret put BOT_API_SECRET          # Required (all environments)
wrangler secret put MODERATOR_IDS           # Required (all environments), comma-separated
wrangler secret put BOT_SIGNING_SECRET      # Required in production — HMAC key for bot signatures
wrangler secret put JWT_SECRET              # Required in production; shared with apps/oauth
wrangler secret put INTERNAL_WEBHOOK_SECRET # Required in production — bearer for the discord-worker webhook
wrangler secret put PERSPECTIVE_API_KEY     # Optional (and sunsetting 2026-12-31)
wrangler secret put CACHE_PURGE_API_TOKEN --env production   # Optional, FINDING-018
```

---

## Related Documentation

- [Endpoints](endpoints.md) - Full API reference
- [Moderation](moderation.md) - Content filtering details
- [Database](database.md) - Schema and queries
- [Rate Limiting](rate-limiting.md) - Submission limits
