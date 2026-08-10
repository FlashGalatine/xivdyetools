# xivdyetools-discord-worker

> The primary XIV Dye Tools Discord bot — 17 slash commands running on Cloudflare Workers via Discord HTTP Interactions. Fully serverless: no Gateway WebSocket.

Deployed at `bot.xivdyetools.app`. [**Invite the bot →**](https://discord.com/oauth2/authorize?client_id=1447108133020369048)

## How it works

Every slash command, autocomplete, button click, and modal submission arrives as a POST to a single endpoint. The Worker verifies an Ed25519 signature, routes by interaction type, and — for anything slow — returns a deferred response immediately, then follows up over the Discord REST API once SVG rendering or an external API call finishes.

Cards are generated as SVG strings by `@xivdyetools/svg` and rasterized to PNG in-worker via `@resvg/resvg-wasm`. Image pixel extraction for `/extractor` is delegated to [`image-worker`](../image-worker/) over a Service Binding.

## Commands

### 🎨 Color tools

| Command | Description |
|---------|-------------|
| `/harmony` | Harmony palettes — found dye vs. computed ideal |
| `/mixer` | Ratio-sweep blending across six algorithms |
| `/gradient` | N-step gradient between two distinct dyes |
| `/extractor` | Extract a palette from an image, or the nearest dyes to a color |
| `/swatch` | Import a `.chara` character file and match its colors |

### 📚 Dye database

| Command | Description |
|---------|-------------|
| `/dye search\|info\|list\|random` | Dye lookups by name, ID, hex, or category |

### 🔍 Analysis

| Command | Description |
|---------|-------------|
| `/comparison` | Side-by-side comparison of 2–4 dyes |
| `/contrast` | WCAG 1.4.11 contrast ratios for 2–4 dyes |
| `/accessibility` (alias `/a11y`) | Color-vision deficiency lenses |
| `/budget` | Market price ledger via Universalis, grouped by consolidation tier |

### 🌐 Community

| Command | Description |
|---------|-------------|
| `/preset` | Browse, submit, vote on, and edit community presets |

### ⚙️ Utility

| Command | Description |
|---------|-------------|
| `/preferences` | Race/clan, world, language, matching method, and theme |
| `/manual` | Help topics with learn-more links |
| `/changelog` | Release notes (ephemeral) |
| `/about` | Bot info, command roster, and Square Enix attribution |
| `/stats` | Usage statistics (gated to authorized users) |

The `/about` roster is built from the command registry at runtime, so it cannot drift from what actually registers — `about.test.ts` asserts parity.

**Removed in 5.0:** `/match`, `/match_image`, `/favorites`, `/collection`, `/language`. Matching folded into `/extractor` and `/swatch`; language moved into `/preferences`.

## Development

```bash
# From the monorepo root
pnpm install
pnpm --filter xivdyetools-discord-worker run dev            # wrangler dev
pnpm --filter xivdyetools-discord-worker run test
pnpm --filter xivdyetools-discord-worker run test:integration
pnpm --filter xivdyetools-discord-worker run test:all
pnpm --filter xivdyetools-discord-worker run type-check
pnpm --filter xivdyetools-discord-worker run lint
```

### Registering slash commands

```powershell
$env:DISCORD_TOKEN = "..."
$env:DISCORD_CLIENT_ID = "1447108133020369048"
$env:DISCORD_GUILD_ID = "<test-guild>"   # Optional — guild commands publish instantly
pnpm --filter xivdyetools-discord-worker run register-commands
```

Command registration also runs in CI on release, so a normal deploy does not need this by hand.

## Deployment

```bash
pnpm --filter xivdyetools-discord-worker run deploy              # BETA bot (xivdyetools-discord-worker-dev, *.workers.dev)
pnpm --filter xivdyetools-discord-worker run deploy:production   # Production (bot.xivdyetools.app)
```

> ⚠️ A bare `wrangler deploy` targets the **beta/dev** bot here. Production always needs `--env production`. See [`docs/operations/DEPLOY_ENVIRONMENTS.md`](../../docs/operations/DEPLOY_ENVIRONMENTS.md).

### Checklist

1. `wrangler secret list` — verify all required secrets are present.
2. `pnpm lint && pnpm test && pnpm type-check` — must be green.
3. `pnpm run deploy`, then smoke-test core commands in the test guild.
4. `pnpm run deploy:production`.
5. If slash command schemas changed, re-run `register-commands` against the production token.
6. `GET https://bot.xivdyetools.app/health` to confirm the new build is live.

### Bundle size

The Worker bundle is close enough to Cloudflare's compressed limit to be worth watching. Splitting `@cf-wasm/photon` out into [`image-worker`](../image-worker/) restored headroom; the CJK subset fonts bundled as `Data` are now the largest remaining contributor. Re-subset via `scripts/subset-cjk-fonts.py` rather than bundling full font files — `fonts-src/` is deliberately outside `src/` so wrangler's `**/*.ttf` glob cannot capture the ~21 MiB originals.

## Environment Bindings

| Binding | Type | Purpose |
|---------|------|---------|
| `KV` | KV Namespace | Rate-limit fallback, user preferences, analytics counters |
| `DB` | D1 (`xivdyetools-presets`) | Shared with `presets-api` / `moderation-worker` |
| `ANALYTICS` | Analytics Engine | Long-term command usage telemetry |
| `PRESETS_API` | Service Binding → `xivdyetools-presets-api` | Preset CRUD |
| `UNIVERSALIS_PROXY` | Service Binding → `xivdyetools-api-worker` | Market prices for `/budget` |
| `IMAGE_WORKER` | Service Binding → `xivdyetools-image-worker` | Pixel extraction for `/extractor` |

### Required Secrets

| Secret | Purpose |
|--------|---------|
| `DISCORD_TOKEN` | Bot token for REST follow-ups |
| `DISCORD_PUBLIC_KEY` | Ed25519 public key for signature verification |

### Optional Secrets

| Secret | Purpose |
|--------|---------|
| `BOT_API_SECRET` / `BOT_SIGNING_SECRET` | Authenticating outbound calls to `presets-api` |
| `INTERNAL_WEBHOOK_SECRET` | Auth for inbound `/webhooks/preset-submission` |
| `GITHUB_WEBHOOK_SECRET` | HMAC key for the GitHub push webhook |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | Primary rate-limit backend (KV is the fallback) |
| `MODERATOR_IDS` | CSV of Discord IDs allowed to moderate presets |
| `MODERATION_CHANNEL_ID` | Channel for pending presets |
| `MODERATION_BOT_TOKEN` | The **moderation** app's token. When set, moderation embeds post with it so approve/reject buttons route to `moderation-worker`; when unset, embeds omit buttons and point at `/preset moderate` |
| `SUBMISSION_LOG_CHANNEL_ID` | Audit log channel for auto-approved presets |
| `STATS_AUTHORIZED_USERS` | CSV of Discord IDs allowed to run `/stats` |

## Webhook Endpoints

| Path | Auth | Purpose |
|------|------|---------|
| `GET /health` | None | Health probe |
| `POST /` | Ed25519 | Discord interactions |
| `POST /webhooks/preset-submission` | Bearer (`INTERNAL_WEBHOOK_SECRET`) | Preset submissions forwarded from the web app |
| `POST /webhooks/github` | HMAC-SHA256 (`GITHUB_WEBHOOK_SECRET`) | Push events updating `CHANGELOG-laymans.md`, announced to the release channel |

Both webhook endpoints cap payloads at 10 KB before parsing. Discord interaction bodies are capped at 100 KB, with `Content-Length` validated before the body is read.

## Localization

Six languages: `en`, `ja`, `de`, `fr`, `ko`, `zh`. Locale resolution order:

1. The user's stored preference in KV
2. `interaction.locale` (their Discord client locale)
3. `en`

Dye names come from `@xivdyetools/core`; bot UI strings from `@xivdyetools/bot-logic/i18n`.

## Dependencies

| Package | Purpose |
|---------|---------|
| `hono` | HTTP framework |
| `@xivdyetools/core` | Dye database, color algorithms, k-d tree matcher |
| `@xivdyetools/core/blending` | Six blending algorithms |
| `@xivdyetools/bot-logic` | Platform-agnostic command business logic |
| `@xivdyetools/bot-logic/i18n` | Bot UI translation engine |
| `@xivdyetools/svg` | Pure SVG card generators |
| `@xivdyetools/auth` | JWT verification, HMAC, Ed25519 helpers |
| `@xivdyetools/types` | Branded types and shared interfaces |
| `@xivdyetools/logger` | Structured logging with secret redaction |
| `@xivdyetools/worker-kit` | Hono middleware + rate-limiter backends |
| `@resvg/resvg-wasm` | SVG → PNG rasterization |

## Related Projects

- **Outbound service bindings:** [`presets-api`](../presets-api/), [`api-worker`](../api-worker/), [`image-worker`](../image-worker/)
- **Inbound:** [`presets-api`](../presets-api/) calls back via `DISCORD_WORKER` for submission notifications
- **Sibling:** [`moderation-worker`](../moderation-worker/) — a separate Discord application for the moderation UI
- **Platform twin:** [`stoat-worker`](../stoat-worker/) — same business logic, Revolt instead of Discord

## Connect With Me

**Flash Galatine** | Midgardsormr (Aether)

🎮 **FFXIV**: [Lodestone Character](https://na.finalfantasyxiv.com/lodestone/character/7677106/)
💻 **GitHub**: [@FlashGalatine](https://github.com/FlashGalatine)
🐦 **X/Twitter**: [@AsheJunius](https://x.com/AsheJunius)
📺 **Twitch**: [flashgalatine](https://www.twitch.tv/flashgalatine)
🌐 **BlueSky**: [projectgalatine.com](https://bsky.app/profile/projectgalatine.com)
❤️ **Patreon**: [ProjectGalatine](https://patreon.com/ProjectGalatine)
☕ **Ko-Fi**: [flashgalatine](https://ko-fi.com/flashgalatine)
💬 **Discord**: [Join Server](https://discord.gg/5VUSKTZCe5)

## Credits & Acknowledgements

- **[XIVAPI](https://xivapi.com/)** — dye names in English, Japanese, German, and French. Korean and Chinese names are manually sourced.
- **[Universalis](https://universalis.app/)** (MIT) — market board price data for `/budget`.
- **[spectral.js](https://github.com/rvanwijnen/spectral.js)** (MIT) — physically-based paint mixing for `/mixer`.
- **[resvg](https://github.com/linebender/resvg)** (MPL-2.0) — SVG rasterization.
- **[Photon](https://github.com/silvia-odwyer/photon)** (Apache-2.0) — image decoding, via `image-worker`.
- Fonts under the [SIL Open Font License 1.1](https://openfontlicense.org/): [Noto Sans JP / SC / KR](https://fonts.google.com/noto), [Onest](https://fonts.google.com/specimen/Onest), [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk), [Fragment Mono](https://fonts.google.com/specimen/Fragment+Mono).
- Color-vision deficiency simulation uses matrices from **Brettel, Viénot & Mollon (1997)**, JOSA A 14(10).

## License

MIT © 2025-2026 Flash Galatine — see [LICENSE](./LICENSE).

## Legal Notice

**FINAL FANTASY is a registered trademark of Square Enix Holdings Co., Ltd.**
**FINAL FANTASY XIV © SQUARE ENIX CO., LTD.**

XIV Dye Tools is an unofficial fan project and is **not affiliated with, endorsed by, or sponsored by Square Enix Co., Ltd.** All FINAL FANTASY XIV content, including dye names and color values, is the property of Square Enix.
