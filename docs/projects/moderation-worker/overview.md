# Moderation Worker Overview

**xivdyetools-moderation-worker** - Serverless Discord bot for preset moderation

Current version: [docs/versions.md](../../versions.md). Release history:
[`apps/moderation-worker/CHANGELOG.md`](../../../apps/moderation-worker/CHANGELOG.md).

---

## What is the Moderation Worker?

A separate Cloudflare Worker Discord bot dedicated to preset moderation commands. This bot is intentionally separated from the main discord-worker so that:

1. **Users installing the main bot** don't see moderator-only commands
2. **Moderation commands** can be restricted to specific servers/channels
3. **Each bot has independent** rate limits and permissions
4. **Reduced attack surface** - moderation capabilities isolated from public bot

### Why Two Bots?

The main `xivdyetools-discord-worker` provides public commands like `/dye search`, `/harmony`, and `/preset submit`. These are available to any user in any server where the bot is installed.

The moderation-worker handles privileged operations:
- Approving/rejecting community preset submissions
- Banning users from the preset system
- Viewing moderation statistics

By separating these into distinct Discord applications, we ensure that:
- The public bot invite link doesn't expose moderation commands
- Moderators can install the moderation bot to a private admin channel
- Compromising one bot's token doesn't affect the other

---

## Quick Start (Development)

```bash
# From the monorepo root (xivdyetools/)
pnpm install

# Set secrets (one time, from apps/moderation-worker/)
wrangler secret put DISCORD_TOKEN
wrangler secret put DISCORD_PUBLIC_KEY
wrangler secret put MODERATOR_IDS
wrangler secret put MODERATION_CHANNEL_ID

# Start local dev server
pnpm --filter xivdyetools-moderation-worker run dev

# Register slash commands
pnpm --filter xivdyetools-moderation-worker run register-commands

# Deploy — bare `deploy` targets the routeless dev worker (xivdyetools-moderation-worker-dev)
pnpm --filter xivdyetools-moderation-worker run deploy
# Production (xivdyetools-moderation-worker, moderation-bot.xivdyetools.app)
pnpm --filter xivdyetools-moderation-worker run deploy:production
```

See [`docs/operations/DEPLOY_ENVIRONMENTS.md`](../../operations/DEPLOY_ENVIRONMENTS.md).

---

## Architecture

### HTTP Interactions Flow

```
Discord -> POST / -> Ed25519 Verify -> Hono Router -> Handler -> Response
```

Like the main discord-worker, this uses HTTP Interactions (not Gateway WebSocket):
- **No persistent WebSocket** - Receives HTTP POST for each interaction
- **Serverless** - No server to maintain
- **Global** - Runs on Cloudflare's edge network
- **Scalable** - Handles spikes automatically

### Project Structure

```
src/
├── handlers/
│   ├── commands/
│   │   ├── preset.ts        # /preset moderate, ban_user, unban_user
│   │   └── index.ts
│   ├── buttons/
│   │   ├── ban-confirmation.ts   # Confirm/cancel ban buttons
│   │   ├── preset-moderation.ts  # Approve / reject / revert buttons
│   │   └── index.ts
│   └── modals/
│       ├── ban-reason.ts         # Ban reason input
│       ├── preset-rejection.ts   # Rejection reason input
│       └── index.ts
├── services/
│   ├── ban-service.ts       # User ban operations
│   ├── preset-api.ts        # Presets API client
│   ├── bot-i18n.ts          # Bot-specific i18n
│   └── i18n.ts              # i18n strings
├── middleware/
│   └── rate-limit.ts        # CloudflareRateLimiter over RL_COMMAND / RL_AUTOCOMPLETE when bound,
│                            # KVRateLimiter otherwise — both from @xivdyetools/worker-kit/rate-limiter
│                            # (request-ID + logger middleware come from @xivdyetools/worker-kit)
├── types/
│   ├── env.ts               # Environment bindings
│   ├── ban.ts               # Ban-related types
│   └── preset.ts            # Preset types
├── utils/
│   ├── verify.ts            # Ed25519 verification
│   ├── response.ts          # Discord response builders
│   ├── discord-api.ts       # Discord API helpers
│   ├── embed-text.ts        # Embed text building / truncation
│   ├── safe-json.ts         # Throw-safe JSON parsing
│   ├── sql-helpers.ts       # Shared D1 query fragments
│   ├── url-sanitizer.ts     # Link sanitisation for embeds
│   └── env-validation.ts    # validateEnv — required secrets, bindings, production-only checks
└── index.ts                 # Hono app entry point
```

There is **no `locales/` directory.** The bot's strings are English-only by design
(`services/bot-i18n.ts`) — see [Localization](#localization) below.

---

## Available Commands

All commands require moderator permissions and must be used in the designated moderation channel.

### /preset moderate

Moderation actions for community presets.

| Action | Description |
|--------|-------------|
| `pending` | View queue of presets awaiting review |
| `approve` | Approve a preset for public visibility |
| `reject` | Reject a preset with a reason |
| `stats` | View moderation statistics |

```
/preset moderate action:pending
/preset moderate action:approve preset_id:abc123
/preset moderate action:reject preset_id:abc123 reason:Contains inappropriate content
/preset moderate action:stats
```

### /preset ban_user

Ban a user from the preset system. This:
- Hides all their existing presets
- Prevents new submissions
- Records the ban in the database

```
/preset ban_user user:Username#1234
```

A confirmation dialog appears with:
- User's username and Discord ID
- Total preset count
- Links to their recent presets
- Confirm/Cancel buttons

After confirming, a modal prompts for the ban reason.

### /preset unban_user

Unban a user and restore their presets.

```
/preset unban_user user:Username#1234
```

---

## Environment Bindings

| Binding | Type | Purpose |
|---------|------|---------|
| `KV` | KV Namespace | Bot state, and the **fallback** rate-limit counters |
| `DB` | D1 Database | Preset storage, shared with presets-api |
| `PRESETS_API` | Service Binding | Worker-to-worker API calls |
| `RL_COMMAND` | Workers Rate Limiting (`[[ratelimits]]`, 25 / 60 s) | Per-user command limiter (20 + 5 burst) |
| `RL_AUTOCOMPLETE` | Workers Rate Limiting (`[[ratelimits]]`, 70 / 60 s) | Per-user autocomplete limiter (60 + 10 burst) |

Vars: `ENVIRONMENT` (`development` / `production` — **not inheritable**, so it is declared in both
`wrangler.toml` blocks), `DISCORD_CLIENT_ID`, `PRESETS_API_URL`.

`RL_COMMAND` and `RL_AUTOCOMPLETE` are **required when `ENVIRONMENT = "production"`**: losing one
degrades in silence to the KV limiter, which cannot throttle a fast client, so `index.ts` refuses
every request (`500 Service misconfigured`, `/health` included) while the error stands
(FINDING-013).

---

## Secrets

Required (`validateEnv`):
- `DISCORD_TOKEN` - Moderation bot token
- `DISCORD_PUBLIC_KEY` - Ed25519 verification key
- `MODERATOR_IDS` - Comma-separated Discord user IDs
- `MODERATION_CHANNEL_ID` - Channel where moderation commands work (the channel gate reads it, so an unset value blocks every command)

Optional:
- `BOT_API_SECRET` - Presets API authentication (same value as the main worker). Typed optional; `preset-api.ts` only *warns* when it is missing
- `BOT_SIGNING_SECRET` - HMAC key for signed presets-api requests. Optional, but when set it must be **at least 32 characters** or `validateEnv` fails (`@xivdyetools/auth`'s `createHmacKey` throws below that)
- `SUBMISSION_LOG_CHANNEL_ID` - Channel for logging moderation actions

---

## Localization

**English only, deliberately** (I18N-009). `services/bot-i18n.ts` holds one `enLocale` table and
nothing else — there is no `locales/` directory and no locale map. The moderator's locale is still
resolved (for log lines and analytics) but selects nothing: `Translator` points at the one English
table either way. Every
moderator is an English speaker and this bot talks to nobody else: its commands are restricted to
the moderation channel, and the messages a preset *author* receives are sent by discord-worker,
which **is** localized ×6. The previous shape — a `Record<LocaleCode, LocaleData>` with all six
locales pointing at `enLocale` — could never return anything but English while looking like it
might. If this bot is ever localized, add real locale files; do not restore that map.

---

## Security Model

### Channel Restriction

All moderation commands check that they're invoked from `MODERATION_CHANNEL_ID`. This prevents accidental use in public channels and provides an audit trail.

### Moderator Verification

Every command verifies the user's Discord ID is in `MODERATOR_IDS` before processing.

### Shared Authentication

Uses the same `BOT_API_SECRET` as the main discord-worker to authenticate with the presets-api. This ensures consistent authorization across both bots.

---

## Differences from Main Discord Worker

| Aspect | discord-worker | moderation-worker |
|--------|----------------|-------------------|
| **Purpose** | Public user commands | Moderator-only commands |
| **Commands** | 17 registered slash commands | 3 subcommands |
| **Installation** | Any server | Admin servers only |
| **Channel** | Any channel | Designated moderation channel |
| **Image rendering** | SVG/PNG via resvg-wasm | None (text only) |
| **User storage** | Favorites, collections | N/A |
| **Rate limiting** | Per-user limits | Per-user limits too — 20 commands/min (+5 burst) and 60 autocompletes/min (+10 burst), on the native `RL_COMMAND` / `RL_AUTOCOMPLETE` bindings |

---

## Related Documentation

- [Discord Worker Overview](../discord-worker/overview.md) - Main bot architecture
- [Presets API Overview](../presets-api/overview.md) - API that both bots communicate with
- [Presets Moderation](../presets-api/moderation.md) - Content filtering pipeline
- [Secret Rotation](../../operations/SECRET_ROTATION.md) - Secret management procedures
