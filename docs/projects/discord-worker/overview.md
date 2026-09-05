# Discord Worker Overview

**xivdyetools-discord-worker** — serverless Discord bot for FFXIV dye tools. Current version: see [versions.md](../../versions.md).

---

## What is the Discord Worker?

A Cloudflare Worker that brings XIV Dye Tools to Discord via slash commands. Uses HTTP Interactions (not Gateway WebSocket) for serverless, globally distributed operation.

### Recent Features

- **v5.0.0** - The 5.0 command set: v4 commands `/match`, `/match_image`, `/favorites`, `/collection`, `/language` deleted; `/contrast`, `/a11y`, `/changelog` added; every card redrawn on the `@xivdyetools/svg` frame system; matching vocabulary `ciede2000` (default) / `oklab` / `cie76` / `redmean` / `rgb` / `distinguish`; `/swatch` takes a `.chara` file; Photon image decoding moved out to `xivdyetools-image-worker` (`IMAGE_WORKER` binding); `/preferences set theme` (dark/light cards); beta bot on the routeless `-dev` env
- **v4.1.x** - Budget quick picks updated with 20 Cosmic dyes, prevent duplicate results for extractor, type imports migrated from core to `@xivdyetools/types`
- **v4.0.x** - Command renaming (`match` to `extractor`, `mixer` to `gradient`), new `mixer` and `swatch` commands

---

## Quick Start (Development)

```bash
# From monorepo root
pnpm install

# Start local dev server
pnpm --filter xivdyetools-discord-worker run dev

# Register slash commands (CI runs this on merge to main; the script refuses on roster drift)
pnpm --filter xivdyetools-discord-worker run register-commands

# Deploy - bare `deploy` targets the routeless beta/dev worker; production needs the env flag
pnpm --filter xivdyetools-discord-worker run deploy              # xivdyetools-discord-worker-dev (beta bot)
pnpm --filter xivdyetools-discord-worker run deploy:production   # xivdyetools-discord-worker
```

See [`docs/operations/DEPLOY_ENVIRONMENTS.md`](../../operations/DEPLOY_ENVIRONMENTS.md).

---

## Architecture

### HTTP Interactions Flow

```
Discord → POST / → Ed25519 Verify → Hono Router → Handler → Response
```

Signature verification is `verifyDiscordRequest()` from `@xivdyetools/auth`; this worker keeps no
crypto of its own.

Unlike traditional Gateway bots:
- **No persistent WebSocket** - Receives HTTP POST for each interaction
- **Serverless** - No server to maintain
- **Global** - Runs on Cloudflare's edge network
- **Scalable** - Handles spikes automatically

### Project Structure

```
src/
├── commands/
│   ├── registry.ts       # COMMAND_REGISTRY — the roster of record (17 registrations)
│   ├── schemas.ts        # Slash-command schemas published by register-commands
│   └── localize.ts       # Localized command names/descriptions for the schemas
├── handlers/
│   ├── commands/         # Slash command handlers
│   │   ├── harmony.ts
│   │   ├── extractor.ts     # /extractor color|image (was match.ts)
│   │   ├── gradient.ts      # was mixer.ts in v3
│   │   ├── mixer-v4.ts      # /mixer blending
│   │   ├── swatch.ts        # /swatch .chara file
│   │   ├── budget.ts        # market board ledger
│   │   ├── contrast.ts      # 5.0 NEW: WCAG contrast
│   │   ├── changelog.ts     # 5.0 NEW: /changelog
│   │   ├── dye.ts
│   │   ├── comparison.ts
│   │   ├── accessibility.ts # also serves /a11y
│   │   ├── preferences.ts
│   │   └── ...
│   └── buttons/          # Button interaction handlers (copy, preview-image moderation)
├── services/
│   ├── analytics.ts      # Usage tracking
│   ├── rate-limiter.ts   # Per-user rate limiting
│   ├── preferences.ts    # User preferences (KV, prefs:v1:*)
│   ├── preset-favorites.ts # /preset favorite storage
│   ├── image-client.ts   # IMAGE_WORKER service-binding client (POST /extract)
│   └── preset-api.ts     # Presets API client
└── utils/
    ├── github-verify.ts  # HMAC-SHA256 verification for the GitHub webhook
    └── response.ts       # Discord response builders
```

Ed25519 verification and `timingSafeEqual` are imported from `@xivdyetools/auth` — there is no
local `utils/verify.ts`.

The v4 `services/user-storage.ts` (favorites/collections) and `services/image/*` (Photon) are deleted in 5.0.

Note: SVG generation, bot command logic, and i18n are now in shared packages:
- `@xivdyetools/svg` — SVG card generation
- `@xivdyetools/bot-logic` — Platform-agnostic command logic; bot localization lives at its `/i18n` subpath (the standalone `@xivdyetools/bot-i18n` package was absorbed on 2026-07-30)

---

## Available Commands

The roster of record is `src/commands/registry.ts` — 17 registrations, 16 distinct commands.

### Color Tools
| Command | Description |
|---------|-------------|
| `/harmony` | Generate harmonious dye combinations |
| `/extractor color` / `/extractor image` | Match a color / extract image colors and match to dyes |
| `/gradient` | Create color gradient between two colors |
| `/mixer` | Blend two dyes (rgb/lab/oklab/ryb/hsl/spectral ratio sweep) |
| `/swatch` | Match a `.chara` character file's colours to dyes |

### Dye Database
| Command | Description |
|---------|-------------|
| `/dye search` | Search dyes by name |
| `/dye info` | Get detailed dye information |
| `/dye list` | List dyes by category |
| `/dye random` | Get random dye suggestions |

### Analysis
| Command | Description |
|---------|-------------|
| `/comparison` | Compare 2-4 dyes side by side |
| `/contrast` | WCAG 1.4.11 contrast between 2-4 dyes (5.0) |
| `/accessibility` / `/a11y` | Color-vision simulation for a dye or a pair |
| `/budget` | Find affordable dye alternatives via market board |

### User Data — removed in 5.0
`/favorites` and `/collection` are gone (saved palettes live in the web app); preset favourites are `/preset favorite add|remove|list`.

### Community
| Command | Description |
|---------|-------------|
| `/preset list` | Browse community presets |
| `/preset show` | View preset details |
| `/preset random` | Get a random approved preset |
| `/preset submit` / `/preset edit` | Submit / edit a preset (3–6 stainID-keyed dyes — see [Commands](commands.md#preset-submit)) |
| `/preset vote` | Toggle a vote on a preset |
| `/preset favorite` | Add / remove / list favourite presets |

### Utility
| Command | Description |
|---------|-------------|
| `/preferences` | Language, matching method, blending mode, world, card theme, dye filters, readouts (`/language` was folded in) |
| `/manual` | Show help guide (six topics) |
| `/changelog` | Release notes from `CHANGELOG-laymans.md` (5.0) |
| `/about` | Bot information |
| `/stats` | Usage statistics (`summary` public; the rest for `STATS_AUTHORIZED_USERS`) |

---

## Key Features

### SVG to PNG Rendering

Commands that need images generate SVG and render to PNG:

```typescript
// 1. Build SVG
const svg = buildComparisonSvg(dyes);

// 2. Render to PNG via resvg-wasm
const png = await renderSvgToPng(svg);

// 3. Send as Discord attachment
await sendFollowup(interaction, env, {
  embeds: [...],
  files: [{ name: 'comparison.png', data: png }]
});
```

### Rate Limiting

Per-user, per-command limits via `@xivdyetools/worker-kit/rate-limiter` (`DISCORD_COMMAND_LIMITS`, keyed by top-level command name):
- `/dye`, `/preferences`: 20/minute; `/accessibility` (and its alias `/a11y`), `/budget`, `/preset`: 10/minute; `/about`, `/manual`, `/changelog`: 30/minute; `/extractor image`: 5/minute; everything else, `/stats` included: 15/minute
- `/a11y` is canonicalised to `accessibility` before lookup, so the alias shares one bucket; `/extractor image` is tiered apart from `/extractor color` by an `extractor:image` key; `/changelog`'s 30/minute comes from this worker's own `LOCAL_COMMAND_LIMITS`
- No command is exempt (`/stats` since FINDING-033, the three utility commands since FINDING-020)
- Backend: the native `[[ratelimits]]` bindings (`RL_5`…`RL_70`, one per distinct per-minute limit), with Cloudflare KV as the fallback only when no tier is bound

### User Storage

KV holds per-user preferences (`prefs:v1:*`), preset favourites, analytics counters, the announced-version memo (`announced:v:<version>`) and the rate-limit fallback counters. Button state travels in the component's own `custom_id`; the KV-backed button-context store was removed in 2026-08-18 (nothing consumed it). The v4 favorites/collections store is gone and its orphaned keys were swept once against production on 2026-08-29.

---

## Environment Bindings

| Binding | Type | Purpose |
|---------|------|---------|
| `KV` | KV Namespace | Rate-limit fallback, preferences, preset favourites, stats counters, announced-version memo |
| `ANALYTICS` | Analytics Engine | Command tracking |
| `PRESETS_API` | Service Binding | `xivdyetools-presets-api` |
| `UNIVERSALIS_PROXY` | Service Binding | `xivdyetools-api-worker` (absorbed the universalis-proxy) — market prices |
| `IMAGE_WORKER` | Service Binding | `xivdyetools-image-worker` — `POST /extract` pixels for `/extractor image` |
| `RL_5`, `RL_10`, `RL_15`, `RL_20`, `RL_30`, `RL_70` | Rate Limiting (`[[ratelimits]]`, 60 s) | Per-user command counters, one tier per per-minute limit |

---

## Vars (`wrangler.toml`)

`vars` are **not** inheritable, so all four are declared in the top-level block *and* under
`[env.production]`:

| Var | Purpose |
|-----|---------|
| `ENVIRONMENT` | `"development"` on the beta bot, `"production"` on the live one. Only `validateEnv` reads it — in production it makes the six `RL_*` bindings mandatory (FINDING-013) |
| `DISCORD_CLIENT_ID` | The application ID. Beta and production are **different Discord applications**, because an application has exactly one Interactions Endpoint URL |
| `PRESETS_API_URL` | HTTP fallback for local dev when the `PRESETS_API` service binding is absent |
| `ANNOUNCEMENT_CHANNEL_ID` | Release-announcement channel for the GitHub webhook — deliberately different per environment |

## Secrets

Required:
- `DISCORD_TOKEN` - Bot token
- `DISCORD_PUBLIC_KEY` - Ed25519 verification key

Optional:
- `BOT_API_SECRET` / `BOT_SIGNING_SECRET` - Presets API authentication (`BOT_SIGNING_SECRET` min. 32 characters)
- `INTERNAL_WEBHOOK_SECRET` - Auth for inbound `/webhooks/preset-submission`
- `GITHUB_WEBHOOK_SECRET` - HMAC key for the GitHub push webhook
- `MODERATOR_IDS` - Comma-separated user IDs
- `MODERATION_CHANNEL_ID` - Channel for pending presets
- `MODERATION_BOT_TOKEN` - Moderation bot's token (component clicks route to the posting application)
- `SUBMISSION_LOG_CHANNEL_ID` - Audit log channel for auto-approved presets
- `STATS_AUTHORIZED_USERS` - Users who can view the admin `/stats` subcommands

---

## Deployment

The shared mechanics — CI workflows, path filters, the `deploy` / `deploy:production` convention,
the 3,072 KiB gzip ceiling — live in [Deployment](../../developer-guides/deployment.md) and
[Deploy Environments](../../operations/DEPLOY_ENVIRONMENTS.md). What is specific to this worker:

**Two environments, two Discord applications.** The top-level `wrangler.toml` block is
`xivdyetools-discord-worker-dev` — the **beta bot**, with its own Discord application, its own KV
namespace and its own Analytics Engine dataset, `workers_dev = true` and no routes. `[env.production]`
is `xivdyetools-discord-worker` on the `bot.*` custom domains. `routes` and `workers_dev` are
inheritable keys, so both are declared explicitly in both blocks — leaving `routes` at the top level
would attach the production custom domains to the beta Worker. The **service bindings are shared**
between the two on purpose, so beta `/preset` renders real data; there is no D1 binding on this
worker.

**Deploy `xivdyetools-image-worker` first** so the `IMAGE_WORKER` binding resolves.

**Slash-command registration is automatic in CI.** `deploy-discord-worker.yml` runs
`wrangler deploy --env production` *and then* `register-commands`, so the roster published to
Discord is whatever is on `main`; a manual run against the production token is only needed for an
out-of-band schema push. With `BETA_DISCORD_TOKEN` / `BETA_DISCORD_GUILD_ID` set, the beta workflow
registers **guild-scoped** (instant propagation).

**Two `[[rules]]` shape the bundle.** `**/*.ttf` is bundled as `Data` (the CJK subset fonts), and
`**/*.md` as `Text` — `/changelog` imports `apps/discord-worker/CHANGELOG-laymans.md` as a string,
so **editing that file is a deploy**.

---

## Related Documentation

- [Commands](commands.md) - Full command reference
- [Interactions](interactions.md) - Button, modal, autocomplete handlers
- [Rendering](rendering.md) - SVG generation and PNG output
- [Deployment](../../developer-guides/deployment.md) - The shared deployment guide
