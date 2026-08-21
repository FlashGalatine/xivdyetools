# Post-merge checklist — `monorepo-2.0-prep` → `main`

**Status:** draft 2026-08-21, for the merge scheduled the week of 2026-08-24.
**Owner:** the maintainer (everything marked *user-run* needs credentials CI does not have).
**Why this exists:** merging the branch *is* the 5.0 release (see root `CHANGELOG.md` 2.0.0 →
"Deploy sequence"), and the 2026-08-21 security audit (`docs/audits/2026-08-21-security/`) left a
handful of deliberate "after both sides are deployed" removals. This file is the single ordered
list; tick items as they are done and record dates/hashes inline.

Conventions: `[ ]` open · `[x]` done · **→ prod** = the command targets production, so check the
`wrangler.toml` first (`docs/operations/DEPLOY_ENVIRONMENTS.md`: a bare `wrangler deploy` /
`wrangler secret put` hits the **dev** worker on discord-worker, moderation-worker, presets-api,
api-worker, image-worker; the **routed beta** worker on og-worker; and **production** on oauth).

---

## 0. Before merging (branch readiness)

- [ ] CI green on `monorepo-2.0-prep` including the new `secret-scan` job (first run of
      gitleaks in CI — if it reds on a fixture, extend `.gitleaks.toml` with a comment, do not
      bypass).
- [ ] Decide the fate of the unmerged i18n remediation branch `i18n-remediation-2026-08-20`
      (worktree `.worktrees/xivdyetools-i18n`, 25 commits, gates green): merge into
      `monorepo-2.0-prep` **before** main, or land it as the first post-merge PR. Do not let it
      drift — it touches the same locale files the 5.0 branch ships.
- [ ] **presets-api D1 (user-run, `--remote`, production database):** apply in order
      `0007` (already applied, zero rows) → the generated stainID rewrite from
      `scripts/migrate-dyes-to-stainids.ts` → `0008` → `0009` → `0010` → **`0011_submission_events`**
      (FINDING-007 append-only quota table) → any `0012+` added by the 2026-08-21 remediation
      (check `apps/presets-api/migrations/`). Then the JWT-identity backfill (`5a34fe7c`).
      `docs/projects/presets-api/database.md` lists every migration.
- [ ] **GitHub → Settings → Environments → `production`** (FINDING-009): create it *before* the
      merge and add **Deployment branches: `main` only** + (optional) **Required reviewers: you**.
      Every production deploy / npm publish job now declares `environment: production`; without
      the environment they still run, just ungated. With required reviewers, the merge-day
      deploys will **wait for your approval** in the Actions UI — plan to be at the keyboard.
- [ ] **Secrets present on the PRODUCTION workers** (`wrangler secret list --env production`
      per app; oauth without `--env`): the inventory in `docs/operations/SECRET_ROTATION.md` —
      in particular `BOT_SIGNING_SECRET` (≥ 32 chars, same value on discord-worker,
      moderation-worker, presets-api — the v2 signature is now mandatory when the header is
      present), `JWT_SECRET` (oauth = presets-api), `INTERNAL_WEBHOOK_SECRET`,
      `UPSTASH_REDIS_REST_URL/TOKEN` on discord-worker prod (FINDING-003 — the KV fallback now
      logs a one-time warning if it is ever used), `PERSPECTIVE_API_KEY` on presets-api.
- [ ] **New bindings/vars from the audit remediation exist in production config** (they ship in
      the `wrangler.toml` `[env.production]` blocks and are created on deploy — just confirm after
      the first deploy): presets-api `TOKEN_BLACKLIST` KV (same namespace as oauth's —
      FINDING-002), `JWT_ISSUER` var, `[[ratelimits]]` `RL_PUBLIC`; api-worker `API_RATE_LIMITER`;
      oauth `RL_AUTH_10/20/30`; moderation-worker / discord-worker rate-limit bindings. Cloudflare
      creates `ratelimits` bindings automatically — no dashboard step.
- [ ] Domain cutovers that must precede the worker deploys (`DEPRECATIONS.md` checkboxes):
      release `proxy.xivdyetools.app` / `proxy.xivdyetools.projectgalatine.com` from the old
      universalis-proxy worker; release `developers.xivdyetools.app` from the old api-docs Pages
      project; confirm `xivdyetools-image-worker` carries `/thumbnail`.
- [ ] oauth + presets-api allowlists carry `https://beta.xivdyetools.app` (already deployed by
      hand 2026-08-21 / 2026-08-11 — verify nothing regressed).
- [ ] Package versions bumped for everything touched on the branch (the publish workflow only
      publishes when local ≠ registry): types 2.0.0, logger, auth **1.4.0**, worker-kit **1.1.0**,
      core, svg, bot-logic — see `docs/versions.md` "Unreleased" rows.

## 1. Merge day (what runs, what to watch)

- [ ] Merge → path-filtered deploy workflows run (`deploy-*.yml`); **discord-worker's job runs
      `register-commands` globally** — no manual registration for the main bot.
- [ ] **moderation-worker slash commands (user-run):** `register-commands` is *not* in its deploy
      workflow and the 5.0 remediation changed the command shape (`default_member_permissions`,
      `dm_permission: false`, guild-only contexts — FINDING-006/007). Run
      `pnpm --filter xivdyetools-moderation-worker run register-commands` with the moderation
      bot's production token / guild.
- [ ] Web-app Pages deploy + smoke test job; confirm the custom domain and the `pages.dev` alias
      serve the same asset hashes (cache-poisoning check — `docs/…/xiv-pages-asset-cache-poisoning`).
- [ ] `CHANGELOG-laymans.md` announcement webhook fired once.
- [ ] **npm publish** (Actions → *Publish Packages to npm*), tier order: types → logger → auth →
      core → **worker-kit (first publish is a manual 2FA publish + trusted-publisher setup on
      npmjs.com — OIDC cannot create a package)** → svg → bot-logic. Then `npm deprecate`
      crypto, bot-i18n, color-blending, worker-middleware, rate-limiter (messages in
      `DEPRECATIONS.md`).
- [ ] **User-run afterwards:** `npm run upload-emojis` (production credentials, stainID-keyed set);
      `scripts/cleanup-v4-kv.ts`; og-worker beta deploy then production; purge the edge cache for
      `/og/default.png` / `/og/default-x.png`.
- [ ] Post-deploy verification (same day):
  - [ ] `wrangler tail` each production worker for 10 minutes: no `KV rate limiter fallback`
        warning (discord-worker / api-worker / oauth / moderation-worker), presets-api accepting
        `X-Request-Signature-V2` (bot `/preset` commands work end-to-end), no 5xx bursts.
  - [ ] oauth: login → refresh → logout → refresh is rejected (FINDING-001 revocation TTL).
  - [ ] api-worker: `/v1/dyes` returns `RateLimit-*` headers from the binding; `/universalis/*`
        proxy OK; `developers.xivdyetools.app` docs render.
  - [ ] og-worker: `/og/<tool>/…` returns `cf-cache-status: HIT` on the second request;
        Discord / X link previews render (validators).
  - [ ] image-worker: a > 1,000-px PNG is rejected at the header gate (FINDING-004).
  - [ ] web-app: response headers (`_headers`) as intended incl. CSP; Swatch `.chara` import
        resolves gear; presets list/submit/vote; OG card for `/`.
  - [ ] moderation bot: autocomplete only for moderators; ban flow on a long CJK name
        (FINDING-006/007).

## 2. First week after the merge

### GitHub repository settings (not configurable from the repo)
- [ ] **Code security → Secret scanning + Push protection: ON** (FINDING-030).
- [ ] Dependabot alerts + security updates ON (the nightly `pnpm audit` job is the in-repo half).
- [ ] Branch protection / ruleset on `main`: require the `ci`, `audit` and `secret-scan` checks,
      linear history, no force-push.
- [ ] `production` environment protection rules verified (see §0).
- [ ] `CLOUDFLARE_API_TOKEN` scoped to Workers Scripts + Pages + KV/D1/R2 edit on this account
      only (SECRET_ROTATION.md §7); note the rotation date in the rotation log.

### Cloudflare
- [ ] Confirm the `[[ratelimits]]` bindings exist on every production worker (dashboard →
      Worker → Settings → Bindings) and that KV rate-limit namespaces are now idle.
- [ ] presets-api R2 preview bucket: lifecycle / cache behaviour as set by FINDING-018.
- [ ] Delete the old `xivdyetools-universalis-proxy` worker and the old api-docs Pages project
      after the cutover window (`DEPRECATIONS.md`).
- [ ] Start `docs/operations/DOMAIN_DEPRECATION.md` Phase 0 (`*.xivdyetools.projectgalatine.com`).

### Secrets
- [ ] If any secret was set with a bare `wrangler secret put` before 2026-08-21, it landed on the
      **dev** worker — re-set it on production (`--env production`) per SECRET_ROTATION.md.
- [ ] Optional but recommended: rotate `BOT_SIGNING_SECRET` (all three consumers, one window) now
      that the v2 scheme is live; log it in SECRET_ROTATION.md "Rotation log".

## 3. Legacy / dead code to remove from production (after the above is confirmed)

Each item names the gate that must be true first. Remove with a test that proves the old path
is gone, and a CHANGELOG line.

| Remove | Where | Gate |
|---|---|---|
| **v1 bot HMAC acceptance** (`verifyBotSignature`, `X-Request-Signature` fallback) and the v1 header the bots still send | `apps/presets-api/src/middleware/auth.ts`; `apps/discord-worker/src/services/preset-api.ts`; `apps/moderation-worker/src/services/preset-api.ts`; then deprecate `createBotSignature`/`verifyBotSignature` in `@xivdyetools/auth` (next major) | both bots **and** presets-api production deploys carry the v2 code (tail shows only v2 verifications) — FINDING-014 |
| **KV rate-limiter fallbacks** (`selectApiRateLimiter` KV branch, oauth `kv` backend, discord-worker / moderation-worker KV paths, the `RATE_LIMIT_KV` namespaces) | api-worker `middleware/rate-limit.ts`, oauth `services/rate-limit.ts`, discord-worker `services/rate-limiter.ts`, moderation-worker `middleware/rate-limit.ts`, wrangler KV bindings | one week of production logs with no fallback warning — FINDING-003/005 |
| **Legacy itemID preset fallback** (`resolvePresetDye` legacy path) | presets-api | stainID D1 rewrite applied + backfill verified |
| **Dead notification path + env vars** `notifyModerators`, `MODERATION_WEBHOOK_URL`, `OWNER_DISCORD_ID`, `DISCORD_BOT_TOKEN`, `DISCORD_BOT_WEBHOOK_URL` | presets-api `services/moderation-service.ts`, `Env`, docs/env-var table (PAPI-16) | none — dead today; remove in the first cleanup PR (unless the 2026-08-21 presets-api remediation already did — check its CHANGELOG) |
| **oauth `[env.preview]`** bound to production D1/KV with a dead redirect | `apps/oauth/wrangler.toml` | none — delete if the 2026-08-21 oauth remediation (FINDING-029) kept it |
| `LocalStorageCacheBackend` | web-app (`DEPRECATIONS.md`) | confirm no active path |
| `scripts/cleanup-v4-kv.ts` | repo | after it has been run once in production |
| `/api/v2/*` compat mount of the absorbed universalis proxy | api-worker | after the proxy-domain cutover window (`DEPRECATIONS.md`) |
| `LEGACY_FACEWEAR_ITEM_IDS` | `@xivdyetools/core` | **do not remove** — frozen compatibility map by design |

Also 5.1 work, not removal: discord-worker `/preset submit` / `/preset edit` still send legacy
itemIDs (deferred; recorded under discord-worker 5.0.0 "Known issues").

## 4. Audits to (re-)run after the merge

| Audit | How | When |
|---|---|---|
| **Security — close-out of the 2026-08-21 audit** | walk `findings/FINDING-001..036.md` "Status" lines against production; record residuals (nonce not cached for single-use — FINDING-014; vite 5 dev-only advisories — FINDING-036; GitHub-side settings above); add a "Remediation status" table to `SECURITY_AUDIT_REPORT.md` | week 1 |
| Dependency advisories | nightly `pnpm audit --prod` job (already scheduled); manual `pnpm audit` for dev deps; revisit FINDING-036 (vitepress → Vite ≥ 6.4.3 or VitePress 2) | week 1, then monthly |
| Secret scanning, full history | `gitleaks git . --config .gitleaks.toml` locally (CI scans only each push's commits); GitHub secret-scanning dashboard | week 1, then quarterly |
| Dead code | `pnpm lint:dead` root sweep (triage, not a gate) + the per-package knip gates; a focused pass once §3 removals land | after §3 |
| i18n parity | the parity / order / no-hardcoded-strings / font-coverage gates already in `lint`/`test`; spot-check each locale on production | week 1 |
| Bundle size | discord-worker gzip vs the 3 MiB limit (`check-bundle-size`), web-app `v4-layout` budget | every deploy (CI) |
| E2E | Playwright against production (mobile-chrome project has 28 pre-existing reds — triage or quarantine) | week 1 |
| Accessibility / performance | Lighthouse + axe on the 9 tools (open 5.0 item: a11y bands) | week 2 |
| Link previews | Discord / X validators for `/`, each tool path, a preset and the beta host | merge day |
| Test quality | the standing review check "what source edit would make this test fail?" on suites touched in 5.0 (known vacuous-assertion shapes) | ongoing |

## 5. Residual risks carried forward (from the 2026-08-21 audit)

- Bot → API v2 signature binds a nonce but the server does not cache nonces for strict
  single-use (60 s window, body/method/path bound) — acceptable inside Cloudflare; revisit if the
  API ever takes bot traffic from outside.
- `pnpm audit`: 5 dev-only advisories (vite 5.4.21 via vitepress 1.6.4, esbuild 0.27 via tsup) —
  not reachable at runtime; tracked in FINDING-036.
- Beta surfaces share production presets-api / oauth data by design (`xiv-beta-web-app`).
- stoat-worker stays parked; its abuse controls now exist but it has no deploy workflow.

---

*Update this file as items close; when everything above is ticked, move it to
`docs/historical/` with the completion date.*
