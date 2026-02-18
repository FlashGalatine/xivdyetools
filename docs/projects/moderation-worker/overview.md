# Moderation Worker Overview

**xivdyetools-moderation-worker** v1.0.1 - Serverless Discord bot for preset moderation

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
cd xivdyetools-moderation-worker

# Install dependencies
npm install

# Set secrets (one time)
wrangler secret put DISCORD_TOKEN
wrangler secret put DISCORD_PUBLIC_KEY
wrangler secret put BOT_API_SECRET
wrangler secret put MODERATOR_IDS
wrangler secret put MODERATION_CHANNEL_ID

# Start local dev server
npm run dev

# Register slash commands
npm run register-commands

# Deploy to production
npm run deploy
```

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
│   │   ├── preset-moderation.ts  # Approve/reject buttons
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
│   ├── logger.ts            # Structured logging
│   └── request-id.ts        # Request correlation
├── types/
│   ├── env.ts               # Environment bindings
│   ├── ban.ts               # Ban-related types
│   └── preset.ts            # Preset types
├── utils/
│   ├── verify.ts            # Ed25519 verification
│   ├── response.ts          # Discord response builders
│   └── discord-api.ts       # Discord API helpers
├── locales/                 # i18n translation files
└── index.ts                 # Hono app entry point
```

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
| `KV` | KV Namespace | User preferences (language), shared with discord-worker |
| `DB` | D1 Database | Preset storage, shared with presets-api |
| `PRESETS_API` | Service Binding | Worker-to-worker API calls |

---

## Secrets

Required:
- `DISCORD_TOKEN` - Moderation bot token
- `DISCORD_PUBLIC_KEY` - Ed25519 verification key
- `BOT_API_SECRET` - Presets API authentication (same as main worker)
- `MODERATOR_IDS` - Comma-separated Discord user IDs
- `MODERATION_CHANNEL_ID` - Channel where moderation commands work

Optional:
- `SUBMISSION_LOG_CHANNEL_ID` - Channel for logging moderation actions

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
| **Commands** | 17 slash commands | 3 subcommands |
| **Installation** | Any server | Admin servers only |
| **Channel** | Any channel | Designated moderation channel |
| **Image rendering** | SVG/PNG via resvg-wasm | None (text only) |
| **User storage** | Favorites, collections | N/A |
| **Rate limiting** | Per-user limits | Moderator-only (no limits) |

---

## Related Documentation

- [Discord Worker Overview](../discord-worker/overview.md) - Main bot architecture
- [Presets API Overview](../presets-api/overview.md) - API that both bots communicate with
- [Presets Moderation](../presets-api/moderation.md) - Content filtering pipeline
- [Secret Rotation](../../operations/SECRET_ROTATION.md) - Secret management procedures
