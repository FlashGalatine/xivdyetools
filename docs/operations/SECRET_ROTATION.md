# Secret Rotation Procedures

**Project:** xivdyetools monorepo
**Last updated:** November 9, 2026 (Q4 quarterly rotation, brought forward from Nov 15; Cloudflare tokens re-issued at minimum scope, 2026-08-29 FINDING-030; last full rewrite 2026-08-21, FINDING-010)
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
| `INTERNAL_WEBHOOK_SECRET` | presets-api → discord-worker (`/webhooks/preset-submission`) | shared bearer secret (≥ 32 chars in prod) | Quarterly / on compromise |
| `DISCORD_TOKEN` | discord-worker (main bot) | Discord bot token | On compromise |
| `DISCORD_TOKEN` | moderation-worker (moderation bot); the same value is the `production` environment secret `MODERATION_DISCORD_TOKEN` (register-commands step) | Discord bot token | On compromise — **three holders move together** (this, `MODERATION_BOT_TOKEN`, the environment secret); reset 2026-08-29 |
| `MODERATION_BOT_TOKEN` | discord-worker (same token as moderation-worker's `DISCORD_TOKEN`) | Discord bot token | Together with the moderation bot token |
| `DISCORD_PUBLIC_KEY` | discord-worker, moderation-worker | Ed25519 public key (per Discord app) | Only if the app is recreated |
| `DISCORD_CLIENT_SECRET` | oauth | Discord OAuth2 secret | On compromise |
| `XIVAUTH_CLIENT_SECRET` | oauth (optional, confidential-client mode) | XIVAuth OAuth2 secret | On compromise (rotated 2026-01-25) |
| `GITHUB_WEBHOOK_SECRET` | discord-worker (`/webhooks/github` changelog push) | shared with the GitHub webhook | On compromise |
| `PERSPECTIVE_API_KEY` | presets-api | Google API key | On compromise |
| `CACHE_PURGE_API_TOKEN` | presets-api (optional, FINDING-018 — single-file edge purge of deleted / replaced preview images; pairs with the `CACHE_PURGE_ZONE_ID` **var** in `wrangler.toml`, the `xivdyetools.app` zone) | Cloudflare API token scoped to *Zone → Cache Purge → Purge* on that one zone only (it can read or write nothing else) | On compromise; created 2026-08-21 |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | **Retired in discord-worker 5.1.0** (FINDING-007) — no longer read by any worker; the rate limiter runs on the native `[[ratelimits]]` bindings (`RL_5`…`RL_70`) | — (was Upstash REST credentials) | **Deleted** — absent from production discord-worker's `wrangler secret list` on 2026-11-09. If either ever reappears: `wrangler secret delete <NAME> --env production` from `apps/discord-worker` |
| `MODERATOR_IDS` | discord-worker, moderation-worker, presets-api | CSV of Discord IDs (config, not secret) | As needed — all three at once |
| `MODERATION_CHANNEL_ID`, `SUBMISSION_LOG_CHANNEL_ID` | discord-worker, moderation-worker | channel IDs (config) | As needed |
| `STATS_AUTHORIZED_USERS` | discord-worker | CSV of Discord IDs (config) | As needed |
| `OWNER_DISCORD_ID`, `DISCORD_BOT_TOKEN`, `MODERATION_WEBHOOK_URL`, `DISCORD_BOT_WEBHOOK_URL` | presets-api — **no longer read by any code** (the `notifyModerators` path was deleted 2026-09-01, dead-code audit DEAD-009) | — | **Deleted** — absent from production presets-api's `wrangler secret list` on 2026-11-09. If any reappears: `wrangler secret delete <NAME> --env production` from `apps/presets-api` |
| `BOT_TOKEN` | stoat-worker (Node `.env`, parked) | Revolt bot token | On compromise |

### GitHub Actions secrets (repository settings → Secrets; Cloudflare and Discord tokens live under Environments; `CLOUDFLARE_ACCOUNT_ID` stays a repository secret)

The Discord tokens below **must be environment secrets** (`production` for the main and moderation bots, `beta` for the beta bot), not repository secrets: a repository secret is readable by any workflow run regardless of its `environment:`, whereas an environment secret follows that environment's branch policy (`main` only for `production`) (2026-10-03 security audit FINDING-023, same class as FINDING-028). The maintainer makes the move (create the environment secrets, then delete the repository copies) before the PR that documents it merges; `OPEN_ITEMS.md` tracks it. Every job that reads them already declares the matching `environment:`.

**Scope cleanup completed 2026-10-26:** the four repository copies were deleted after checking successful production command registration. The production and beta environment copies remain, with both environment inventories and all secret metadata unchanged. `CLOUDFLARE_ACCOUNT_ID` is the only remaining repository secret. This was scope cleanup, with no token rotation or deployment ([verification](../audits/2026-10-26-security/evidence/remediation-finding-028-2026-10-26.md)).

| Secret | Used by | Rotation |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | every **production** deploy workflow (`environment: production`, `cloudflare/wrangler-action`) — account-wide token. Homed as an **environment secret on `production`** (verified 2026-09-05 via `gh api …/environments/production/secrets`); no repository-level copy remains — FINDING-028 closed. Re-issued 2026-11-09 at the minimum scope below, which closed FINDING-030; **expires 2027-03-01** | Quarterly / on compromise; the real minimum is Account: **Workers Scripts: Edit + Cloudflare Pages: Edit** (this account only) and Zone: **Workers Routes: Edit** on `xivdyetools.app` — the routed workers reconcile their routes on every deploy. No KV/D1/R2 grant: the 2026-11-09 token has none, and the API Worker, Presets API and OG Worker deploys (custom domains, zone routes, KV/D1/R2 bindings) all passed with it |
| `CLOUDFLARE_API_TOKEN_BETA` | the three beta deploy workflows (`deploy-discord-worker-beta.yml`, `deploy-og-worker-beta.yml`, `deploy-web-app-beta.yml`) — `environment: beta`, `cloudflare/wrangler-action`. Exists as an environment secret on `beta` (verified 2026-09-05; the beta deploys have been green since); there is deliberately no fallback to the production token. Re-issued 2026-11-09 with the same grants as `CLOUDFLARE_API_TOKEN`; **expires 2027-03-01** | Quarterly / on compromise, same cadence as `CLOUDFLARE_API_TOKEN`; mint at the real minimum — Account: Workers Scripts + Pages Edit (this account only); Zone: Workers Routes Edit on `xivdyetools.app` (og-worker's beta routes need it). Cloudflare tokens can't be scoped below Account/Zone, so this is **not** narrower than production's own grants — see §7 |
| `CLOUDFLARE_ACCOUNT_ID` | every deploy workflow | not secret (account id) — shared between beta and production on purpose, since both live in the one Cloudflare account |
| `DISCORD_TOKEN` (`production` environment) | `deploy-discord-worker.yml` register-commands step and `sync-dye-emojis.yml` (main bot) | together with the worker secret |
| `MODERATION_DISCORD_TOKEN` (`production` environment) | `deploy-moderation-worker.yml` register-commands step (moderation bot, added 2026-08-29) | together with moderation-worker's `DISCORD_TOKEN` and discord-worker's `MODERATION_BOT_TOKEN` |
| `BETA_DISCORD_TOKEN`, `BETA_DISCORD_GUILD_ID` (`beta` environment) | `deploy-discord-worker-beta.yml` (optional) | with the beta bot token |

npm publishing uses **OIDC trusted publishing** — there is no npm token to rotate.

---

## Rotation schedule

| When | Secrets |
|---|---|
| Quarterly (Feb 15 / May 15 / Aug 15 / Nov 15) | `JWT_SECRET`, `BOT_API_SECRET`, `BOT_SIGNING_SECRET`, `INTERNAL_WEBHOOK_SECRET`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_API_TOKEN_BETA` |
| On compromise | everything else in the inventory |

Both Cloudflare tokens carry an **expiry two weeks after the next quarterly date** (currently 2027-03-01, after the Feb 15 rotation). If a rotation is missed, the token stops working instead of living on indefinitely, and the failure shows up as red deploy workflows with an authentication error. Give each new token the same kind of expiry: the 90-day preset is too short, because it lands *before* the next quarterly date.

Record each rotation in the log at the bottom of this file.

---

## Procedures

Generate values with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # 64 hex chars — fine for every HMAC/bearer secret here
```

**On Windows PowerShell** (5.1 or 7), use the PowerShell blocks under §1–§3; the 2026-11-09 rotation was run with them. A generated value is held only in `$NEW` and piped to each holder, so it never appears on a command line. A value you **paste** is different: a Discord token, an OAuth client secret, anything copied from a dashboard. Never pipe or type it, because PowerShell saves every command line to a history file on disk (PSReadLine). Run `wrangler secret put <NAME>` with no input instead, and paste at its hidden `Enter a secret value` prompt. For the same reason, skip the `curl` token test Cloudflare offers after creating a token, since the token would sit in that history file too. The test deploys in §7 prove the token anyway.

Before rotating, list each production worker's secrets. This confirms every holder is the production worker and shows anything retired that is still set:

```powershell
foreach ($a in 'xivdyetools-discord-worker','xivdyetools-moderation-worker','xivdyetools-presets-api') {
  pnpm --filter $a exec wrangler secret list --env production
}
pnpm --filter xivdyetools-oauth-worker exec wrangler secret list   # oauth: bare = production
```

### 1. `JWT_SECRET` (oauth + presets-api)

**Impact:** every active web session is invalidated (tokens signed with the old key stop verifying); users log in again. Rotate presets-api **first** so no token minted with the new key is ever rejected.

```bash
NEW=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
echo "$NEW" | pnpm --filter xivdyetools-presets-api    exec wrangler secret put JWT_SECRET --env production
echo "$NEW" | pnpm --filter xivdyetools-oauth-worker   exec wrangler secret put JWT_SECRET   # oauth: bare = production
```

```powershell
$NEW = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
$NEW | pnpm --filter xivdyetools-presets-api  exec wrangler secret put JWT_SECRET --env production
$NEW | pnpm --filter xivdyetools-oauth-worker exec wrangler secret put JWT_SECRET    # oauth: bare = production
Remove-Variable NEW
```

Tokens live one hour (`JWT_EXPIRY = "3600"`) and can't be refreshed, so the forced re-login costs users little. The OAuth `state` parameter is signed with this key too, so a login started within about ten minutes before the change fails once and succeeds on retry.

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

```powershell
$apps = 'xivdyetools-discord-worker','xivdyetools-moderation-worker','xivdyetools-presets-api'   # API last
$NEW = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
foreach ($a in $apps) { $NEW | pnpm --filter $a exec wrangler secret put BOT_API_SECRET --env production }
$NEW = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # a different value
foreach ($a in $apps) { $NEW | pnpm --filter $a exec wrangler secret put BOT_SIGNING_SECRET --env production }
Remove-Variable NEW, apps
```

Production only: the beta bot deliberately holds neither secret ([DEPLOY_ENVIRONMENTS.md](DEPLOY_ENVIRONMENTS.md) § Credential boundary). So even though its `PRESETS_API` binding reaches the production presets API, this rotation can't break it.

Verify: `/preset search` (main bot), `/preset moderate action:pending` (moderation bot).

### 3. `INTERNAL_WEBHOOK_SECRET` (presets-api → discord-worker)

```bash
NEW=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
echo "$NEW" | pnpm --filter xivdyetools-discord-worker exec wrangler secret put INTERNAL_WEBHOOK_SECRET --env production
echo "$NEW" | pnpm --filter xivdyetools-presets-api    exec wrangler secret put INTERNAL_WEBHOOK_SECRET --env production
```

```powershell
$NEW = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
$NEW | pnpm --filter xivdyetools-discord-worker exec wrangler secret put INTERNAL_WEBHOOK_SECRET --env production
$NEW | pnpm --filter xivdyetools-presets-api    exec wrangler secret put INTERNAL_WEBHOOK_SECRET --env production
Remove-Variable NEW
```

Verify: submit a preset from the web app; the moderation embed must appear (otherwise a `failed_notifications` row is written).

### 4. Discord bot tokens

Discord Developer Portal → application → **Bot** → *Reset Token* (copy immediately).

- **Main bot** (`1447108133020369048`): `pnpm --filter xivdyetools-discord-worker exec wrangler secret put DISCORD_TOKEN --env production`, then update the `production` environment secret `DISCORD_TOKEN` (register-commands in CI).
- **Moderation bot** (`1453806659708129374`): `pnpm --filter xivdyetools-moderation-worker exec wrangler secret put DISCORD_TOKEN --env production` **and** `pnpm --filter xivdyetools-discord-worker exec wrangler secret put MODERATION_BOT_TOKEN --env production` (discord-worker posts the moderation embeds with it), then update the `production` environment secret `MODERATION_DISCORD_TOKEN` (register-commands in `deploy-moderation-worker.yml`, since 2026-08-29). Three holders — a reset that updates only one leaves the other two answering 401.
- **Beta bot** (`1536085517270261771`): bare `wrangler secret put DISCORD_TOKEN` on discord-worker (top-level = beta) + the `beta` environment secret `BETA_DISCORD_TOKEN`.

Paste each token at wrangler's hidden prompt, never in a pipe (see *On Windows PowerShell* above). *Reset Token* invalidates the old token immediately, so update every holder of that token in the same sitting:

- **Keeps working:** slash-command replies, because each one answers with its own interaction token.
- **Fails until the holders are updated:** everything a worker posts or edits with the bot token. That covers preset images and submission-log posts, moderation embeds and their edits, preview-image buttons and changelog announcements.

Both production deploy workflows run a *Register Discord commands* step with their GitHub copy, after the deploy step. So don't reset a bot token while a *Deploy Discord Worker* or *Deploy Moderation Worker* run is pending or in progress: the step goes red even though the deploy succeeded. Afterwards, test the GitHub copy by dispatching that workflow from `main`. When `main` already matches what is deployed (see §7, step 3), the dispatch only redeploys the same code and re-registers the same commands.

Verify: bot shows online; `/dye search red`; a moderation embed posts to the moderation channel.

### 5. `DISCORD_CLIENT_SECRET` / `XIVAUTH_CLIENT_SECRET` (oauth)

Developer portal → OAuth2 → *Reset Secret*, then `pnpm --filter xivdyetools-oauth-worker exec wrangler secret put DISCORD_CLIENT_SECRET` (bare = production) and paste at the prompt. Discord logins fail between the reset and the `secret put`. Verify a full login. `[env.development]` uses the same Discord application (the same `DISCORD_CLIENT_ID`), so also update a local `apps/oauth/.dev.vars` copy if you have one.

### 6. `GITHUB_WEBHOOK_SECRET`

Generate, set on discord-worker (`--env production`), then update the webhook secret on the GitHub repository webhook (Settings → Webhooks → the changelog webhook). Verify with *Redeliver* on a recent `push` delivery → 200. The redelivery is safe to repeat either way, but the response differs by what the delivery touched: since FINDING-021 the route announces only `push` events from `FlashGalatine/xivdyetools`, and a delivery that modified `CHANGELOG-laymans.md` for a version already recorded in KV (`announced:v:<version>`, 90-day TTL) answers `200 {"message":"Already announced"}` instead of re-posting the release; an ordinary push redelivery that didn't touch the changelog answers `200 {"message":"Changelog not modified, skipping"}` regardless of the memo. The memo is keyed by version, not by delivery, so a corrected changelog re-pushed for an already-announced version is not re-announced automatically — clear the `announced:v:<version>` KV key first if you need to force it.

### 7. `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_API_TOKEN_BETA` (CI)

1. **Create a new token: don't *Roll* the old one.** Roll invalidates the old value at once, so every deploy fails until GitHub has the new one. Go to Cloudflare dashboard → My Profile → API Tokens → *Create Token* → custom. As of November 2026 the form groups grants into **permission policies**, each with its own scope, and the review screen shows the form's *Edit* as *Write*.
   - **Policy 1**, scope *Entire Account* (this account): **Workers Scripts** → Edit and **Pages** → Edit. Find each with the search box; both sit under *Developer Platform*. A search for "pages" also returns *Account Custom Pages* (Cloudflare's branded error and block pages) and *Access: Custom Pages* (Zero Trust login screens). Leave both unset.
   - **Policy 2** (*+ Add policy*), scope the `xivdyetools.app` zone: **Workers Routes** → Edit.
   - **Token expiration:** *Custom*, with no start date and an end date two weeks after the next quarterly date (see [Rotation schedule](#rotation-schedule)).
   - **Client IP address filtering:** leave it empty. GitHub-hosted runners change IP address on every run.

   The review screen should read *Entire … account: Workers Scripts Write, Pages Write* and *xivdyetools.app: Workers Routes Write*, and nothing else.
2. Update the GitHub environment secret (below).
3. **Test before revoking** by dispatching deploy workflows from `main`. A dispatch deploys current `main`, so pick workers whose last green deploy already matches it: no commit under the workflow's `paths:` since that run. Skip *Deploy Discord Worker* and *Deploy Moderation Worker*, which also re-register slash commands. On 2026-11-09, *Deploy API Worker*, *Deploy Presets API* and *Deploy OG Worker* showed between them that the token can upload Worker scripts, attach custom domains and zone routes, publish static assets, and deploy Workers that carry KV, D1 and R2 bindings. None of the three deploys Pages: the production token's Pages grant has not been exercised yet and will first be used by the next *Deploy Web App* run. A dispatch from any other branch is refused by the `production` environment's `main`-only rule.
4. **Revoke the old token** once every test deploy, smoke tests included, is green. If one fails with an authentication or permission error, the old token still works: put it back in GitHub, fix the grant and retry. A run whose jobs never reach a runner (zero steps, or no jobs created) failed on GitHub's side, not the token's, so retry it later.

`CLOUDFLARE_API_TOKEN` belongs on the **`production` environment** (Settings → Environments → production), not the repository — a repository secret is readable by any workflow run regardless of its `environment:`, the same class of exposure FINDING-028 flagged for the beta workflows.

`CLOUDFLARE_API_TOKEN_BETA` (FINDING-028, 2026-08-29) follows the same steps, minted with the same three grants as `CLOUDFLARE_API_TOKEN` above — Workers Scripts: Edit, Pages: Edit, and Workers Routes: Edit on the `xivdyetools.app` zone (og-worker's beta config declares live routes there, so this one isn't optional). Cloudflare token policies have no per-Worker-script or per-Pages-project selector, so there is no way to mint it narrower than production's own grants — the isolation is about which workflows can *read* the credential, not about one credential being technically unable to reach production infrastructure. It lives as an environment secret on **`beta`** (Settings → Environments → beta), never at the repository level, or the point of splitting it from the production token is lost.

To verify it without changing what beta serves, **re-run rather than dispatch**:
1. Open the latest successful run of *Deploy Beta OG Worker* (Workers Scripts and Routes) and choose *Re-run all jobs*. If you also want to check the Pages grant, do the same for *Deploy Beta Web App*.
2. A re-run deploys the same commit with the current secrets, so beta keeps serving whatever branch it already had. A *workflow_dispatch* would deploy the selected branch over it.
3. GitHub only allows re-runs within 30 days of the original run. If the latest beta run is older than that, the next ordinary beta push is the test.
4. **Make sure the deploy actually ran.** A green run is not enough: open the *Deploy Beta …* job and confirm that its deploy and smoke-test steps executed and passed.

   A re-run of a `push` run recomputes the `changes` job against the **current** `origin/main` (`git merge-base origin/main HEAD`). If that branch has since been merged into `main`, the merge base is `HEAD`, so the job emits `deploy=false`. The deploy job is then skipped, and the run still finishes green without using the token.

   If that happens, keep the old token. Test the new one with the next ordinary beta push, or dispatch the workflow from `main`: a dispatch always deploys, so beta then serves `main`.

Record the creation in the rotation log below the same way `CACHE_PURGE_API_TOKEN` was ("created, not rotated").

### 8. `PERSPECTIVE_API_KEY`, `MODERATOR_IDS` & channel IDs

Set on the listed consumers with `--env production`; no ordering constraints. For `MODERATOR_IDS`, all three consumers must agree or a moderator will be able to act in one surface and not another. moderation-worker caches the parsed list per isolate — redeploy (or wait for isolate recycling) after changing it (MOD-15).

---

## Emergency: suspected compromise

1. Rotate the affected secret(s) with the procedures above — **on the production target**.
2. `pnpm --filter <app> exec wrangler tail --env production --format=json | grep -i error` for unusual activity.
3. If `JWT_SECRET` leaked: rotating it ends every session at once (all tokens stop verifying). The `TOKEN_BLACKLIST` KV needs no clearing.
4. If `CLOUDFLARE_API_TOKEN` leaked: roll it **first** (it can redeploy every worker), then audit the account's deployment history. If `CLOUDFLARE_API_TOKEN_BETA` leaked instead: the same account-wide Workers/Pages grants and the same `xivdyetools.app` zone apply, so roll it and audit the account's deployment history exactly as above — **do not** assume a narrower blast radius; Cloudflare's permission model can't scope either token below Account/Zone. What FINDING-028's split buys here is knowing *which* workflow's credential leaked, not a smaller set of reachable resources.
5. Record the incident and every rotation it forced in the [Rotation log](#rotation-log) below.

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
| 2026-10-03 | `INTERNAL_WEBHOOK_SECRET` (presets-api → discord-worker, production) | maintainer | regenerated (64 hex, per §3) and set on both production workers in one PowerShell line — discord-worker first, then presets-api — ahead of discord-worker 5.7.2, which refuses a production webhook secret under 32 characters (2026-10-03 security audit, FINDING-027). The old value could not be read back to check its length, so rotating was the check; nobody holds a copy of the new one. |
| 2026-11-09 | `INTERNAL_WEBHOOK_SECRET`, `BOT_API_SECRET`, `BOT_SIGNING_SECRET`, `JWT_SECRET` (production) | maintainer | Q4 quarterly rotation, brought forward from Nov 15 so it lands before the M-line merges (#391–#403); none of those PRs changes how a secret is read. A pre-flight `wrangler secret list` on all four production workers showed every secret the code reads present and no retired name left. Each secret got a fresh 64-hex value, with `BOT_API_SECRET` and `BOT_SIGNING_SECRET` kept distinct. All were set from PowerShell per §1–§3, in the runbook's order: discord-worker before presets-api, the bots before presets-api, presets-api before oauth. Beta was not touched, by design (§2). This is the first logged rotation of `BOT_API_SECRET`, `BOT_SIGNING_SECRET` and `JWT_SECRET`. |
| 2026-11-09 | `CLOUDFLARE_API_TOKEN` (GitHub `production` environment) | maintainer | Re-issued as a new token (not rolled) at the minimum scope: Workers Scripts Write + Pages Write on the account, Workers Routes Write on `xivdyetools.app`, no KV/D1/R2. This closes 2026-08-29 audit FINDING-030. Expires 2027-03-01. Tested by dispatching *Deploy API Worker*, *Deploy Presets API* and *Deploy OG Worker* from `main` ([42668470928](https://github.com/FlashGalatine/xivdyetools/actions/runs/42668470928), [42668497099](https://github.com/FlashGalatine/xivdyetools/actions/runs/42668497099), [42668526198](https://github.com/FlashGalatine/xivdyetools/actions/runs/42668526198)); all green, smoke tests included. The old token was then revoked. |
| 2026-11-09 | `CLOUDFLARE_API_TOKEN_BETA` (GitHub `beta` environment) | maintainer | Re-issued with the same grants and expiry as the production token. Tested by re-running the deploys already live on beta: *Deploy Beta OG Worker* [42341708815](https://github.com/FlashGalatine/xivdyetools/actions/runs/42341708815) attempt 4 and *Deploy Beta Web App* [42341708783](https://github.com/FlashGalatine/xivdyetools/actions/runs/42341708783) attempt 3, with the deploy and smoke-test steps green. The earlier attempts failed before any job reached a runner ("Internal Server Error" on GitHub's side); so did an earlier dispatch from a docs branch, so none of them used the token. The old token was then revoked. |
