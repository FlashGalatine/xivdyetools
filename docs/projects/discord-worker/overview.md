# Discord Worker Overview

**xivdyetools-discord-worker** v2.3.1 - Serverless Discord bot for FFXIV dye tools

---

## What is the Discord Worker?

A Cloudflare Worker that brings XIV Dye Tools to Discord via 21 slash commands. Uses HTTP Interactions (not Gateway WebSocket) for serverless, globally distributed operation.

### Recent Features (v2.3.x)

- **User Ban System** - `/preset ban_user` and `/preset unban_user` for content moderation
- **KV Schema Versioning** - Version-based key prefixes for future migrations
- **Analytics Fix** - Now tracks actual command success status
- **Webhook Auth Security** - Fixed timing-safe comparison for webhook authentication

---

## Quick Start (Development)

```bash
cd xivdyetools-discord-worker

# Install dependencies
npm install

# Set secrets (one time)
wrangler secret put DISCORD_TOKEN
wrangler secret put DISCORD_PUBLIC_KEY

# Start local dev server
npm run dev

# Register slash commands
npm run register-commands

# Deploy to staging
npm run deploy

# Deploy to production
npm run deploy:production
```

---

## Architecture

### HTTP Interactions Flow

```
Discord → POST / → Ed25519 Verify → Hono Router → Handler → Response
```

Unlike traditional Gateway bots:
- **No persistent WebSocket** - Receives HTTP POST for each interaction
- **Serverless** - No server to maintain
- **Global** - Runs on Cloudflare's edge network
- **Scalable** - Handles spikes automatically

### Project Structure

```
src/
├── handlers/
│   ├── commands/         # Slash command handlers
│   │   ├── harmony.ts
│   │   ├── match.ts
│   │   ├── dye.ts
│   │   ├── preset-ban.ts    # NEW: User ban system
│   │   └── ...
│   ├── buttons/          # Button interaction handlers
│   │   ├── ban-confirmation.ts  # NEW: Ban confirm/cancel
│   │   └── ...
│   └── modals/           # Modal submission handlers
│       ├── ban-reason.ts     # NEW: Ban reason input
│       └── ...
├── services/
│   ├── svg/              # SVG generation
│   ├── image/            # Image processing (Photon WASM)
│   ├── analytics.ts      # Usage tracking
│   ├── rate-limiter.ts   # Per-user rate limiting
│   ├── user-storage.ts   # Favorites & collections (versioned keys)
│   ├── preset-api.ts     # Presets API client
│   └── ban-service.ts    # NEW: User ban operations
└── utils/
    ├── verify.ts         # Ed25519 verification
    └── response.ts       # Discord response builders
```

---

## Available Commands

> **Web App v4 Terminology Note**
>
> The Discord worker retains original command names for backwards compatibility. Here's how they map to web app v4 tool names:
>
> | Discord Command | Web App v4 Tool | Route |
> |-----------------|-----------------|-------|
> | `/match`, `/match_image` | Palette Extractor | `/extractor` |
> | `/mixer` | Gradient Builder | `/gradient` |
> | `/preset *` | Community Presets | `/presets` |

### Color Tools
| Command | Description |
|---------|-------------|
| `/harmony` | Generate harmonious dye combinations |
| `/match` | Find closest dye to a hex color |
| `/match_image` | Extract colors from image and match to dyes |
| `/mixer` | Create color gradient between two colors |

### Dye Database
| Command | Description |
|---------|-------------|
| `/dye search` | Search dyes by name |
| `/dye info` | Get detailed dye information |
| `/dye list` | List dyes by category |
| `/dye random` | Get random dye suggestions |

### Analysis
| Command | Description |
|---------|-------------|
| `/comparison` | Compare 2-4 dyes side by side |
| `/accessibility` | Colorblindness simulation |

### User Data
| Command | Description |
|---------|-------------|
| `/favorites` | Manage favorite dyes |
| `/collection` | Manage custom dye collections |

### Community
| Command | Description |
|---------|-------------|
| `/preset list` | Browse community presets |
| `/preset show` | View preset details |
| `/preset submit` | Submit new preset |
| `/preset vote` | Vote on presets |
| `/preset ban_user` | Ban user from preset system (moderators) |
| `/preset unban_user` | Unban user and restore presets (moderators) |

### Utility
| Command | Description |
|---------|-------------|
| `/language` | Set preferred language |
| `/manual` | Show help guide |
| `/about` | Bot information |
| `/stats` | Usage statistics (moderators only) |

---

## Key Features

### SVG to PNG Rendering

Commands that need images generate SVG and render to PNG:

```typescript
// 1. Build SVG
const svg = buildComparisonSvg(dyes);

// 2. Render to PNG via resvg-wasm
const png = await renderSvgToPng(svg);

// 3. Send as Discord attachment
await sendFollowup(interaction, env, {
  embeds: [...],
  files: [{ name: 'comparison.png', data: png }]
});
```

### Rate Limiting

Per-user sliding window rate limiting:
- Image commands: 5/minute
- Standard commands: 15/minute
- Stored in Cloudflare KV

### User Storage

Favorites and collections stored in KV:
- Max 20 favorites per user
- Max 50 collections per user
- Max 20 dyes per collection

---

## Environment Bindings

| Binding | Type | Purpose |
|---------|------|---------|
| `KV` | KV Namespace | Rate limits, user data, stats |
| `DB` | D1 Database | Preset storage |
| `ANALYTICS` | Analytics Engine | Command tracking |
| `PRESETS_API` | Service Binding | Worker-to-worker API calls |

---

## Secrets

Required:
- `DISCORD_TOKEN` - Bot token
- `DISCORD_PUBLIC_KEY` - Ed25519 verification key

Optional:
- `BOT_API_SECRET` - Presets API authentication
- `MODERATOR_IDS` - Comma-separated user IDs
- `STATS_AUTHORIZED_USERS` - Users who can view /stats

---

## Related Documentation

- [Commands](commands.md) - Full command reference
- [Interactions](interactions.md) - Button, modal, autocomplete handlers
- [Rendering](rendering.md) - SVG generation and PNG output
- [Deployment](deployment.md) - Deployment procedures
