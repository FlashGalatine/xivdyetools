# Discord Worker Overview

**xivdyetools-discord-worker** v4.1.2 - Serverless Discord bot for FFXIV dye tools

---

## What is the Discord Worker?

A Cloudflare Worker that brings XIV Dye Tools to Discord via slash commands. Uses HTTP Interactions (not Gateway WebSocket) for serverless, globally distributed operation.

### Recent Features (v4.x)

- **v4.1.x** - Budget quick picks updated with 20 Cosmic dyes, prevent duplicate results for extractor, type imports migrated from core to `@xivdyetools/types`
- **v4.0.x** - Command renaming (`match` to `extractor`, `mixer` to `gradient`), new `mixer` and `swatch` commands, 7 bug fixes (LocalizationService race condition, broken budget embed, collection rename sanitization, Discord API timeout handling)

---

## Quick Start (Development)

```bash
# From monorepo root
pnpm install

# Start local dev server
pnpm --filter xivdyetools-discord-worker run dev

# Register slash commands
pnpm --filter xivdyetools-discord-worker run register-commands

# Deploy
pnpm --filter xivdyetools-discord-worker run deploy:production
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
│   │   ├── extractor.ts     # v4: was match.ts
│   │   ├── gradient.ts      # v4: was mixer.ts
│   │   ├── mixer.ts         # v4 NEW: RGB blending
│   │   ├── swatch.ts        # v4 NEW: character colors
│   │   ├── budget.ts        # v4 NEW: market board prices
│   │   ├── dye.ts
│   │   ├── comparison.ts
│   │   ├── accessibility.ts
│   │   ├── preferences.ts   # v4 NEW: user preferences
│   │   └── ...
│   ├── buttons/          # Button interaction handlers
│   └── modals/           # Modal submission handlers
├── services/
│   ├── analytics.ts      # Usage tracking
│   ├── rate-limiter.ts   # Per-user rate limiting
│   ├── user-storage.ts   # Favorites & collections (versioned keys)
│   └── preset-api.ts     # Presets API client
└── utils/
    ├── verify.ts         # Ed25519 verification
    └── response.ts       # Discord response builders
```

Note: SVG generation, bot command logic, and i18n are now in shared packages:
- `@xivdyetools/svg` — SVG card generation
- `@xivdyetools/bot-logic` — Platform-agnostic command logic
- `@xivdyetools/bot-i18n` — Bot-specific localization

---

## Available Commands

### Color Tools
| Command | Description |
|---------|-------------|
| `/harmony` | Generate harmonious dye combinations |
| `/extractor` | Extract colors from image and match to dyes |
| `/gradient` | Create color gradient between two dyes |
| `/mixer` | Blend two dyes together (RGB averaging) |
| `/swatch` | Match character customization colors to dyes |
| `/budget` | Find affordable dye alternatives via market board |

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
| `/preset random` | Get a random approved preset |
| `/preset submit` | Submit new preset |
| `/preset vote` | Vote on presets |

### Utility
| Command | Description |
|---------|-------------|
| `/language` | Set preferred language |
| `/preferences` | Set world/datacenter and clan preferences |
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

Per-user sliding window rate limiting via `@xivdyetools/rate-limiter`:
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
