# Stoat (formerly Revolt) Bot Platform Research

**Date:** 2026-02-14
**Priority:** First platform to support
**Verdict:** Most Discord-like experience — strong feature parity, requires hosting change

---

## Platform Overview

Stoat (rebranded from Revolt in late 2025) is an open-source, community-driven chat platform designed as a direct Discord alternative. It features servers, channels, roles, permissions, emoji, and bots — the closest 1:1 mapping to Discord's feature set of any alternative. It's free, ad-free, and tracker-free.

- **Website:** [stoat.chat](https://stoat.chat/)
- **Developer Docs:** [developers.stoat.chat](https://developers.stoat.chat/)
- **GitHub:** [github.com/stoatchat](https://github.com/stoatchat)
- **Self-hostable:** Yes — full self-hosted deployment available

---

## Detailed Design Documents

This research is split into focused sub-documents:

| Document | Contents |
|---|---|
| **[02a — API Reference](./02a-stoat-api.md)** | Bot API deep dive: REST endpoints, SendableEmbed structure, file uploads (Autumn CDN), masquerade feature, reactions as interactions (button replacement) |
| **[02b — Command Design](./02b-stoat-commands.md)** | Dye input resolution (replacing autocomplete), `!xivdye`/`!xd` prefix & syntax, greedy argument parsing, `>` separator, ephemeral message hybrid approach, deferred responses (⏳ loading), help & discoverability (4-layer system) |
| **[02c — Infrastructure](./02c-stoat-infrastructure.md)** | Storage backend (SQLite + Upstash Redis + LRU cache), image attachment handling (`!xivdye extract` with sharp), rate limiting (4-tier), webhook ingestion (HTTP server for GitHub & preset webhooks) |
| **[02d — Stats & Admin](./02d-stoat-admin.md)** | Stats commands (5 subcommands, SQLite-powered), admin commands (7 operational tools), authorization model (ULID-based), analytics tracking, data retention |
| **[02e — Testing Strategy](./02e-stoat-testing.md)** | Test framework (Vitest), revolt.js mocks, in-memory SQLite, Redis mocks, Autumn CDN mocks, unit/integration/E2E test categories, CI/CD pipeline, coverage configuration |

---

## Architecture & Hosting

### Connection Model: WebSocket Required
The primary bot model uses **WebSocket** to connect to Stoat's real-time gateway. revolt.js (the official library) maintains a persistent WebSocket connection:

```typescript
import { Client } from "revolt.js";

const client = new Client();

client.on("ready", () => {
  console.log(`Logged in as ${client.user.username}`);
});

client.on("messageCreate", async (message) => {
  if (message.content === "!ping") {
    await message.channel.sendMessage("Pong!");
  }
});

client.loginBot("your-bot-token");
```

**This means Cloudflare Workers alone won't work** — Workers can't maintain persistent WebSocket connections.

### Hosting Options

| Option | Pros | Cons | Cost |
|---|---|---|---|
| **Fly.io** | Easy deploy, auto-sleep, scales to zero | Cold starts on wake | Free tier available, ~$3-5/mo |
| **Railway** | Git-push deploy, simple | No sleep-to-zero on free tier | $5/mo hobby plan |
| **VPS (Hetzner/OVH)** | Full control, always-on | Manual setup, maintenance | ~$4-5/mo |
| **Home server / Raspberry Pi** | Free, full control | Uptime depends on you | $0 (hardware cost) |
| **Hybrid (VPS + CF Worker)** | Keeps heavy WASM on CF | More complexity | $4-5 + CF free tier |

### Recommended Architecture

**Option A: All-in-one Node.js process (Simplest)**
```
revolt.js WebSocket → Node.js process (Fly.io / Railway / VPS)
  → @xivdyetools/core (dye data, color math)
  → @resvg/resvg-js (Node.js native, NOT wasm)
  → Upload PNG to Autumn CDN
  → Send message via REST API
```
- Use `@resvg/resvg-js` (native Node.js binding) instead of `@resvg/resvg-wasm` — faster, no WASM constraints.
- Import `@xivdyetools/core` directly as an npm dependency.
- All logic in one process — simpler deployment and debugging.

**Option B: Hybrid (if keeping CF Worker infrastructure)**
```
revolt.js WebSocket → Thin listener (Fly.io, ~128MB RAM)
  → POST command to CF Worker endpoint
  → CF Worker processes with WASM pipeline
  → Returns PNG buffer
  → Listener uploads to Autumn CDN → sends message
```
- Keeps the existing WASM rendering pipeline on CF Workers.
- Thin WebSocket listener only handles event routing.
- More complex but reuses existing infrastructure.

**Recommendation:** Start with **Option A**. It's simpler, and the Node.js resvg binding is actually faster than the WASM version. We can always extract shared logic later if we also build a Telegram worker.

---

## Migration Summary

### What Can Be Reused Directly (85%+)
- All `@xivdyetools/core` logic (dye database, color math, matching algorithms)
- All SVG generator templates (`harmony-wheel.ts`, `gradient.ts`, `palette-grid.ts`, etc.)
- Universalis client (direct HTTP, or keep the proxy worker)
- Preset API client
- Font files and subsetting

### What Changes
| Component | Effort | Details |
|---|---|---|
| **Bot framework** | Medium | revolt.js WebSocket client replaces Discord HTTP interactions |
| **Command parser** | Medium | Prefix commands (`!harmony`, `!dye search`) instead of slash commands |
| **Response formatter** | Medium | Discord embeds → Stoat SendableEmbed (simpler structure) |
| **File upload** | Low-Medium | FormData to Autumn CDN + attachment ID, or revolt-uploader |
| **PNG rendering** | Low | Swap `@resvg/resvg-wasm` → `@resvg/resvg-js` (Node.js native) |
| **Image processing** | Low | Swap `@cf-wasm/photon` → sharp |
| **Storage** | Medium | CF KV → SQLite + Upstash Redis ([details](./02c-stoat-infrastructure.md)) |
| **Hosting/deployment** | Medium | wrangler → Dockerfile + Fly.io/Railway |

For detailed migration design, see:
- [Command design](./02b-stoat-commands.md) — prefix parsing, dye resolution, ephemeral handling
- [Infrastructure](./02c-stoat-infrastructure.md) — storage, image processing, rate limiting, webhooks
- [Stats & admin](./02d-stoat-admin.md) — analytics, admin commands
- [Testing](./02e-stoat-testing.md) — test framework, mocks, CI/CD

### Estimated Effort: **3-4 weeks**

### Suggested Implementation Order
1. **Scaffold & connect** — Project setup, revolt.js WebSocket, `!xivdye ping` / `!xd ping`
2. **Command parser** — `!xivdye` / `!xd` prefix detection, subcommand routing, greedy dye name parsing, `>` separator
3. **Dye input resolver** — Multi-strategy resolution (ItemID, exact, localized, partial, disambiguation)
4. **`!xd info`** — End-to-end test: resolve dye → generate SVG → render PNG → upload to Autumn → send embed with media + preset reactions (🎨🔢📊❓)
5. **Reaction handler** — Listen for `MessageReact`, dispatch by emoji, context cache for message→dye mapping
6. **Loading indicator** — ⏳ react/unreact pattern for all image commands
7. **Port image commands** — harmony, gradient, comparison, accessibility, dye random, preset show
8. **Port text commands** — mixer, extractor color, swatch, dye search, dye list
9. **Budget commands** — Universalis integration, `!xivdye budget world` DM confirmation
10. **Preferences system** — New storage backend (SQLite/Redis), DM-based show/set
11. **Help system** — `!xivdye help` DM, ❓ reaction contextual help, inline error hints, about quick-start
12. **Preset commands** — Preset API integration, submit/vote/edit
13. **Stats & admin** — `!xd stats` (public + admin subcommands), `!xd admin` operational commands, analytics tracking in command dispatcher
14. **Webhook ingestion** — HTTP server (Hono/Fastify), GitHub push handler, preset submission handler
15. **Testing** — Vitest setup, revolt.js mocks, in-memory SQLite tests, CI pipeline (tests gate deploy)

> **Note:** Testing is listed last but should be done **alongside each step** — write tests as you build each module. Step 15 is for finalizing CI/CD integration, coverage thresholds, and the E2E smoke test.

---

## Available Libraries

### Official
| Package | Type | Description |
|---|---|---|
| `revolt.js` | npm | Official JS/TS library — WebSocket client, full API coverage |
| `revolt-api` | npm | Low-level typed REST API client + OpenAPI types |

### Community
| Package | Type | Description |
|---|---|---|
| `revolt-uploader` | npm | File upload utility (fills gap in revolt.js) |
| `revoltx` | npm | Framework with @sapphire/framework-style argument parsing |
| `revkit` | npm | Class-oriented library with voice + command handler |

### Recommendation
- Use **`revolt.js`** for the WebSocket connection and event handling.
- Use **`revolt-uploader`** or direct Autumn CDN calls for file uploads.
- Use **`revolt-api`** types for type safety on REST calls.

---

## Pros & Cons

### Pros
- **Most Discord-like experience** — servers, channels, roles, embeds, bots — users feel at home
- **Open source** — no vendor lock-in, full code transparency
- **Self-hostable** — can run your own instance if needed
- **No ID verification or tracking** — privacy-first, no face scans
- **Growing community** — Discord exodus is driving rapid growth (Feb 2026)
- **Gaming-friendly culture** — unlike enterprise tools (Slack, Rocket.Chat)
- **Embeds with inline media** — `media` field in embeds is cleaner than Discord's attachment pattern
- **Masquerade feature** — unique ability to change bot appearance per-message
- **Active development** — monorepo approach, regular updates
- **TypeScript-first** — official library and API client are TypeScript
- **Multiple embeds per message** — can show several dye results in one response

### Cons
- **Smaller user base** — growing but still much smaller than Discord/Telegram
- **WebSocket required** — can't use Cloudflare Workers alone, need a persistent host
- **No slash commands** — must use prefix commands (like pre-2021 Discord bots)
- **No autocomplete** — users must type dye names without suggestions (biggest UX gap)
- **Simpler embeds** — no fields, footer, author, or timestamp
- **No ephemeral messages** — can't send user-only responses
- **No button components** — can't replicate copy-value buttons
- **Evolving API surface** — CDN migration, rebrand suggest ongoing changes
- **Smaller ecosystem** — fewer libraries, examples, and community resources
- **revolt-uploader needed** — revolt.js doesn't handle file uploads natively

---

## Key Resources

### Documentation
- [Stoat Developer Documentation](https://developers.stoat.chat/)
- [Stoat API Reference](https://developers.stoat.chat/developers/api/reference.html/) (redirects to OpenAPI viewer)
- [Stoat File Uploads](https://developers.stoat.chat/developers/api/uploading-files.html/)
- [Protocol Reference](https://developers.stoat.chat/developers/events/protocol.html)

### Libraries
- [revolt.js — Official TypeScript library](https://revolt.js.org/) | [GitHub](https://github.com/revoltchat/revolt.js) | [npm](https://www.npmjs.com/package/revolt.js)
- [revolt-api — Typed REST client + OpenAPI types](https://www.npmjs.com/package/revolt-api) | [GitHub](https://github.com/stoatchat/javascript-client-api)
- [revolt-uploader — File upload utility](https://github.com/ShadowLp174/revolt-uploader) | [npm](https://www.npmjs.com/package/revolt-uploader)
- [awesome-stoat — Community libraries, bots, tools](https://github.com/stoatchat/awesome-stoat)
- [revoltx — Sapphire-style framework](https://github.com/kaname-png/revoltx)

### Examples & Guides
- [How to Make a Bot Using Revolt.js](https://github.com/BoQsc/How-to-Make-a-bot-using-Revolt.js/)
- [Revolt.py API Reference](https://revoltpy.readthedocs.io/en/stable/api.html) (Python, but shows API shape clearly)
- [Stoat Self-Hosted Deployment](https://github.com/stoatchat/self-hosted)
- [OpenAPI Spec (JSON)](https://github.com/revoltchat/api/blob/main/OpenAPI.json)
