# Discord Worker Deployment

> **Version:** 4.1.2

## Platform

The Discord bot is deployed as a **Cloudflare Worker** using [Wrangler](https://developers.cloudflare.com/workers/wrangler/). It receives Discord interactions over HTTP (no gateway connection) and communicates with other workers via Cloudflare Service Bindings.

## Commands

All commands are run from the monorepo root using pnpm workspace filters:

```bash
# Local development server on port 8787
pnpm --filter xivdyetools-discord-worker run dev

# Deploy to staging environment
pnpm --filter xivdyetools-discord-worker run deploy

# Deploy to production environment
pnpm --filter xivdyetools-discord-worker run deploy:production

# Register slash commands with the Discord API
pnpm --filter xivdyetools-discord-worker run register-commands
```

## Environment Bindings (wrangler.toml)

| Binding | Type | Purpose |
|---------|------|---------|
| `KV` | KV Namespace | Rate limits, user data, stats |
| `DB` | D1 Database | Preset storage (via service binding) |
| `ANALYTICS` | Analytics Engine | Command tracking |
| `PRESETS_API` | Service Binding | Worker-to-worker preset API calls |

## Secrets

### Required

These must be set before the worker will function:

| Secret | Description |
|--------|-------------|
| `DISCORD_TOKEN` | Bot token |
| `DISCORD_PUBLIC_KEY` | Ed25519 verification key for validating interaction payloads |
| `DISCORD_CLIENT_ID` | Application ID |

### Optional

| Secret | Description |
|--------|-------------|
| `BOT_API_SECRET` | Presets API authentication |
| `BOT_SIGNING_SECRET` | HMAC signing for presets API |
| `MODERATOR_IDS` | Comma-separated Discord user IDs with moderator privileges |
| `STATS_AUTHORIZED_USERS` | Users who can view `/stats` |
| `INTERNAL_WEBHOOK_SECRET` | Webhook authentication |
| `MODERATION_CHANNEL_ID` | Channel for moderation notifications |
| `SUBMISSION_LOG_CHANNEL_ID` | Channel for submission announcements |
| `ANNOUNCEMENT_CHANNEL_ID` | Channel for release announcements |

Set secrets with Wrangler:

```bash
npx wrangler secret put DISCORD_TOKEN
```

## CI/CD

Deployment is automated through a **path-filtered GitHub Actions workflow**:

- **Trigger:** Push to `main` when files under `apps/discord-worker/**` change.
- **Shared package changes** also trigger a rebuild, since the worker depends on `@xivdyetools/core` and other shared libraries.
- **Manual dispatch** is available via `workflow_dispatch` for ad-hoc deployments.

## Slash Command Registration

Discord slash commands must be registered with the Discord API before they become visible to users. Run:

```bash
pnpm --filter xivdyetools-discord-worker run register-commands
```

Run this any time you add, modify, or remove a command definition. Registration is **not** part of the deploy step -- it is a separate, explicit action.

## Bundle Size

| Metric | Value |
|--------|-------|
| Uncompressed | ~8 MiB |
| Gzipped | ~2.4 MiB |
| Cloudflare Workers paid plan limit | 10 MiB |

The largest dependencies are `resvg-wasm` (~2.4 MiB) and `photon-wasm` (~1.6 MiB). Monitor bundle size after dependency updates to avoid exceeding the platform limit.

## Service Bindings

The discord-worker communicates with the presets API via **Cloudflare Service Bindings**, which provide direct worker-to-worker calls with no HTTP overhead:

```toml
[[services]]
binding = "PRESETS_API"
service = "xivdyetools-presets-api"
```

The presets API also holds a reverse service binding back to the discord-worker for sending notifications (e.g., when a preset is approved).

## Related Documentation

- [Overview](overview.md) -- Architecture and high-level design
- [Interactions](interactions.md) -- How Discord interactions are received and routed
- [Commands](commands.md) -- Slash command definitions and behavior
- [Rendering](rendering.md) -- Image generation pipeline for dye cards and previews
