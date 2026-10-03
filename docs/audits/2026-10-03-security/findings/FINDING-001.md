# FINDING-001: beta.xivdyetools.app serves no CSP, X-Frame-Options, HSTS or Permissions-Policy — beta-branding.ts appends a second `/*` rule that replaces the security-header rule
**Severity:** MEDIUM · **Exposure:** INTERNET-UNAUTH · **Deploy unit:** web-app · **Rotation:** NONE · **Policy:** NONE · **CWE:** CWE-693 (also CWE-1021 clickjacking)
**Sprint 0:** yes — live on a public origin that signs users in with production JWTs; ship individually, out-of-band

## Location
- `apps/web-app/src/shared/beta-branding.ts:44-52` — `BETA_HEADERS_BLOCK` is a new `/*` rule carrying only `X-Robots-Tag`; its doc comment (:38-43) wrongly says Pages merges repeated identical patterns. Present since `af017fd0`/`4d1dfd97` (2026-08-09).
- `apps/web-app/vite-plugin-beta-branding.ts:68` — appends the block to `dist/_headers`, which already holds the only security-header `/*` rule from `public/_headers:7`.
- `apps/web-app/scripts/check-beta-build.js:46` greps the file for the CSP string, and `scripts/smoke-test-pages.js` asserts only `x-robots-tag` on beta — neither can see the override.

## Evidence
- Coordinator probe, 2026-10-03 06:52 UTC (`curl -sI`): `https://beta.xivdyetools.app/` returns `x-robots-tag`, `referrer-policy`, `x-content-type-options` (Pages defaults) and **no** `content-security-policy`, `x-frame-options`, `strict-transport-security` or `permissions-policy`; `https://xivdyetools.app/` returns all four. Mechanism: wrangler 4.140.0 `constructHeaders` keys rules by path (`rules[rule.path] = …`), so the later `/*` wins (`evidence/review-web-app-shell.md` §5).
- `apps/oauth/src/constants/oauth.ts:16` allows `https://beta.xivdyetools.app` as a redirect origin, so beta holds production JWTs in `localStorage` — the trade-off the web-app CLAUDE.md justifies by "strict CSP prevents XSS exfil". Beta also writes to production preset data (`units.md`). Without `frame-ancestors`/XFO any site can frame beta and clickjack signed-in vote/edit/delete actions. (Missing HSTS matters least: production sends `includeSubDomains; preload`, so preloaded or apex-visited browsers already force HTTPS on beta — the grade rests on CSP and XFO.)
- Missed by the 2026-08-21, 08-29 and 09-15 audits: none probed the beta origin live.

## Fix
- Insert `X-Robots-Tag` as a header line inside the existing `/*` rule of `dist/_headers` instead of appending a second `/*` rule; correct the comment at `beta-branding.ts:38-43`; add a unit test that the transformed file has exactly one `/*` rule that keeps CSP, XFO, HSTS and Permissions-Policy.
- Make `check-beta-build.js` fail when any path pattern appears twice, and extend `smoke-test-pages.js` to assert `content-security-policy` and `x-frame-options` on both custom domains after every deploy.
- Ship via `deploy-web-app-beta.yml` and re-run the `curl -sI` probe above as acceptance.

## Status
FIX COMMITTED, NOT DEPLOYED — `61b7077b` on local branch `fix/beta-security-headers` (from `main` @ `0ab33466`; web-app 5.13.3). Gates green 2026-10-03. Verified with wrangler 4.140.0 `pages dev`: the old output served neither CSP nor XFO, the fixed beta build serves CSP, XFO, HSTS, Permissions-Policy and `x-robots-tag`. Closes when pushed, the live `curl -sI` acceptance passes on beta.xivdyetools.app, and the branch merges the same day.
