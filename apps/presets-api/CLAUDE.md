# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

REST API for Final Fantasy XIV community color palette presets. Serves the web app, the Discord bot, and the moderation bot from a single Cloudflare Worker. Persistence is Cloudflare D1 (SQLite); business logic uses Hono routers split by resource. Both bots authenticate via signed Bearer tokens (HMAC-SHA256 over a request fingerprint) and the web app authenticates via JWTs minted by the OAuth worker — both code paths converge on a single `AuthContext` populated by `authMiddleware`.

This is the only D1 owner for `xivdyetools-presets`; sibling workers (`discord-worker`, `moderation-worker`) read/write through Service Bindings rather than directly.

## Commands

```bash
npm run dev                  # wrangler dev (port 8787)
npm run deploy               # Deploy to the DEV worker (xivdyetools-presets-api-dev, no routes)
npm run deploy:production    # Deploy to production env
npm run test                 # vitest
npm run test:coverage        # Coverage via @vitest/coverage-v8
npm run type-check           # tsc --noEmit
npm run lint                 # eslint src/ + knip (lint:dead)

# Database
npm run db:migrate           # Apply schema.sql to remote D1 — CREATES ONLY, see below
npm run db:migrate:local     # Apply schema.sql to local .wrangler D1
npm run db:migrate:indexes   # Apply migrations/002_add_composite_indexes.sql
npm run db:seed              # tsx scripts/migrate-presets.ts — PRINTS seed SQL to stdout, applies nothing

# Files under migrations/ are NOT applied by any script — run them by hand:
npx wrangler d1 execute xivdyetools-presets --remote --file=./migrations/<name>.sql

# The 5.0 stainID data migration is DONE (ran 2026-08-28, re-verified 2026-09-01:
# 0 legacy itemIDs across all 16 rows). scripts/migrate-dyes-to-stainids.ts was
# removed with the client-side fallback it unblocked — recover it from git history
# if a comparable one-off is ever needed.
```

### Setting Secrets

```bash
wrangler secret put BOT_API_SECRET
wrangler secret put BOT_SIGNING_SECRET
wrangler secret put JWT_SECRET                 # Must match xivdyetools-oauth
wrangler secret put MODERATOR_IDS              # CSV of Discord user IDs
wrangler secret put PERSPECTIVE_API_KEY        # Optional: ML toxicity scoring
wrangler secret put INTERNAL_WEBHOOK_SECRET
wrangler secret put CACHE_PURGE_API_TOKEN --env production   # Optional (FINDING-018): token scoped to Zone → Cache Purge on xivdyetools.app; pairs with the CACHE_PURGE_ZONE_ID var in wrangler.toml
```

### Pre-commit Checklist

```bash
npm run lint && npm run test -- --run && npm run type-check
```

## Architecture

### Request Flow

```
Web/Bot ──HTTPS──► Hono app
                      │
                      ▼
            requestId + logger middleware
                      │
                      ▼
            validateEnv (EVERY request; only the errors log once per isolate)
                      │
                      ▼
            security headers + CORS (allowlisted origins + dev localhost)
                      │
                      ▼
            /api/* : publicRateLimitMiddleware (100/min/IP, skipped without CF-Connecting-IP)
            /api/* : bodySizeLimit (100KB)
            /api/* : jsonDepthLimit
                      │
                      ▼
                  authMiddleware  ──► c.set('auth', AuthContext)     ('*', not /api/*)
                      │
                      ▼
            /api/* : perUserRateLimitMiddleware (100/min per acting Discord user)
            /api/* : Content-Type assert (mutations)
                      │
                      ▼
            ┌─────────┴──────────┬───────────────┬──────────────┐
            ▼                    ▼               ▼              ▼
       presetsRouter     votesRouter    categoriesRouter   moderationRouter
            │                    │               │              │
            └─────── D1 (xivdyetools-presets) ───┴──────────────┘
            │
            ▼
       env.DISCORD_WORKER (Service Binding) for notification fan-out
```

### Key Directories

```
src/
├── index.ts                            # Hono app, CORS, middleware chain, route mounting
├── types.ts                            # Env interface + re-exports from @xivdyetools/types
├── middleware/
│   ├── auth.ts                         # Dual auth: BOT_API_SECRET (HMAC-signed) or JWT
│   ├── ban-check.ts                    # requireNotBanned (router-level on every mutating method; fails closed outside development)
│   ├── body-validation.ts              # bodySizeLimit (100KB), jsonDepthLimit
│   └── rate-limit.ts                   # IP rate limit (100/min) using shared rate-limiter package
├── handlers/
│   ├── presets.ts                      # GET / POST / PATCH presets, /mine, /featured, /rate-limit
│   ├── votes.ts                        # POST/DELETE votes (atomic INSERT … ON CONFLICT)
│   ├── categories.ts                   # Categories with denormalized counts
│   └── moderation.ts                   # Pending queue, status updates, revert, audit log
├── services/
│   ├── preset-service.ts               # D1 queries, dye_signature duplicate detection
│   ├── moderation-service.ts           # Local profanity + Perspective API pipeline
│   ├── validation-service.ts           # Centralized validators (name/description/dyes/tags/status/reason)
│   └── rate-limit-service.ts           # 10 submissions / user / day enforcement
├── data/profanity/                     # 6-language profanity word lists
├── utils/
│   ├── api-response.ts                 # ErrorCode enum + response helpers
│   └── env-validation.ts               # Env validation, run on EVERY request
└── (no entry-level scripts beyond `migrations/` and `scripts/migrate-presets.ts`)
```

### Environment Bindings (wrangler.toml)

| Binding | Type | Purpose |
|---------|------|---------|
| `DB` | D1 (`xivdyetools-presets`) | Authoritative store for presets, votes, moderation log, banned users |
| `DISCORD_WORKER` | Service Binding → `xivdyetools-discord-worker` | Forward submission/approval notifications to Discord |
| `THUMBNAILS` | R2 (`xivdyetools-presets-preview-thumbnails`) | Stored preset preview images (WebP) |
| `IMAGE_WORKER` | Service Binding → `xivdyetools-image-worker` | Crops/encodes an uploaded preview to WebP via `POST /thumbnail` |
| `TOKEN_BLACKLIST` | KV (the `xivdyetools-oauth` namespace) | Revoked JWT `jti`s (FINDING-002) + the 120 s `botnonce:` replay cache |
| `RL_PUBLIC` | Workers Rate Limiting (`[[ratelimits]]`, 100 / 60 s) | Backs both `publicRateLimitMiddleware` (`public:`) and `perUserRateLimitMiddleware` (`user:`) (FINDING-003) |

**Production-required** (`validateEnv`, FINDING-013): every binding above plus `JWT_SECRET`, `JWT_ISSUER` (must start `https://`) and `INTERNAL_WEBHOOK_SECRET`. Each of these degrades *silently* when absent — no revocation, no issuer pinning, a fallback limiter, a moderation fan-out that logs and returns — which is why they fail the request instead. A production `INTERNAL_WEBHOOK_SECRET` shorter than 32 characters (FINDING-027) is reported in `validateEnv`'s separate `warnings` list and logged once per isolate, but never makes `valid` false: the guard in `src/index.ts` 500s every request on an invalid env, and a short secret must not take the API down.

**Workers Logs stay off (FINDING-022):** `wrangler.toml` pins `[observability] enabled = false` at the top level and under `[env.production]`. Both privacy policies promise it; enabling it (or adding logpush / `tail_consumers`) needs the policies updated in the same change, and `tests/wrangler-config.test.ts` fails until then.

**Trigger parity (FINDING-031):** `tests/migration-trigger-parity.test.ts` asserts the `presets_content_revision_after_update` trigger in `migrations/0014` and `schema.sql` are identical after whitespace/`IF NOT EXISTS` normalization.

**Notification payload:** the `submission` payload's `preset` carries `content_revision` (a counter, not content) so the moderation embed's buttons bind to the exact revision shown; the dead-letter record keeps it for the same reason. A `submission` comes from `POST /presets` (`is_edit: false`) or from **every** `PATCH /presets/:id` that notifies (`is_edit: true`) — a flagged edit of an approved preset, a clean or flagged text edit of a pending one, and a rejected preset's resubmission — and an edit also carries top-level `edited_from_status`, the status before the edit (absent on POST), since `preset.status` is `pending` on every edit notification (BUG-003), and top-level `edited_from` — the `{ name, description, tags, dyes }` this edit replaced, taken from the handler's first read (the revision-bound UPDATE succeeding proves it is exactly the text overwritten; absent on POST). **`edited_from` is the diff base** — a consumer shows `edited_from` → `preset`; discord-worker's own edit post, which diffed against the real pre-edit text, was removed (BUG-004), and `previous_values` cannot replace it: a pending edit or a rejected resubmission never creates one (so there is usually none), and the write-once snapshot can be older than the replaced text. `edited_from` is never stored (`toDeadLetterRecord` drops it with the rest of the text) and never restored. `preset.previous_values` (the revert snapshot) rides along from the row spread. **A consumer may offer Revert only when `is_edit === true`, `previous_values` is non-null and `edited_from_status === 'approved'`** — a revert approves the snapshot — and should label it as restoring `previous_values`, not as undoing this edit (approved A → flagged edit B snapshots A → B approved → a flagged edit C reverts to A). To keep that safe, `PATCH /presets/:id` takes the snapshot **only when the stored status is `approved`** (BUG-003 follow-up): an edit of a pending, rejected or flagged preset neither creates nor overwrites one. `previous_values` is write-once and only a revert clears it (an approve through `/status` leaves it), so going forward a snapshot only ever holds text that was live as `approved` (moderator- or auto-approved). `tests/handlers/edit-snapshot.test.ts` pins this, including the rejected → resubmitted → approved → edited sequence that used to offer Revert to the rejected text, and pins `edited_from` against the stored text on approved, pending and rejected edits (and against an older snapshot). The Revert rule and the diff base live in `PresetSubmissionNotification`'s TSDoc (`services/notification-service.ts`) and in `docs/architecture/api-contracts.md`.

**Deploy consideration for the approved-only snapshot (not a fix):** rows written before this rule may still hold a snapshot taken from a pending or rejected state, and a later approval does not clear it, so such a preset — once approved and edited again — passes the consumer's Revert rule with a snapshot nobody approved. Nothing in the row records which state its snapshot came from, so the only handle is time: at deploy, every row with a non-null `previous_values` predates the rule (`SELECT id, status, updated_at FROM presets WHERE previous_values IS NOT NULL` lists them); afterwards an old snapshot can be told from a new one only by date, and `updated_at` moves on every later edit.

Vars: `ENVIRONMENT`, `API_VERSION = v1`, `CORS_ORIGIN`, `ADDITIONAL_CORS_ORIGINS` (CSV), `JWT_ISSUER`, `CACHE_PURGE_ZONE_ID` (production only — the `xivdyetools.app` zone id behind `shots.xivdyetools.app`, FINDING-018). Custom domain: `api.xivdyetools.app` only. The retired `api.xivdyetools.projectgalatine.com` was removed in the dashboard on 2026-10-05, and `tests/wrangler-config.test.ts` pins the single route so a deploy cannot re-attach it.

### Required Secrets

| Secret | Purpose |
|--------|---------|
| `BOT_API_SECRET` | Bearer token used by both Discord workers — required in **every** environment |
| `MODERATOR_IDS` | CSV/whitespace-separated list of moderator Discord IDs — required in **every** environment |
| `BOT_SIGNING_SECRET` | HMAC-SHA256 key — required in production for bot auth |
| `JWT_SECRET` | Shared with `xivdyetools-oauth` for verifying web JWTs — required in production, ≥ 32 chars |
| `INTERNAL_WEBHOOK_SECRET` | Bearer for discord-worker's `/webhooks/preset-submission` — **required in production** (FINDING-013). Without it `notifyDiscordBot` logs and returns: no moderation embed, no throw, so nothing lands in `failed_notifications` either |

### Optional Secrets

| Secret | Purpose |
|--------|---------|
| `PERSPECTIVE_API_KEY` | Google Perspective API for ML toxicity scoring. **⚠️ The service shuts down 2026-12-31** — delete this secret on or before that date, or FINDING-005's fail-closed branch queues every submission for manual review. With no key set the local word list still flags, but it holds no profanity, so a clean local pass is reported as `method: 'unscored'` (`passed: false`) and new presets and text edits go to the moderator queue as `pending` (FINDING-019). See `DEPRECATIONS.md` |
| `CACHE_PURGE_API_TOKEN` | FINDING-018: API token scoped to *Zone → Cache Purge* on the `xivdyetools.app` zone (the zone that serves `shots.xivdyetools.app`); pairs with the `CACHE_PURGE_ZONE_ID` **var** in `wrangler.toml` `[env.production]` (a zone id is config, not a secret). When set, every preview-image takedown purges the image URL from the edge cache and logs `[preview-image] cache purged …`. Absent → purge skipped, the object's one-day `s-maxage` is the only bound. Set on production 2026-08-21 |

## Database

### Tables (`schema.sql` + `migrations/0002…0014` + `002_add_composite_indexes.sql`)

`presets.content_revision` is an internal optimistic concurrency token. Migration 0014's
trigger owns all increments when content, ownership, status, or revert snapshots change,
including writes from older workers. Owner edits compare the captured revision and owner
at the final UPDATE and return 409 on a stale read. Moderator status changes also check the
revision; reverts additionally bind the exact raw snapshot. Their conditional update and
audit insert run in one atomic batch, so a stale action writes neither. Vote, preview-image, and timestamp-only
writes do not increment it. Do not also increment it in application SQL. SQLite `RETURNING`
does not reflect AFTER-trigger increments; callers must re-read before another conditional
write. The token is intentionally omitted from public preset responses.

| Table | Purpose |
|-------|---------|
| `categories` | 8 seeded categories: jobs, grand-companies, seasons, events, aesthetics, plus appearance / zones / raids-trials added by `migrations/0010`. `community` was retired by `migrations/0007` — community-ness is a source, not a category; any stragglers land in `aesthetics` |
| `presets` | Both curated and community palettes; `status ∈ {pending, approved, rejected, flagged, hidden}` (`hidden` is the ban-driven soft delete — never settable through `/moderation/:id/status`, whose validator accepts only the first four), `dye_signature` enforces unique dye combinations. Later columns arrived one migration each: `example_link` (`0008`), `preview_image_key` / `preview_image_status` (`0009`), `secondary_categories` (`0010`) |
| `votes` | One row per (preset_id, user_discord_id); composite PK |
| `moderation_log` | Audit trail of approve/reject/flag/unflag/requeue/revert/image_approve/image_reject actions, plus ban/unban/hide/restore written by moderation-worker directly (`migrations/0013` — `preset_id` is NULL on the user-level `ban`/`unban` rows, `target_discord_id` names the moderated user). Retention: see "Moderation record retention" below |
| `submission_events` | Append-only per-user quota log (`migrations/0011`; `0012` rebuilt it to allow the `text_edit` kind). `(user_discord_id, kind, created_at)` with `kind ∈ {submission, flagged_edit, preview_upload, text_edit}` — user actions never delete rows, so a daily cap cannot be refilled by deleting your own presets (FINDING-008) |
| `rate_limits` | **Dropped** by `migrations/0006` (REFACTOR-018 — never read or written). NOT in `schema.sql` any more: only a comment marks where it stood, so a fresh local DB does not create it either |
| `banned_users` | Tracked via `discord_id` or `xivauth_id`; partial unique index for active bans. A lifted ban is deleted 90 days after `unbanned_at` (see below) |
| `failed_notifications` | Dead-letter queue (BUG-015) for Discord notifications that exhausted retries |

### Moderation record retention (FINDING-005)

`services/moderation-retention-service.ts` (`pruneModerationRecords`) is the deletion; **these are the periods the FINDING-005 privacy-policy amendment (Sprint 5) will publish, so the constants are a commitment — change them only together with the policies**:

- **Lifted bans** (`banned_users.unbanned_at` set) are deleted **90 days** after `unbanned_at` (`LIFTED_BAN_RETENTION_DAYS`). An active ban is never pruned.
- **`moderation_log` rows whose `action` is `ban`, `unban`, `hide` or `restore`** are deleted **12 months** after `created_at` (`USER_ACTION_LOG_RETENTION_MONTHS`, calendar months). The rule keys on the action value, not on `preset_id` — `hide`/`restore` rows carry one.
- **Every other log row** (approve, reject, flag, unflag, requeue, revert, image_approve, image_reject) lives as long as its preset: the FK cascades, and `DELETE /presets/:id` also deletes them explicitly in its batch rather than relying on the cascade.

The prune runs in two places: **daily** from the retention job below, and best-effort on the moderation write paths (`PATCH` status, revert and preview-image, after the request's own write succeeded). The daily run is what makes the periods hold: moderation-worker's direct-D1 ban/unban and auto-approvals never touch these endpoints. It never throws, binds every parameter, compares ISO-8601 strings (the format every writer binds), and logs counts only.

### Daily retention job (`src/retention-job.ts`)

A Cron Trigger (`[env.production.triggers]`, `23 4 * * *` UTC, **production only** — the top-level block is the routeless dev worker) calls the `scheduled` handler, which runs `pruneSubmissionEvents` (30 d), `pruneFailedNotifications` (30 d resolved / 90 d unresolved) and `pruneModerationRecords` under `Promise.allSettled`, so one failing never stops the others. Logs counts, prune names and error names only. Each prune resolves `true` when its sweep ran and `false` when it caught its own D1 error; `runRetentionJob` resolves `{ fulfilled, rejected, failed }`, where `failed` names every prune that threw *or* reported `false` (BUG-066), and logs those names with `console.error`. Because Workers Logs are pinned off (FINDING-022) that log reaches nobody, so `scheduled` hands `ctx.waitUntil` a promise that **rejects** — with an `Error` naming only the failed prunes — whenever `failed` is non-empty. Cloudflare documents the first failing `waitUntil` as the invocation's status in the Cron Events table; that this worker's failed sweeps actually show up there as failures is **not yet confirmed** — check the dashboard after the next production deploy. The lazy write-path prunes stay (cheap, idempotent). `src/index.ts` still default-exports the Hono app, with `scheduled` attached via `Object.assign(app, { scheduled })` so `app.request` / `app.fetch` keep working. `tests/wrangler-config.test.ts` pins exactly one daily cron in production and none at the top level.

### Composite Indexes (`migrations/002_add_composite_indexes.sql`)

- `idx_presets_status_category_vote` — covers `WHERE status = ? AND category_id = ? ORDER BY vote_count DESC`.
- `idx_presets_status_vote` — popular feed.
- `idx_presets_status_created` — recent feed.
- `idx_presets_author_created` — `/presets/mine`.
- Unique `idx_presets_dye_signature` — duplicate detection at the DB layer; `migrations/0006` re-created it as a **partial** index (`WHERE status IN ('approved','pending')`) so a rejected preset's combination can be resubmitted.

### Query Patterns

- All user input is parameterized via `.bind()` — never string concatenation.
- Multi-statement transactions use `db.batch()` (e.g., insert vote + increment `vote_count` atomically).
- Vote insertion uses `INSERT … ON CONFLICT DO NOTHING` so two concurrent votes can never both succeed (PRESETS-CRITICAL fix).
- Typed reads via `db.prepare(sql).bind(...).first<RowType>()` and `.all<RowType>()`.

## API Routes

Base path: `/api/v1/`

Route order is load-bearing in `presets.ts` and `moderation.ts`: literal paths (`/featured`, `/mine`, `/rate-limit`, `/refresh-author`, `/pending`, `/stats`, `/failed-notifications`) are registered **before** `/:id` / `/:presetId`, or Hono matches the parameter route first and the literal becomes unreachable.

### Public

- `GET /presets` — `category`, `search`, `status`, `sort`, `page`, `limit` (capped at 50), `is_curated`.
- `GET /presets/featured` — top 10 by `vote_count` among `approved` presets. There is **no** `is_curated` filter (`getFeaturedPresets`); a community preset with enough votes appears here.
- `GET /presets/:id` — single preset.
- `GET /categories`, `GET /categories/:id` — categories with denormalized counts (a preset counts toward its primary **and** its `secondary_categories`).
- `GET /` and `GET /health` — service info / liveness.

### Authenticated (Bot or Web)

- `POST /presets` — submit (auto-vote for author, dye_signature dedup, profanity check). `dyes` are **stainIDs, 3–6 per preset, each at most once** (`validatePresetDyes`: a value ≥ 5000 is rejected as "looks like a legacy item ID"; 255–4999 gets the plainer "Dye IDs must be stainIDs (1-254)"; a repeat gets "Each dye may appear only once" — BUG-010); optional `secondary_categories` (≤ 2, never repeating the primary) and `example_link` (page URL on an `EXAMPLE_LINK_HOSTS` allowlisted host).
- `PATCH /presets/:id` — edit. An edit of an **approved** preset that trips moderation stores the write-once `previous_values` snapshot for revert; no other status ever creates or overwrites one (BUG-003 follow-up).
- `DELETE /presets/:id` — author **or moderator**; a preset the caller could not GET answers 404.
- `PATCH /presets/refresh-author` — re-sync the caller's denormalized author name across their presets.
- `GET /presets/mine` — requester's submissions across all statuses.
- `GET /presets/rate-limit` — remaining submissions today.
- `POST /presets/:id/preview-image` — upload a preview (raw image bytes → image-worker → R2).
- `DELETE /presets/:id/preview-image` — remove the caller's preview image.
- `POST /votes/:presetId`, `DELETE /votes/:presetId`, `GET /votes/:presetId/check`.

### Moderator-Only

- `GET /moderation/pending` — queue.
- `GET /moderation/:presetId` — the preset as a moderator reviews it, at any status, plus the `content_revision` a status change must be bound to (and a derived `moderation_status`). Registered after the single-segment literals above.
- `PATCH /moderation/:presetId/status` — approve/reject/flag/unflag. **Fails closed (FINDING-017):** the body must carry `expected_revision` (non-negative integer) and `expected_status` (one of the five statuses) — what the moderator actually reviewed. A write that cannot be bound to a review answers 409 with `code`: `REVISION_REQUIRED` (either field missing/invalid) or `STALE_REVIEW` (the preset changed after the review). Both carry `current: { status, content_revision }` from a fresh read, so the client's recovery is one: re-read and review again. The update and its log row are one batch, so a stale action writes neither.
- `PATCH /moderation/:presetId/revert` — restore `previous_values` after a problematic edit. **Fails closed like `/status` (FINDING-017):** the body must carry `reason` (10–200 chars) plus `expected_revision` and `expected_status`; missing/invalid → 409 `REVISION_REQUIRED`, a zero-row update (stale or concurrent) → 409 `STALE_REVIEW`, both with `current: { status, content_revision }`. The UPDATE binds the caller's expected revision and status plus the exact snapshot; the log row is gated by `changes() > 0`. A revert also sets `status = 'approved'`, so the snapshot's dyes must pass `validatePresetDyes` first: a snapshot written before the repeated-dye rule (or holding a legacy item ID / a count outside 3–6) answers 400 `VALIDATION_ERROR` `The previous values cannot be restored: …` and writes nothing (BUG-010 follow-up).
- `PATCH /moderation/:presetId/preview-image` — approve or strip a submitted preview image; body carries the reviewed `preview_image_key`, and a stale one is a 409. Writes an `image_approve` / `image_reject` `moderation_log` row in the same batch as the conditional UPDATE (FINDING-020).
- `GET /moderation/:presetId/history` — that preset's `moderation_log` entries.
- `GET /moderation/stats` — moderation queue counters.
- `GET /moderation/failed-notifications`, `PATCH /moderation/failed-notifications/:id/resolve` — dead-letter queue (BUG-015).

## Key Patterns

### Dual Authentication (`middleware/auth.ts`)

```
Authorization: Bearer <token>
   ├── token === BOT_API_SECRET ────► verify HMAC signature ──► AuthContext{authSource: 'bot'}
   └── otherwise + JWT_SECRET set  ──► verify JWT (HS256) ─────► AuthContext{authSource: 'web'}
                                                          user = `discord_id` claim (`sub` fallback)
```

Bot auth requires `BOT_SIGNING_SECRET` in production (rejects unsigned requests) — dev/test allow unsigned to ease local testing. JWT verification rejects non-HS256 algorithms to prevent algorithm-confusion attacks.

Guards:
- `requireAuth(c)` — 401 if not authenticated.
- `requireModerator(c)` — 401 if unauthenticated, 403 if not in `MODERATOR_IDS`.
- `requireUserContext(c)` — 400 if `userDiscordId` is missing.

### Moderation Pipeline

1. **Local profanity filter** (multi-language word lists in `data/profanity/`) — fast, runs first.
2. **Perspective API** (optional) — ML toxicity scoring when `PERSPECTIVE_API_KEY` is set. **Sunsets 2026-12-31** (`DEPRECATIONS.md`); unset the key before then and this tier is skipped cleanly.
3. **Manual review** — moderators approve/reject via `PATCH /moderation/:id/status`; `moderation_log` records the action.

### Preview Images (R2 + image-worker)

An author-uploaded picture for the preset card, stored as WebP in R2. **`preview_image_key` is not `example_link`** — the link points at a *page* about the glamour and is never fetched; the preview is bytes this worker owns.

```
POST /presets/:id/preview-image  (raw bytes)
   └─► IMAGE_WORKER.fetch('https://image-worker/thumbnail')   crop + WebP encode
         └─► THUMBNAILS.put(`${presetId}/${crypto.randomUUID()}.webp`)
               cacheControl: 'public, max-age=31536000, immutable, s-maxage=86400'
```

The UUID in the key is what makes the browser-side `immutable` safe: every key is single-use, so a URL can never come to mean a different image. The **edge** TTL (`s-maxage`) is one day (FINDING-018) — takedown is not complete while the edge still serves the URL. Replacing a preview writes a new key and deletes the old one; `deletePreviewImage` deletes the object **and then** purges `https://shots.xivdyetools.app/<key>` through the Cloudflare single-file cache-purge API when `CACHE_PURGE_ZONE_ID` + `CACHE_PURGE_API_TOKEN` are set (`purgePreviewImageCache`, best-effort, never throws, skipped when unset); a missing key is success. Delete first, purge second — purging before a failed delete would only let the edge re-cache the object.

`preview_image_status` (`'none' | 'pending' | 'approved'`) gates display, and moderators move it via `PATCH /moderation/:presetId/preview-image`. Note that the `CommunityPreset` shape deliberately **hides** `preview_image_key`, so any handler that needs the raw key must do its own row-level read rather than reusing the public getter.

### Multi-Category Presets

`category_id` remains the single **primary** category (FK and indexes untouched). `secondary_categories` (`migrations/0010`) is a JSON array of up to `SECONDARY_CATEGORY_MAX` more, `NOT NULL DEFAULT '[]'` so every pre-existing row was valid without a backfill. A secondary may not repeat the primary. Category counts in `categories.ts` union both via `json_each(p.secondary_categories)`, so one preset can count toward several categories.

### Discord Notifications via Service Binding

```typescript
env.DISCORD_WORKER?.fetch(new Request('https://internal/webhooks/preset-submission', { ... }))
```

Service Binding is preferred over outbound HTTPS because Cloudflare Workers can't always make external HTTP calls reliably from request handlers. When the binding is unavailable, the failure goes to `failed_notifications` for retry.

### CORS

Allowlist comes from `CORS_ORIGIN` + `ADDITIONAL_CORS_ORIGINS`. Production's `ADDITIONAL_CORS_ORIGINS` is exactly `https://xiv-colorexplorer.pages.dev` and `https://beta.xivdyetools.app`; the retired `https://xivdyetools.projectgalatine.com` origin was removed (FINDING-006, DOMAIN_DEPRECATION Phase 1) and `tests/wrangler-config.test.ts` pins the list. In dev mode only, specific localhost ports are also allowed: `5173` (Vite), `8787` (Wrangler), both with `localhost` and `127.0.0.1` — the loopback block is wrapped in `if (env.ENVIRONMENT === 'development')` (FINDING-002, mirroring `OAUTH-SEC-001`), so production never reflects a loopback origin on this credentialed endpoint. `maxAge: 3600` (1 hour) so policy changes propagate quickly.

`allowHeaders` is deliberately just `['Content-Type', 'Authorization']`. The bot identity headers below (`X-User-Discord-ID` / `X-User-Discord-Name`) are **not** listed: both bot callers arrive over Service Bindings and never preflight, so no real client needs the permission (FINDING-005).

### Rate Limiting Middleware

Two middleware layers, both 100 req/min and both backed by the native `RL_PUBLIC` binding through `CloudflareRateLimiter` (key prefixes `public:` / `user:`); `MemoryRateLimiter` from `@xivdyetools/worker-kit/rate-limiter` is the per-isolate fallback used only when the binding is unbound (dev/tests):

- `publicRateLimitMiddleware` — per client IP, on `/api/*` before auth. Requests with no `CF-Connecting-IP` (Service Binding callers) skip it entirely.
- `perUserRateLimitMiddleware` — per acting Discord user, on `/api/*` after auth. Unauthenticated requests pass through.

Both return 429 with `Retry-After` and emit `X-RateLimit-*` headers. The shared middleware's 429 body carries no `success` field; the per-day quota 429s from `handlers/presets.ts` do.

## Security Patterns

### HMAC Signature Format (Bot Auth)

```
Authorization: Bearer <BOT_API_SECRET>
X-Request-Signature-V2: HMAC-SHA256(BOT_SIGNING_SECRET, canonical(method, path, sha256(body), timestamp, nonce, userDiscordId, userName))
X-Request-Timestamp: <unix-seconds>
X-Request-Nonce: <uuid>
X-User-Discord-ID: <discord-id>
X-User-Discord-Name: <username>
```

Timestamp validity: max age 60 s, 60 s future skew tolerance. Algorithm in `@xivdyetools/auth.verifyBotSignatureV2` (`BOT_SIGNATURE_V2_MAX_AGE_MS`); the canonical string is length-prefixed field-per-line, so no delimiter inside a field can collide with another.

**v2 is the only accepted signature** (FINDING-015, 2026-08-29 audit). A request without a valid `X-Request-Signature-V2` is unauthenticated whatever the legacy `X-Request-Signature` (v1: `timestamp:userId:userName`, 5-minute window, nothing about the request bound) carries — and as of discord-worker 5.1.0 / moderation-worker 1.6.0 neither bot sends that header at all, while `@xivdyetools/auth` 2.0.0 removed its verifier, so no v1 remains anywhere in the monorepo. The nonce must be non-empty, ≤ 64 chars and `[A-Za-z0-9._-]`, and every accepted one is stored in `TOKEN_BLACKLIST` under `botnonce:` for 120 s so the same signed request cannot be replayed inside its window. That cache is best-effort — KV is eventually consistent, and a KV error or an unbound namespace (dev/tests) skips the *replay* check, never the signature or the nonce format.

### JWT Verification

`@xivdyetools/auth.verifyJWT(token, secret)` enforces:
- HS256 only (rejects `none`, RS256, etc.).
- Expiration check.
- Signature verification using Web Crypto.

The acting user ID comes from the `discord_id` claim (Discord snowflake — the same key the bot path sends in `X-User-Discord-ID`); `sub` is the oauth worker's internal user UUID and is only the fallback for XIVAuth-only accounts with no Discord ID (`resolveJWTUserId()` in `src/middleware/auth.ts`). `username` / `global_name` populate `userName`.

### Ban Checking

`requireNotBanned` is registered **once per router** for every mutating method — `presetsRouter.on(['POST', 'PATCH', 'DELETE'], '*', requireNotBanned)` and `votesRouter.on(['POST', 'DELETE'], '*', requireNotBanned)` — so every write (submit, edit, delete, refresh-author, votes, preview images) queries `banned_users` for an active ban (`unbanned_at IS NULL`) and a new route cannot forget it (FINDING-017). Unauthenticated requests pass through (nothing to check) and get the handler's 401. A **failed lookup fails closed** (`503 SERVICE_UNAVAILABLE`) everywhere except `ENVIRONMENT = development`, where it fails open with a loud warning so a fresh local DB without the table still works — run `npm run db:migrate:local` to create it. (The inline `requireNotBannedCheck()` guard that used to sit alongside it was deleted on 2026-09-01 — dead-code audit DEAD-011 — having had no caller; `requireNotBanned` is the only ban gate.)

### Body & JSON Hardening

- `bodySizeLimit` rejects requests > 100KB.
- `jsonDepthLimit` rejects deeply nested payloads (configured per-route, applied to all mutations under `/api/*`).
- Content-Type must be `application/json` for POST/PATCH/PUT with a body.

### Security Headers

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Strict-Transport-Security: max-age=31536000; includeSubDomains   (production only)
```

### Error Responses

Production hides `err.message` and stack — only the request ID is returned. Dev mode includes the message and stack for debugging.

## Dependencies

| Package | Purpose |
|---------|---------|
| `hono` | HTTP framework |
| `@xivdyetools/auth` | JWT + HMAC bot signature verification |
| `@xivdyetools/types` | Shared interfaces (preset shapes, AuthContext, etc.) |
| `@xivdyetools/worker-kit/rate-limiter` | `CloudflareRateLimiter`, `MemoryRateLimiter`, `getClientIp`, `PUBLIC_API_LIMITS` |
| `@xivdyetools/logger` | Structured logging with secret redaction — **transitive** via `worker-kit`, not in this app's `package.json` |
| `@xivdyetools/worker-kit` | Request ID, logger, rate-limit middleware factories |

## Development Notes

- Local D1 lives in `.wrangler/state/v3/d1/`. Reset with `rm -rf .wrangler` if migrations get stuck.
- `migrate-presets.ts` reads the curated preset library from `@xivdyetools/core` and emits SQL — pipe to `wrangler d1 execute`.
- Preset submissions auto-vote for the author in the same transaction.
- `dye_signature` is the JSON of sorted **stainIDs** (`"[1,12,40]"`) — both the column and a (partial) unique index; the 5.0 stainID migration recomputed every signature.
- A `/__force-error` test route exists outside production for exercising the global error handler.

## Related Projects

**Dependencies:** `@xivdyetools/auth`, `@xivdyetools/types`, `@xivdyetools/worker-kit` (incl. `/rate-limiter`); `@xivdyetools/logger` arrives transitively through `worker-kit`

**Service Bindings (outbound):** `xivdyetools-discord-worker` (notifications), `xivdyetools-image-worker` (`POST /thumbnail` for preview images)

**Service Bindings (inbound):** `xivdyetools-discord-worker`, `xivdyetools-moderation-worker`

**Shares secrets with:** `xivdyetools-oauth` (`JWT_SECRET`)

**Web client:** `xivdyetools-web-app` (REST consumer)

## Deployment Checklist

1. `wrangler secret put` for every required secret (`BOT_API_SECRET`, `MODERATOR_IDS`, and in production also `BOT_SIGNING_SECRET`, `JWT_SECRET`, `INTERNAL_WEBHOOK_SECRET`).
2. If schema changed: apply the relevant file(s) from `migrations/` by hand (see Commands) — **before** deploying the worker that reads the new columns, or the first query naming one fails as an opaque 500.
   **`npm run db:migrate` cannot alter an existing database** — `schema.sql` is all
   `CREATE TABLE IF NOT EXISTS`, so on a live D1 every statement is skipped and the
   script exits successfully having changed nothing. A column added to `schema.sql`
   without a matching `migrations/` file will be missing in production, and the first
   INSERT naming it fails as an opaque 500. That is exactly how `example_link`
   (`0008`) and `previous_values` (`0002`) went missing.
3. `npm run lint && npm run test -- --run && npm run type-check`.
4. `npm run deploy` — publishes the routeless `xivdyetools-presets-api-dev` worker (no staging env; it is not reachable at `api.xivdyetools.app`). Smoke-test production after step 5 with `curl https://api.xivdyetools.app/health` and an authenticated `POST /api/v1/presets`.
5. `npm run deploy:production`.
6. Verify Service Binding works from `discord-worker` (submit a preset via the web app and confirm the moderation channel receives the embed).
