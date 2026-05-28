# Security Audit Manifest

- **Project:** XIV Dye Tools monorepo (`xivdyetools/`)
- **Audit Date:** 2026-05-28
- **Auditor:** Claude Code (security-audit skill)
- **Methodology:** Static review (no code modified). Documentation-first per skill rules.

## Scope

| Surface | Reviewed |
|---------|----------|
| Secret management | Repo-wide grep for hardcoded credentials; wrangler.toml + `.dev.vars`/`.env` presence |
| Crypto primitives | `@xivdyetools/auth` (jwt, hmac, timing, discord) |
| AuthN/AuthZ | oauth worker (PKCE, state, JWT issuance, refresh, revocation), presets-api dual auth |
| Injection | All D1 query sites in presets-api (SQL), Universalis proxy (URL/SSRF) |
| CORS | api-worker, presets-api, oauth, universalis-proxy, discord-worker |
| Input validation | Universalis proxy params, oauth redirect_uri/state, body/JSON size limits |
| Dependencies | `pnpm audit` across the workspace |
| Config hygiene | wrangler.toml vars, error message leakage, security headers |

## Out of Scope / Not Deeply Reviewed

- web-app client-side XSS surface (Lit templating) — sampled only
- moderation-worker handlers (shares patterns with discord-worker)
- stoat-worker (Node/Revolt) runtime
- Live/dynamic testing (this was a static review only)

## Evidence

- `evidence/pnpm-audit.json` — full dependency advisory output
- Inline `file:line` references throughout findings

## Risk Summary

**Overall risk: LOW.** No critical or high-severity findings. The codebase shows mature, defense-in-depth security engineering (parameterized SQL, PKCE, algorithm-pinned JWTs in the shared lib, timing-safe comparisons, SSRF-resistant proxy, allowlisted CORS). Findings are hardening/consistency improvements.
