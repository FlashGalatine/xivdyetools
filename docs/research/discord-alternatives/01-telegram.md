# Telegram Bot Platform Research

**Date:** 2026-02-14
**Verdict:** Best candidate for first alternative platform

---

## Platform Overview

Telegram is a centralized, cloud-based messaging platform with ~900M+ monthly active users. It has a mature, well-documented Bot API that supports slash commands, inline keyboards, image sending, and webhook-based delivery — making it architecturally similar to our current Discord worker setup.

---

## Bot API Capabilities

### Commands
- Bots register commands via BotFather (Telegram's meta-bot for bot management).
- Commands use `/command` syntax, identical to Discord slash commands.
- Commands can have descriptions shown in a command menu.
- **No native autocomplete** for command arguments — this is a notable gap vs. Discord. Workaround: use inline keyboards or inline mode for suggestions.

### Interactions Model
| Feature | Discord | Telegram | Notes |
|---|---|---|---|
| Slash commands | Yes | Yes | Registered via BotFather |
| Deferred responses | Yes (type 5) | Yes (sendChatAction) | `upload_photo` action shows "sending photo..." |
| Async processing | `waitUntil()` + edit | Webhook + send later | Send response in a separate API call |
| Inline keyboards | Button components | InlineKeyboardMarkup | Very similar — buttons with callback data |
| Autocomplete | Native | No | Must use inline keyboards or inline mode |
| Ephemeral messages | flags: 64 | No native equivalent | Can DM the user, or delete after timeout |
| Rich embeds | Embed objects | No native embeds | Must format with HTML/Markdown in message text |

### Image Handling
- **`sendPhoto`** — Send image by file_id, URL, or upload (multipart/form-data).
- Images can be sent with captions (up to 1024 chars, supports HTML/Markdown formatting).
- **Max file size:** 10 MB for photos via `sendPhoto`, 50 MB for documents via `sendDocument`.
- Our PNGs are typically 50-200 KB — well within limits.
- **No embed-style image display** — images are shown as native Telegram photos with optional caption.

### Message Formatting
- Supports HTML and MarkdownV2 formatting in messages.
- No structured "embed" objects — everything is text + optional media.
- **Workaround:** Format our embed data as styled HTML text beneath the image caption.
- Inline keyboards can be attached to any message (text or photo).

---

## Architecture Compatibility

### Webhook Model
Telegram bots can receive updates via:
1. **Webhook (push)** — Telegram POSTs to your URL when events occur. **This matches our Cloudflare Worker model perfectly.**
2. **Long polling (pull)** — Bot periodically polls Telegram. Not suitable for serverless.

Setting up a webhook:
```
POST https://api.telegram.org/bot<token>/setWebhook
Body: { "url": "https://your-worker.workers.dev/telegram" }
```

### Cloudflare Worker Compatibility
- Webhook-based: the worker receives HTTP POSTs — identical to Discord interactions.
- No WebSocket required.
- Libraries like [WorkerGram](https://github.com/nghlt/workergram) provide TypeScript-first Telegram bot frameworks specifically designed for Cloudflare Workers.
- Multiple community examples of Telegram bots running on CF Workers exist.

### Response Flow (Proposed)
```
Telegram POST → CF Worker → Parse command
  ├─ Fast response: sendMessage / sendPhoto directly
  └─ Slow response (image gen):
       1. Respond with sendChatAction("upload_photo")
       2. ctx.waitUntil(async () => {
            generate SVG → render PNG → sendPhoto(chat_id, photo)
          })
```

**Key difference from Discord:** Telegram doesn't have "deferred response + edit" — instead, you acknowledge with a typing indicator and then send a new message when ready. This actually simplifies the flow.

---

## Migration Effort Estimate

### What Can Be Reused (90%+)
- All `@xivdyetools/core` logic (dye data, color math, matching algorithms)
- All SVG generators (harmony wheel, gradient bar, palette grid, etc.)
- The resvg-wasm PNG rendering pipeline
- Photon-wasm image processing
- Universalis proxy calls
- Preset API calls
- KV storage for preferences and analytics

### What Needs New Code
| Component | Effort | Notes |
|---|---|---|
| Telegram webhook handler | Medium | Replace Discord interaction parser |
| Command registration | Low | Script to register commands via BotFather API |
| Response formatter | Medium | Convert embed objects → Telegram HTML + InlineKeyboard |
| Autocomplete replacement | Medium | Inline keyboards for dye name search |
| File upload adapter | Low | Discord FormData → Telegram sendPhoto multipart |
| Copy-value buttons | Low | InlineKeyboard with callback_query handlers |

### Estimated Effort: **2-3 weeks** for a full port with feature parity (minus autocomplete).

---

## Pros & Cons

### Pros
- Massive user base (~900M MAU) — far larger than Discord
- Webhook model matches our CF Worker architecture perfectly
- Mature, stable, well-documented API
- Strong bot ecosystem and community
- No ID verification or face scan requirements
- Inline keyboards are very similar to Discord buttons
- Free, no rate limit concerns for small-medium bots
- Cross-platform (mobile-first, but desktop and web available)
- Bot messages can include photos with formatted captions
- Strong privacy stance (end-to-end encryption available)

### Cons
- **No native autocomplete** — significant UX downgrade for dye name search
- **No rich embeds** — must format everything as HTML text
- **No ephemeral messages** — workaround needed for error messages
- **No "server" concept** — bots work in groups/channels, not "servers" with role hierarchies
- Bot discovery is less organic than Discord (no bot directory equivalent)
- Gaming community smaller than Discord's, though FFXIV players are present
- Message formatting is more limited than Discord embeds

---

## Key Resources

- [Telegram Bot API Documentation](https://core.telegram.org/bots/api)
- [Telegram Bot Introduction](https://core.telegram.org/bots)
- [WorkerGram — Telegram bot framework for CF Workers](https://github.com/nghlt/workergram)
- [telegram-bot-cloudflare — Minimal CF Worker Telegram bot](https://github.com/cvzi/telegram-bot-cloudflare)
- [Telegram Bot Commands Docs](https://core.telegram.org/api/bots/commands)
