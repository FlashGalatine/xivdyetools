# Review: web-app-shell (apps/web-app, Pages shell / auth / telemetry / import half)

Commit 13c386e5 (base of the previous audit: 0ab33466). Read-only. Live probes were read-only `curl -sI` (HEAD) requests made on 2026-10-26 against `https://xivdyetools.app/`, `/harmony/`, `/presets/`, `/auth/callback?x=1`, `/licenses/xivcharakit.txt`, `/licenses/nope.txt`, `https://beta.xivdyetools.app/`, `/glamour/` and `https://xivdyetools-beta.pages.dev/`. `https://xivdyetools.pages.dev/` did not resolve in DNS (curl exit 6), so the production project's real `*.pages.dev` alias was not probed.

Result: **0 candidates.** Every shell control that the 2026-10-03 and 2026-10-15 audits fixed still holds in code and on the live sites. The four items below that are still open were already routed as handoffs and are not re-filed.

## 1. Entry points and authz matrix

The site is a static Cloudflare Pages project. Its only server code is `functions/_middleware.ts`.

| Entry | Who | Guards before handler | Caps |
|---|---|---|---|
| `GET /*` | anyone | `_redirects` `/* /index.html 200` (public/_headers rules apply to every path) | static |
| `functions/_middleware.ts` onRequest (:9) | anyone | old host `xivdyetools.projectgalatine.com` returns a 301 to `xivdyetools.app` (:17-22, hostname swap only). An `/assets/*` path answered with text/html becomes a `404 no-store` (:30-39) | none |
| SPA `/auth/callback?code&csrf&state&provider&return_path&error` (auth-service.ts:233-282) | anyone who lands there | `provider` is honored only when a `code` is present and the value is in {discord, xivauth} (:242-245). The verifier is read from sessionStorage and removed (:391-398). The CSRF check fails closed (:406). `return_path` passes through `sanitizeReturnPath` (:135-174) | JSON POST of `{code, code_verifier, redirect_uri, state}` (:427-438) |
| `login` / `loginWithXIVAuth` (:666, :714) | anyone | PKCE S256, a 32-byte state, `redirect_uri = origin + /auth/callback`. `returnTool` comes only from code constants (signin-modal.ts:66/69, config-sidebar.ts:1801/1803) | n/a |
| `logout` (:758-811) | signed-in user | The local session is cleared first: token, expiry, provider, in-memory state, the OAuth provider marker and the price cache. The revoke is then sent best effort, without await, with a 5 s timeout (BUG-115). A `storage` listener signs sibling tabs out (:210-223) | n/a |
| Preset API with Bearer token | signed-in user | `getAuthHeaders` sends the token only while `isAuthenticated()` holds (:650). presets-api enforces auth | (preset reviewer) |
| Telemetry `POST data.xivdyetools.app/v1/telemetry` (telemetry-service.ts:226-235) | opt-in, no GPC | `isEnabled = toggleOn && navigator.globalPrivacyControl !== true` (:117), checked in `track` (:121) and in `flush` (:186) | `MAX_BATCH 20` (:48) |
| Settings import (advanced-options-panel.ts:305-332) | local user file | `type === 'xivdyetools-settings'`, then `importConfigs` keeps only `CONFIG_KEYS` and fields declared in each key's defaults with the same shape (config-controller.ts:96-109, :420-433) | none (open handoff, §3) |
| Collection import (collection-manager-modal.ts:584-615, collection-service.ts:909-1041) | local user file | `type` check. Each record goes through `createCollection` caps (50 collections, 20 dyes, name 50, description 200, favorites 40; :142-147). Ids pass through `toStainId`. Each record has its own try/catch, and errors are logged as fixed messages (:1025, :1037) | none (open handoff, §3) |
| `.chara` drop (chara-file-loader.ts:67-131) | local user file | `*.chara` name check, then 8 KiB `MAX_CHARA_FILE_BYTES` before the read, then a capped slice read (:72-97) | 8 KiB |
| Inspection Web Worker (chara-inspection-service.ts:276-314) | same-origin module worker | Every message is parsed by `parsePaletteRequestMessage` / `parseInspectionResponse`. Messages for another id are ignored. Palette requests are capped at `CHARA_PALETTE_REQUEST_CAP`. A 5 s deadline applies (:233-270, :206) | 8 KiB in |

## 2. Positive controls

- **Headers, live.** The same CSP is served on production `/`, on the og-worker-routed `/harmony/` and `/presets/`, on `/auth/callback`, on beta `/` and `/glamour/`, and on `xivdyetools-beta.pages.dev`. It is the one in public/_headers:31: `script-src 'self'`, `frame-ancestors 'none'`, `form-action 'none'`, `object-src`/`frame-src 'none'`, and `connect-src 'self' https://*.xivdyetools.app` with no workers.dev or universalis. Those responses also carry HSTS (1 year, includeSubDomains, preload), XFO DENY, nosniff, `Referrer-Policy: strict-origin-when-cross-origin` and `Permissions-Policy: geolocation=(), microphone=(), camera=()`.
- **2026-10-03 FINDING-001 stays fixed.** Live beta now carries the full `/*` rule plus `x-robots-tag: noindex, nofollow`. `addBetaHeaders` inserts the header inside the `/*` rule and throws when no `/*` rule exists (src/shared/beta-branding.ts:122-136). The plugin refuses to write a `_headers` file with a repeated pattern (vite-plugin-beta-branding.ts:66-74). `check-beta-build.js` parses the file the way Pages does and asserts the four security headers on the last `/*` rule; the beta workflow runs it before deploy (deploy-web-app-beta.yml "Verify this is a beta build"). `smoke-test-pages.js:43-47, :246-251` asserts CSP (including `frame-ancestors`), XFO, HSTS and Permissions-Policy on the custom domain for both prod and beta.
- **Pattern-merge trap checked.** No pattern repeats in public/_headers. `/*` sets no Cache-Control or Content-Type, so the `/assets/*` immutable rule, `/og/*`, `/fonts/*`, `/json/*` and `/licenses/*` merge with it without overriding security headers. The live `/licenses/xivcharakit.txt` is `text/plain; charset=utf-8` with nosniff, so a package-supplied notice cannot render as HTML.
- **No third-party origins.** No third-party script, style or font origin exists. index.html:74-79 hints only auth/api/data.xivdyetools.app. Fonts are self-hosted. `img-src` adds only cdn.discordapp.com (avatars), shots. (R2 previews) and data. (proxied icons). Every `VITE_*` variable is a URL override: VITE_API_WORKER_URL, VITE_APP_ENV, VITE_OAUTH_WORKER_URL, VITE_PRESETS_API_URL, VITE_UNIVERSALIS_PROXY_URL. No `.env` or wrangler file is tracked under apps/web-app.
- **OAuth.**
  - PKCE S256 with the verifier kept only in sessionStorage.
  - The CSRF check fails closed (auth-service.ts:406). This also blocks login CSRF, because a planted code has no matching verifier or state.
  - The signed state envelope is forwarded (:436).
  - The provider marker is cleared when each Discord flow starts (:682).
  - `sanitizeReturnPath` rejects `//`, `://`, `javascript:` and `data:`, and checks the URL origin (:135-174). `navigateAfterAuth` builds `origin + path` (:581).
  - Login sends only `pathname` as `return_path`, never the query string (signin-modal.ts:66).
- **Logout.** BUG-115 is fixed: storage and state are cleared before the revoke, and the revoke has a 5 s timeout with a fallback for browsers without `AbortSignal.timeout` (:60-77, :776-808). FINDING-008 holds: the price-cache generation guard prevents a hydration that started before logout from restoring prices afterward (api-service-wrapper.ts:69-75, :93-101, :156-158).
- **Telemetry.**
  - The envelope is exactly `{v, ver, env, locale, theme, vp, events}` (telemetry-service.ts:191-199), matching spec docs/superpowers/specs/2026-08-29-web-analytics-design.md:80-84 (ver = APP_VERSION semver, one of the six locale codes, m/t/d bucket).
  - Event props come only from code: tool id/entry (v4-layout.ts:517-518), stainID plus via (dye-selector.ts:282, v4-layout.ts:223), `{ok, producer}` where the producer is normalized to a 5-value bucket (chara-file-loader.ts:109, :124-125; telemetry-service.ts:174-181), and theme (theme-switch.ts:23).
  - Nothing is persisted and no identifier is generated. The only random ids are local `col_`/`modal_`/`toast_` ids, which are never sent.
  - GPC is honored in `track` and `flush`, with a unit test at telemetry-service.test.ts:122. The toggle defaults off.
- **`.chara` personal fields.** The file name and producer text never reach a log or a datapoint. The log carries only the bucket (chara-file-loader.ts:127-129), and the read and inspection failures log fixed strings (:92, :110-117). `/v1/chara/resolve` sends only `{gear: model keys, glasses?: number}` (chara-resolve-service.ts:181-194).
- **Locale promise "Images are read in your browser and never uploaded"** (en.json:304, extractor-tool.ts:821). The outbound-fetch evidence lists no web-app request that carries image bytes except the explicit preset preview upload (preset-submission-service, a disclosed flow).
- **innerHTML sinks in the shell are constants, `t()` strings or escaped values.** my-submissions-modal escapes the API-supplied `name` and `rejection_reason` (:135-142). modal-container's close icon is a constant SVG (:493). v4-layout.ts:567/739/755 interpolate only `t()` strings and a `ToolId` from the router allowlist. The fatal-error path builds DOM nodes rather than markup (main.ts:185). changelog-modal uses `textContent` only. about-modal's license link is a constant path opened with `noopener noreferrer`.
- **Navigation sinks.** `window.open` is called with `noopener,noreferrer` (item-links-menu.ts:131, result-card.ts:1491). preset-detail handoff URLs are built from local stainIDs (:904-926). my-submissions `assign('/presets/community-' + id)` stays a same-origin path (:216). No `postMessage` to or from a window exists. The only worker is same-origin and its messages are validated. No service worker exists.
- **e2e fixtures and public/.** e2e fixtures hold no real-looking secret or id (`author_discord_id: '1'`; git grep for token/eyJ/snowflake patterns). public/ holds icons, fonts, the manifest, the sitemap, world/DC JSON, OG PNGs and a generated MIT license notice. Nothing in it is secret.

## 3. Rejected (with reason)

- **Settings and collection JSON import read the file with no size cap** (advanced-options-panel.ts:316, collection-manager-modal.ts:593; constants.ts:126-127 says so outright). Not re-filed: this is the open 2026-10-03 BUG handoff (evidence/handoffs.md:141), it is a self-DoS on a file the user picks, and it has no cross-user path.
- **The settings-import catch logs the raw `JSON.parse` exception, which V8 builds from the file text** (advanced-options-panel.ts:330). The browser logger writes to the console only, with no remote sink (shared/logger.ts). This matches the 2026-10-03 rejection of console-only preset-name logging. It is noted as a BUG/consistency handoff only, because collection import already logs a fixed message (collection-service.ts:1036-1037).
- **`logger.info('Logged in as <name>')`** (auth-service.ts:527) writes to the console only, under the same precedent.
- **SPA fallback serves `/licenses/<missing>` as 200 `text/plain`** (live probe). This is the same deliberate scope as the 2026-10-03 rejection for `/fonts`, `/json` and `/og`. text/plain with nosniff cannot execute.
- **`Access-Control-Allow-Origin: *` on Pages static responses.** This is a Pages default on public static content that holds nothing per user.
- **Production source maps.** Accepted as WEB-10 on 2026-08-21 and unchanged (vite.config.ts:26).
- **JWT in localStorage, `style-src 'unsafe-inline'`, the `*.xivdyetools.app` connect-src wildcard, and missing COOP/CORP.** All are carried rejections or trade-offs. The doc handoff (no localStorage-JWT entry in docs/architecture/security-trade-offs.md) is still open; git grep finds no match.
- **`renderPlaceholder` interpolates `toolId` into innerHTML** (v4-layout.ts:754-760). It is reached only from the `default:` arm of a switch over the router's `ToolId` allowlist (:713). No attacker-controlled value can reach it.
- **The `return_path` URL parameter takes precedence over sessionStorage** (auth-service.ts:263-265). This repeats a 2026-10-03 rejection: the value is a sanitized same-origin path.
- **Beta is a production OAuth redirect origin and is deployed from any non-main branch** (apps/oauth/src/constants/oauth.ts:14-25, deploy-web-app-beta.yml). This is the trust boundary of a repo writer and was already handed to the oauth reviewer on 2026-10-03.
- **`${{ steps.deploy.outputs.deployment-url }}` inside a `run:` step in the deploy workflows.** It has a constrained source (wrangler's output) and repeats accepted INF-11.
- **"GLAMOUR SHOT · LINKED, NOT UPLOADED" label** (preset-detail.ts:1002). The label sits on the external example link, not on the R2 preview, and preset-card shows it only when no uploaded image exists (preset-card.ts:326-336). The claim is accurate.

Handoffs (not findings):
- BUG: chara-resolve-service.ts:184 calls `AbortSignal.timeout` and `AbortSignal.any` without the feature check that auth-service.ts:68-77 documents for the es2020 target. On older Safari this throws outside the try block, so the code never produces `CharaResolveUnavailableError`.
- Dead code: the old-domain redirect branch in `_middleware.ts:17-22`. FINDING-006 / DOMAIN_DEPRECATION retired that host.

## 4. Files covered

38 files in these directories:

- **apps/web-app (root files):** public/_headers, public/_redirects, public/manifest.json, the public/ file list, functions/_middleware.ts, vite.config.ts, vite-plugin-beta-branding.ts, scripts/check-beta-build.js, scripts/smoke-test-pages.js (header assertions)
- **apps/web-app/src:** index.html, main.ts
- **apps/web-app/src/shared:** beta-branding.ts, constants.ts (diff), logger.ts (1-110)
- **apps/web-app/src/services:** auth-service.ts (80-900), api-service-wrapper.ts (diff), api-worker-origin.ts, telemetry-service.ts (all), chara-file-loader.ts (all), chara-inspection-service.ts (180-320), chara-resolve-service.ts (160-215), config-controller.ts (30-110, 400-460), collection-service.ts (900-1041, caps)
- **apps/web-app/src/components:** advanced-options-panel.ts (240-340), collection-manager-modal.ts (575-620), my-submissions-modal.ts (120-216), modal-container.ts (480-505), v4-layout.ts (560-580, 700-770), item-links-menu.ts (120-135), about-modal.ts (diff), changelog-modal.ts (sink grep)
- **apps/web-app/src/components/v4:** preset-detail.ts (904-926, 985-1070), preset-card.ts (315-345), result-card.ts (1480-1495)
- **Other:** apps/web-app/e2e (grep), apps/web-app/src/locales/en.json (privacy strings); .github/workflows/deploy-web-app.yml and deploy-web-app-beta.yml; apps/oauth/src/constants/oauth.ts:1-40; docs/superpowers/specs/2026-08-29-web-analytics-design.md (envelope rows); evidence html-sinks.txt and outbound-fetch.txt (web-app rows)

Not covered: the production `*.pages.dev` alias (its hostname is unknown and `xivdyetools.pages.dev` does not resolve); the content of the tool components beyond the sinks named above (web-app-content reviewer); the server side of `/v1/telemetry` (api-worker reviewer).
