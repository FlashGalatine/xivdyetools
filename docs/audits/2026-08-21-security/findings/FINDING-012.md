# FINDING-012: OAuth flow hardening — `redirect_uri` matched by origin only, `return_path`/`state` unbounded server-side, PKCE verifier not bound by the worker

## Severity
**LOW** (PLAUSIBLE) — the origin allowlist itself is robust (exact-origin match, re-checked at callback, shared with CORS), so no open redirect was found; these are defence-in-depth gaps. Reviewer IDs: OAUTH-4, OAUTH-5.

## Category
CWE-601 (defence-in-depth) · CWE-20 Improper Input Validation

## Location
- `apps/oauth/src/utils/oauth-validation.ts:48-67`, `handlers/oauth-flow.ts:100-125, 182-199` — any path on an allowlisted origin receives `?code=`; `return_path` and `state` are not length-bounded or pattern-checked by the worker (the web app's `sanitizeReturnPath` is the only guard).
- `handlers/oauth-flow.ts:117-125`, `handlers/callback.ts:73-121`, `handlers/xivauth.ts:93-131` — the worker forwards `code_challenge`/`code_verifier` to Discord/XIVAuth but never binds the verifier to the stored challenge itself; PKCE enforcement is fully delegated to the IdP.

## Recommendation
Pin `redirect_uri` to an exact path allowlist per origin (e.g. `/auth/callback`); cap `return_path` (≤ 256, must start with a single `/`) and `state` sizes server-side; optionally verify `S256(code_verifier) === stored code_challenge` before the token exchange so a misconfigured IdP cannot weaken PKCE.

## References
- Evidence: `../evidence/review-oauth.md` (OAUTH-4, OAUTH-5)
