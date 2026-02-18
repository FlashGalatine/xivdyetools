# Platform Comparison Matrix

**Date:** 2026-02-14

---

## Feature Compatibility

| Feature | Discord (Current) | Telegram | Stoat | Matrix | Rocket.Chat |
|---|---|---|---|---|---|
| **Slash Commands** | Native | Via BotFather | Evolving | Convention (`!cmd`) | Apps-Engine |
| **Deferred Responses** | Type 5 + edit | Chat action + send | Unknown | Typing + send | Unknown |
| **Rich Embeds** | Full (fields, footer, author) | No (HTML text) | Partial (title, desc, color) | No (HTML messages) | Yes (attachments) |
| **Image Attachments** | Multipart upload | sendPhoto | CDN upload + attach | MXC upload + m.image | API upload |
| **Buttons / Components** | Interactive components | Inline keyboards | Limited | No | Action buttons |
| **Autocomplete** | Native | No | No | No | No |
| **Ephemeral Messages** | flags: 64 | No | No | No | Yes (notifyUser) |
| **Webhooks (HTTP push)** | Yes | Yes | Partial (`interactions_url`) | No (Appservice only) | No |
| **Bot Reactions/Emoji** | Yes | Yes (limited) | Yes | Yes | Yes |

---

## Architecture Compatibility

| Factor | Discord | Telegram | Stoat | Matrix | Rocket.Chat |
|---|---|---|---|---|---|
| **CF Worker Compatible** | Yes | Yes | Partial | No | No |
| **Connection Model** | HTTP interactions | Webhook (HTTP push) | WebSocket (primary) | Long-poll / WebSocket | Server-internal |
| **Serverless Friendly** | Yes | Yes | Challenging | No | No |
| **WASM Runtime** | CF Workers WASM | CF Workers WASM | Depends on host | Node.js native | Unknown sandbox |
| **Auth Model** | Bot token + interactions key | Bot token | Bot token | Access token | App deployment |

---

## Community & Reach

| Factor | Discord | Telegram | Stoat | Matrix | Rocket.Chat |
|---|---|---|---|---|---|
| **User Base** | ~200M MAU | ~900M MAU | ~100K-500K | ~50M+ (federated) | ~12M (enterprise) |
| **Gaming Community** | Dominant | Moderate | Growing | Small | Minimal |
| **FFXIV Presence** | Strong | Some | Emerging | Minimal | None |
| **Bot Ecosystem** | Massive | Large | Small | Medium | Small |
| **Server Discovery** | Yes (directory) | Yes (search) | Yes (discover) | Via room directories | No |
| **ID Verification** | Yes (March 2026) | Phone number | No | Varies by homeserver | Varies |

---

## Migration Effort

| Factor | Telegram | Stoat | Matrix | Rocket.Chat |
|---|---|---|---|---|
| **Core Logic Reuse** | 90%+ | 85%+ | 75% | 60% |
| **Estimated Weeks** | 2-3 | 3-4 | 4-5 | 5-6+ |
| **Architecture Change** | Minimal | Moderate | Significant | Complete |
| **New Infrastructure** | None (CF Workers) | VPS likely needed | VPS required | Full server required |
| **Risk Level** | Low | Medium | Medium-High | High |

---

## Scoring Summary

Scored 1-5 (5 = best) on factors relevant to XIV Dye Tools:

| Factor (Weight) | Stoat | Telegram | Matrix | Rocket.Chat |
|---|---|---|---|---|
| **Feature parity** (25%) | 4 | 3 | 2 | 3 |
| **Community presence** (25%) | 4 | 2 | 1 | 1 |
| **Gaming culture fit** (15%) | 5 | 3 | 1 | 1 |
| **Architecture fit** (15%) | 2 | 5 | 1 | 1 |
| **Migration effort** (10%) | 3 | 5 | 2 | 1 |
| **Privacy / no verification** (5%) | 5 | 4 | 5 | 4 |
| **User base / reach** (5%) | 2 | 5 | 3 | 1 |
| **Weighted Score** | **3.60** | **3.35** | **1.50** | **1.40** |

> **Note:** Weights are adjusted to prioritize *where our users actually are* (community presence) and *Discord-like experience* (feature parity, gaming culture) over raw architecture fit or global user base. A platform where people you know are already active is more valuable than one with 900M strangers.

---

## Recommendation

### Priority Order

1. **Stoat** (Score: 3.60) — First priority. Most Discord-like experience, existing community of people we know, growing rapidly from the Discord exodus. Requires a hosting change (WebSocket on Fly.io/Railway instead of CF Workers), but the bot logic ports cleanly. **Build first.**

2. **Telegram** (Score: 3.35) — Second priority. Webhook architecture matches CF Workers perfectly, massive user base, mature API. Great for broad reach once Stoat is running. **Build second, reuse shared logic layer.**

3. **Matrix** (Score: 1.50) — Only if demand emerges. Decentralized and privacy-first, but complex infrastructure and minimal FFXIV community. **Monitor only.**

4. **Rocket.Chat** (Score: 1.40) — Not recommended. Enterprise-focused, no gaming community, heavy infrastructure. **Skip.**

### Suggested Approach

1. **Immediate:** Extract platform-agnostic bot logic from `xivdyetools-discord-worker` into a shared layer (`@xivdyetools/bot-core` or similar).
2. **Short-term (Q1 2026):** Build `xivdyetools-stoat-bot` — Node.js process with revolt.js, deployed on Fly.io or Railway.
3. **Medium-term (Q2 2026):** Build `xivdyetools-telegram-worker` on Cloudflare Workers, reusing the shared logic layer.
4. **Long-term:** Monitor Matrix demand from FFXIV community; build if justified.
