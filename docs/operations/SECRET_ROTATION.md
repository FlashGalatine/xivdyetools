# Secret Rotation Procedures

**Project:** xivdyetools monorepo
**Last updated:** August 21, 2026 (2026-08-21 security audit, FINDING-010 — full rewrite)
**Classification:** Internal Operations
**Next review:** November 21, 2026 (quarterly)

---

## ⚠️ Read this first: which worker does `wrangler secret put` hit?

Every command in this runbook is written to run **from the monorepo root** as

```bash
pnpm --filter <app-package-name> exec wrangler secret put <NAME> [--env production]
```

and the `--env` flag is **load-bearing**. The top-level block of most `wrangler.toml` files is the routeless **dev/beta** worker, so a bare `wrangler secret put` sets the secret on the wrong worker and leaves the compromised value live in production. The one exception is inverted:

| App (pnpm filter) | Production target | Dev / beta target |
|---|---|---|
| `xivdyetools-discord-worker` | `--env production` (`xivdyetools-discord-worker`) | bare (`…-dev`, the *beta* bot on workers.dev) |
| `xivdyetools-moderation-worker` | `--env production` | bare (`…-dev`) |
| `xivdyetools-presets-api` | `--env production` | bare (`…-dev`) |
| `xivdyetools-api-worker` | `--env production` | bare (`…-dev`) |
| `xivdyetools-og-worker` | `--env production` | bare (**routed beta** on `beta.xivdyetools.app`) |
| `xivdyetools-image-worker` | `--env production` | bare (`…-dev`) |
| `xivdyetools-oauth-worker` | **bare** (top-level block IS production, no `[env.production]`) | `--env development` (the `[env.preview]` block was deleted 2026-08-21, FINDING-029) |

See `docs/operations/DEPLOY_ENVIRONMENTS.md` for the full story. `wrangler secret list --env production` (or bare for oauth) confirms where a secret landed.

---

## Secret inventory

Names come from `env.X` reads in `apps/*/src` that are **not** in any `[vars]` block (plus the CI secrets). "Shared" secrets must carry the **same value** on every consumer; rotate them in the order given in the procedures below.

### Cloudflare Worker secrets

| Secret | Consumers (must match) | Kind | Rotation |
|---|---|---|---|
| `JWT_SECRET` | oauth, presets-api | shared HMAC key (≥ 32 bytes) | Quarterly / on compromise |
| `BOT_API_SECRET` | discord-worker, moderation-worker, presets-api | shared bearer | Quarterly / on compromise |
| `BOT_SIGNING_SECRET` | discord-worker, moderation-worker, presets-api | shared HMAC key (≥ 32 chars; required in prod) | Quarterly / on compromise |
| `INTERNAL_WEBHOOK_SECRET` | presets-api → discord-worker (`/webhooks/preset-submission`) | shared HMAC key | Quarterly / on compromise |
| `DISCORD_TOKEN` | discord-worker (main bot) | Discord bot token | On compromise |
| `DISCORD_TOKEN` | moderation-worker (moderation bot); the same value is the GitHub secret `MODERATION_DISCORD_TOKEN` (register-commands step) | Discord bot token | On compromise — **three holders move together** (this, `MODERATION_BOT_TOKEN`, the GitHub secret); reset 2026-08-29 |
| `MODERATION_BOT_TOKEN` | discord-worker (same token as moderation-worker's `DISCORD_TOKEN`) | Discord bot token | Together with the moderation bot token |
| `DISCORD_PUBLIC_KEY` | discord-worker, moderation-worker | Ed25519 public key (per Discord app) | Only if the app is recreated |
| `DISCORD_CLIENT_SECRET` | oauth | Discord OAuth2 secret | On compromise |
| `XIVAUTH_CLIENT_SECRET` | oauth (optional, confidential-client mode) | XIVAuth OAuth2 secret | On compromise (rotated 2026-01-25) |
| `GITHUB_WEBHOOK_SECRET` | discord-worker (`/webhooks/github` changelog push) | shared with the GitHub webhook | On compromise |
| `PERSPECTIVE_API_KEY` | presets-api | Google API key | On compromise |
| `CACHE_PURGE_API_TOKEN` | presets-api (optional, FINDING-018 — single-file edge purge of deleted / replaced preview images; pairs with the `CACHE_PURGE_ZONE_ID` **var** in `wrangler.toml`, the `xivdyetools.app` zone) | Cloudflare API token scoped to *Zone → Cache Purge → Purge* on that one zone only (it can read or write nothing else) | On compromise; created 2026-08-21 |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | **Retired in discord-worker 5.1.0** (FINDING-007) — no longer read by any worker; the rate limiter runs on the native `[[ratelimits]]` bindings (`RL_5`…`RL_70`) | — (was Upstash REST credentials) | **Delete, not rotate** — after the 5.1.0 deploy is live, from `apps/discord-worker`: `wrangler secret delete UPSTASH_REDIS_REST_URL --env production` and `wrangler secret delete UPSTASH_REDIS_REST_TOKEN --env production` |
| `MODERATOR_IDS` | discord-worker, moderation-worker, presets-api | CSV of Discord IDs (config, not secret) | As needed — all three at once |
| `MODERATION_CHANNEL_ID`, `SUBMISSION_LOG_CHANNEL_ID` | discord-worker, moderation-worker | channel IDs (config) | As needed |
| `STATS_AUTHORIZED_USERS` | discord-worker | CSV of Discord IDs (config) | As needed |
| `OWNER_DISCORD_ID`, `DISCORD_BOT_TOKEN`, `MODERATION_WEBHOOK_URL`, `DISCORD_BOT_WEBHOOK_URL` | presets-api — **no longer read by any code** (the `notifyModerators` path was deleted 2026-09-01, dead-code audit DEAD-009) | — | **Delete, not rotate**, from `apps/presets-api`: `wrangler secret delete <NAME> --env production` |
| `BOT_TOKEN` | stoat-worker (Node `.env`, parked) | Revolt bot token | On compromise |

### GitHub Actions secrets (repository settings → Secrets)

| Secret | Used by | Rotation |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | every **production** deploy workflow (`environment: production`, `cloudflare/wrangler-action`) — account-wide token. Still a **repository** secret as of 2026-08-31, not yet homed in the `production` environment — see the FINDING-028 pre-merge item in `POST_MERGE_CHECKLIST.md` §0 | Quarterly / on compromise; the real minimum is Account: **Workers Scripts: Edit + Cloudflare Pages: Edit** (this account only) and Zone: **Workers Routes: Edit** on `xivdyetools.app` — the routed workers reconcile their routes on every deploy. KV/D1/R2 Edit is what FINDING-030 asks you to *drop* if the live token still carries it |
| `CLOUDFLARE_API_TOKEN_BETA` | the three beta deploy workflows (`deploy-discord-worker-beta.yml`, `deploy-og-worker-beta.yml`, `deploy-web-app-beta.yml`) — `environment: beta`, `cloudflare/wrangler-action`. Does not exist yet (created by the FINDING-028 pre-merge item, 2026-08-29 security audit); until it does, all three beta deploys fail on purpose rather than fall back to the production token | Quarterly / on compromise, same cadence as `CLOUDFLARE_API_TOKEN`; mint at the real minimum — Account: Workers Scripts + Pages Edit (this account only); Zone: Workers Routes Edit on `xivdyetools.app` (og-worker's beta routes need it). Cloudflare tokens can't be scoped below Account/Zone, so this is **not** narrower than production's own grants — see §7 |
| `CLOUDFLARE_ACCOUNT_ID` | every deploy workflow | not secret (account id) — shared between beta and production on purpose, since both live in the one Cloudflare account |
| `DISCORD_TOKEN` | `deploy-discord-worker.yml` register-commands step (main bot) | together with the worker secret |
| `MODERATION_DISCORD_TOKEN` | `deploy-moderation-worker.yml` register-commands step (moderation bot, added 2026-08-29) | together with moderation-worker's `DISCORD_TOKEN` and discord-worker's `MODERATION_BOT_TOKEN` |
| `BETA_DISCORD_TOKEN`, `BETA_DISCORD_GUILD_ID` | `deploy-discord-worker-beta.yml` (optional) | with the beta bot token |

npm publishing uses **OIDC trusted publishing** — there is no npm token to rotate.

---

## Rotation schedule

| When | Secrets |
|---|---|
| Quarterly (Feb 15 / May 15 / Aug 15 / Nov 15) | `JWT_SECRET`, `BOT_API_SECRET`, `BOT_SIGNING_SECRET`, `INTERNAL_WEBHOOK_SECRET`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_API_TOKEN_BETA` |
| On compromise | everything else in the inventory |

Record each rotation in the log at the bottom of this file.

---

## Procedures

Generate values with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # 64 hex chars — fine for every HMAC/bearer secret here
```

### 1. `JWT_SECRET` (oauth + presets-api)

**Impact:** every active web session is invalidated (tokens signed with the old key stop verifying); users log in again. Rotate presets-api **first** so no token minted with the new key is ever rejected.

```bash
NEW=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
echo "$NEW" | pnpm --filter xivdyetools-presets-api    exec wrangler secret put JWT_SECRET --env production
echo "$NEW" | pnpm --filter xivdyetools-oauth-worker   exec wrangler secret put JWT_SECRET   # oauth: bare = production
```

Verify: log out, log in at https://xivdyetools.app, load **My Submissions**. Also run the checklist below.

### 2. `BOT_API_SECRET` / `BOT_SIGNING_SECRET` (both bots + presets-api)

**Impact:** bot → API calls fail (401) from the moment the first consumer changes until the last one does — presets-api compares for equality, there is no dual-secret grace. Do it in one sitting, bots first so the API flips last and the window is one command long:

```bash
NEW=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
for app in xivdyetools-discord-worker xivdyetools-moderation-worker xivdyetools-presets-api; do
  echo "$NEW" | pnpm --filter $app exec wrangler secret put BOT_API_SECRET --env production
done
# same loop for BOT_SIGNING_SECRET
```

Verify: `/preset search` (main bot), `/preset moderate action:pending` (moderation bot).

### 3. `INTERNAL_WEBHOOK_SECRET` (presets-api → discord-worker)

```bash
NEW=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
echo "$NEW" | pnpm --filter xivdyetools-discord-worker exec wrangler secret put INTERNAL_WEBHOOK_SECRET --env production
echo "$NEW" | pnpm --filter xivdyetools-presets-api    exec wrangler secret put INTERNAL_WEBHOOK_SECRET --env production
```

Verify: submit a preset from the web app; the moderation embed must appear (otherwise a `failed_notifications` row is written).

### 4. Discord bot tokens

Discord Developer Portal → application → **Bot** → *Reset Token* (copy immediately).

- **Main bot** (`1447108133020369048`): `pnpm --filter xivdyetools-discord-worker exec wrangler secret put DISCORD_TOKEN --env production`, then update the GitHub secret `DISCORD_TOKEN` (register-commands in CI).
- **Moderation bot** (`1453806659708129374`): `pnpm --filter xivdyetools-moderation-worker exec wrangler secret put DISCORD_TOKEN --env production` **and** `pnpm --filter xivdyetools-discord-worker exec wrangler secret put MODERATION_BOT_TOKEN --env production` (discord-worker posts the moderation embeds with it), then update the GitHub secret `MODERATION_DISCORD_TOKEN` (register-commands in `deploy-moderation-worker.yml`, since 2026-08-29). Three holders — a reset that updates only one leaves the other two answering 401.
- **Beta bot** (`1536085517270261771`): bare `wrangler secret put DISCORD_TOKEN` on discord-worker (top-level = beta) + GitHub secret `BETA_DISCORD_TOKEN`.

Verify: bot shows online; `/dye search red`; a moderation embed posts to the moderation channel.

### 5. `DISCORD_CLIENT_SECRET` / `XIVAUTH_CLIENT_SECRET` (oauth)

Developer portal → OAuth2 → *Reset Secret*, then `pnpm --filter xivdyetools-oauth-worker exec wrangler secret put DISCORD_CLIENT_SECRET` (bare = production). Verify a full login.

### 6. `GITHUB_WEBHOOK_SECRET`

Generate, set on discord-worker (`--env production`), then update the webhook secret on the GitHub repository webhook (Settings → Webhooks → the changelog webhook). Verify with *Redeliver* on a recent `push` delivery → 200. The redelivery is safe to repeat either way, but the response differs by what the delivery touched: since FINDING-021 the route announces only `push` events from `FlashGalatine/xivdyetools`, and a delivery that modified `CHANGELOG-laymans.md` for a version already recorded in KV (`announced:v:<version>`, 90-day TTL) answers `200 {"message":"Already announced"}` instead of re-posting the release; an ordinary push redelivery that didn't touch the changelog answers `200 {"message":"Changelog not modified, skipping"}` regardless of the memo. The memo is keyed by version, not by delivery, so a corrected changelog re-pushed for an already-announced version is not re-announced automatically — clear the `announced:v:<version>` KV key first if you need to force it.

### 7. `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_API_TOKEN_BETA` (CI)

Cloudflare dashboard → My Profile → API Tokens → roll or create a token scoped to this account (Workers Scripts: Edit, Pages: Edit, and Workers Routes: Edit on the `xivdyetools.app` zone) → update the GitHub secret → re-run any deploy workflow via *workflow_dispatch* → revoke the old token. `CLOUDFLARE_API_TOKEN` belongs on the **`production` environment** (Settings → Environments → production), not the repository — a repository secret is readable by any workflow run regardless of its `environment:`, the same class of exposure FINDING-028 flagged for the beta workflows.

`CLOUDFLARE_API_TOKEN_BETA` (FINDING-028, 2026-08-29) follows the same steps, minted with the same three grants as `CLOUDFLARE_API_TOKEN` above — Workers Scripts: Edit, Pages: Edit, and Workers Routes: Edit on the `xivdyetools.app` zone (og-worker's beta config declares live routes there, so this one isn't optional). Cloudflare token policies have no per-Worker-script or per-Pages-project selector, so there is no way to mint it narrower than production's own grants — the isolation is about which workflows can *read* the credential, not about one credential being technically unable to reach production infrastructure. It lives as an environment secret on **`beta`** (Settings → Environments → beta), never at the repository level, or the point of splitting it from the production token is lost. Re-run a beta workflow via *workflow_dispatch* to verify. Record the creation in the rotation log below the same way `CACHE_PURGE_API_TOKEN` was ("created, not rotated").

### 8. `PERSPECTIVE_API_KEY`, `MODERATOR_IDS` & channel IDs

Set on the listed consumers with `--env production`; no ordering constraints. For `MODERATOR_IDS`, all three consumers must agree or a moderator will be able to act in one surface and not another. moderation-worker caches the parsed list per isolate — redeploy (or wait for isolate recycling) after changing it (MOD-15).

---

## Emergency: suspected compromise

1. Rotate the affected secret(s) with the procedures above — **on the production target**.
2. `pnpm --filter <app> exec wrangler tail --env production --format=json | grep -i error` for unusual activity.
3. If `JWT_SECRET` leaked: rotating it ends every session at once (all tokens stop verifying). The `TOKEN_BLACKLIST` KV needs no clearing.
4. If `CLOUDFLARE_API_TOKEN` leaked: roll it **first** (it can redeploy every worker), then audit the account's deployment history. If `CLOUDFLARE_API_TOKEN_BETA` leaked instead: the same account-wide Workers/Pages grants and the same `xivdyetools.app` zone apply, so roll it and audit the account's deployment history exactly as above — **do not** assume a narrower blast radius; Cloudflare's permission model can't scope either token below Account/Zone. What FINDING-028's split buys here is knowing *which* workflow's credential leaked, not a smaller set of reachable resources.
5. Write the incident up in `docs/incidents/`.

---

## Verification checklist (after any rotation)

- [ ] `wrangler secret list` (with the right `--env`) shows the secret on the **production** worker
- [ ] OAuth login works; **My Submissions** loads (JWT accepted by presets-api)
- [ ] `/preset search` and `/preset submit` (main bot) and `/preset moderate` (moderation bot) work
- [ ] A web submission produces a moderation embed (service binding + `INTERNAL_WEBHOOK_SECRET`)
- [ ] `https://bot.xivdyetools.app/health`, `https://api.xivdyetools.app/health`, `https://auth.xivdyetools.app/health` return 200
- [ ] No error spike in the Cloudflare dashboard / `wrangler tail`

---

## Rotation log

| Date | Secret(s) | By | Notes |
|---|---|---|---|
| 2026-01-25 | `XIVAUTH_CLIENT_SECRET` | maintainer | leaked in a committed `.env` (audit 2026-01-25 FINDING-003); rotated same day |
| 2026-08-21 | `CACHE_PURGE_API_TOKEN` | maintainer | created (not rotated) — purge-only token on the `xivdyetools.app` zone, set on the **production** presets-api worker (`--env production`) for FINDING-018; `CACHE_PURGE_ZONE_ID` shipped as a `wrangler.toml` var the same day |
| 2026-08-29 | moderation bot token (`DISCORD_TOKEN` on moderation-worker, `MODERATION_BOT_TOKEN` on discord-worker, GitHub `MODERATION_DISCORD_TOKEN`) | maintainer | reset in the Developer Portal so the new *Register Discord commands* CI step could get a value it never had; all three holders updated the same day — GitHub secret first, then both production worker secrets (`--env production`, per §4). Between the reset and the worker updates, moderation channel posts / embed edits answered 401 — next time set the worker secrets in the same sitting |
| 2026-08-29 | `GITHUB_WEBHOOK_SECRET` (discord-worker, production) | maintainer's session | regenerated (64 hex) and set on the worker in the same step that created GitHub webhook `671693119` → `https://bot.xivdyetools.app/webhooks/github` — the first hook ever pointed at that route, so the previous value had no consumer to break; creation ping answered 200 |
