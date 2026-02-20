# CLAUDE.md — Stoat Worker

## Overview

Stoat (formerly Revolt) bot for XIV Dye Tools. A persistent Node.js process using revolt.js WebSocket client with prefix commands (`!xivdye` / `!xd`).

## Architecture

- **Runtime:** Node.js 22+ (persistent process, not serverless)
- **Bot library:** revolt.js (WebSocket client)
- **Command model:** Prefix commands (`!xivdye <command>` or `!xd <command>`)
- **Storage (planned):** SQLite (better-sqlite3) for preferences/analytics, Upstash Redis for rate limiting
- **Image rendering (planned):** @resvg/resvg-js (Node.js native, not WASM)
- **Image processing (planned):** sharp (replaces @cf-wasm/photon)

## Key Patterns

- Uses shared packages: `@xivdyetools/core`, `@xivdyetools/bot-logic`, `@xivdyetools/bot-i18n`, `@xivdyetools/svg`, `@xivdyetools/color-blending`
- Command parser handles greedy dye name matching and `>` separator for multi-dye commands
- Reactions used as interactive buttons (preset reactions with restrict_reactions)
- ⏳ react/unreact pattern for loading indicators
- Masquerade feature for dye-themed bot identity per-message

## Commands

```bash
pnpm --filter xivdyetools-stoat-worker run dev    # Dev with hot reload
pnpm --filter xivdyetools-stoat-worker run build  # Production build
pnpm --filter xivdyetools-stoat-worker run test   # Run tests
pnpm --filter xivdyetools-stoat-worker run lint   # Lint
```

## Design Documents

See `docs/research/discord-alternatives/02*.md` for detailed Stoat bot design.
See `docs/research/discord-alternatives/06*.md` for shared library architecture.
