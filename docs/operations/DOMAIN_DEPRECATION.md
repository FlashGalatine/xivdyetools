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

Record the answers in this document before proceeding.

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

**Gate:** Phase 0 checks 1–3 clean.

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
