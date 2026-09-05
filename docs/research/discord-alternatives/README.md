# Discord Alternatives Research — Overview

**Date:** 2026-02-14
**Context:** Discord's mandatory age verification (face scan / government ID) rolling out March 2026

## Background

On February 10, 2026, Discord announced that starting in early March, every account will be placed into a default "teen-appropriate" experience unless the user verifies their age via on-device facial age estimation or government ID submission. This follows a data breach of a third-party vendor that exposed ~70,000 government ID images, amplifying privacy concerns. The backlash has driven significant user interest in alternative platforms.

### Sources
- [Discord Slammed Over Age Verification — Newsweek](https://www.newsweek.com/discord-age-verification-face-scan-controversy-11494375)
- [Discord will restrict your account — 9to5Google](https://9to5google.com/2026/02/09/discord-age-restrictions-default-face-id-scans/)
- [Discord Launches Teen-by-Default Settings — Discord Press](https://discord.com/press-releases/discord-launches-teen-by-default-settings-globally)
- [EFF: Discord Voluntarily Pushes Mandatory Age Verification Despite Recent Data Breach](https://www.eff.org/deeplinks/2026/02/discord-voluntarily-pushes-mandatory-age-verification-despite-recent-data-breach)

---

## What the XIV Dye Tools Bot Needs

The bot's feature set imposes specific technical requirements on any alternative platform. Here's what we depend on:

### Must-Have Requirements
| Requirement | Why |
|---|---|
| **Slash commands / bot commands** | All 14+ commands are slash-command driven |
| **Deferred / async responses** | Image generation takes 1-5s; we need to acknowledge, process, then update |
| **Image file attachments** | Every visual command sends a rendered PNG (600-800px wide, 2x scale) |
| **Rich embeds** | All responses use structured embeds with fields, colors, thumbnails |
| **Autocomplete / suggestions** | Dye name search, world names, preset names — critical for UX |
| **Ephemeral messages** | Error messages, preferences, copy-value buttons — user-only visibility |
| **Persistent key-value storage** | User preferences, analytics counters (currently Cloudflare KV) |
| **Webhook / HTTP-based bot** | Current architecture is a Cloudflare Worker — no persistent WebSocket |

### Nice-to-Have
| Feature | Current Usage |
|---|---|
| Button components | HEX/RGB/HSV copy buttons on dye info |
| Modals | Infrastructure exists but unused |
| Service bindings | Worker-to-worker calls (Universalis proxy, Preset API) |

### Not Required
- Voice chat
- Video
- Screen sharing
- Direct messages (bot is server/channel only)

---

## Platforms Evaluated

| Priority | Platform | Type | Status | Document |
|---|---|---|---|---|
| **1st** | **Stoat** (formerly Revolt) | Open-source, self-hostable | Active, growing | [02-stoat.md](./02-stoat.md) (overview) + [API](./02a-stoat-api.md), [Commands](./02b-stoat-commands.md), [Infra](./02c-stoat-infrastructure.md), [Admin](./02d-stoat-admin.md), [Testing](./02e-stoat-testing.md) |
| 2nd | **Telegram** | Centralized, mainstream | Active, mature bot API | [01-telegram.md](./01-telegram.md) |
| 3rd | **Matrix** | Decentralized protocol | Active, mature ecosystem | [03-matrix.md](./03-matrix.md) |
| — | **Guilded** | Discord-like, Roblox-owned | **Shutting down (2025)** | Excluded — not viable |
| — | **Rocket.Chat** | Open-source, enterprise | Active but enterprise-focused | [04-rocketchat.md](./04-rocketchat.md) |

### Excluded Platforms
- **Guilded** — Roblox announced shutdown by end of 2025. Not viable for new development.
- **Slack** — Enterprise-focused, no gaming/community culture, expensive for large communities.
- **TeamSpeak** — Voice-focused, minimal bot/text API, no rich embeds or image attachments in the same way.
- **Signal** — Privacy-focused messenger, no bot API, no server/community structure.

---

## Architecture Considerations

The current bot runs as a **Cloudflare Worker** using Discord's HTTP-based interactions model (no WebSocket gateway). This is relevant because:

1. **Telegram** also supports a webhook model (HTTP push), making it architecturally compatible.
2. **Stoat** and **Matrix** primarily use WebSocket/long-poll connections, which would require architectural changes or a different hosting model.
3. **The core library (`@xivdyetools/core`)** is platform-agnostic — dye data, color math, and SVG generation have no Discord dependencies.
4. **The SVG→PNG pipeline** (resvg-wasm + photon-wasm) is also platform-agnostic but requires a WASM-capable runtime.

### Recommended Strategy

Rather than rewriting the bot for each platform, consider:
1. **Extract a shared "bot logic" layer** from the Discord worker — command handlers that return platform-agnostic response objects (embeds, images, text).
2. **Create thin platform adapters** that translate these response objects into platform-specific API calls.
3. **Prioritize Stoat** as the first alternative — existing community presence and most Discord-like UX make it the best landing pad for migrating users.
4. **Telegram** as second priority — architectural compatibility with CF Workers and massive user base make it a strong follow-up.

---

## Quick Comparison

See [05-comparison-matrix.md](./05-comparison-matrix.md) for a detailed feature-by-feature comparison.
