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
npm run lint                 # eslint src/

# Database
npm run db:migrate           # Apply schema.sql to remote D1 — CREATES ONLY, see below
npm run db:migrate:local     # Apply schema.sql to local .wrangler D1
npm run db:migrate:indexes   # Apply migrations/002_add_composite_indexes.sql
npm run db:seed              # tsx scripts/migrate-presets.ts (seed curated presets)

# Files under migrations/ are NOT applied by any script — run them by hand:
npx wrangler d1 execute xivdyetools-presets --remote --file=./migrations/<name>.sql

# 5.0 stainID data migration (one-off, data-dependent): dump the rows, generate the
# UPDATEs with scripts/migrate-dyes-to-stainids.ts, then execute the emitted SQL —
# usage header inside the script.
```

### Setting Secrets

```bash
wrangler secret put BOT_API_SECRET
wrangler secret put BOT_SIGNING_SECRET
wrangler secret put JWT_SECRET                 # Must match xivdyetools-oauth
wrangler secret put MODERATOR_IDS              # CSV of Discord user IDs
wrangler secret put PERSPECTIVE_API_KEY        # Optional: ML toxicity scoring
wrangler secret put OWNER_DISCORD_ID
wrangler secret put DISCORD_BOT_TOKEN
wrangler secret put DISCORD_BOT_WEBHOOK_URL
wrangler secret put MODERATION_WEBHOOK_URL
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
            envValidated check (per-isolate)
                      │
                      ▼
            security headers + CORS (allowlisted origins + dev localhost)
                      │
                      ▼
            /api/* : publicRateLimitMiddleware (100/min/IP)
            /api/* : bodySizeLimit (100KB)
            /api/* : jsonDepthLimit
            /api/* : Content-Type assert (mutations)
                      │
                      ▼
                  authMiddleware  ──► c.set('auth', AuthContext)
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
│   └── env-validation.ts               # First-request env validation
└── (no entry-level scripts beyond `migrations/` and `scripts/migrate-presets.ts`)
```

### Environment Bindings (wrangler.toml)

| Binding | Type | Purpose |
|---------|------|---------|
| `DB` | D1 (`xivdyetools-presets`) | Authoritative store for presets, votes, moderation log, banned users |
| `DISCORD_WORKER` | Service Binding → `xivdyetools-discord-worker` | Forward submission/approval notifications to Discord |
| `THUMBNAILS` | R2 (`xivdyetools-presets-preview-thumbnails`) | Stored preset preview images (WebP) |
| `IMAGE_WORKER` | Service Binding → `xivdyetools-image-worker` | Crops/encodes an uploaded preview to WebP via `POST /thumbnail` |

Vars: `ENVIRONMENT`, `API_VERSION = v1`, `CORS_ORIGIN`, `ADDITIONAL_CORS_ORIGINS` (CSV), `JWT_ISSUER`, `CACHE_PURGE_ZONE_ID` (production only — the `xivdyetools.app` zone id behind `shots.xivdyetools.app`, FINDING-018). Custom domains: `api.xivdyetools.app`, `api.xivdyetools.projectgalatine.com`.

### Required Secrets

| Secret | Purpose |
|--------|---------|
| `BOT_API_SECRET` | Bearer token used by both Discord workers |
| `BOT_SIGNING_SECRET` | HMAC-SHA256 key — required in production for bot auth |
| `JWT_SECRET` | Shared with `xivdyetools-oauth` for verifying web JWTs |
| `MODERATOR_IDS` | CSV/whitespace-separated list of moderator Discord IDs |

### Optional Secrets

| Secret | Purpose |
|--------|---------|
| `PERSPECTIVE_API_KEY` | Google Perspective API for ML toxicity scoring |
| `MODERATION_WEBHOOK_URL` | Fallback webhook URL when Service Binding unavailable |
| `OWNER_DISCORD_ID` | Owner override for elevated debug routes |
| `DISCORD_BOT_TOKEN` / `DISCORD_BOT_WEBHOOK_URL` | Optional direct bot notification path |
| `INTERNAL_WEBHOOK_SECRET` | Shared with discord-worker for `/webhooks/preset-submission` |
| `CACHE_PURGE_API_TOKEN` | FINDING-018: API token scoped to *Zone → Cache Purge* on the `xivdyetools.app` zone (the zone that serves `shots.xivdyetools.app`); pairs with the `CACHE_PURGE_ZONE_ID` **var** in `wrangler.toml` `[env.production]` (a zone id is config, not a secret). When set, every preview-image takedown purges the image URL from the edge cache and logs `[preview-image] cache purged …`. Absent → purge skipped, the object's one-day `s-maxage` is the only bound. Set on production 2026-08-21 |

## Database

### Tables (`schema.sql` + `migrations/0002…0010`)

| Table | Purpose |
|-------|---------|
| `categories` | 8 seeded categories: jobs, grand-companies, seasons, events, aesthetics, plus appearance / zones / raids-trials added by `migrations/0010`. `community` was retired by `migrations/0007` — community-ness is a source, not a category; any stragglers land in `aesthetics` |
| `presets` | Both curated and community palettes; `status ∈ {pending, approved, rejected, flagged}`, `dye_signature` enforces unique dye combinations. Later columns arrived one migration each: `example_link` (`0008`), `preview_image_key` / `preview_image_status` (`0009`), `secondary_categories` (`0010`) |
| `votes` | One row per (preset_id, user_discord_id); composite PK |
| `moderation_log` | Audit trail of approve/reject/flag/unflag/revert actions, plus ban/unban/hide/restore written by moderation-worker directly (`migrations/0013` — `preset_id` is NULL on the user-level `ban`/`unban` rows, `target_discord_id` names the moderated user) |
| `rate_limits` | **Dropped** by `migrations/0006` (REFACTOR-018 — never read or written; IP limits are in-memory). Still present in `schema.sql` only for fresh local DBs |
| `banned_users` | Tracked via `discord_id` or `xivauth_id`; partial unique index for active bans |
| `failed_notifications` | Dead-letter queue (BUG-015) for Discord notifications that exhausted retries |

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
- `GET /presets/featured` — top-voted curated/approved.
- `GET /presets/:id` — single preset.
- `GET /categories`, `GET /categories/:id` — categories with denormalized counts (a preset counts toward its primary **and** its `secondary_categories`).
- `GET /` and `GET /health` — service info / liveness.

### Authenticated (Bot or Web)

- `POST /presets` — submit (auto-vote for author, dye_signature dedup, profanity check). `dyes` are **stainIDs, 3–6 per preset** (`validatePresetDyes`: values > 254 are rejected with a "looks like a legacy item ID" message); optional `secondary_categories` (≤ 2, never repeating the primary) and `example_link` (page URL on an `EXAMPLE_LINK_HOSTS` allowlisted host).
- `PATCH /presets/:id` — edit (stores `previous_values` JSON for revert).
- `DELETE /presets/:id` — author-only delete.
- `PATCH /presets/refresh-author` — re-sync the caller's denormalized author name across their presets.
- `GET /presets/mine` — requester's submissions across all statuses.
- `GET /presets/rate-limit` — remaining submissions today.
- `POST /presets/:id/preview-image` — upload a preview (raw image bytes → image-worker → R2).
- `DELETE /presets/:id/preview-image` — remove the caller's preview image.
- `POST /votes/:presetId`, `DELETE /votes/:presetId`, `GET /votes/:presetId/check`.

### Moderator-Only

- `GET /moderation/pending` — queue.
- `PATCH /moderation/:presetId/status` — approve/reject/flag/unflag.
- `PATCH /moderation/:presetId/revert` — restore `previous_values` after a problematic edit.
- `PATCH /moderation/:presetId/preview-image` — approve or strip a submitted preview image.
- `GET /moderation/:presetId/history` — that preset's `moderation_log` entries.
- `GET /moderation/stats` — moderation queue counters.
- `GET /moderation/failed-notifications`, `PATCH /moderation/failed-notifications/:id/resolve` — dead-letter queue (BUG-015).

## Key Patterns

### Dual Authentication (`middleware/auth.ts`)

```
Authorization: Bearer <token>
   ├── token === BOT_API_SECRET ────► verify HMAC signature ──► AuthContext{authSource: 'bot'}
   └── otherwise + JWT_SECRET set  ──► verify JWT (HS256) ─────► AuthContext{authSource: 'web'}
                                                                  user comes from `sub` claim
```

Bot auth requires `BOT_SIGNING_SECRET` in production (rejects unsigned requests) — dev/test allow unsigned to ease local testing. JWT verification rejects non-HS256 algorithms to prevent algorithm-confusion attacks.

Guards:
- `requireAuth(c)` — 401 if not authenticated.
- `requireModerator(c)` — 401 if unauthenticated, 403 if not in `MODERATOR_IDS`.
- `requireUserContext(c)` — 400 if `userDiscordId` is missing.

### Moderation Pipeline

1. **Local profanity filter** (multi-language word lists in `data/profanity/`) — fast, runs first.
2. **Perspective API** (optional) — ML toxicity scoring when `PERSPECTIVE_API_KEY` is set.
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

Allowlist comes from `CORS_ORIGIN` + `ADDITIONAL_CORS_ORIGINS`. In dev mode only, specific localhost ports are also allowed: `5173` (Vite), `8787` (Wrangler), both with `localhost` and `127.0.0.1` — the loopback block is wrapped in `if (env.ENVIRONMENT === 'development')` (FINDING-002, mirroring `OAUTH-SEC-001`), so production never reflects a loopback origin on this credentialed endpoint. `maxAge: 3600` (1 hour) so policy changes propagate quickly.

`allowHeaders` is deliberately just `['Content-Type', 'Authorization']`. The bot identity headers below (`X-User-Discord-ID` / `X-User-Discord-Name`) are **not** listed: both bot callers arrive over Service Bindings and never preflight, so no real client needs the permission (FINDING-005).

### Public Rate Limiting

100 req/min per IP via `MemoryRateLimiter` from `@xivdyetools/worker-kit/rate-limiter` (per-isolate; not distributed). Returns 429 with `Retry-After` and emits `X-RateLimit-*` headers.

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

`requireNotBanned` is registered **once per router** for every mutating method — `presetsRouter.on(['POST', 'PATCH', 'DELETE'], '*', requireNotBanned)` and `votesRouter.on(['POST', 'DELETE'], '*', requireNotBanned)` — so every write (submit, edit, delete, refresh-author, votes, preview images) queries `banned_users` for an active ban (`unbanned_at IS NULL`) and a new route cannot forget it (FINDING-017). Unauthenticated requests pass through (nothing to check) and get the handler's 401. A **failed lookup fails closed** (`503 SERVICE_UNAVAILABLE`) everywhere except `ENVIRONMENT = development`, where it fails open with a loud warning so a fresh local DB without the table still works — run `npm run db:migrate:local` to create it. The inline `requireNotBannedCheck()` guard is still exported for ad-hoc use but no handler calls it.

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
| `@xivdyetools/worker-kit/rate-limiter` | `MemoryRateLimiter`, `getClientIp`, `PUBLIC_API_LIMITS` |
| `@xivdyetools/logger` | Structured logging with secret redaction |
| `@xivdyetools/worker-kit` | Request ID, logger, rate-limit middleware factories |

## Development Notes

- Local D1 lives in `.wrangler/state/v3/d1/`. Reset with `rm -rf .wrangler` if migrations get stuck.
- `migrate-presets.ts` reads the curated preset library from `@xivdyetools/core` and emits SQL — pipe to `wrangler d1 execute`.
- Preset submissions auto-vote for the author in the same transaction.
- `dye_signature` is the JSON of sorted **stainIDs** (`"[1,12,40]"`) — both the column and a (partial) unique index; the 5.0 stainID migration recomputed every signature.
- A `/__force-error` test route exists outside production for exercising the global error handler.

## Related Projects

**Dependencies:** `@xivdyetools/auth`, `@xivdyetools/types`, `@xivdyetools/worker-kit/rate-limiter`, `@xivdyetools/logger`, `@xivdyetools/worker-kit`

**Service Bindings (outbound):** `xivdyetools-discord-worker` (notifications), `xivdyetools-image-worker` (`POST /thumbnail` for preview images)

**Service Bindings (inbound):** `xivdyetools-discord-worker`, `xivdyetools-moderation-worker`

**Shares secrets with:** `xivdyetools-oauth` (`JWT_SECRET`)

**Web client:** `xivdyetools-web-app` (REST consumer)

## Deployment Checklist

1. `wrangler secret put` for every required secret (`BOT_API_SECRET`, `BOT_SIGNING_SECRET`, `JWT_SECRET`, `MODERATOR_IDS`).
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
