# Presets API — Database Schema

> Version 2.0.0

## Overview

The Presets API uses **Cloudflare D1**, a SQLite-based serverless database. All timestamps are stored as ISO 8601 strings in UTC.

---

## Tables

There are 6 live tables in the schema: `categories`, `presets`, `votes`, `moderation_log`, `banned_users`, `failed_notifications` (migration 0005; `rate_limits` was dropped in 0006).

### categories

Preset categories with display ordering.

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT | PRIMARY KEY — the slug (`jobs`, `grand-companies`, `seasons`, `events`, `aesthetics`, `appearance`, `zones`, `raids-trials`) |
| name | TEXT | NOT NULL, display name |
| description | TEXT | NOT NULL |
| icon | TEXT | Emoji |
| is_curated | INTEGER | DEFAULT 0 (1 = official category) |
| display_order | INTEGER | DEFAULT 0 |

`community` was deleted from this table by migration 0007 (5.0 — "community-ness is a source, not a category"; production matched zero rows). `getValidCategories` reads this table, so the row set *is* the valid-category list.

### presets

Core table storing community dye presets.

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT | PRIMARY KEY (UUID) |
| name | TEXT | NOT NULL, 2-50 chars |
| description | TEXT | NOT NULL, 10-200 chars |
| dyes | TEXT | JSON array of **stainIDs** (3-6, range 1-254; rewritten from legacy itemIDs by the 5.0 `scripts/migrate-dyes-to-stainids.ts` output) |
| dye_signature | TEXT | UNIQUE (partial), sorted JSON for duplicate detection |
| tags | TEXT | JSON array of strings (max 10, each max 30 chars) |
| category_id | TEXT | NOT NULL, REFERENCES categories(id) — the primary category |
| secondary_categories | TEXT | JSON array of up to two further category slugs, DEFAULT '[]' (migration 0010) |
| example_link | TEXT | Optional allowlisted page URL about the glamour (migration 0008) |
| preview_image_key | TEXT | R2 object key of the moderated preview thumbnail (migration 0009) |
| preview_image_status | TEXT | NOT NULL DEFAULT 'none' — none / pending / approved (a rejected image resets to none) (0009) |
| author_discord_id | TEXT | NULL for curated presets |
| author_name | TEXT | Display name at submission time |
| is_curated | INTEGER | DEFAULT 0 (1 = official preset) |
| status | TEXT | DEFAULT 'pending' -- pending / approved / rejected / flagged / hidden |
| vote_count | INTEGER | DEFAULT 0 (denormalized) |
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

### rate_limits *(dropped by migration 0006)*

Was: per-user daily action counters for submission throttling. It was never read or written by any code path (REFACTOR-018) — the 10-per-day submission cap is enforced by counting the user's `presets` rows created in the current UTC day (`getSubmissionCountToday`, re-checked after the INSERT).

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
| `0005_failed_notifications.sql` | Dead-letter table for failed Discord notifications |
| `0006_partial_dye_signature_drop_rate_limits.sql` | Partial unique `dye_signature` index (0004's had never landed as UNIQUE); drops the `rate_limits` table |
| `0007_drop_community_category.sql` | 5.0 — retires the `community` category (rows → `aesthetics`; production matched zero). Part 2, the legacy-itemID → stainID rewrite of `presets.dyes` / `dye_signature` / `previous_values`, is generated by `scripts/migrate-dyes-to-stainids.ts` and applied in the same window as the 5.0 worker deploys |
| `0008_add_example_link.sql` | `example_link` column |
| `0009_add_preview_image.sql` | `preview_image_key` / `preview_image_status` columns |
| `0010_add_secondary_categories.sql` | `secondary_categories` column |
| `002_add_composite_indexes.sql` | Performance indexes for common query patterns |

---

## Key Design Decisions

1. **Dye Signature** -- `JSON.stringify(sorted dyes)` produces a deterministic string used as a UNIQUE constraint. This catches duplicate presets at the DB level even if the application-layer check encounters a race condition (PRESETS-CRITICAL-001).

2. **Vote Count Denormalization** -- The `vote_count` column on the `presets` table avoids running `COUNT(*)` on every list query. It is incremented atomically alongside the vote insert using D1's `batch()`.

3. **Previous Values** -- Append-only audit trail. Only populated when an edit is flagged by the moderation system. Never cleared on successful moderation to preserve history (PRESETS-CRITICAL-004).

4. **Soft Deletes** -- Status `hidden` is used instead of `DELETE` to maintain moderation auditability. Hidden presets are excluded from public queries but remain in the database.

5. **Rate Limits in DB** -- The daily submission limit is derived from the `presets` table itself (rows by the user in the current UTC day) rather than KV, so the count is transactional with the insert; the separate `rate_limits` table was dropped in migration 0006.

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
