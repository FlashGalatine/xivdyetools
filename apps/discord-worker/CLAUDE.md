# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

The primary FFXIV Dye Tools Discord bot, running on Cloudflare Workers via Discord HTTP Interactions (no Gateway WebSocket — fully serverless). All slash commands, autocompletes, button clicks, and modal submissions hit a single POST endpoint that verifies an Ed25519 signature and routes by interaction type.

This worker replaces the deprecated `xivdyetools-discord-bot` (Node.js + discord.js Gateway bot). It hosts the 5.0 command set spanning colour matching, harmony generation, image extraction, dye comparison, WCAG contrast, colour-vision accessibility, `.chara` character files, community presets, and the Universalis-backed 13G `/budget` ledger. The v4 `/match`, `/match_image`, `/favorites`, `/collection` and `/language` commands were deleted in 5.0. Renders SVG cards converted to PNG via `resvg-wasm`; dominant-color extraction from uploaded images is delegated to `xivdyetools-image-worker` over a Service Binding (`photon-wasm` moved there in the image-worker split — see `docs/operations/IMAGE_WORKER_SPLIT.md`).

## Commands

```bash
npm run dev                  # wrangler dev (local interactions endpoint)
npm run deploy               # Deploy the BETA bot (xivdyetools-discord-worker-dev, *.workers.dev)
npm run deploy:production    # Deploy to production env
npm run test                 # vitest unit tests
npm run test:integration     # vitest integration tests (separate config)
npm run test:all             # Both unit + integration
npm run test:coverage        # Coverage via @vitest/coverage-v8
npm run type-check           # tsc --noEmit
npm run lint                 # eslint src/
npm run register-commands    # tsx scripts/register-commands.ts (publish slash command schemas)
npm run upload-emojis        # tsx scripts/upload-emojis.ts (sync application emojis)
python scripts/instance-latin-fonts.py   # regenerate the static Space Grotesk / Onest faces (see below)
python scripts/subset-cjk-fonts.py       # regenerate the Noto Sans JP/SC/KR subsets
```

**Fonts ship as static instances, never variable files.** resvg's font database cannot move a variable axis — a variable file exposes only its default instance, so every `font-weight` in the card system rendered at one weight (Space Grotesk's default is Light 300) until 2026-08-29. `src/fonts/` holds `SpaceGrotesk-{Regular,SemiBold,Bold}.ttf` and `Onest-{Regular,SemiBold,Bold}.ttf`, instanced by `scripts/instance-latin-fonts.py` from the variable sources in `scripts/font-sources/`; `font-faces.test.ts` renders 400/600/700 through resvg-wasm and fails if any two match. Three lists mirror the `fonts.ts` imports and must move together: `fonts.test.ts` (DEAD-005 mocks), `font-coverage.test.ts` (cmaps) — `font-faces.test.ts` reads the list off `fonts.ts` itself.

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
wrangler secret put MODERATION_BOT_TOKEN     # BUG-009: moderation app's token — makes approve/reject buttons routable
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
│   ├── commands/                  # One file per slash command (about, harmony, dye, accessibility,
│   │                              # comparison, contrast, mixer-v4, gradient, swatch, extractor,
│   │                              # preset, preferences, stats, budget, changelog, manual).
│   │                              # The v4 match / match-image / favorites / collection / language
│   │                              # files were DELETED in 5.0 — don't reintroduce them.
│   │                              # preset-notifications.ts is NOT a command; it builds/sends
│   │                              # the moderation-channel embeds for incoming preset submissions
│   └── buttons/                   # Component handlers (copy.ts, preview-image.ts moderation buttons, index.ts dispatcher)
│                                  # The modals/ placeholder (index.ts only, never wired to a modal) was
│                                  # removed 2026-08-18 — don't reintroduce it without a real consumer.
├── services/
│   ├── analytics.ts               # KV counters + Analytics Engine writes (Tier A column layout)
│   ├── command-trace.ts           # Per-interaction trace: traced ctx, outcome marks, classifier
│   ├── rate-limiter.ts            # Upstash-first sliding window with KV fallback
│   ├── preset-favorites.ts        # Per-user preset favourites in KV (/preset favorite add|remove|list)
│   ├── preferences.ts             # User preferences (race/clan, world, language, matching, theme)
│   ├── preset-api.ts              # Service Binding client to presets-api
│   ├── i18n.ts                    # Locale resolution + dye name lookup
│   ├── bot-i18n.ts                # Bot UI translator (createTranslator/createUserTranslator)
│   ├── emoji.ts                   # Application emoji helpers
│   ├── fonts.ts                   # Bundled TTF buffers for resvg (brand + Noto Sans JP/SC/KR subsets)
│   ├── changelog-parser.ts        # Parse CHANGELOG-laymans.md files (root → /webhooks/github; this app's → /changelog)
│   ├── announcements.ts           # Send formatted release embeds
│   ├── svg/                       # Card renderers + resvg PNG conversion
│   ├── image-client.ts            # IMAGE_WORKER service-binding client (photon moved to xivdyetools-image-worker)
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
    ├── markdown.d.ts              # `*.md` imports are strings (wrangler Text rule / vitest plugin)
    └── preferences.ts             # CLANS_BY_RACE, preference shapes
```

### Environment Bindings (wrangler.toml)

| Binding | Type | Purpose |
|---------|------|---------|
| `KV` | KV Namespace | Rate limiting fallback, user preferences, preset favourites, analytics counters |
| `ANALYTICS` | Analytics Engine (`xivdyetools_bot_analytics`) | Long-term command usage telemetry |
| `PRESETS_API` | Service Binding → `xivdyetools-presets-api` | Worker-to-Worker preset CRUD |
| `UNIVERSALIS_PROXY` | Service Binding → `xivdyetools-api-worker` | Market board prices for `/budget` (via the absorbed `/api/v2/*` proxy routes) |
| `IMAGE_WORKER` | Service Binding → `xivdyetools-image-worker` | Photon-backed pixel extraction for `/extractor` (see `docs/operations/IMAGE_WORKER_SPLIT.md`) |

Vars: `DISCORD_CLIENT_ID`, `PRESETS_API_URL`, `ANNOUNCEMENT_CHANNEL_ID`. Custom domains: `bot.xivdyetools.app`, `bot.xivdyetools.projectgalatine.com`. `[[rules]]` includes `**/*.md` as `Text` (the bot's `CHANGELOG-laymans.md`, imported as a string by `/changelog`; `src/types/markdown.d.ts` types it and `vitest.markdown-plugin.ts` mirrors it for tests) and `**/*.ttf` as `Data` (CJK subset fonts bundled into the Worker).

### Required Secrets

| Secret | Purpose |
|--------|---------|
| `DISCORD_TOKEN` | Bot token for Discord REST follow-ups |
| `DISCORD_PUBLIC_KEY` | Ed25519 public key for signature verification |

### Optional Secrets

| Secret | Purpose |
|--------|---------|
| `BOT_API_SECRET` | Bearer token for outbound calls to presets-api |
| `BOT_SIGNING_SECRET` | HMAC-SHA256 key for bot request signing — min. 32 characters (checked by `validateEnv`; `@xivdyetools/auth` rejects shorter keys) |
| `INTERNAL_WEBHOOK_SECRET` | Auth for inbound `/webhooks/preset-submission` |
| `GITHUB_WEBHOOK_SECRET` | HMAC-SHA256 key for GitHub push webhook |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Primary rate-limit backend (KV is fallback) |
| `MODERATOR_IDS` | CSV of Discord IDs allowed to moderate presets |
| `MODERATION_CHANNEL_ID` | Channel for pending presets posted from web app |
| `MODERATION_BOT_TOKEN` | BUG-009: bot token of the MODERATION Discord application. When set, moderation embeds are posted with it so approve/reject buttons route to moderation-worker; when unset, embeds omit buttons and hint at `/preset moderate` |
| `SUBMISSION_LOG_CHANNEL_ID` | Channel for auto-approved preset audit log |
| `STATS_AUTHORIZED_USERS` | CSV of Discord IDs allowed to use `/stats` |

## Key Patterns

### Command Routing (`src/index.ts`)

A single `switch (commandName)` in `handleCommand()` dispatches to handlers in `handlers/commands/`. Tracking is a dispatcher-owned `CommandTrace` finished in the `finally` after the handler's background work settles (see Analytics Tracking below). Rate-limit check runs before dispatch (skipped only for `about`, `manual` and `changelog` — `/stats` has been rate-limited since the 2026-08-21 security audit, FINDING-033).

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

Tier A (2026-08-29, spec `docs/superpowers/specs/2026-08-29-bot-analytics-tier-a-design.md`): `handleCommand()` starts a `CommandTrace` (`services/command-trace.ts`) before the rate-limit check and hands every handler a **traced `ExecutionContext`** whose `waitUntil` also records the promise on the trace; the `finally` calls `finishCommandTrace()`, which drains those promises and then writes the datapoint through `trackCommandWithKV()` — so `success`/latency describe the deferred work, not the deferred ack. Handlers never finish a trace; a catch that ends the command with an error embed calls `markCommandOutcome(interaction, classifyError(error[, 'render']))`. Columns: blobs 1–5 unchanged (command, userId, guild/dm, success, **outcome class**), blob6 subcommand/button kind, blob7 locale bucket, blob8 `command|button`, double2 real latency. Copy-button clicks are AE-only `kind=button` rows. **Never record an option value, hex, search text, world, image name, guild/channel id or error message** — `PRIVACY_POLICY.md` §2 promises it. Queries: `docs/operations/ANALYTICS_QUERIES.md` (Discord section).

### Autocomplete

Special routing inside `handleAutocomplete()`:
- `/preset` autocomplete checks subcommand: `edit` shows the user's own presets, `favorite remove` shows the user's favourited presets, `show`/`vote`/`moderate` query approved presets via the Service Binding.
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

`sanitizePresetName()` and `sanitizePresetDescription()` (`utils/sanitize.ts`) delegate to `@xivdyetools/bot-logic`'s `sanitizeEmbedText` — control / zero-width / bidi stripping, `@everyone`/`@here`/`<@…>` defusing, markdown + masked-link escaping, length caps — and every user-sourced string that reaches an embed (preset names/descriptions/tags/authors, `/dye search` queries, `.chara` error echoes, `/budget` names, webhook author/tags) goes through them. Every outbound payload built in `utils/discord-api.ts` carries `allowed_mentions: { parse: [] }` unless the caller passes `allowedMentions` (FINDING-019, 2026-08-21 security audit). The swatch PNG still receives the raw text — the SVG layer XML-escapes it and backslashes would render.

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
| `/about` | Bot info, registry-built command roster, Removed-in-v5 field |
| `/harmony` | Harmony palettes (11A card — found dye vs computed ideal) |
| `/dye search\|info\|list\|random` | Dye database lookups (11B cards) |
| `/comparison` | 14A Duel / 14C triangle router (2–4 dyes) |
| `/contrast` | WCAG 1.4.11 ratios, 13A/13B/13C·1 router (2–4 dyes) |
| `/accessibility` + `/a11y` | Colour-vision lenses (13D/13E/13H via `vision:`) |
| `/mixer` | 12F ratio-sweep blending card |
| `/gradient` | 12H gradient card (distinct dyes, 3-stage cap) |
| `/swatch` | `.chara` character-file frame (required `file:` attachment) |
| `/extractor` | Image ramp (14K) / colour sheet (14J·2) |
| `/preferences` | Race/clan/world/language/matching/theme preferences |
| `/preset` | Browse/submit/vote/edit community presets |
| `/budget` | 13G ledger — tier-group pricing via Universalis |
| `/changelog` | The bot's own release notes — `apps/discord-worker/CHANGELOG-laymans.md`, bundled as text at deploy time (ephemeral) |
| `/manual` | Help topics (📸 ♿ 🔲 📐 🪙 👤) with learn-more links |
| `/stats` | Usage stats incl. the 5.0 adoption panel (gated) |

## Dependencies

| Package | Purpose |
|---------|---------|
| `hono` | HTTP framework |
| `@xivdyetools/core` | Dye database, color algorithms, k-d tree matcher |
| `@xivdyetools/types` | Branded types and shared interfaces |
| `@xivdyetools/auth` | JWT verify, HMAC, Ed25519 helpers |
| `@xivdyetools/worker-kit/rate-limiter` | Sliding window backends (Memory/KV/Upstash) |
| `@xivdyetools/svg` | Pure SVG card generators |
| `@xivdyetools/bot-logic` | Platform-agnostic command business logic |
| `@xivdyetools/bot-logic/i18n` | Bot localization strings (absorbed from bot-i18n) |
| `@xivdyetools/core/blending` | Six blending algorithms (moved from the retired `@xivdyetools/color-blending`) |
| `@xivdyetools/logger` | Structured logging with secret redaction |
| `@xivdyetools/worker-kit` | Shared Hono middleware (request ID, logger, rate limit) |
| `@resvg/resvg-wasm` | SVG → PNG rasterization |
| `IMAGE_WORKER` (service binding) | Photon-backed pixel extraction for `/extractor`, routed to `xivdyetools-image-worker` — `@cf-wasm/photon` itself was removed from this Worker's dependencies in the image-worker split (see `docs/operations/IMAGE_WORKER_SPLIT.md`) |

## Localization

6 languages: `en`, `ja`, `de`, `fr`, `ko`, `zh`. Locale resolution priority:
1. User preference stored in KV
2. `interaction.locale` (Discord client locale)
3. Default `en`

Dye names come from `@xivdyetools/core`; bot UI strings come from `@xivdyetools/bot-logic/i18n` via `createTranslator(locale)` / `createUserTranslator(env.KV, userId, locale, logger)`.

## Webhook Endpoints

| Path | Auth | Purpose |
|------|------|---------|
| `GET /health` | None | Health probe |
| `POST /` | Ed25519 | Discord interactions |
| `POST /webhooks/preset-submission` | Bearer (`INTERNAL_WEBHOOK_SECRET`) | Forwarded preset submissions from web app |
| `POST /webhooks/github` | HMAC-SHA256 (`GITHUB_WEBHOOK_SECRET`) | Push events that update the root (product-level) `CHANGELOG-laymans.md` |

## Testing

Vitest + `@xivdyetools/test-utils` for D1/KV/R2 mocks. Test files are co-located with source as `*.test.ts`. Integration tests live alongside unit tests but use `vitest.integration.config.ts`.

```bash
npm run test                                              # All unit tests
npx vitest run src/handlers/commands/harmony.test.ts      # One file
npx vitest run -t "harmony"                               # Pattern match
npm run test:integration                                  # Integration suite
```

## Related Projects

**Dependencies:** `@xivdyetools/core` (incl. `/blending`), `@xivdyetools/types`, `@xivdyetools/auth`, `@xivdyetools/worker-kit/rate-limiter`, `@xivdyetools/svg`, `@xivdyetools/bot-logic` (incl. `/i18n`), `@xivdyetools/logger`, `@xivdyetools/worker-kit`

**Service Bindings (outbound):** `xivdyetools-presets-api`, `xivdyetools-api-worker` (Universalis proxy routes), `xivdyetools-image-worker` (photon pixel extraction for `/extractor`)

**Service Bindings (inbound):** `xivdyetools-presets-api` calls back via `DISCORD_WORKER` for notifications

**Sibling:** `xivdyetools-moderation-worker` (separate Discord application for the moderation bot UI)

## Deployment Checklist

1. `wrangler secret list` — verify all required secrets are present.
2. `npm run lint && npm run test -- --run && npm run type-check`.
3. `npm run deploy` — publishes the BETA bot (`xivdyetools-discord-worker-dev`; there is no staging env).
4. Smoke-test core commands in the test guild.
5. `npm run deploy:production` — or simply merge to `main`: `deploy-discord-worker.yml` deploys `--env production` **and then runs `register-commands` itself** (`DISCORD_TOKEN` from repo secrets), so a manual `npm run register-commands` is only needed for out-of-band schema pushes. The beta workflow registers guild-scoped commands the same way.
6. Hit `https://bot.xivdyetools.app/health` to confirm the new build is live.
