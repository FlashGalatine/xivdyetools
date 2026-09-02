# Community Preset Palettes System - Specification

> Feature Status: ✅ Implemented (December 2025)
> Platforms: Web App + Discord Bot + Cloudflare Worker
> Core Library Changes: Types defined locally in each consumer (bot & web app)
> Extends: [PRESET_PALETTES.md](./preset-palettes.md)

## Overview

An automated community submission system for preset palettes with centralized storage, duplicate detection, voting, and content moderation. This extends the existing Preset Palettes feature to allow community contributions while maintaining quality through smart automation.

### User Value

- **Community-driven content** - Users contribute palettes for others to discover
- **No duplicates** - Submitting an existing palette automatically votes for it instead
- **Quality through voting** - Popular palettes rise to the top
- **Cross-platform** - Same presets available on web app and Discord bot
- **Instant publishing** - Auto-moderation enables immediate visibility for appropriate content

---

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────────────┐     ┌─────────────────┐
│  Discord Bot    │────▶│  Cloudflare Worker + D1  │◀────│    Web App      │
│  (PebbleHost)   │     │  (Central Preset API)    │     │ (CF Pages)      │
│                 │     │                          │     │                 │
│ /submit-palette │     │  GET  /presets           │     │ Read presets    │
│ /vote-palette   │     │  POST /presets           │     │ Display votes   │
│ /moderate       │     │  POST /presets/:id/vote  │     │ Local fallback  │
└─────────────────┘     └──────────────────────────┘     └─────────────────┘
        │                         │
        │                         ▼
        │               ┌──────────────────┐
        └──────────────▶│   D1 Database    │
                        │  (SQLite)        │
                        │                  │
                        │ • presets        │
                        │ • votes          │
                        │ • categories     │
                        │ • moderation_log │
                        └──────────────────┘
```

### Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Central Storage | Cloudflare D1 | Web app on CF Pages, free tier sufficient, global edge |
| Submission Interface | Discord Bot | Discord handles authentication, no login needed |
| Web App Access | Read-only | Simpler security model, bot is trusted gateway |
| Duplicate Detection | Dye signature hash | O(1) lookup, automatic voting on duplicates |
| Moderation | Hybrid auto/manual | Fast publishing with safety net |

---

## Data Model

### Database Schema (D1/SQLite)

```sql
-- ============================================
-- PRESETS TABLE
-- Stores both curated and community palettes
-- ============================================
CREATE TABLE presets (
  id TEXT PRIMARY KEY,                    -- UUID v4
  name TEXT NOT NULL,                     -- 2-50 characters
  description TEXT NOT NULL,              -- 10-200 characters
  category_id TEXT NOT NULL,              -- FK to categories
  dyes TEXT NOT NULL,                     -- JSON array: [5738, 13115, 13117]
  tags TEXT NOT NULL,                     -- JSON array: ["dark", "gothic"]
  author_discord_id TEXT,                 -- Discord user ID (NULL for curated)
  author_name TEXT,                       -- Display name at submission time
  vote_count INTEGER DEFAULT 0,           -- Denormalized for fast sorting
  status TEXT DEFAULT 'pending',          -- pending | approved | rejected | flagged
  is_curated BOOLEAN DEFAULT FALSE,       -- TRUE for official presets
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  -- Generated column for duplicate detection
  -- Sorts dye IDs to ensure [1,2,3] matches [3,1,2]
  dye_signature TEXT GENERATED ALWAYS AS (
    (SELECT json_group_array(value) FROM (
      SELECT value FROM json_each(dyes) ORDER BY CAST(value AS INTEGER)
    ))
  ) STORED
);

-- Indexes for common query patterns
CREATE INDEX idx_presets_category ON presets(category_id);
CREATE INDEX idx_presets_status ON presets(status);
CREATE INDEX idx_presets_vote_count ON presets(vote_count DESC);
CREATE INDEX idx_presets_dye_signature ON presets(dye_signature);
CREATE INDEX idx_presets_author ON presets(author_discord_id);
CREATE INDEX idx_presets_created ON presets(created_at DESC);

-- ============================================
-- VOTES TABLE
-- One vote per user per preset (composite PK)
-- ============================================
CREATE TABLE votes (
  preset_id TEXT NOT NULL,
  user_discord_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (preset_id, user_discord_id),
  FOREIGN KEY (preset_id) REFERENCES presets(id) ON DELETE CASCADE
);

-- ============================================
-- CATEGORIES TABLE
-- Preset categories with metadata
-- ============================================
CREATE TABLE categories (
  id TEXT PRIMARY KEY,                    -- e.g., 'jobs', 'community'
  name TEXT NOT NULL,                     -- Display name
  description TEXT NOT NULL,
  icon TEXT,                              -- Emoji
  is_curated BOOLEAN DEFAULT FALSE,       -- TRUE = official category
  display_order INTEGER DEFAULT 0
);

-- Seed initial categories
INSERT INTO categories (id, name, description, icon, is_curated, display_order) VALUES
  ('jobs', 'FFXIV Jobs', 'Color schemes inspired by job identities', '⚔️', TRUE, 1),
  ('grand-companies', 'Grand Companies', 'Official Grand Company colors', '🏛️', TRUE, 2),
  ('seasons', 'Seasons', 'Seasonal color palettes', '🌸', TRUE, 3),
  ('events', 'FFXIV Events', 'Colors for in-game seasonal events', '🎉', TRUE, 4),
  ('aesthetics', 'Aesthetics', 'General aesthetic themes', '✨', TRUE, 5),
  ('community', 'Community', 'Community-submitted palettes', '👥', FALSE, 6);

-- ============================================
-- MODERATION LOG TABLE
-- Audit trail for moderation actions
-- ============================================
CREATE TABLE moderation_log (
  id TEXT PRIMARY KEY,                    -- UUID v4
  preset_id TEXT NOT NULL,
  moderator_discord_id TEXT NOT NULL,
  action TEXT NOT NULL,                   -- approve | reject | flag | unflag
  reason TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (preset_id) REFERENCES presets(id) ON DELETE CASCADE
);
```

### TypeScript Types

```typescript
// ============================================
// SHARED TYPES (xivdyetools-core)
// ============================================

export type PresetStatus = 'pending' | 'approved' | 'rejected' | 'flagged';

export interface CommunityPreset {
  id: string;
  name: string;
  description: string;
  category_id: PresetCategory;
  dyes: number[];                    // Dye item IDs
  tags: string[];
  author_discord_id: string | null;  // NULL for curated
  author_name: string | null;
  vote_count: number;
  status: PresetStatus;
  is_curated: boolean;
  created_at: string;                // ISO 8601
  updated_at: string;
}

export interface PresetSubmission {
  name: string;                      // 2-50 chars
  description: string;               // 10-200 chars
  category_id: PresetCategory;
  dyes: number[];                    // 2-5 dye IDs
  tags: string[];                    // 0-10 tags, max 30 chars each
  author_discord_id: string;
  author_name: string;
}

export interface PresetVote {
  preset_id: string;
  user_discord_id: string;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface PresetListResponse {
  presets: CommunityPreset[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

export interface PresetSubmitResponse {
  success: boolean;
  preset?: CommunityPreset;          // Created/existing preset
  duplicate?: CommunityPreset;       // If duplicate detected
  vote_added?: boolean;              // If vote was added to duplicate
  moderation_status?: 'approved' | 'pending';
}

export interface VoteResponse {
  success: boolean;
  new_vote_count: number;
  already_voted?: boolean;
}
```

---

## API Specification

### Base URL

```
Production: https://presets-api.xivdyetools.workers.dev
```

### Authentication

| Endpoint Type | Auth Method | Header |
|---------------|-------------|--------|
| Public (GET) | None | — |
| Bot (POST/PATCH/DELETE) | Bearer Token | `Authorization: Bearer <BOT_API_SECRET>` |
| Moderator | Bearer Token + User ID | `Authorization: Bearer <secret>` + `X-User-Discord-ID: <id>` |

### Endpoints

#### GET /api/v1/presets

List presets with filtering and pagination.

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `category` | string | — | Filter by category ID |
| `search` | string | — | Search name, description, tags |
| `status` | string | `approved` | Filter by status |
| `sort` | string | `popular` | `popular` \| `recent` \| `name` |
| `page` | number | `1` | Page number |
| `limit` | number | `20` | Results per page (max 100) |
| `is_curated` | boolean | — | Filter curated/community |

**Response:**

```json
{
  "presets": [
    {
      "id": "a1b2c3d4-...",
      "name": "Crimson Elegance",
      "description": "A refined red and gold palette",
      "category_id": "aesthetics",
      "dyes": [40, 12, 1],
      "tags": ["red", "gold", "elegant"],
      "author_discord_id": "123456789",
      "author_name": "ExampleUser",
      "vote_count": 42,
      "status": "approved",
      "is_curated": false,
      "created_at": "2024-12-04T12:00:00Z",
      "updated_at": "2024-12-04T12:00:00Z"
    }
  ],
  "total": 156,
  "page": 1,
  "limit": 20,
  "has_more": true
}
```

---

#### GET /api/v1/presets/featured

Get top-voted presets for homepage display.

**Response:**

```json
{
  "presets": [ /* Top 10 by vote_count */ ]
}
```

---

#### GET /api/v1/presets/:id

Get a single preset by ID.

**Response:** Single `CommunityPreset` object or 404.

---

#### GET /api/v1/categories

List all categories with preset counts.

**Response:**

```json
{
  "categories": [
    {
      "id": "jobs",
      "name": "FFXIV Jobs",
      "description": "Color schemes inspired by job identities",
      "icon": "⚔️",
      "is_curated": true,
      "display_order": 1,
      "preset_count": 21
    }
  ]
}
```

---

#### POST /api/v1/presets

Submit a new preset. **Requires bot authentication.**

**Request Body:**

```json
{
  "name": "Crimson Elegance",
  "description": "A refined red and gold palette for formal occasions",
  "category_id": "aesthetics",
  "dyes": [40, 12, 1],
  "tags": ["red", "gold", "elegant"]
}
```

**Headers:**

```
Authorization: Bearer <BOT_API_SECRET>
X-User-Discord-ID: 123456789
X-User-Discord-Name: ExampleUser
```

**Response (New Preset):**

```json
{
  "success": true,
  "preset": { /* CommunityPreset */ },
  "moderation_status": "approved"
}
```

**Response (Duplicate Detected):**

```json
{
  "success": true,
  "duplicate": { /* Existing CommunityPreset */ },
  "vote_added": true
}
```

**Response (Flagged for Review):**

```json
{
  "success": true,
  "preset": { /* CommunityPreset with status: 'pending' */ },
  "moderation_status": "pending"
}
```

---

#### POST /api/v1/presets/:id/vote

Add a vote to a preset. **Requires bot authentication.**

**Headers:**

```
Authorization: Bearer <BOT_API_SECRET>
X-User-Discord-ID: 123456789
```

**Response:**

```json
{
  "success": true,
  "new_vote_count": 43
}
```

**Response (Already Voted):**

```json
{
  "success": false,
  "already_voted": true,
  "new_vote_count": 42
}
```

---

#### DELETE /api/v1/presets/:id/vote

Remove a vote from a preset. **Requires bot authentication.**

**Response:**

```json
{
  "success": true,
  "new_vote_count": 41
}
```

---

#### PATCH /api/v1/presets/:id/status

Moderate a preset. **Requires moderator authentication.**

**Request Body:**

```json
{
  "status": "approved",
  "reason": "Optional reason for audit log"
}
```

**Response:**

```json
{
  "success": true,
  "preset": { /* Updated CommunityPreset */ }
}
```

---

#### GET /api/v1/presets/pending

List presets pending moderation. **Requires moderator authentication.**

**Response:** Same as `/presets` but filtered to `status: 'pending'`.

---

## Submission & Moderation Flow

### Submission Flow

```
User runs /submit-palette
        │
        ▼
┌───────────────────┐
│  Validate Input   │
│  - Name length    │
│  - Description    │
│  - Dye count 2-5  │
│  - Valid dye IDs  │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Check Duplicate   │
│ (dye_signature)   │
└─────────┬─────────┘
          │
    ┌─────┴─────┐
    ▼           ▼
DUPLICATE    UNIQUE
    │           │
    ▼           ▼
Add vote    ┌───────────────────┐
to existing │  Profanity Check  │
            │  (name + desc)    │
            └─────────┬─────────┘
                      │
                ┌─────┴─────┐
                ▼           ▼
              PASS        FAIL
                │           │
                ▼           ▼
         status:       status:
         'approved'    'pending'
         (instant)     (manual review)
```

### Duplicate Detection

Duplicates are detected by comparing sorted dye ID arrays:

```typescript
// Example: These are considered duplicates
palette1.dyes = [40, 12, 1];     // Signature: "[1,12,40]"
palette2.dyes = [1, 40, 12];     // Signature: "[1,12,40]"

// The generated column handles this automatically:
// dye_signature = sorted JSON array
```

When a duplicate is detected:
1. Return the existing preset to the user
2. Automatically add their vote to it
3. Show message: "This palette already exists! Your vote has been added."

### Content Moderation

#### Multi-Language Profanity Filter

Since the app supports 6 languages (en, ja, de, fr, ko, zh), the profanity filter must handle multiple languages.

**Approach: Hybrid Local + Optional API**

```
User submits palette
        │
        ▼
┌───────────────────────┐
│  Detect Language      │
│  (from user locale    │
│   or content analysis)│
└─────────┬─────────────┘
          │
          ▼
┌───────────────────────┐
│  Local Word Filter    │  ← Fast, no API call
│  (per-language lists) │
└─────────┬─────────────┘
          │
    ┌─────┴─────┐
    ▼           ▼
  PASS        FAIL → Flag immediately
    │
    ▼
┌───────────────────────┐
│  Perspective API      │  ← Optional, ML-based
│  (if enabled)         │     Catches context/evasion
└─────────┬─────────────┘
          │
    ┌─────┴─────┐
    ▼           ▼
  PASS        FAIL → Flag for review
```

**Local Word Lists (Primary Filter):**

| Language | Source | Notes |
|----------|--------|-------|
| English (en) | `bad-words` npm + custom | Base package + gaming terms |
| Japanese (ja) | Custom list | Japanese slurs, 2ch/5ch terms |
| German (de) | Custom list | German profanity |
| French (fr) | Custom list | French profanity |
| Korean (ko) | Custom list | Korean profanity, gaming terms |
| Chinese (zh) | Custom list | Simplified Chinese profanity |

**Custom Word List Structure:**

```typescript
// xivdyetools-worker/src/data/profanity/index.ts

export const profanityLists: Record<SupportedLocale, string[]> = {
  en: [
    // bad-words package covers most English
    // Add gaming-specific terms
    'specific', 'gaming', 'slurs', '...'
  ],
  ja: [
    // Japanese profanity - katakana, hiragana, kanji variants
    'バカ', 'アホ', '死ね', '...'
  ],
  de: [
    // German profanity
    'scheiße', 'arschloch', '...'
  ],
  fr: [
    // French profanity
    'merde', 'putain', 'connard', '...'
  ],
  ko: [
    // Korean profanity
    '시발', '병신', '...'
  ],
  zh: [
    // Chinese profanity (simplified)
    '傻逼', '他妈的', '...'
  ],
};
```

**Perspective API (Optional Secondary Filter):**

Google's [Perspective API](https://perspectiveapi.com/) provides ML-based toxicity detection for 10+ languages with a generous free tier (1 QPS = ~2.6M requests/month).

```typescript
// xivdyetools-worker/src/services/moderation-service.ts

interface PerspectiveResult {
  attributeScores: {
    TOXICITY: { summaryScore: { value: number } };
    SEVERE_TOXICITY: { summaryScore: { value: number } };
    IDENTITY_ATTACK: { summaryScore: { value: number } };
  };
}

async function checkWithPerspective(
  text: string,
  language: string,
  env: Env
): Promise<{ passed: boolean; scores: Record<string, number> }> {
  if (!env.PERSPECTIVE_API_KEY) {
    return { passed: true, scores: {} }; // Skip if not configured
  }

  const response = await fetch(
    `https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=${env.PERSPECTIVE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        comment: { text },
        languages: [language],
        requestedAttributes: {
          TOXICITY: {},
          SEVERE_TOXICITY: {},
          IDENTITY_ATTACK: {},
        },
      }),
    }
  );

  const result: PerspectiveResult = await response.json();

  const scores = {
    toxicity: result.attributeScores.TOXICITY.summaryScore.value,
    severeToxicity: result.attributeScores.SEVERE_TOXICITY.summaryScore.value,
    identityAttack: result.attributeScores.IDENTITY_ATTACK.summaryScore.value,
  };

  // Flag if any score exceeds threshold
  const threshold = 0.7;
  const passed = Object.values(scores).every(score => score < threshold);

  return { passed, scores };
}
```

**Combined Moderation Function:**

```typescript
export async function moderateContent(
  name: string,
  description: string,
  locale: SupportedLocale,
  env: Env
): Promise<ModerationResult> {
  // 1. Local word filter (fast, always runs)
  const localResult = checkLocalFilter(name, description, locale);
  if (!localResult.passed) {
    return {
      passed: false,
      flaggedField: localResult.flaggedField,
      flaggedReason: 'Contains prohibited content',
      method: 'local',
    };
  }

  // 2. Perspective API (optional, catches evasion/context)
  if (env.PERSPECTIVE_API_KEY) {
    const perspectiveResult = await checkWithPerspective(
      `${name} ${description}`,
      locale,
      env
    );
    if (!perspectiveResult.passed) {
      return {
        passed: false,
        flaggedField: 'content',
        flaggedReason: `High toxicity score detected`,
        method: 'perspective',
        scores: perspectiveResult.scores,
      };
    }
  }

  return { passed: true, method: 'all' };
}
```

**Language Detection:**

The user's language can be determined from:
1. Discord locale (passed from bot via `interaction.locale`)
2. Content analysis fallback (e.g., `franc` npm package for language detection)

**Configuration:**

| Secret | Required | Description |
|--------|----------|-------------|
| `PERSPECTIVE_API_KEY` | No | Google Perspective API key (optional ML filter) |

**Cost Consideration:**

- **Local filter**: Free, instant
- **Perspective API**: Free tier = 1 query/second (~2.6M/month), far exceeds expected usage

**Auto-Approve Criteria:**
- Name passes local profanity filter (all languages)
- Description passes local profanity filter (all languages)
- Passes Perspective API check (if enabled)
- Valid dye IDs (exist in database)

**Manual Review Queue:**
- Flagged by local profanity filter
- Flagged by Perspective API (high toxicity score)
- Can be approved or rejected by moderators
- Rejection requires a reason

### Moderation Notifications

When a palette is flagged for review, the system sends Discord notifications to alert moderators.

**Notification Channels:**

| Method | Description | Configuration |
|--------|-------------|---------------|
| **Webhook** | Posts to a private moderation channel | `MODERATION_WEBHOOK_URL` secret |
| **Direct Message** | DMs the bot owner directly | `OWNER_DISCORD_ID` secret |

**Notification Flow:**

```
Palette flagged (status: 'pending')
        │
        ▼
┌───────────────────────────┐
│  Notify Moderators        │
│                           │
│  1. Post to mod channel   │
│  2. DM bot owner          │
└───────────────────────────┘
```

**Webhook Embed Format:**

```
┌─────────────────────────────────────────────────┐
│ ⚠️ Palette Pending Review                       │
├─────────────────────────────────────────────────┤
│                                                 │
│ Name:        "Suspicious Palette Name"          │
│ Submitted by: @username (123456789)             │
│ Category:    Community                          │
│ Flagged:     Name contains prohibited content   │
│                                                 │
│ Colors: Dalamud Red, Jet Black, Snow White      │
│                                                 │
│ [Approve] [Reject] [View Details]               │
│                                                 │
│ Use /moderate-palette approve <id> to approve   │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Implementation:**

> **Not shipped.** This notification path was never wired to a caller and was deleted from
> presets-api on 2026-09-01 (dead-code audit DEAD-009), together with its
> `MODERATION_WEBHOOK_URL` / `OWNER_DISCORD_ID` / `DISCORD_BOT_TOKEN` /
> `DISCORD_BOT_WEBHOOK_URL` variables. Moderation reaches Discord through the
> moderation-worker instead. The design below is kept as the record of what was specified;
> read it as history, not as a description of the running system.

```typescript
// Design sketch — no longer present in the codebase

interface ModerationAlert {
  presetId: string;
  presetName: string;
  description: string;
  dyes: number[];
  authorName: string;
  authorId: string;
  flagReason: string;
}

export async function notifyModerators(
  alert: ModerationAlert,
  env: Env
): Promise<void> {
  const embed = {
    title: '⚠️ Palette Pending Review',
    color: 0xFFA500, // Orange
    fields: [
      { name: 'Name', value: alert.presetName, inline: true },
      { name: 'Submitted by', value: `${alert.authorName}`, inline: true },
      { name: 'Flagged Reason', value: alert.flagReason, inline: false },
      { name: 'Preset ID', value: `\`${alert.presetId}\``, inline: false },
    ],
    footer: {
      text: 'Use /moderate-palette approve <id> or /moderate-palette reject <id> <reason>',
    },
    timestamp: new Date().toISOString(),
  };

  // 1. Post to moderation channel webhook
  if (env.MODERATION_WEBHOOK_URL) {
    await fetch(env.MODERATION_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });
  }

  // 2. DM the bot owner via Discord Bot API
  if (env.OWNER_DISCORD_ID && env.DISCORD_BOT_TOKEN) {
    // Create DM channel
    const dmChannel = await fetch(
      `https://discord.com/api/v10/users/@me/channels`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ recipient_id: env.OWNER_DISCORD_ID }),
      }
    ).then(r => r.json());

    // Send DM
    await fetch(
      `https://discord.com/api/v10/channels/${dmChannel.id}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ embeds: [embed] }),
      }
    );
  }
}
```

**Environment Variables:**

```bash
# Cloudflare Worker secrets
MODERATION_WEBHOOK_URL=https://discord.com/api/webhooks/xxx/yyy
OWNER_DISCORD_ID=123456789012345678
DISCORD_BOT_TOKEN=xxx  # Same token as Discord bot (for DMs)
```

**Creating the Webhook:**

1. In Discord, go to your private moderation channel
2. Edit Channel → Integrations → Webhooks → New Webhook
3. Name it "XIV Dye Tools Moderation"
4. Copy the webhook URL
5. Add to Cloudflare Worker secrets: `wrangler secret put MODERATION_WEBHOOK_URL`

---

## Discord Bot Commands

### /submit-palette

Submit a new palette to the community collection.

**Options:**

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `name` | string | Yes | Palette name (2-50 chars) |
| `description` | string | Yes | Brief description (10-200 chars) |
| `category` | choice | Yes | aesthetics, jobs, seasons, events, community |
| `dye1` | autocomplete | Yes | First dye |
| `dye2` | autocomplete | Yes | Second dye |
| `dye3` | autocomplete | No | Third dye |
| `dye4` | autocomplete | No | Fourth dye |
| `dye5` | autocomplete | No | Fifth dye |
| `tags` | string | No | Comma-separated tags |

**Example Response (Success):**

```
✅ Palette Submitted!

Your palette "Crimson Elegance" has been published!

🎨 Colors:
• Dalamud Red
• Metallic Gold
• Snow White

👥 Category: Aesthetics
🏷️ Tags: red, gold, elegant

Others can now find and vote for your palette!
```

**Example Response (Duplicate):**

```
⚠️ Similar Palette Exists!

A palette with the same dyes already exists:
**"Royal Crimson"** by @OtherUser (42 votes)

✅ Your vote has been added to support this palette!
```

**Example Response (Pending Review):**

```
⏳ Palette Pending Review

Your palette "My Palette" has been submitted but requires
moderator approval before it becomes visible.

This usually takes less than 24 hours.
```

---

### /vote-palette

Vote for a community palette.

**Options:**

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `palette` | autocomplete | Yes | Search and select a palette |

**Example Response:**

```
✅ Vote Recorded!

You voted for "Crimson Elegance" by @ExampleUser

This palette now has 43 votes!
```

---

### /browse-palettes

Browse community palettes.

**Options:**

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `category` | choice | No | Filter by category |
| `sort` | choice | No | popular, recent, name |

**Example Response:**

```
🎨 Community Palettes - Aesthetics

1. ⭐ Crimson Elegance (43 votes) - by @ExampleUser
2. ⭐ Ocean Sunset (38 votes) - by @OtherUser
3. ⭐ Forest Twilight (31 votes) - by @AnotherUser
...

Use /vote-palette to support your favorites!
```

---

### /moderate-palette (Moderators Only)

Moderate pending submissions.

**Subcommands:**

| Subcommand | Description |
|------------|-------------|
| `pending` | List all pending submissions |
| `approve <id>` | Approve a pending palette |
| `reject <id> <reason>` | Reject with reason |
| `flag <id> <reason>` | Flag an approved palette for review |

---

## Web App Integration

### UI Changes to Preset Browser

```
┌─────────────────────────────────────────────────────────┐
│  Preset Palettes                               [Search] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ⭐ Featured Palettes                                   │
│  ┌─────────────────┐  ┌─────────────────┐              │
│  │ [████████████]  │  │ [████████████]  │              │
│  │ Crimson Elegance│  │ Ocean Sunset    │              │
│  │ ⭐ 43 votes     │  │ ⭐ 38 votes     │              │
│  │ by @ExampleUser │  │ by @OtherUser   │              │
│  └─────────────────┘  └─────────────────┘              │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  Categories:                                            │
│  [⚔️ Jobs] [🏛️ Grand Companies] [🌸 Seasons]          │
│  [🎉 Events] [✨ Aesthetics] [👥 Community]             │
│                                                         │
│  Sort: [Popular ▼]  [Recent] [Name]                    │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  👥 Community                                           │
│  ┌─────────────────┐  ┌─────────────────┐              │
│  │ [████████████]  │  │ [████████████]  │              │
│  │ My Cool Palette │  │ Another Palette │              │
│  │ ⭐ 12 votes     │  │ ⭐ 8 votes      │              │
│  │ by @UserName    │  │ Official        │              │
│  │ [View]          │  │ [View]          │              │
│  └─────────────────┘  └─────────────────┘              │
│                                                         │
│  ────────────────────────────────────────────────────  │
│  💡 Want to submit your own palette?                   │
│     Use the /submit-palette command on Discord!        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Preset Card Changes

Add to each preset card:
- Vote count with star icon
- Author attribution (or "Official" for curated)
- Visual distinction between curated and community

### Hybrid Data Service

```typescript
// Fetches from API with local fallback
class HybridPresetService {
  async getPresets(options: PresetFilters): Promise<UnifiedPreset[]> {
    try {
      // Primary: Remote API
      return await communityPresetService.getPresets(options);
    } catch (error) {
      console.warn('API unavailable, using local fallback');
      // Fallback: Local presets.json (curated only)
      return localPresetService.getAllPresets();
    }
  }
}
```

---

## Migration Plan

### Phase 1: Migrate Existing Presets

All curated presets from `presets.json` will be migrated to D1 with:
- `is_curated: true`
- `status: 'approved'`
- `author_discord_id: null`
- `vote_count: 0`

### Migration Script

```typescript
// xivdyetools-worker/scripts/migrate-presets.ts
import presetData from '../../xivdyetools-core/src/data/presets.json';

async function migrate(db: D1Database) {
  // 1. Insert categories
  for (const [id, meta] of Object.entries(presetData.categories)) {
    await db.prepare(`
      INSERT INTO categories (id, name, description, icon, is_curated)
      VALUES (?, ?, ?, ?, TRUE)
    `).bind(id, meta.name, meta.description, meta.icon).run();
  }

  // 2. Insert presets
  for (const preset of presetData.palettes) {
    await db.prepare(`
      INSERT INTO presets (
        id, name, description, category_id, dyes, tags,
        status, is_curated, vote_count
      ) VALUES (?, ?, ?, ?, ?, ?, 'approved', TRUE, 0)
    `).bind(
      crypto.randomUUID(),
      preset.name,
      preset.description,
      preset.category,
      JSON.stringify(preset.dyes),
      JSON.stringify(preset.tags)
    ).run();
  }
}
```

### Backward Compatibility

- `presets.json` remains as fallback for web app if API is unavailable
- Core library `PresetService` unchanged (local-only)
- New `HybridPresetService` in web app handles API + fallback

---

## Security Considerations

### API Security

| Concern | Mitigation |
|---------|------------|
| Unauthorized submissions | Bot-only authentication via shared secret |
| Vote manipulation | One vote per Discord user per preset |
| Spam submissions | Rate limiting (10/hour per user) |
| SQL injection | D1 parameterized queries |
| Content abuse | Profanity filter + manual review queue |

### Rate Limits

| Action | Limit |
|--------|-------|
| Submit preset | 10 per hour per user |
| Vote | 50 per hour per user |
| List/Search | 100 per minute per IP |

### Secrets Management

```bash
# Cloudflare Worker secrets (set via wrangler)

# Required
wrangler secret put BOT_API_SECRET       # Shared secret for bot authentication

# Moderation
wrangler secret put MODERATOR_IDS        # Comma-separated Discord IDs who can moderate

# Notifications (optional but recommended)
wrangler secret put MODERATION_WEBHOOK_URL   # Discord webhook for mod channel
wrangler secret put OWNER_DISCORD_ID         # Your Discord ID for DM notifications
wrangler secret put DISCORD_BOT_TOKEN        # Bot token (for sending DMs)

# Multi-language moderation (optional)
wrangler secret put PERSPECTIVE_API_KEY      # Google Perspective API (ML toxicity detection)
```

---

## Cost Analysis

### Cloudflare Free Tier

| Resource | Free Limit | Expected Usage | Status |
|----------|------------|----------------|--------|
| Workers requests | 100,000/day | ~1,000/day | ✅ |
| D1 reads | 5,000,000/day | ~10,000/day | ✅ |
| D1 writes | 100,000/day | ~100/day | ✅ |
| D1 storage | 5 GB | <100 MB | ✅ |

**Verdict:** Comfortably within free tier for projected usage.

---

## Implementation Phases

### Phase 1: Infrastructure (Week 1) ✅ COMPLETE
- [x] Create `xivdyetools-worker` project
- [x] Set up D1 database with schema
- [x] Implement basic CRUD endpoints
- [x] Deploy to Cloudflare
- [x] Run migration script for existing presets

### Phase 2: Discord Bot Integration (Week 2) ✅ COMPLETE
- [x] Create `preset-api-service.ts`
- [x] Implement `/preset submit` subcommand
- [x] Implement `/preset vote` subcommand
- [x] Implement `/preset list` with community presets
- [x] Add autocomplete for dye selection (5 slots)
- [x] Update config and environment

### Phase 3: Web App Integration (Week 3) ✅ COMPLETE
- [x] Create `community-preset-service.ts`
- [x] Create `hybrid-preset-service.ts`
- [x] Update preset browser UI
- [x] Add vote count display
- [x] Add author attribution
- [x] Add sort options (Name | Popular | Recent)
- [x] Add featured section

### Phase 4: Moderation & Polish (Week 4) ✅ COMPLETE
- [x] Implement profanity filter (6 languages: en, ja, de, fr, ko, zh)
- [x] Integrate Google Perspective API (optional ML toxicity detection)
- [x] Create `/preset moderate` subcommand (pending/approve/reject/stats)
- [x] Add moderation logging (moderation_log table + audit trail)
- [x] Add webhook notifications to moderation channel
- [x] Add DM notifications to bot owner
- [ ] End-to-end testing across all platforms
- [x] Documentation updates (this file)

---

## File Changes Summary

### New Files

| Path | Purpose |
|------|---------|
| `xivdyetools-worker/` | New Cloudflare Worker project |
| `xivdyetools-worker/wrangler.toml` | Worker configuration |
| `xivdyetools-worker/schema.sql` | D1 database schema |
| `xivdyetools-worker/src/index.ts` | Worker entry point |
| `xivdyetools-worker/src/handlers/*.ts` | API handlers |
| `xivdyetools-worker/src/middleware/*.ts` | Auth, CORS, rate limiting |
| `xivdyetools-worker/src/services/preset-service.ts` | Preset CRUD logic |
| `xivdyetools-worker/src/services/moderation-service.ts` | Multi-language profanity filter |
| `xivdyetools-worker/src/services/notification-service.ts` | Discord webhook & DM alerts |
| `xivdyetools-worker/src/data/profanity/index.ts` | Per-language profanity word lists |
| `xivdyetools-discord-bot/src/commands/submit-palette.ts` | Submit command |
| `xivdyetools-discord-bot/src/commands/vote-palette.ts` | Vote command |
| `xivdyetools-discord-bot/src/commands/browse-palettes.ts` | Browse command |
| `xivdyetools-discord-bot/src/commands/moderate-palette.ts` | Moderation |
| `xivdyetools-discord-bot/src/services/preset-api-service.ts` | API client |
| `xivdyetools-web-app/src/services/community-preset-service.ts` | API client |
| `xivdyetools-web-app/src/services/hybrid-preset-service.ts` | Data layer |

### Modified Files

| Path | Changes |
|------|---------|
| `xivdyetools-discord-bot/src/config.ts` | Add API config |
| `xivdyetools-discord-bot/src/index.ts` | Register commands |
| `xivdyetools-discord-bot/.env` | Add new env vars |
| `xivdyetools-web-app/src/components/preset-browser-tool.ts` | UI updates |
| `xivdyetools-core/src/types/index.ts` | Add community types |

---

## Future Enhancements

### Post-MVP Features

- **Web App Submissions** - Add Discord OAuth to enable web-based submissions
- **Palette Collections** - Allow users to create curated lists of favorite community palettes
- **Weekly Featured** - Algorithmically highlight rising palettes
- **Seasonal Promotions** - Boost visibility of event-themed palettes during events
- **Creator Profiles** - Public pages showing a user's submitted palettes
- **Palette Remixing** - "Fork" an existing palette as starting point

### Analytics (Future)

- Track most viewed palettes
- Track palette usage in other tools (Harmony Explorer, etc.)
- Surface trending palettes
