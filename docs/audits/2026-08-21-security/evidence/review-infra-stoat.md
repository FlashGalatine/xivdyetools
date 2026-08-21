# Review: CI / infra / config layer + `apps/stoat-worker`

- **Audit:** 2026-08-21 security audit (see `../AUDIT_MANIFEST.md`)
- **Branch / commit:** `monorepo-2.0-prep` @ `08a8f522`
- **Reviewer:** read-only sub-review (infra + stoat). No source file was modified; the only file created is this report. One read-only probe was executed (`tsx` against `parser.ts`, see STOAT-3) and three DNS lookups were made (`nslookup` against 1.1.1.1, see STOAT-7 / INF-6); no HTTP request was sent to any production host.
- **Scope (A):** `apps/stoat-worker` — all non-test `src/`, `package.json`, `.env.example`, `.gitignore`, `README.md`, `CLAUDE.md`, `tsconfig.json`, `vitest.config.ts`, lockfile resolution of `revolt.js → solid-js → seroval`.
- **Scope (B):** 13 workflows, root monorepo config, `.gitignore`/`.gitattributes`/`.npmrc`, Dependabot, every `apps/*/wrangler.toml`, env examples, web-app `_headers`/`_redirects`/`functions/_middleware.ts`/`vite.config.ts`/CI scripts, `docs/.secrets.baseline`, `docs/.pre-commit-config.yaml`, `docs/operations/SECRET_ROTATION.md`, `docs/operations/DEPLOY_ENVIRONMENTS.md`, `.vscode`, `.superpowers`, `scripts/coverage-report.ts`.

Severity scale: CRITICAL / HIGH / MEDIUM / LOW / INFO. Confidence: CONFIRMED (observed at the cited lines / by probe) vs PLAUSIBLE (depends on a setting outside the repo or on an attacker precondition).

---

## Headline

No CRITICAL or HIGH finding in either scope. The CI layer is in good shape on supply chain (frozen lockfile everywhere, `minimumReleaseAge`, no install scripts, security-floor overrides honoured by the lockfile, nightly `pnpm audit`, OIDC provenance publishing, no `pull_request_target`, no `set -x`, no secrets written to disk). The weaknesses are the classic GitHub Actions hardening gaps (no `permissions:` blocks, major-tag action pins, no deployment environments so production is reachable from any ref via `workflow_dispatch`), a stale and now *wrong* secret-rotation runbook (`wrangler secret put` without `--env production` now targets the dev worker on three services), a dormant `oauth` preview environment bound to production data, and one unredacted (reportedly rotated) client secret in a committed audit doc. `stoat-worker` is a parked ~1.3 kLOC bot with a clean token-handling story; its issues are robustness-grade except for a dangling `xivdyetools.com` link that also appears in two *deployed* workers.

---

## (B) Infra / CI / config findings

### INF-1 — No `permissions:` block on 12 of 13 workflows (GITHUB_TOKEN runs at repository default)

- **Severity:** MEDIUM — every deploy job's token inherits the repository/org default; if that default is the legacy "read and write", a compromised third-party action or dependency in any deploy job can push commits, create releases, or write packages. Impact is PLAUSIBLE because the default is a repo setting not visible here.
- **CWE:** CWE-250 (Execution with Unnecessary Privileges), CWE-269.
- **Where:** Whole files — `.github/workflows/ci.yml`, `deploy-api-worker.yml`, `deploy-discord-worker.yml`, `deploy-discord-worker-beta.yml`, `deploy-image-worker.yml`, `deploy-moderation-worker.yml`, `deploy-oauth.yml`, `deploy-og-worker.yml`, `deploy-og-worker-beta.yml`, `deploy-presets-api.yml`, `deploy-web-app.yml`, `deploy-web-app-beta.yml`; and the `detect` job in `publish-packages.yml:21-84`. Only `publish-packages.yml:91-93` declares `permissions: contents: read / id-token: write` (publish job).
- **Excerpt:** `grep -rn "permissions:" .github/workflows` → one hit (`publish-packages.yml:91`).
- **Risk:** A tag-move on `pnpm/action-setup@v5` or `cloudflare/wrangler-action@v4` (see INF-2) runs inside a job whose `GITHUB_TOKEN` may be write-capable, and `actions/checkout@v7` persists that token into `.git/config` by default (`persist-credentials: true`), so any later step can read it.
- **Fix:** Add a top-level `permissions: contents: read` to every workflow (and `permissions: {}` is fine for the `detect` job); keep `id-token: write` only on the publish job. Set `persist-credentials: false` on every `actions/checkout` (no step pushes). Also confirm Settings → Actions → Workflow permissions is "Read repository contents".
- **Confidence:** CONFIRMED absent; impact PLAUSIBLE (depends on repo default).

### INF-2 — All actions pinned to major-version tags, not commit SHAs

- **Severity:** MEDIUM — four third-party actions run in jobs holding `CLOUDFLARE_API_TOKEN` (account-wide deploy), `DISCORD_TOKEN`, `BETA_DISCORD_TOKEN`; a compromised/moved tag exfiltrates them. Mitigated by Dependabot covering `github-actions` monthly.
- **CWE:** CWE-829 (Inclusion of Functionality from Untrusted Control Sphere), CWE-1357.
- **Where / inventory (all `uses:` lines):**
  - `actions/checkout@v7` — `ci.yml:51,75`; `deploy-api-worker.yml:26`; `deploy-discord-worker.yml:33`; `deploy-discord-worker-beta.yml:48`; `deploy-image-worker.yml:21`; `deploy-moderation-worker.yml:28`; `deploy-oauth.yml:24`; `deploy-og-worker.yml:24`; `deploy-og-worker-beta.yml:45`; `deploy-presets-api.yml:24`; `deploy-web-app.yml:23`; `deploy-web-app-beta.yml:45`; `publish-packages.yml:28,95`.
  - `actions/setup-node@v7` — `ci.yml:55,81`; `deploy-api-worker.yml:30`; `deploy-discord-worker.yml:37`; `deploy-discord-worker-beta.yml:52`; `deploy-image-worker.yml:25`; `deploy-moderation-worker.yml:32`; `deploy-oauth.yml:28`; `deploy-og-worker.yml:28`; `deploy-og-worker-beta.yml:49`; `deploy-presets-api.yml:28`; `deploy-web-app.yml:27`; `deploy-web-app-beta.yml:49`; `publish-packages.yml:30,107`.
  - `pnpm/action-setup@v5` — `ci.yml:53,79`; `deploy-api-worker.yml:28`; `deploy-discord-worker.yml:35`; `deploy-discord-worker-beta.yml:50`; `deploy-image-worker.yml:23`; `deploy-moderation-worker.yml:30`; `deploy-oauth.yml:26`; `deploy-og-worker.yml:26`; `deploy-og-worker-beta.yml:47`; `deploy-presets-api.yml:26`; `deploy-web-app.yml:25`; `deploy-web-app-beta.yml:47`; `publish-packages.yml:97`.
  - `cloudflare/wrangler-action@v4` — `deploy-api-worker.yml:52`; `deploy-discord-worker.yml:54`; `deploy-discord-worker-beta.yml:70`; `deploy-image-worker.yml:42`; `deploy-moderation-worker.yml:49`; `deploy-oauth.yml:45`; `deploy-og-worker.yml:47`; `deploy-og-worker-beta.yml:67`; `deploy-presets-api.yml:45`; `deploy-web-app.yml:52`; `deploy-web-app-beta.yml:82`.
- **Dependabot:** `.github/dependabot.yml:29-36` does cover `package-ecosystem: github-actions` (monthly) — positive. Lines 37-42 ignore `pnpm/action-setup` semver-major with a rationale ("pnpm v11 RC cannot parse v10 lockfiles") that is now stale: `package.json:28` is `pnpm@11.17.0` and the lockfile is v9 format. Re-enable.
- **Fix:** Pin to full SHAs with a `# vX.Y.Z` comment (Dependabot keeps SHA pins updated). Priority order: `wrangler-action`, `pnpm/action-setup`, then the GitHub-owned two.
- **Confidence:** CONFIRMED.

### INF-3 — Production deploys and npm publishes are reachable from ANY ref via `workflow_dispatch` (no environment protection)

- **Severity:** LOW — requires write access to the repo (collaborator or compromised account; forks cannot dispatch). Documented and used on purpose (`docs/operations/DEPLOY_ENVIRONMENTS.md:369-371`: "allowlist changes can be released from a feature branch without merging"). No `environment:` key exists anywhere (`grep -rn "environment:" .github/workflows` → none), so there are no required reviewers, wait timers, or deployment-branch policies.
- **CWE:** CWE-284 / CWE-862.
- **Where:** `workflow_dispatch:` on every deploy workflow — `deploy-api-worker.yml:15`, `deploy-discord-worker.yml:22`, `deploy-image-worker.yml:10`, `deploy-moderation-worker.yml:17`, `deploy-oauth.yml:13`, `deploy-og-worker.yml:15`, `deploy-presets-api.yml:13`, `deploy-web-app.yml:12`; `publish-packages.yml:4` (+ `--no-git-checks` at line 146, which is what lets pnpm publish from a non-main branch).
- **Push path (answering the brief):** push-triggered production deploys are `branches: [main, master]` only; beta workflows use `branches-ignore: [main, master, dependabot/**]` (`deploy-discord-worker-beta.yml:15-19`, `deploy-og-worker-beta.yml:20-24`, `deploy-web-app-beta.yml:21-25`) and run bare `deploy` / a separate Pages project, which cannot reach production (`wrangler.toml` split verified below). **So a branch *push* cannot deploy production; a branch *dispatch* can.** Push events fire only for pushes to this repo (collaborators), never from forks.
- **Fix:** Add `environment: production` (required reviewer = maintainer, deployment branches = `main`) to each production deploy job and `environment: npm` to the publish job; or at minimum `if: github.event_name != 'workflow_dispatch' || github.ref == 'refs/heads/main'` on the deploy step. Note npm trusted-publisher config can also be bound to a GitHub environment name.
- **Confidence:** CONFIRMED.

### INF-4 — `SECRET_ROTATION.md` is stale, incomplete, and its commands now target the wrong worker

- **Severity:** MEDIUM — during an incident the runbook would be followed verbatim: `wrangler secret put BOT_API_SECRET` from `apps/discord-worker`, `apps/moderation-worker`, `apps/presets-api` now sets the secret on the **dev/beta** worker (top-level env) and leaves the compromised production secret live, while the verification checklist passes against beta. Inventory omits >12 secrets.
- **CWE:** CWE-1059 (Insufficient Technical Documentation) — process finding.
- **Where:** `docs/operations/SECRET_ROTATION.md` — `:4` "Last Updated: December 15, 2025", `:295` "Next Review: March 15, 2026" (overdue); `:58-70,102-121,151-156,172-177,201-206` every `wrangler secret put` lacks `--env production` and uses pre-monorepo paths (`cd xivdyetools-oauth`, `cd xivdyetools-presets-api`); `:79` tests against the retired `xivdyetools.projectgalatine.com`; `:228` deprecated `wrangler kv:key list` syntax; `:17-28` inventory.
- **Evidence the commands are wrong now:** `apps/discord-worker/wrangler.toml:12` `name = "xivdyetools-discord-worker-dev"` (top-level), `:61-62` `[env.production] name = "xivdyetools-discord-worker"`; same shape in `apps/moderation-worker/wrangler.toml:11/41` and `apps/presets-api/wrangler.toml:12/45`. Only `oauth` (top-level = production, `apps/oauth/wrangler.toml:1`) still matches the runbook.
- **Missing from the inventory** (names read from `env.X` in `apps/*/src`, non-test; none appear in any `[vars]`): `BOT_SIGNING_SECRET` (discord-worker, moderation-worker, presets-api), `INTERNAL_WEBHOOK_SECRET` (discord-worker, presets-api), `GITHUB_WEBHOOK_SECRET` (discord-worker `src/index.ts:406,438`), `XIVAUTH_CLIENT_SECRET` (oauth `src/handlers/xivauth.ts:118-119`), `PERSPECTIVE_API_KEY`, `DISCORD_BOT_TOKEN`, `MODERATION_WEBHOOK_URL`, `OWNER_DISCORD_ID` (presets-api), `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (discord-worker), `SUBMISSION_LOG_CHANNEL_ID` (discord-worker, moderation-worker), `STATS_AUTHORIZED_USERS` (discord-worker), `BOT_TOKEN` (stoat-worker), and the GitHub Actions secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `DISCORD_TOKEN`, `BETA_DISCORD_TOKEN`, `BETA_DISCORD_GUILD_ID`. Also unaddressed: the beta discord worker has its own `DISCORD_TOKEN`/`DISCORD_PUBLIC_KEY` secret set (`DEPLOY_ENVIRONMENTS.md:228-233`). See the Secrets Inventory table below.
- **Fix:** Rewrite the runbook against the monorepo: per-worker table of secret → `pnpm --filter <pkg> exec wrangler secret put NAME --env production` (and the dev/beta counterpart), add the missing secrets, add the GitHub Actions secrets and the CF API token (rotate via dashboard + update repo secret), fix the domain, and set a real review date.
- **Confidence:** CONFIRMED.

### INF-5 — Unredacted (reportedly rotated) XIVAuth client secret committed in an audit document

- **Severity:** LOW — the doc records the secret as rotated on 2026-01-25 (`FINDING-003…:64-66`), so the value should be dead; but the two sibling findings redacted their values and this one did not, and the value also sits in git history (`evidence/git-history-secrets.txt` line `699507`). If the rotation did not actually happen, this is HIGH.
- **CWE:** CWE-312 / CWE-540.
- **Where:** `docs/audits/2026-01-25/findings/FINDING-003-exposed-xivauth-secret.md:20` — `XIVAUTH_CLIENT_SECRET=H8WXCdiSdvxnspEcxk59VEhIaB43nrxpOCszndWgNnM`.
- **Fix:** Redact in place (`H8WX****REDACTED****`), confirm in the XIVAuth developer portal that the current secret differs, and decide whether a history rewrite is worth it (the project is public-source). Add this value to the secret-scanning ignore list only after redaction.
- **Confidence:** CONFIRMED present; rotation status per the document only.

### INF-6 — `oauth` `[env.preview]` binds PRODUCTION D1 + KV and redirects to a stale Pages preview alias (dormant)

- **Severity:** LOW — `auth-preview.xivdyetools.app` is NXDOMAIN at 1.1.1.1 today, so no worker currently answers there; the risk is latent: one `wrangler deploy --env preview` (documented as a supported command in `apps/oauth/README.md:74`) stands up a second token issuer on production user data whose allowed redirect list includes a dead preview URL.
- **CWE:** CWE-1188 (Insecure Default Initialization of Resource) / configuration drift.
- **Where:** `apps/oauth/wrangler.toml:27-47` — `:36` `FRONTEND_URL = "https://v4-ui-migration.xiv-colorexplorer.pages.dev"`; `:40-42` preview `TOKEN_BLACKLIST` id `0d6f3be3b4704e91a83e6387b9769e45` == production (`:49-51`); `:44-47` preview `DB` id `6e97b759-70dd-49a8-a93c-0541c7fe6c67` == production (`:58-61`). `apps/oauth/src/constants/oauth.ts:30-38` appends `env.FRONTEND_URL` to the redirect allowlist; `src/handlers/oauth-flow.ts:47,101` redirect to `${FRONTEND_URL}/auth/callback`.
- **Is it an open attack surface?** Not today (no DNS record, so not deployed). If deployed: the pages.dev hostname is the *production* Pages project's subdomain (the workflow comment at `deploy-web-app.yml:65-68` confirms `xiv-colorexplorer.pages.dev` is still this project), so the branch alias stays under the owner's control while the project exists — the redirect is dead, not hijackable, unless the Pages project is ever deleted and the name re-registered. Tokens it would mint carry `iss = auth-preview…` (`WORKER_URL`, `:37`) against the production D1.
- **Also:** `apps/oauth/wrangler.toml:68` `database_id = "TODO_RUN_WRANGLER_D1_CREATE"` for `[env.development]` (remote dev against that env fails loudly — INFO). And the oauth top-level env *is* production (`:1-9`, bare `deploy` in `deploy-oauth.yml:50`), the documented exception to the monorepo convention.
- **Fix:** Delete `[env.preview]` (it has no workflow and no live DNS), or repoint `FRONTEND_URL` to `https://beta.xivdyetools.app` and give it its own D1/KV. Fill or remove the dev D1 placeholder. Longer term bring `oauth` onto the BUG-008 pattern (top-level = dev) with a coordinated CI change.
- **Confidence:** CONFIRMED config; DNS absence CONFIRMED at review time.

### INF-7 — `.gitignore` does not cover wrangler's per-environment `.dev.vars.<env>` files

- **Severity:** LOW — wrangler reads `.dev.vars.production` / `.dev.vars.preview` etc.; these are committable today.
- **CWE:** CWE-538.
- **Where:** `.gitignore:10` (`.dev.vars` only). Verified: `git check-ignore -v apps/oauth/.dev.vars.preview apps/discord-worker/.dev.vars.production` → no match (whereas `apps/discord-worker/.dev.vars` and `apps/web-app/.env.development` are ignored via `:10` and `:26`).
- **Fix:** Change line 10 to `.dev.vars` + `.dev.vars.*` (and add `!.dev.vars.example` if you ever ship one — none exists today; the workers document their secrets only in `wrangler.toml` comments).
- **Confidence:** CONFIRMED.

### INF-8 — Secret-scanning pre-commit config is not wired (lives under `docs/`, empty baseline, no CI scanner)

- **Severity:** LOW — nothing in the repo scans commits for secrets; the only possible control is GitHub's own secret scanning (not visible here). INF-5 is the kind of thing it would have caught.
- **CWE:** CWE-1059 / process.
- **Where:** `docs/.pre-commit-config.yaml:1-38` (pre-commit only reads `<repo-root>/.pre-commit-config.yaml`; there is none: `ls .pre-commit-config.yaml` → missing, no `.husky/`); `docs/.secrets.baseline:41-42` `"results": {}` generated `2026-01-26` (tool: Yelp detect-secrets 1.5.0, plugin list `:3-26`) — all entries are empty, i.e. no allow-listed fixtures and no real secrets listed; `git grep detect-secrets` finds only CHANGELOG prose ("Added pre-commit hooks…") from the pre-monorepo repos.
- **Fix:** Either move both files to the repo root and document `pre-commit install`, or (better for a solo project) add a `gitleaks/gitleaks-action` (SHA-pinned) step to `ci.yml` with `contents: read`. Regenerate the baseline after redacting INF-5.
- **Confidence:** CONFIRMED.

### INF-9 — CSP `connect-src https://*.workers.dev` is a broad wildcard no production code needs

- **Severity:** LOW — an XSS (none known) could exfiltrate via fetch to `attacker.workers.dev`; CSP's exfil containment is weakened for the whole site. No runtime code points at a `workers.dev` host (`grep -rn "workers.dev" apps/web-app/src` → none; production bases are `data.`/`auth.`/`api.xivdyetools.app` in `services/api-service-wrapper.ts:49-53`, `services/auth-service.ts:55,60`, `services/chara-resolve-service.ts:79-83`).
- **CWE:** CWE-1021 / CWE-16 (weak CSP).
- **Where:** `apps/web-app/public/_headers:17`.
- **Other CSP / header notes (INFO, same file):** `style-src 'unsafe-inline'` is documented/accepted (`:9`); `object-src` not set (falls back to `default-src 'self'` — prefer explicit `object-src 'none'`); no `report-to`; `X-XSS-Protection: 1; mode=block` (`:22`) is deprecated — set `0` or drop it; `Permissions-Policy` (`:24`) only lists geolocation/microphone/camera — consider `payment=(), usb=(), interest-cohort=()`; HSTS `max-age=31536000; includeSubDomains; preload` (`:27`) is fine and applies to all `*.xivdyetools.app` workers (all CF-proxied) — just be aware `preload` is effectively irreversible once submitted. `_redirects:3` is the SPA catch-all only (`/* /index.html 200`) — no external splats, no open redirect. `functions/_middleware.ts:13-19` is a host-based 301 that preserves path/query to `xivdyetools.app` — fine. `_headers` is shared by the beta project (same `public/`), and the beta build appends `X-Robots-Tag: noindex, nofollow` at build time (`src/shared/beta-branding.ts:44-52`), guarded by `scripts/check-beta-build.js:43,46` and asserted live by `scripts/smoke-test-pages.js:185-201` — positive.
- **Fix:** Remove `https://*.workers.dev` from `connect-src` (re-add a specific host only if a `-dev` worker is ever used from a beta build); add `object-src 'none'`; replace `X-XSS-Protection` with `0`.
- **Confidence:** CONFIRMED.

### INF-10 — Job-level `env:` exposes `BETA_DISCORD_TOKEN` to every step of the beta deploy job

- **Severity:** LOW — the beta bot token is visible (as an env var) to `pnpm install`, turbo build/test and the third-party `wrangler-action` step, not just the register step. Production `DISCORD_TOKEN` is correctly step-scoped.
- **CWE:** CWE-200 (scope widening).
- **Where:** `deploy-discord-worker-beta.yml:41-46` (job `env:` with both beta secrets) vs `deploy-discord-worker.yml:62-67` (step-scoped). The comment explains why (the `if:` at `:84,93` cannot read `secrets.*`).
- **Fix:** Keep the gate but feed it a non-secret flag: e.g. a repository *variable* `BETA_REGISTER_ENABLED=true` checked with `vars.*` in `if:`, and move `BETA_DISCORD_TOKEN` to the register step's `env:` only. (Or accept; the blast radius is the beta bot.)
- **Confidence:** CONFIRMED.

### INF-11 — `${{ steps.deploy.outputs.deployment-url }}` is interpolated into a shell `run:`

- **Severity:** INFO — the value comes from `cloudflare/wrangler-action` (Cloudflare's API response), a trusted source, and is double-quoted; but double quotes do not stop `$(...)`/backtick expansion after `${{ }}` substitution, so this is still template-into-shell. `inputs.package` (`publish-packages.yml:38-41`) is a `choice` input — GitHub validates choice values for both UI and REST dispatch, so it is constrained enough. `needs.detect.outputs.packages` (`:116,126,142`) is built only from the hard-coded `TIER_ORDER` names (the `npm view` result is echoed, never placed in the output), so it is not attacker-influenced.
- **CWE:** CWE-78 (pattern), no exploitable source today.
- **Where:** `deploy-web-app.yml:75-79` (line 77), `deploy-web-app-beta.yml:100-104` (line 102).
- **Fix:** Pass via `env: DEPLOYMENT_URL: ${{ steps.deploy.outputs.deployment-url }}` and use `"$DEPLOYMENT_URL"`. Same pattern for `PACKAGES` in `publish-packages.yml`.
- **Confidence:** CONFIRMED pattern; no live source.

### INF-12 — `workers_dev` exposure on dev/beta workers

- **Severity:** INFO.
- **Where:** `apps/discord-worker/wrangler.toml:16` `workers_dev = true` (needed: Discord Interactions endpoint for the beta app; requests are Ed25519-verified, so the public hostname is acceptable); `apps/og-worker/wrangler.toml:21` `workers_dev = true` on the beta OG worker, which already has custom routes + `og-beta.xivdyetools.app` (`:22-35`) — the extra `*.workers.dev` hostname adds a second unauthenticated render endpoint for no capability; `apps/api-worker/wrangler.toml:6-17` sets no `workers_dev` key at all, and wrangler's default is `true`, so `xivdyetools-api-worker-dev.<sub>.workers.dev` is public whenever that env is deployed (it has its own KV `:15-17` — isolated, and its own rate-limit vars — fine). `image-worker` (`:15,21`), `moderation-worker` (`:17`), `presets-api` (`:16`) explicitly `false` — good.
- **Fix:** Set `workers_dev = false` on og-worker's top level and explicitly on api-worker's top level (or `true` with intent, documented).
- **Confidence:** CONFIRMED.

### INF-13 — Dev/beta environments bound to production resources (documented, accepted)

- **Severity:** INFO — recorded so the coordinator sees the shared-data map; all are documented as deliberate in `DEPLOY_ENVIRONMENTS.md` (`:19-21,183-197,351-355`).
- **Where:** `apps/discord-worker/wrangler.toml:29-39` beta binds production `xivdyetools-presets-api`, `xivdyetools-api-worker`, `xivdyetools-image-worker` (KV `:21-23` and analytics `:25-27` are isolated — good). `apps/moderation-worker/wrangler.toml:19-30` dev env binds production KV `1fcb7e037ccd4172a47fccd97cf8e753` (which is also `discord-worker`'s **production** KV, `apps/discord-worker/wrangler.toml:78` — shared between the two bots in both envs) and production D1 `e17d68a1…`. `apps/presets-api/wrangler.toml:22-37` dev env binds production D1, production R2 bucket and the production discord-worker service (reachable only via service binding; `workers_dev = false`, no routes — harmless unless flipped). Beta web app uses production `auth.`/`api.` (`DEPLOY_ENVIRONMENTS.md:351`).
- **Risk:** a feature-branch push deploys beta bots/site that can write real rows (`/preset submit`) — accepted residual risk per the doc.
- **Fix:** None required now; the right end state (isolated staging D1 + presets-api) is already listed as out of scope in the doc.
- **Confidence:** CONFIRMED.

### INF-14 — `[vars]` contents and misc wrangler hygiene

- **Severity:** INFO.
- `[vars]` contain only public identifiers: Discord application IDs, `XIVAUTH_CLIENT_ID = "phx-sXZeb_Ran6GAdcnsnjvdtOeNM4df0BZyF3Jyti0"` (an OAuth *client id*, sent in the authorize URL — `apps/oauth/src/handlers/xivauth.ts:45,110`; public by design), URLs, channel IDs. No secret-looking value in any `[vars]` — positive. Secrets are documented as comments (`apps/discord-worker/wrangler.toml:48-51`, `moderation-worker:36-38`, `presets-api:69-72`, `oauth:70`); note `presets-api`'s comment lists `DISCORD_BOT_WEBHOOK_URL`, which appears only in `src/types.ts:77` and nowhere in logic (dead name).
- No `[observability]` block and no `compatibility_flags` in any `wrangler.toml`; `compatibility_date = "2024-12-01"` everywhere (no `nodejs_compat`, which is consistent with the ARCH-001 notes). `account_id` absent everywhere (CI supplies it) — fine.
- **Confidence:** CONFIRMED.

### INF-15 — `vite.config.ts`: source maps shipped to production; no secret exposure

- **Severity:** INFO — `build.sourcemap: true` (`apps/web-app/vite.config.ts:26`) publishes `.map` files; the code is MIT/open source so this is a size/IP nit, not a leak. `define` (`:12-19`) exposes only `__APP_VERSION__` and `__BUILD_DATE__`; `__APP_ENV__` is injected by `vite-plugin-beta-branding.ts:29-35`. `base: '/'` (`:21`). `server.open: true` / default `server.fs` (`:53-57`) are dev-only. The only `VITE_*` vars read are URL overrides (`src/vite-env.d.ts:8-12`; `.env.development:5` localhost only, and that file is gitignored/untracked).
- **Confidence:** CONFIRMED.

### INF-16 — Minor CI hygiene

- **Severity:** INFO.
- No `timeout-minutes` on any job (smoke tests have bounded retries: `smoke-test-pages.js:85-93` ≈ 3 min; the og-beta loop `deploy-og-worker-beta.yml:81` ≈ 2 min) — add `timeout-minutes: 30` to avoid runaway minutes.
- `actions/checkout` default `persist-credentials: true` on every checkout (see INF-1).
- `ci.yml` has no secrets and `pull_request` from forks gets a read-only token — safe. `deploy-*` workflows do not run on `pull_request` — good.
- Dependabot `reviewers:` (`dependabot.yml:25-26,35-36`) is a deprecated key; prefer CODEOWNERS. No `SECURITY.md` / `CODEOWNERS` exist.
- `.vscode/settings.json` / `extensions.json` — no tokens. `.superpowers/` is untracked and self-ignored (`.superpowers/sdd/.gitignore` = `*`). `scripts/coverage-report.ts` reads `coverage-summary.json` only; no exec, no network.
- `docs/audits/security/evidence/potential-secrets.txt` (584 lines) is a noisy grep over `node_modules`; it contains no live secret (checked for `=` + 16-char literals: none).
- **Confidence:** CONFIRMED.

---

## (A) `apps/stoat-worker` findings

### STOAT-1 — Dangling link targets: `xivdyetools.com` / `docs.xivdyetools.com` do not resolve

- **Severity:** LOW for stoat (parked, not deployed) — but see the cross-unit note: the same hostnames are emitted by **deployed** workers. A domain that is NXDOMAIN at the resolver is very likely unregistered; anyone who registers it receives clicks from bot-posted links ("Web App" / "Docs") under the project's name — a phishing primitive. Production domains are `xivdyetools.app` / `developers.xivdyetools.app`.
- **CWE:** CWE-610 (Externally Controlled Reference) / dangling resource.
- **Where:** `apps/stoat-worker/src/commands/about.ts:26` — `'[Web App](https://xivdyetools.com) • [Docs](https://docs.xivdyetools.com)'`.
- **Evidence:** `nslookup xivdyetools.com 1.1.1.1` → "Non-existent domain"; `nslookup -type=NS xivdyetools.com 1.1.1.1` → NXDOMAIN; `docs.xivdyetools.com` → NXDOMAIN (local resolver too).
- **Cross-unit (outside this review's scope, flagged for the coordinator):** `apps/discord-worker/src/handlers/commands/stats.ts:175-176` (`/stats` links to both hosts — production bot), `apps/moderation-worker/src/handlers/commands/preset.ts:34` `PRESETS_WEB_URL = 'https://xivdyetools.com'` (share URLs in moderator replies). Those two are MEDIUM in a deployed worker.
- **Fix:** Replace with `https://xivdyetools.app` / `https://developers.xivdyetools.app` everywhere (`git grep xivdyetools\.com`); or register `xivdyetools.com` defensively and redirect it.
- **Confidence:** CONFIRMED (NXDOMAIN at two resolvers); "unregistered" PLAUSIBLE — verify WHOIS.

### STOAT-2 — No rate limiting / abuse control; one command can emit up to four bot messages

- **Severity:** LOW — parked bot, but it is a persistent Node process: a user in any shared channel can spam `!xd info <substring>` and get 1–4 replies each (substring matches 2–4 dyes → `kind: 'multiple'` → one `executeDyeInfo` + one `sendMessage` per dye). The Upstash config is read (`config.ts:49-50`) but never used; nothing throttles per user/channel. Work per call is small (ΔE2000 over 125 dyes + SVG string build; SVG is discarded — `info.ts:98-103`), so this is message amplification more than CPU.
- **CWE:** CWE-770 / CWE-400.
- **Where:** `src/services/dye-resolver.ts:23` (`MULTI_MATCH_THRESHOLD = 4`), `:115-117`; `src/commands/info.ts:70-78` (loop sending one message per match); no limiter anywhere in `src/`.
- **Fix:** Before un-parking: per-user token bucket (in-memory is fine for one process), collapse the `multiple` case into a single message, ignore messages from other bots (`message.author?.bot` — `src/index.ts:48-50` only skips its own ID), and optionally require a server/channel allowlist.
- **Confidence:** CONFIRMED.

### STOAT-3 — Prototype-key lookups on user-controlled tokens (`constructor`, `__proto__`)

- **Severity:** LOW — robustness, not RCE. Three plain-object tables are indexed with user-supplied lowercase tokens and truthiness-checked; inherited `Object.prototype` members satisfy the check.
- **CWE:** CWE-1321 (adjacent: improperly controlled property lookup), CWE-20.
- **Where:** `src/commands/parser.ts:57-62,99-107` (`SHORT_ALIASES[firstToken]`), `src/router.ts:54-58` (`COMMAND_ROUTES[routeKey]`), `src/commands/help.ts:36,98-106` (`COMMAND_HELP[topic]`).
- **Probe (read-only, `tsx` importing `parser.ts`):** `"!xd constructor"` → `{"prefix":"!xd","rawArgs":[]}` (command/subcommand `undefined` because `SHORT_ALIASES['constructor']` is the `Object` function); `"!xd __proto__ foo"` → same shape with `rawArgs:["foo"]`; `"!xd help constructor"` → `{command:"help", rawArgs:["constructor"]}` → `COMMAND_HELP['constructor']` is a Function → it is sent as `content` → the Stoat API rejects the body → the generic error path runs. Router: `ROUTES['constructor'|'__proto__'|'toString'|'hasOwnProperty'|'valueOf']` are all truthy (function/object) — reachable only if the parser does not alias them first; `toString`/`valueOf`/`hasOwnProperty` are neutralised by the `.toLowerCase()` at `parser.ts:96` (`tostring` etc. are not prototype keys), `constructor`/`__proto__` are caught by the alias table and produce `Unknown command \`undefined\``.
- **Fix:** Use `Object.hasOwn(table, key)` (or `Map`s / `Object.create(null)`) at all three sites.
- **Confidence:** CONFIRMED (parser by probe; help/router by code reading).

### STOAT-4 — User input reflected verbatim in bot-authored messages

- **Severity:** LOW — the bot can be made to post attacker-chosen text (markdown, links, `<@ULID>` mentions) under its own identity: `No dye found matching "${query}"`, `Found N dyes matching "${query}"`, and `Unknown command \`${routeKey}\``. Bounded by Revolt's message length (an oversize echo fails the send and falls back to the generic error). Not a code-execution issue; a social-engineering/spam primitive.
- **CWE:** CWE-116 / CWE-79 (content injection in chat context).
- **Where:** `src/services/response-formatter.ts:79,100` (query echo), `src/router.ts:63` (routeKey echo). `rawArgs` are also logged at debug (`src/index.ts:58-62`) — fine.
- **Fix:** Truncate and strip markdown/mention syntax from echoed input (or wrap in a code span and cap at ~64 chars); never echo the unknown command verbatim.
- **Confidence:** CONFIRMED.

### STOAT-5 — Token handling, sinks, dependencies: verified clean (INFO)

- **Token loading:** `BOT_TOKEN` is read from `process.env` only, with no default/fallback and a hard throw when absent (`src/config.ts:29-32`); passed straight to `client.loginBot()` (`src/index.ts:103`). It is never logged — the `ready` handler logs the bot username and the admin ULID list only (`src/index.ts:38-43`); the fatal path logs `error.message` (`:106-111`). `@xivdyetools/logger` additionally redacts `token`/`secret`/`authorization`… fields (`packages/logger/src/constants.ts:14-24`). `.env` / `.env.local` are gitignored (`apps/stoat-worker/.gitignore:7-8` and root `.gitignore:25-27`); `.env.example:5-12` ships empty values. `STATS_AUTHORIZED_USERS` is validated as Crockford-Base32 ULIDs at startup (`config.ts:16,39-44`). Upstash URL/token are read but unused.
- **Command input handling:** prefix parse is `split(/\s+/)` + table lookups (`parser.ts:95-126`); no regex is built from input anywhere in stoat, bot-logic or core (`grep "new RegExp"` → none). Resolution is substring/equality search over the 125-dye table plus `isValidHex` (`bot-logic/src/input-resolution.ts:167-271`, `stoat dye-resolver.ts:74-84`).
- **Outbound requests / SSRF:** no `fetch(` in `apps/stoat-worker/src` or in the bot-logic paths it calls (`executeDyeInfo`, `resolveColorInput`, `resolveDyeInput`, `dyeService`); the only network I/O is revolt.js's own gateway/REST with fixed endpoints. No `child_process`, `eval`, `new Function`, or `fs` writes (grep → none; root ESLint enforces `no-eval`/`no-implied-eval`/`no-new-func`, `eslint.config.js:53-55`).
- **SVG:** `executeDyeInfo` builds the card from database fields only (dye name/hex/category, localized labels) — no user string reaches the SVG (`bot-logic/src/commands/dye-info.ts:87-139`), and stoat discards `svgString` anyway.
- **Error handling:** top-level `try/catch` sends a fixed "An unexpected error occurred" reply and logs `error.message` (`src/index.ts:64-88`); `executeDyeInfo`'s failure path returns a translated `errors.generationFailed` string, not the exception (`dye-info.ts:152-154`). No stack traces reach chat.
- **Shared surface with the Discord bot:** yes — `@xivdyetools/bot-logic` `resolveColorInput`/`resolveDyeInput`/`dyeService`/`executeDyeInfo` (`dye-resolver.ts:9-15`, `info.ts:9`); any bug in that resolver is reachable from both bots, but the surface is string search, not parsing of structured/untrusted formats.
- **Dependency posture:** `revolt.js ^7.1.1` → `7.2.0` (`pnpm-lock.yaml:3573`) → `solid-js 1.9.11` (`:3658`) → `seroval 1.6.2` + `seroval-plugins 1.5.0` (`:6904-6908`, `:3612`). The workspace floor `seroval: '>=1.5.3'` (`pnpm-workspace.yaml:16`, lockfile `overrides` `:11`) is satisfied → GHSA-mv8w-475r-vwqw is closed. `pnpm audit` (coordinator's `evidence/pnpm-audit-summary.md`) shows only a LOW esbuild 0.27.3 advisory via `tsup`/`vitest` here — dev-only. No deploy workflow references stoat (`grep stoat .github` → none), matching README/CLAUDE "parked — no deploy workflow".
- **Confidence:** CONFIRMED.

### STOAT-6 — Minor (INFO)

- `src/index.ts:48-50` ignores only the bot's own messages; other bots' messages are processed (bot-to-bot loop potential; see STOAT-2 fix).
- `src/commands/info.ts:38` locale hard-coded to `'en'` (TODO) — functional, not security.
- `vitest.config.ts:21` excludes `src/index.ts` from coverage — the entry/error-handling path is untested; acceptable for a parked app.

---

## Positive controls verified

| Control | Evidence |
|---|---|
| `pnpm install --frozen-lockfile` in every workflow (14/14 install steps) | `ci.yml:60,86`; every `deploy-*.yml`; `publish-packages.yml:112` |
| `minimumReleaseAge: 1440` (24 h) | `pnpm-workspace.yaml:35` |
| No dependency may run install scripts (`allowBuilds` all `false`) | `pnpm-workspace.yaml:26-29` |
| Security-floor overrides honoured by the lockfile (`rollup >=4.59.0`, `qs >=6.15.2`, `seroval >=1.5.3`) | `pnpm-workspace.yaml:8-16`; `pnpm-lock.yaml:7-11`, seroval resolved `1.6.2` |
| Nightly `pnpm audit --prod --audit-level high` as its own job (not `continue-on-error`) | `ci.yml:24-25,47-62` |
| npm publishing via OIDC trusted publishing with `--provenance`, `id-token: write`, no `NPM_TOKEN`, `registry-url` deliberately omitted so no `.npmrc` with a token placeholder is written | `publish-packages.yml:91-93,99-110,146`; `.npmrc:5-10` |
| Publish gated on local-vs-registry version diff, build + tests before publish, tier-ordered | `publish-packages.yml:48-84,114-132` |
| `packageManager: pnpm@11.17.0` exact pin; `pnpm/action-setup` resolves from it | `package.json:28` |
| No `pull_request_target`; no `set -x`; no secrets echoed; no `.dev.vars`/`.env` written in CI; `register-commands.ts` never prints the token | workflow grep; `apps/discord-worker/scripts/register-commands.ts:44-54,82-89` |
| Production `DISCORD_TOKEN` step-scoped; beta command registration guild-scoped and gated | `deploy-discord-worker.yml:62-67`; `deploy-discord-worker-beta.yml:83-90` |
| Beta deploys cannot reach production by construction (separate Worker names / separate Pages project; `routes` and `workers_dev` declared explicitly in both envs; `wrangler-env.test.ts` guards og-worker) | `apps/*/wrangler.toml` headers; `apps/og-worker/tests/wrangler-env.test.ts`; `DEPLOY_ENVIRONMENTS.md:34-38` |
| Beta web build fails closed without `X-Robots-Tag` and the live smoke test asserts it on the custom domain (and asserts production is *not* noindex) | `vite-plugin-beta-branding.ts:50-69`; `scripts/check-beta-build.js:43,46`; `scripts/smoke-test-pages.js:185-201`; `deploy-web-app.yml:75-79` |
| Dependabot covers npm + github-actions | `.github/dependabot.yml:5-43` |
| `_redirects` is SPA-only; CSP has `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'none'`, `upgrade-insecure-requests`; HSTS with preload; `nosniff`; `X-Frame-Options: DENY` | `public/_redirects:3`; `public/_headers:17-27` |
| `.gitignore` covers `.env`, `.env.*` (except `.env.example`), `.dev.vars`, `.wrangler/`, `.npmrc.local`; no `.env`/`.dev.vars` tracked (`git ls-files` check) | `.gitignore:8-10,24-28` |
| ESLint bans `eval`/implied-eval/`new Function` repo-wide; `no-floating-promises` on | `eslint.config.js:41,53-55` |
| Logger redacts `password/token/secret/authorization/cookie/api_key/access_token/refresh_token` (+ worker-specific `jwt_secret`, `bot_api_secret`, `bot_signing_secret`, `discord_client_secret`) | `packages/logger/src/constants.ts:14-44` |
| Wrangler `[vars]` hold only public identifiers; secrets documented as comments; `image-worker` binding-only with `workers_dev = false` in both envs | `apps/*/wrangler.toml` |
| stoat: token env-only, not logged, no sinks, no fetch, seroval floor satisfied | STOAT-5 |

---

## Secrets inventory (names read via `env.X` in `apps/*/src` that are not in any `[vars]`, plus CI secrets)

| Secret | Consuming worker(s) / place | In `SECRET_ROTATION.md`? |
|---|---|---|
| `DISCORD_TOKEN` | discord-worker (prod + beta), moderation-worker; GitHub secret for register-commands | yes (both bots); beta token set not mentioned |
| `DISCORD_PUBLIC_KEY` | discord-worker (prod + beta), moderation-worker | yes |
| `BOT_API_SECRET` | discord-worker, moderation-worker, presets-api | yes (commands now target wrong env — INF-4) |
| `JWT_SECRET` | oauth, presets-api | yes (commands target wrong env for presets-api — INF-4) |
| `DISCORD_CLIENT_SECRET` | oauth | yes |
| `MODERATOR_IDS` | discord-worker, moderation-worker, presets-api | yes (listed for presets-api, moderation-worker; discord-worker omitted) |
| `MODERATION_CHANNEL_ID` | discord-worker, moderation-worker | yes (moderation-worker only) |
| `MODERATION_BOT_TOKEN` | discord-worker | yes |
| `BOT_SIGNING_SECRET` | discord-worker, moderation-worker, presets-api | **no** |
| `INTERNAL_WEBHOOK_SECRET` | discord-worker, presets-api | **no** |
| `GITHUB_WEBHOOK_SECRET` | discord-worker (`src/index.ts:406,438`) | **no** |
| `XIVAUTH_CLIENT_SECRET` | oauth (optional, confidential-client mode) | **no** |
| `PERSPECTIVE_API_KEY` | presets-api | **no** |
| `DISCORD_BOT_TOKEN` | presets-api | **no** |
| `MODERATION_WEBHOOK_URL` | presets-api | **no** |
| `OWNER_DISCORD_ID` | presets-api | **no** |
| `SUBMISSION_LOG_CHANNEL_ID` | discord-worker, moderation-worker | **no** |
| `STATS_AUTHORIZED_USERS` | discord-worker | **no** |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | discord-worker (optional); stoat-worker (read, unused) | **no** |
| `UNIVERSALIS_PROXY_URL` | discord-worker (optional fallback when the service binding is absent) | n/a (URL, not secret) |
| `XIVAPI_SCHEMA` | api-worker (optional) | n/a |
| `BOT_TOKEN` | stoat-worker (Node env) | **no** |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | GitHub Actions — all 11 deploy workflows (one account-wide token) | **no** |
| `DISCORD_TOKEN` (GH secret), `BETA_DISCORD_TOKEN`, `BETA_DISCORD_GUILD_ID` | GitHub Actions — discord deploy workflows | **no** |

`DISCORD_BOT_WEBHOOK_URL` is named in `apps/presets-api/wrangler.toml:71` but only appears in `src/types.ts:77` — dead name, not a live secret.

---

## Coverage — files read in full (unless noted)

**stoat-worker:** `src/index.ts`, `src/config.ts`, `src/router.ts`, `src/commands/{parser,ping,help,about,info}.ts`, `src/services/{dye-resolver,message-context,response-formatter,loading-indicator}.ts`, `src/test-utils/revolt-mocks.ts` (head), `package.json`, `.env.example`, `.gitignore`, `README.md`, `CLAUDE.md`, `tsconfig.json`, `vitest.config.ts`, `CHANGELOG.md` (0.2.1 entry). No Dockerfile / compose / fly.toml / ecosystem file exists. Supporting: `packages/bot-logic/src/input-resolution.ts:140-300`, `packages/bot-logic/src/commands/dye-info.ts:60-200`, `packages/logger/src/constants.ts`, `pnpm-lock.yaml` (seroval / revolt.js / solid-js entries + `overrides`).

**Workflows (13/13, full):** `ci.yml`, `deploy-api-worker.yml`, `deploy-discord-worker.yml`, `deploy-discord-worker-beta.yml`, `deploy-image-worker.yml`, `deploy-moderation-worker.yml`, `deploy-oauth.yml`, `deploy-og-worker.yml`, `deploy-og-worker-beta.yml`, `deploy-presets-api.yml`, `deploy-web-app.yml`, `deploy-web-app-beta.yml`, `publish-packages.yml`; `.github/dependabot.yml`.

**Root config (full):** `pnpm-workspace.yaml`, `package.json`, `turbo.json`, `knip.jsonc`, `eslint.config.js`, `.gitignore`, `.gitattributes`, `.npmrc`, `.prettierignore`, `tsconfig.base.json`, `.vscode/settings.json`, `.vscode/extensions.json`, `scripts/coverage-report.ts` (first 150 lines); `.superpowers/` (listing + its `.gitignore`; untracked).

**Wrangler (7/7, full):** `apps/{api-worker,discord-worker,image-worker,moderation-worker,oauth,og-worker,presets-api}/wrangler.toml`. Env examples: only `apps/stoat-worker/.env.example` exists (no `.dev.vars.example` in any worker; `apps/web-app/.env.development` is untracked/ignored). Supporting: `apps/oauth/src/constants/oauth.ts`, `apps/oauth/README.md:60-90`, `apps/discord-worker/package.json`, `apps/discord-worker/scripts/register-commands.ts`, `env.X` grep across all `apps/*/src`.

**web-app:** `public/_headers`, `public/_redirects`, `functions/_middleware.ts`, `vite.config.ts`, `vite-plugin-{async-css,beta-branding,changelog-parser}.ts`, `src/shared/beta-branding.ts`, `scripts/smoke-test-pages.js`, `scripts/check-beta-build.js`, `scripts/check-bundle-size.js` (first 120 lines), `package.json`, `.env.development`; `import.meta.env`/`VITE_`/`workers.dev` grep across `src/`; `src/index.html` (meta/script grep only).

**Docs:** `docs/.secrets.baseline`, `docs/.pre-commit-config.yaml`, `docs/operations/SECRET_ROTATION.md`, `docs/operations/DEPLOY_ENVIRONMENTS.md`, `docs/audits/2026-01-25/findings/FINDING-00{1,2,3}*.md` (first 60 lines each), `docs/audits/security/evidence/potential-secrets*.txt` (sampled), `docs/audits/2026-08-09-prerelease-monorepo-upgrade/evidence/potential-secrets.txt`, this audit's `AUDIT_MANIFEST.md` and `evidence/{pnpm-audit-summary.md,git-history-secrets.txt,potential-secrets.txt}`.

**Not done (by design):** no HTTP requests to production hosts; no Cloudflare dashboard checks (repo "Workflow permissions" default, branch protection, API-token scopes, which secrets are actually set per env); no WHOIS.
