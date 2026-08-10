# xivdyetools-moderation-worker

> The moderation Discord bot for XIV Dye Tools community presets — a **separate Discord application** from the main bot, running as a Cloudflare Worker on HTTP Interactions.

Deployed at `moderation-bot.xivdyetools.app`.

## Why it's a separate application

Moderation lives in its own Discord app, not as more commands on `discord-worker`, for two reasons:

1. **Blast radius.** Approve, reject, and ban are destructive writes against community data. Keeping them behind a distinct application means the moderation token can be scoped, rotated, and revoked without touching the public bot.
2. **Button routing.** Discord routes a message component interaction back to the application that *posted* the message. `discord-worker` posts moderation embeds using `MODERATION_BOT_TOKEN` precisely so approve/reject buttons land here. When that secret is unset, `discord-worker` omits the buttons and points moderators at `/preset moderate` instead.

## Commands

| Command | Description |
|---------|-------------|
| `/preset moderate` | Approve or reject a pending preset — takes `action`, `preset_id`, and an optional `reason` |
| `/preset ban_user` | Ban a `user` from submitting presets |
| `/preset unban_user` | Lift a submission ban for a `user` |

Interactive approve/reject **buttons** on moderation-channel embeds route here as well, so a moderator normally never types a command.

## Routes

| Path | Auth | Purpose |
|------|------|---------|
| `GET /health` | None | Health probe |
| `POST /` | Ed25519 | Discord interactions (commands, buttons, modals) |

## Development

```bash
# From the monorepo root
pnpm install
pnpm --filter xivdyetools-moderation-worker run dev          # wrangler dev
pnpm --filter xivdyetools-moderation-worker run test
pnpm --filter xivdyetools-moderation-worker run type-check
pnpm --filter xivdyetools-moderation-worker run lint
```

### Registering commands

```bash
pnpm --filter xivdyetools-moderation-worker run register-commands
```

Requires `DISCORD_TOKEN` and `DISCORD_CLIENT_ID` for the **moderation** application (`1453806659708129374`), not the main bot's. Setting `DISCORD_GUILD_ID` publishes guild commands, which appear instantly instead of taking up to an hour.

## Deployment

```bash
pnpm --filter xivdyetools-moderation-worker run deploy              # DEV worker (xivdyetools-moderation-worker-dev)
pnpm --filter xivdyetools-moderation-worker run deploy:production   # Production
```

> ⚠️ A bare `wrangler deploy` targets the **dev** worker here. Production always needs `--env production`. See [`docs/operations/DEPLOY_ENVIRONMENTS.md`](../../docs/operations/DEPLOY_ENVIRONMENTS.md).

## Environment Bindings

| Binding | Type | Purpose |
|---------|------|---------|
| `KV` | KV Namespace | Rate limiting and moderation state |
| `DB` | D1 (`xivdyetools-presets`) | Shared preset database — same D1 instance as `presets-api` and `discord-worker` |
| `PRESETS_API` | Service Binding → `xivdyetools-presets-api` | Approve / reject / ban writes |
| `DISCORD_CLIENT_ID` | Var | Moderation application ID |
| `PRESETS_API_URL` | Var | `https://api.xivdyetools.app` — HTTP fallback for local dev |

### Required Secrets

```bash
wrangler secret put DISCORD_TOKEN        # Moderation application's bot token
wrangler secret put DISCORD_PUBLIC_KEY   # Moderation application's Ed25519 public key
wrangler secret put MODERATOR_IDS        # CSV of Discord IDs allowed to moderate
```

Additional secrets for authenticating outbound calls to `presets-api` (`BOT_API_SECRET`, `BOT_SIGNING_SECRET`) follow the same names and semantics as in `discord-worker`.

## Dependencies

| Package | Purpose |
|---------|---------|
| `hono` | HTTP framework |
| `@xivdyetools/auth` | Discord Ed25519 verification, HMAC bot signatures |
| `@xivdyetools/bot-logic` | Shared command business logic and bot UI strings |
| `@xivdyetools/types` | Preset and moderation type definitions |
| `@xivdyetools/logger` | Structured logging with secret redaction |
| `@xivdyetools/worker-kit` | Request ID, logger, and rate-limit middleware |

This Worker uses a custom `sanitizePath` on `loggerMiddleware` so preset IDs and user IDs are redacted out of logged URLs.

## Related Projects

- [`apps/presets-api`](../../apps/presets-api/) — the API this Worker writes through (Service Binding).
- [`apps/discord-worker`](../../apps/discord-worker/) — posts the moderation embeds whose buttons route here.

## Connect With Me

**Flash Galatine** | Midgardsormr (Aether)

🎮 **FFXIV**: [Lodestone Character](https://na.finalfantasyxiv.com/lodestone/character/7677106/)
📝 **Blog**: [Project Galatine](https://blog.projectgalatine.com/)
💻 **GitHub**: [@FlashGalatine](https://github.com/FlashGalatine)
🐦 **X/Twitter**: [@AsheJunius](https://x.com/AsheJunius)
📺 **Twitch**: [flashgalatine](https://www.twitch.tv/flashgalatine)
🌐 **BlueSky**: [projectgalatine.com](https://bsky.app/profile/projectgalatine.com)
❤️ **Patreon**: [ProjectGalatine](https://patreon.com/ProjectGalatine)
☕ **Ko-Fi**: [flashgalatine](https://ko-fi.com/flashgalatine)
💬 **Discord**: [Join Server](https://discord.gg/5VUSKTZCe5)

## License

MIT © 2025-2026 Flash Galatine — see [LICENSE](./LICENSE).

## Legal Notice

**FINAL FANTASY is a registered trademark of Square Enix Holdings Co., Ltd.**
**FINAL FANTASY XIV © SQUARE ENIX CO., LTD.**

XIV Dye Tools is an unofficial fan project and is **not affiliated with, endorsed by, or sponsored by Square Enix Co., Ltd.**
