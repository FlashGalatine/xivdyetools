# Security Audit Report — Pre-Release, Monorepo 2.0 / Web-App 5.0

## Executive Summary

- **Project:** xivdyetools (16 workspaces, 6 internet-facing Cloudflare Workers + 1 Pages app)
- **Audit Date:** 2026-08-09
- **Branch:** `monorepo-2.0-prep` @ `58dbe2f`
- **Overall Risk Level:** **LOW–MEDIUM**

**The hand-written security posture is strong.** Prior audits clearly landed: constant-time
secret comparison (`BUG-053`), HS256-pinned JWT verification, HMAC-signed bot auth with
timestamp windows, parameterised D1 access everywhere, LIKE-wildcard escaping, ban-bypass
prevention on `?status=hidden`, per-worker security headers, body-size and JSON-depth limits,
and IP rate limiting. **No hardcoded secrets, no SQL injection, no XSS sink, no `eval`, no
cookie surface, no floating promises, and no empty catch blocks were found.**

Every material finding below is **dependency freshness** or **configuration drift** — not a
flaw in the application logic.

## Findings Summary

| Severity | Count | Of which INTERNET-UNAUTH |
|----------|-------|--------------------------|
| Critical | 0     | 0                        |
| High     | 0     | 0                        |
| Medium   | 2     | 2                        |
| Low      | 3     | 1                        |
| Info     | 2     | 0                        |

> The `pnpm audit` raw severities (1 critical / 5 high) are **upstream CVSS scores against the
> package**, not against this deployment. Re-scored for actual reachability — dev-only
> toolchain vs. shipped Worker runtime — nothing lands above MEDIUM. FINDING-003 explains the
> "critical" downgrade in full.

## Actively Exploitable (Sprint 0 — out-of-band hotfix)

**None.** No finding is exploitable against production as it stands today. There is nothing
that must bypass the normal batched release process.

## Pending Rotation

**No credential rotation is required by this audit.** No secret was found in source, in git
history, or in build output.

| ID | Credential / Secret | Rotated? | Revoked? |
|----|--------------------|----------|----------|
| — | none | n/a | n/a |

## Findings Catalog

| ID | Title | Severity | Exposure | Deploy Unit | Rotation |
|----|-------|----------|----------|-------------|----------|
| [FINDING-001](findings/FINDING-001.md) | `hono` 4.12.32 ships 4 unpatched advisories incl. CORS ReDoS reachable on every Worker | MEDIUM | INTERNET-UNAUTH | all 6 CF Workers + `@xivdyetools/worker-kit` | NONE |
| [FINDING-002](findings/FINDING-002.md) | `presets-api` allows `localhost` CORS origins in production with `credentials: true` | MEDIUM | INTERNET-UNAUTH | `presets-api` | NONE |
| [FINDING-003](findings/FINDING-003.md) | `seroval` critical advisory via `revolt.js` → `stoat-worker` runtime dependency | LOW | LOCAL | `stoat-worker` (parked) | NONE |
| [FINDING-004](findings/FINDING-004.md) | Dev-toolchain advisories: `vite` fs.deny bypass on Windows, `esbuild`, `undici`, `brace-expansion`, `nanoid` | LOW | LOCAL | repo-wide devDependencies | NONE |
| [FINDING-005](findings/FINDING-005.md) | `presets-api` advertises `X-User-Discord-ID` / `-Name` in CORS `allowHeaders` | LOW | INTERNET-UNAUTH | `presets-api` | NONE |
| FINDING-006 | `web-app` CSP is delivered by `public/_headers` only; the meta-tag path was lost with the Vite root move | INFO | n/a | `web-app` | NONE |
| FINDING-007 | `apps/web-app/netlify.toml` carries a second, drifting copy of the CSP | INFO | n/a | `web-app` | NONE |

### FINDING-006 — CSP delivery (informational, no action required)

When the Vite entry moved to `root: 'src'`, `apps/web-app/index.html` (which carried a
`<meta http-equiv="Content-Security-Policy">`) stopped being the entry.
[apps/web-app/src/index.html](../../../apps/web-app/src/index.html) has no meta CSP.

**This is not a gap.** CSP is delivered as a real HTTP header from
[apps/web-app/public/_headers](../../../apps/web-app/public/_headers), which Vite copies into
`dist/` (`publicDir: '../public'`, verified present in `dist/_headers`). The header version is
*stronger* than the meta version it replaced — it adds `frame-ancestors 'none'` and
`upgrade-insecure-requests`, neither of which a meta tag can enforce. Header delivery is the
correct mechanism. The orphaned `index.html` is filed as a dead-code finding
(`DEAD-001`), not a security one.

### FINDING-007 — Duplicated CSP in stale Netlify config (informational)

[apps/web-app/netlify.toml](../../../apps/web-app/netlify.toml) (dated 2026-01-19, headed
"XIV Dye Tools v2.0.0") declares its own `Content-Security-Policy`. The app deploys to
Cloudflare Pages, so this file is inert. It is a *drift hazard* rather than a vulnerability:
two CSPs in the tree invite editing the wrong one. Tracked for deletion as `DEAD-003`.

## Verified Clean — What Was Checked and Found Sound

Recording negatives matters: it tells the next audit what not to re-derive.

| Category | Method | Result |
|----------|--------|--------|
| Hardcoded secrets | regex over `*.ts/tsx/toml/json` for password/secret/key/token assignments ≥12 chars | **0 hits** (`evidence/potential-secrets.txt`) |
| SQL injection | every `db.prepare()` reviewed; 2 dynamic-fragment sites inspected line by line | **Safe** — fragments built from code-controlled allowlists, all values `.bind()`-ed. `preset-service.ts` escapes LIKE wildcards with `ESCAPE '\'`; `ORDER BY` comes from a `switch`, never input; `conditions[]` seeds a non-empty base clause so `WHERE` can never be malformed |
| Auth bypass via headers | traced `X-User-Discord-ID` end to end | **Safe** — trusted only after `Bearer === BOT_API_SECRET` (constant-time) **and** a valid HMAC signature over `timestamp:userId:userName`. Production rejects bot auth outright when `BOT_SIGNING_SECRET` is unset |
| JWT handling | `@xivdyetools/auth.verifyJWT` | **Safe** — HS256 pinned (rejects `none`/RS256 confusion), expiry enforced, Web Crypto signature check |
| Authorization | `requireAuth` / `requireModerator` / `requireUserContext` / `requireNotBannedCheck` | **Sound** — 401/403/400 separation correct; moderator list parsed tolerantly but compared exactly |
| Ban bypass | `?status=hidden` handling | **Explicitly defended** — `safeStatus` coerces `hidden`→`approved` *and* the base WHERE clause hard-excludes hidden rows |
| XSS | 74 `innerHTML` sites + all 19 `unsafeHTML()` uses in Lit | **Safe** — every `unsafeHTML` argument is an internal SVG icon constant; `getCategoryIcon()` is a `Record` lookup with a constant fallback, never interpolating user data |
| Dynamic code execution | `eval` / `new Function` | **0 hits** |
| Cookies / session fixation | `Set-Cookie`, `document.cookie` | **0 hits** — no cookie surface anywhere; auth is `Authorization: Bearer` only |
| CORS (oauth) | origin callback | **Correct** — localhost is gated on `ENVIRONMENT === 'development'` *and* a port allowlist (`OAUTH-SEC-001`) |
| CORS (api-worker) | `origin: '*'` | **Appropriate** — read-only public API, `allowMethods: ['GET','OPTIONS']`, `credentials: false` |
| Security headers | all workers | **Present** — `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, HSTS in production |
| Error disclosure | production error handler | **Correct** — message/stack suppressed in production, request ID only |
| Timing side channels | bot secret comparison | **Hardened** — SHA-256 digest comparison, fixed-time (`BUG-053`) |
| Weak randomness | all `Math.random()` uses | **Non-security** — random dye selection, k-means++ sampling, test fixtures. No token/ID/nonce generation |
| Unhandled async | worker `env.*.fetch()` calls, catch blocks | **Clean** — no floating promises, 48 correct `ctx.waitUntil()` uses, 0 empty catch blocks |
| Secrets in CI | publish workflow | **Strong** — npm OIDC trusted publishing, no npm token in CI, 2FA-required packages |

## Recommendations

1. **Bump `hono` to `^4.12.34` across all six Workers and `worker-kit`** before the 5.0 release.
   It is a patch-level bump within the same minor and closes all four advisories at once
   (FINDING-001). This is the single highest-value security action in this audit.
2. **Gate `presets-api`'s localhost CORS list on `ENVIRONMENT`**, matching the pattern the
   `oauth` worker already implements (FINDING-002). The code currently contradicts both its own
   inline comment and `apps/presets-api/CLAUDE.md`.
3. **Refresh the dev toolchain** (`vite ≥ 6.4.3`, `esbuild ≥ 0.28.1`) in the same maintenance
   pass. The `vite` `server.fs.deny` bypass is Windows-specific and this project's primary
   development platform is Windows (FINDING-004).
4. **Leave `stoat-worker` alone.** Its `seroval` advisory is real but the app is parked and
   undeployed; bumping `revolt.js` on a parked surface spends risk for no benefit
   (FINDING-003). Revisit if Stoat is ever un-parked.
5. **Add `pnpm audit` to CI** as a non-blocking report so dependency drift surfaces between
   audits rather than at release time.

## Next Steps

See [REMEDIATION_PLAN.md](REMEDIATION_PLAN.md) for the sprint-sequenced execution plan — every
finding above is scheduled there alongside the deep-dive, dead-code and i18n catalogs.
