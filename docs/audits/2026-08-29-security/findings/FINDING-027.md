# FINDING-027: Pages SPA catch-all + `/assets/*` `immutable` can cache an HTML fallback under a hashed `.js` URL for a year — the cache-poisoning shape the project has already been hit by once
**Severity:** LOW · **Exposure:** INTERNET-UNAUTH (availability) · **Deploy unit:** web-app · **Rotation:** NONE · **CWE:** CWE-524

## Location
- `apps/web-app/public/_redirects:3` — `/* /index.html 200`
- `apps/web-app/public/_headers:53-54` — `/assets/*` → `Cache-Control: public, max-age=31536000, immutable` (pattern-merge: applies to whatever the catch-all returns)
- `apps/web-app/functions/_middleware.ts:6-23` — only the old-domain redirect; no content-type guard

## Evidence
- A request for a not-yet-deployed or already-pruned `/assets/<hash>.js` (stale HTML mid-deploy, CDN alias lag) receives `index.html` with 200 + `immutable` and is served as the script for a year — indistinguishable from a partial deploy (see `xiv-pages-asset-cache-poisoning`).

## Fix
- In `_middleware.ts`: for `/assets/*`, return 404 `no-store` when the upstream response is `text/html`; or scope the immutable rule to the hashed filename pattern.

## Status
FIXED 2026-08-30 2ffe6d13 (web-app: `functions/_middleware.ts` now answers 404 `Cache-Control: no-store` when a `/assets/*` request would be served `text/html` (the SPA catch-all), so a stale or pruned hashed URL can never be cached as a script under the `/assets/*` immutable rule; the legacy-domain 301 keeps precedence; `/og/*` and `/fonts/*` provably unaffected; unit-tested via `src/__tests__/pages-middleware.test.ts`, which also pulls the middleware into the tsc program for the first time.)
