# FINDING-031: Web-app security headers — unused `connect-src https://*.workers.dev` wildcard, no `object-src`, deprecated `X-XSS-Protection`, Permissions-Policy/camera mismatch

## Severity
**LOW** — the CSP is otherwise strong (`script-src 'self'`, no inline scripts, `frame-ancestors 'none'`, HSTS preload). The wildcard only matters once an injection exists (it hands an attacker an arbitrary beacon/exfil origin). Reviewer IDs: INF-9, WEB-5, WEB-7, WEB-8.

## Category
CWE-16 Configuration · CWE-693

## Location
- `apps/web-app/public/_headers:17` — `connect-src … https://*.workers.dev` — no production code connects to a workers.dev host (verified by grep); no `object-src 'none'`/`frame-src 'none'`.
- `apps/web-app/public/_headers:22` — `X-XSS-Protection: 1; mode=block` (deprecated; modern guidance is `0` or omit).
- `apps/web-app/public/_headers:24` vs `src/services/camera-service.ts:148,188` — `Permissions-Policy: camera=()` disables the shipped webcam capture path (header/feature mismatch — decide which is intended).
- Same file: the beta project relies on the `X-Robots-Tag` merge (verified working by the reviewer).

## Recommendation
Drop the `*.workers.dev` entry (or list the exact beta worker hostnames); add `object-src 'none'; frame-src 'none'`; remove `X-XSS-Protection`; set `camera=(self)` if the feature is wanted.

## References
- Evidence: `../evidence/review-infra-stoat.md` (INF-9), `../evidence/review-web-app.md` (WEB-5, WEB-7, WEB-8)
