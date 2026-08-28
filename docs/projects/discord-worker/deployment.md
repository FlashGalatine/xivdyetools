# Discord Worker Deployment

> **Version:** 5.0.0

## Platform

The Discord bot is deployed as a **Cloudflare Worker** using [Wrangler](https://developers.cloudflare.com/workers/wrangler/). It receives Discord interactions over HTTP (no gateway connection) and communicates with other workers via Cloudflare Service Bindings.

## Commands

All commands are run from the monorepo root using pnpm workspace filters:

```bash
# Local development server on port 8787
pnpm --filter xivdyetools-discord-worker run dev

# Deploy the routeless dev/BETA worker (xivdyetools-discord-worker-dev) — NOT staging, NOT production
pnpm --filter xivdyetools-discord-worker run deploy

# Deploy to production (xivdyetools-discord-worker, --env production)
pnpm --filter xivdyetools-discord-worker run deploy:production

# Register slash commands with the Discord API
pnpm --filter xivdyetools-discord-worker run register-commands
```

`wrangler.toml` has two environments (see [`docs/operations/DEPLOY_ENVIRONMENTS.md`](../../operations/DEPLOY_ENVIRONMENTS.md)): the top-level block is `xivdyetools-discord-worker-dev` — the **beta bot** (its own Discord application, KV namespace and Analytics dataset, `workers_dev = true`, no routes) — and `[env.production]` is `xivdyetools-discord-worker` with the `bot.*` custom domains. D1 and the service bindings are shared between the two on purpose. `.github/workflows/deploy-discord-worker-beta.yml` deploys the beta bot on non-main pushes.

## Environment Bindings (wrangler.toml)

| Binding | Type | Purpose |
|---------|------|---------|
| `KV` | KV Namespace | Rate limits, preferences, preset favourites, button context, stats |
| `DB` | D1 Database | Preset storage (shared with presets-api) |
| `ANALYTICS` | Analytics Engine | Command tracking |
| `PRESETS_API` | Service Binding | `xivdyetools-presets-api` |
| `UNIVERSALIS_PROXY` | Service Binding | `xivdyetools-api-worker` — market prices (the universalis-proxy app was absorbed) |
| `IMAGE_WORKER` | Service Binding | `xivdyetools-image-worker` — `POST /extract` for `/extractor image` |

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
| `MODERATION_BOT_TOKEN` | Moderation bot token — Discord routes button clicks to the posting application |
| `STATS_AUTHORIZED_USERS` | Users who can view the admin `/stats` subcommands |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Preferred rate-limit backend (falls back to KV) |
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
- The production workflow runs `wrangler deploy --env production` **and then `register-commands`** — the roster published to Discord is whatever is on `main`.

## Slash Command Registration

Discord slash commands must be registered with the Discord API before they become visible to users. Run:

```bash
pnpm --filter xivdyetools-discord-worker run register-commands
```

Run this any time you add, modify, or remove a command definition. Locally, registration is **not** part of `wrangler deploy` — but in CI the production deploy workflow runs it right after the deploy, so do not run it by hand against production first. The script asserts schema parity against `src/commands/registry.ts` and refuses to publish on roster drift. With `BETA_DISCORD_TOKEN` / `BETA_DISCORD_GUILD_ID` set, the beta workflow registers **guild-scoped**.

## Bundle Size

| Metric | Value |
|--------|-------|
| Gzipped | ~2,632 KiB |
| Cloudflare Workers gzip limit | 3,072 KiB (~14 % headroom) |

The largest dependencies are `resvg-wasm` and the bundled fonts (Onest, Space Grotesk, Fragment Mono and the three CJK subsets). Photon (`@cf-wasm/photon`) was moved out to `xivdyetools-image-worker` in 5.0 after it pushed the bundle to 3,209 KiB — see [`docs/operations/IMAGE_WORKER_SPLIT.md`](../../operations/IMAGE_WORKER_SPLIT.md). Monitor bundle size after dependency updates.

## Service Bindings

The discord-worker communicates with the presets API, api-worker (Universalis) and image-worker via **Cloudflare Service Bindings**, which provide direct worker-to-worker calls with no HTTP overhead:

```toml
[[services]]
binding = "PRESETS_API"
service = "xivdyetools-presets-api"

[[services]]
binding = "UNIVERSALIS_PROXY"
service = "xivdyetools-api-worker"

[[services]]
binding = "IMAGE_WORKER"
service = "xivdyetools-image-worker"
```

Deploy `xivdyetools-image-worker` before this Worker so the `IMAGE_WORKER` binding resolves.

The presets API also holds a reverse service binding back to the discord-worker for sending notifications (e.g., when a preset is approved).

## Related Documentation

- [Overview](overview.md) -- Architecture and high-level design
- [Interactions](interactions.md) -- How Discord interactions are received and routed
- [Commands](commands.md) -- Slash command definitions and behavior
- [Rendering](rendering.md) -- Image generation pipeline for dye cards and previews
