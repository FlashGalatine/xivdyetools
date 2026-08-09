# Deploy Environments and the Beta Test Bot

**Status:** **config implemented 2026-08-09.** The three `wrangler.toml` files, the isolated KV
namespace, and the documentation corrections are done. The remaining steps are the manual
Discord-portal ones in the runbook below.

**Blocker cleared:** `docs/operations/IMAGE_WORKER_SPLIT.md` shipped — `discord-worker` is
2,589.70 KiB gzipped against the 3,072 KiB limit, and `xivdyetools-image-worker` is deployed, so
the `IMAGE_WORKER` binding resolves.

### What changed in the config

| Worker | Top-level name (bare `deploy`) | Routes |
|---|---|---|
| `discord-worker` | `xivdyetools-discord-worker-dev` — **the beta bot**, `workers_dev = true` | moved to `[env.production]` |
| `moderation-worker` | `xivdyetools-moderation-worker-dev`, `workers_dev = false` | moved to `[env.production]` |
| `presets-api` | `xivdyetools-presets-api-dev`, `workers_dev = false` | moved to `[env.production]` |

Beta bot bindings: isolated KV `7d76d17fbb16403c8bf40e16f5b58ba6`, isolated Analytics Engine
dataset `xivdyetools_bot_analytics_beta`, shared D1 and shared `PRESETS_API` / `UNIVERSALIS_PROXY`
/ `IMAGE_WORKER` service bindings. `DISCORD_CLIENT_ID` is the beta app, `1536085517270261771`.

**Two traps found while implementing, recorded so they are not re-discovered:**

1. **`routes` and `workers_dev` are INHERITABLE wrangler keys** — a named environment takes the
   top-level value unless it overrides it. So `routes` had to *move* into `[env.production]`,
   not be copied: left at the top level after the rename, the dev Worker would have claimed
   `bot.xivdyetools.app`. Both keys are now declared explicitly in both environments.
2. **`vars` are NOT inheritable.** `[env.production.vars]` was missing `ANNOUNCEMENT_CHANNEL_ID`,
   which did not matter while both environments deployed to the same Worker. Separating them
   would have silently dropped the GitHub release-announcement channel from production. It is
   now declared in both.
**Scope:** `discord-worker`, `moderation-worker`, `presets-api` wrangler config; a new beta
Discord application; documentation corrections.

---

## Problem

`wrangler deploy` with no `--env` flag deploys **straight to production** on three of six
Workers, while the documentation states it deploys to staging.

This was found the hard way: a `pnpm --filter xivdyetools-discord-worker run deploy` intended as
a safe staging check would have published the unmerged `monorepo-2.0-prep` branch — 152 commits
of unreleased 5.0 work — onto the live bot at `bot.xivdyetools.app`. It failed for an unrelated
reason. Nothing in the command, the script name, or the docs indicated the risk.

### Evidence

| Worker | Top-level `name` | Routes at top level | Bare `wrangler deploy` targets |
|---|---|---|---|
| `api-worker` | `xivdyetools-api-worker-dev` | no | a dev Worker ✅ |
| `og-worker` | `xivdyetools-og-worker-dev` | no | a dev Worker ✅ |
| `oauth` | `xivdyetools-oauth` | yes | production (has `[env.development]` / `[env.preview]`) |
| `discord-worker` | `xivdyetools-discord-worker` | **yes** | **production** ❌ |
| `moderation-worker` | `xivdyetools-moderation-worker` | **yes** | **production** ❌ |
| `presets-api` | `xivdyetools-presets-api` | **yes** | **production** ❌ |

On the three failing Workers, `[env.production]` sets `name` to the *same* value as the
top-level block. Wrangler would otherwise derive `<name>-production` and give two distinct
Workers; the explicit override collapses both onto one script.

The naming is inverted relative to risk: because `routes` is a **non-inheritable** key, the
environment literally named `production` declares no routes, while the *unnamed default* holds
the live custom domains.

### This is a known, decided pattern that was not propagated

`apps/api-worker/wrangler.toml` opens with:

> `# BUG-008 (2026-07-18 audit): the default (top-level) env is a separate dev worker with its`
> `# own name and NO routes, so a plain `wrangler deploy` can never overwrite the production`
> `# worker on data.xivdyetools.app with dev vars or the dev KV namespace.`

The fix was applied to `api-worker` and `og-worker` and never mirrored to the other three — the
same "fixed the instance, not the class" shape the 2026-08-09 pre-release audit documents
repeatedly.

### Documentation is wrong

The root `CLAUDE.md`, `docs/CLAUDE.md` and `apps/api-worker/CLAUDE.md` all describe
`pnpm deploy` as "Deploy to staging (default env)". True for `api-worker` and `og-worker`;
false and actively dangerous for the other three.

---

## Design

### 1. Adopt the `api-worker` pattern on all three Workers

The unqualified default becomes a throwaway dev Worker; production requires explicit intent.

```toml
name = "xivdyetools-discord-worker-dev"   # was: xivdyetools-discord-worker
main = "src/index.ts"
workers_dev = true                         # publishes a *.workers.dev URL
# NO routes at top level

[env.production]
name = "xivdyetools-discord-worker"
routes = [                                 # MOVED here from the top level
  { pattern = "bot.xivdyetools.app", custom_domain = true },
  { pattern = "bot.xivdyetools.projectgalatine.com", custom_domain = true }
]
```

Applied identically to:

| Worker | Dev name | Routes moved into `[env.production]` |
|---|---|---|
| `discord-worker` | `xivdyetools-discord-worker-dev` | `bot.xivdyetools.app`, `bot.xivdyetools.projectgalatine.com` |
| `moderation-worker` | `xivdyetools-moderation-worker-dev` | `moderation-bot.xivdyetools.app`, `moderation-bot.xivdyetools.projectgalatine.com` |
| `presets-api` | `xivdyetools-presets-api-dev` | `api.xivdyetools.app`, `api.xivdyetools.projectgalatine.com` |

**The `routes` block must move, not be copied.** Leaving it at top level after the rename would
attach the production custom domains to the *dev* Worker.

**Move the block verbatim, including the `*.xivdyetools.projectgalatine.com` entries.** Those
domains are being retired, but under a separate phased plan with its own blocking pre-checks —
see `docs/operations/DOMAIN_DEPRECATION.md`. Deleting them here would merge a mechanical config
refactor with a user-facing domain retirement, so a post-deploy failure could not be attributed
to either. Land this work first; remove routes afterwards.

`workers_dev = true` is only required on `discord-worker`, whose dev Worker needs a reachable
URL for Discord's Interactions Endpoint. On `moderation-worker` and `presets-api` the rename
alone achieves the goal — a bare deploy lands on a harmless separate Worker instead of
production — and no dev instance is expected to be exercised. Setting it there is optional and
harmless.

CI is unaffected: `deploy-discord-worker.yml`, `deploy-moderation-worker.yml` and
`deploy-presets-api.yml` all invoke `deploy --env production` explicitly. (`deploy-oauth.yml`
uses bare `deploy`; `oauth` is out of scope here precisely because of that.)

### 2. `discord-worker`'s dev Worker *is* the Beta Test bot

No third environment. Deploying the default env produces the beta bot.

| | Production | Beta |
|---|---|---|
| Worker | `xivdyetools-discord-worker` | `xivdyetools-discord-worker-dev` |
| URL | `bot.xivdyetools.app` | `xivdyetools-discord-worker-dev.<subdomain>.workers.dev` |
| Discord application | `1447108133020369048` | `1536085517270261771` — "XIV Dye Tools (Beta)" |
| KV namespace | `1fcb7e037ccd4172a47fccd97cf8e753` | **new, isolated** |
| D1 / `PRESETS_API` binding | live | **live (shared)** |
| Slash commands | global | **guild-scoped** to the test server |

A separate Discord application is **required, not optional**: an application has exactly one
Interactions Endpoint URL, and the existing one points at `bot.xivdyetools.app`. The beta Worker
can only receive interactions through its own application.

**The beta application needs no OAuth configuration.** Interactions are Ed25519-verified POSTs,
not an OAuth flow, and the bot invite uses the `bot` + `applications.commands` scopes, which do
not require a registered redirect URI. Web-app login is unaffected: the `oauth` Worker
authenticates as the *production* application (`DISCORD_CLIENT_ID = "1447108133020369048"` in
all three of its environments), so the beta app never appears in that flow. Testing web-app
login against a beta stack would need its own OAuth application and is out of scope here.

### 3. Data isolation

```
Discord (beta app) ──► ...-dev.workers.dev ──┬─► own KV namespace   (preferences, favorites,
                                             │                       rate limits, analytics)
                                             └─► live D1 + presets-api  (real presets render)
```

Isolated where beta activity would corrupt real user state; shared where realistic data is the
whole point of the test.

**Accepted residual risk:** `/preset submit` from beta writes a genuine row into the live
moderation queue. Do not exercise that path on beta, or delete the row afterward. Full isolation
would require standing up a staging `presets-api` plus a migrated D1 database, which is
deliberately out of scope (see below).

---

## Runbook: standing up the Beta bot

### Automated (no credentials required)

1. Apply the config changes above to the three `wrangler.toml` files.
2. Create the isolated KV namespace:
   ```bash
   pnpm --filter xivdyetools-discord-worker exec wrangler kv namespace create KV
   ```
   Put the returned id in the **top-level** `[[kv_namespaces]]` block only. Leave
   `[[env.production.kv_namespaces]]` pointing at `1fcb7e037ccd4172a47fccd97cf8e753`.
3. Correct the documentation (root `CLAUDE.md`, `docs/CLAUDE.md`, and the three app
   `CLAUDE.md` files).

### Manual (requires your browser and credentials)

4. **Create the Discord application** at <https://discord.com/developers/applications> —
   name it so it is unmistakable in a member list, e.g. "XIV Dye Tools (Beta)".
   **Already done:** Application ID `1536085517270261771`.
5. Copy its **Public Key**, and (from Bot → Reset Token) its **Token**. The Application ID is
   public and lives in `wrangler.toml`; the token and public key are secrets and must not.
6. Set the top-level `DISCORD_CLIENT_ID` var in `wrangler.toml` to `1536085517270261771`.
   Leave `[env.production.vars]` unchanged at `1447108133020369048`.
7. Deploy once so the URL exists:
   ```bash
   pnpm --filter xivdyetools-discord-worker run deploy
   ```
8. Set the beta secrets against the default environment:
   ```bash
   cd apps/discord-worker
   npx wrangler secret put DISCORD_TOKEN        # beta bot token
   npx wrangler secret put DISCORD_PUBLIC_KEY   # beta app public key
   ```
   Optional secrets (`BOT_API_SECRET`, `INTERNAL_WEBHOOK_SECRET`, Upstash credentials) may be
   omitted — the rate limiter falls back to KV when Upstash is absent.
9. In the Discord portal, set **Interactions Endpoint URL** to the `workers.dev` URL from
   step 7. Discord sends a signed PING and refuses to save unless verification passes; a
   successful save confirms `DISCORD_PUBLIC_KEY` is correct.
10. Invite the beta bot to the test server with the `bot` and `applications.commands` scopes.
11. Register commands **guild-scoped**:
    ```powershell
    $env:DISCORD_TOKEN     = "<beta bot token>"
    $env:DISCORD_CLIENT_ID = "<beta application id>"
    $env:DISCORD_GUILD_ID  = "<test server id>"
    pnpm --filter xivdyetools-discord-worker run register-commands
    ```
    The script targets `/applications/{id}/guilds/{guildId}/commands` when `DISCORD_GUILD_ID`
    is set, leaving global commands untouched.

## Continuous deployment of the beta bot

`.github/workflows/deploy-discord-worker-beta.yml` deploys the beta bot on **any push to a
non-main branch** that touches `apps/discord-worker/**` or one of its packages. It runs the same
build / type-check / test gate as production, then `wrangler deploy` with **no `--env`** — which
is the beta worker.

| | Production workflow | Beta workflow |
|---|---|---|
| Trigger | push to `main`/`master` | push to any other branch (excluding `dependabot/**`) |
| Deploy command | `deploy --env production` | `deploy` |
| `cancel-in-progress` | `false` | `true` — a newer commit supersedes |
| Command registration | global, always | **guild-scoped**, only if secrets are set |
| Smoke test | `bot.xivdyetools.app/health` | none (the `*.workers.dev` host is account-specific) |

**Optional secrets.** Add `BETA_DISCORD_TOKEN` and `BETA_DISCORD_GUILD_ID` to enable automatic
command registration. Without them the worker still deploys and the workflow emits a notice —
so nothing breaks before they exist.

**Registration is guild-scoped, and must stay that way.** `register-commands` is a bulk `PUT`
that overwrites the entire command set at whichever scope it targets. Guild scope confines that
to the test server; a global run from a feature branch would overwrite the live command set.

**There is one beta bot.** Concurrent branches share it and the most recent push wins — inherent
to having a single beta Discord application, not a flaw in the workflow.

### Correction: production registration is automatic

`deploy-discord-worker.yml` already runs `register-commands` (globally) as a step of every
production deploy. Both this document's earlier drafts and the 2026-08-09 audit's
`REMEDIATION_PLAN.md` describe that step as user-run — it is not. **Merging to `main` deploys the
Worker and registers the commands**, so `BUG-001`'s registered-schema fix ships automatically on
merge rather than needing a follow-up command.

### Verification

- The script prints `Target: Guild <id>` — if it prints `Global`, stop; `DISCORD_GUILD_ID` did
  not reach the process.
- Commands appear in the test server immediately (guild commands skip global propagation).
- `/preset list` renders real presets → the shared `PRESETS_API` binding works.
- Production `bot.xivdyetools.app` is untouched — confirm via `wrangler deployments list --env production`.

---

## Risks

| Risk | Mitigation |
|---|---|
| Moving `routes` into `[env.production]` means the next production deploy asserts custom domains it previously did not manage. | Wrangler is idempotent when a custom domain already points at the same Worker. Watch the first post-merge production deploy. Does not affect beta testing. |
| `register-commands` is a bulk `PUT` — it overwrites the entire command set at the targeted scope. | Guild scope confines the overwrite to the test server. Never run it without `DISCORD_GUILD_ID` while on an unmerged branch. |
| Both bots in the same server show near-duplicate commands. | They are distinguishable by bot name/avatar. Beta's are guild-scoped and disappear on re-registering without them. Prefer a dedicated test server. |
| Beta `/preset submit` writes to the live moderation queue. | Accepted. Avoid that path, or delete the row. |

## Out of scope

- **`oauth`** — its CI deploys with bare `wrangler deploy`, so renaming its top level would
  redirect production deploys. Needs a coordinated CI change; not worth bundling here.
- **Fully isolated staging data** — a staging `presets-api` + migrated D1 + seed data. The right
  end state, but far larger than verifying a branch before merge.
- **Staging environments for `moderation-worker` / `presets-api`** — this change only makes their
  *bare deploy* harmless. Standing up working dev instances of them is separate work.

## Related

- `docs/audits/2026-08-09-prerelease-monorepo-upgrade/REMEDIATION_PLAN.md` — the sprint plan this
  work interrupted; Sprint 2's `discord-worker` deploy + `register-commands` remain pending.
- `apps/api-worker/wrangler.toml` — the reference implementation (BUG-008, 2026-07-18 audit).
- `docs/operations/SECRET_ROTATION.md` — secret handling conventions.
