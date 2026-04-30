# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

REST API for Final Fantasy XIV community color palette presets. Serves the web app, the Discord bot, and the moderation bot from a single Cloudflare Worker. Persistence is Cloudflare D1 (SQLite); business logic uses Hono routers split by resource. Both bots authenticate via signed Bearer tokens (HMAC-SHA256 over a request fingerprint) and the web app authenticates via JWTs minted by the OAuth worker — both code paths converge on a single `AuthContext` populated by `authMiddleware`.

This is the only D1 owner for `xivdyetools-presets`; sibling workers (`discord-worker`, `moderation-worker`) read/write through Service Bindings rather than directly.

## Commands

```bash
npm run dev                  # wrangler dev (port 8787)
npm run deploy               # Deploy to staging
npm run deploy:production    # Deploy to production env
npm run test                 # vitest
npm run test:coverage        # Coverage via @vitest/coverage-v8
npm run type-check           # tsc --noEmit
npm run lint                 # eslint src/

# Database
npm run db:migrate           # Apply schema.sql to remote D1
npm run db:migrate:local     # Apply schema.sql to local .wrangler D1
npm run db:migrate:indexes   # Apply migrations/002_add_composite_indexes.sql
npm run db:seed              # tsx scripts/migrate-presets.ts (seed curated presets)
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
│   ├── ban-check.ts                    # requireNotBannedCheck (queries banned_users)
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

Vars: `ENVIRONMENT`, `API_VERSION = v1`, `CORS_ORIGIN`, `ADDITIONAL_CORS_ORIGINS` (CSV). Custom domains: `api.xivdyetools.app`, `api.xivdyetools.projectgalatine.com`.

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

## Database

### Tables (`schema.sql` + `migrations/0002…0005`)

| Table | Purpose |
|-------|---------|
| `categories` | 6 seeded categories (jobs, grand-companies, seasons, events, aesthetics, community) |
| `presets` | Both curated and community palettes; `status ∈ {pending, approved, rejected, flagged}`, `dye_signature` enforces unique dye combinations |
| `votes` | One row per (preset_id, user_discord_id); composite PK |
| `moderation_log` | Audit trail of approve/reject/flag/unflag/revert actions |
| `rate_limits` | Optional persistent rate-limit counters (mostly unused — IP limits are in-memory) |
| `banned_users` | Tracked via `discord_id` or `xivauth_id`; partial unique index for active bans |
| `failed_notifications` | Dead-letter queue (BUG-015) for Discord notifications that exhausted retries |

### Composite Indexes (`migrations/002_add_composite_indexes.sql`)

- `idx_presets_status_category_vote` — covers `WHERE status = ? AND category_id = ? ORDER BY vote_count DESC`.
- `idx_presets_status_vote` — popular feed.
- `idx_presets_status_created` — recent feed.
- `idx_presets_author_created` — `/presets/mine`.
- Unique `idx_presets_dye_signature` — duplicate detection at the DB layer.

### Query Patterns

- All user input is parameterized via `.bind()` — never string concatenation.
- Multi-statement transactions use `db.batch()` (e.g., insert vote + increment `vote_count` atomically).
- Vote insertion uses `INSERT … ON CONFLICT DO NOTHING` so two concurrent votes can never both succeed (PRESETS-CRITICAL fix).
- Typed reads via `db.prepare(sql).bind(...).first<RowType>()` and `.all<RowType>()`.

## API Routes

Base path: `/api/v1/`

### Public

- `GET /presets` — `category`, `search`, `status`, `sort`, `page`, `limit` (capped at 50), `is_curated`.
- `GET /presets/featured` — top-voted curated/approved.
- `GET /categories` — categories with denormalized counts.
- `GET /` and `GET /health` — service info / liveness.

### Authenticated (Bot or Web)

- `POST /presets` — submit (auto-vote for author, dye_signature dedup, profanity check).
- `PATCH /presets/:id` — edit (stores `previous_values` JSON for revert).
- `GET /presets/mine` — requester's submissions across all statuses.
- `GET /presets/rate-limit` — remaining submissions today.
- `POST /votes/:presetId`, `DELETE /votes/:presetId`.

### Moderator-Only

- `GET /moderation/pending` — queue.
- `PATCH /moderation/:presetId/status` — approve/reject/flag/unflag.
- `POST /moderation/:presetId/revert` — restore `previous_values` after a problematic edit.

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

### Discord Notifications via Service Binding

```typescript
env.DISCORD_WORKER?.fetch(new Request('https://internal/webhooks/preset-submission', { ... }))
```

Service Binding is preferred over outbound HTTPS because Cloudflare Workers can't always make external HTTP calls reliably from request handlers. When the binding is unavailable, the failure goes to `failed_notifications` for retry.

### CORS

Allowlist comes from `CORS_ORIGIN` + `ADDITIONAL_CORS_ORIGINS`. In dev mode only, specific localhost ports are also allowed: `5173` (Vite), `8787` (Wrangler), both with `localhost` and `127.0.0.1`. `maxAge: 3600` (1 hour) so policy changes propagate quickly.

### Public Rate Limiting

100 req/min per IP via `MemoryRateLimiter` from `@xivdyetools/rate-limiter` (per-isolate; not distributed). Returns 429 with `Retry-After` and emits `X-RateLimit-*` headers.

## Security Patterns

### HMAC Signature Format (Bot Auth)

```
Authorization: Bearer <BOT_API_SECRET>
X-Request-Signature: HMAC-SHA256(BOT_SIGNING_SECRET, "<timestamp>:<userDiscordId>:<userName>")
X-Request-Timestamp: <unix-seconds>
X-User-Discord-ID: <discord-id>
X-User-Discord-Name: <username>
```

Timestamp validity: max age 5 minutes (`SIGNATURE_MAX_AGE_SECONDS = 300`), 1-minute future skew tolerance. Algorithm in `@xivdyetools/auth.verifyBotSignature`.

### JWT Verification

`@xivdyetools/auth.verifyJWT(token, secret)` enforces:
- HS256 only (rejects `none`, RS256, etc.).
- Expiration check.
- Signature verification using Web Crypto.

The `sub` claim is the Discord user ID; `username` / `global_name` populate `userName`.

### Ban Checking

Mutating routes (POST presets, PATCH presets, POST votes) call `requireNotBannedCheck()` which queries `banned_users` for an active ban (`unbanned_at IS NULL`). Fails open if the table is missing (e.g., fresh local DB) so dev still works.

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
| `@xivdyetools/crypto` | Base64URL helpers |
| `@xivdyetools/types` | Shared interfaces (preset shapes, AuthContext, etc.) |
| `@xivdyetools/rate-limiter` | `MemoryRateLimiter`, `getClientIp`, `PUBLIC_API_LIMITS` |
| `@xivdyetools/logger` | Structured logging with secret redaction |
| `@xivdyetools/worker-middleware` | Request ID, logger, rate-limit middleware factories |

## Development Notes

- Local D1 lives in `.wrangler/state/v3/d1/`. Reset with `rm -rf .wrangler` if migrations get stuck.
- `migrate-presets.ts` reads the curated preset library from `@xivdyetools/core` and emits SQL — pipe to `wrangler d1 execute`.
- Preset submissions auto-vote for the author in the same transaction.
- `dye_signature` is the JSON of sorted dye IDs (`"[1,12,40]"`) — both the column and a unique index.
- A `/__force-error` test route exists outside production for exercising the global error handler.

## Related Projects

**Dependencies:** `@xivdyetools/auth`, `@xivdyetools/crypto`, `@xivdyetools/types`, `@xivdyetools/rate-limiter`, `@xivdyetools/logger`, `@xivdyetools/worker-middleware`

**Service Bindings (outbound):** `xivdyetools-discord-worker` (notifications)

**Service Bindings (inbound):** `xivdyetools-discord-worker`, `xivdyetools-moderation-worker`

**Shares secrets with:** `xivdyetools-oauth` (`JWT_SECRET`)

**Web client:** `xivdyetools-web-app` (REST consumer)

## Deployment Checklist

1. `wrangler secret put` for every required secret (`BOT_API_SECRET`, `BOT_SIGNING_SECRET`, `JWT_SECRET`, `MODERATOR_IDS`).
2. If schema changed: `npm run db:migrate` (production D1).
3. `npm run lint && npm run test -- --run && npm run type-check`.
4. `npm run deploy` — push to staging, smoke-test with `curl https://api.xivdyetools.app/health` and an authenticated `POST /api/v1/presets`.
5. `npm run deploy:production`.
6. Verify Service Binding works from `discord-worker` (submit a preset via the web app and confirm the moderation channel receives the embed).
