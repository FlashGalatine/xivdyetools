# xivdyetools-stoat-worker

> XIV Dye Tools bot for [Stoat](https://revolt.chat) — a persistent Node.js process using revolt.js WebSocket client with prefix commands.

## Features

🎨 **Dye Lookup** — Look up any FFXIV dye by name, ItemID, or hex color
🔍 **Fuzzy Matching** — Partial name matching with disambiguation when input is ambiguous
🌈 **Color Tools** — Harmonies, gradients, blending, comparison, and accessibility (planned)
🎭 **Masquerade** — Bot replies adopt the dye's color and name per-message
⏳ **Loading Indicators** — React/unreact pattern for visual processing feedback
🌍 **6 Languages** — English, Japanese, German, French, Korean, Chinese
📊 **Shared Logic** — Built on the same `@xivdyetools/bot-logic` and `@xivdyetools/svg` packages as the Discord bot

## Architecture

- **Runtime:** Node.js 22+ (persistent process, not serverless)
- **Bot library:** [revolt.js](https://www.npmjs.com/package/revolt.js) WebSocket client
- **Command model:** Prefix commands (`!xivdye <command>` or `!xd <shortcut>`)
- **Shared packages:** `@xivdyetools/core`, `@xivdyetools/bot-logic`, `@xivdyetools/bot-i18n`, `@xivdyetools/svg`, `@xivdyetools/color-blending`

### Planned (not yet implemented)

- **Storage:** SQLite (better-sqlite3) for preferences/analytics
- **Rate limiting:** Upstash Redis via `@xivdyetools/rate-limiter`
- **Image rendering:** `@resvg/resvg-js` (Node.js native, not WASM)
- **Image processing:** `sharp` (replaces `@cf-wasm/photon`)
- **Hosting:** Fly.io

## Commands

### Dye Lookup

| Command | Description |
|---------|-------------|
| `!xd info <dye>` | Look up a dye's color values (HEX, RGB, HSV, LAB) |
| `!xd search <query>` | Search dyes by name *(planned)* |
| `!xd list [category]` | List dyes in a category *(planned)* |
| `!xd random` | Show 5 random dyes *(planned)* |

### Color Tools

| Command | Description |
|---------|-------------|
| `!xivdye harmony <dye> [type]` | Color harmonies (triadic, complementary, etc.) *(planned)* |
| `!xivdye gradient <dye> > <dye> [steps]` | Color gradients between two dyes *(planned)* |
| `!xivdye mixer <dye> > <dye> [mode]` | Blend two dyes (RGB, LAB, OKLAB, etc.) *(planned)* |
| `!xivdye comparison <dye> > <dye> [> ...]` | Compare dyes side-by-side *(planned)* |
| `!xivdye match <color>` | Find closest dye to a hex color *(planned)* |
| `!xivdye a11y <dye> [dye2..4]` | Colorblind simulation and contrast *(planned)* |

### Utility

| Command | Description |
|---------|-------------|
| `!xd ping` | Connectivity check with latency |
| `!xd help [command]` | Command reference |
| `!xd about` | Bot info and links |

**Tip:** `!xd` is a shortcut for `!xivdye`. Dye names, ItemIDs, and hex codes are all accepted. Use `>` to separate multiple dyes.

## Development

### Prerequisites

- Node.js 22+
- pnpm 10+
- A Stoat bot token (see [Stoat documentation](https://developers.revolt.chat/))

### Setup

```bash
# From the monorepo root
pnpm install

# Copy and configure environment
cp apps/stoat-worker/.env.example apps/stoat-worker/.env
# Edit .env with your BOT_TOKEN

# Start development server (hot reload)
pnpm --filter xivdyetools-stoat-worker run dev
```

### Commands

```bash
pnpm --filter xivdyetools-stoat-worker run dev          # Dev with hot reload (tsx watch)
pnpm --filter xivdyetools-stoat-worker run build        # Production build (tsup)
pnpm --filter xivdyetools-stoat-worker run start        # Run production build
pnpm --filter xivdyetools-stoat-worker run test         # Run tests
pnpm --filter xivdyetools-stoat-worker run test:watch   # Run tests in watch mode
pnpm --filter xivdyetools-stoat-worker run test:coverage # Run tests with coverage
pnpm --filter xivdyetools-stoat-worker run type-check   # TypeScript type checking
pnpm --filter xivdyetools-stoat-worker run lint         # ESLint
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BOT_TOKEN` | Yes | Stoat bot token |
| `STATS_AUTHORIZED_USERS` | No | Comma-separated ULIDs for admin commands |
| `UPSTASH_REDIS_REST_URL` | No | Upstash Redis URL for rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | No | Upstash Redis token |

## Project Structure

```
src/
├── index.ts                      # Entry point (revolt.js client, WebSocket, event handling)
├── config.ts                     # Environment config loading, ULID validation
├── router.ts                     # Command router (CommandContext type, dispatch table)
├── commands/
│   ├── parser.ts                 # Prefix parser (!xivdye/!xd), aliases, greedy matching
│   ├── ping.ts                   # !xd ping
│   ├── help.ts                   # !xd help [command]
│   ├── about.ts                  # !xd about
│   └── info.ts                   # !xd info <dye>
├── services/
│   ├── dye-resolver.ts           # Multi-strategy dye input resolution
│   ├── message-context.ts        # LRU+TTL cache for reaction-based interactions
│   ├── response-formatter.ts     # Shared embed/error formatting
│   └── loading-indicator.ts      # ⏳ react/unreact pattern
└── test-utils/
    └── revolt-mocks.ts           # Mock factories for revolt.js Client/Message/Channel
```

## Design Documents

- [02-stoat.md](../../docs/research/discord-alternatives/02-stoat.md) — Bot architecture and design
- [06-shared-libraries.md](../../docs/research/discord-alternatives/06-shared-libraries.md) — Shared library extraction plan

## Connect With Me

**Flash Galatine** | Midgardsormr (Aether)

🎮 **FFXIV**: [Lodestone Character](https://na.finalfantasyxiv.com/lodestone/character/7677106/)
📝 **Blog**: [Project Galatine](https://blog.projectgalatine.com/)
💻 **GitHub**: [@FlashGalatine](https://github.com/FlashGalatine)
📺 **Twitch**: [flashgalatine](https://www.twitch.tv/flashgalatine)
🌐 **BlueSky**: [projectgalatine.com](https://bsky.app/profile/projectgalatine.com)
❤️ **Patreon**: [ProjectGalatine](https://patreon.com/ProjectGalatine)
☕ **Ko-Fi**: [flashgalatine](https://ko-fi.com/flashgalatine)
💬 **Discord**: [Join Server](https://discord.gg/5VUSKTZCe5)

## License

MIT © 2025-2026 Flash Galatine
