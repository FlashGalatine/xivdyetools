# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A separate Discord bot dedicated to moderation actions on Community Presets. Runs on Cloudflare Workers via Discord HTTP Interactions and shares D1 + KV with `xivdyetools-discord-worker`, but has its own Discord application (different `DISCORD_CLIENT_ID`) so moderators can interact with a dedicated UI without polluting the main bot's command surface.

This split keeps the privileged moderation surface (ban/unban, approve/reject, revert edits) isolated from the user-facing bot. The only slash command exposed is `/preset` with moderation subcommands; everything else returns "not supported".

## Commands

```bash
npm run dev                  # wrangler dev
npm run deploy               # Deploy to staging
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
│   ├── buttons/
│   │   ├── index.ts                    # Dispatcher (custom_id prefix routing)
│   │   ├── preset-moderation.ts        # Approve/Reject/Revert buttons from embeds
│   │   └── ban-confirmation.ts         # Confirm/cancel destructive ban actions
│   └── modals/
│       ├── index.ts                    # Modal dispatcher + isXModal helpers
│       ├── preset-rejection.ts         # Rejection reason modal
│       └── ban-reason.ts               # Ban reason modal
├── middleware/
│   └── rate-limit.ts                   # KV sliding window with command/autocomplete configs
├── services/
│   ├── ban-service.ts                  # Ban/unban + searchPresetAuthors / searchBannedUsers
│   ├── preset-api.ts                   # Service Binding client + validateSecurityConfig
│   ├── i18n.ts                         # Locale resolution (KV → discord locale → 'en')
│   └── bot-i18n.ts                     # createUserTranslator wrapper
├── utils/
│   ├── verify.ts                       # Ed25519 + Content-Length guard (100KB)
│   ├── safe-json.ts                    # safeParseJSON with depth/freeze checks
│   ├── url-sanitizer.ts                # Strip sensitive query params from logs
│   ├── response.ts                     # pong/ephemeral/deferred/rateLimited
│   ├── discord-api.ts                  # REST helpers
│   └── env-validation.ts               # Required-env check on first request
└── types/
    ├── env.ts                          # Env interface + Interaction enums
    ├── preset.ts                       # Local preset shape for D1 reads
    ├── ban.ts                          # Ban service types
    └── modal.ts                        # Modal payload types
```

### Environment Bindings (wrangler.toml)

| Binding | Type | Purpose |
|---------|------|---------|
| `KV` | KV Namespace (shared with discord-worker) | User preferences + rate-limit counters |
| `DB` | D1 (`xivdyetools-presets`, shared) | Preset rows + `banned_users` table |
| `PRESETS_API` | Service Binding → `xivdyetools-presets-api` | Worker-to-Worker preset moderation calls |

Vars: `DISCORD_CLIENT_ID = 1453806659708129374` (separate Discord app), `PRESETS_API_URL`. Custom domains: `moderation-bot.xivdyetools.app`, `moderation-bot.xivdyetools.projectgalatine.com`.

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
| `BOT_SIGNING_SECRET` | HMAC-SHA256 key for bot request signing (required in prod) |
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

`middleware/rate-limit.ts` uses KV with sliding-window counters under two configs:

| Config | Limit | Burst | TTL |
|--------|-------|-------|-----|
| `command` | 20/min | +5 | 120s |
| `autocomplete` | 60/min | +10 | 120s |

Both fail open (allow on KV error) and use `ctx.waitUntil()` for the increment so the user response is not delayed.

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

### Environment Validation

On the first request per isolate, `validateEnv()` + `presetApi.validateSecurityConfig()` log errors/warnings for missing or misconfigured secrets. Critical missing secrets are logged but the worker continues so partial functionality (e.g., autocomplete) still works.

### Bot → Presets API Signing

When calling `presets-api`, `preset-api.ts` HMACs `timestamp:userId:userName` with `BOT_SIGNING_SECRET` and sends:

> **REFACTOR-027 (2026-07-18 audit):** the signature covers ONLY timestamp + user identity — the HTTP method, path, and body are **not** bound to it. A captured request's headers are reusable for any endpoint within the 5-minute window (relevant only on the `PRESETS_API_URL` fallback path; the Service Binding never leaves Cloudflare). A v2 scheme binding `method:path:sha256(body)` is planned once the signer is extracted into a shared package (REFACTOR-010).
- `Authorization: Bearer <BOT_API_SECRET>`
- `X-Request-Signature: <hex>`
- `X-Request-Timestamp: <unix>`
- `X-User-Discord-ID: <moderator id>`
- `X-User-Discord-Name: <moderator name>`

Without `BOT_SIGNING_SECRET` in production, bot auth is rejected on the API side (see presets-api `auth.ts`).

## Available Commands

| Command | Description |
|---------|-------------|
| `/preset moderate` | Browse pending presets, approve/reject via buttons |
| `/preset ban_user` | Ban a user (autocomplete searches preset authors) |
| `/preset unban_user` | Unban a user (autocomplete searches `banned_users`) |

## Dependencies

| Package | Purpose |
|---------|---------|
| `hono` | HTTP framework |
| `@xivdyetools/auth` | JWT/HMAC/Ed25519 helpers |
| `@xivdyetools/rate-limiter` | KV sliding window backend |
| `@xivdyetools/types` | Shared interfaces |
| `@xivdyetools/logger` | Structured logging |
| `@xivdyetools/worker-middleware` | Shared Hono middleware |
| `discord-interactions` (dev) | Used by `scripts/register-commands.ts` |

## Localization

6 languages: `en`, `ja`, `de`, `fr`, `ko`, `zh`. Translator created per request via `createUserTranslator(env.KV, userId, interaction.locale, logger)`. Locale order:
1. User preference stored in KV.
2. `interaction.locale` (Discord client locale).
3. Default `en`.

## Testing

Vitest + `@xivdyetools/test-utils`. Test files co-located with source as `*.test.ts`.

```bash
npm run test                                              # All tests
npx vitest run src/handlers/commands/preset.test.ts       # Single file
npx vitest run -t "ban"                                   # Pattern match
```

## Related Projects

**Dependencies:** `@xivdyetools/auth`, `@xivdyetools/rate-limiter`, `@xivdyetools/types`, `@xivdyetools/logger`, `@xivdyetools/worker-middleware`

**Service Bindings (outbound):** `xivdyetools-presets-api`

**Sibling:** `xivdyetools-discord-worker` (main bot — same KV/D1, different Discord app)

## Deployment Checklist

1. `wrangler secret list` — verify all required secrets are present (especially `BOT_SIGNING_SECRET` for production).
2. `npm run lint && npm run test -- --run && npm run type-check`.
3. `npm run deploy` — push to staging.
4. Run `/preset moderate` in the test guild — confirm pending list loads via Service Binding.
5. `npm run deploy:production`.
6. If slash command schemas changed: `npm run register-commands` (with prod `DISCORD_CLIENT_ID = 1453806659708129374`).
7. Confirm `https://moderation-bot.xivdyetools.app/health` returns `{ status: 'ok' }`.
