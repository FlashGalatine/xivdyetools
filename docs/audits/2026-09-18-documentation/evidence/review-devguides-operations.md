# devguides-operations — fact-check review (2026-09-18)

Worktree HEAD: `0fec18f4` (origin/main). Read-only review; no builds/tests run except the two
read-only doc gates (`pnpm docs:check-links`, `pnpm docs:check-versions` — both green, see below).

## Coverage

| file | sections reviewed | result |
|---|---|---|
| docs/developer-guides/contributing.md | all | reviewed |
| docs/developer-guides/deployment.md | all | reviewed |
| docs/developer-guides/environment-variables.md | all | reviewed |
| docs/developer-guides/index.md | all | reviewed |
| docs/developer-guides/local-setup.md | all | reviewed |
| docs/developer-guides/logging-standards.md | all | reviewed |
| docs/developer-guides/monorepo-setup.md | all | reviewed |
| docs/developer-guides/release-process.md | all | reviewed |
| docs/developer-guides/testing.md | all | reviewed |
| docs/developer-guides/troubleshooting.md | all | reviewed |
| docs/operations/index.md | all | reviewed |
| docs/operations/ANALYTICS_QUERIES.md | all | partial (+reason: dataset names, retention and query intent cross-checked against discord-worker/api-worker CLAUDE.md; did not independently re-derive every SQL query's correctness against `analytics.ts`/`command-trace.ts`/`telemetry/schema.ts` source line-by-line) |
| docs/operations/DEPLOY_ENVIRONMENTS.md | all | reviewed |
| docs/operations/DOMAIN_DEPRECATION.md | all | reviewed |
| docs/operations/IMAGE_WORKER_SPLIT.md | all | reviewed |
| docs/operations/MODERATION.md | all | reviewed |
| docs/operations/OPEN_ITEMS.md | all | reviewed |
| docs/operations/SECRET_ROTATION.md | all | reviewed |
| docs/operations/security-remediation-2026-09-15.md | all | reviewed |

Read-only gates run from the worktree root (both green, corroborating no BROKEN-LINK or
STALE-VERSION-table candidates in this cluster):
- `npx tsx scripts/check-doc-links.ts` → "checked 887 relative links across 241 documents — all resolve"
- `npx tsx scripts/check-doc-versions.ts` → "checked 34 version claims across README.md, docs/versions.md — all match package.json"

## Candidates

### C1 — MEDIUM — MISSING — `docs/developer-guides/environment-variables.md:67-79`
discord-worker's Secrets table lists `DISCORD_TOKEN`, `DISCORD_PUBLIC_KEY`, `BOT_API_SECRET`,
`INTERNAL_WEBHOOK_SECRET`, `STATS_AUTHORIZED_USERS`, `MODERATOR_IDS`, `MODERATION_CHANNEL_ID`,
`SUBMISSION_LOG_CHANNEL_ID`, `MODERATION_BOT_TOKEN` — nine rows. It omits two secrets the worker
actually reads: `BOT_SIGNING_SECRET` and `GITHUB_WEBHOOK_SECRET`.
- Evidence: `apps/discord-worker/src/utils/env-validation.ts:79-83` reads/validates
  `env.BOT_SIGNING_SECRET`; `apps/discord-worker/src/index.ts:504,556` reads
  `env.GITHUB_WEBHOOK_SECRET` (verified with `verifyGitHubSignature`).
- Corroboration: the same document's own "Shared Secrets" table
  (`docs/developer-guides/environment-variables.md:371`) lists `BOT_SIGNING_SECRET` as consumed by
  `discord-worker, moderation-worker, presets-api` — internally inconsistent with the dedicated
  table three subsections earlier that never lists it for discord-worker at all.
- `apps/discord-worker/CLAUDE.md`'s own "Optional Secrets" table (not in this cluster) lists both,
  confirming this doc's table is the outlier.

### C2 — MEDIUM — WRONG — `docs/developer-guides/environment-variables.md:182`
presets-api's Secrets table marks `MODERATOR_IDS` as `No` (not required). Source requires it
unconditionally (every environment, not just production).
- Evidence: `apps/presets-api/src/utils/env-validation.ts:43-49` — `MODERATOR_IDS` is in the
  `requiredStrings` array checked with no `ENVIRONMENT` gate; a missing value pushes
  `'Missing or empty required env var: MODERATOR_IDS'`.
- `apps/presets-api/CLAUDE.md`'s own Required Secrets table (not in this cluster) already has it
  right: "required in **every** environment".

### C3 — MEDIUM — WRONG — `docs/developer-guides/environment-variables.md:183,186`
Same presets-api table marks `BOT_SIGNING_SECRET` and `INTERNAL_WEBHOOK_SECRET` as `No`, with no
qualification. Both are required specifically in production.
- Evidence: `apps/presets-api/src/utils/env-validation.ts:97-99` (`BOT_SIGNING_SECRET`, FINDING-001)
  and `:131-133` (`INTERNAL_WEBHOOK_SECRET`, FINDING-013) both push
  `Missing required env var in production: <NAME>` when `env.ENVIRONMENT === 'production'`.
- Contrast: the doc's own discord-worker and moderation-worker sections correctly leave
  `BOT_SIGNING_SECRET` as unqualified `No` there, because those two workers' `env-validation.ts`
  genuinely never requires it (`apps/discord-worker/src/utils/env-validation.ts:75-83`,
  `apps/moderation-worker/src/utils/env-validation.ts:111-120` — both explicitly comment "is
  optional"), which is a correct precedent this doc breaks only for presets-api.

### C4 — MEDIUM — MISSING — `docs/developer-guides/environment-variables.md:135-138`
oauth's Secrets table lists only `DISCORD_CLIENT_SECRET` and `JWT_SECRET`. It omits
`XIVAUTH_CLIENT_SECRET`, a real (optional) secret the worker reads.
- Evidence: `apps/oauth/src/handlers/xivauth.ts:158-159` reads `c.env.XIVAUTH_CLIENT_SECRET`;
  declared optional in `apps/oauth/src/types.ts:64`; listed in the `wrangler.toml:75` comment
  (`# Secrets: DISCORD_CLIENT_SECRET, JWT_SECRET, XIVAUTH_CLIENT_SECRET`).
- `apps/oauth/CLAUDE.md`'s own Optional Secrets table (not in this cluster) already documents it.

### C5 — MEDIUM — WRONG — `docs/developer-guides/testing.md:4`
"**Vitest 4** across every workspace — no package is pinned to an older major" is false: every
workspace is on Vitest 5.
- Evidence (sample): `apps/discord-worker/package.json:44` `"vitest": "^5.0.0"`;
  `apps/web-app/package.json:51` `"vitest": "^5.0.0"`; `packages/core/package.json:78`
  `"vitest": "^5.0.0"`. `git grep -n "\"vitest\":" -- "*/package.json"` shows `^5.0.0` (or
  `>=2.0.0` peer-range for test-utils) in all 19 hits, zero `^4.x`.
- The `@cloudflare/vitest-pool-workers` half of the same sentence is correct (zero hits).

### C6 — MEDIUM — WRONG — `docs/developer-guides/monorepo-setup.md:152`
"Other tooling" table: `| Vitest | 4 | Every package and app |` — same error as C5, source is the
same `package.json` grep.

### C7 — LOW — STALE-VERSION — `docs/developer-guides/testing.md:113`
"**Playwright 1.62** with chromium, mobile-chrome projects" — actual pinned version is `^1.63.0`.
- Evidence: `apps/web-app/package.json:36` `"@playwright/test": "^1.63.0"`.

### C8 — MEDIUM — kind=WRONG (contradiction between two docs in this same cluster) —
`docs/developer-guides/contributing.md:110-112` vs `docs/operations/OPEN_ITEMS.md:29-32`
contributing.md: "`main` and `monorepo-2.0-prep` are protected with the same **two** required
checks (\"Lint, Type-check, Test, Build\", \"Security audit (production dependencies)\")".
OPEN_ITEMS.md (walked 2026-09-05, verified via `gh api`): "Found: required checks are *Lint,
Type-check, Test, Build*, *Security audit (production dependencies)* and **E2E (Playwright,
chromium)**" — three checks.
- `.github/workflows/ci.yml` does define all three jobs by those exact names (`ci` job name
  "Lint, Type-check, Test, Build" at ci.yml:120; `audit` job name "Security audit (production
  dependencies)" at ci.yml:63; `e2e` job name "E2E (Playwright, chromium)" at ci.yml:314) — E2E
  was added 2026-09-03 per its own comment in ci.yml. Branch-protection required-checks lists are
  a GitHub setting outside any tracked file, so the *workflow* evidence can't settle who is right,
  but OPEN_ITEMS.md's claim is dated and sourced from a live `gh api` check, while
  contributing.md's "two" is unresidented and looks like it predates the E2E job's addition to CI
  (2026-09-03) and OPEN_ITEMS' confirmation (2026-09-05). contributing.md is the more likely stale
  one — flagged for the maintainer to confirm and reconcile.

## Positive controls (checked, correct — don't re-chase)

- `docs/operations/DOMAIN_DEPRECATION.md`'s entire "Custom domain routes" + "Allowlists" line-number
  table (5 `wrangler.toml` routes + 2 allowlist files) is byte-accurate against current HEAD, e.g.
  `apps/discord-worker/wrangler.toml:119`, `apps/moderation-worker/wrangler.toml:64`,
  `apps/presets-api/wrangler.toml:62`, `apps/oauth/wrangler.toml:8`,
  `apps/api-worker/wrangler.toml:75`, `apps/oauth/src/constants/oauth.ts:17` (declared at `:10`),
  `apps/presets-api/wrangler.toml:64` — all verified by direct read.
- `docs/developer-guides/deployment.md`'s "Register Discord commands" line citations are exact:
  `deploy-discord-worker.yml:81-83` and `deploy-moderation-worker.yml:74-76` both match verbatim.
- `docs/developer-guides/deployment.md`'s workflow → path-filter table matches every
  `deploy-*.yml`'s `paths:` list (checked all 11 workflows) and every "bare deploy targets" claim
  (oauth bare = production via `command: deploy`; the rest use `--env production`, beta workflows
  never pass `--env`).
- `docs/developer-guides/environment-variables.md`'s rate-limit `namespace_id` table (api-worker
  1001-1004, presets-api 1011-1012, oauth 1021-1026, moderation-worker 1031-1034, discord-worker
  1041-1046/1051-1056) matches every worker's `wrangler.toml` exactly.
- `docs/developer-guides/environment-variables.md`'s api-worker and og-worker sections (vars,
  bindings, "no secrets") match `wrangler.toml` and each `CLAUDE.md` exactly.
- `docs/developer-guides/testing.md`'s `@xivdyetools/test-utils` "complete public surface" listing
  (createMockD1Database, createMockD1, createMockKV + KV_MIN_EXPIRATION_TTL/KV_MAX_LIST_PAGE,
  createMockR2Bucket, createMockFetcher, createMockAnalyticsEngine, createTestJWT,
  createExpiredJWT, authHeaders, createMockDye/mockDyes, createMockPresetRow, createMockSubmission,
  createMockCategoryRow, VALID_CODE_VERIFIER/CHALLENGE, randomId/randomStringId/nextStringId) and
  its "six consumers" claim both match `packages/test-utils/src/**` exports and the six
  `package.json` files that declare it as a devDependency.
- Root `package.json` scripts (`docs:check-versions`, `docs:check-links`, `test:scripts`,
  `lint:dead`, `dead-code:check`) all exist exactly as named in the developer-guides docs.
- `turbo.json`'s `lint`/`test` extra `inputs` (`knip.jsonc`, `apps/*/wrangler.toml`) match
  `monorepo-setup.md`'s description; `deploy`/`dev` task shapes match too.
- `.github/workflows/ci.yml`'s triggers (`push: [main, master, '*-prep']`, unrestricted
  `pull_request`) match `contributing.md`'s CI trigger description exactly.
- `publish-packages.yml`'s tier order (`types, logger, auth, core, worker-kit, svg, bot-logic`)
  matches `release-process.md`'s stated publish order.
- `docs/operations/security-remediation-2026-09-15.md`: migration file
  `apps/presets-api/migrations/0014_add_content_revision.sql` exists; the 11 named deployment
  workflows (8 production + 3 beta) are exactly the 11 `deploy-*.yml` files in `.github/workflows/`
  (excluding `ci.yml`, `publish-packages.yml`, `sync-dye-emojis.yml`); `@xivdyetools/auth`
  `package.json` version is `2.0.2` as the doc instructs publishing.
- `docs/operations/MODERATION.md`'s secrets list (`DISCORD_TOKEN`, `DISCORD_PUBLIC_KEY`,
  `BOT_API_SECRET`, `BOT_SIGNING_SECRET`, `MODERATOR_IDS`, `MODERATION_CHANNEL_ID`,
  `SUBMISSION_LOG_CHANNEL_ID`) matches `apps/moderation-worker/src/utils/env-validation.ts` and its
  own `CLAUDE.md` exactly.
- `docs/operations/DEPLOY_ENVIRONMENTS.md`'s entire beta/production table (Discord app ids, KV
  namespace ids, workflow trigger shapes, `--branch=beta` requirement, `CLOUDFLARE_API_TOKEN_BETA`
  environment gating) matches the corresponding `wrangler.toml` and `.github/workflows/*.yml`
  files verified during this review.

## Rejected items (looked wrong, were right)

- presets-api's `CACHE_PURGE_ZONE_ID` appears only in prose, not the fenced `vars` block quoted in
  `environment-variables.md:171` — looked like an omission, but the doc's prose two lines below
  (`:174`) explains it as a separate production-only var; the actual `wrangler.toml:64` line
  matches the doc's fenced snippet verbatim for every other key, so this isn't a doc error.
- moderation-worker's `BOT_SIGNING_SECRET` marked `No` in `environment-variables.md` looked
  suspicious next to the presets-api finding above, but `apps/moderation-worker/src/utils/env-validation.ts:111-120`
  explicitly comments "BOT_SIGNING_SECRET is optional (HMAC signing is skipped when absent)" with
  no production gate — the doc is correct here, unlike presets-api.
- `docs/operations/security-remediation-2026-09-15.md` naming "Discord 5.5.4" and "auth 2.0.2" as
  specific versions initially looked like a living-tier current-version violation (versions belong
  only in README.md/versions.md), but the document is a point-in-time release runbook for one
  specific PR/migration, not a current-state table — allowed under "mentioning a past release
  elsewhere is allowed", and `auth`'s package.json is in fact still 2.0.2 (the version this
  document told the maintainer to publish).
- `docs/developer-guides/testing.md`'s "~480 test files" vs the actual tracked count (492 via
  `git ls-files | grep -E "\.test\.(ts|tsx|js)$" | wc -l`) is within the stated approximation
  ("~") and not flagged as STALE-VERSION/count.
