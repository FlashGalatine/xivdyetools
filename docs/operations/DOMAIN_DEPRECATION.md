# Retiring `*.xivdyetools.projectgalatine.com`

**Status:** design approved 2026-08-09, Phase 0 not yet run
**Goal:** every service reachable only through its `xivdyetools.app` subdomain.

---

## Scope guard — read this first

Match **`*.xivdyetools.projectgalatine.com`** only. Never search-and-replace the bare string
`projectgalatine.com`: it is also the maintainer's identity across the codebase and those
references are correct and must stay. For example:

```ts
// packages/core/src/config/product-links.ts:34 — DO NOT TOUCH
{ label: 'Bluesky', url: 'https://bsky.app/profile/projectgalatine.com' },
```

Similar live references exist in Patreon and GitHub links. A repo-wide grep for
`projectgalatine` returns ~56 files; only the ones tabled below are in scope.

**Also out of scope:** `docs/audits/**` and `docs/historical/**`. Those are point-in-time
records — rewriting them would falsify history. `apps/web-app/netlify.toml` is already slated
for deletion as `DEAD-003` in the 2026-08-09 audit's Sprint 4.

## Inventory

### Custom domain routes (5 Workers)

| Worker | File | Route |
|---|---|---|
| `discord-worker` | `apps/discord-worker/wrangler.toml:8` | `bot.xivdyetools.projectgalatine.com` |
| `moderation-worker` | `apps/moderation-worker/wrangler.toml:8` | `moderation-bot.xivdyetools.projectgalatine.com` |
| `presets-api` | `apps/presets-api/wrangler.toml:8` | `api.xivdyetools.projectgalatine.com` |
| `oauth` | `apps/oauth/wrangler.toml:8` | `auth.xivdyetools.projectgalatine.com` |
| `api-worker` | `apps/api-worker/wrangler.toml:35` | `proxy.xivdyetools.projectgalatine.com` |

### Allowlists

| File | Entry |
|---|---|
| `apps/oauth/src/constants/oauth.ts:12` | `ALLOWED_REDIRECT_ORIGINS` — already carries `// Transition period - remove after migration complete` |
| `apps/presets-api/wrangler.toml:31` | `ADDITIONAL_CORS_ORIGINS` — retire only the `xivdyetools.projectgalatine.com` entry; leave `xiv-colorexplorer.pages.dev` |

### Migration mechanism (retire last)

`apps/web-app/functions/_middleware.ts:14` redirects the old apex to `xivdyetools.app`. This is
what makes every other removal graceful; it is Phase 4, not Phase 1.

### Documentation

`apps/discord-worker/CLAUDE.md:142`, `apps/oauth/CLAUDE.md:114`,
`apps/presets-api/CLAUDE.md:121`, `apps/moderation-worker/CLAUDE.md:119` (all "Custom domains:"
lines), and `apps/web-app/functions/README.md:11,26`.

---

## Phase 0 — Verification (blocking; requires the Discord portal and Cloudflare dashboard)

**Nothing in Phase 2 or later may proceed until these are answered.** Two of them can hard-break
production the moment a route is removed.

| # | Check | Where | Consequence if missed |
|---|---|---|---|
| 1 | Interactions Endpoint URL of the **main** bot app (`1447108133020369048`) | Discord Developer Portal → General Information | If it points at `bot.xivdyetools.projectgalatine.com`, removing that route kills the live bot immediately |
| 2 | Interactions Endpoint URL of the **moderation** bot app (`1453806659708129374`) | same | Same, for the moderation bot |
| 3 | Registered OAuth **Redirect URIs** on app `1447108133020369048` | Discord Developer Portal → OAuth2 | A registered URI on the old domain breaks login |
| 4 | Per-hostname request volume for all five domains | Cloudflare dashboard → Worker → Metrics | Replaces guesswork about who still uses each domain |

### Results (recorded 2026-08-09)

| # | Finding | Verdict |
|---|---|---|
| 1 | Main bot (`1447108133020369048`) → `https://bot.xivdyetools.app/` | ✅ **Clean** — already on `.app` |
| 2 | Moderation bot (`1453806659708129374`) → `https://moderation-bot.xivdyetools.projectgalatine.com` | ❌ **Blocker** — see Phase 0.5 |
| 3 | Two OAuth redirect URIs on the old domain: `https://xivdyetools.projectgalatine.com/auth/callback` and `https://auth.xivdyetools.projectgalatine.com/auth/callback` | ⚠️ Retire in Phase 2, **after** their routes |
| 4 | Per-hostname traffic | Not yet gathered |

Incidental observation from check 3: `http://localhost:8788/auth/callback` is registered on the
**production** application. `getAllowedRedirectOrigins()` filters localhost when
`ENVIRONMENT !== 'development'`, so this is defended in depth, but the Discord-side registration
is broader than the code permits. Not urgent; worth revisiting separately.

## Phase 0.5 — Repoint the moderation bot's interactions endpoint

**Do this before Phase 2. It is safe to do immediately.**

Change app `1453806659708129374`'s Interactions Endpoint URL from
`https://moderation-bot.xivdyetools.projectgalatine.com` to
`https://moderation-bot.xivdyetools.app`.

Functionally a no-op: both hostnames are custom domains on the *same* Worker script
(`xivdyetools-moderation-worker`) — verified 2026-08-09, both return `HTTP 200` on `/health`, and
`main`'s `wrangler.toml` attaches both. Only the hostname Discord POSTs to changes; it reaches
the same isolate, code and secrets.

Discord sends a signed Ed25519 PING and refuses to save if verification fails, so a successful
save is itself the verification. Afterwards, exercise one approve/reject button — those are
`MESSAGE_COMPONENT` interactions on the same endpoint, so a working button confirms the path.

### Outcome (2026-08-09): this repoint uncovered a live outage

The repoint **failed** with `interactions_endpoint_url: The specified interactions endpoint url
could not be verified`. Root cause: the moderation Worker's `DISCORD_PUBLIC_KEY` secret did not
match application `1453806659708129374`'s public key. Fixed with:

```bash
cd apps/moderation-worker && npx wrangler secret put DISCORD_PUBLIC_KEY
```

Secrets apply immediately; no redeploy was needed. The repoint then succeeded.

**The moderation bot had been non-functional in production.** Ed25519 verification gates every
interaction, so `/preset moderate`, approve/reject buttons, ban/unban and all modals were
returning `401`. Only the auto-approval path still worked, because that runs in `presets-api`
and reaches `discord-worker` by Service Binding — it never touches this endpoint, which is
exactly why the outage produced no visible symptom.

**⚠️ A saved Interactions Endpoint URL is NOT evidence the endpoint works.** Discord verifies
only when the value *changes*, and silently accepts a save that restores a previously-verified
URL. During diagnosis, re-saving the old projectgalatine URL appeared to succeed *with the bad
key still in place*, which looked like proof the key was fine. It was not a live check. Only a
genuinely new URL forces real verification.

Diagnostic notes for next time — `npx wrangler tail` on the Worker while saving is the decisive
instrument, and the error strings discriminate cleanly:

**A healthy verification is exactly two POSTs**, confirmed by `wrangler tail` 2026-08-09: one
validly signed → `200` with `Received PING, responding with PONG`, and one deliberately corrupt
→ `401`. **The order is not fixed** — observed both ways across three attempts. Judge by the
presence of the `200`, never by sequence.

| Log pattern | Meaning |
|---|---|
| one `200` PONG + one `401` | healthy |
| two `401`s, no `200` | the valid PING arrived and failed — key mismatch or altered body |
| `Missing signature headers` (`packages/auth/src/discord.ts:83`) | headers stripped before the Worker — suspect edge/WAF |
| `Invalid signature` (`discord.ts:109`) | headers arrived; key or body wrong |
| no request logged at all | blocked upstream; never reached the Worker |

Note the discrimination that matters: **two `401`s is not the same as a blocked request.** It
proves the valid PING reached the Worker and failed verification, which rules out edge/WAF
causes and points squarely at the secret. Misreading that distinction cost the most time during
this incident.

**Audit the sibling apps.** The same drift is undetectable by inspection anywhere else. The main
bot (`1447108133020369048`) is high-traffic, so a bad key there would be immediately obvious —
but its saved URL is no more proof of health than the moderation bot's was.

### The general rule this illustrates

**Repoint pointers early; retire allowlist entries late.**

| | Interactions Endpoint URL | OAuth Redirect URIs |
|---|---|---|
| Kind | a **pointer** — exactly one per app | an **allowlist** — many entries |
| Changing it | repoints traffic to an equivalent live host | removes a permitted destination; repoints nothing |
| Safe order | repoint **first**, then remove the route | remove the route **first**, then the entry |
| Wrong order costs | nothing — both hosts serve the same Worker | live logins fail with `invalid_redirect_uri` |

A pointer's old value stops mattering the moment it changes. An allowlist entry stays
load-bearing for anyone still using the path it permits.

**Which application to check for #3.** The `oauth` Worker authenticates as
`DISCORD_CLIENT_ID = "1447108133020369048"` — the *production* application — in all three of its
environments (`apps/oauth/wrangler.toml:17,25,34`). That application therefore serves two roles:
Discord bot interactions **and** web-app login. Check its OAuth2 redirect URIs, not the
moderation app's and not the beta bot's.

**Two distinct things are called "redirect URI" here — do not conflate them:**

| Layer | Configured where | Example |
|---|---|---|
| Discord → `oauth` Worker (registered at Discord) | Developer Portal → OAuth2 | `https://auth.xivdyetools.app/auth/callback` |
| `oauth` Worker → front-end (this project's allowlist) | `ALLOWED_REDIRECT_ORIGINS`, `apps/oauth/src/constants/oauth.ts:10` | `https://xivdyetools.app/auth/callback` |

Only the first is registered at Discord and gates Phase 2. The second is the allowlist Phase 1
edits. `BUG-018` (2026-07-18 audit) was caused by exactly this blur — three divergent copies of
the second list let a login begin on the transition domain and fail at the callback.

## Phase 1 — Allowlists and documentation (no runtime route touched)

Landable immediately; nothing reachable changes.

1. Remove the `xivdyetools.projectgalatine.com` entry from
   `apps/oauth/src/constants/oauth.ts:12`, closing the stale "transition period" TODO.
2. Remove it from `ADDITIONAL_CORS_ORIGINS` in `apps/presets-api/wrangler.toml:31`.
3. Update the five documentation references listed above.
4. Add the `DEPRECATIONS.md` entry.

**Why this is safe:** the apex redirect in `_middleware.ts` means a browser never presents
`https://xivdyetools.projectgalatine.com` as an `Origin` — it is redirected to `xivdyetools.app`
before any API call is made. The allowlist entries are already dead in practice.

**Note:** these two changes only take effect on the next production deploy of `oauth` and
`presets-api` respectively, which is gated behind the 5.0 merge.

## Phase 2 — Retire the four internal subdomains

**Gate:** Phase 0.5 done (moderation bot repointed), and no OAuth redirect URI still needed on a
domain about to be removed. For each domain, remove the route *before* retiring any Discord-side
registration that references it.

Retire `bot.`, `moderation-bot.`, `api.`, `auth.` — one Worker at a time, verifying between
each. For each:

1. Delete the route line from `wrangler.toml`.
2. `pnpm --filter <worker> run deploy:production`.
3. **Cloudflare dashboard → Worker → Settings → Domains & Routes → remove the custom domain.**
   Editing `wrangler.toml` alone does not detach it — see the universalis-proxy cutover in
   `DEPRECATIONS.md`, which documents this same manual step.
4. Delete the leftover DNS record for that hostname.
5. Verify the `.app` equivalent still serves, then confirm the old hostname no longer resolves.

## Phase 3 — Retire `proxy.`

**Gate:** Phase 2 complete, a public notice window elapsed, and Phase 0 check 4 showing
near-zero traffic.

`proxy.xivdyetools.projectgalatine.com` is the public Universalis CORS proxy. It is the only
domain in this deprecation whose removal breaks **someone else's** software — Dalamud plugins or
third-party tools may hardcode it, and they get no warning from a config change. Announce it,
give it a window, then follow the same five steps as Phase 2.

## Phase 4 — Remove the apex redirect

**Gate:** a long window after Phase 2, with old-apex traffic at zero.

Remove the redirect block at `apps/web-app/functions/_middleware.ts:14` and its
`apps/web-app/functions/README.md` documentation. After this, old bookmarks fail rather than
redirect — irreversible for anyone who never updated.

---

## Sequencing against the 5.0 release

Phases 2–4 each require a **production deploy** of the affected Worker. Production deploys are
deliberately paused until the `monorepo-2.0-prep` branch merges to `main`. **Phase 1 is
therefore the only phase that can land before that merge** — and it is the phase with no
runtime risk, which is a convenient alignment rather than a constraint.

## Related

- `DEPRECATIONS.md` — the register this deprecation is recorded in; its universalis-proxy entry
  documents the manual custom-domain removal procedure reused in Phase 2.
- `docs/operations/DEPLOY_ENVIRONMENTS.md` — moves every `routes` block into
  `[env.production]`. That refactor and this deprecation touch the same lines, so land the
  environment work first and treat route *removal* as strictly separate.
