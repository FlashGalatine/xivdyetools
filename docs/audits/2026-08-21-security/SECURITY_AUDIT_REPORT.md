# Security Audit Report — xivdyetools monorepo

## Executive Summary
- **Project:** `xivdyetools` monorepo (9 apps, 8 packages) — branch `monorepo-2.0-prep` @ `08a8f522`
- **Audit date:** 2026-08-21
- **Auditor:** Claude Code (Fable 5) — automated scans + 9 parallel manual reviewers, every promoted finding re-verified at the cited lines by the coordinator
- **Overall risk level:** **MEDIUM**

No critical issues and no remotely exploitable authentication bypass, injection, or SSRF were found. The codebase shows mature controls (see *Positive controls*). The one **HIGH** finding is a session-revocation bypass in the OAuth worker: because the KV blacklist expires at the token's `exp` while `/auth/refresh` honours tokens for 24 h *after* `exp`, a leaked or logged-out token can be re-minted for up to 30 days and the victim cannot stop it. The MEDIUM tier is dominated by abuse/availability controls that do not actually bind (a KV-backed rate limiter that cannot throttle a fast client, image decoding with no dimension gate, a cubic-time text-wrap on an unbounded OG parameter, resettable preset quotas), two moderation-bot gaps (unauthenticated autocomplete over production D1; a `custom_id` overflow that makes long-named users un-bannable), and CI/ops hardening (mutable action tags, stale rotation runbook that would rotate the wrong worker).

Scope, method and versions: [`AUDIT_MANIFEST.md`](AUDIT_MANIFEST.md). Per-unit reviewer reports with route tables, authorization matrices, positive controls, rejected suspicions and file-coverage lists: [`evidence/review-*.md`](evidence/).

## Findings Summary

| Severity | Count | IDs |
|----------|-------|-----|
| Critical | 0 | — |
| High | 1 | 001 |
| Medium | 9 | 002–010 |
| Low | 26 | 011–036 |
| Informational | ≈70 | catalogued in `evidence/review-*.md` (see table below) |

## Critical Findings (Immediate Action Required)
None.

## High
| ID | Title | Unit |
|---|---|---|
| [FINDING-001](findings/FINDING-001.md) | Token revocation bypassable through `/auth/refresh` 24 h grace window — leaked/logged-out token re-mintable for up to 30 days | oauth, packages/auth |

## Medium
| ID | Title | Unit |
|---|---|---|
| [FINDING-002](findings/FINDING-002.md) | presets-api never consults the JWT revocation list — logout does not end API access (docs claim otherwise) | presets-api, oauth |
| [FINDING-003](findings/FINDING-003.md) | KV-backed rate limiter cannot throttle a fast client (1 write/s/key) and fails open — api-worker `/v1/*`, oauth, moderation-worker | worker-kit + consumers |
| [FINDING-004](findings/FINDING-004.md) | image-worker decodes untrusted images with no dimension/pixel gate (decompression bomb → isolate OOM); caps applied after buffering | image-worker, presets-api |
| [FINDING-005](findings/FINDING-005.md) | og-worker CPU exhaustion via unbounded `:color` (O(L³) wrap); `/og/*` never edge-cached | og-worker |
| [FINDING-006](findings/FINDING-006.md) | moderation-worker autocomplete queries production D1 with no moderator check — banned-user list / author IDs | moderation-worker |
| [FINDING-007](findings/FINDING-007.md) | Ban flow fails for long display names (`custom_id` > 100) — only ban path; abusers can self-exempt | moderation-worker |
| [FINDING-008](findings/FINDING-008.md) | presets-api abuse limits resettable/incomplete (daily cap counts surviving rows; flagged edits & uploads unlimited) | presets-api |
| [FINDING-009](findings/FINDING-009.md) | CI/CD hardening: mutable action tags (incl. wrangler-action holding the CF token), no `permissions:` blocks, job-level secret env, prod deploy dispatchable from any ref | .github/workflows |
| [FINDING-010](findings/FINDING-010.md) | Secret-rotation runbook stale — bare `wrangler secret put` rotates the dev worker on 3 apps; 14/24 secrets uncovered | docs/operations |

## Low
| ID | Title |
|---|---|
| [FINDING-011](findings/FINDING-011.md) | Web-app `innerHTML` strings with unescaped remote/user text (My Submissions modal, dye-search empty state) |
| [FINDING-012](findings/FINDING-012.md) | OAuth flow hardening: origin-only `redirect_uri`, unbounded `return_path`/`state`, PKCE verifier not bound server-side |
| [FINDING-013](findings/FINDING-013.md) | XIVAuth linking: unverified character names as usernames, IdP-trusted account merge, PII in logs |
| [FINDING-014](findings/FINDING-014.md) | Bot→API HMAC binds only `ts:id:name`; delimiter ambiguity; replay window |
| [FINDING-015](findings/FINDING-015.md) | `verifyJWT` claim-type laxity; no `nbf`/`iat`/`iss`/`aud` |
| [FINDING-016](findings/FINDING-016.md) | presets-api visibility/vote gating gaps (duplicate returns pending row; votes on non-approved; 403/404 oracle) |
| [FINDING-017](findings/FINDING-017.md) | presets-api ban check fails open; not applied to several mutating routes; per-identity bans |
| [FINDING-018](findings/FINDING-018.md) | Rejected preview images stay cached `immutable` for a year |
| [FINDING-019](findings/FINDING-019.md) | User strings rendered into Discord embeds without markdown/mention sanitisation; no `allowed_mentions` |
| [FINDING-020](findings/FINDING-020.md) | IDs interpolated unencoded into outbound URL paths |
| [FINDING-021](findings/FINDING-021.md) | No freshness window on Discord interaction timestamps (replay) |
| [FINDING-022](findings/FINDING-022.md) | Analytics stores guild IDs contrary to the privacy policy |
| [FINDING-023](findings/FINDING-023.md) | Deployed bots link to non-resolving `xivdyetools.com` / `docs.xivdyetools.com` |
| [FINDING-024](findings/FINDING-024.md) | og-worker crawler HTML: param echo into OG tags; missing security headers; no `Vary` |
| [FINDING-025](findings/FINDING-025.md) | api-worker: body buffered before cap; icon cache aliasing; truncated batches cached; dev worker on workers.dev with stack traces |
| [FINDING-026](findings/FINDING-026.md) | Logger: cycle/BigInt crash in `write()`, redaction gaps, raw stack re-attach |
| [FINDING-027](findings/FINDING-027.md) | Prototype-chain lookups on untrusted keys (`.chara` parser, icons, stoat parser) |
| [FINDING-028](findings/FINDING-028.md) | SVG `escapeXml` passes XML-illegal chars (card render failure); unescaped hex in `fill` |
| [FINDING-029](findings/FINDING-029.md) | oauth `[env.preview]` binds production D1/KV behind a stale frontend; dev D1 TODO |
| [FINDING-030](findings/FINDING-030.md) | Repo hygiene: `.dev.vars.<env>` not ignored; revoked secret in committed audit doc; no CI secret scanning |
| [FINDING-031](findings/FINDING-031.md) | Web-app headers: unused `*.workers.dev` wildcard, no `object-src`, deprecated `X-XSS-Protection`, camera policy mismatch |
| [FINDING-032](findings/FINDING-032.md) | Web-app OAuth client: unvalidated `?provider=`; DOM-clobberable `window.PRESET_API_URL` |
| [FINDING-033](findings/FINDING-033.md) | discord-worker: `/swatch` fetch w/o timeout, `/stats` exempt from limiter, `/budget` world override unvalidated |
| [FINDING-034](findings/FINDING-034.md) | moderation-worker hygiene: direct D1 writes bypass invariants; modal ID validation; raw errors to channel |
| [FINDING-035](findings/FINDING-035.md) | stoat-worker (parked): no rate limiting, bot-loop, raw echo |
| [FINDING-036](findings/FINDING-036.md) | Dependency advisories — 5 open, all dev-only (vitepress→vite 5.4.21, tsup→esbuild 0.27.3) |

## Informational items (not promoted to findings)
Best-practice notes and hygiene nits, each documented with file:line in the reviewer reports:

| Unit | IDs | Report |
|---|---|---|
| oauth | OAUTH-10..18 (no `aud`/`iss`; `JWT_SECRET` reused for state HMAC; state not single-use; no `no-store` on token responses; body-limit via Content-Length; `credentials:true`; secret-length check counts chars) | `evidence/review-oauth.md` |
| presets-api | PAPI-11..18 (403/404 oracle; TOCTOU on status writes; missing `moderation_log` rows; `author_discord_id` public; `/` leaks environment; dead `MODERATION_WEBHOOK_URL`/`OWNER_DISCORD_ID`; Perspective key in query + fails open; `page` unbounded; dev env binds prod D1/R2) | `evidence/review-presets-api.md` |
| discord-worker | DW-10..21 (no `allowed_mentions`; webhook changelog URL from `repository.full_name`; Content-Length-only size check; beta worker shares prod bindings; fail-open limiter; `firstrun` KV no TTL; IDs in info logs; `steps` unclamped) | `evidence/review-discord-worker.md` |
| moderation-worker | MOD-9..16 (KV shared with discord-worker prod; no timestamp freshness; HMAC scope; buttons unlimited; moderator allowlist cached per isolate; `MODERATION_BOT_TOKEN` also held by discord-worker) | `evidence/review-moderation-worker.md` |
| api-worker | API-8..14 (upstream errors echoed; no fetch timeout; docs assets bypass header middleware; dead `ALLOWED_ORIGINS`/`X-API-Key`; icon proxy content-type; unbounded `q`/`page`; IP/UA in logs) | `evidence/review-api-worker.md` |
| og-/image-worker | OG-6..9, IMG-4..5 (unencoded values in `og:url`; raw UA logged; 400 bodies echo params; photon panic state; `normalizedUrl` keeps userinfo) | `evidence/review-og-image-workers.md` |
| web-app | WEB-6..15 (loose import validation; dead inline `onclick` in fatal fallback; sourcemaps shipped; no size cap on drop/paste; server-trusted `exampleLink`; JWT-in-localStorage trade-off documented with mitigations) | `evidence/review-web-app.md` |
| packages | PKG-10..18 (memory limiter eviction; Upstash INCR/EXPIRE non-atomic; APIService size cap after read; chara lanes uncapped; `AppError.toJSON` serialises stack; test-utils non-constant-time verifier dev-only) | `evidence/review-packages.md` |
| infra | INF-11..16 (`${{ }}` in `run:` with constrained sources; unneeded `workers_dev` hosts; dev envs bound to prod; `[vars]` hold only public IDs; sourcemaps; no `timeout-minutes`/SECURITY.md/CODEOWNERS) | `evidence/review-infra-stoat.md` |

## Reviewed and rejected (documented in the evidence reports)
SQL injection (all D1 access parameterised, LIKE escaped); SSRF (image-worker exact Discord-CDN allowlist with one-hop validated redirects; api-worker/og-worker build upstream URLs from validated segments; Discord attachment URLs come from `resolved.attachments`); reflected XSS in og-worker crawler HTML (all interpolations escaped); cross-guild moderator escalation (`MODERATOR_IDS` allowlist re-checked by presets-api behind HMAC); JWT `alg` confusion / `none`; open redirect in oauth (exact-origin allowlist shared by authorize/callback/CORS) and web-app (`sanitizeReturnPath`); secrets in repo/history (only a revoked value in an old audit doc); `Math.random` in security contexts (none); dangerous sinks with constant values (icon `innerHTML`/`unsafeHTML`).

## Positive controls (verified)
- Ed25519 verification over the raw body on every interaction route, fail-closed, 100 KB cap; bot→API bearer **plus** HMAC with 5-min window, mandatory in production; moderator allowlist enforced on every slash/button/modal path (except autocomplete, FINDING-006) and re-checked server-side.
- OAuth: PKCE S256, HMAC-signed 10-min state with constant-time verify, exact-origin allowlist, pinned token-exchange `redirect_uri`, HS256 pinned with ≥32-byte secret, fully parameterised D1 with atomic batches, strict CORS, sanitised errors, fail-closed production env validation, no secrets in config.
- Web app: strong CSP (`script-src 'self'`, no inline, `frame-ancestors 'none'`), HSTS preload, nosniff, Referrer-Policy; Lit text bindings for all remote strings except FINDING-011; `rel="noopener noreferrer"` everywhere; no third-party scripts/fonts/iframes; no service worker; PKCE/state fail-closed; URL scrubbed after callback.
- Supply chain: `minimumReleaseAge: 1440`, `allowBuilds` deny-all, security floors (`rollup`, `qs`, `seroval`), `--frozen-lockfile` everywhere, nightly `pnpm audit --prod --audit-level high`, OIDC trusted publishing with `--provenance`, packages set to 2FA/no-token.
- SVG text XML-escaped and rasterised to PNG; fonts bundled; image-worker has no public routes; presets-api CORS allowlist with origin callback; conditional status updates (`expectedStatus`) on key transitions; logger redaction of common key names; request-ID and IP helpers safe by default.

## Remediation Priority
1. **Now (one oauth + worker-kit release):** FINDING-001 (blacklist TTL ≥ exp + grace; shorten/remove refresh), FINDING-002 (decide enforce-vs-accept, fix docs), FINDING-015 (claim typing, `iss`).
2. **Next release per unit:** FINDING-003 (native Rate Limiting binding), FINDING-004 (header-based dimension gate), FINDING-005 (400 on non-hex + linear wrap + `caches.default`), FINDING-006/007 (moderation autocomplete auth; drop username from `custom_id`), FINDING-008 (append-only quota), FINDING-009/010 (SHA-pin, permissions, environment gate; rewrite rotation runbook — docs-only, can ship immediately).
3. **Batch of LOW hygiene:** shared Discord sanitiser + `allowed_mentions` (019), `escapeHtml` helper (011), HMAC canonicalisation (014), ban-check/vote gating (016/017), prototype-safe lookups (027), `escapeXml` control chars (028), `.gitignore`/secret scanning/redaction (030), headers (024/031), URL encoding (020), dangling `.com` links (023), privacy-policy alignment (022), remaining per-unit nits.
4. **Opportunistic:** dependency bumps (036), INFO items.

A sprint-sequenced plan can be generated with the `remediation-planner` skill from `findings/`.

## Recommendations (programme-level)
- Add a `SECURITY.md` (disclosure policy) and `CODEOWNERS`; enable GitHub secret scanning + push protection on the public repo.
- Make fail-closed the default for auth-adjacent controls (revocation check, ban check, rate limiter on token endpoints) and document every deliberate fail-open.
- Centralise input-boundary helpers in `@xivdyetools/bot-logic`/`worker-kit` (`escapeDiscordMarkdown`, `encodePathSegment`, `hasOwn` lookups, canonical HMAC) so each worker stops re-implementing them.
- Re-run this audit's automated scans (`pnpm audit`, secrets grep, dangerous-sink grep) in CI so regressions surface without a manual review.
