# Remediation Plan — 2026-08-29 (security audit, whole monorepo)
**Sources:** single-source mode — `SECURITY_AUDIT_REPORT.md` in this folder (FINDING-001…031: 9 MEDIUM, 22 LOW; 36 INFO items stay in the reviewer reports, not scheduled) · **Status basis:** 31 total — 0 fixed, 31 outstanding, 0 superseded, 0 KEEP, 1 needs (conditional) rotation (FINDING-030)
**Ordering:** 1. one deploy unit per sprint 2. P0 first (none) 3. Severity × Exposure — INTERNET-AUTH MEDIUM app sprints before package/CI hygiene 4. terminal work last (package publishes whose consumers were prepared earlier, then CI/repo hardening, then the parked bot)

**Tiers used:** P1 = MEDIUM with an active path (003, 004, 005) · P2 = MEDIUM privacy drift (001, 002, 006, 007, 008, 009) and LOW/INTERNET-UNAUTH with a concrete abuse path (014, 016, 024) · P3 = everything else.

**Cross-unit findings** sit in exactly one sprint (their anchor) and carry per-unit rows elsewhere labelled `(part)`; the finding closes when every part has landed:

| ID | Anchor sprint | Parts in |
|---|---|---|
| FINDING-010 | S9 worker-kit (default flip) | S1 presets-api, S2 oauth, S5 api-worker (drop `logUserAgent: true`) |
| FINDING-011 | S4 moderation-worker | S1 presets-api, S3 discord-worker |
| FINDING-012 | S9 worker-kit | S2 oauth, S4 moderation-worker |
| FINDING-013 | S1 presets-api | S2 oauth, S4 moderation-worker |
| FINDING-015 | S11 auth (v1 export removal, MAJOR) | S1 presets-api (stop accepting v1, nonce cache), S3 discord-worker + S4 moderation-worker (stop sending v1) |
| FINDING-023 | S8 image-worker | S1 presets-api, S2 oauth, S4 moderation-worker |
| FINDING-002 | S2 oauth | S6 web-app (sign-in copy) |
| FINDING-006 | S1 presets-api | S6 web-app (PRIVACY.md paragraph) |

## Sprint 0 — Emergency & prerequisites
Nothing is exploitable now — no finding ships out-of-band. Two prerequisites, no code deploy:

| ID | Source | Tier | Action |
|---|---|---|---|
| FINDING-030 | security | P3 / LOCAL · ROTATE (conditional) | Cloudflare dashboard: inspect the live CI token's scopes; if it carries KV/D1/R2 Edit, re-issue with **Workers Scripts: Edit, Workers Routes: Edit, Pages: Edit** (this account only), update the GitHub secret, re-run one deploy via `workflow_dispatch`, revoke the old token. Then fix `docs/operations/SECRET_ROTATION.md:66,151` and tick `POST_MERGE_CHECKLIST.md:334-335`. |
| — | guardrail | — | **Do not enable Workers Logs / Logpush / tail consumers on any script** until Sprints 1–5 and 9 close (FINDING-010/011) — `evidence/workers-log-retention.md`. |

**Ends with:** the token re-issued (or confirmed already narrow) + the runbook commit. No deploy.

## Sprint 1 — presets-api: moderation queue integrity + privacy hygiene (P1) ✅ COMPLETED 2026-08-30 (commits `bd3cc35d..1e80ebff`, 10 commits, presets-api 2.2.0; six reviewed tasks + one whole-branch review with a single fix wave)
**Deploy needs:** hand-run migration `0012_submission_events_text_edit.sql` (see *Ends with*); merge to `main` = production deploy. Ledger of rulings and deferred minors: `.superpowers/sdd/REMEDIATION_PLAN/progress.md` (git-ignored; the rulings are also listed in the sprint's closing report).
**Follow-ups surfaced by the reviews (not scheduled here):** post-edit client messaging should branch on `preset.status`, not the optional `moderation_status` (Sprints 3, 6); forward a moderation reason so moderators can tell an outage from a flag (Sprint 3); the web privacy guide needs the same two retention rows the bot policy got (fold into Sprint 6 / FINDING-006); `verifyBotSignatureV2` should reject an absent/malformed nonce itself (Sprint 11); `@xivdyetools/types` `CommunityPreset.author_discord_id` still required (Sprint 6 / types); `packages/test-utils/integration/**` still simulates v1 acceptance (Sprint 11); a presets-api dead-code pass (`notifyModerators`, `requireNotBannedCheck`); after-merge minors from the ledger (description-only `textChanged` test, 429-envelope helper, ownership predicate helper, `no-console` selector for `(logger ?? console)`, wrangler `[[routes]]` form, INSERT-failure catch test, prune log levels).
Anchor: FINDING-004/005 (any logged-in user can spam the moderation channel and, under Perspective back-pressure, publish unmoderated text). Everything else in this unit rides along so one deploy closes it.

| ID | Source | Sev / Exposure | Item |
|---|---|---|---|
| FINDING-004 | security | MED / INTERNET-AUTH | `handlers/presets.ts:482-483,591-609`: notify only when `flaggedByThisEdit` or name/description changed while `pending`; never lift `rejected` → `pending` on an owner edit (explicit resubmit counted against the flagged-edit cap); test with pending/rejected fixtures. |
| FINDING-005 | security | MED / INTERNET-AUTH | `services/moderation-service.ts:240-280,312-316`: Perspective error/429/timeout → `moderationStatus = 'pending'` for name/description changes (fail closed into the queue); key via `x-goog-api-key`; per-user pre-moderation edit cap before the call; record the decision in `docs/architecture/security-trade-offs.md`. |
| FINDING-006 | security | MED / INTERNET-AUTH | `moderation-service.ts:221-237`: add `doNotStore: true` to the Perspective body (+ test). Docs half → S6. |
| FINDING-016 | security | LOW / INTERNET-UNAUTH | `services/preset-service.ts:106` + list/featured/detail handlers: strip `author_discord_id` for anonymous callers, add `is_owner` for the authenticated caller; keep the id on bot/moderator routes; update `docs/api` contract. |
| FINDING-017 | security | LOW / INTERNET-AUTH | Dead-letter rows store `preset_id` not the payload; prune resolved rows + `submission_events` older than N days on write (or a `scheduled` handler); retention row in the bot policy. |
| FINDING-013 (part) | security | LOW / INTERNET-UNAUTH | `utils/env-validation.ts`: require `JWT_SECRET`, `JWT_ISSUER`, `TOKEN_BLACKLIST`, `RL_PUBLIC` in production (fail every request, BUG-017 pattern). |
| FINDING-015 (part) | security | LOW / INTERNAL | `middleware/auth.ts:228-239`: require `X-Request-Signature-V2` (401 without it — both bots already send it); add a 120 s nonce cache (KV `TOKEN_BLACKLIST`-style namespace or memory) rejecting reuse; keep `auth-v2.test.ts:106` inverted (v1-only must fail). |
| FINDING-010 (part) | security | LOW / INTERNET-UNAUTH | `src/index.ts:49-53`: drop `logUserAgent: true`. |
| FINDING-011 (part) | security | LOW / INTERNET-AUTH | `handlers/presets.ts:605,789` + the other `console.*` sites → worker-kit logger; log ids, never preset names. |
| FINDING-023 (part) | security | LOW / LOCAL | `tests/wrangler-config.test.ts`: `workers_dev = false`, prod `TOKEN_BLACKLIST` id = oauth's, `RL_PUBLIC` present, `JWT_ISSUER` = auth host. |

**Ends with:** `pnpm turbo run build type-check lint test --filter=xivdyetools-presets-api` → **apply migration `apps/presets-api/migrations/0012_submission_events_text_edit.sql` by hand** (`wrangler d1 execute xivdyetools-presets --remote --file=…` from `apps/presets-api`; verify `SELECT COUNT(*) FROM submission_events` before/after — it rebuilds the table to admit the new `text_edit` kind) → merge to `main` → `deploy-presets-api.yml` (`deploy:production`). Applying 0012 right after the deploy is also safe: until it lands the new text-edit cap is inert (the insert fails its CHECK and is caught) and nothing else depends on it. *(Corrected 2026-08-30 — the original "No D1 migration in this sprint" was wrong: `submission_events.kind` carries a CHECK constraint, discovered in Task 2.)*

## Sprint 2 — oauth: token lifetime + identity minimisation (P1/P2)
Anchor: FINDING-003 (no client uses `/auth/refresh`). FINDING-001/002 remove data the worker has no reason to hold. **Bare `wrangler deploy` is production on this worker.**

| ID | Source | Sev / Exposure | Item |
|---|---|---|---|
| FINDING-003 | security | MED / INTERNET-AUTH | Delete `handlers/refresh.ts` + its route/tests (`REFRESH_GRACE_SECONDS` stays as the revocation-TTL constant); update `docs/api`/README; keep `revokeToken` TTL ≥ exp + grace. |
| FINDING-001 | security | MED / INTERNET-AUTH | `handlers/xivauth.ts:345-355`: stop calling `storeCharacters`; delete `storeCharacters`/`getCharacters`; migration `DROP TABLE xivauth_characters` (user-run on `xivdyetools-users`, **after** the deploy that stops writing). |
| FINDING-002 | security | MED / INTERNET-AUTH | Drop `avatar_url` from `findOrCreateUser` writes (responses already recompute it) and `xivauth_id` + unverified `primary_character` from JWT claims; create the `users` row lazily on first submission/vote **or** document the sign-in record + a deletion route (web guide, S6). Copy fix → S6. |
| FINDING-022 | security | LOW / INTERNET-AUTH | `src/index.ts:134-145`: `Cache-Control: no-store` + `Pragma: no-cache` on `/auth/*`. |
| FINDING-013 (part) | security | LOW / INTERNET-UNAUTH | `utils/env-validation.ts`: require `RL_AUTH_10/20/30` and `TOKEN_BLACKLIST` in production. |
| FINDING-012 (part) | security | LOW / INTERNET-UNAUTH | `services/rate-limit.ts:95-98,140-145`: pass the request logger, surface `backendError` (header + warn); throwing-binding test. |
| FINDING-010 (part) | security | LOW / INTERNET-UNAUTH | `src/index.ts:37-40`: drop `logUserAgent: true`. |
| FINDING-023 (part) | security | LOW / LOCAL | `tests/wrangler-config.test.ts`: no `[env.preview]`, top-level `ENVIRONMENT = "production"`, three `[[ratelimits]]`, dev ids ≠ prod, `TOKEN_BLACKLIST` id = presets-api prod. |

**Ends with:** `pnpm turbo run build type-check lint test --filter=xivdyetools-oauth-worker` → merge to `main` → `deploy-oauth.yml` (bare `wrangler deploy` = production) → then `wrangler d1 execute xivdyetools-users --remote --file=<migration>` by hand (drop the roster table).

## Sprint 3 — discord-worker: policy truth + input bounds (P2)
Anchor: FINDING-007/008 (the bot's own policy is wrong about where and what it stores). Recommendation for 007: move to the native binding like the other four workers rather than disclosing Upstash.

| ID | Source | Sev / Exposure | Item |
|---|---|---|---|
| FINDING-007 | security | MED / INTERNET-AUTH | Add `[[ratelimits]]` bindings (both envs, unique `namespace_id`s ≥ 1041) + `CloudflareRateLimiter` in `services/rate-limiter.ts`; keep KV as the only fallback; after the deploy, `wrangler secret delete UPSTASH_REDIS_REST_URL/TOKEN --env production` and update `SECRET_ROTATION.md`; policy §2/§5 wording stays "Cloudflare" and becomes true. (Fallback option: disclose Upstash in §2/§5/§6.) |
| FINDING-008 | security | MED / INTERNET-AUTH | `src/index.ts:609-622`: `expirationTtl` on `firstrun:v5:*` (180 d) + test; `PRIVACY_POLICY.md`: list preset favourites, the first-run flag and the real preference fields; replace `/favorites` `/collection` `/match_image` with the live commands in §2/§7. |
| FINDING-019 | security | LOW / INTERNET-AUTH | `services/preferences.ts:374-380` + `schemas.ts:656-662` + `budget.ts:129-139`: `validateWorld` on set and read, `max_length: 32`; fix `budget.test.ts:145`. |
| FINDING-020 | security | LOW / INTERNET-AUTH | `src/index.ts:686` / `services/analytics.ts:256-263`: apply the configured `about`/`manual`/`changelog` tiers or make their tracking AE-only. |
| FINDING-021 | security | LOW / INTERNET-AUTH | `src/index.ts:481-535` + `services/announcements.ts`: pin repo `full_name`/`html_url` to constants, require `X-GitHub-Event: push`, remember the last announced version in KV and skip repeats; tests. |
| FINDING-011 (part) | security | LOW / INTERNET-AUTH | `budget.ts:247`, `services/preferences.ts:218-221`, `src/index.ts:308-312`: log lengths/ids, not values or names. |
| FINDING-015 (part) | security | LOW / INTERNAL | `services/preset-api.ts:147-160`: stop sending `X-Request-Signature` (v1); update `preset-api-v2.test.ts:59`. |

**Ends with:** `pnpm turbo run build type-check lint test --filter=xivdyetools-discord-worker` (+ `font-coverage.test.ts` untouched — no locale text changes) → merge to `main` → `deploy-discord-worker.yml` (`deploy:production`, register-commands in CI) → secret deletion by hand.

## Sprint 4 — moderation-worker: logging + accountability (P3)
Anchor: FINDING-011 (ban log line) and FINDING-018 (the one migration in the plan — `moderation_log.preset_id` nullable, user-run on the shared presets D1 **before** the deploy).

| ID | Source | Sev / Exposure | Item |
|---|---|---|---|
| FINDING-018 | security | LOW / INTERNET-AUTH | Migration `moderation_log.preset_id NULL` (+ `target_discord_id`), applied by hand per runbook; `services/ban-service.ts` writes a row for ban/unban/hide/restore (through presets-api's service or directly — same D1); tests. |
| FINDING-011 | security | LOW / INTERNET-AUTH | `handlers/modals/ban-reason.ts:169-175`: drop `targetUsername` and `reason` from the log context (ids + counts only). |
| FINDING-012 (part) | security | LOW / INTERNET-UNAUTH | `middleware/rate-limit.ts:147-150,188-193`: pass the logger, surface `backendError`; throwing-binding test. |
| FINDING-013 (part) | security | LOW / INTERNET-UNAUTH | `utils/env-validation.ts:110-123`: require `RL_COMMAND` / `RL_AUTOCOMPLETE` in production. |
| FINDING-015 (part) | security | LOW / INTERNAL | `services/preset-api.ts:146-159`: stop sending v1. |
| FINDING-023 (part) | security | LOW / LOCAL | `tests/wrangler-config.test.ts`: `workers_dev = false` both envs, two `[[ratelimits]]`, prod KV/D1 ids as expected. |

**Ends with:** migration applied by hand → `pnpm turbo run build type-check lint test --filter=xivdyetools-moderation-worker` → merge to `main` → `deploy-moderation-worker.yml` (`deploy:production`).

## Sprint 5 — api-worker: telemetry sink hardening (P2)
Anchor: FINDING-014. The datapoint schema is a positive control — do not touch the columns.

| ID | Source | Sev / Exposure | Item |
|---|---|---|---|
| FINDING-014 | security | LOW / INTERNET-UNAUTH | `telemetry/router.ts`: require `Origin ∈ {https://xivdyetools.app, https://beta.xivdyetools.app}` (403 otherwise) and derive `env` from it (drop the client field or ignore it); drop batches carrying `Sec-GPC: 1` (204, no write); `middleware/rate-limit.ts:110-115,140`: `failOpen: false` / `onError: 'fail-closed'` for the telemetry bucket only; tests + `e2e/telemetry.spec.ts` still green (sendBeacon sends Origin). |
| FINDING-010 (part) | security | LOW / INTERNET-UNAUTH | `src/index.ts:66-73`: drop `logUserAgent: true`; fix `CHANGELOG.md:16` wording if it overstates. |

**Ends with:** `pnpm turbo run build type-check lint test --filter=xivdyetools-api-worker` → merge to `main` → `deploy-api-worker.yml` (`deploy:production`).

## Sprint 6 — web-app: keep the privacy guide true (P2)
Anchor: FINDING-009. Also carries the documentation halves of 002 and 006 because `apps/web-app/PRIVACY.md` is this unit's file. Six-locale copy change → i18n parity/order gates.

| ID | Source | Sev / Exposure | Item |
|---|---|---|---|
| FINDING-009 | security | MED / LOCAL | `components/extractor-tool.ts:437-447,1562-1565`, `image-upload-display.ts:488-491`: remove the IndexedDB persistence (recommended) **or** gate it behind an explicit "remember last image" setting and clear it on Reset settings (`advanced-options-panel.ts:249-254`), logout and "clear image"; update `PRIVACY.md` "Images" + on-device list; tests. |
| FINDING-026 | security | LOW / INTERNET-UNAUTH | `src/index.html:67-68`: delete the universalis.app hints; `public/_headers:25`: drop it from production `connect-src`; tighten `security-headers.test.ts:100-102`. |
| FINDING-027 | security | LOW / INTERNET-UNAUTH | `functions/_middleware.ts`: for `/assets/*`, if the upstream response is `text/html` return 404 with `Cache-Control: no-store`; Playwright/unit check. |
| FINDING-002 (part) | security | MED / INTERNET-AUTH | `locales/*.json` sign-in copy (`en.json:1072`): say what is actually stored/minted; `PRIVACY.md` "Community presets": sign-in record + deletion route (or the lazy-row behaviour from S2). |
| FINDING-006 (part) | security | MED / INTERNET-AUTH | `PRIVACY.md` "Network access": Google Perspective receives preset name + description for moderation, not stored (`doNotStore`). |

**Ends with:** `pnpm --filter xivdyetools-web-app run lint && test && type-check && build:check` (+ `i18n:parity`) → merge to `main` → `deploy-web-app.yml` (beta via `deploy-web-app-beta.yml` on the branch first).

## Sprint 7 — og-worker: bounded renders (P2)
| ID | Source | Sev / Exposure | Item |
|---|---|---|---|
| FINDING-024 | security | LOW / INTERNET-UNAUTH | `src/index.ts:182`: build the cache key from the validated params only (tool, colours, `lang`, `frame`, `algo`) and 404 unknown query keys **or** add `[[ratelimits]]` on `/og/*` (both envs); tick the OG-4 WAF rule in `POST_MERGE_CHECKLIST.md:342` (dashboard action) — `og-guards` tests. |

**Ends with:** `pnpm turbo run build type-check lint test --filter=xivdyetools-og-worker` → merge to `main` → `deploy-og-worker.yml` (`deploy:production`; bare deploy = live beta).

## Sprint 8 — image-worker: private-only invariant (P3)
| ID | Source | Sev / Exposure | Item |
|---|---|---|---|
| FINDING-023 | security | LOW / LOCAL | `tests/wrangler-config.test.ts`: no `routes`, `workers_dev = false` in both envs, no `preview_urls`; optional `X-Internal-Caller` shared-header check as defence in depth (both callers are service bindings — coordinate with S1/S3 if added). Anchor for the four-worker test set. |

**Ends with:** `pnpm turbo run build type-check lint test --filter=xivdyetools-image-worker` → merge to `main` → `deploy-image-worker.yml`.

## Sprint 9 — @xivdyetools/worker-kit: safe defaults (P3, publish)
Consumers already removed their opt-ins in S1/S2/S5 and pass loggers in S2/S4; this sprint makes the package safe for everyone else.

| ID | Source | Sev / Exposure | Item |
|---|---|---|---|
| FINDING-010 | security | LOW / INTERNET-UNAUTH | `middleware/logger.ts:141-145`: default `logUserAgent` to `false` (document the change); `middleware/rate-limit.ts:142-150,175-184` + backends: log the key's scope/prefix, never the value. |
| FINDING-012 | security | LOW / INTERNET-UNAUTH | `rate-limiter/backends/cloudflare.ts:108-117,159-175`: `console.warn` fallback when no logger is supplied; validate the binding in the constructor; expose `backendError` consistently; throwing-binding tests. |

**Ends with:** `pnpm turbo run build type-check lint test --filter=@xivdyetools/worker-kit` (+ dependents) → bump `1.1.0 → 1.2.0` (MINOR: default change + additive API) + CHANGELOG → merge → Actions "Publish Packages to npm" (`@xivdyetools/worker-kit`). Apps consume `workspace:*` and pick it up on their next deploy.

## Sprint 10 — @xivdyetools/logger: redaction coverage (P3, publish)
| ID | Source | Sev / Exposure | Item |
|---|---|---|---|
| FINDING-025 | security | LOW / INTERNET-UNAUTH | `core/base-logger.ts:242-248,143-193`: value-shape scan over string array items and over `message` / `error.message`; three new `hardening.test.ts` cases. |

**Ends with:** logger gates → bump `2.1.0 → 2.1.1` (PATCH) → merge → Actions publish (`@xivdyetools/logger`).

## Sprint 11 — @xivdyetools/auth: finish the signature rollover (P3, MAJOR publish)
Terminal for FINDING-015: every consumer stopped using v1 in S1/S3/S4, so removing the export is safe in-repo; it is MAJOR for npm consumers.

| ID | Source | Sev / Exposure | Item |
|---|---|---|---|
| FINDING-015 | security | LOW / INTERNAL | `packages/auth/src/hmac.ts:237-277`: delete `createBotSignature`/`verifyBotSignature` (v1) and their tests; README/CHANGELOG "v2 only"; optional follow-up in the same release: sign the sorted query string as canonical v3 **only if** signer and verifier can move in lockstep (otherwise leave PKG-03 as INFO). |

**Ends with:** auth gates + `pnpm turbo run type-check --filter='./apps/*'` (no consumer still imports v1) → bump `1.4.0 → 2.0.0` (MAJOR: public export removal) → merge → Actions publish (`@xivdyetools/auth`).

## Sprint 12 — CI / repo hardening (P3)
| ID | Source | Sev / Exposure | Item |
|---|---|---|---|
| FINDING-028 | security | LOW / LOCAL | GitHub: create environment `beta` with its own Cloudflare token (separate, narrow); `deploy-*-beta.yml`: `environment: beta` + `secrets.CLOUDFLARE_API_TOKEN_BETA`; the production token lives only in `production`; document in `DEPLOY_ENVIRONMENTS.md` + `SECRET_ROTATION.md`. |
| FINDING-029 | security | LOW / LOCAL | `.gitleaks.toml`: replace directory allowlists with `*.test.ts` / `*.spec.ts` / `__tests__/` + named fixture files; value-anchored regexes instead of line-level var names; re-run `evidence/scripts/05-gitleaks.sh` (tree + history) and triage; enable GitHub secret scanning + push protection (`POST_MERGE_CHECKLIST.md:329`). |

**Ends with:** CI green on the PR (`secret-scan` with the new config, `gitleaks git .` clean locally) → merge to `main`; one beta deploy succeeds with the new environment/token.

## Sprint 13 — stoat-worker (P3, parked)
| ID | Source | Sev / Exposure | Item |
|---|---|---|---|
| FINDING-031 | security | LOW / LOCAL | `src/message-handler.ts:56,60-64`: log the command name only; `index.ts:17`: `createLibraryLogger(…, { level: 'info' })`; tests. |

**Ends with:** `pnpm turbo run build type-check lint test --filter=xivdyetools-stoat-worker` → merge (no deploy — the bot is parked).

## Superseded findings
| ID | Superseded by | Why |
|---|---|---|
| — | — | none (the five carried residuals from 2026-08-21 already have new IDs: 003, 015, 018, 019, 024) |

## KEEP register
| ID | Item | Reason | Revisit trigger |
|---|---|---|---|
| — | — | security findings are never KEEP; the 36 INFO items are unscheduled by design | next whole-monorepo audit |

## Standing guidance
- Verify each finding's evidence against the code before fixing — findings are leads (`file:line` in `findings/` and `evidence/review-*.md`).
- One commit per row (or per sprint when tiny); the standing verification gate at every sprint boundary (`release-mechanics.md`); stage only your own paths; update the finding's `## Status` and the report's status table in the same commit.
- FINDING-030 stays open until the token is re-issued or confirmed narrow, whatever the docs say. No other finding needs rotation.
- Never enable Workers Logs / Logpush before S1–S5 + S9 land (FINDING-010/011); when enabling, verify the redaction on a sampled request first.
- Re-run `evidence/scripts/*.sh` after S12 (gitleaks config change) and after the last sprint; a change to any datapoint blob, KV prefix, D1 column or outbound host needs a privacy-doc diff in the same PR.
- Annotate executed sprints in the heading: **✅ COMPLETED <date> <commits>** + **Deploy needs:** — the plan doubles as the tracker.
