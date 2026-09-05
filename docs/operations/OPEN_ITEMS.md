# Open operational items

**Status:** living list, last walked 2026-09-05.
**Owner:** the maintainer — every item needs credentials CI does not have (GitHub settings,
the Cloudflare dashboard, `wrangler` against production, a browser session).
**Where it came from:** the 5.0 post-merge checklist
([archived record](../historical/20260828-PostMerge5.0/POST_MERGE_CHECKLIST.md)) — the merge
itself (2026-08-28) and everything gated on it are closed; what is left is dashboard work,
manual verification, and code removals gated on that verification. Tick items here as they
close and note the date; when an item needs its history, the archived checklist has it.

Conventions: `[ ]` open · `[x]` done · **→ prod** = the command targets production, so check the
`wrangler.toml` first ([DEPLOY_ENVIRONMENTS.md](DEPLOY_ENVIRONMENTS.md): a bare `wrangler deploy`
/ `wrangler secret put` hits the **dev** worker on discord-worker, moderation-worker, presets-api,
api-worker, image-worker; the **routed beta** worker on og-worker; and **production** on oauth).

---

## 1. GitHub repository settings

Verified with `gh api` on 2026-09-05; the state noted is the state found.

- [ ] **Code security → Private vulnerability reporting: ON.** Found **disabled**
      (`repos/…/private-vulnerability-reporting` → `enabled: false`) while `SECURITY.md` directs
      reporters to it. The only item on this page a stranger can hit; do this one first.
- [ ] **Dependabot alerts + security updates: ON.** Found off (`vulnerability-alerts` → 404,
      `automated-security-fixes` → `enabled: false`). The nightly `pnpm audit --prod` job is the
      in-repo half; this is the GitHub half.
- [ ] **Branch protection on `main`:** add *Secret scan (gitleaks)* to the required checks and
      turn on **linear history**. Found: required checks are *Lint, Type-check, Test, Build*,
      *Security audit (production dependencies)* and *E2E (Playwright, chromium)*; force-push
      already blocked; linear history off; no rulesets.
- [ ] **`CLOUDFLARE_API_TOKEN` scoped to Workers Scripts: Edit + Pages: Edit on the account, and
      Workers Routes: Edit on the `xivdyetools.app` zone — no KV / D1 / R2 Edit** (2026-08-29
      FINDING-030, [SECRET_ROTATION.md](SECRET_ROTATION.md) §7). Inspect the live token's grants
      first; re-issue only if it carries storage grants, then update the secret, re-run one
      deploy via *workflow_dispatch*, revoke the old token, log the date. The token's *homing* is
      done: it is an environment secret on `production`, `CLOUDFLARE_API_TOKEN_BETA` is one on
      `beta`, and no repository-level copy of either exists (verified 2026-09-05).

Closed on the same walk, recorded here so the archived checklist's open boxes read correctly:
the `beta` environment exists with `CLOUDFLARE_API_TOKEN_BETA` and the three beta deploy
workflows succeed (latest `deploy-web-app-beta.yml` run green 2026-09-05); the `production`
environment carries its one branch-policy rule (`main` only); secret scanning and push
protection are on.

## 2. Cloudflare

- [ ] **Delete the old `xivdyetools-universalis-proxy` worker** — still present on 2026-09-05
      (last modified 2026-07-29); both proxy hostnames have answered api-worker since 2026-08-21
      ([DEPRECATIONS.md](../../DEPRECATIONS.md)). Also delete the old `xivdyetools-api-docs`
      Pages project (its custom domain moved to api-worker the same day).
- [ ] **Confirm the `[[ratelimits]]` bindings on every production worker** (Worker → Settings →
      Bindings) and that the KV rate-limit namespaces are idle — the gate for the KV-fallback
      removal in §5. (Bindings were confirmed via the API on 2026-08-29 for all seven workers;
      the *idle KV* half has not been checked.)
- [ ] **Workers Logs / Logpush stay OFF until the redaction is spot-verified** (2026-08-29
      FINDING-010 / FINDING-012). The precondition is met — every `@xivdyetools/worker-kit`
      consumer has redeployed since worker-kit 1.2.0 (2026-08-30) — so the remaining step is:
      `wrangler tail` a production worker, trigger a rate-limiter fail-open, confirm the line
      carries `keyScope` (e.g. `public:ip`) and no raw IP or Discord snowflake, and only then
      decide whether to enable log retention at all.
- [ ] `presets-api` R2 preview bucket: lifecycle / cache behaviour as set by FINDING-018.
- [ ] api-worker's and og-worker's dev workers are not reachable over `*.workers.dev`
      (`workers_dev = false`, FINDING-025) — confirm once in the dashboard.
- [ ] `xivdyetools-oauth-preview` / `auth-preview.xivdyetools.app` — no such worker exists in the
      account (2026-09-05); confirm the DNS record is absent too, then close.
- [ ] Start [DOMAIN_DEPRECATION.md](DOMAIN_DEPRECATION.md) Phase 0
      (`*.xivdyetools.projectgalatine.com`).

The og-worker WAF rate-limiting rule (FINDING-024) is **done** — deployed and active since
2026-09-01; the rule and the Free-plan constraints that shaped it are recorded in the archived
checklist §2.

## 3. Secrets

- [ ] Confirm production `moderation-worker` `DISCORD_TOKEN` and `discord-worker`
      `MODERATION_BOT_TOKEN` carry the token that was reset on 2026-08-29 (moderation embeds and
      channel posts 401 otherwise) — [SECRET_ROTATION.md](SECRET_ROTATION.md) rotation log.
- [ ] Any secret set with a bare `wrangler secret put` before 2026-08-21 landed on the **dev**
      worker — re-set it on production (`--env production`) per SECRET_ROTATION.md.
- [ ] Optional but recommended: rotate `BOT_SIGNING_SECRET` (all three consumers, one window)
      now that the v2 scheme is live; log it.

## 4. Manual verification still to run

Ten-minute tails on 2026-08-29 were clean but saw ten requests in total, so none of these is
proven under load.

- [ ] `wrangler tail` each production worker for 10 minutes under real traffic: no
      `KV rate limiter fallback` warning, no 5xx bursts; one real bot `/preset` command to
      observe the v2-signature round trip end to end.
- [ ] oauth: login → `POST /auth/revoke` → `GET /auth/me` **and** an authenticated presets-api
      write with the same token both answer 401 (needs a browser session).
- [ ] api-worker telemetry: rows written to `xivdyetools_web_analytics` in the last 24 h are
      non-zero ([ANALYTICS_QUERIES.md](ANALYTICS_QUERIES.md) §0) — a silent zero after a web-app
      host change means the Origin allowlist needs the new host (FINDING-014).
- [ ] image-worker: an oversize PNG sent through `/swatch` is rejected at the header gate
      (FINDING-004; the worker is service-binding-only).
- [ ] presets-api preview-image purge (FINDING-018): upload a preview → `curl -I
      https://shots.xivdyetools.app/<key>` twice → `cf-cache-status: HIT`; delete it → the next
      `curl -I` is not `HIT`; the tail shows `[preview-image] cache purged`.
- [ ] web-app in-app: Swatch `.chara` import resolves gear; presets list / submit / vote; OG card
      for `/`. (Response headers incl. CSP were verified 2026-08-28.)
- [ ] moderation bot: autocomplete only for moderators; ban flow on a long CJK name
      (FINDING-006/007).
- [ ] Discord / X link-preview validators for `/`, each tool path, a preset, and the beta host.

## 5. Code removals gated on the above

Each names the gate that must be true first. Remove with a test that proves the old path is
gone, and a CHANGELOG line.

| Remove | Where | Gate |
|---|---|---|
| **KV rate-limiter fallbacks** (`selectApiRateLimiter` KV branch, oauth `kv` backend, discord-worker / moderation-worker KV paths, the `RATE_LIMIT` KV bindings) | api-worker `middleware/rate-limit.ts`, oauth `services/rate-limit.ts`, discord-worker `services/rate-limiter.ts`, moderation-worker `middleware/rate-limit.ts`, wrangler KV bindings | one week of production logs with no fallback warning (§2 + §4) — FINDING-003/005 |
| `/api/v2/*` compat mount of the absorbed Universalis proxy | api-worker | after the proxy-domain cutover window (§2, DEPRECATIONS.md) |
| `LEGACY_FACEWEAR_ITEM_IDS` | `@xivdyetools/core` | **do not remove** — frozen compatibility map by design |

Not removals, still open from the same list: the web-app submission form does not mirror
presets-api's tag charset / control-character rules, so users see the API's 400 message
(FINDING-019/028); cross-identity (`xivauth_id`) bans need oauth + moderation-worker changes
(FINDING-017). The "`/preset submit` still sends legacy itemIDs" item closed on 2026-08-29.

## 6. Recurring audits

| Audit | How | Cadence |
|---|---|---|
| Dependency advisories | nightly `pnpm audit --prod` job; manual `pnpm audit` for dev deps — drop the `vitepress>vite` override from `pnpm-workspace.yaml` once VitePress ships on Vite ≥ 6.4.3 | monthly |
| Secret scanning, full history | `gitleaks git . --config .gitleaks.toml` locally (CI scans only each push's commits); GitHub's secret-scanning dashboard | quarterly |
| Dead code | `pnpm lint:dead` root sweep (triage, not a gate — exactly 3 known findings today) + the per-workspace knip gates + `pnpm dead-code:check` | after each removal in §5 |
| i18n | the parity / order / no-hardcoded-strings / font-coverage gates in `lint` / `test`; spot-check each locale on production | each release wave |
| Bundle size | discord-worker gzip vs the 3 MiB limit (`check-bundle-size`), web-app `v4-layout` budget | every deploy (CI) |
| E2E | Playwright runs in CI since 2026-09-03; a run against production after each wave | each release wave |
| Accessibility / performance | Lighthouse + axe on the 9 tools (open 5.0 item: a11y bands) | next wave |
| Documentation | `pnpm docs:check-versions` + `pnpm docs:check-links` (CI); a fact-check sweep like [2026-09-05](../audits/2026-09-05-documentation/README.md) after any large wave | each major wave |
| Test quality | the standing review check "what source edit would make this test fail?" on touched suites | ongoing |

## 7. Accepted residual risks

- `pnpm audit` is clean (0 advisories) only because of two scoped overrides (FINDING-036); a
  vitepress / tsup upgrade that changes its own vite / esbuild range may need them revisited.
- Beta surfaces share production presets-api / oauth data by design.
- stoat-worker stays parked; its abuse controls exist but it has no deploy workflow.
- discord-worker `PRIVACY_POLICY.md` states Analytics Engine retention as "3 months" — confirm
  against Cloudflare's current limits page and correct if needed (FINDING-022).
- api-worker has no second-tier / origin-aware rate limiter (API-6) and discord-worker does not
  forward a per-user key to the Universalis proxy — policy decisions, not bugs.
- web-app ships source maps (WEB-10) — MIT project, no secrets; kept for E2E coverage mapping
  and bundle bisects.
- Bot → API v2 signatures: nonce replay detection is best-effort across colos (KV is eventually
  consistent); the 60 s signature window is the primary bound (FINDING-015, closed 2026-08-29).
