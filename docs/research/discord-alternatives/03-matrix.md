# Matrix Protocol Bot Platform Research

**Date:** 2026-02-14
**Verdict:** Viable but complex — best for users already in the Matrix ecosystem

---

## Platform Overview

Matrix is an **open, decentralized communication protocol** — not a single platform. Users connect through independently operated "homeservers" (like email servers) that federate with each other. The most popular client is **Element** (web, desktop, mobile), and the most popular homeserver implementation is **Synapse** (Python) or **Conduit** (Rust).

Key distinction: Matrix is a *protocol*, not a *product*. There's no single "Matrix app" — there are many clients, many servers, and they all interoperate.

- **Protocol Spec:** [spec.matrix.org](https://spec.matrix.org/)
- **Ecosystem:** [matrix.org/ecosystem](https://matrix.org/ecosystem/)
- **Bot SDK:** [matrix-bot-sdk (TypeScript)](https://github.com/turt2live/matrix-bot-sdk)

---

## Bot API Capabilities

### Bot Model
Matrix bots are regular Matrix users (accounts) that happen to be automated. There's no special "bot" designation in the protocol — bots join rooms, send messages, and react to events just like human users.

Two bot architectures exist:
1. **Simple bot** — A Matrix client that logs in, listens to room events, and responds. Uses `matrix-bot-sdk`.
2. **Application Service (Appservice)** — A privileged server-side integration that can act as multiple virtual users, bridge other platforms, and receive all events without joining rooms. More powerful but requires homeserver configuration.

### Interactions Model
| Feature | Discord | Matrix | Notes |
|---|---|---|---|
| Slash commands | Native, registered | Convention only | `!command` prefix by convention, no native slash commands |
| Deferred responses | Type 5 + edit | Send typing → send message | `client.sendTyping(roomId)` then `sendMessage()` |
| Rich embeds | Embed objects | HTML messages | `m.text` with `format: "org.matrix.custom.html"` |
| File attachments | Multipart upload | Upload to MXC → send `m.image` | Two-step: upload content → send image event |
| Buttons/components | Interactive components | No native equivalent | Some clients support custom widgets |
| Autocomplete | Native | No | No bot-driven autocomplete |
| Ephemeral messages | flags: 64 | No native equivalent | Some workarounds with self-destructing messages |
| Reactions | Yes | Yes | Can react with emoji |

### Image Handling
```typescript
// 1. Upload image to homeserver
const mxcUrl = await client.uploadContent(pngBuffer, "image/png", "dye-result.png");

// 2. Send image message
await client.sendMessage(roomId, {
    msgtype: "m.image",
    body: "dye-result.png",
    url: mxcUrl,  // mxc://homeserver/media-id
    info: {
        mimetype: "image/png",
        size: pngBuffer.length,
        w: 800,
        h: 600
    }
});
```

- Images uploaded to the homeserver's media repository, returning an `mxc://` URL.
- `m.image` messages display the image inline in clients like Element.
- Max upload size depends on homeserver configuration (default 50 MB on Synapse).
- Can also send a thumbnail alongside the full image.

### Message Formatting
- Plain text or HTML via `format: "org.matrix.custom.html"`.
- HTML messages support tables, colors, lists, bold, italic, code blocks.
- **No structured embed objects** — but rich HTML can approximate embed appearance.
- Some clients render HTML better than others (Element is best).

---

## Architecture Compatibility

### Connection Model
- **Primary model:** Long-poll or WebSocket to the homeserver's `/sync` endpoint.
- **No HTTP push/webhook model** for bots — bots must actively poll or maintain a connection.
- **Appservice model:** The homeserver pushes events to the appservice via HTTP, but this requires configuring the homeserver — not viable for a hosted bot on someone else's server.

### Cloudflare Worker Compatibility
- **Not directly compatible.** Matrix bots require persistent connections (long-poll or WebSocket), which CF Workers don't support.
- **Possible approaches:**
  1. Run the Matrix bot on a VPS (Fly.io, Railway, etc.) with the bot SDK handling the connection.
  2. The VPS bot forwards image generation requests to a CF Worker endpoint.
  3. Or, run everything on the VPS and import `@xivdyetools/core` directly (requires Node.js runtime, not Workers).
- **Appservice mode** requires homeserver admin access, limiting deployment to self-hosted Matrix servers.

### Response Flow (Proposed)
```
Matrix Homeserver → /sync long-poll → Bot process (VPS)
  → Parse !command from message event
  → Generate SVG → Render PNG (resvg in Node.js, not WASM)
  → Upload PNG to homeserver media repo → mxc:// URL
  → Send m.image message to room
```

**Note:** Moving from WASM-based rendering to native Node.js rendering is actually a benefit — `@resvg/resvg-js` (the Node.js binding) is faster and has fewer constraints than `@resvg/resvg-wasm`.

---

## Discord Bridge Consideration

Matrix has a mature **Discord bridge** ([matrix-appservice-discord](https://github.com/matrix-org/matrix-appservice-discord)), which can mirror Discord servers into Matrix rooms. This means:

- Users on Matrix can interact with the Discord bot through the bridge.
- **However,** bot interactions (slash commands, buttons, embeds) don't bridge well — mostly just text messages pass through.
- A native Matrix bot would provide a far better experience than relying on the bridge.

---

## Migration Effort Estimate

### What Can Be Reused (75%)
- All `@xivdyetools/core` logic
- All SVG generators
- PNG rendering (switch from `resvg-wasm` to `resvg-js` for Node.js)
- Universalis client (direct HTTP calls, no proxy needed if not on CF Workers)
- Preset API client

### What Needs New Code
| Component | Effort | Notes |
|---|---|---|
| Matrix bot framework | High | New connection model, event handling |
| Command parser | Medium | Parse `!command` from message text |
| Response formatter | Medium | Discord embeds → Matrix HTML messages |
| Image upload adapter | Medium | Upload to MXC media repo |
| Hosting infrastructure | Medium | Need a VPS or container host |
| State storage | Medium | Replace CF KV with SQLite/Redis/etc. |
| Deployment pipeline | Low-Medium | Different from wrangler deploy |

### Estimated Effort: **4-5 weeks** — most complex due to architecture and infrastructure changes.

---

## Pros & Cons

### Pros
- **Fully decentralized** — no single company controls it, no ToS surprises
- **Open protocol** — can't be enshittified, protocol is a public standard
- **Strong privacy** — end-to-end encryption (E2EE) supported
- **Self-hostable** — run your own homeserver with full control
- **Bridge ecosystem** — can bridge to Discord, Telegram, IRC, Slack, etc.
- **Growing adoption** — popular among privacy-conscious and FOSS communities
- **TypeScript bot SDK** — `matrix-bot-sdk` is well-maintained
- **Rich HTML messages** — flexible formatting capabilities
- **No verification requirements** — account creation varies by homeserver
- **Node.js rendering** — faster than WASM, fewer constraints

### Cons
- **No native slash commands** — `!command` prefix by convention only
- **No autocomplete** — no way to suggest dye names as user types
- **No ephemeral messages** — no user-only visibility
- **No buttons/components** — can't replicate copy-value buttons
- **Requires persistent connection** — incompatible with CF Workers
- **Fragmented client ecosystem** — HTML rendering varies by client
- **Higher infrastructure cost** — needs a VPS instead of serverless
- **Steeper learning curve** — protocol concepts (homeservers, federation, MXC URLs)
- **Smaller gaming community** — Matrix skews toward tech/privacy users
- **UX complexity** — joining a Matrix room is more complex than joining a Discord server

---

## Key Resources

- [Matrix Bot SDK (TypeScript)](https://github.com/turt2live/matrix-bot-sdk)
- [matrix-bot-sdk on npm](https://www.npmjs.com/package/matrix-bot-sdk)
- [Matrix Bot SDK Guide](https://matrix.org/docs/older/matrix-bot-sdk-intro/)
- [Matrix Client-Server API Spec](https://spec.matrix.org/v1.8/client-server-api/)
- [Matrix SDKs](https://matrix.org/ecosystem/sdks/)
- [Matrix-Discord Bridge](https://github.com/matrix-org/matrix-appservice-discord)
- [Matrix Bridges Overview](https://matrix.org/bridges/)
- [Element Client](https://element.io/)
