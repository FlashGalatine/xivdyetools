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

*Walked 2026-08-21 against the live account (`wrangler` OAuth + `gh` admin) — **every item
closed**, except the dashboard re-check of bindings after the first production deploy. The
production-D1 item was split — only `0011` belongs before the merge; the stainID rewrite and the
identity backfill moved to §1 (see the reasoning inline). The i18n branch was merged the same day
(`29efe5f0`) and the optional cache-purge credentials were configured.*

- [x] CI green on `monorepo-2.0-prep` including the new `secret-scan` job — run on `4a07f249`
      (2026-08-21): *Secret scan (gitleaks)*, *Security audit (production dependencies)* and
      *Lint, Type-check, Test, Build* all `success`; gitleaks' first CI run was clean, no
      `.gitleaks.toml` change needed.
- [x] **i18n remediation branch `i18n-remediation-2026-08-20` merged into the 5.0 line** —
      merge commit `29efe5f0` (2026-08-21). 141 files auto-merged, 6 conflicted and were resolved
      keeping both sides' intent: `main.ts` keeps the CSP-safe `renderFatalError` (WEB-9) and
      feeds it the i18n branch's six-language copy through a new optional `copy` parameter;
      `my-submissions-modal.ts` keeps the FINDING-011 `escapeHtml()` on remote strings *and* the
      localized vote count / `var(--font-mono)` row; `CHANGELOG.md` is one `[Unreleased]` block;
      the three add/add audit docs took the branch's post-remediation versions. Gates on the
      merged tree: eslint + knip clean, `tsc` clean, `validate:i18n` parity clean, vitest
      2591/2591, `build:check` within budget. The `.worktrees/xivdyetools-i18n` worktree and the
      remote branch can be removed once `monorepo-2.0-prep` carries `29efe5f0`.
- [x] **presets-api D1 — `0011_submission_events` applied to production 2026-08-21**
      (`wrangler d1 execute DB --remote --env production --file=./migrations/0011_submission_events.sql`,
      2 queries, verified via `sqlite_master`: table + `idx_submission_events_user_kind_created`).
      It is additive, the 2026-08-11 production build ignores it, and it **had** to precede the
      merge because `deploy-presets-api.yml` deploys 2.1.0 automatically on merge and that build
      writes the table on every quota-bearing mutation. State of the rest, verified the same day:
      - `0002`–`0010` are all live (columns `example_link`, `preview_image_key/status`,
        `secondary_categories` present; `rate_limits` gone; `banned_users` / `failed_notifications`
        exist). **`d1_migrations` is empty** — every file was applied with `d1 execute --file`, which
        is this project's documented procedure; **never run `wrangler d1 migrations apply`** against
        this database, it would replay `002`–`0010` and fail on the first duplicate column.
      - No `0012+` exists (`apps/presets-api/migrations/` ends at `0011`).
      - **The generated stainID rewrite is NOT applied** (16 presets, 16 still keyed by legacy
        itemIDs — first element > 254 — 0 by stainID) and **must not be applied before the merge**:
        the production web-app (4.x) and discord-worker (4.x) render preset palettes by itemID and
        presets-api serves the stored array raw; only the 5.0 clients (`resolvePresetDye`) read
        both eras. It moved to §1, after the web-app / discord-worker deploys land.
      - **The JWT-identity backfill (`5a34fe7c`) is NOT applied and is not optional**: production
        presets-api is the 2026-08-11T13:29Z build (pre-`5a34fe7c`), so web sessions still resolve
        to the oauth UUID today; **all 16 `presets.author_discord_id` and all 33 `votes.user_discord_id`
        are UUIDs** (0 in `moderation_log`), and 17 of oauth's 18 `users` rows have a `discord_id`
        (1 XIVAuth-only user keeps its UUID by design). Moved to §1, immediately after the
        presets-api production deploy.
- [x] **GitHub → Settings → Environments → `production`** (FINDING-009) — created 2026-08-21 via
      the REST API with **Deployment branches: `main` only** (custom branch policy, `main`/branch).
      **Required reviewers were NOT added** — every merge-day deploy + publish job would wait for
      a click; add them under Settings → Environments → production if you want that gate.
- [x] **Secrets present on the PRODUCTION workers** — `wrangler secret list --env production`
      (oauth bare) on 2026-08-21 matches the `SECRET_ROTATION.md` inventory name-for-name:
      discord-worker (incl. `UPSTASH_REDIS_REST_URL/TOKEN`, `BOT_SIGNING_SECRET`,
      `INTERNAL_WEBHOOK_SECRET`, `GITHUB_WEBHOOK_SECRET`), moderation-worker, presets-api (incl.
      `JWT_SECRET`, `PERSPECTIVE_API_KEY`, `BOT_SIGNING_SECRET`), oauth (`JWT_SECRET`,
      `DISCORD_CLIENT_SECRET`, `XIVAUTH_CLIENT_SECRET`); api-worker / image-worker / og-worker
      hold none and need none. Values cannot be read back — length (≥ 32) and cross-worker
      equality of `BOT_SIGNING_SECRET` / `JWT_SECRET` are proven only by the §1 tail + oauth
      login → presets call. Three **orphans** with no code reference (candidates for
      `wrangler secret delete … --env production`, listed in §3): discord-worker
      `PRESET_API_SECRET` and `PERSPECTIVE_API_KEY`; presets-api `MODERATOR_CHANNEL_ID`
      (plus the four PAPI-16 dead vars already tracked there).
- [x] **New bindings/vars from the audit remediation exist in production config** — verified in
      the `wrangler.toml` `[env.production]` blocks 2026-08-21: presets-api `TOKEN_BLACKLIST`
      KV id `0d6f3be3…` **= oauth's production namespace** (dev `891bbbe8…` = oauth dev),
      `JWT_ISSUER = https://auth.xivdyetools.app`, `[[ratelimits]] RL_PUBLIC`; api-worker
      `API_RATE_LIMITER`; oauth `RL_AUTH_10/20/30` (top-level = production); moderation-worker two
      `[[ratelimits]]`; discord-worker uses Upstash + KV (no `ratelimits` binding by design).
  - [ ] Confirm in the dashboard after the first production deploy (Worker → Settings → Bindings).
- [x] **Optional presets-api cache-purge credentials** (FINDING-018) — done 2026-08-21:
      `CACHE_PURGE_API_TOKEN` (purge-only token on the `xivdyetools.app` zone) set by the
      maintainer on the **production** worker (`wrangler secret list --env production` shows it);
      `CACHE_PURGE_ZONE_ID` (`ec1fb94c…`, from `wrangler r2 bucket domain list`) ships as a
      `[env.production]` **var** rather than a secret. Inventory + rotation-log rows added to
      `SECRET_ROTATION.md`; success now logs `[preview-image] cache purged <url>`. The production
      build (2026-08-11) predates the purge code, so the path goes live with the merge-day deploy —
      verify in §1 (`cf-cache-status` flips off `HIT` after a delete; tail shows `cache purged`).
      Side fix: `shots.xivdyetools.app` minimum TLS raised 1.0 → 1.2.
- [x] Domain cutovers — **already live, verified 2026-08-21**: `proxy.xivdyetools.app` and
      `proxy.xivdyetools.projectgalatine.com` answer api-worker (`/v1/dyes` 200,
      `/api/v2/data-centers` 200 — the old proxy had no `/v1`); `developers.xivdyetools.app` is
      no longer attached to the `xivdyetools-api-docs` Pages project (only its `pages.dev` alias
      remains) and serves the Workers-Static-Assets VitePress build; image-worker production
      (deploy 2026-08-11T03:26Z) post-dates `POST /thumbnail` (`b9be5724`, 2026-08-11T00:20Z).
      Left for §2: the old `xivdyetools-universalis-proxy` worker still exists (last deploy
      2026-07-13) and so does the `xivdyetools-api-docs` Pages project.
- [x] oauth + presets-api allowlists carry `https://beta.xivdyetools.app` — live `OPTIONS`
      preflight with `Origin: https://beta.xivdyetools.app` returns
      `Access-Control-Allow-Origin: https://beta.xivdyetools.app` on `api.xivdyetools.app` and
      `auth.xivdyetools.app` (2026-08-21).
- [x] Package versions bumped — local ≠ registry for all seven on 2026-08-21: types 2.0.0 (npm
      1.15.0), logger 2.1.0 (1.3.0), auth 1.4.0 (1.2.0), worker-kit 1.1.0 (never published),
      core 4.0.1 (2.7.0), svg 2.0.1 (1.2.1), bot-logic 2.1.0 (1.3.0); `docs/versions.md` agrees
      with every `package.json` (7 packages + 8 apps).

## 1. Merge day (what runs, what to watch)

- [x] Merge → path-filtered deploy workflows run (`deploy-*.yml`); **discord-worker's job runs
      `register-commands` globally** — no manual registration for the main bot.
      **Done 2026-08-28:** PR #123 merged with a merge commit (`2790344a`, 23:36:41Z, 464 commits,
      main had no divergent commits). All nine runs on the merge commit green: CI `33221014926`,
      discord-worker `33221014958` (*Register Discord commands* step `success`; production
      deployment 23:37:50Z), presets-api `33221015036` (deployment 23:37:33Z), web-app
      `33221015165` (Pages deployment `dddbb46f`), api-worker `33221014866`, oauth `33221015055`,
      og-worker `33221014841`, image-worker `33221015057`, moderation-worker `33221014877`.
- [ ] **moderation-worker slash commands (user-run):** `register-commands` is *not* in its deploy
      workflow and the 5.0 remediation changed the command shape (`default_member_permissions`,
      `dm_permission: false`, guild-only contexts — FINDING-006/007). Run
      `pnpm --filter xivdyetools-moderation-worker run register-commands` with the moderation
      bot's production token / guild. *Still open after merge day (2026-08-28): the moderation
      bot's token is not among the repository secrets (`DISCORD_TOKEN` there is the main bot's), so
      nothing in CI can do this.*
- [x] **presets-api production D1 — the two data migrations (user-run, moved here from §0):**
      both applied 2026-08-28, detail below.
  - [x] **JWT-identity backfill — immediately after `deploy-presets-api.yml` goes green** (the
        2.1.0 build resolves web sessions to the Discord snowflake; until the backfill runs the 16
        existing presets / 33 votes are invisible to their authors, and before the deploy the
        backfill would hide them from the old build instead — so the window is the deploy itself).
        Source of truth is **oauth's** D1 (`xivdyetools-users`, from `apps/oauth`):
        `SELECT id, discord_id FROM users WHERE discord_id IS NOT NULL` (17 rows on 2026-08-21) →
        on the presets D1 (`apps/presets-api`, `--env production`), per row:
        `UPDATE presets SET author_discord_id = '<snowflake>' WHERE author_discord_id = '<uuid>';`
        `UPDATE votes SET user_discord_id = '<snowflake>' WHERE user_discord_id = '<uuid>';`
        (`moderation_log.moderator_discord_id` had 0 UUID rows — skip). `votes` has a composite
        `PRIMARY KEY (preset_id, user_discord_id)` — if an UPDATE collides (same person voted from
        both clients), delete the UUID row and keep the earlier snowflake row.
        Verify with `SELECT COUNT(*) FROM presets WHERE length(author_discord_id) = 36` → 1 at most
        (the single XIVAuth-only account).
        **Done 2026-08-28 ~23:40Z**, minutes after run `33221015036` went green. oauth `users` had
        18 rows, 17 with a `discord_id`, **0 duplicate `discord_id`s** (so a `votes` PK collision was
        impossible — no snowflake-keyed rows existed yet). One `d1 execute --file` batch of 34
        UPDATEs re-keyed **14 presets + 24 votes**. What is left under a UUID is **one account**
        (`f23de5ea…`, `discord_id IS NULL` in oauth = the XIVAuth-only user) owning 2 presets + 9
        votes — by design. NB the verification query above counts *rows*; read "→ 1 at most" as
        "one distinct UUID at most" (`SELECT COUNT(DISTINCT author_discord_id) … length(...) = 36`).
  - [x] **stainID rewrite — after the web-app Pages deploy AND the discord-worker deploy are live**
        (4.x clients render the stored array by itemID; the 5.0 ones read both eras), from
        `apps/presets-api`: dump `SELECT id, dyes, previous_values FROM presets` with `--json`,
        `npx tsx scripts/migrate-dyes-to-stainids.ts <dump.json> > migrations/generated-stainid-updates.sql`,
        review (expect 16 UPDATEs), apply with `d1 execute DB --remote --env production --file=…`.
        Idempotent. Verify: `SELECT COUNT(*) FROM presets WHERE CAST(json_extract(dyes,'$[0]') AS INTEGER) > 254` → 0.
        Until this runs, 5.0 clients keep working through `resolvePresetDye`'s legacy fallback;
        the §3 "legacy itemID preset fallback" removal is gated on it.
        **Done 2026-08-28 ~23:45Z**, after Pages deployment `dddbb46f` and the discord-worker
        deployment were live: 16 UPDATEs generated from a fresh dump, applied, verified —
        `CAST(json_extract(dyes,'$[0]') AS INTEGER) > 254` → **0**, every `dye_signature` equals its
        sorted `dyes` array, no `previous_values` rows existed. **Trap hit on the first attempt:**
        D1 refuses the explicit `BEGIN TRANSACTION;` / `COMMIT;` the script used to emit
        (`To execute a transaction, please use the state.storage.transaction() … APIs instead of the
        SQL BEGIN TRANSACTION or SAVEPOINT statements`) and the batch failed before touching data;
        a `--file` batch is atomic anyway, so the script now emits a comment instead (same day).
- [x] Web-app Pages deploy + smoke test job; confirm the custom domain and the `pages.dev` alias
      serve the same asset hashes (cache-poisoning check — `docs/…/xiv-pages-asset-cache-poisoning`).
      **Done 2026-08-28:** run `33221015165`, deployment `dddbb46f` (`index-TtM1bHty.js`); the smoke
      test confirmed `xivdyetools.app` serves that deployment (sha256 `a23d5678f856`). NB the
      project's alias is **`xiv-colorexplorer.pages.dev`** (a renamed Pages project keeps its
      original subdomain) — `xivdyetools.pages.dev` does not exist. `/` carries the CSP, HSTS
      (preload), `nosniff` and `X-Frame-Options: DENY` headers.
- [ ] `CHANGELOG-laymans.md` announcement webhook fired once.
      **Did not fire, and cannot as configured (found 2026-08-28):** the repository has exactly one
      webhook (id `596896553`) — Discord's *native* GitHub-push integration
      (`discord.com/api/webhooks/…/github`; it delivered 204 for the merge push at 23:36:52Z and
      posts commit summaries, not the changelog). Nothing points at discord-worker's
      `POST /webhooks/github` (`https://bot.xivdyetools.app/webhooks/github`, HMAC-verified against
      `GITHUB_WEBHOOK_SECRET`), so the laymans announcement handler has never received a push.
      To wire it: Settings → Webhooks → Add: that URL, content type `application/json`, secret =
      the value of the worker's `GITHUB_WEBHOOK_SECRET`, event *push*. The next push to `main` that
      touches the root `CHANGELOG-laymans.md` then announces — or *Redeliver* a qualifying delivery
      from the new hook's *Recent Deliveries* once one exists.
- [ ] **npm publish** (Actions → *Publish Packages to npm*), tier order: types → logger → auth →
      core → **worker-kit (first publish is a manual 2FA publish + trusted-publisher setup on
      npmjs.com — OIDC cannot create a package)** → svg → bot-logic. Then `npm deprecate`
      crypto, bot-i18n, color-blending, worker-middleware, rate-limiter (messages in
      `DEPRECATIONS.md`).
      **Run `33221213399` (dispatched 2026-08-28 23:40Z, `all-modified`) published six of seven —
      types 2.0.0, logger 2.1.0, auth 1.4.0, core 4.0.1, svg 2.0.1, bot-logic 2.1.0 (verified with
      `npm view`) — and failed on worker-kit exactly as predicted:
      `E404 Not Found - PUT https://registry.npmjs.org/@xivdyetools%2fworker-kit`.** Still open:
      the 2FA first publish of worker-kit 1.1.0
      (`pnpm --filter @xivdyetools/worker-kit publish --provenance --access public --no-git-checks --otp=<code>`),
      then its trusted-publisher entry on npmjs.com (GitHub Actions, `FlashGalatine/xivdyetools`,
      `publish-packages.yml`), then the five `npm deprecate` calls.
- [ ] **User-run afterwards:** `npm run upload-emojis` (production credentials, stainID-keyed set);
      `scripts/cleanup-v4-kv.ts`; og-worker beta deploy then production; purge the edge cache for
      `/og/default.png` / `/og/default-x.png`.
- [ ] Post-deploy verification (same day):
  - [ ] `wrangler tail` each production worker for 10 minutes: no `KV rate limiter fallback`
        warning (discord-worker / api-worker / oauth / moderation-worker), presets-api accepting
        `X-Request-Signature-V2` (bot `/preset` commands work end-to-end), no 5xx bursts.
        *2026-08-28: presets-api tailed for 150 s right after the deploy — one request, `outcome:
        ok`, no warnings or exceptions; too little traffic to prove anything, so the 10-minute
        tails (and the bot `/preset` round trip) remain.*
  - [ ] oauth: login → refresh → logout → refresh is rejected (FINDING-001 revocation TTL).
        (`/health` 200 on 2026-08-28; the token flow needs a browser session.)
  - [x] api-worker: `/v1/dyes` returns `RateLimit-*` headers from the binding; `/universalis/*`
        proxy OK; `developers.xivdyetools.app` docs render.
        **2026-08-28:** `/v1/dyes` 200 with `X-RateLimit-Limit: 65` / `X-RateLimit-Remaining` /
        `X-RateLimit-Reset` (the headers are `X-RateLimit-*`, not `RateLimit-*`);
        `/universalis/data-centers` 200; `developers.xivdyetools.app` 200 `text/html`.
  - [x] og-worker: `/og/<tool>/…` returns `cf-cache-status: HIT` on the second request;
        Discord / X link previews render (validators).
        **2026-08-28, with two corrections to the expectation.** Images are served from
        **`og.xivdyetools.app/og/…png`** (the crawler HTML on `xivdyetools.app/<tool>/*` points
        there); `xivdyetools.app/og/*` is *not* routed to og-worker — it falls through to the Pages
        SPA, which is what a naive probe sees. `/og/harmony/10/complementary.png` → 200 `image/png`,
        `Cache-Control: public, max-age=86400, s-maxage=604800`. **There is no `cf-cache-status`
        header on this path**: the worker caches through `caches.default` (`cache.match` /
        `cache.put` in `index.ts`), which is invisible in response headers — verify hits from the
        worker's logs or Analytics, not headers. Validators still to run by hand.
  - [ ] image-worker: a > 1,000-px PNG is rejected at the header gate (FINDING-004).
        (Not reachable from outside — service-binding only; exercise it through `/swatch` with an
        oversize PNG.)
  - [ ] presets-api preview-image purge (FINDING-018, credentials set 2026-08-21): upload a
        preview → `curl -I https://shots.xivdyetools.app/<key>` twice → `cf-cache-status: HIT`;
        delete it → the next `curl -I` is not `HIT`; the tail shows `[preview-image] cache purged`
        and no `cache purge failed`.
  - [ ] web-app: response headers (`_headers`) as intended incl. CSP; Swatch `.chara` import
        resolves gear; presets list/submit/vote; OG card for `/`.
        (Headers verified 2026-08-28 — see the Pages item above; the in-app checks are manual.)
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
- [ ] **Code security → Private vulnerability reporting: ON** — `SECURITY.md` (new) points
      reporters at it.

### Cloudflare
- [ ] Confirm the `[[ratelimits]]` bindings exist on every production worker (dashboard →
      Worker → Settings → Bindings) and that KV rate-limit namespaces are now idle.
- [ ] og-worker (OG-4, FINDING-024): add a WAF rate-limiting rule on `xivdyetools.app/og/*`
      (image renders are CPU-bound; the worker-side guard + edge cache cover the common case).
- [ ] If a `xivdyetools-oauth-preview` worker or the `auth-preview.xivdyetools.app` custom domain
      ever existed, delete both (the `[env.preview]` config is gone — FINDING-029; DNS is NXDOMAIN
      today, so most likely nothing to do).
- [ ] api-worker's dev worker is no longer reachable over `*.workers.dev` (`workers_dev = false`,
      FINDING-025) — use `pnpm dev` for ad-hoc testing; same for og-worker's dev worker.
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
| **Orphan production secrets** (set on the worker, no code reference as of 2026-08-21): discord-worker `PRESET_API_SECRET`, `PERSPECTIVE_API_KEY`; presets-api `MODERATOR_CHANNEL_ID` (+ the four PAPI-16 vars above once their code goes) | `wrangler secret delete <NAME> --env production` from the app dir | the §1 tail is clean for a day (proves nothing deployed still reads them) |
| **oauth `[env.preview]`** bound to production D1/KV with a dead redirect | `apps/oauth/wrangler.toml` | none — delete if the 2026-08-21 oauth remediation (FINDING-029) kept it |
| `LocalStorageCacheBackend` | web-app (`DEPRECATIONS.md`) | confirm no active path |
| `scripts/cleanup-v4-kv.ts` | repo | after it has been run once in production |
| `/api/v2/*` compat mount of the absorbed universalis proxy | api-worker | after the proxy-domain cutover window (`DEPRECATIONS.md`) |
| `LEGACY_FACEWEAR_ITEM_IDS` | `@xivdyetools/core` | **do not remove** — frozen compatibility map by design |

Also 5.1 work, not removal: discord-worker `/preset submit` / `/preset edit` still send legacy
itemIDs (deferred; recorded under discord-worker 5.0.0 "Known issues"); the web-app submission
form does not yet mirror presets-api's new tag charset / control-character rules (users see the
API's 400 message — FINDING-019/028); `moderation_log` rows for ban / unban / hide / restore need a
presets-api-owned decision (table has `preset_id NOT NULL`; moderation-worker deferred it —
FINDING-034); cross-identity (`xivauth_id`) bans need oauth + moderation changes (FINDING-017).

## 4. Audits to (re-)run after the merge

| Audit | How | When |
|---|---|---|
| **Security — close-out of the 2026-08-21 audit** | walk `findings/FINDING-001..036.md` "Status" lines against production; record residuals (nonce not cached for single-use — FINDING-014; vite 5 dev-only advisories — FINDING-036; GitHub-side settings above); add a "Remediation status" table to `SECURITY_AUDIT_REPORT.md` | week 1 |
| Dependency advisories | nightly `pnpm audit --prod` job (already scheduled); manual `pnpm audit` for dev deps (0 advisories at 2026-08-21 thanks to the FINDING-036 overrides — drop `vitepress>vite` from `pnpm-workspace.yaml` once VitePress ships on Vite ≥ 6.4.3) | week 1, then monthly |
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
- `pnpm audit` is clean (0 advisories) only because of two scoped overrides (FINDING-036); a
  vitepress / tsup upgrade that changes its own vite / esbuild range may need them revisited.
- Beta surfaces share production presets-api / oauth data by design (`xiv-beta-web-app`).
- stoat-worker stays parked; its abuse controls now exist but it has no deploy workflow.
- discord-worker `PRIVACY_POLICY.md` states Analytics Engine retention as "3 months" — confirm
  against Cloudflare's current limits page and correct if needed (FINDING-022).
- api-worker: no second-tier / origin-aware rate limiter (API-6) and discord-worker does not
  forward a per-user key to the Universalis proxy (API-7 other half) — policy decisions, not bugs.
- web-app ships source maps (WEB-10) — MIT project, no secrets; kept for E2E coverage mapping and
  bundle bisects.

---

*Update this file as items close; when everything above is ticked, move it to
`docs/historical/` with the completion date.*
