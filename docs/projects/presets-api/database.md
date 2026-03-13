# Presets API — Database Schema

> Version 1.4.15

## Overview

The Presets API uses **Cloudflare D1**, a SQLite-based serverless database. All timestamps are stored as ISO 8601 strings in UTC.

---

## Tables

There are 6 tables in the schema.

### categories

Preset categories with display ordering.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT |
| name | TEXT | NOT NULL, UNIQUE |
| display_name | TEXT | NOT NULL |
| description | TEXT | |
| sort_order | INTEGER | DEFAULT 0 |

### presets

Core table storing community dye presets.

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT | PRIMARY KEY (UUID) |
| name | TEXT | NOT NULL, 2-50 chars |
| description | TEXT | NOT NULL, 10-200 chars |
| dyes | TEXT | JSON array of dye IDs (2-5) |
| dye_signature | TEXT | UNIQUE, sorted JSON for duplicate detection |
| tags | TEXT | JSON array of strings (max 10, each max 30 chars) |
| category_id | INTEGER | REFERENCES categories(id) |
| author_discord_id | TEXT | NOT NULL |
| author_name | TEXT | NOT NULL (trimmed) |
| status | TEXT | DEFAULT 'pending' -- pending / approved / rejected / flagged / hidden |
| vote_count | INTEGER | DEFAULT 0 (denormalized) |
| source | TEXT | DEFAULT 'web' -- 'web' or 'bot' |
| previous_values | TEXT | JSON, populated when edit is flagged |
| created_at | TEXT | ISO timestamp |
| updated_at | TEXT | ISO timestamp |

### votes

One vote per user per preset. Used alongside the denormalized `vote_count` on `presets`.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT |
| preset_id | TEXT | REFERENCES presets(id) |
| user_discord_id | TEXT | NOT NULL |
| created_at | TEXT | ISO timestamp |
| | | UNIQUE(preset_id, user_discord_id) |

### moderation_log

Append-only log of all moderation actions taken on presets.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT |
| preset_id | TEXT | REFERENCES presets(id) |
| moderator_id | TEXT | NOT NULL |
| action | TEXT | NOT NULL (approve / reject / flag / hide / revert) |
| reason | TEXT | 10-200 chars |
| previous_status | TEXT | |
| new_status | TEXT | |
| created_at | TEXT | ISO timestamp |

### rate_limits

Per-user daily action counters for submission throttling.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT |
| user_discord_id | TEXT | NOT NULL |
| action | TEXT | NOT NULL (e.g., 'submission') |
| count | INTEGER | DEFAULT 0 |
| window_start | TEXT | ISO timestamp (UTC day start) |
| | | UNIQUE(user_discord_id, action) |

### banned_users

Users banned from the presets system.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT |
| discord_id | TEXT | NOT NULL, UNIQUE |
| reason | TEXT | |
| banned_by | TEXT | Moderator discord ID |
| banned_at | TEXT | ISO timestamp |
| unbanned_at | TEXT | NULL if still banned |

---

## Indexes

### Composite Indexes (from migration 002)

| Index | Columns | Purpose |
|-------|---------|---------|
| `idx_presets_status_category` | (status, category_id) | Filtered listing queries |
| `idx_presets_status_votes` | (status, vote_count DESC) | Popular sorting |
| `idx_presets_status_created` | (status, created_at DESC) | Recent sorting |
| `idx_presets_author` | (author_discord_id) | `/mine` queries |
| `idx_votes_preset` | (preset_id) | Vote counting |
| `idx_votes_user` | (user_discord_id) | User's voted presets |
| `idx_moderation_preset` | (preset_id) | Moderation history queries |

---

## Migrations

| Migration | Description |
|-----------|-------------|
| `0002_add_previous_values.sql` | Added `previous_values` column for edit audit trail |
| `0003_add_banned_users.sql` | Added `banned_users` table |
| `0004_unique_dye_signature.sql` | Added UNIQUE constraint on `dye_signature` for duplicate prevention |
| `002_add_composite_indexes.sql` | Performance indexes for common query patterns |

---

## Key Design Decisions

1. **Dye Signature** -- `JSON.stringify(sorted dyes)` produces a deterministic string used as a UNIQUE constraint. This catches duplicate presets at the DB level even if the application-layer check encounters a race condition (PRESETS-CRITICAL-001).

2. **Vote Count Denormalization** -- The `vote_count` column on the `presets` table avoids running `COUNT(*)` on every list query. It is incremented atomically alongside the vote insert using D1's `batch()`.

3. **Previous Values** -- Append-only audit trail. Only populated when an edit is flagged by the moderation system. Never cleared on successful moderation to preserve history (PRESETS-CRITICAL-004).

4. **Soft Deletes** -- Status `hidden` is used instead of `DELETE` to maintain moderation auditability. Hidden presets are excluded from public queries but remain in the database.

5. **Rate Limits in DB** -- Daily submission limits are stored in the `rate_limits` table with a UTC day window rather than in KV, because atomic increment semantics are required.

---

## Commands

```bash
pnpm --filter xivdyetools-presets-api run db:migrate           # Production
pnpm --filter xivdyetools-presets-api run db:migrate:local     # Local dev
pnpm --filter xivdyetools-presets-api run db:migrate:indexes   # Add indexes
pnpm --filter xivdyetools-presets-api run db:seed              # Seed curated presets
```

---

## Related Documentation

- [Overview](overview.md) -- Architecture and project overview
- [Endpoints](endpoints.md) -- REST API routes and request/response schemas
- [Moderation](moderation.md) -- Moderation workflow and actions
- [Rate Limiting](rate-limiting.md) -- Rate limit rules and configuration
