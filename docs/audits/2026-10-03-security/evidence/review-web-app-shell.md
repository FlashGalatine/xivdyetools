# Review: web-app-shell (apps/web-app, Pages shell / auth / network half)

Commit 0ab33466. Live probes (read-only curl, 2026-10-03): `https://xivdyetools.app/`, `https://beta.xivdyetools.app/`, hashed assets on both, plus a few nonexistent paths.

## 1. Entry points and authz matrix

Cloudflare Pages project, static. No server routes except `functions/_middleware.ts`.

| Entry | Who | Guards before handler | Body / param caps |
|---|---|---|---|
| `GET /*` (all paths) | anyone | `_redirects` `/* /index.html 200` (public/_redirects:3); `_headers` rules; middleware | none (static) |
| `functions/_middleware.ts` onRequest (:10) | anyone | host == xivdyetools.projectgalatine.com -> 301 to xivdyetools.app (path/query preserved by hostname swap, :18-23); `/assets/*` answering text/html -> 404 no-store (:31-38). No logging, no bot detection, no OG rewrite (og-worker handles that on its own routes) | none |
| SPA `/auth/callback?code&csrf&state&provider&return_path&error` (src/services/auth-service.ts:214-265) | anyone who lands with params | needs sessionStorage PKCE verifier + `csrf === stored state`, fail closed (:386); provider honoured only if `code` present and in {discord, xivauth} (:222-225, parseProvider); `return_path` through `sanitizeReturnPath` (:115-143) | code + verifier JSON POST to OAUTH_WORKER_URL |
| `authService.login / loginWithXIVAuth` (:645, :695) | anyone | PKCE S256 + 32-byte state; `redirect_uri = ${origin}/auth/callback` (server must allowlist: apps/oauth/src/constants/oauth.ts:10-20) | n/a |
| `authService.logout` / `isAuthenticated` expiry (:750-776) | signed-in user | in-flight memoised; revoke best effort, then storage + state cleared | n/a |
| Preset API calls (community-preset-service, preset-submission-service) | list/get/health anon; vote/submit/edit/delete/mine/rate-limit/preview-image need Bearer (`authService.getAuthHeaders`) | client `isAuthenticated()` gate is UX only (presets-api enforces); client validation mirrors server | name 2-50, desc 10-200, 3-6 dyes, <=10 tags of <=30 chars; preview image <=5 MB (preset-submission-service.ts:221) |
| Router `/harmony ... /glamour`, legacy `/matcher` `/character` | anyone | pure allowlist `ROUTES`; unknown path -> `replaceRoute('harmony')` (router-service.ts:398-413); no external navigation | query preserved only for dc, dye, ui |
| Share links `/<tool>/?...&v=1` | anyone | `ShareService.generateUrl` uses constant BASE_URL and app state; read side validates through `resolveSharedDye` / `parseSharedHex` / `parseSharedPaletteColor` | extractor colours max 5, `^[0-9A-F]{6}$` |
| Market / world | anyone | same-origin `fetch('/json/*.json')`; prices via `https://data.xivdyetools.app/universalis` in PROD (api-service-wrapper.ts:50) | n/a |
| Telemetry (main.ts:105) | opt-in users | toggle AND `navigator.globalPrivacyControl !== true` (telemetry-service.ts:117), checked in `track` (:121) and `flush` (:186) | batch cap `MAX_BATCH = 20` (:48) |

## 2. Positive controls

- CSP pinned and live on production: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src ... ; connect-src 'self' https://*.xivdyetools.app; object-src 'none'; frame-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'; upgrade-insecure-requests` (public/_headers:34; live response matches byte for byte). No universalis, workers.dev or Google origins (FINDING-026/031 stay fixed). HSTS 1y includeSubDomains preload, X-Frame-Options DENY, nosniff, Permissions-Policy denying geolocation/microphone/camera (_headers:36-52, live).
- FINDING-027 for `/assets/`: live `GET /assets/nonexist-123.js` -> 404 `Cache-Control: no-store` (middleware :31-38); a real hashed asset is `immutable` with `application/javascript`.
- HTML at `/`: live `Cache-Control: public, max-age=0, must-revalidate`; the `immutable` inheritance trap does not reach HTML (patterns do not overlap).
- No third-party scripts, fonts or preconnects: src/index.html:68-80 hints only auth/api/data.xivdyetools.app; fonts self-hosted.
- OAuth: PKCE S256, verifier kept only in sessionStorage (auth-service.ts:656, :704) and removed on callback (:378-381), CSRF nonce compared fail-closed (:386), signed `state` envelope forwarded (handleCallbackCode), provider marker cleared at login start (:662) and honoured only on a real callback (:222-225), BUG-063 NaN-expiry hardening (:297).
- `sanitizeReturnPath` blocks `//`, `://`, `javascript:`, `data:` and re-checks `new URL(...).origin` (auth-service.ts:115-143); WHATWG parsing turns `/\evil.com` and tab/newline variants into a foreign origin -> `/`. `navigateAfterAuth` builds `origin + path` (:545-565). No open redirect in router or share code.
- No `postMessage`, no `message` listeners, no service worker, no `window.open` anywhere in non-test src (git grep).
- innerHTML sinks in the assigned files: signin-modal (constants + `t()`), my-submissions-modal escapes the two remote strings (name and rejection reason, `escapeHtml`, which also escapes quotes, shared/utils.ts:26), about-modal (static SVG constants; hrefs from constants), forms (`innerHTML = ''` clears only).
- Example links are host-allowlisted https only (shared/example-link.ts; subdomain match uses `.${h}` so `evilx.com` fails) and re-sanitised on read (hybrid-preset-service.ts:187); anchors carry `rel="noopener noreferrer"`.
- Logout clears token, expiry, provider, in-memory state, OAuth provider marker, price cache; cross-tab `storage` listener logs sibling tabs out (auth-service.ts:190, :750-776).
- Browser logger is console-only (shared/logger.ts); no remote log sink in web-app. Telemetry is the only outbound datapoint path and is gated by toggle + GPC.
- `public/` holds icons, fonts, manifest, sitemap, worlds/DC JSON and OG PNGs only; no .env or wrangler file tracked under apps/web-app; deploy-web-app.yml passes only Cloudflare deploy secrets, no VITE_ secrets baked into the bundle.

## 3. Rejected items

- JWT in localStorage: known trade-off documented in code (auth-service.ts:67-83), mitigated by CSP; carried by 2026-08-29 WEB-09. Only the missing trade-offs-doc entry is a handoff.
- `style-src 'unsafe-inline'` and the `https://*.xivdyetools.app` connect-src wildcard: documented, first-party only; script-src stays 'self'.
- Production source maps served (vite.config.ts `sourcemap: true`; live `.js.map` 200): repo is public, nothing secret, INFO only.
- No COOP/CORP header: nothing opens popups or embeds cross-origin; carried from 2026-08-29 WEB-09.
- `preset-edit-form.ts:580` `img.src = state.previewImageUrl` skips `sanitizePreviewImageUrl`: value comes from presets-api (server-built), `img` cannot run script, CSP img-src bounds it.
- `sessionStorage 'pendingPresetId'` (preset-submission-form.ts:730) stores an API-returned preset id only.
- `return_path` read from the URL before sessionStorage (auth-service.ts:244): sanitised same-origin path and the `code` branch needs a verifier+csrf match first; error branch only navigates to the sanitised path.
- `refreshAuthorName` PATCH on login: author name is a disclosed purpose (PRIVACY.md network item 3).
- Old-domain middleware redirect only ever targets xivdyetools.app; not an open redirect.
- Preset name in `logger.info('Submitting preset:', name)`: console only, never leaves the browser.
- Doubled `Cache-Control` value on `/index.html` live (overlapping `/*.html` and `/index.html` rules): cosmetic.

## 4. Files covered

apps/web-app: public/_headers, public/_redirects, public/manifest.json (live copy), public/ file list (28 tracked files), functions/_middleware.ts, src/index.html, vite.config.ts, vite-plugin-beta-branding.ts (1-70), src/shared/beta-branding.ts (41-60), scripts/check-beta-build.js, src/main.ts, src/services/auth-service.ts (all), api-worker-origin.ts, api-service-wrapper.ts, community-preset-service.ts, hybrid-preset-service.ts (1-200), preset-submission-service.ts (1-500, rest by grep), share-service.ts (all but validate tail), router-service.ts, market-board-service.ts (grep + key regions), world-service.ts (30-110), src/components/signin-modal.ts, my-submissions-modal.ts, about-modal.ts (140-300 + link grep), preset-submission-form.ts and preset-edit-form.ts (sink greps + regions), src/shared/example-link.ts, shared/utils.ts (escapeHtml), shared/logger.ts (head), services/telemetry-service.ts (60-260, gating only). components/v4/share-button.ts was grepped for sinks/storage/navigation only (none found).
Also: apps/oauth/src/constants/oauth.ts:1-25, .github/workflows/deploy-web-app-beta.yml (trigger, environment, deploy), deploy-web-app.yml (secrets grep), PRIVACY.md 40-100, evidence/html-sinks.txt, outbound-fetch.txt, pii-sinks.txt, policy-claims.txt (web-app part).
Live probes: prod and beta `/`, hashed JS on both, `.js.map`, nonexistent `/assets/`, `/fonts/`, `/json/`, `/og/`, `/nope.js`, `/og/default.png`, beta `/index.html`.

## 5. Candidates

| cid | sev | exposure | path:line | claim |
|---|---|---|---|---|
| c1 | MEDIUM | INTERNET-UNAUTH | apps/web-app/src/shared/beta-branding.ts:44-52 | Live beta.xivdyetools.app sends no CSP, HSTS, X-Frame-Options or Permissions-Policy (only X-Robots-Tag plus Pages defaults); production sends all. Beta is an allowed production OAuth redirect origin |
| c2 | LOW | INTERNET-UNAUTH | apps/web-app/functions/_middleware.ts:31 | FINDING-027 fix covers only `/assets/`; missing `/fonts/*`, `/json/*`, `/og/*` URLs still return the SPA HTML under their own cache rules (30 d, 24 h labelled application/json, 1 h) |

c1 evidence: `curl -sI https://beta.xivdyetools.app/` returns `x-robots-tag`, `referrer-policy`, `x-content-type-options`, `Access-Control-Allow-Origin: *` and no `content-security-policy`, `strict-transport-security`, `x-frame-options` or `permissions-policy`; same for the beta hashed JS. Production returns all. Likely cause (not proven, cannot see the deployed beta _headers): the build appends a second `/*` block (`BETA_HEADERS_BLOCK`, beta-branding.ts:50-51 via vite-plugin-beta-branding.ts:68) and Pages treats the repeated identical pattern as an override rather than a merge, so the first `/*` block's CSP/HSTS/XFO/PP are dropped (referrer-policy and nosniff are Pages defaults). Cache rules for other patterns (`/assets/*` immutable, `/fonts/*` 30 d) still apply, which fits. Why it slipped: `check-beta-build.js:46` only greps the _headers source for the CSP string, and the post-deploy smoke test asserts the robots header only (no CSP match in scripts/smoke-test-pages.js). Impact: tokens minted for beta come from the production OAuth worker (apps/oauth/src/constants/oauth.ts:16) and work against production presets-api, yet beta has no script-src restriction and can be framed (clickjacking of sign-in/vote/delete). Fix direction: emit the robots header inside the existing `/*` block (or a distinct pattern such as `/:splat`-free path rule) and make the smoke test assert CSP and HSTS on beta. policy NONE.

c2 evidence: `curl -sI https://xivdyetools.app/fonts/nonexist.woff2` -> 200 `text/html` `Cache-Control: public, max-age=2592000`; `/json/nope.json` -> 200 `Content-Type: application/json` `max-age=86400` (HTML body); `/og/nope.png` -> 200 text/html. Rules at public/_headers:91, :101, :107-109; the middleware 404 branch only fires for `/assets/` (functions/_middleware.ts:31). `regression_of` 2026-08-29-security/FINDING-027 (same shape, fix scoped too narrowly). Impact is bounded: browsers/edge cache an HTML page for a missing font filename for 30 days, and a missing worlds JSON parses as HTML; no script context. Fix: extend the middleware to every path that has a file extension and is not a navigation (or 404 any text/html answer for `/fonts/`, `/json/`, `/og/`).

PII reconciliation for this half (pii-sinks x pii-sources, assigned paths): no personal field reaches a datapoint, log sink, KV/D1/R2 write or third-party body from the assigned files. The only server-bound personal data is the OAuth/presets traffic PRIVACY.md lists (token, provider id, username, author name, Discord avatar CDN). No client-generated persistent identifier exists (PKCE/state values are per-flow sessionStorage, removed after callback). Telemetry gating verified (toggle AND GPC at track and flush); field-level review of telemetry belongs to the telemetry/api-worker reviewer. No policy candidate (policy NONE, reconcile_case 0).

## 6. Handoffs

- oauth reviewer: `ALLOWED_REDIRECT_ORIGINS` (apps/oauth/src/constants/oauth.ts:10-20) still lists `xivdyetools.projectgalatine.com` ("remove after migration complete") and `http://localhost:5173/3000`, `127.0.0.1:5173` in the production allowlist; `beta.xivdyetools.app` is allowed and beta deploys from any non-main branch push (deploy-web-app-beta.yml:19-30), so production codes go to whatever the last pushed branch built (repo-write trust boundary, LOCAL/INFO).
- documentation: `docs/architecture/security-trade-offs.md` has no entry for the localStorage-JWT trade-off that the 2026-08-29 report asked for (auth-service.ts:67-83 is the only record).
- bug (low): `performLogout` awaits `/auth/revoke` with no timeout (auth-service.ts:756); on a hung connection the local session is not cleared until the browser gives up. Add an AbortController before clearing.
- bug (cosmetic): `Cache-Control` doubled on `/index.html` (overlapping `/*.html` and `/index.html` rules).
- telemetry reviewer: payload carries the full `APP_VERSION` string, locale, theme and a viewport bucket (telemetry-service.ts:195-200); check against schema.ts allowlist and PRIVACY.md lines 107-128.
