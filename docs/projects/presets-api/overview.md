# Presets API Overview

**xivdyetools-presets-api** v2.0.0 - Community preset management API

> **2.0.0 (5.0 wave):** preset dyes are stainIDs (3–6 per preset), the `community` category is
> retired and `appearance` / `zones` / `raids-trials` added, presets carry a primary + up to two
> secondary categories, an `example_link`, and a moderated preview image (R2 `THUMBNAILS` bucket,
> thumbnails via the `IMAGE_WORKER` service binding). The illustrative schema below is out of date —
> see [database.md](database.md) for the real columns.

---

## What is the Presets API?

A Cloudflare Worker + D1 database that provides a REST API for community dye preset submissions, voting, and moderation. Used by both the web app and Discord bot.

---

## Quick Start (Development)

```bash
cd xivdyetools-presets-api

# Install dependencies
npm install

# Set secrets (one time)
wrangler secret put BOT_API_SECRET
wrangler secret put JWT_SECRET

# Apply database schema
npm run db:migrate:local

# Start local dev server (port 8787)
npm run dev

# Deploy
npm run deploy
```

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

-- Votes (one per user per preset)
CREATE TABLE votes (
  id TEXT PRIMARY KEY,
  preset_id TEXT NOT NULL,
  user_discord_id TEXT NOT NULL,
  vote TEXT NOT NULL,  -- 'up' or 'down'
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(preset_id, user_discord_id),
  FOREIGN KEY (preset_id) REFERENCES presets(id)
);

-- Moderation audit log
CREATE TABLE moderation_log (
  id TEXT PRIMARY KEY,
  preset_id TEXT NOT NULL,
  action TEXT NOT NULL,
  moderator_discord_id TEXT NOT NULL,
  reason TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

---

## Moderation Pipeline

### Three-Layer Filtering

1. **Local Profanity Filter** (fast, always runs)
   - Word lists in 6 languages
   - Pattern matching for variations
   - Immediate rejection for clear violations

2. **Perspective API** (optional, ML-based)
   - Toxicity scoring
   - Identity attack detection
   - Requires API key configuration

3. **Manual Review** (for flagged content)
   - Moderators approve/reject
   - Audit trail in moderation_log

### Flow

```
Submission → Local Filter → [Pass] → Perspective API → [Pass] → Auto-Approve
                  │                        │
                  ▼                        ▼
              [Fail]                   [Flag]
                  │                        │
                  ▼                        ▼
              Reject                 Manual Review
```

---

## Rate Limiting

- **10 submissions per user per day**
- Based on UTC day boundary
- Tracked via database query (not KV)

```typescript
// Check submissions in current UTC day
const today = new Date().toISOString().split('T')[0];
const count = await db.prepare(
  `SELECT COUNT(*) as count FROM presets
   WHERE author_discord_id = ? AND date(created_at) = ?`
).bind(userId, today).first();

if (count >= 10) {
  return c.json({ error: 'Rate limit exceeded' }, 429);
}
```

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
vars = { ENVIRONMENT = "production", API_VERSION = "v1", CORS_ORIGIN = "https://xivdyetools.app", ADDITIONAL_CORS_ORIGINS = "https://xiv-colorexplorer.pages.dev,https://xivdyetools.projectgalatine.com,https://beta.xivdyetools.app" }
```

Bindings: `DB` (D1 `xivdyetools-presets`), `DISCORD_WORKER` (service), `IMAGE_WORKER` (service → `xivdyetools-image-worker`, `POST /thumbnail`), `THUMBNAILS` (R2).

**Secrets:**
```bash
wrangler secret put BOT_API_SECRET
wrangler secret put JWT_SECRET
wrangler secret put MODERATOR_IDS      # Comma-separated
wrangler secret put PERSPECTIVE_API_KEY # Optional
```

---

## Related Documentation

- [Endpoints](endpoints.md) - Full API reference
- [Moderation](moderation.md) - Content filtering details
- [Database](database.md) - Schema and queries
- [Rate Limiting](rate-limiting.md) - Submission limits
