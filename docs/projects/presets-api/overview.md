# Presets API Overview

**xivdyetools-presets-api** - Community preset management API

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
-- Main presets table
CREATE TABLE presets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  dye_signature TEXT NOT NULL,  -- Sorted dye IDs for duplicate detection
  colors TEXT NOT NULL,         -- JSON array of dye objects
  category_id INTEGER NOT NULL,
  author_discord_id TEXT NOT NULL,
  author_discord_name TEXT NOT NULL,
  upvotes INTEGER DEFAULT 0,
  downvotes INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  is_curated INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Categories
CREATE TABLE categories (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL
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

**wrangler.toml:**
```toml
[vars]
ENVIRONMENT = "production"
API_VERSION = "v1"
CORS_ORIGIN = "https://app.xivdyetools.com"
```

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
