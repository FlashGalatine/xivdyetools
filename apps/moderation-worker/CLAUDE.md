# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A separate Discord bot dedicated to moderation actions on Community Presets. Runs on Cloudflare Workers via Discord HTTP Interactions and shares D1 + KV with `xivdyetools-discord-worker`, but has its own Discord application (different `DISCORD_CLIENT_ID`) so moderators can interact with a dedicated UI without polluting the main bot's command surface.

This split keeps the privileged moderation surface (ban/unban, approve/reject, revert edits) isolated from the user-facing bot. The only slash command exposed is `/preset` with moderation subcommands; everything else returns "not supported".

## Commands

```bash
npm run dev                  # wrangler dev
npm run deploy               # Deploy to the DEV worker (xivdyetools-moderation-worker-dev, no routes)
npm run deploy:production    # Deploy to production env
npm run test                 # vitest unit tests
npm run test:coverage        # Coverage via @vitest/coverage-v8
npm run type-check           # tsc --noEmit
npm run lint                 # eslint src/
npm run register-commands    # tsx scripts/register-commands.ts (publish slash commands)
```

### Registering Commands

```powershell
$env:DISCORD_TOKEN = "..."
$env:DISCORD_CLIENT_ID = "1453806659708129374"
$env:DISCORD_GUILD_ID = "<test-guild>"   # Optional
npm run register-commands
```

### Setting Secrets

```bash
wrangler secret put DISCORD_TOKEN
wrangler secret put DISCORD_PUBLIC_KEY
wrangler secret put BOT_API_SECRET
wrangler secret put BOT_SIGNING_SECRET
wrangler secret put MODERATOR_IDS            # CSV of Discord IDs
wrangler secret put MODERATION_CHANNEL_ID
wrangler secret put SUBMISSION_LOG_CHANNEL_ID
```

### Pre-commit Checklist

```bash
npm run lint && npm run test -- --run && npm run type-check
```

## Architecture

### Request Flow

```
Discord ──POST /──► Ed25519 verify ──► safeParseJSON (depth ≤ 10, frozen)
                                            │
                                            ▼
                                     interaction.type
                                            │
        ┌────────────────┬────────────┬─────┴─────────┬──────────────┐
        ▼                ▼            ▼               ▼              ▼
       PING            COMMAND     AUTOCOMPLETE   COMPONENT       MODAL_SUBMIT
       PONG               │            │              │               │
                          ▼            ▼              ▼               ▼
                    rate-limit  rate-limit    handleButton   handlePresetRejection /
                    handlePreset preset autocomplete         handlePresetRevert /
                                                              handleBanReason
```

Outbound writes hit `presets-api` via Service Binding (`PRESETS_API.fetch(...)`) signed with `BOT_SIGNING_SECRET` (HMAC-SHA256). Ban/unban operations also write to D1 directly (`ban-service.ts`).

### Key Directories

```
src/
├── index.ts                            # Hono app, Ed25519, routing, error handler
├── handlers/
│   ├── commands/
│   │   ├── index.ts                    # Re-exports handlePresetCommand
│   │   └── preset.ts                   # /preset moderate | ban_user | unban_user
│   ├── review-message.ts               # Refresh-and-reclick: current-text review embed + revision-bound buttons
│   ├── buttons/
│   │   ├── index.ts                    # Dispatcher (custom_id prefix routing)
│   │   ├── preset-moderation.ts        # Approve/Reject/Revert buttons from embeds
│   │   └── ban-confirmation.ts         # Confirm/cancel destructive ban actions
│   └── modals/
│       ├── index.ts                    # Modal dispatcher + isXModal helpers
│       ├── preset-rejection.ts         # Rejection reason modal
│       └── ban-reason.ts               # Ban reason modal
├── middleware/
│   └── rate-limit.ts                   # Native RL_COMMAND / RL_AUTOCOMPLETE bindings when bound, KV sliding window otherwise
├── services/
│   ├── ban-service.ts                  # Ban/unban + searchPresetAuthors / searchBannedUsers
│   ├── preset-api.ts                   # Service Binding client + validateSecurityConfig
│   ├── i18n.ts                         # Locale resolution (KV → discord locale → 'en')
│   └── bot-i18n.ts                     # createUserTranslator wrapper
├── utils/
│   ├── review-custom-id.ts             # Strict parser/builder for revision-bound review custom_ids
│   ├── verify.ts                       # Ed25519 + Content-Length guard (100KB)
│   ├── safe-json.ts                    # safeParseJSON with depth/freeze checks
│   ├── url-sanitizer.ts                # Strip sensitive query params from logs
│   ├── response.ts                     # pong/ephemeral/deferred/rateLimited
│   ├── discord-api.ts                  # REST helpers
│   ├── embed-text.ts                   # Embed text building / truncation
│   ├── sql-helpers.ts                  # Shared D1 query fragments
│   └── env-validation.ts               # validateEnv — required secrets, bindings, production-only bindings
└── types/
    ├── env.ts                          # Env interface + Interaction enums
    ├── preset.ts                       # Local preset shape for D1 reads
    ├── ban.ts                          # Ban service types
    └── modal.ts                        # Modal payload types
```

### Environment Bindings (wrangler.toml)

| Binding | Type | Purpose |
|---------|------|---------|
| `KV` | KV Namespace (shared with discord-worker) | Bot state + the **fallback** rate-limit counters |
| `DB` | D1 (`xivdyetools-presets`, shared) | Preset rows + `banned_users` table |
| `PRESETS_API` | Service Binding → `xivdyetools-presets-api` | Worker-to-Worker preset moderation calls |
| `RL_COMMAND` | Workers Rate Limiting (`[[ratelimits]]`, 25 / 60 s) | Per-user command limiter (20 + 5 burst) |
| `RL_AUTOCOMPLETE` | Workers Rate Limiting (`[[ratelimits]]`, 70 / 60 s) | Per-user autocomplete limiter (60 + 10 burst) |

Both rate-limit bindings are **required when `ENVIRONMENT = "production"`** (FINDING-013): losing one degrades silently to the KV limiter, so `index.ts` answers every request — `/health` included — with `500 Service misconfigured` while the error stands.

Vars: `ENVIRONMENT` (`development` / `production`), `DISCORD_CLIENT_ID = 1453806659708129374` (separate Discord app), `PRESETS_API_URL`. **`vars` are not inheritable**, so `ENVIRONMENT` is declared in *both* `wrangler.toml` blocks — a production deploy missing that line would skip the production-only checks above. Custom domain: `moderation-bot.xivdyetools.app` only. The retired `moderation-bot.xivdyetools.projectgalatine.com` was removed in the dashboard on 2026-10-05, and `tests/wrangler-config.test.ts` pins the single route so a deploy cannot re-attach it.

### Required Secrets

| Secret | Purpose |
|--------|---------|
| `DISCORD_TOKEN` | Bot token for follow-ups |
| `DISCORD_PUBLIC_KEY` | Ed25519 public key |
| `MODERATOR_IDS` | CSV of Discord IDs allowed to use moderation subcommands |
| `MODERATION_CHANNEL_ID` | Channel where pending preset embeds are posted |

### Optional Secrets

| Secret | Purpose |
|--------|---------|
| `BOT_API_SECRET` | Bearer token for outbound calls to presets-api |
| `BOT_SIGNING_SECRET` | HMAC-SHA256 key for bot request signing (required in prod) — min. 32 characters (checked by `validateEnv`; `@xivdyetools/auth` rejects shorter keys) |
| `SUBMISSION_LOG_CHANNEL_ID` | Audit channel for approved submissions |

## Key Patterns

### Single Command Surface

`handleCommand()` only routes `commandName === 'preset'`; all other commands return "not supported by this moderation bot." This keeps Discord's command tree minimal and prevents the moderation bot from accidentally exposing user-facing commands.

### Safe JSON Parsing

`safeParseJSON()` (`utils/safe-json.ts`) wraps `JSON.parse` with:
- Max depth 10 (Discord interactions are shallow).
- Structural validation.
- `Object.freeze()` on the result so handlers can't accidentally mutate the request payload.
- Returns parse warnings (e.g., trailing whitespace) for logging without rejecting the request.

### Rate Limiting

`middleware/rate-limit.ts` limits per Discord user under two configs, sourced from
`MODERATION_LIMITS` in `@xivdyetools/worker-kit/rate-limiter`:

| Config | Limit | Burst | Window | Native binding |
|--------|-------|-------|--------|----------------|
| `command` | 20/min | +5 | 60 s | `RL_COMMAND` (`simple.limit = 25`) |
| `autocomplete` | 60/min | +10 | 60 s | `RL_AUTOCOMPLETE` (`simple.limit = 70`) |

Backend selection happens once per isolate: `CloudflareRateLimiter` over whichever `RL_*` bindings
are present (atomic, per-colo), and `KVRateLimiter` only when neither is bound — which, in
production, `validateEnv` does not allow.

Both fail open (allow on backend error) and use `ctx.waitUntil()` for the increment so the user response is not delayed. A fail-open is no longer silent: `checkRateLimit` returns `backendError: true` and `index.ts` warns `Rate limiter backend error — request allowed (fail-open)` with the interaction type on the request logger (FINDING-012). Nothing goes back to the client — a header would tell an abuser when the limiter is off.

### Revision-Bound Review Buttons (FINDING-017)

Approve / reject / revert buttons and the reject / revert modals carry what the moderator reviewed in their `custom_id`: `preset_approve_<uuid>:<revision>:<status>` (likewise `preset_reject_`, `preset_revert_`, `preset_reject_modal_`, `preset_revert_modal_`). `utils/review-custom-id.ts` is the one strict parser (≤ 100 chars; revision = non-negative integer, no leading zeros; status = full status word) and the only builder. The values go to presets-api as `expected_revision` / `expected_status`, and a `409` means the text or status changed. A legacy bare id (`preset_approve_<uuid>`) or a `409` never acts: `handlers/review-message.ts` fetches the current preset, edits the message to show its current text with fresh revision-bound buttons, and tells the moderator to review and click again. Every message edit there passes `components` (empty list when nothing is actionable) — omitting them leaves the old live buttons in place.

### Ban Storage and Unban Restore

Ban writes go straight to D1 through `ban-service.ts`, each in one `db.batch` with its `moderation_log` rows. Rules to keep:

- **Both id columns (FINDING-014).** An XIVAuth-only target (the UUID shape `isBanTargetId` accepts) is written to `banned_users.discord_id` **and** `xivauth_id`; a snowflake leaves `xivauth_id` NULL. Every ban read matches `discord_id = ? OR xivauth_id = ?` with bound parameters, including `isPresetAuthorBanned` (approval refuses a banned author's preset) and the pickers. Mind the two partial unique indexes on active bans (`idx_banned_users_discord_active`, `idx_banned_users_xivauth_active`, `apps/presets-api/schema.sql`).
- **Blank on unban (FINDING-005).** The statement that sets `unbanned_at` also sets `username = ''` and `reason = ''` (both `NOT NULL`). Keep them while the ban is active — ban search selects and sorts by `username`. Do not prune rows here: presets-api owns the retention rule.
- **Restore skips collisions (FINDING-021).** `restoreGuard()` in `ban-service.ts` is spliced into both the restore UPDATE and its `moderation_log` INSERT…SELECT so they select the same rows: a hidden preset stays hidden when another approved/pending preset holds its `dye_signature`, or when the author has a lower-id hidden twin. `unbanUser` returns `presetsStillHidden` (counted after the batch; a failing count never fails the unban) and the embed reports it. A `UNIQUE … dye_signature` failure that still gets through (a racing submission) maps to its own channel-safe message.
- `src/services/ban-service.sqlite.test.ts` runs these against real SQLite (`node:sqlite`) because the shared D1 mock records SQL without evaluating it.

### Moderator Authorization

`MODERATOR_IDS` is parsed by splitting on `[\s,]+` and filtering empties — accepts comma-separated, whitespace-separated, or newline-separated lists. Every moderation action verifies the invoking user is in this list before mutating D1 or calling presets-api.

### Modal Routing

`handleModal()` uses prefix-based detection helpers (`isPresetRejectionModal`, `isPresetRevertModal`, `isBanReasonModal`) so each modal handler only needs to expose its `custom_id` prefix.

### URL Sanitization in Logs

`sanitizeUrl()` is passed to `loggerMiddleware` so query parameters that might contain user IDs or tokens never end up in structured logs.

## Security Patterns

### Ed25519 Signature Verification

Every request hitting `POST /` verifies `X-Signature-Ed25519` against `DISCORD_PUBLIC_KEY` before any parsing. Body limit is 100KB, validated via Content-Length first.

### Hardened Security Headers

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Strict-Transport-Security: max-age=31536000; includeSubDomains
Cache-Control: no-store
Content-Security-Policy: default-src 'none'
Referrer-Policy: no-referrer
```

These are stricter than the main discord-worker because all responses contain potentially sensitive moderation context.

### Global Error Handler

`app.onError()` returns generic `Internal Server Error` in production and only includes the message + stack in development. Stack traces never leak to Discord.

### Workers Logs Stay Off (FINDING-022)

`wrangler.toml` pins `[observability] enabled = false` in the top-level block and in `[env.production.observability]`; `tests/wrangler-config.test.ts` also fails on `logpush = true` or a non-empty `tail_consumers`. Both privacy policies promise persistent logs are off, so turning them on means updating the policies (all six languages) in the same change.

### Environment Validation

`validateEnv()` runs on every request; the first request per isolate additionally reports it (`logValidationErrors` + `presetApi.validateSecurityConfig()`). Missing or misconfigured secrets are logged and the worker continues, so partial functionality (e.g., autocomplete) still works — **except** the production-only errors (FINDING-013): when `ENVIRONMENT === 'production'` and `RL_COMMAND` or `RL_AUTOCOMPLETE` is unbound, every request is refused with `500 {"error":"Service misconfigured"}`, `/health` included, until it is fixed. Those errors carry `PRODUCTION_ENV_ERROR_PREFIX` (exported by `utils/env-validation.ts`, matched in `index.ts`) and cannot be raised outside production, so the dev worker keeps the log-only path and its KV fallback.

### Bot → Presets API Signing

When calling `presets-api`, `preset-api.ts` signs the request with `BOT_SIGNING_SECRET` via `@xivdyetools/auth`'s `createBotSignatureV2` — which binds the method, path, body hash, timestamp, nonce and identity (60 s window) — and sends:

- `Authorization: Bearer <BOT_API_SECRET>`
- `X-Request-Signature-V2: <hex>`
- `X-Request-Nonce: <uuid>`
- `X-Request-Timestamp: <unix>`
- `X-User-Discord-ID: <moderator id>`
- `X-User-Discord-Name: <moderator name>`

> The legacy v1 header (`X-Request-Signature`, a bare `timestamp:userId:userName` HMAC that bound nothing about the request itself — REFACTOR-027, 2026-07-18) is **no longer sent**: presets-api stopped accepting it in 2.2.0 and this bot stopped sending it in 1.6.0 (FINDING-015, `docs/audits/2026-08-29-security`).

Without `BOT_SIGNING_SECRET` in production, bot auth is rejected on the API side (see presets-api `auth.ts`).

## Available Commands

| Command | Description |
|---------|-------------|
| `/preset moderate` | Four actions on the required `action` option — `pending` (browse the queue), `approve`, `reject`, `stats` — plus an optional `preset_id` (autocompleted). `approve` / `reject` never act on a typed id: they answer privately with the preset's **current** text and one confirm button bound to the revision just fetched (FINDING-017); the rejection reason is typed in the modal that button opens, so the command has no `reason` option any more. The queue list itself carries no buttons: act through the confirm flow above, or with the approve / reject buttons on each preset's moderation embed. Entries whose *preview picture* alone is awaiting review are marked 🖼 with a "Picture pending review" note — approve/reject there act on the preset's status, so picture review happens on the moderation embed discord-worker posts (1.4.0) |
| `/preset ban_user` | Ban a user (autocomplete searches preset authors) |
| `/preset unban_user` | Unban a user (autocomplete searches `banned_users`) |

## Dependencies

| Package | Purpose |
|---------|---------|
| `hono` | HTTP framework |
| `@xivdyetools/auth` | JWT/HMAC/Ed25519 helpers |
| `@xivdyetools/worker-kit/rate-limiter` | `CloudflareRateLimiter`, `KVRateLimiter`, `MODERATION_LIMITS` |
| `@xivdyetools/types` | Shared interfaces |
| `@xivdyetools/logger` | Structured logging |
| `@xivdyetools/worker-kit` | Shared Hono middleware |

## Localization

**English only, deliberately** (I18N-009, since 1.7.0). `services/bot-i18n.ts` holds a single
`enLocale` table — `const strings: LocaleData = enLocale` — with no locale map and no `locales/`
directory. `createUserTranslator(env.KV, userId, interaction.locale)` still resolves the moderator's
locale (log lines and analytics want to know what their client asked for), but the resolved code
**selects nothing**: `Translator` points `data` and `fallbackData` at the one English table.

The reasoning: every moderator is an English speaker and this bot talks to nobody else. Its commands
are restricted to the moderation channel, and the messages a preset **author** receives come from
discord-worker, which *is* localized ×6.

What was removed was a `Record<LocaleCode, LocaleData>` whose six entries all pointed at
`enLocale`, plus a KV round-trip and an unused `preset.status.*` key set — an apparatus that could
never return anything but English while looking like it might. If this bot is ever localized, add
real locale files and give the handlers translators; do not restore the map.

## Testing

Vitest + `@xivdyetools/test-utils`. Test files co-located with source as `*.test.ts`.

```bash
npm run test                                              # All tests
npx vitest run src/handlers/commands/preset.test.ts       # Single file
npx vitest run -t "ban"                                   # Pattern match
```

## Related Projects

**Dependencies:** `@xivdyetools/auth`, `@xivdyetools/worker-kit/rate-limiter`, `@xivdyetools/types`, `@xivdyetools/logger`, `@xivdyetools/worker-kit`

**Service Bindings (outbound):** `xivdyetools-presets-api`

**Sibling:** `xivdyetools-discord-worker` (main bot — same KV/D1, different Discord app)

## Deployment Checklist

1. `wrangler secret list` — verify all required secrets are present (especially `BOT_SIGNING_SECRET` for production).
2. `npm run lint && npm run test -- --run && npm run type-check`.
3. `npm run deploy` — publishes the routeless `xivdyetools-moderation-worker-dev` worker (there is no staging env).
4. Run `/preset moderate` in the test guild — confirm pending list loads via Service Binding.
5. `npm run deploy:production`.
6. If slash command schemas changed: `npm run register-commands` (with prod `DISCORD_CLIENT_ID = 1453806659708129374`). The Sprint 4 (FINDING-017) release removed the `reason` option from `/preset moderate`, so re-register against **both** the dev and production moderation apps — Discord keeps showing the old option until then.
7. Confirm `https://moderation-bot.xivdyetools.app/health` returns `{ status: 'ok' }`.
