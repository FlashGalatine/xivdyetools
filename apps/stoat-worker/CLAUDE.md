# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

The XIV Dye Tools bot for [Stoat / Revolt](https://revolt.chat). Despite living under `apps/` alongside the Cloudflare Workers, **this is a Node.js process, not a CF Worker.** It runs `revolt.js` as a long-lived WebSocket client, listens for `messageCreate` events, and dispatches prefix commands (`!xivdye <cmd>` or the shortcut `!xd <cmd>`).

The bot reuses as much logic from `discord-worker` as it can by depending on the platform-agnostic shared packages — `@xivdyetools/core`, `@xivdyetools/bot-logic`, `@xivdyetools/bot-i18n`, `@xivdyetools/svg`, `@xivdyetools/color-blending`. Only the I/O surface (Stoat embed shape, prefix parsing, reactions-as-buttons, masquerade) is platform-specific.

The project is in early development; only `ping`, `help`, `about`, and `dye info` are implemented end-to-end. Most other commands documented in `README.md` are tagged "planned".

## Commands

```bash
npm run dev                  # tsx watch src/index.ts (hot reload)
npm run build                # tsup src/index.ts --format esm --dts --clean
npm run start                # node dist/index.js (production)
npm run test                 # vitest run
npm run test:watch           # vitest in watch mode
npm run test:coverage        # vitest run --coverage
npm run type-check           # tsc --noEmit
npm run lint                 # eslint src/
npm run clean                # rimraf dist coverage
```

### Pre-commit Checklist

```bash
npm run lint && npm run test -- --run && npm run type-check
```

## Architecture

```
                 Stoat WebSocket Gateway
                         │
                         ▼
   revolt.js Client  ──  client.on('messageCreate')
                         │
                         ▼
   parseCommand(content)            ◄─ src/commands/parser.ts
   ├─ matches '!xivdye' or '!xd' prefix?
   ├─ resolves SHORT_ALIASES (info → dye.info)
   └─ ParsedCommand { command, subcommand, rawArgs }
                         │
                         ▼
   routeCommand(ctx)                ◄─ src/router.ts
   COMMAND_ROUTES[`${command}.${subcommand}` | command]
   ├─ ping       → handlePingCommand
   ├─ help       → handleHelpCommand
   ├─ about      → handleAboutCommand
   └─ dye.info   → handleInfoCommand ── @xivdyetools/bot-logic.executeDyeInfo()
                                     │
                                     ▼
                              Stoat REST (sendMessage, react, masquerade)
```

### Key Directories

```
src/
├── index.ts                     # Bootstrap: load config, create Client, register handlers, login
├── config.ts                    # loadConfig() from env, ULID validation, isAuthorized()
├── router.ts                    # CommandContext, COMMAND_ROUTES dispatch table
├── commands/
│   ├── parser.ts                # Prefix parsing, aliases, parseSingleDyeArgs, > separator
│   ├── ping.ts                  # !xd ping (latency check)
│   ├── help.ts                  # !xd help [command]
│   ├── about.ts                 # !xd about (links + links)
│   └── info.ts                  # !xd info <dye> via bot-logic.executeDyeInfo
├── services/
│   ├── dye-resolver.ts          # Multi-strategy resolution (name → ID → hex), disambiguation
│   ├── message-context.ts       # MessageContextStore (LRU+TTL, max 500, 1h) for reaction handlers
│   ├── response-formatter.ts    # StoatEmbed shape, error/disambig/no-match formatters,
│   │                            # DYE_INFO_REACTIONS, masquerade helpers
│   └── loading-indicator.ts     # withLoadingIndicator(): ⏳ react/unreact wrapper
└── test-utils/
    └── revolt-mocks.ts          # Mock factories for revolt.js Client/Message/Channel
```

## Environment Variables

The bot reads everything from `process.env` at startup via `config.ts`. Use a local `.env` file (not committed) and `tsx` will load it.

| Variable | Required | Description |
|----------|----------|-------------|
| `BOT_TOKEN` | Yes | Stoat / Revolt bot token. Without it, `loadConfig()` throws and the process exits. |
| `STATS_AUTHORIZED_USERS` | No | Comma-separated Stoat ULIDs allowed to run admin/stats commands. ULIDs are validated at startup against Crockford Base32; an invalid ID throws. |
| `UPSTASH_REDIS_REST_URL` | No | Planned: Upstash Redis URL for rate limiting via `@xivdyetools/rate-limiter` Upstash backend. |
| `UPSTASH_REDIS_REST_TOKEN` | No | Planned: Upstash Redis token. |

There is no `wrangler.toml` and no Cloudflare secrets — this runs on a regular Node host (Fly.io is the planned target).

## Differences From discord-worker

This is the most important section. `stoat-worker` and `discord-worker` look superficially similar (both depend on `@xivdyetools/bot-logic`, both render dye info cards, both speak six languages) but the platforms differ in important ways.

| Concern | discord-worker | stoat-worker |
|---------|----------------|--------------|
| **Runtime** | Cloudflare Worker (V8 isolate, request-scoped) | Node.js 22+ persistent process |
| **Transport** | HTTP Interactions (POST per interaction) | WebSocket gateway (`messageCreate` events) |
| **Command model** | Slash commands registered with Discord; structured options | Prefix parsing (`!xivdye` / `!xd`) of raw message content |
| **Image rendering** | `@resvg/resvg-wasm` (WASM in worker) | Planned: `@resvg/resvg-js` (Node native) |
| **Image processing** | `@cf-wasm/photon` | Planned: `sharp` |
| **Storage** | KV (rate-limit, prefs, analytics), D1 via service binding | Planned: SQLite (better-sqlite3) for prefs/analytics |
| **Rate limit backend** | KV-backed `@xivdyetools/rate-limiter` | Planned: Upstash Redis backend |
| **Signature verification** | Ed25519 on every request | None — WebSocket session is implicitly authenticated by `BOT_TOKEN` |
| **Embed shape** | Discord rich embeds w/ fields, footer, author | Stoat `SendableEmbed`: title/description/icon_url/colour/media (no fields) |
| **Interactive buttons** | Discord MessageComponent buttons + modals | Stoat reactions with `restrict_reactions: true`; `MessageContextStore` maps message IDs to dye context |
| **Loading state** | Deferred response + follow-up edit | `⏳` react on the user's message via `withLoadingIndicator()`, removed when done |
| **Per-message identity** | Bot-static avatar + name | Per-reply masquerade: bot adopts dye's color and name for that message |
| **Localization** | Auto from `interaction.locale` | Currently hard-coded `'en'` in `info.ts` (TODO: per-user prefs) |
| **Authorization** | `MODERATOR_IDS` (Discord snowflakes) | `STATS_AUTHORIZED_USERS` (Stoat ULIDs, Crockford Base32) |

### Stoat-Specific Patterns

#### Prefix parsing with greedy dye matching

`parser.ts` defines `COMMANDS_WITH_SUBCOMMANDS` (dye, stats, admin, prefs, preset, budget, swatch) and `SHORT_ALIASES` (`info`/`search`/`random`/`list` short-hand for `dye.<x>`). After the command + subcommand are stripped, the remainder is treated as a greedy multi-word dye name. Multi-dye commands use `>` as the segment separator (`!xd gradient red > blue 5`).

#### Reactions as buttons

Stoat doesn't have Discord's MessageComponent system. Instead, the bot includes `interactions.reactions` + `restrict_reactions: true` on responses, then listens for reaction events to trigger follow-ups. `MessageContextStore` (LRU, max 500 entries, 1h TTL) keeps the dye/command context alive for those reaction handlers.

```typescript
// From response-formatter.ts
export const DYE_INFO_REACTIONS = [
  encodeURIComponent('🎨'), // Show HEX
  encodeURIComponent('🔢'), // Show RGB
  encodeURIComponent('📊'), // Show HSV
  encodeURIComponent('❓'), // Help
];
```

#### Loading indicator pattern

```typescript
await withLoadingIndicator(message, async () => {
  // ... 1-5 second image gen ...
});
// ⏳ added on entry, removed on exit (success or failure)
```

#### Graceful shutdown

`SIGINT`/`SIGTERM` listeners call `process.exit(0)`. Because the WebSocket connection is persistent, there's no "drain" step; the gateway will reissue events to the next instance.

#### Best-effort error reply

The top-level `messageCreate` handler wraps `routeCommand()` in try/catch. If a handler throws, the bot tries to send a generic "An unexpected error occurred" reply; if even that fails, the error is just logged.

## Build & Runtime Notes

- **Module format:** ESM throughout (`"type": "module"`). Local imports use explicit `.js` suffixes (e.g. `import { parseCommand } from './commands/parser.js'`) so the build output works under Node ESM resolution.
- **Build tool:** `tsup` produces a single ESM bundle + `.d.ts` in `dist/`. `npm run start` runs `node dist/index.js`.
- **Dev tool:** `tsx watch` for hot reload on save.
- **Node version:** `engines.node >= 22.0.0`.
- **Logger:** `createLibraryLogger('stoat')` from `@xivdyetools/logger` — same redaction rules as discord-worker, but Node runtime.

## Dependencies

| Package | Purpose |
|---------|---------|
| `revolt.js` | Stoat WebSocket client (login, events, sendMessage, react, masquerade) |
| `@xivdyetools/bot-logic` | Platform-agnostic command execution (`executeDyeInfo`, etc.) |
| `@xivdyetools/bot-i18n` | Six-language localized error/help/status strings |
| `@xivdyetools/core` | Dye database, color algorithms, `DyeDatabase` |
| `@xivdyetools/svg` | SVG dye-card generators (used by future image-rendering commands) |
| `@xivdyetools/color-blending` | Color blending algorithms for the planned mixer command |
| `@xivdyetools/types` | `Dye`, `LocaleCode`, branded color types |
| `@xivdyetools/logger` | Structured logging |
| `@xivdyetools/rate-limiter` | Sliding-window limiter (Upstash backend planned) |
| `@xivdyetools/test-utils` | Test factories (devDependency) |
| `tsup` / `tsx` | Build / dev runtime (devDependencies) |
| `vitest` / `@vitest/coverage-v8` | Tests |

## Available Commands

| Command | Status | Description |
|---------|--------|-------------|
| `!xd ping` | ✅ implemented | Connectivity + latency check |
| `!xd help [command]` | ✅ implemented | Command reference |
| `!xd about` | ✅ implemented | Bot info + project links |
| `!xd info <dye>` | ✅ implemented | Look up dye HEX/RGB/HSV/LAB (no image yet) |
| `!xd search <query>` | 🚧 planned | Search dyes by name |
| `!xd list [category]` | 🚧 planned | List dyes in a category |
| `!xd random` | 🚧 planned | Show 5 random dyes |
| `!xivdye harmony <dye> [type]` | 🚧 planned | Color harmonies |
| `!xivdye gradient <dye> > <dye> [steps]` | 🚧 planned | Gradient between two dyes |
| `!xivdye mixer <dye> > <dye> [mode]` | 🚧 planned | Blend two dyes (RGB/LAB/OKLAB/RYB/HSL/Spectral) |
| `!xivdye comparison <dye> > <dye> [> ...]` | 🚧 planned | Side-by-side compare |
| `!xivdye match <color>` | 🚧 planned | Closest dye to a hex |
| `!xivdye a11y <dye> [dye2..4]` | 🚧 planned | Colorblind sim + contrast |

## Related Projects

**Shared packages (logic ≅ discord-worker):**
- `@xivdyetools/bot-logic`, `@xivdyetools/bot-i18n`, `@xivdyetools/svg`, `@xivdyetools/color-blending`, `@xivdyetools/core`, `@xivdyetools/types`

**Sibling app:**
- `xivdyetools-discord-worker` — same business logic, different platform glue. When changing `bot-logic` or `svg`, verify both bots still build and tests pass.

## Testing

Vitest with `@xivdyetools/test-utils` for shared factories and `src/test-utils/revolt-mocks.ts` for revolt.js Client/Message/Channel stubs. Tests are co-located: `parser.test.ts`, `router.test.ts`, `info.test.ts`, etc.

```bash
npx vitest run src/commands/parser.test.ts
npx vitest run -t "greedy dye name"
```

## Design Documents

- `docs/research/discord-alternatives/02-stoat.md` — Bot architecture
- `docs/research/discord-alternatives/06-shared-libraries.md` — Shared library extraction plan
