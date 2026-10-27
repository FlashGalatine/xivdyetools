# FINDING-009: Superseded Cloudflare Pages deployments and the v4-ui-migration branch alias still serve old web-app builds with weaker or no CSP
**Severity:** LOW · **Exposure:** INTERNET-UNAUTH · **Deploy unit:** web-app (Cloudflare Pages projects xiv-colorexplorer / xivdyetools-beta; live config, not repo) · **Rotation:** NONE · **Policy:** NONE · **CWE:** n/a

## Location
- `docs/superpowers/plans/2026-08-10-pages-smoke-test.md:791` — Superseded Cloudflare Pages deployments and the v4-ui-migration branch alias still serve old web-app builds with weaker or no CSP

## Evidence
- 2026-10-26 GET v4-ui-migration / 66496174.xiv-colorexplorer.pages.dev: 200, csp "... connect-src 'self' https://universalis.app https://*.workers.dev https://*.xivdyetools.app ..."; ecc7fb76.xivdyetools-beta.pages.dev: 200, no content-security-policy header; xiv-colorexplorer.pages.dev and xivdyetools-beta.pages.dev: current CSP, connect-src 'self' https://*.xivdyetools.app.
- Reach: Any internet client can GET https://v4-ui-migration.xiv-colorexplorer.pages.dev/, https://66496174.xiv-colorexplorer.pages.dev/ or https://ecc7fb76.xivdyetools-beta.pages.dev/ and run an old web-app bundle. An attacker can send a victim a link to one of these origins to use any client-side bug fixed in later builds, with the older CSP in force.
- A GET probe re-run today returned 200 on all three hosts. The two production-project hosts send a CSP that still has connect-src https://*.workers.dev and https://universalis.app plus Google Fonts and no object-src/frame-src. Those allowances were removed by FINDING-031 / FINDING-026 / REFACTOR-002 (apps/web-app/public/_headers:7-30), and the old beta hash host sends no CSP header at all, which is worse than the claim. Impact stays bounded: these are separate pages.dev origins with no xivdyetools.app storage, oauth redirects only to FRONTEND_URL https://xivdyetools.app (apps/oauth/wrangler.toml:21), and presets-api CORS is exact-ma… Preconditions: The old deployments must stay retained in Cloudflare Pages (true as of today's probe). Real harm needs a client-side vulnerability in the old bundle that later builds fixed, and that has not been diffed or proven.
- Live state (read-only Cloudflare query 2026-10-26, [evidence](../evidence/live-state-cloudflare-2026-10-26.md)): Cloudflare retains **522** deployments in `xivdyetools` and **240** in `xivdyetools-beta`, each at its own `<hash>.pages.dev` host, so nearly the whole build history is reachable under older CSPs. The fix is a bulk prune plus a retention step, not three deletions.

## Fix
- Delete superseded Pages deployments and the v4-ui-migration branch alias in both projects through the Cloudflare dashboard/API, then add a retention step (prune old deployments after each deploy-web-app run).
- Add the alias and hash-host probe to the smoke/audit live-origin checks recommended in the 2026-10-03 report (line 160).
- **Maintainer decision:** Only the maintainer can delete the superseded Pages deployments and the v4-ui-migration branch alias, and set a retention policy, in the Cloudflare dashboard.

## Status
PARTIAL 2026-10-26 — the authorized one-off cleanup is complete: 521 superseded production-project and 239 beta-project deployments deleted, including the v4-ui-migration alias. Exactly the original protected deployment remains in each project; six live URL HTML hashes/CSPs are unchanged, and the alias plus sampled retired hash hosts return 404. [Execution evidence](../evidence/remediation-finding-009-2026-10-26.md). OPS-PAGES-HISTORY is complete; automated retention and live-origin probe integration remain in R-CI, so the overall finding stays outstanding.
