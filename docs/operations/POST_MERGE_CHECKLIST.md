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
      - **`0012_submission_events_text_edit.sql` exists since 2026-08-30 (presets-api 2.2.0, security
        audit 2026-08-29 Sprint 1 / FINDING-005) and is a HAND-RUN step:** it rebuilds `submission_events`
        to admit the new `text_edit` kind (SQLite cannot alter a CHECK). Apply with
        `wrangler d1 execute xivdyetools-presets --remote --file=migrations/0012_submission_events_text_edit.sql`
        from `apps/presets-api`, checking `SELECT COUNT(*) FROM submission_events` before and after.
        Order does not matter for safety — before the 2.2.0 deploy is cleanest; applied late, the new
        per-user text-edit cap is simply inert until it lands. Nothing else in `0012+` exists.
      - **oauth (`xivdyetools-users` D1) — `apps/oauth/migrations/0001_drop_xivauth_characters.sql` exists
        since 2026-08-30 (oauth 3.0.0, security audit 2026-08-29 Sprint 2 / FINDING-001 + 002) and is a
        HAND-RUN step AFTER the 3.0.0 deploy is live:** `DROP TABLE xivauth_characters` + `ALTER TABLE users
        DROP COLUMN avatar_url`. Run the header's precondition queries first, then
        `wrangler d1 execute xivdyetools-users --remote --file=migrations/0001_drop_xivauth_characters.sql`
        from `apps/oauth`. Never `wrangler d1 migrations apply` here either (the directory matches wrangler's
        default `migrations_dir` and the ALTER is not idempotent). The 3.0.0 code neither reads nor writes
        either column, so a late run is inert — but FINDING-001 stays open until the roster rows are gone.
        **Never run it before the 3.0.0 deploy** (2.7.0 writes both on every sign-in → 500s), and **once it
        has run, never roll the worker back below 3.0.0** — roll forward, or restore the schema first
        (`ALTER TABLE users ADD COLUMN avatar_url TEXT;` + recreate `xivauth_characters` from
        `git show c7c1782b:apps/oauth/schema/users.sql`).
      - **presets-api D1 — `0013_moderation_log_user_actions.sql` exists since 2026-08-30 (security audit
        2026-08-29 Sprint 4 / FINDING-018) and is a HAND-RUN step BEFORE the moderation-worker 1.6.0
        deploy — i.e. before merging `security-audit-2026-08-29`, since `deploy-moderation-worker.yml`
        runs on push to `main` and the merge auto-deploys 1.6.0:** the migration is safe against what is
        deployed today (1.5.0 writes nothing to `moderation_log`, presets-api 2.2.0 always binds a real
        `preset_id`), so run it now rather than trying to time it against the merge. It rebuilds
        `moderation_log` so `preset_id` is nullable and adds `target_discord_id`, which is what lets
        moderation-worker log `ban` / `unban` / `hide` / `restore`. Apply with
        `wrangler d1 execute xivdyetools-presets --remote --file=migrations/0013_moderation_log_user_actions.sql`
        from `apps/presets-api`. Verify with `SELECT COUNT(*) FROM moderation_log` before and after (the
        rebuild copies every row, so the two numbers must match) and `PRAGMA table_info(moderation_log)`
        (`preset_id` notnull = 0, `target_discord_id` present). No presets-api deploy is needed — presets-api
        neither writes nor reads the new column. **Run late and every ban and unban fails until it is
        applied**: 1.6.0 writes the audit rows in the same atomic batch as the `banned_users` insert, so the
        missing column aborts the whole batch — nothing is lost, no half state, and the moderator sees
        "Ban system schema is out of date — apply presets-api migration 0013." until it lands (no
        redeploy needed afterwards). Never
        `wrangler d1 migrations apply` here either; a second `--file` run is refused by the migration's own
        first statement ("duplicate column name: target_discord_id").
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
- [ ] **Create the `beta` GitHub environment + `CLOUDFLARE_API_TOKEN_BETA`, and move
      `CLOUDFLARE_API_TOKEN` out of the repository secret store** (2026-08-29 FINDING-028) —
      `deploy-discord-worker-beta.yml`, `deploy-og-worker-beta.yml` and `deploy-web-app-beta.yml`
      now declare `environment: beta` and read `secrets.CLOUDFLARE_API_TOKEN_BETA` instead of the
      production token; **deliberately no fallback** (ruling S12-R1: never
      `CLOUDFLARE_API_TOKEN_BETA || CLOUDFLARE_API_TOKEN`), so all three fail loudly at the
      `wrangler-action` step until both exist. **Verified not yet done, 2026-08-31**
      (`gh api repos/FlashGalatine/xivdyetools/environments` lists only `production`; `.../actions/secrets`
      shows `CLOUDFLARE_API_TOKEN` as a **repository** secret, not scoped to any environment, and no
      `CLOUDFLARE_API_TOKEN_BETA` anywhere) — **and this already applies to every push to a non-main
      branch, starting now, not only after this branch merges**: the three workflows trigger on
      branch pushes today, including pushes to `security-audit-2026-08-29` itself.
      Settings → Environments → New environment → `beta`. The repo is public
      (`visibility: public`, confirmed the same way), so unlike a private repo on GitHub Free this
      needs no plan upgrade. Give it no protection rules — beta is meant to deploy from any branch,
      unlike `production`'s `main`-only policy. Then Cloudflare dashboard → My Profile → API Tokens
      → Create Token, scoped **narrow**: Workers Scripts: Edit + Pages: Edit, limited to the beta
      Worker names (`xivdyetools-*-dev`) and the `xivdyetools-beta` Pages project — **not** a copy
      of the production token, which reaches every Worker and Pages project on the account. Store
      it as an environment secret named `CLOUDFLARE_API_TOKEN_BETA` on `beta` (Settings →
      Environments → beta → Add secret — a *repository* secret would defeat the point, since any
      workflow can read one of those). Then close the other half: add `CLOUDFLARE_API_TOKEN` as an
      environment secret on `production` with its current value (an environment secret takes
      precedence over a same-named repository secret, so the eight other workflows that read
      `secrets.CLOUDFLARE_API_TOKEN` under `environment: production` — every `deploy-*.yml` in the
      repo except these three beta ones — keep working unchanged), and delete the repository-level
      `CLOUDFLARE_API_TOKEN`.
      That last step is not optional polish: `environment: production` only restricts a secret that
      is actually homed in that environment — left at the repository level, the token stays
      readable by any workflow run regardless of what `environment:` it declares — the same class of
      exposure FINDING-028 describes, just for every other production-deploying workflow instead of
      the three beta ones this task fixed. `CLOUDFLARE_ACCOUNT_ID` stays a repository secret on
      purpose — it is an account identifier, not a credential, and beta and production share the
      one Cloudflare account. Log both changes in `SECRET_ROTATION.md`'s rotation log (see its §7).
      See `docs/operations/DEPLOY_ENVIRONMENTS.md` for the full write-up.
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
  - [ ] **After the discord-worker 5.1.0 deploy is live** (FINDING-007) — the worker no longer
        reads Upstash, so retire the two now-orphaned secrets and confirm the new bindings:
        ```bash
        # from apps/discord-worker
        wrangler secret delete UPSTASH_REDIS_REST_URL --env production
        wrangler secret delete UPSTASH_REDIS_REST_TOKEN --env production
        ```
        Then confirm in the dashboard (Worker → Settings → Bindings) that **both** environments
        list the six rate-limit bindings `RL_5`, `RL_10`, `RL_15`, `RL_20`, `RL_30`, `RL_70`.
- [x] **New bindings/vars from the audit remediation exist in production config** — verified in
      the `wrangler.toml` `[env.production]` blocks 2026-08-21: presets-api `TOKEN_BLACKLIST`
      KV id `0d6f3be3…` **= oauth's production namespace** (dev `891bbbe8…` = oauth dev),
      `JWT_ISSUER = https://auth.xivdyetools.app`, `[[ratelimits]] RL_PUBLIC`; api-worker
      `API_RATE_LIMITER`; oauth `RL_AUTH_10/20/30` (top-level = production); moderation-worker two
      `[[ratelimits]]`; discord-worker had no `ratelimits` binding at the time. **Superseded
      2026-08-30 (FINDING-007):** discord-worker now declares six `[[ratelimits]]` tiers per
      environment — `RL_5`/`RL_10`/`RL_15`/`RL_20`/`RL_30`/`RL_70`, `namespace_id` 1041–1046
      (production) and 1051–1056 (top-level beta) — and reads no Upstash secret.
  - [x] Confirm in the dashboard after the first production deploy (Worker → Settings → Bindings).
        Verified 2026-08-29 via the API (`GET /accounts/…/workers/scripts/<name>/settings`) on all
        seven production scripts: presets-api `TOKEN_BLACKLIST` + `RL_PUBLIC` + `CACHE_PURGE_ZONE_ID`
        + D1/R2/two services; api-worker `API_RATE_LIMITER` (+ the `RATE_LIMIT` KV fallback);
        oauth `RL_AUTH_10/20/30` + `TOKEN_BLACKLIST`; moderation-worker `RL_COMMAND` +
        `RL_AUTOCOMPLETE`; discord-worker Upstash + KV + `IMAGE_WORKER`/`PRESETS_API`/
        `UNIVERSALIS_PROXY` services + `ANNOUNCEMENT_CHANNEL_ID` (the six `RL_*` tiers land with
        the 5.1.0 deploy — see the FINDING-007 step in the secrets bullet above); og-worker `ANALYTICS`;
        image-worker none. The §3 orphan secrets are still present, as expected.
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
      **2026-08-29 (PR #151, chara-name privacy):** svg → **3.0.0** and bot-logic → **3.0.0**
      (both breaking; npm still has 2.0.1 / 2.1.0), discord-worker → 5.0.1; `docs/versions.md`
      updated. **Publish svg 3.0.0 before bot-logic 3.0.0** — bot-logic's `workspace:*` on svg is
      rewritten to the exact `3.0.0` at publish time, so a bot-logic-first publish leaves every
      external `npm install @xivdyetools/bot-logic@3.0.0` unresolvable (ETARGET on svg), and
      bot-logic 3.0.0 resolved against svg 2.x would crash at render (`title` vs `charName`).

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
      bot's production token / guild.
      **Resolved 2026-08-29 by moving it into CI:** the maintainer reset the moderation bot's token
      (Developer Portal) and stored it as the GitHub secret `MODERATION_DISCORD_TOKEN`;
      `deploy-moderation-worker.yml` now has a *Register Discord commands* step (global, app
      `1453806659708129374`) after every production deploy, like the main bot. The first
      registration is the `workflow_dispatch` run right after that change merged. **A token reset
      invalidates the old value everywhere:** production moderation-worker `DISCORD_TOKEN` and
      discord-worker `MODERATION_BOT_TOKEN` must be re-set to the new token
      (`wrangler secret put … --env production` from each app dir) or moderation embeds / channel
      posts 401 — tracked in `SECRET_ROTATION.md`'s log.
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
- [x] `CHANGELOG-laymans.md` announcement webhook fired once.
      **Wired 2026-08-29:** GitHub webhook `671693119` (push, JSON) →
      `https://bot.xivdyetools.app/webhooks/github`, with a freshly generated shared secret set
      as production `GITHUB_WEBHOOK_SECRET` in the same step (the old value had no consumer);
      GitHub's creation ping was answered **200** — but the 10-minute tail then showed the handler
      answering **413** to real push payloads (`contentLength: 18196` against a 10 KB cap shared
      with the internal preset-submission webhook; GitHub's `repository` object alone is several
      KB). Fixed in the same close-out change: the GitHub route now allows 1 MiB and also checks
      `head_commit`, with route tests. The 5.0 announcement is carried by the push that merges
      this checklist (it corrects the `[5.0.0]` date in both laymans files to the real ship date,
      2026-08-28) — GitHub delivers that push before the fixed worker is deployed, so it is
      **redelivered from the hook's Recent Deliveries once `deploy-discord-worker.yml` is green**.
      **Done:** the merge push of PR #138 (delivered 01:01:32Z → 413 by the old build) was
      redelivered at **01:05:26Z → 200** after run `33225254977` shipped the fix; the 5.0 entry
      posted to `ANNOUNCEMENT_CHANNEL_ID` — **which was the wrong channel**: production's
      `wrangler.toml` still carried the top-level (beta) value `1441800851747508314`. Corrected to
      `1434357606008356874` in `[env.production.vars]` and the push redelivered once more after
      that deploy (the stray post in the old channel is deleted by hand — the bot token is not
      available to the session). Two gotchas for next time: reading a single delivery's
      payload needs the `admin:repo_hook` token scope (listing does not) — correlate by the PR's
      `mergedAt` instead; and Workers Logs is not enabled on discord-worker, so `wrangler tail`
      is the only live view of the handler.
      *Original finding (2026-08-28):* the repository had exactly one
      webhook (id `596896553`) — Discord's *native* GitHub-push integration
      (`discord.com/api/webhooks/…/github`; it delivered 204 for the merge push at 23:36:52Z and
      posts commit summaries, not the changelog). Nothing points at discord-worker's
      `POST /webhooks/github` (`https://bot.xivdyetools.app/webhooks/github`, HMAC-verified against
      `GITHUB_WEBHOOK_SECRET`), so the laymans announcement handler has never received a push.
      To wire it: Settings → Webhooks → Add: that URL, content type `application/json`, secret =
      the value of the worker's `GITHUB_WEBHOOK_SECRET`, event *push*. The next push to `main` that
      touches the root `CHANGELOG-laymans.md` then announces — or *Redeliver* a qualifying delivery
      from the new hook's *Recent Deliveries* once one exists.
- [x] **npm publish** (Actions → *Publish Packages to npm*), tier order: types → logger → auth →
      core → **worker-kit (first publish is a manual 2FA publish + trusted-publisher setup on
      npmjs.com — OIDC cannot create a package)** → svg → bot-logic. Then `npm deprecate`
      crypto, bot-i18n, color-blending, worker-middleware, rate-limiter (messages in
      `DEPRECATIONS.md`).
      **Done 2026-08-28.** Run `33221213399` (dispatched 23:40Z, `all-modified`) published six of
      seven — types 2.0.0, logger 2.1.0, auth 1.4.0, core 4.0.1, svg 2.0.1, bot-logic 2.1.0 — and
      failed on worker-kit exactly as predicted (`E404 Not Found - PUT
      https://registry.npmjs.org/@xivdyetools%2fworker-kit`). The maintainer then published
      **worker-kit 1.1.0 by hand** (granular access token with *Bypass 2FA* in the user-level
      `~/.npmrc`, no `--provenance`; registry shows 67 files and all nine export subpaths), set the
      package to *Require 2FA and disallow tokens* and added its trusted publisher. The five
      **`npm deprecate` calls are live** (verified with `npm view … deprecated`); the token was
      refused for them (`Two-factor authentication is required to publish this package but an
      automation token was specified` — those packages disallow tokens), so they went through
      `npm login --auth-type=web` with the security key. The root `CLAUDE.md` / `.npmrc` break-glass
      text now describes this token flow instead of `--otp` (the maintainer's 2FA is a security key).
      **Pending 2026-08-29 (PR #151):** publish `@xivdyetools/svg` 3.0.0 **then**
      `@xivdyetools/bot-logic` 3.0.0 — the order is load-bearing (see §0 above); `all-modified`
      keeps the tier order by itself, a single-package dispatch does not.
      **Pending (Sprint 9, worker-kit 1.2.0, docs/audits/2026-08-29-security FINDING-010 +
      FINDING-012):** after merge, Actions → *Publish Packages to npm* → `@xivdyetools/worker-kit`.
      This is an ordinary re-publish over OIDC trusted publishing — 1.1.0 is already on the
      registry and its trusted-publisher config is already set, so this is not the first-publish
      break-glass flow above and needs no npm token (the package requires 2FA and disallows
      tokens, which would reject one anyway). **The publish is not what delivers the fix** — all
      seven consumer workers resolve `@xivdyetools/worker-kit` via `workspace:*` and pick up
      1.2.0 from this merge at their own next deploy; the npm publish only matters to an external
      consumer of the package.

      **Pending (Sprint 10, logger 2.1.1, FINDING-025):** same shape — Actions → *Publish Packages
      to npm* → `@xivdyetools/logger`. 2.1.0 is on the registry, so an ordinary OIDC re-publish, no
      token. Deliberately a **patch** rather than a minor: semver here decides who receives the
      redaction fix automatically, and a consumer pinned `~2.1.0` gets a patch but not a minor.

      **Pending (Sprint 11, auth 2.0.0, FINDING-015) — the branch's first MAJOR:**
      Actions → *Publish Packages to npm* → `@xivdyetools/auth`. Also an ordinary OIDC re-publish
      (1.4.0 published from this workflow on 2026-08-28, trusted publisher already configured), and
      auth is Level 0, so it has **no ordering constraint** against svg → bot-logic or worker-kit.
      MAJOR because a public export disappears: `verifyBotSignature` (the v1 bot-request signature).
      **No worker needs a redeploy for it** — all five in-repo consumers resolve `workspace:*`, and
      every one of them stopped using v1 earlier in this same branch (presets-api 2.2.0 stopped
      accepting it, discord-worker 5.1.0 and moderation-worker 1.6.0 stopped sending it). The break
      is only for an external consumer still calling v1; `packages/auth/CHANGELOG.md` 2.0.0 carries
      the migration, and pinning `@xivdyetools/auth@^1` is the escape hatch. Note that no
      deprecation release preceded this — the audit's evidence suggested one, and the plan chose
      straight removal.
- [ ] **User-run afterwards:** `npm run upload-emojis` (production credentials, stainID-keyed set);
      `scripts/cleanup-v4-kv.ts`; og-worker beta deploy then production; purge the edge cache for
      `/og/default.png` / `/og/default-x.png`.
      **Status 2026-08-29:** `cleanup-v4-kv.ts` **done** — the production KV held exactly one
      `xivdye:favorites:*` and one `xivdye:collections:*` key (same user), both deleted; zero
      `i18n:user:*` keys; the one `budget:world:v1:*` key stays (DEAD-010: product decision, the
      read-side migration still folds it). The script is removed in the same commit (§3 row).
      Note its documented commands ran bare — add `--env production` or they hit the dev
      namespace. **og-worker: nothing to do** — production deployed by CI on the merge
      (23:37:28Z) and the beta worker (last deploy 2026-08-21T20:09Z) had no og-worker / svg /
      core commits after it. **Purge: nothing to do** — `/og/default.png`'s cached bytes equal a
      cache-busted render (sha256 `1dee1bc9…`) and `/og/default-x.png` no longer exists (404;
      stale item). **`upload-emojis`: moved into CI** — `sync-dye-emojis.yml` (`workflow_dispatch`,
      `production` environment, token from `secrets.DISCORD_TOKEN`) runs the script and publishes
      the rewritten `emoji-mapping.json` as an artifact to commit. **Run 2026-08-29
      (`33225293642`): "125 dyes → uploaded 125 (replaced 125), deleted 0 orphans"** — the main
      bot's set is now the stainID-keyed `chip-1` artwork; the mapping was committed from the
      artifact in PR #140 and shipped by `deploy-discord-worker.yml` run `33225589268` (about
      25 minutes after the upload — the window during which embeds referenced deleted ids).
- [ ] **Workers Logs / Logpush / tail consumers stay OFF** until this branch is merged AND every
      one of the seven `@xivdyetools/worker-kit` consumer workers has redeployed: `api-worker`,
      `discord-worker`, `image-worker`, `moderation-worker`, `oauth`, `og-worker`, `presets-api`
      (`stoat-worker` is parked and no longer depends on `worker-kit` — not one of the seven).
      FINDING-010 and FINDING-012 (docs/audits/2026-08-29-security) close in `worker-kit` 1.2.0,
      but until each worker above has actually redeployed, production keeps running the pre-fix
      code that logs the rate limiter's raw key (a client IP or Discord user id) on backend-error
      and fail-open paths — enabling log retention before then would retain exactly the
      identifiers this audit set out to stop collecting. Once every worker has redeployed,
      spot-verify the redaction first (`wrangler tail`, trigger a fail-open, confirm the line
      carries `keyScope` — e.g. `public:ip` or `ip` — and no raw IP or snowflake) before turning
      Workers Logs on for real. See `findings/FINDING-010.md`.
- [ ] Post-deploy verification (same day):
  - [ ] `wrangler tail` each production worker for 10 minutes: no `KV rate limiter fallback`
        warning (discord-worker / api-worker / oauth / moderation-worker), presets-api accepting
        `X-Request-Signature-V2` (bot `/preset` commands work end-to-end), no 5xx bursts.
        *2026-08-28: presets-api tailed for 150 s right after the deploy — one request, `outcome:
        ok`, no warnings or exceptions; too little traffic to prove anything, so the 10-minute
        tails (and the bot `/preset` round trip) remain.*
        **2026-08-29, 10-minute tails on all five (discord-worker, api-worker, oauth,
        moderation-worker, presets-api): every request `outcome: ok`, 0 exceptions, 0 5xx, 0
        `KV rate limiter fallback` warnings** — but only 10 requests in total, so the fallback
        check is "clean under light load", not proof under pressure. The single warning caught was
        real and unrelated to rate limiting: `GitHub webhook payload too large`
        (`contentLength: 18196`) — the freshly wired `/webhooks/github` hook was rejecting GitHub's
        real push payloads because the handler's cap was 10 KB (GitHub's creation ping is smaller
        and had passed). Fixed in the same close-out change; see the webhook item. The bot
        `/preset` v2-signature round trip still needs a real command invocation to observe.
  - [ ] oauth: login → `POST /auth/revoke` → `GET /auth/me` **and** an authenticated presets-api write with the same token both answer 401 (2026-08-21 FINDING-001 revocation TTL; `/auth/refresh` no longer exists as of oauth 3.0.0 — 2026-08-29 FINDING-003).
        (`/health` 200 on 2026-08-28; the token flow needs a browser session.)
  - [x] api-worker: `/v1/dyes` returns `RateLimit-*` headers from the binding; `/universalis/*`
        proxy OK; `developers.xivdyetools.app` docs render.
        **2026-08-28:** `/v1/dyes` 200 with `X-RateLimit-Limit: 65` / `X-RateLimit-Remaining` /
        `X-RateLimit-Reset` (the headers are `X-RateLimit-*`, not `RateLimit-*`);
        `/universalis/data-centers` 200; `developers.xivdyetools.app` 200 `text/html`.
  - [ ] api-worker telemetry sanity — `docs/operations/ANALYTICS_QUERIES.md` §0: rows written to
        `xivdyetools_web_analytics` in the last 24 h are non-zero (a silent zero right after a
        web-app host change means the Origin allowlist needs the new host — FINDING-014).
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
- [x] **Post-merge dependency bumps (2026-08-29).** Dependabot's pre-merge PRs (#132/#126)
      touched packages the branch had deleted, so `@dependabot recreate` produced #134 (14 dev
      deps) and #133 (4 production deps). **#134 merged → 7 deploys + CI green, `deploy-web-app`
      RED at the bundle gate**: vite 8.1.5 → 8.2.2's rolldown inlined `preset-submission-form`
      (+27 KB source) into `v4-layout` (223 KB vs the 215 KB budget) because `config-sidebar.ts`
      imported it statically while `swatch-tool.ts` imported it lazily — 8.1.x had merely happened
      to keep the split. Fixed in PR #139 by loading the form on click (210 KB; no budget change);
      its deploy `33225454857` went green and the domain now serves deployment `edae096d`. The
      failed deploy never reached the Pages step, so production stayed on the merge-day build
      meanwhile. **#133** needed a one-line fix first — `@cloudflare/workers-types` 5.20260825.1
      declares a global `Buffer: any` that collides with `@types/node` in `scripts/upload-emojis.ts`
      (`TS2554`); encode via `Buffer.from(png)`. That fix was first pushed onto the Dependabot
      branch, but once #134's lockfile landed #133 **conflicted**, and a Dependabot rebase would
      drop a manual commit — so the fix was moved to `main` (cherry-pick `e65ee1c3`, this PR) and
      #133 is `@dependabot recreate`d on top of it; its merge is recorded in the PR trail.

## 2. First week after the merge

### GitHub repository settings (not configurable from the repo)
- [x] **Code security → Secret scanning + Push protection: ON** (2026-08-21 FINDING-030).
      **Verified live 2026-08-31** — `gh api repos/FlashGalatine/xivdyetools --jq
      '.security_and_analysis'` shows both `secret_scanning` and
      `secret_scanning_push_protection` as `"enabled"` (`dependabot_security_updates`,
      `secret_scanning_validity_checks` and `secret_scanning_non_provider_patterns` are
      separate toggles on the same page, still `"disabled"` — out of scope for this item, not
      what FINDING-030 asked for). Both live under Settings → Code security and analysis.
      **Secret scanning** is detection only: GitHub diffs pushed content against known
      providers' token/key formats and opens an alert on a match — after the fact, on content
      already in the repository. **Push protection** is prevention: it runs at `git push` time
      and rejects a push containing a matching pattern before the objects ever reach GitHub
      (with an override for a confirmed false positive); it requires secret scanning on first,
      since it enforces the same detectors at push time instead of after the fact. Both are
      free for a public repository on any plan, which this one is (confirmed `visibility:
      public` in §0 above) — no plan upgrade gates either toggle.
      **Push protection is the one that matters more here.** The repo already runs two
      independent *post-commit* checks — the `secret-scan` gitleaks job in CI (every push) and
      now GitHub's own secret scanning — and both the 2026-08-21 full-history triage (42 hits,
      all false positives) and 2026-08-29 FINDING-029's allowlist-free re-scan (36 working-tree
      + 35 history hits across all 943 commits, every one a test fixture or a known-public
      identifier — see `.gitleaks.toml`) already found the tracked history clean, so a second
      *detector* adds little today — there is nothing left in history for one to find. What
      neither gitleaks-in-CI nor GitHub secret scanning can do is stop a leak from landing in
      the first place: both run only after a push has already succeeded, so the secret is
      already in the remote repository — and, the repo being public, potentially already
      fetched by a clone, a fork, or a crawler — even if the very next CI run flags it red;
      recovery from there is rotation, not deletion, because the object stays reachable in
      history and in anyone who already pulled. Push protection is the only one of the three
      layers that runs *before* the push completes, so it is the only one that can turn the
      next accidental commit into a rejected push instead of an incident that needs a rotation.
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
- [ ] og-worker (2026-08-29 FINDING-024, OG-4): **Security → WAF → Rate limiting rules** — add a
      rule scoped to `http.host eq "og.xivdyetools.app" and http.request.uri.path starts_with
      "/og/"`. (**Not** `xivdyetools.app/og/*` — that host/path combination is never routed to
      this worker; production image renders are served only from `og.xivdyetools.app/og/*`, per
      `wrangler.toml`'s `[env.production].routes`.) Start generous — e.g. 300 requests / 10 s
      from one IP — and start the action on **Log**, not Managed Challenge: Discord's and X's
      link-preview fetchers share source IPs (Sprint 7 ruling S7-R1) *and* cannot solve a
      challenge, so a challenge action is a block for exactly the clients this endpoint exists
      to serve, at exactly the moment a shared link goes viral. Read a week of the rule's own
      logs, then switch to **Block** at whatever threshold that week says is safely above the
      legitimate fleets. Mirror the rule on `og-beta.xivdyetools.app` only if beta is ever
      abused — it renders the same cards and is equally public, but carries no real traffic to
      calibrate against. Still wanted after Sprint 7's cache-key
      canonicalisation (OG-4): that bounds the *repeat* cost of one path, but does nothing for a
      client enumerating many distinct *valid* paths (dye IDs, harmony types, …), each a
      legitimate cache miss on first render — this WAF rule is the only bound on that count.
- [ ] og-worker (2026-08-29 FINDING-024, OG-4) **deploy-day expectation, not an action:** the
      `/og/*` cache key's shape changed (Sprint 7 — canonical decoded path × resolved lang ×
      resolved frame × raw algo, checked/filled for `GET` and `HEAD`), which orphans every entry
      already sitting in `caches.default` under the old full-URL key. Expect a one-time burst of
      cold-cache re-renders across live previews right after this deploys — normal, not a
      regression, as real traffic re-populates the cache under the new key shape. The orphaned
      entries need no manual purge; they are simply unreachable and age out on their own 7-day
      `s-maxage`. Useful side effect: this same reshuffle also flushes any card still cached from
      before the font-weight fix in this same release (pre-fix cards rendered every band name in
      Light 300 instead of its intended weight, `689a0679`), so that fix needs no separate purge
      either.
- [ ] og-worker (2026-08-29 FINDING-024, OG-4) **deploy-day expectation, not an action:** a
      share/preview URL that used to force a fresh card by appending a cache-buster (`?v=2`,
      `?t=<timestamp>`, …) to an `/og/*` image URL now gets a `404` — the query-key allowlist
      (ruling S7-R4) rejects any key outside `lang`/`frame`/`algo`. If a real card genuinely
      needs to be forced fresh before its TTL expires (e.g. a dye's colour data changed), a
      Cloudflare cache purge is the only remaining way — but **not** a targeted "Purge by URL"
      (ruling S7-R18): Cloudflare purge-by-URL matches the *cache key*, and `ogCacheKey`
      (`index.ts`) builds a synthetic one — the decoded path with `.png` stripped, plus
      `?lang=<resolved>&frame=<resolved>[&algo=<raw>]` in that fixed order — not the URL a
      human or crawler actually requested. Purging the natural-looking
      `https://og.xivdyetools.app/og/presets/default.png` matches **nothing**: the real key
      has no `.png` and carries `lang`/`frame` (and maybe `algo`) query params that URL
      doesn't. Constructing the exact key by hand doesn't scale either — 6 locales × 2 frames ×
      10 `algo` states is up to 120 distinct keys for **one** card, an order of magnitude past
      a Custom Purge's per-call URL limit. **Use Caching → Configuration → Purge Everything**
      for the zone instead — "Purge Everything" is always zone-wide on Cloudflare, so it also
      drops web-app's and api-worker's cached responses, not just og-worker's; that is an
      acceptable, if blunt, cost for an action expected to be rare. (If the zone ever gains a
      purge-by-hostname or purge-by-tag capability, scoping to `og.xivdyetools.app` would avoid
      that cost — check the dashboard's Caching → Configuration options before defaulting to
      Purge Everything.)
      `CACHE_PURGE_API_TOKEN` (purge-only, scoped to the `xivdyetools.app` zone, set
      2026-08-21; see the "Optional presets-api cache-purge credentials" entry above) already
      has the right permission for a `POST /zones/{zone_id}/purge_cache` call with `{"purge_everything":true}`
      if a dashboard action isn't convenient, but it is currently wired only into presets-api's
      own delete-preview-image flow (a targeted, correctly-keyed purge for R2 preview images,
      unrelated to this synthetic-key problem) — there is no automated purge path from
      og-worker itself.
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
| **v1 bot HMAC acceptance** (`verifyBotSignature`, `X-Request-Signature` fallback) — presets-api stopped accepting it in 2.2.0, discord-worker stopped sending it in 5.1.0 and moderation-worker in 1.6.0, so **no bot sends the v1 header any more** (2026-08-29 security audit FINDING-015) | ~~`apps/presets-api/src/middleware/auth.ts`~~; ~~`apps/discord-worker/src/services/preset-api.ts`~~; ~~`apps/moderation-worker/src/services/preset-api.ts`~~; ~~`verifyBotSignature` in `@xivdyetools/auth`~~ **DONE — Sprint 11, `@xivdyetools/auth` 2.0.0 (2026-08-31)**. (`createBotSignature` never existed in this package — a same-named, unrelated v1 test helper lived in the workspace-private `test-utils` package until this sprint's fix round removed it too, along with the v1-signature tests it backed; only `verifyBotSignature` was ever exported from `@xivdyetools/auth`, and only it was removed here.) | both bots' production deploys carry the v2-only client (tail shows only v2 verifications) — FINDING-014/015 |
| **KV rate-limiter fallbacks** (`selectApiRateLimiter` KV branch, oauth `kv` backend, discord-worker / moderation-worker KV paths, the `RATE_LIMIT_KV` namespaces) | api-worker `middleware/rate-limit.ts`, oauth `services/rate-limit.ts`, discord-worker `services/rate-limiter.ts`, moderation-worker `middleware/rate-limit.ts`, wrangler KV bindings | one week of production logs with no fallback warning — FINDING-003/005 |
| **Legacy itemID preset fallback** (`resolvePresetDye` legacy path) | presets-api | stainID D1 rewrite applied + backfill verified |
| **Dead notification path + env vars** `notifyModerators`, `MODERATION_WEBHOOK_URL`, `OWNER_DISCORD_ID`, `DISCORD_BOT_TOKEN`, `DISCORD_BOT_WEBHOOK_URL` | presets-api `services/moderation-service.ts`, `Env`, docs/env-var table (PAPI-16) | none — dead today; remove in the first cleanup PR (unless the 2026-08-21 presets-api remediation already did — check its CHANGELOG) |
| **Orphan production secrets** (set on the worker, no code reference as of 2026-08-21): discord-worker `PRESET_API_SECRET`, `PERSPECTIVE_API_KEY`; presets-api `MODERATOR_CHANNEL_ID` (+ the four PAPI-16 vars above once their code goes) | `wrangler secret delete <NAME> --env production` from the app dir | the §1 tail is clean for a day (proves nothing deployed still reads them) |
| **oauth `[env.preview]`** bound to production D1/KV with a dead redirect | `apps/oauth/wrangler.toml` | none — delete if the 2026-08-21 oauth remediation (FINDING-029) kept it |
| `LocalStorageCacheBackend` | web-app (`DEPRECATIONS.md`) | confirm no active path |
| ~~`scripts/cleanup-v4-kv.ts`~~ | repo | **removed 2026-08-29** after its one production run (2 orphaned keys deleted; `budget:world:v1:*` deliberately kept — DEAD-010) |
| `/api/v2/*` compat mount of the absorbed universalis proxy | api-worker | after the proxy-domain cutover window (`DEPRECATIONS.md`) |
| `LEGACY_FACEWEAR_ITEM_IDS` | `@xivdyetools/core` | **do not remove** — frozen compatibility map by design |

Also 5.1 work, not removal: discord-worker `/preset submit` / `/preset edit` still send legacy
itemIDs (deferred; recorded under discord-worker 5.0.0 "Known issues"); the web-app submission
form does not yet mirror presets-api's new tag charset / control-character rules (users see the
API's 400 message — FINDING-019/028); ~~`moderation_log` rows for ban / unban / hide / restore need a
presets-api-owned decision~~ **DONE — FINDING-018, moderation-worker 1.6.0 + migration 0013** (the rows
are written by moderation-worker itself, in the same batch as the ban; `preset_id` is nullable and
`target_discord_id` was added); cross-identity (`xivauth_id`) bans need oauth + moderation changes
(FINDING-017).

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
