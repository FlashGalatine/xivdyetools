# Security Audit — xivdyetools monorepo (2026-08-29)
- **Branch/commit:** `security-audit-2026-08-29` @ `4c213248` (= `main`) · **Scope:** all — 9 apps, 8 packages, CI/wrangler/Pages config, supply chain, **personal-data reconciliation** of every datapoint / storage write / log line against the privacy promises · **Method:** automated evidence (`pnpm audit --prod` 0 advisories; gitleaks 8.30.1 tree + 866-commit history 0 leaks; secret-pattern grep 56 hits all fixtures; wrangler surface; PII sink/source inventory) → nine parallel per-unit reviewers (`evidence/review-*.md`, 660 files covered) → every candidate verified by the coordinator at `file:line` → 31 findings. Previous audit `2026-08-21-security`: all 36 fixes confirmed real, test-guarded and un-regressed; five residuals carried forward under new IDs.
- **Totals:** 31 findings — 0 CRITICAL · 0 HIGH · **9 MEDIUM** · **22 LOW** (+ 36 INFO items kept in the reviewer reports) · **Overall risk: MEDIUM** (was MEDIUM with 1 HIGH on 2026-08-21) · **Sprint 0 (act now): none** — nothing is exploitable without an account or a copied token; FINDING-004/005 lead the first sprint.

## Severity × exposure

| | INTERNET-UNAUTH | INTERNET-AUTH | INTERNAL | LOCAL | Total |
|---|---|---|---|---|---|
| CRITICAL / HIGH | 0 | 0 | 0 | 0 | 0 |
| MEDIUM | 0 | 8 | 0 | 1 | 9 |
| LOW | 9 | 7 | 1 | 5 | 22 |

Theme of this cycle: **the code has drifted from the written privacy promises** — 13 of the 31 findings (001, 002, 006, 007, 008, 009, 010, 011, 016, 017, 026, 031 + the disclosure half of 014) are data the project collects, stores, ships to a third party or logs without a purpose the policies state, or that a policy explicitly says it does not. None of them is a leak to an attacker; all of them are a promise the project is currently not keeping.

## Pending rotation

| ID | Credential | Rotated? | Revoked? |
|---|---|---|---|
| FINDING-030 | `CLOUDFLARE_API_TOKEN` (CI) — only if the live token carries KV/D1/R2 Edit; re-issue with Scripts/Routes/Pages Edit | no | no |

No finding leaked a secret; nothing else needs rotation.

## Catalog

| ID | Title | Sev | Exposure | Deploy unit | Rotation |
|---|---|---|---|---|---|
| [FINDING-001](findings/FINDING-001.md) | XIVAuth login persists the user's full character roster (names, worlds, Lodestone ids) — no reader, no retention, undisclosed | MED | INTERNET-AUTH | oauth | NONE |
| [FINDING-002](findings/FINDING-002.md) | Identity row (username, avatar) written on every sign-in, not on submission as the web guide says; unverified character name in the JWT vs "No character data" copy; no web deletion path | MED | INTERNET-AUTH | oauth (+web-app copy) | NONE |
| [FINDING-003](findings/FINDING-003.md) | `/auth/refresh` has no client yet keeps a stolen token re-mintable 30 d and escapes logout (2026-08-21/001 residual) | MED | INTERNET-AUTH | oauth | NONE |
| [FINDING-004](findings/FINDING-004.md) | Any edit to a non-approved preset re-queues it `pending` and fires an uncapped moderation notification; rejected → pending | MED | INTERNET-AUTH | presets-api | NONE |
| [FINDING-005](findings/FINDING-005.md) | Content moderation fails open on Perspective error/429, runs before the edit cap, one-word local fallback, key in query string | MED | INTERNET-AUTH | presets-api | NONE |
| [FINDING-006](findings/FINDING-006.md) | Preset text sent to Google Perspective without `doNotStore`; web guide ("complete list") never names Google | MED | INTERNET-AUTH | presets-api (+web-app docs) | NONE |
| [FINDING-007](findings/FINDING-007.md) | Bot rate-limit counters keyed by Discord id live in Upstash Redis; policy says KV, never names Upstash | MED | INTERNET-AUTH | discord-worker | NONE |
| [FINDING-008](findings/FINDING-008.md) | Bot policy drift: permanent `firstrun:v5:{userId}` flag + preset favourites undisclosed; access/deletion steps cite commands removed in 5.0 | MED | INTERNET-AUTH | discord-worker | NONE |
| [FINDING-009](findings/FINDING-009.md) | Uploaded / pasted / camera images persisted to IndexedDB and restored next visit; guide says discarded on reload; Reset/logout don't clear | MED | LOCAL | web-app | NONE |
| [FINDING-010](findings/FINDING-010.md) | User-Agent logged on every request (oauth, api-worker incl. `/v1/telemetry`, presets-api) + limiter key (IP) on errors; guide says UA never collected — not retained today | LOW | INTERNET-UNAUTH | worker-kit + oauth + api-worker + presets-api | NONE |
| [FINDING-011](findings/FINDING-011.md) | Display name + free-text ban reason, option values, preset names in log lines — not retained today | LOW | INTERNET-AUTH | moderation-worker + discord-worker + presets-api | NONE |
| [FINDING-012](findings/FINDING-012.md) | Native limiter fails open silently: no logger passed, `backendError` dropped, no throwing-binding test | LOW | INTERNET-UNAUTH | worker-kit + oauth + moderation-worker | NONE |
| [FINDING-013](findings/FINDING-013.md) | Production `validateEnv` doesn't require `TOKEN_BLACKLIST` / `JWT_ISSUER` / `JWT_SECRET` / `RL_*` — a dropped binding silently disables the 2026-08-21 fixes | LOW | INTERNET-UNAUTH | presets-api + oauth + moderation-worker | NONE |
| [FINDING-014](findings/FINDING-014.md) | `/v1/telemetry` accepts any Origin, trusts client `env`, ignores `Sec-GPC`, limiter fails open before ≤25 AE writes | LOW | INTERNET-UNAUTH | api-worker | NONE |
| [FINDING-015](findings/FINDING-015.md) | Bot signature rollover unfinished: v1 still sent + accepted after the gate; v2 nonce never replay-checked; query not signed (2026-08-21/014 residual) | LOW | INTERNAL | auth + presets-api + discord-worker + moderation-worker | NONE |
| [FINDING-016](findings/FINDING-016.md) | `author_discord_id` published on every anonymous preset response | LOW | INTERNET-UNAUTH | presets-api | NONE |
| [FINDING-017](findings/FINDING-017.md) | Dead-letter payloads + `submission_events` never pruned, survive owner delete, no retention row | LOW | INTERNET-AUTH | presets-api | NONE |
| [FINDING-018](findings/FINDING-018.md) | Ban/unban/hide/restore write no `moderation_log` rows (2026-08-21/034 carry-forward) | LOW | INTERNET-AUTH | presets-api + moderation-worker | NONE |
| [FINDING-019](findings/FINDING-019.md) | `/preferences set world:` unbounded and forwarded unvalidated to the proxy + cache key (2026-08-21/033 residual) | LOW | INTERNET-AUTH | discord-worker | NONE |
| [FINDING-020](findings/FINDING-020.md) | Limiter-exempt `/about` `/manual` `/changelog` still do 3 hot-key KV writes per call | LOW | INTERNET-AUTH | discord-worker | NONE |
| [FINDING-021](findings/FINDING-021.md) | GitHub webhook trusts `full_name`/`html_url`, no event allowlist, no delivery de-dup (double-posts) | LOW | INTERNET-AUTH (HMAC) | discord-worker | NONE |
| [FINDING-022](findings/FINDING-022.md) | No `Cache-Control: no-store` on token responses | LOW | INTERNET-AUTH | oauth | NONE |
| [FINDING-023](findings/FINDING-023.md) | No wrangler-config invariant test on oauth (bare deploy = prod), image-worker, moderation-worker, presets-api | LOW | LOCAL | oauth + image-worker + moderation-worker + presets-api | NONE |
| [FINDING-024](findings/FINDING-024.md) | `/og/*` cache key = full URL; junk params force unbounded resvg renders; WAF rule still unticked (2026-08-21/005 residual) | LOW | INTERNET-UNAUTH | og-worker | NONE |
| [FINDING-025](findings/FINDING-025.md) | Logger redaction skips string array items and `message`/`error.message` | LOW | INTERNET-UNAUTH | logger (package) | NONE |
| [FINDING-026](findings/FINDING-026.md) | `preconnect`/`dns-prefetch` to universalis.app on every load; prod never uses it; guide says first-party only | LOW | INTERNET-UNAUTH | web-app | NONE |
| [FINDING-027](findings/FINDING-027.md) | Pages SPA catch-all + `/assets/*` immutable → HTML cached under a `.js` URL for a year | LOW | INTERNET-UNAUTH | web-app | NONE |
| [FINDING-028](findings/FINDING-028.md) | Beta deploy workflows run on any branch push with the repo-scoped production Cloudflare token, no `environment:` | LOW | LOCAL | CI | NONE |
| [FINDING-029](findings/FINDING-029.md) | gitleaks allowlist exempts whole directories (49 non-test files) and any line naming a client-id var | LOW | LOCAL | repo / CI | NONE |
| [FINDING-030](findings/FINDING-030.md) | Rotation runbook prescribes KV/D1/R2 Edit for the CI token; deploys need Scripts/Routes/Pages only | LOW | LOCAL | CI / docs | ROTATE (conditional) |
| [FINDING-031](findings/FINDING-031.md) | stoat-worker logs user ULID + channel id + raw command text at `debug` (default level) — parked, P3 | LOW | LOCAL | stoat-worker | NONE |

## Informational items (not promoted — file:line in the reviewer reports)

| Unit | IDs | Report |
|---|---|---|
| oauth | OAUTH-09 (XIVAuth `refresh` scope requested, token discarded), OAUTH-10 (`credentials: true` vestigial), OAUTH-11 (unbounded `error_description` reflected to the SPA callback URL, only logged) | `evidence/review-oauth.md` |
| presets-api | PAPI-09 (`search`/`page` unbounded → REAL OFFSET 500), PAPI-11 (unchanged 08-21 INFO set: 403/404 oracle, status write spans the Perspective call, revert forces approved, `reason` unvalidated, `/` echoes env, dev worker binds prod D1/R2 with ban check failing open in development) | `evidence/review-presets-api.md` |
| discord-worker | DW-13 (webhook input nits), DW-14 (beta shares prod service bindings), DW-18 (ids in info logs), DW-19 (copy `custom_id`), DW-21 (`steps` unclamped) | `evidence/review-discord-worker.md` |
| moderation-worker | MOD-04 (no guard against banning a moderator/self; banned moderator keeps rights), MOD-06 (shared KV namespace — disjoint prefixes; dev block binds prod D1/KV) | `evidence/review-moderation-worker.md` |
| api-worker | API-04 (`/v1/telemetry/` trailing-slash shapes hit neither bucket), API-05 (`ver` prerelease suffix is the one free-form blob), API-06 (rate-limit docs still describe the KV limiter), API-07 (icon 404s never edge-cached) | `evidence/review-api-worker.md` |
| og-/image-worker | OG-02 (og AE dataset undisclosed but carries no personal data), IMG-02 (`/extract` `maxDimension` 4096 → ~64 MB response ceiling, no caller sends it) | `evidence/review-og-image-workers.md` |
| web-app | WEB-05 (`track()` props untyped client-side), WEB-06 (toggle copy omits theme/dwell/envelope), WEB-07 (nickname as *local* default palette name vs guide wording), WEB-08 (dead `window.Sentry` hook), WEB-09 (no COOP/CORP; localStorage-JWT trade-off not in the trade-offs doc) | `evidence/review-web-app.md` |
| packages | PKG-08 (ConsoleAdapter raw `JSON.stringify`, cyclic refs), PKG-09 (four `fill=` sites bypass `escapeXml` — DB-sourced hex), PKG-10 (`.chara` model carries raw `nickname`/`producer`, lanes uncapped — privacy enforced by producers), PKG-11 (08-21 INFO status table; memory limiter now fronts the public Universalis proxy) | `evidence/review-packages.md` |
| infra / stoat | INF-04 (`minimumReleaseAge` only at resolution; no Dependabot cooldown; `--audit-level high` passes moderate), INF-06 (residuals a–j: constrained `${{ }}` in `run:`, `persist-credentials` default, no CODEOWNERS, no publish concurrency, `**/*.md` Text rule breadth, discord beta preview URLs default), STOAT-02 (≤4 replies per `!xd info`, admin ULIDs logged on ready, unused Upstash env) | `evidence/review-infra-stoat.md` |

## Positive controls
- **All 36 findings of 2026-08-21 are really fixed**, each with a guarding test, none regressed (per-unit verification tables in `evidence/review-*.md`); only five residuals were carried forward as 003 / 015 / 018 / 019 / 024.
- **Web telemetry is privacy-clean where it matters:** every datapoint column is enum- or dye-DB-validated through a prototype-safe schema table, envelope `'invalid'`-not-reject, ≤ 25 events / 16 KB streamed cap, no IP/UA/request id/timestamp in any point; client default-off, GPC checked at send time, cross-tab opt-out drops the queue, no client identifier of any kind, endpoint fixed at build time, zero beacons when off (unit + Playwright).
- **Bot Tier A analytics reconcile field-for-field with policy §2** (enums/ids/numbers only, `guild|dm`, locale bucket, no option values, rate-limited rows AE-only, drain deadline writes `unknown` never the message); the og-worker datapoint carries no personal data.
- **`.chara` name privacy is type-enforced end to end** (bot-logic `Omit<'nickname'>` at resolve, svg 3.0.0 `title` + producer allowlist, no filename forwarded, web-app community name = typed draft only, 20 MB gate before parse, resolve body = model integers only).
- Discord bots: Ed25519 over the raw body with −300 s/+60 s freshness checked before the body is read, fail-closed; `MODERATOR_IDS` on every slash/autocomplete/button/modal path and re-checked by presets-api; sanitiser + `allowed_mentions` on every embed; `custom_id`s UUID/snowflake only; native `[[ratelimits]]` on moderation-worker.
- OAuth: PKCE + mandatory signed state (`400 Missing state`), exact-origin allowlist, HS256 pinned with ≥ 32-byte secret, `iss`, revocation TTL ≥ exp + grace, blacklist namespace shared with presets-api per environment, parameterised D1 batches, no secrets in `[vars]`, pathname-only logging, no cookies.
- presets-api: every D1 access `.prepare().bind()` with LIKE escaped, `canSeePreset` 404 rule + fail-closed ban check on every mutation, append-only quota events, 5 MB streamed `bodyLimit` + magic sniff before image-worker, server-generated R2 keys, purge fail-safe; 679 unit tests green.
- image-/og-worker: header-only dimension gate before decode in both decode paths, streamed 10 MB caps, exact Discord-CDN allowlist with one-hop `manual` redirect; `/og/*` length guards, linear wrap, `caches.default`, `escapeXml` incl. control chars, crawler CSP/nosniff/XFO, `logUserAgent: false`.
- Supply chain / CI: 0 advisories with `pnpm audit --prod` proven to cover the full production closure; gitleaks clean on tree + history; 15/15 workflows SHA-pinned with `permissions: contents: read` and `timeout-minutes`, `environment: production` on all 9 production deploys + publish + emoji sync, OIDC publish with no token anywhere, `minimumReleaseAge: 1440`, overrides honoured; `.dev.vars*` ignored; `[vars]` public-only; `workers_dev`/`preview_urls` off and test-guarded on api-worker + og-worker; rotation runbook matches the secret inventory name-for-name.
- Web app: CSP `script-src 'self'`, no third-party script/font/iframe, no service worker, all 29 `innerHTML` templates constant / `t()` / escaped, logout clears token + expiry + provider + session marker across tabs, beta `X-Robots-Tag` guarded.

## Rejected suspicions
- Merge-day identity backfill added identity columns to presets → no: only `author_discord_id` / `author_name`; the JWT `avatar` is never persisted.
- moderation-worker shares discord-worker's production KV → key prefixes are disjoint (`ratelimit:command|autocomplete:` vs `ratelimit:user:` / `prefs:v1:`), moderation uses the native limiter in production, only a legacy `i18n:user:` read remains (MOD-06 INFO).
- Root `pnpm audit --prod` under-covers workspace importers (27 packages looked low) → no: 27 = the full production closure from `pnpm -r ls --prod`, identical from any importer.
- CI script injection through `${{ }}` in `run:` → only repo-controlled sources (tag names, versions), no PR title/body/`head_ref`; no `pull_request_target`.
- image-worker dimension gate forgeable or chunk-bypassable → no: header gate + streamed cap + photon-level validation, tested in four files.
- og-worker `isOgImageHost` open redirect → target is the `APP_BASE_URL` constant; beta/prod hosts test-guarded.
- api-worker `.chara` resolve / icon proxy SSRF or XIVAPI query injection → env base + validated integers / allowlisted names only; `XIVAPI_VERSION` namespace env-only.
- Web telemetry datapoint carries IP / UA / request id / timestamp, or fires when off (Shift+T, pagehide, `fetch keepalive`) → no; fixed columns, all paths behind one gate (unit + e2e).
- v2 HMAC "verified when present, never falls back" → true (fallback only when the header is absent — filed as FINDING-015).
- `.chara` nickname reaches analytics / logs / cards / community names → no (type-enforced, tested at three layers).
- Universalis proxy per-IP memory limiter fail-open → accepted trade-off (cache-miss path only).
- gitleaks `discord-client-id` rule disabled hides secrets → no, the client-secret and api-token rules stay active (the directory/line allowlist is the issue — FINDING-029).
- SQL injection / open redirect / JWT `alg` confusion / secrets in repo or history → re-checked over the 153-commit delta; still none.

## Recommendations
- **Policy ↔ inventory gate:** keep a machine-readable inventory (KV prefixes, D1 tables/columns, AE blobs, third-party hosts) and a test that fails when code adds one the two privacy documents do not list — 13 of 31 findings would have been caught at PR time.
- Ship the four missing `wrangler-config.test.ts` files (FINDING-023) and the throwing-binding test per native limiter consumer (FINDING-012); require security bindings in production `validateEnv` (FINDING-013).
- **Workers Logs / Logpush / tail consumers stay off until this branch is merged AND all seven worker-kit consumers have redeployed** (api-worker, discord-worker, image-worker, moderation-worker, oauth, og-worker, presets-api; `stoat-worker` is parked and no longer depends on worker-kit — each of the seven deploy workflows filters on `packages/worker-kit/**`, so the merge redeploys them all).** The redaction that makes them safe (FINDING-010, worker-kit 1.2.0) exists only on this branch: production is still running code that logs the raw limiter key, so enabling log retention before the redeploy would retain exactly the client IPs this audit set out to remove. Once every worker is redeployed the condition is met (FINDING-011 closed in Sprint 4, FINDING-010 in Sprint 9) — then enable, and verify the redaction on a sampled request first (`evidence/workers-log-retention.md`).
- Turn the two `POST_MERGE_CHECKLIST` §3 rollover items (v1 signature, KV fallback) into scheduled sprints rather than checklist lines — one is already overdue (FINDING-015).
- Record the moderation fail-closed decision (FINDING-005) and the localStorage-JWT trade-off in `docs/architecture/security-trade-offs.md`.
- Separate `beta` GitHub environment + token (FINDING-028); GitHub secret scanning + push protection (FINDING-029); narrower CI token (FINDING-030).
- PR template line: "Adds a datapoint field / KV key / D1 column / outbound host? → privacy doc diff in this PR."

## Remediation status
| ID | Status | Commit |
|---|---|---|
| FINDING-004 | FIXED 2026-08-30 (Sprint 1, presets-api 2.2.0) | bd3cc35d, b207c4f9, 1e80ebff |
| FINDING-005 | FIXED 2026-08-30 — needs hand-run migration `0012` | e10d740e, 1e80ebff |
| FINDING-006 | FIXED 2026-08-30 (both halves: doNotStore + the guide names Perspective) | e10d740e, 114f6dde |
| FINDING-016 | FIXED 2026-08-30 | 896f3f7e |
| FINDING-017 | FIXED 2026-08-30 | 780cf992, 9eb84a4c |
| FINDING-015 | FIXED 2026-08-31 (all four units) — v1 refused, no longer sent, and the export removed in auth 2.0.0 (MAJOR) | 01ea3dec, 1a0cf89f, b5d4c53b, e003aaa8, 77e08c34, dc3b9405 |
| FINDING-010 | FIXED 2026-08-30 (all four units) — UA opt-ins gone; the limiter key is now logged as a non-identifying scope at all six sites | efd495a4, b14cade9, 81035796, 3f5dc8e2, e502384a, 2bf2a5cb |
| FINDING-011 | FIXED 2026-08-30 (all three units log ids/lengths only; seven legacy `customId` sites ledgered) | efd495a4, a3e8ee14, dfc6de47, b5d4c53b |
| FINDING-013 | FIXED 2026-08-30 (all four units fail closed in production when a security binding is missing) | efd495a4, a3e8ee14, b14cade9, 4d734c8c, fe86a881, b5d4c53b, c94bfa8f |
| FINDING-023 | FIXED 2026-08-30 — all four units carry a wrangler-config invariant test (image-worker also refuses a `*.workers.dev` hostname in code) | efd495a4, b14cade9, 519c80da, 96920c5a, 71181a8f |
| FINDING-003 | FIXED 2026-08-30 (Sprint 2, oauth 3.0.0) — `/auth/refresh` removed | 50c283b9 |
| FINDING-022 | FIXED 2026-08-30 — `no-store` on every dispatched response | 50c283b9 |
| FINDING-001 | CODE FIXED 2026-08-30 — OPEN until migration `0001` is hand-run after the 3.0.0 deploy | cdd53fbf |
| FINDING-002 | FIXED 2026-08-30 (claims trimmed; sign-in record disclosed + deletion route; dead readers gone — types field → Sprint 11) | cdd53fbf, 114f6dde |
| FINDING-012 | FIXED 2026-08-30 (all three units) — fail-open is never silent (console.warn fallback), the Cloudflare binding is validated at construction | b14cade9, b5d4c53b, 3f5dc8e2, 2bf2a5cb |
| FINDING-007 | FIXED 2026-08-30 (Sprint 3, discord-worker 5.1.0) — needs the post-deploy Upstash secret deletion | 6c14889f, d28f76a4, f5d5f596, 4d734c8c, fe86a881 |
| FINDING-008 | FIXED 2026-08-30 | 2041ac39, 886d46a1, f5d5f596, 1a0cf89f |
| FINDING-019 | FIXED 2026-08-30 | dfc6de47 |
| FINDING-020 | FIXED 2026-08-30 | 6c14889f, d28f76a4 |
| FINDING-021 | FIXED 2026-08-30 | fb3d4120, 6014be93 |
| FINDING-018 | FIXED 2026-08-30 (Sprint 4, moderation-worker 1.6.0) — needs hand-run migration `0013` BEFORE the merge | dfb49aa1, 034badcd |
| FINDING-014 | FIXED 2026-08-30 (Sprint 5, api-worker 0.10.0) | ca909247 |
| FINDING-009 | FIXED 2026-08-30 (Sprint 6, web-app: images session-only, stored blobs purged, e2e guard inverted) | 73fbf59f, c84d4263 |
| FINDING-026 | FIXED 2026-08-30 | 2ffe6d13 |
| FINDING-027 | FIXED 2026-08-30 | 2ffe6d13 |
| FINDING-024 | FIXED 2026-08-30 (Sprint 7, og-worker 2.4.0; query *and* path axes) — enumeration of distinct ids still costs a render, bounded by the WAF rule, which stays an unticked dashboard action | c6bd962b, 9b2f4ca3, e2bdeec6, e2e9ca6b, 636e42ec, ebdc49ed, e9b6f471 |
| FINDING-025 | FIXED 2026-08-31 (logger 2.1.1) — array items + free text scanned; three further leaks found in review (aliased references, a fail-open budget, DAG data loss) closed with it | 425cd1d0, 617c907e, b3800667, b1ec25aa |
| FINDING-028–031 | OPEN — Sprints 11–13 (030 = the Sprint 0 token check) | — |

## Next steps
Sprint plan: [`REMEDIATION_PLAN.md`](REMEDIATION_PLAN.md) (remediation-planner). Fixes start only after the confirmation gate (`conventions.md` §8): catalog + plan presented, Sprint 0 (none) and the rotation table (FINDING-030 conditional) acknowledged, explicit go-ahead received.
