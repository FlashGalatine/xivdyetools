# FINDING-022: oauth token-bearing responses carry no `Cache-Control: no-store` (RFC 6749 §5.1)
**Severity:** LOW · **Exposure:** INTERNET-AUTH · **Deploy unit:** oauth · **Rotation:** NONE · **CWE:** CWE-525 (browser cache of sensitive information)
Unchanged 2026-08-21 INFO OAUTH-13.

## Location
- `apps/oauth/src/index.ts:134-145` — the header middleware sets nosniff / `X-Frame-Options` / HSTS only
- Token responses: `apps/oauth/src/handlers/callback.ts:237-249`, `xivauth.ts:372-385`, `refresh.ts:184-188,232-241`

## Evidence
- Nothing caches in the path today (Workers origin, bearer flow, `fetch` from the SPA), so this is hygiene — but a future CDN rule or a browser heuristic on a 200 JSON body would cache a JWT.

## Fix
- `c.header('Cache-Control', 'no-store'); c.header('Pragma', 'no-cache');` in the middleware for `/auth/*`.

## Status
FIXED 2026-08-30 50c283b9 (oauth 3.0.0) — `Cache-Control: no-store` + `Pragma: no-cache` on every response the app dispatches (CORS preflight 204s, answered by `cors()` before the header middleware, are the one exception — after-merge follow-up: register the header middleware first).
