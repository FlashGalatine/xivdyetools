# review-regression-b — regression sweep B (2026-10-26, HEAD 13c386e5)

Scope: 2026-10-03 FINDING-017..031, 2026-09-15 FINDING-001..006, 2026-08-29 FINDING-001..031.
Method: read the finding's Fix/Status, open the fixed code at HEAD, name the guarding test, and
for settings findings read GitHub state with read-only `gh api` GETs (2026-10-26).
Advisor/Fable not used (user instruction: no Fable agents).

## Per-finding state

### 2026-10-03

| ID | State | Evidence at HEAD | Guarding test |
|---|---|---|---|
| 017 | HOLDS | presets-api/src/handlers/moderation.ts:129-145 `parseReviewBinding`; :197-201 fail-closed 409 REVISION_REQUIRED; :225 binds caller's expected pair; revert same at :291-296, preset-service.ts:480-486. moderation-worker preset-api.ts:441-509 sends expected_revision/status; discord-worker preset-notifications.ts:238-265 uses `buildReviewCustomIdOrLegacy`; typed `/preset moderate` shows confirmation (moderation-worker commands/preset.ts:244-291). Bot-side duplicate posts removed (discord-worker commands/preset.ts:574-578, BUG-004), so the "legacy id" follow-up is gone. | presets-api tests/handlers/moderation-review-binding.test.ts, moderation-revert-binding.test.ts; moderation-worker services/preset-api.test.ts:439, buttons/preset-moderation-review.test.ts:374 |
| 018 | HOLDS | discord-worker services/preferences.ts:681 `{ keys }`; preset-favorites.ts:202,231 `{ presetId }` | src/__tests__/log-user-id-invariant.test.ts (source scan, allow-list of 2 messages); preferences.test.ts:176-185 |
| 019 | HOLDS | presets-api services/moderation-service.ts:376-383 no scorer -> `passed:false, method:'unscored'` -> presets.ts:1039 pending | tests/services/moderation-service.test.ts (unscored) |
| 020 | HOLDS | moderation.ts:415-448 `logImageAction('image_approve'|'image_reject')` in batch | tests/handlers/moderation-image-audit.test.ts:95,109 |
| 021 | HOLDS | moderation-worker services/ban-service.ts:401-425 NOT EXISTS restore guard; :542,:633 UNIQUE handling | ban-service.sqlite.test.ts, ban-service.test.ts |
| 022 | HOLDS | all 7 apps/*/wrangler.toml pin `[observability] enabled=false` (+ `[env.production.observability]` where that env exists; oauth top-level is prod); scripts/check-worker-logs.ts; ci.yml:292-294 in required job `ci` | scripts/check-worker-logs.test.ts; `npx tsx scripts/check-worker-logs.ts` -> 7/7 ok |
| 023 | **PARTIAL** | `gh api repos/.../actions/secrets` -> `BETA_DISCORD_GUILD_ID, BETA_DISCORD_TOKEN, CLOUDFLARE_ACCOUNT_ID, DISCORD_TOKEN, MODERATION_DISCORD_TOKEN` still at repository scope; env copies exist (production: CLOUDFLARE_API_TOKEN, DISCORD_TOKEN, MODERATION_DISCORD_TOKEN; beta: BETA_*). OPEN_ITEMS.md:44-49 still unchecked. Precondition met: deploy PRs #225/#227 merged 2026-10-05 | none possible (settings) |
| 024 | HOLDS (residual) | branch protection contexts include `Secret scan (gitleaks)`; `strict:false`, `enforce_admins:false`, `reviews:null` — OPEN_ITEMS.md:36 deferred these "until the 2026-10-03 remediation PRs are merged"; all merged 2026-10-05 | settings |
| 025 | HOLDS | pnpm-workspace.yaml:34 `'miniflare>undici': '>=7.29.1 <8'`; lock has undici@7.30.1; ci.yml:94 full-tree report-only audit | none (lockfile) |
| 026 | HOLDS | stoat-worker services/response-formatter.ts:97 `STOAT_MASS_MENTION` (everyone/online/here) | response-formatter tests (13 per fix commit) |
| 027 | HOLDS (optional part absent) | discord-worker index.ts:315-323 production 503 on secret < 32; env-validation.ts:136-146; presets-api env-validation.ts:148-155 warning. No limiter / binding-only check before the bearer compare (index.ts:293-329) — optional in the fix | src/index.test.ts:382-396; utils/env-validation.test.ts:325-339; presets-api tests/utils/env-validation.test.ts:345-375 |
| 028 | HOLDS | apps/web-app/PRIVACY*.md and TERMS_OF_SERVICE*.md all name pixiv / the example-link hosts (6+6 files) | none (docs) |
| 029 | HOLDS | PRIVACY.md:247 "Deleting your data", :270 30-day; locale siblings carry 30-day text | none (docs) |
| 030 | HOLDS (CodeQL optional, not set) | actions/permissions `sha_pinning_required:true` (allowed_actions all); vulnerability-alerts 204; automated-security-fixes enabled; code-scanning default-setup `not-configured`; #233 merged | settings |
| 031 | HOLDS | apps/presets-api/tests/migration-trigger-parity.test.ts | itself |

### 2026-09-15

| ID | State | Evidence | Test |
|---|---|---|---|
| 001 | HOLDS | packages/auth/src/discord.ts:114-128 reader + cancel above cap | packages/auth/src/discord-stream.test.ts |
| 002 | HOLDS | presets-api moderation.ts:426-446 `WHERE preview_image_key = ? AND status='pending'` | tests/handlers/preview-revision.test.ts; discord-worker buttons/preview-image.test.ts |
| 003 | HOLDS | discord-worker index.ts:104, 607-627 streaming 1 MiB cap | src/github-body-limit.test.ts |
| 004 | HOLDS | preset-service.ts:714-716 `AND author_discord_id = ? AND content_revision = ?` | tests/handlers/owner-revision.test.ts |
| 005 | HOLDS | preset-service.ts:482-486 revision+status+snapshot bound | moderation-revision.test.ts, moderation-revert-binding.test.ts |
| 006 | HOLDS | og-worker index.ts:162 `logUserAgent:false`; only log sites index.ts:555,1420-1422, renderer.ts:46-158 carry no UA/URL | src/index.privacy.test.ts |

### 2026-08-29 (all reported FIXED 2026-09-01)

| ID | State | Evidence |
|---|---|---|
| 001 | HOLDS | oauth schema/users.sql:7; schema.test.ts:45 |
| 002 | HOLDS | oauth callback.ts:235-244 no avatar_url persisted (only in response :261) |
| 003 | HOLDS | no `/refresh` route in oauth/src (git grep empty) |
| 004/005 | HOLDS | moderation-service.ts fail-closed `perspective_unavailable`; quotas (presets-quotas.test.ts) |
| 006 | HOLDS | moderation-service.ts:274 `doNotStore: true` |
| 007 | HOLDS | no "upstash" in discord-worker src / wrangler.toml |
| 008 | HOLDS | discord-worker index.ts:877-880 `expirationTtl: FIRST_RUN_FLAG_TTL_SECONDS` |
| 009 | HOLDS | web-app indexeddb-service.ts:16,131-133 |
| 010 | HOLDS | worker-kit middleware/logger.ts:117 default false; only og-worker sets it (false); limiter logs `keyScope` only (rate-limit.ts:177,214; backends/cloudflare.ts:219; kv.ts:186,257) |
| 011 | HOLDS (sampled) | discord-worker preferences.ts:357 logs keys/types/lengths only |
| 012 | HOLDS | backends/cloudflare.ts:210-228 console.warn fallback |
| 013 | HOLDS | env-validation in presets-api (JWT_ISSUER/TOKEN_BLACKLIST/RL_PUBLIC), oauth (RL_AUTH_*/TOKEN_BLACKLIST), moderation-worker (RL_COMMAND/RL_AUTOCOMPLETE), discord-worker (RL_5..70) |
| 014 | HOLDS | api-worker telemetry/router.ts:57 Sec-GPC; rate-limit.ts:172 failOpen:false |
| 015 | HOLDS | no v1 `X-Request-Signature` verifier in apps/packages src |
| 016 | HOLDS | every preset response in presets.ts goes through `presetForViewer` (182,255,271,295,944,977,1159); preset-service.ts:169-189 strips author_discord_id for anonymous |
| 017 | HOLDS | notification-service.ts:182-190 dead-letter `{type, preset_id, moderation_status, content_revision}` |
| 018 | HOLDS | ban-service.ts:371,393,439-499 ban/unban/hide/restore log rows |
| 019 | HOLDS | schemas.ts: 4x `max_length: 32` |
| 020 | HOLDS | rate limit before dispatch for every command (index.ts:953-971) |
| 021 | HOLDS | index.ts:115,681 repo pin |
| 022 | HOLDS | oauth index.ts:127 no-store |
| 023 | HOLDS | wrangler-config tests in all 7 workers |
| 024 | HOLDS | og-worker index.ts:208-279 ogCacheKey canonical |
| 025 | HOLDS | logger base-logger.ts:216-222 message sanitised |
| 026 | HOLDS | web-app src/index.html:74-79 first-party hints only; _headers:23 |
| 027 | HOLDS | web-app functions/_middleware.ts:25-35 |
| 028 | HOLDS | beta workflows use `CLOUDFLARE_API_TOKEN_BETA` only, `environment: beta` |
| 029 | HOLDS | .gitleaks.toml value-anchored regexes, test-file path rules only |
| 030 | NOT VERIFIABLE | Cloudflare token scopes are dashboard state |
| 031 | HOLDS | stoat-worker index.ts:28 level 'info' |

## Candidates (see StructuredOutput)
- regression-b-01: 2026-10-03 FINDING-023 still PARTIAL — four repository-scope Discord token copies.
- regression-b-02: 2026-10-03 FINDING-024 residual — enforce_admins/strict still off after the gating PRs merged.
- regression-b-03: 2026-10-03 FINDING-027 optional hardening absent — no failed-auth limit on the public webhook.

## Positive controls
- FINDING-017 review binding shared through one grammar (`@xivdyetools/types` review-custom-id.ts) and fail-closed on missing binding.
- Workers Logs gate is a root script in the required CI job, unanchored `enabled = true`, fail-closed allow-list.
- discord-worker log-user-id-invariant.test.ts source scan keeps policy §5 true.
- Trigger parity test ties migration 0014 to schema.sql.
- Dependabot alerts + security updates on, SHA pinning required, gitleaks a required check.

## Rejected
- 2026-10-03 FINDING-030 "allowed_actions: all" — fix asked for sha_pinning OR selected actions; sha_pinning_required is true.
- `beta` environment has no branch policy — by design (beta deploys run from branches; DEPLOY_ENVIRONMENTS.md).
- oauth `[env.development]` lacks its own observability pin — inheritable key, top-level pinned; gate documents this.
- moderation-worker refresh still offering Revert on any pending preset with a snapshot (discord-worker CLAUDE.md BUG-003 note) — a known documented gap of BUG-003, not a regression of a security finding; presets-api now only snapshots approved text.

## Files covered
~62 files: docs/audits/{2026-08-29,2026-09-15,2026-10-03}-security (reports + findings), apps/presets-api/{src/handlers,src/services,src/utils,tests}, apps/moderation-worker/src/{services,handlers}, apps/discord-worker/src/{index.ts,services,handlers/commands,utils,__tests__}, apps/oauth/src, apps/og-worker/src, apps/web-app/{functions,public,src/index.html,PRIVACY*,TERMS_OF_SERVICE*}, apps/stoat-worker/src, apps/api-worker/src/{telemetry,middleware}, packages/{auth,worker-kit,logger,types}/src, apps/*/wrangler.toml, scripts/check-worker-logs.ts, .github/workflows/*, .gitleaks.toml, pnpm-workspace.yaml, docs/operations/{OPEN_ITEMS,DEPLOY_ENVIRONMENTS,SECRET_ROTATION}.md; plus read-only `gh api` settings reads.
