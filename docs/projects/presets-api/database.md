# Presets API — Database Schema

## Overview

The Presets API uses **Cloudflare D1**, a SQLite-based serverless database. All timestamps are stored as ISO 8601 strings in UTC.

---

## Tables

There are 7 live tables in the schema: `categories`, `presets`, `votes`, `moderation_log`, `banned_users`, `failed_notifications` (migration 0005) and `submission_events` (migrations 0011 / 0012). `rate_limits` was dropped in 0006 and only a comment marks where it used to be.

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
| dyes | TEXT | JSON array of **stainIDs** (3-6, range 1-254; rewritten from legacy itemIDs by the one-off 5.0 migration that ran 2026-08-28; its generator has since been removed, see `migrations/0007`) |
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

One vote per user per preset. There is no surrogate key and no vote *direction* — a row's existence
**is** the (up)vote, and there are no downvotes anywhere in the system. Used alongside the
denormalized `vote_count` on `presets`.

| Column | Type | Notes |
|--------|------|-------|
| preset_id | TEXT | NOT NULL, REFERENCES presets(id) ON DELETE CASCADE |
| user_discord_id | TEXT | NOT NULL |
| created_at | TEXT | DEFAULT `(datetime('now'))` |
| | | PRIMARY KEY (preset_id, user_discord_id) |

Insertion is `INSERT … ON CONFLICT DO NOTHING` batched with the `vote_count` increment, so two
concurrent votes can never both succeed. The composite primary key is the only index on
`preset_id`; `idx_votes_user(user_discord_id)` covers "everything this user voted for".

### moderation_log

Append-only audit trail of moderation actions. presets-api writes the preset-level ones; `xivdyetools-moderation-worker` writes the ban-related ones directly on this shared database (see [moderation.md](moderation.md)).

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT | PRIMARY KEY — UUID v4 |
| preset_id | TEXT | REFERENCES presets(id) ON DELETE CASCADE. **Nullable since migration 0013** — NULL for the user-level actions `ban` / `unban` |
| moderator_discord_id | TEXT | NOT NULL |
| action | TEXT | NOT NULL — `approve` \| `reject` \| `flag` \| `unflag` \| `requeue` \| `revert` (presets-api) and `ban` \| `unban` \| `hide` \| `restore` (moderation-worker). `requeue` is what a moderator's move **back to `pending`** records (`getActionFromStatusChange`) |
| reason | TEXT | Optional; NULL on `unban` / `restore` (the unban command takes no reason) |
| target_discord_id | TEXT | **Added by migration 0013** — the moderated user; set for `ban` / `unban` / `hide` / `restore`, NULL otherwise |
| created_at | TEXT | DEFAULT `(datetime('now'))`, but every writer binds an ISO-8601 `…T…Z` string (BUG-050) |

Indexes: `idx_moderation_log_preset(preset_id)`, `idx_moderation_log_moderator(moderator_discord_id)`, `idx_moderation_log_created(created_at DESC)`.

Nothing enforces the `action` vocabulary in SQL (no CHECK constraint), and `GET /api/v1/moderation/:presetId/history` returns rows as stored — a `hide` / `restore` row therefore shows up in a preset's history, and `/moderation/stats` counts every row in its 7-day `actions_last_week` figure.

### submission_events

Append-only per-user log of quota-bearing mutations (migration `0011`; migration `0012` rebuilt the
table to widen the `kind` CHECK constraint with `text_edit`). User actions never delete rows here,
which is the whole point: the daily caps cannot be reset by deleting one's own presets
(FINDING-008).

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT |
| user_discord_id | TEXT | NOT NULL |
| kind | TEXT | NOT NULL, `CHECK (kind IN ('submission', 'flagged_edit', 'preview_upload', 'text_edit'))` |
| preset_id | TEXT | Nullable — the preset the event was charged to, when there is one |
| created_at | TEXT | NOT NULL DEFAULT `(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))` |

Indexes: `idx_submission_events_user_kind_created(user_discord_id, kind, created_at)` serves the
"this user, this kind, since UTC midnight" count; `idx_submission_events_created(created_at)` exists
solely for the age-based prune (FINDING-017), which matches on `created_at` alone and would
otherwise be a full scan on every quota write.

Caps and how they are counted are in [rate-limiting.md](rate-limiting.md).

### rate_limits *(dropped by migration 0006)*

Was: per-user daily action counters for submission throttling. It was never read or written by any
code path (REFACTOR-018), so `0006` dropped both the table and its index. `schema.sql` carries only
a comment where it stood — a fresh local database does **not** create it.

### banned_users

Users banned from the presets system (migration 0003). Written by `xivdyetools-moderation-worker`; presets-api only reads it (`middleware/ban-check.ts`, `middleware/auth.ts`).

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT | PRIMARY KEY — UUID v4 |
| discord_id | TEXT | Discord snowflake, nullable |
| xivauth_id | TEXT | XIVAuth UUID, nullable |
| username | TEXT | NOT NULL — display name at the time of the ban |
| moderator_discord_id | TEXT | NOT NULL — moderator who issued the ban |
| reason | TEXT | NOT NULL (10-500 chars) |
| banned_at | TEXT | DEFAULT `(datetime('now'))` |
| unbanned_at | TEXT | NULL while the ban is active |
| unban_moderator_discord_id | TEXT | Moderator who lifted the ban |
| | | CHECK (discord_id IS NOT NULL OR xivauth_id IS NOT NULL) |

An unban closes the row (`unbanned_at`) rather than deleting it, and two **partial unique** indexes — `idx_banned_users_discord_active` on `discord_id` and `idx_banned_users_xivauth_active` on `xivauth_id`, both `WHERE … IS NOT NULL AND unbanned_at IS NULL` — allow only one *active* ban per identity while keeping the history. Also `idx_banned_users_active(banned_at DESC) WHERE unbanned_at IS NULL` and `idx_banned_users_moderator(moderator_discord_id)`.

---

## Indexes

### Composite indexes on `presets` (`migrations/002_add_composite_indexes.sql`, also in `schema.sql`)

| Index | Columns | Purpose |
|-------|---------|---------|
| `idx_presets_status_category_vote` | (status, category_id, vote_count DESC) | `WHERE status = ? AND category_id = ? ORDER BY vote_count DESC` |
| `idx_presets_status_vote` | (status, vote_count DESC) | Popular feed |
| `idx_presets_status_created` | (status, created_at DESC) | Recent feed |
| `idx_presets_author_created` | (author_discord_id, created_at DESC) | `/presets/mine` |
| `idx_presets_name` | (name) | Name lookups / search |

### Other indexes on `presets` (`schema.sql`)

Single-column: `idx_presets_category(category_id)`, `idx_presets_status(status)`,
`idx_presets_vote_count(vote_count DESC)`, `idx_presets_author(author_discord_id)`,
`idx_presets_created(created_at DESC)`, `idx_presets_curated(is_curated)`.

`idx_presets_dye_signature` is a **partial UNIQUE** index on `(dye_signature)`
`WHERE status IN ('approved', 'pending')` — migration `0006` re-created it that way (BUG-003) so a
rejected or hidden preset's dye combination stops blocking resubmission.

### Indexes on the other tables

| Index | Table / columns | Purpose |
|-------|-----------------|---------|
| `idx_votes_user` | `votes(user_discord_id)` | A user's voted presets (the composite PK covers `preset_id`) |
| `idx_moderation_log_preset` | `moderation_log(preset_id)` | `GET /moderation/:id/history` |
| `idx_moderation_log_moderator` | `moderation_log(moderator_discord_id)` | Actions by moderator |
| `idx_moderation_log_created` | `moderation_log(created_at DESC)` | `/moderation/stats` 7-day window |
| `idx_banned_users_discord_active` | `banned_users(discord_id)` partial UNIQUE | One active Discord ban per identity |
| `idx_banned_users_xivauth_active` | `banned_users(xivauth_id)` partial UNIQUE | One active XIVAuth ban per identity |
| `idx_banned_users_active` | `banned_users(banned_at DESC)` partial | Active-ban listing |
| `idx_banned_users_moderator` | `banned_users(moderator_discord_id)` | Bans by moderator |
| `idx_failed_notifications_unresolved` | `failed_notifications(resolved_at)` partial | Dead-letter queue |
| `idx_submission_events_user_kind_created` | `submission_events(user_discord_id, kind, created_at)` | Daily quota counts |
| `idx_submission_events_created` | `submission_events(created_at)` | The age-based prune |

---

## Migrations

| Migration | Description |
|-----------|-------------|
| `0002_add_previous_values.sql` | Added `previous_values` column for edit audit trail |
| `0003_add_banned_users.sql` | Added `banned_users` table |
| `0004_unique_dye_signature.sql` | Added UNIQUE constraint on `dye_signature` for duplicate prevention |
| `0005_failed_notifications.sql` | Dead-letter table for failed Discord notifications |
| `0006_partial_dye_signature_drop_rate_limits.sql` | Partial unique `dye_signature` index (0004's had never landed as UNIQUE); drops the `rate_limits` table |
| `0007_drop_community_category.sql` | 5.0 — retires the `community` category (rows → `aesthetics`; production matched zero). Part 2, the legacy-itemID → stainID rewrite of `presets.dyes` / `dye_signature` / `previous_values`, ran 2026-08-28 in the same window as the 5.0 worker deploys; its generator (`scripts/migrate-dyes-to-stainids.ts`) was removed on 2026-09-01 and lives only in git history — see the header of `0007` before replaying this file anywhere |
| `0008_add_example_link.sql` | `example_link` column |
| `0009_add_preview_image.sql` | `preview_image_key` / `preview_image_status` columns |
| `0010_add_secondary_categories.sql` | `secondary_categories` column |
| `0011_submission_events.sql` | `submission_events` append-only per-user quota log (FINDING-008) |
| `0012_submission_events_text_edit.sql` | Rebuilds `submission_events` to allow the `text_edit` kind in its CHECK constraint, and adds `idx_submission_events_created` (FINDING-005) |
| `0013_moderation_log_user_actions.sql` | Rebuilds `moderation_log` to make `preset_id` nullable and add `target_discord_id`, so moderation-worker's `ban` / `unban` / `hide` / `restore` rows can land here (FINDING-018) |
| `002_add_composite_indexes.sql` | Performance indexes for common query patterns (the odd name is historical — it predates the four-digit series and is the only file `db:migrate:indexes` applies) |

`0012` and `0013` each **rebuild** a table (SQLite cannot alter a CHECK or a NOT NULL constraint in
place); both file headers carry the row-count verification steps and the recovery path, and D1
rejects explicit `BEGIN TRANSACTION`, so neither file contains one.

---

## Key Design Decisions

1. **Dye Signature** -- `JSON.stringify(sorted dyes)` produces a deterministic string used as a UNIQUE constraint. This catches duplicate presets at the DB level even if the application-layer check encounters a race condition (PRESETS-CRITICAL-001).

2. **Vote Count Denormalization** -- The `vote_count` column on the `presets` table avoids running `COUNT(*)` on every list query. It is incremented atomically alongside the vote insert using D1's `batch()`.

3. **Previous Values** -- **Write-once**, not append-only: the snapshot is taken only when an edit is flagged *and* no snapshot exists yet (BUG-052), so successive flagged edits cannot overwrite the oldest known-good state. A successful moderation pass never clears it (PRESETS-CRITICAL-004); the only thing that does is a moderator's `PATCH /moderation/:id/revert`, which restores the fields and sets the column back to `NULL`.

4. **Soft Deletes** -- Status `hidden` is used instead of `DELETE` to maintain moderation auditability. Hidden presets are excluded from public queries but remain in the database.

5. **Quotas in DB, not KV** -- The daily caps are counted in D1 rather than KV so the count is transactional with the write. The submission cap is enforced on `getEffectiveSubmissionCountToday()` = `max(presets rows created by the user today, 'submission' rows in submission_events today)`; the other three kinds count `submission_events` alone. The old `rate_limits` table was dropped in migration 0006 and was never read or written.

---

## Commands

```bash
pnpm --filter xivdyetools-presets-api run db:migrate           # schema.sql against the REMOTE D1
pnpm --filter xivdyetools-presets-api run db:migrate:local     # schema.sql against the local D1
pnpm --filter xivdyetools-presets-api run db:migrate:indexes   # 002_add_composite_indexes.sql
pnpm --filter xivdyetools-presets-api run db:seed              # PRINTS seed SQL to stdout — applies nothing
```

`schema.sql` is all `CREATE TABLE IF NOT EXISTS`, so `db:migrate` **cannot alter a live schema**:
on an existing database every statement is skipped and the script exits successfully having changed
nothing. Everything under `migrations/` is applied by hand:

```bash
wrangler d1 execute xivdyetools-presets --remote --file=./migrations/<name>.sql
```

`db:seed` runs `scripts/migrate-presets.ts`, which only *emits* SQL — redirect it to a file and
apply that file with `wrangler d1 execute` if you actually want the curated rows.

---

## Related Documentation

- [Overview](overview.md) -- Architecture and project overview
- [Endpoints](endpoints.md) -- REST API routes and request/response schemas
- [Moderation](moderation.md) -- Moderation workflow and actions
- [Rate Limiting](rate-limiting.md) -- Rate limit rules and configuration
