# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

The primary FFXIV Dye Tools Discord bot, running on Cloudflare Workers via Discord HTTP Interactions (no Gateway WebSocket — fully serverless). All slash commands, autocompletes, button clicks, and modal submissions hit a single POST endpoint that verifies an Ed25519 signature and routes by interaction type.

This worker replaces the deprecated `xivdyetools-discord-bot` (Node.js + discord.js Gateway bot). It hosts ~20 user-facing commands spanning color matching, harmony generation, image extraction, dye comparison, accessibility checks, favorites/collections, community presets, and a Universalis-backed `/budget` command. Renders SVG cards converted to PNG via `resvg-wasm` and uses `photon-wasm` for dominant-color extraction from uploaded images.

## Commands

```bash
npm run dev                  # wrangler dev (local interactions endpoint)
npm run deploy               # Deploy to staging (default env)
npm run deploy:production    # Deploy to production env
npm run test                 # vitest unit tests
npm run test:integration     # vitest integration tests (separate config)
npm run test:all             # Both unit + integration
npm run test:coverage        # Coverage via @vitest/coverage-v8
npm run type-check           # tsc --noEmit
npm run lint                 # eslint src/
npm run register-commands    # tsx scripts/register-commands.ts (publish slash command schemas)
npm run upload-emojis        # tsx scripts/upload-emojis.ts (sync application emojis)
```

### Registering Commands

```powershell
$env:DISCORD_TOKEN = "..."
$env:DISCORD_CLIENT_ID = "1447108133020369048"
$env:DISCORD_GUILD_ID = "<test-guild>"   # Optional — guild commands publish instantly
npm run register-commands
```

### Setting Secrets

```bash
wrangler secret put DISCORD_TOKEN
wrangler secret put DISCORD_PUBLIC_KEY
wrangler secret put BOT_API_SECRET
wrangler secret put BOT_SIGNING_SECRET
wrangler secret put INTERNAL_WEBHOOK_SECRET
wrangler secret put GITHUB_WEBHOOK_SECRET
wrangler secret put UPSTASH_REDIS_REST_URL
wrangler secret put UPSTASH_REDIS_REST_TOKEN
wrangler secret put STATS_AUTHORIZED_USERS   # CSV of Discord IDs for /stats
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
Discord  ──POST /──►  Ed25519 verify (utils/verify.ts)
                        │
                        ▼
              Hono router (src/index.ts)
                        │
        ┌───────────────┼─────────────────┬──────────────┐
        ▼               ▼                 ▼              ▼
       PING         APPLICATION_COMMAND  AUTOCOMPLETE   MESSAGE_COMPONENT
       PONG               │                 │              │
                          ▼                 ▼              ▼
                  rate-limiter (KV/Upstash) handlers/buttons
                          │
                          ▼
                  handlers/commands/<name>
                          │
                          ▼
                  defer  →  follow-up via Discord REST
```

The `/webhooks/preset-submission` endpoint receives notifications from `presets-api` and posts embeds + approve/reject buttons to the moderation channel. The `/webhooks/github` endpoint listens for pushes that modify `CHANGELOG-laymans.md` and announces releases to the announcement channel.

### Key Directories

```
src/
├── index.ts                       # Hono app, routing, Ed25519 verification, webhooks
├── handlers/
│   ├── commands/                  # One file per slash command (about, harmony, dye, match, match-image,
│   │                              # accessibility, comparison, mixer-v4, gradient, swatch, extractor,
│   │                              # favorites, collection, preset, language, stats, budget, manual)
│   ├── buttons/                   # Component handlers (copy.ts, index.ts dispatcher)
│   └── modals/                    # Modal submission handlers (currently unused in this worker)
├── services/
│   ├── analytics.ts               # KV counters + Analytics Engine writes
│   ├── rate-limiter.ts            # Upstash-first sliding window with KV fallback
│   ├── user-storage.ts            # Favorites + collections in KV
│   ├── preferences.ts             # User preferences (race/clan, world, language)
│   ├── preset-api.ts              # Service Binding client to presets-api
│   ├── i18n.ts                    # Locale resolution + dye name lookup
│   ├── bot-i18n.ts                # Bot UI translator (createTranslator/createUserTranslator)
│   ├── emoji.ts                   # Application emoji helpers
│   ├── component-context.ts       # Encodes interaction context into custom_id payloads
│   ├── changelog-parser.ts        # Parse CHANGELOG-laymans.md for /webhooks/github
│   ├── announcements.ts           # Send formatted release embeds
│   ├── svg/                       # Card renderers + resvg PNG conversion
│   ├── image/                     # Photon WASM dominant color + validators
│   └── budget/                    # Universalis price cache, calculator, quick picks
├── utils/
│   ├── verify.ts                  # Ed25519 signature verification + timingSafeEqual
│   ├── github-verify.ts           # HMAC-SHA256 verification for GitHub webhooks
│   ├── response.ts                # pong/ephemeral/deferred response builders
│   ├── discord-api.ts             # REST helpers (sendMessage, follow-ups, edits)
│   ├── error-response.ts          # Generic error message builders
│   ├── sanitize.ts                # sanitizePresetName / sanitizePresetDescription
│   ├── color.ts                   # dyeService singleton, hex helpers
│   └── env-validation.ts          # Validate required env vars at first request
└── types/
    ├── env.ts                     # Env interface, InteractionType/ResponseType enums
    ├── preset.ts                  # PresetNotificationPayload, STATUS_DISPLAY
    ├── github.ts                  # GitHubPushPayload
    ├── budget.ts                  # Budget calculator types
    ├── image.ts                   # Image processing types
    └── preferences.ts             # CLANS_BY_RACE, preference shapes
```

### Environment Bindings (wrangler.toml)

| Binding | Type | Purpose |
|---------|------|---------|
| `KV` | KV Namespace | Rate limiting fallback, user preferences, favorites, collections, analytics counters |
| `DB` | D1 (`xivdyetools-presets`) | Shared with presets-api / moderation-worker |
| `ANALYTICS` | Analytics Engine (`xivdyetools_bot_analytics`) | Long-term command usage telemetry |
| `PRESETS_API` | Service Binding → `xivdyetools-presets-api` | Worker-to-Worker preset CRUD |
| `UNIVERSALIS_PROXY` | Service Binding → `xivdyetools-universalis-proxy` | Market board prices for `/budget` |

Vars: `DISCORD_CLIENT_ID`, `PRESETS_API_URL`, `ANNOUNCEMENT_CHANNEL_ID`. Custom domains: `bot.xivdyetools.app`, `bot.xivdyetools.projectgalatine.com`. `[[rules]]` includes `**/*.ttf` as `Data` (CJK subset fonts bundled into the Worker).

### Required Secrets

| Secret | Purpose |
|--------|---------|
| `DISCORD_TOKEN` | Bot token for Discord REST follow-ups |
| `DISCORD_PUBLIC_KEY` | Ed25519 public key for signature verification |

### Optional Secrets

| Secret | Purpose |
|--------|---------|
| `BOT_API_SECRET` | Bearer token for outbound calls to presets-api |
| `BOT_SIGNING_SECRET` | HMAC-SHA256 key for bot request signing |
| `INTERNAL_WEBHOOK_SECRET` | Auth for inbound `/webhooks/preset-submission` |
| `GITHUB_WEBHOOK_SECRET` | HMAC-SHA256 key for GitHub push webhook |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Primary rate-limit backend (KV is fallback) |
| `MODERATOR_IDS` | CSV of Discord IDs allowed to moderate presets |
| `MODERATION_CHANNEL_ID` | Channel for pending presets posted from web app |
| `SUBMISSION_LOG_CHANNEL_ID` | Channel for auto-approved preset audit log |
| `STATS_AUTHORIZED_USERS` | CSV of Discord IDs allowed to use `/stats` |

## Key Patterns

### Command Routing (`src/index.ts`)

A single `switch (commandName)` in `handleCommand()` dispatches to handlers in `handlers/commands/`. Tracking is done in a `try/finally` so analytics record actual success/failure rather than assuming success. Rate-limit check runs before dispatch (skipped for `about`, `manual`, `stats`).

### Deferred Responses

Long-running handlers return `DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE` immediately, then call `sendFollowup()` (utils/discord-api.ts) once SVG rendering or external API calls finish. Image-generating commands use `ctx.waitUntil()` so the Worker isolates can shut down cleanly.

### Rate Limiting

`services/rate-limiter.ts` prefers Upstash Redis (real distributed sliding window) and falls back to per-isolate KV reads. Image processing commands have tighter limits than text commands. Missing `userId` is treated as a hard reject to prevent bypass.

### SVG → PNG Pipeline

1. Build SVG string with embedded CJK subset fonts (`services/svg/*.ts`).
2. `renderSvgToPng()` (`services/svg/renderer.ts`) invokes `@resvg/resvg-wasm`.
3. Returned as a `multipart/form-data` attachment via Discord REST.

### Preset API Service Binding

Always prefer the Service Binding (`env.PRESETS_API.fetch(req)`) — zero HTTP overhead. Falls back to `PRESETS_API_URL` for local dev when the binding is absent.

### Analytics Tracking

`trackCommandWithKV(env, { commandName, userId, guildId, success })` increments KV counters (real-time `/stats` data) and writes to Analytics Engine (`ANALYTICS` binding) for long-term aggregation. Always called from the `finally` block.

### Autocomplete

Special routing inside `handleAutocomplete()`:
- `/preset` autocomplete checks subcommand: `edit` shows the user's own presets, `show`/`vote` queries approved presets via the Service Binding.
- `/collection` autocomplete reads collections from KV.
- `/preferences` clan field uses `CLANS_BY_RACE` table; world field reuses budget's world autocomplete.
- `/budget` delegates entirely to `handleBudgetAutocomplete()`.

## Security Patterns

### Ed25519 Signature Verification

`verifyDiscordRequest()` validates `X-Signature-Ed25519` + `X-Signature-Timestamp`. Body is read once and re-used for parsing. Max body size 100KB; Content-Length validated up-front to avoid OOM.

### Timing-Safe Comparisons

`timingSafeEqual()` (utils/verify.ts) is used for the webhook bearer token comparison so a config-missing path returns `Unauthorized` without a measurable timing delta against a wrong-secret path.

### Webhook Payload Limits

Both `/webhooks/preset-submission` and `/webhooks/github` enforce 10KB payload caps before parsing JSON.

### User Content Sanitization

`sanitizePresetName()` and `sanitizePresetDescription()` strip control characters, invisible Unicode, and Zalgo before sending names/descriptions into Discord embeds.

### Security Headers

Applied to every response via post-handler middleware:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

## Available Commands

| Command | Description |
|---------|-------------|
| `/about` | Bot info and links |
| `/harmony` | Generate harmony palettes from a base color |
| `/dye search\|info\|list\|random` | Dye database lookups |
| `/match` | Closest dye to a hex color |
| `/match_image` | Extract dominant colors from an attached image |
| `/comparison` | Side-by-side dye comparison |
| `/accessibility` | Colorblind simulation + WCAG contrast |
| `/mixer` | V4 dye blending (six algorithms) |
| `/gradient` | Color gradient between two endpoints |
| `/swatch` | Single-dye swatch card |
| `/extractor` | V4 image color extractor |
| `/preferences` | Set race/clan/world/language preferences |
| `/favorites` | Manage favorite dyes (KV-backed, 20 max) |
| `/collection` | Custom dye collections (50 max, 20 dyes each) |
| `/preset` | Browse/submit/vote/edit community presets |
| `/budget` | Universalis pricing for a dye palette |
| `/language` | Set bot language (en/ja/de/fr/ko/zh) |
| `/manual` | Help guide (`topic:` option for deep-links) |
| `/stats` | Usage stats (gated by `STATS_AUTHORIZED_USERS`) |

## Dependencies

| Package | Purpose |
|---------|---------|
| `hono` | HTTP framework |
| `@xivdyetools/core` | Dye database, color algorithms, k-d tree matcher |
| `@xivdyetools/types` | Branded types and shared interfaces |
| `@xivdyetools/auth` | JWT verify, HMAC, Ed25519 helpers |
| `@xivdyetools/rate-limiter` | Sliding window backends (Memory/KV/Upstash) |
| `@xivdyetools/svg` | Pure SVG card generators |
| `@xivdyetools/bot-logic` | Platform-agnostic command business logic |
| `@xivdyetools/bot-i18n` | Bot localization strings |
| `@xivdyetools/color-blending` | Six blending algorithms |
| `@xivdyetools/logger` | Structured logging with secret redaction |
| `@xivdyetools/worker-middleware` | Shared Hono middleware (request ID, logger, rate limit) |
| `@resvg/resvg-wasm` | SVG → PNG rasterization |
| `@cf-wasm/photon` | Image manipulation (dominant color) |

## Localization

6 languages: `en`, `ja`, `de`, `fr`, `ko`, `zh`. Locale resolution priority:
1. User preference stored in KV
2. `interaction.locale` (Discord client locale)
3. Default `en`

Dye names come from `@xivdyetools/core`; bot UI strings come from `@xivdyetools/bot-i18n` via `createTranslator(locale)` / `createUserTranslator(env.KV, userId, locale, logger)`.

## Webhook Endpoints

| Path | Auth | Purpose |
|------|------|---------|
| `GET /health` | None | Health probe |
| `POST /` | Ed25519 | Discord interactions |
| `POST /webhooks/preset-submission` | Bearer (`INTERNAL_WEBHOOK_SECRET`) | Forwarded preset submissions from web app |
| `POST /webhooks/github` | HMAC-SHA256 (`GITHUB_WEBHOOK_SECRET`) | Push events that update `CHANGELOG-laymans.md` |

## Testing

Vitest + `@xivdyetools/test-utils` for D1/KV/R2 mocks. Test files are co-located with source as `*.test.ts`. Integration tests live alongside unit tests but use `vitest.integration.config.ts`.

```bash
npm run test                                              # All unit tests
npx vitest run src/handlers/commands/harmony.test.ts      # One file
npx vitest run -t "harmony"                               # Pattern match
npm run test:integration                                  # Integration suite
```

## Related Projects

**Dependencies:** `@xivdyetools/core`, `@xivdyetools/types`, `@xivdyetools/auth`, `@xivdyetools/rate-limiter`, `@xivdyetools/svg`, `@xivdyetools/bot-logic`, `@xivdyetools/bot-i18n`, `@xivdyetools/color-blending`, `@xivdyetools/logger`, `@xivdyetools/worker-middleware`

**Service Bindings (outbound):** `xivdyetools-presets-api`, `xivdyetools-universalis-proxy`

**Service Bindings (inbound):** `xivdyetools-presets-api` calls back via `DISCORD_WORKER` for notifications

**Sibling:** `xivdyetools-moderation-worker` (separate Discord application for the moderation bot UI)

## Deployment Checklist

1. `wrangler secret list` — verify all required secrets are present.
2. `npm run lint && npm run test -- --run && npm run type-check`.
3. `npm run deploy` — push to staging.
4. Smoke-test core commands in the test guild.
5. `npm run deploy:production`.
6. If slash command schemas changed: `npm run register-commands` (production token).
7. Hit `https://bot.xivdyetools.app/health` to confirm the new build is live.
