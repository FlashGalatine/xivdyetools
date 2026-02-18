# Rocket.Chat Bot Platform Research

**Date:** 2026-02-14
**Verdict:** Not recommended — enterprise-focused, poor fit for community gaming bots

---

## Platform Overview

Rocket.Chat is an open-source team communication platform, primarily targeting enterprises and organizations. It offers channels, direct messages, file sharing, and extensive integrations. While it has a bot framework (Apps-Engine), it's designed for workplace productivity rather than gaming communities.

- **Website:** [rocket.chat](https://www.rocket.chat/)
- **Developer Docs:** [developer.rocket.chat](https://developer.rocket.chat/)
- **GitHub:** [github.com/RocketChat](https://github.com/RocketChat)

---

## Bot API Capabilities

### Apps-Engine (Current Framework)
Rocket.Chat deprecated its original "Bots" integration in favor of the **Apps-Engine** framework:

- Apps are written in TypeScript.
- Deployed via the Rocket.Chat Apps CLI (`rc-apps`).
- Support slash commands, event interfaces, HTTP endpoints, and schedulers.
- Apps run in a sandboxed environment within the Rocket.Chat server.

**Important:** The original Rocket.Chat.Apps-engine repository was archived on November 5, 2025. Development has moved into the main Rocket.Chat monorepo, suggesting organizational instability in the developer experience.

### Interactions Model
| Feature | Discord | Rocket.Chat | Notes |
|---|---|---|---|
| Slash commands | Native | Yes (Apps-Engine) | Registered by the app |
| Rich embeds | Embed objects | Attachments with fields | Similar concept, different API |
| File attachments | Multipart upload | Yes | Through the API |
| Buttons/components | Interactive components | Yes (action buttons) | Supported in Apps-Engine |
| Autocomplete | Native | No | Not available for slash command args |
| Ephemeral messages | flags: 64 | Yes (`notifyUser`) | Supported — sends ephemeral notification |

### Image Handling
- Files can be uploaded and attached to messages via the REST API.
- Attachments support `image_url` for inline image display.
- Apps-Engine provides file upload utilities.

---

## Architecture Compatibility

### Deployment Model
- **Self-hosted required** — Rocket.Chat is a server application. You run your own instance.
- Apps run *inside* the Rocket.Chat server process — not as standalone services.
- **No serverless/CF Worker compatibility** — apps must be deployed to a running Rocket.Chat instance.

### What This Means
- You'd need to host a full Rocket.Chat server instance.
- Users would need to create Rocket.Chat accounts and join your server.
- The bot (app) runs within the Rocket.Chat server, not as an external service.
- Completely different paradigm from Discord's external webhook/bot model.

---

## Why It's Not Recommended

### Dealbreakers for XIV Dye Tools
1. **Self-hosted only** — Requires running and maintaining a full Rocket.Chat server. Significant infrastructure overhead compared to a CF Worker.
2. **Enterprise-focused** — The platform, community, and ecosystem are oriented toward businesses, not gaming communities. FFXIV players are unlikely to adopt it.
3. **No public server discovery** — There's no equivalent of Discord's server directory or invite culture. Getting users to join a Rocket.Chat instance is a much harder sell.
4. **Apps run inside the server** — Can't use our existing CF Worker architecture. The bot must be rewritten as a Rocket.Chat App.
5. **WASM compatibility unknown** — resvg-wasm and photon-wasm may not work in the Apps-Engine sandbox. Would likely need to switch to Node.js-native alternatives.
6. **Archived Apps-Engine repo** — The separate repository was archived in November 2025. While development continues in the monorepo, this signals instability in the developer experience.
7. **Minimal gaming community** — Almost no FFXIV or gaming presence on Rocket.Chat.

### Where Rocket.Chat Makes Sense (Not Here)
- Internal team communication (Slack alternative)
- Customer support portals (omnichannel)
- Organizations needing on-premises compliance
- DevOps integrations and ChatOps workflows

---

## Effort Estimate

If pursued (not recommended):
- **Estimated Effort: 5-6+ weeks** — Full rewrite as a Rocket.Chat App, new hosting infrastructure, unknown WASM sandbox constraints.
- High risk of hitting undocumented limitations in the Apps-Engine sandbox.

---

## Key Resources

- [Rocket.Chat Apps-Engine Overview](https://developer.rocket.chat/docs/rocketchat-apps-engine)
- [Getting Started with Apps-Engine](https://developer.rocket.chat/apps-engine/getting-started)
- [Rocket.Chat REST API](https://developer.rocket.chat/reference/api)
- [Bots Architecture (Deprecated)](https://developer.rocket.chat/docs/bots-architecture)
