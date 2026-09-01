# Review — `apps/web-app` (Pages SPA + telemetry client) — 2026-08-29

| | |
|---|---|
| **Reviewer** | web-app unit reviewer (whole-monorepo audit 2026-08-29) |
| **Tree** | `security-audit-2026-08-29` @ `4c213248` (= `main`), read-only |
| **Delta reviewed** | `b195723f..HEAD` — 172 files, 50 commits (`git log -- apps/web-app`); telemetry (#149: c3dba765, 2882a78e, 0809019c, 24d1c242, f873ec8d, a2c0efe4, b309b942, 4c213248), chara-name privacy (0e7511ff, f98645e4), FINDING-011/027/031/032 + WEB-6/9/11/13/14 (049ec057), FINDING-012 (b83455dc), i18n remediation (29efe5f0 line) |
| **Method** | Full reads of every service touching auth, storage, network or URLs; every `TelemetryService` call site; every `innerHTML`/`unsafeHTML` sink enumerated by a Perl template scanner (29 templates, every `${…}` triaged); `git ls-files` + grep for storage keys, navigation sinks, globals, env vars; locale strings and `PRIVACY.md` reconciled against code; guarding tests read for every previously FIXED item |
| **Deployed CSP** (`public/_headers:25`) | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob: https://cdn.discordapp.com https://shots.xivdyetools.app https://data.xivdyetools.app; connect-src 'self' https://universalis.app https://*.xivdyetools.app; object-src 'none'; frame-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'; upgrade-insecure-requests;` |

No CRITICAL or HIGH candidates. `script-src 'self'` (no inline/eval) still caps every markup-injection class below token theft; every 2026-08-21 web-app finding (WEB-1..5, FINDING-011/012/027/031/032) is verified fixed **with a guarding test**, and none of the INFO items WEB-6..15 became material. The new material is privacy-policy accuracy: the published guide over-promises in three places relative to what the code does on-device and at page load.

---

## Module map

### Services → network endpoints (every outbound request the bundle can make)

| Service (`src/services/…`) | Endpoint(s) | Auth header | Notes |
|---|---|---|---|
| `telemetry-service.ts` | `POST ${getApiWorkerBase()}/v1/telemetry` (`:230`) = `https://data.xivdyetools.app` in PROD (`api-worker-origin.ts:11,18`) | none | `sendBeacon` string body → `text/plain`; `fetch(keepalive)` fallback (`:232-238`). Gated by `isEnabled()` at `track()` (`:123`) **and** `flush()` (`:189`) |
| `chara-resolve-service.ts` | `POST …/v1/chara/resolve` (`:123`); `GET …/v1/chara/icon/<iconId>` (`:72-74`, via CSS `background-image` in `chara-import.ts:1203,1378`) | none | Body = `{ gear: CharaGearModel[], glasses?: number }` (`:115-116`); `CharaGearModel` = `{slot, set?, base, variant}` (`packages/core/src/services/chara/chara-models.ts:24-32`). 12 s timeout (`:69`), envelope shape-checked (`:150-158`), in-memory session cache only (`:83`) |
| `api-service-wrapper.ts` | `https://data.xivdyetools.app/universalis` in PROD (`:49-53`); `VITE_UNIVERSALIS_PROXY_URL` or direct Universalis only in dev (`:28-32,55-58`) | none | Price cache in IndexedDB `price_cache`; cleared on logout (`auth-service.ts:743`) |
| `auth-service.ts` | `${OAUTH_WORKER_URL}/auth/discord`, `/auth/xivauth` (redirects, `:657-667`, `:701-711`); `POST /auth/callback` or `/auth/xivauth/callback` (`:381-406`); `POST /auth/revoke` (`:727-732`); `PATCH ${PRESETS_API_URL}/api/v1/presets/refresh-author` (`:516-519`) | Bearer on revoke/refresh-author | `OAUTH_WORKER_URL`/`PRESETS_API_URL` are build-time constants (`:55,:60`) |
| `community-preset-service.ts` | `${apiUrl}/health` (`:182`), `/api/v1/presets…` (`:253`), `/api/v1/presets/<id>` (`:321`), `/api/v1/votes/<id>[/check]` (`:380,442,497`) | Bearer on votes | `apiUrl` = `VITE_PRESETS_API_URL || 'https://api.xivdyetools.app'` (`:155`); the clobberable `window.PRESET_API_URL` is gone (`:151-155`) |
| `preset-submission-service.ts` | `POST /api/v1/presets` (`:299`), `GET /presets/mine` (`:378`), `/presets/rate-limit` (`:421`), `PATCH/DELETE /presets/<id>` (`:461,573`), `POST/DELETE /presets/<id>/preview-image` (`:222,250`) | Bearer | ids `encodeURIComponent`'d; preview image ≤ 5 MB client-side (`:207,217`) |
| `share-service.ts`, `keyboard-service.ts`, `camera-service.ts`, `offline-banner.ts` | none (share = clipboard URL; camera = `canvas.toDataURL` `camera-service.ts:263`; offline = `navigator.onLine`) | — | verified by grep |

Third-party origins actually contacted at runtime: **none by script**; the browser is asked to open a connection to `universalis.app` by `src/index.html:67-68` (`dns-prefetch` + `preconnect`) — see WEB-02. `cdn.discordapp.com` only when a Discord-provider avatar renders (`auth-service.ts:807-811`).

### Storage (every key written by app code — `git ls-files 'apps/web-app/src/*.ts' | xargs grep -n "setItem"`)

| Store / key | Written by | Personal? | Cleared by |
|---|---|---|---|
| `localStorage` `xivdyetools_auth_token` / `_auth_expires` / `_auth_provider` | `auth-service.ts:462-464,430` | **JWT** (username, global_name, avatar, discord_id/sub, `primary_character` for XIVAuth) | `clearStorage()` on logout / expiry / decode failure (`:576-580`, `:284-297`, `:738`); other tabs via `storage` event (`:180-193`) |
| `sessionStorage` `xivdyetools_pkce_verifier` / `_oauth_state` / `_oauth_return_path` / `_oauth_return_tool` / `_oauth_provider` | `auth-service.ts:644-653, 692-697, 214` | flow secrets (PKCE verifier, CSRF nonce) | consumed + removed on callback (`:364-366`, `:239,249`, `:540`); provider marker also on logout (`:741`) |
| `sessionStorage` `pendingPresetId` | `preset-submission-form.ts:730` | no (preset id) | never (harmless) |
| `localStorage` `xivdyetools_v4_config_<tool>` | `config-controller.ts:405-406` | no — incl. `advanced` = `{"analyticsEnabled":false,"performanceMode":false}` (default `tool-config-types.ts:413-416`) | Reset settings (`advanced-options-panel.ts:249-254`); cross-tab re-read (`config-controller.ts:158-186`) |
| `localStorage` `xivdyetools_theme` / `_locale` / `_welcome_seen` / `_palette_hint_seen` / `_last_version_viewed` / `_tutorials_disabled` / tutorial keys | theme/language/welcome/tutorial services | no | Reset / individual actions |
| `localStorage` `xivdyetools_favorites` / `xivdyetools_collections` | `collection-service.ts:474,484` | **user's own** record names — a `kind:'character'` record and the on-device palette fallback default to the `.chara` nickname (`chara-import.ts:751-753`, `:1638-1642`) | Clear favourites / clear palettes actions; export is user-initiated |
| `localStorage` `v5_saved_presets` | `saved-presets-service.ts:21,58` | snapshot of public community presets incl. `author` display name (`:88`) | user action |
| `localStorage` per-tool `v3_*` keys (selected dyes, options, `v3_matcher_extracted_colors`, `v3_matcher_color`, `xivdyetools_swatch_glamour_view`, `v3_panel_*`, `v3_budget_target`) | tools | no (dye ids / hexes / booleans) | Clear dyes / Reset |
| **IndexedDB `xivdyetools` → `image_cache` / `v3_matcher_image`** | `extractor-tool.ts:437-447` (`persistImage`), called from `:1562-1565` | **the user's uploaded / pasted / camera-captured image** (data-URL ≤ 8 MB, `:92`) | only the extractor's Clear-image button (`:1640-1641`) or a failed restore (`:499-501`) — **not** Reset settings, **not** logout — see WEB-01 |
| IndexedDB `price_cache`, `palettes`, `settings` | `api-service-wrapper.ts`, `indexeddb-service.ts:109-121` | no | logout clears prices (`auth-service.ts:743`) |

`.chara` content persisted: only derived stainIDs plus the nickname/file-name used as a *local* record name (above). The parsed character object lives in memory (`chara-import.ts:254`, cleared in `destroy()` `:199-201`); `Base64Image` is never read (`:616`).

### Markup sinks (Perl scan of every `innerHTML =`/`innerHTML:` template literal + all `unsafeHTML` uses)

29 templates carry interpolations; every one resolves to an `ICON_*`/`LOGO_*`/`HARMONY_ICONS`/`TOAST_ICONS` constant, `LanguageService.t()`/`tInterpolate()` with code-controlled arguments (`v4-layout.ts:566` uses `toolDisplayName(toolId)` = a locale key; `:737` `toolId` is router-whitelisted), a number, a code-owned style string, or an `escapeHtml()`'d remote string (`my-submissions-modal.ts:106-113` — `preset.name` + `rejection_reason`; `empty-state.ts:237-239` — search query). `unsafeHTML()` only takes icon constants and the own-property `getCategoryIcon()` lookup (`category-icons.ts:44`, test `category-icons.test.ts:55`). `collapsible-panel.setContent()` (`:163-172`) accepts strings but all ten callers pass `HTMLElement`s. Remote preset text renders through Lit text bindings (`preset-detail.ts:930-985`, `config-sidebar.ts:1600-1620`); `href`/`src` from the API pass `sanitizeExampleLink`/`sanitizePreviewImageUrl` on the read path (`hybrid-preset-service.ts:187-188`, `preset-tool.ts:538-539,561`). No `insertAdjacentHTML`, `outerHTML`, `document.write`, `srcdoc`, `eval`, `new Function`, `postMessage`/`message` listener, `document.cookie`, or service worker in `src/`.

### Telemetry wire body (what actually leaves the browser — `telemetry-service.ts:193-201`)

```
{ v:1, ver:APP_VERSION, env:'production'|'beta', locale:<LocaleCode>, theme:<ThemeName>, vp:'m'|'t'|'d',
  events:[ {n:'tool_view',  p:{tool:ToolId, entry:'initial'|'share'|'nav'}},
           {n:'tool_leave', p:{tool, entry}, d:<0..1800 whole seconds>},
           {n:'dye_pick',   p:{tool, stainID:<number from a DB Dye>, via:'drawer'|'grid'}},
           {n:'chara_parse',p:{ok:boolean, producer:'anamnesis'|'ktisis'|'brio'|'other'|'none'}},
           {n:'theme_change',p:{to:ThemeName}} ] }
```

Producers: `v4-layout.ts:223,507`, `dye-selector.ts:280`, `chara-import.ts:237,250-253`, `theme-switch.ts:23` — nothing else calls `track()`. No identifier of any kind; `Date.now()` is used only to measure dwell (`:151,:256`) and never serialised.

---

## Candidates

### WEB-01 — Extractor persists uploaded and camera-captured images to IndexedDB, contradicting the privacy guide's "discarded when you … close the tab or reload"

| | |
|---|---|
| **Severity** | **MEDIUM** — CWE-359 (privacy violation) as a policy-vs-code mismatch: a published promise about the user's own photos is false, and the image survives across sessions on a shared device. Rated MEDIUM rather than HIGH because the data never leaves the device and the promise is about local discard, not collection. |
| **Exposure** | LOCAL (device; next user of the same browser profile) |
| **Rotation** | none |
| **Files** | `src/components/extractor-tool.ts:92` (cap), `:437-447` (`persistImage`), `:453-470` (`restoreImageFromStorage`), `:488` (restored on next visit), `:1562-1565` (called on every load), `:303-306` (camera/upload path feeds it), `src/components/image-upload-display.ts:488-491` (camera capture → `image-loaded`), `src/components/advanced-options-panel.ts:249-254` (Reset settings does not touch it), `PRIVACY.md:13-14, :28-31` |

```ts
// extractor-tool.ts:437-441
private async persistImage(dataUrl: string): Promise<void> {
  if (dataUrl.length < MAX_IMAGE_STORAGE_SIZE) {
    const ok = await indexedDBService.set(STORES.IMAGE_CACHE, STORAGE_KEYS.imageDataUrl, dataUrl);
// extractor-tool.ts:1562-1565 (onImageLoaded — upload, drop, paste AND camera capture)
if (dataUrl) { void this.persistImage(dataUrl); }
// PRIVACY.md:13-14
"…camera-captured images never leave your device. They are read with the browser's Canvas API
 and discarded when you clear the image, close the tab or reload."
```

**Trigger.** Upload / drop / paste / webcam-capture any image ≤ 8 MB in the Palette Extractor, close the tab. Reopen `/extractor` in the same profile: `restoreImageFromStorage()` reloads the image and re-runs extraction (`:466-468, :488`). "Reset settings" (`resetAllConfigs()`), "Clear dyes", and logout leave it in place; only the extractor's own Clear button (`:1640-1641`) removes it.

**Impact.** The guide's *Images and camera captures* section states the opposite of the behaviour, and the *What is stored on your device* list (`:28-30`) omits the image cache entirely. A shared/library machine shows the previous person's photo (webcam selfies included) to the next visitor. The locale promises "never uploaded" (`en.json:315-317, :761`) remain true — this is persistence, not transmission.

**Fix.** Either (a) stop persisting by default (session-only `currentImage`, or persist behind an explicit "remember my image" setting), or (b) keep the feature and correct `PRIVACY.md` (say the last image is kept in the browser's IndexedDB until cleared, list it under *What is stored on your device*), and make "Reset settings" call `indexedDBService.delete(STORES.IMAGE_CACHE, …)`. Add a unit test asserting Reset clears `image_cache`.

---

### WEB-02 — `index.html` preconnects to `universalis.app` on every page load although production never fetches from it; the guide says only first-party hosts are contacted

| | |
|---|---|
| **Severity** | **LOW** — third-party TLS connection (IP + SNI `universalis.app`) on every visit regardless of the "Show Prices" toggle; no data beyond the connection itself. CWE-359 (policy accuracy) + dead CSP allowance. |
| **Exposure** | INTERNET-UNAUTH (every visitor) |
| **Rotation** | none |
| **Files** | `src/index.html:67-68`; `src/services/api-service-wrapper.ts:49-53` (PROD → `data.xivdyetools.app/universalis`); `public/_headers:25` (`connect-src … https://universalis.app`); `src/__tests__/security-headers.test.ts:100-102` (regex still admits `universalis.app`); `PRIVACY.md:35-40` |

```html
<!-- index.html:67-68 -->
<link rel="dns-prefetch" href="https://universalis.app" />
<link rel="preconnect" href="https://universalis.app" crossorigin />
```
```ts
// api-service-wrapper.ts:49-52 — the only Universalis client
if (import.meta.env.PROD) { const proxyUrl = 'https://data.xivdyetools.app/universalis'; … return proxyUrl; }
```

**Trigger.** Any page load. The bundle's only other `universalis.app` references are user-clicked links (`result-card.ts:158` via `window.open` `:1433`, `about-modal.ts:279`).

**Impact.** Every visitor's IP reaches Universalis before they opt into prices, while `PRIVACY.md:35-40` says the app "talks only to these first-party hosts … plus the one third party named below" and describes Universalis as reached through the proxy. The `connect-src https://universalis.app` allowance is likewise dead in production (only the dev fallback at `:55-58` uses it) and, unlike `*.workers.dev`, is not attacker-controllable — so it is hygiene, not an exfil origin.

**Fix.** Delete the two hints (keep the own-subdomain preconnects at `:70-75`); drop `https://universalis.app` from `connect-src` and tighten the test regex at `security-headers.test.ts:101` to `xivdyetools\.app` only; if a dev build needs direct Universalis, put it in a local `_headers` override as the file's own comment (`:22-23`) already prescribes.

---

### WEB-03 — Sign-in modal promises "No character data" while XIVAuth sessions carry `primary_character {name, server}` in the stored token

| | |
|---|---|
| **Severity** | **LOW** — inaccurate user-facing privacy statement; the data is the user's own, stays in their browser, and is never rendered or sent by the web-app. CWE-359. |
| **Exposure** | INTERNET-AUTH (XIVAuth sign-ins) |
| **Rotation** | none |
| **Files** | `src/locales/en.json:1072` (`preset.privacyNote`), rendered `src/components/signin-modal.ts:62`; `src/services/auth-service.ts:325, :486` (`primary_character` copied into `AuthUser`), `:462` (whole JWT persisted), `:493-496` (dev-only log of name @ world); oauth side: `apps/oauth/src/handlers/xivauth.ts:357-361, :369, :382`, `apps/oauth/CHANGELOG.md:17` ("only a `verified: true` character may become `username` / `global_name` (the preset author name downstream)") |

```ts
// auth-service.ts:493-496
if (provider === 'xivauth' && payload.primary_character) {
  logger.info(`Logged in via XIVAuth as ${payload.username} (${payload.primary_character.name} @ ${payload.primary_character.server})`);
```
```json
// en.json:1072
"privacyNote": "We store your display name and provider ID. No character data, no email, nothing sold."
```

**Trigger.** Sign in with XIVAuth. The token minted by `auth.xivdyetools.app` contains `primary_character: {name, server, verified}`; the SPA stores it verbatim in `localStorage` and in memory. Nothing in `src/` reads `primary_character` except the two copies and the dev log (grep), so the claim is carried for no client purpose.

**Impact.** For XIVAuth users the modal's statement is false twice over: the character name *is* the display name (oauth uses the verified character as `username`), and the home world is stored alongside it. `PRIVACY.md:42-45` is vaguer ("the account identity you sign in with is stored … the author name is shown") and does not name character/world either.

**Fix.** Reword `preset.privacyNote` in all six locales (e.g. "We store your display name — for XIVAuth, your verified character's name — and your provider ID. No email, nothing sold.") and add the world to `PRIVACY.md` §3 if oauth keeps issuing it; or ask the oauth reviewer/owner to drop `server` from the claim and the SPA to stop copying `primary_character` into `AuthUser` (`auth-service.ts:325,486`). Cross-link: oauth unit (JWT claim contents, D1 storage of the character name).

---

### WEB-04 — SPA fallback + `immutable` on `/assets/*` lets an HTML body be edge-cached under a script URL for a year (cache-poisoning availability hazard)

| | |
|---|---|
| **Severity** | **LOW** — availability only (CWE-524-style cache poisoning of static assets); already bitten once organically (looked like a partial deploy). No confidentiality/integrity impact: the poisoned body is the site's own `index.html`. |
| **Exposure** | INTERNET-UNAUTH (any client can request a not-yet-existing `/assets/…` URL; the window is a deploy) |
| **Rotation** | none |
| **Files** | `public/_redirects:3`; `public/_headers:53-54`; `functions/_middleware.ts:6-23` (runs on every request, only rewrites the legacy hostname); no `_routes.json` (`git ls-files apps/web-app` — none) |

```
# _redirects:3
/* /index.html 200
# _headers:53-54
/assets/*
  Cache-Control: public, max-age=31536000, immutable
```

**Trigger.** `GET https://xivdyetools.app/assets/<hash-not-yet-at-this-edge>.js` while a deployment propagates (or any deliberate request for a non-existent asset name). Pages serves the `/*` rewrite (index.html, 200, `text/html`) and the `/assets/*` block stamps it `immutable` for a year — the "pattern merge" the file's own comment (`:75-81`) describes.

**Impact.** Visitors routed through that edge load HTML where the module script should be and get a blank app until someone purges the exact URL; the symptom is indistinguishable from a partial deploy (see `docs/` memory of the 2026-08 incident). Deliberate exploitation needs the attacker to guess or race a content-hash, so it is mostly self-inflicted risk — hence LOW.

**Fix.** In `functions/_middleware.ts`, for `url.pathname.startsWith('/assets/')`: `const res = await next(); if (res.headers.get('content-type')?.includes('text/html')) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });`. Alternatively migrate the site to Workers Static Assets with `not_found_handling = "single-page-application"`, which never rewrites under `/assets/`. Add an e2e/smoke assertion that a bogus `/assets/x.js` returns non-200.

---

### WEB-05 — `TelemetryService.track()` has no client-side property allowlist; only api-worker's schema stands between a future call site and free text on the wire (INFO)

| | |
|---|---|
| **Severity** | INFO (guardrail) |
| **Exposure** | n/a today — every current producer passes enumerated values |
| **Files** | `src/services/telemetry-service.ts:36` (`TelemetryProps = Record<string, string | number | boolean>`), `:121` (`track(name, props, value?)`); server allowlist `apps/api-worker/src/telemetry/schema.ts:93-` |

A new caller could ship `{ tool, query: this.searchQuery }` or a preset name and the type system would accept it; api-worker would not *store* an unknown dim (fixed column mapper), but the text would still transit to the worker. Suggest a discriminated union keyed on `n` (`{n:'dye_pick'; p:{tool:ToolId; stainID:number; via:DyePickVia}}` …) so `track()` cannot be called with a free-form prop, plus a unit test that snapshots each event's `Object.keys(p)`. The existing tests pin the envelope keys (`telemetry-service.test.ts:153-175`, `e2e/telemetry.spec.ts:100-102`) but not the per-event props.

---

### WEB-06 — Toggle copy omits theme switches, dwell seconds and the batch envelope that the privacy guide lists; no link from the toggle to the guide (INFO)

| | |
|---|---|
| **Severity** | INFO (accuracy of consent copy) |
| **Files** | `src/locales/en.json:223` (`config.analyticsDesc` = "Share anonymous usage data — which tools and dyes are used, and .chara imports. No identifiers, no images."), `src/components/advanced-options-panel.ts:365-368`; `PRIVACY.md:66-76` (tool views incl. seconds visible, dye picks, chara imports, **theme switches**, five envelope dimensions) |

Nothing stated is false, but the consent text is a subset of what `flush()` sends (`telemetry-service.ts:193-201`): `theme_change`, `tool_leave.d`, `ver/env/locale/theme/vp`. Suggest "…which tools, dyes and themes are used, how long tools stay open, and .chara imports…" and a "Privacy guide" link beside the toggle (the extractor's notice already links there, `PRIVACY.md:15`). Six-locale change; the i18n parity gate covers it.

---

### WEB-07 — Privacy guide says the character name is "never used as … a default palette name"; on-device records do default to it (INFO)

| | |
|---|---|
| **Severity** | INFO (wording; local-only, deliberate, tested) |
| **Files** | `PRIVACY.md:19-20`; `src/components/chara-import.ts:751-753` (character record name = `nickname ?? fileName ?? default`), `:1638-1642` (`localPaletteName()` fallback), `:666` (loaded-file card title); test `chara-import-palette-name.test.ts:109` ("names the on-device record after the character when the field is empty (local only)") |

The community path is correct: `communityPaletteName()` returns the typed draft only (`:1627-1628`, tests `:83-99`), and no other entry point pre-fills the submission form from a saved collection (`showPresetSubmissionForm` callers: `swatch-tool.ts:1552` draft-only, `config-sidebar.ts:1691` none). Only the sentence over-promises. Suggest "never used as a community-visible name (a locally saved record may default to it until you rename it)".

---

### WEB-08 — Dead `window.Sentry` forwarding hook (INFO)

`src/shared/error-handler.ts:99-110` forwards `AppError` objects to `window.Sentry.captureException` if such a global exists. Nothing loads Sentry, `script-src 'self'` would block it, and DOM clobbering cannot produce a callable — so it is unreachable, but it is the one place in `src/` that would hand error context to a third party. Delete it to keep `PRIVACY.md:52` ("no third-party analytics scripts") mechanically true.

---

### WEB-09 — Hardening notes (INFO)

- `public/_headers` sets no `Cross-Origin-Opener-Policy` / `Cross-Origin-Resource-Policy`. The OAuth flow is a top-level redirect (`auth-service.ts:667,711`) and the only `window.open` passes `noopener` (`result-card.ts:1433`), so `COOP: same-origin` is safe to add and closes the XS-Leaks/tabnabbing class for free. Pin it in `security-headers.test.ts`.
- The localStorage-JWT trade-off is documented only in `auth-service.ts:62-80`; `docs/architecture/security-trade-offs.md` does not list it (grep: no `localStorage`). Add a section so the next audit stops re-deriving it.
- `vite.config.ts:26` `sourcemap: true` still ships `.map` files (WEB-10, accepted 2026-08-21) — unchanged, not re-filed.

---

## Positive controls (verified this round — do not re-file)

**Telemetry client (primary PII surface)**
- Opt-in default **off**: `tool-config-types.ts:413-416` (`analyticsEnabled: false`), stored as `localStorage['xivdyetools_v4_config_advanced']` (`config-controller.ts:34,405`); `TelemetryService.initialize()` reads it once and subscribes (`telemetry-service.ts:96-110`).
- GPC honoured **at send time, not only at toggle time**: `isEnabled()` (`:117-119`) is evaluated in `track()` (`:123`) and again in `flush()` (`:189-192`, which also empties the queue when disabled); test `telemetry-service.test.ts:122-129`.
- Cross-tab opt-out really stops sends: `ConfigController` listens for `storage` events (`config-controller.ts:158-186`, including `event.key === null` for `localStorage.clear()`), re-reads and notifies; the subscriber drops the queue (`telemetry-service.ts:106-108`). Anything already handed to `sendBeacon` is the only irrecoverable in-flight batch.
- No client-generated identifier: no UUID/random/counter; `Date.now()` only measures dwell (`:151,:256`); `makeCustomDye`'s `Date.now()`-based synthetic id (`custom-dye.ts:41`) never reaches telemetry because custom dyes have `stainID: null` (`:45`) and both pick hooks require a numeric `stainID` (`v4-layout.ts:222`, `dye-selector.ts:279`).
- Every field is enumerated/coarse: `tool` = router-validated `ToolId`; `entry`/`via`/`ok`/`producer`/`to`/`vp` are closed sets; `locale` comes from `LanguageService.getCurrentLocale()` which only ever holds a value that passed `isValidLocale()` (`language-service.ts:57,96-98,291-293`); `theme` is `ThemeName = 'standard-light' | 'standard-dark'` (`shared/types.ts:26`); dwell is whole seconds capped at 1800 (`:169`); `ver` is a per-build constant (adds no cross-user entropy).
- Nothing from the `.chara` (`TypeName`/`Nickname`/world/gear), preset names, palette names, search text or file names can reach the beacon: `normalizeProducer()` buckets `TypeName` (`:177-184`); `chara_parse` failure sends `producer:'none'` (`chara-import.ts:237`); the only `dye-selected` emitters are the drawer swatch/random paths (`dye-palette-drawer.ts:849,871`) and the grid (`dye-grid.ts:67`) — result cards and the glamour block emit no such event (grep), so tool-computed matches are never counted.
- Off means off on every path: `theme_change` flush runs only after the `isEnabled()` gate (`:123` before `:126`), so Shift+T (`keyboard-service.ts:143` → `toggleThemeVariant` → `switchTheme`, `theme-switch.ts:19-33`) sends nothing; `visibilitychange`/`pagehide` flushes (`:65-77`) go through the same `flush()` gate; `fetch(keepalive)` fallback is reached only from `send()` after that gate (`:229-239`). e2e proves zero requests with the toggle off including a forced `pagehide` (`e2e/telemetry.spec.ts:66-79`); unit test `:106-112`.
- Endpoint fixed at build time: `getApiWorkerBase()` reads `import.meta.env.VITE_API_WORKER_URL` or the `PROD`/`DEV` constant (`api-worker-origin.ts:15-19`) — no query/localStorage/global override.
- Envelope shape pinned by tests: `telemetry-service.test.ts:153-175` (exact key set + values) and `e2e/telemetry.spec.ts:100-104` (exact key set, `text/plain`). Old `xiv_share_analytics` buffer removed at boot (`main.ts:108`).

**`.chara` import / glamour block**
- 20 MB cap before `file.text()` (`chara-import.ts:210-215`, `constants.ts:127`), shared with the image inputs (`extractor-tool.ts:1586`, `image-upload-display.ts:314`); tests `chara-import-file-guard.test.ts:71-95,163`.
- Resolve request = model integers only (`chara-resolve-service.ts:115-116`, `chara-models.ts:24-32`); icons from a fixed base + numeric `iconId` (`:72-74`); envelope validated (`:150-158`); 12 s timeout (`:69`). `Base64Image` never read (`chara-import.ts:616`).
- Community palette name is the typed draft only (`:1627-1628`), never nickname or file name — tests `chara-import-palette-name.test.ts:83-99`; local fallback stays local (WEB-07 wording only).

**OAuth / session**
- Unchanged from 2026-08-21 (PKCE S256, 32-byte state, fail-closed CSRF `:374-377`, `sanitizeReturnPath` `:113-152`, `replaceState` + reload `:553-557`) plus the delta fixes: signed `state` forwarded in both POST bodies (`:400-405`, FINDING-012; tests `auth-service.test.ts:945-1006`); `?provider=` honoured only with a `code` and only for `discord|xivauth` (`:212-215`, `:339-341`, FINDING-032/WEB-3; tests `:851-901`); `login()` clears a stale marker (`:650`); logout clears token/expiry/provider (`:576-580`), the session marker (`:741`) and the price cache (`:743`), revokes server-side (`:727-732`), and propagates to other tabs (`:180-193`). Bearer only ever goes to the two build-time origins.

**Headers**
- CSP as above; `connect-src` has no `*.workers.dev` (WEB-5/FINDING-031, test `security-headers.test.ts:84-93`); `object-src`/`frame-src 'none'` (`:106-109`); `camera=(self)` (WEB-7, `:119-130`); no `X-XSS-Protection` (WEB-8, `:112-115`); HSTS preload, nosniff, `X-Frame-Options: DENY`, `Referrer-Policy` (`:132-139`); beta `X-Robots-Tag` appended by a directive-checked guard, never in the production file (`beta-branding.ts:44-52`, `vite-plugin-beta-branding.ts:63-68`, test `:141-146`); `/og/*` moved out from under `/assets/*` to escape the pattern merge (`_headers:75-83`).

**Sinks / third parties / supply chain hygiene**
- WEB-1 fixed (`escapeHtml` on `preset.name` + `rejection_reason`, `my-submissions-modal.ts:106-113`; helper `utils.ts:26-28`); WEB-2 fixed (`getEmptyStateHTML` escapes, `empty-state.ts:237-239`); WEB-4 fixed (`community-preset-service.ts:151-155`); WEB-6 fixed (`collection-service.ts:292-306`, `:1040-1042`; tests `collection-service-branches.test.ts:57-123`); WEB-9 fixed (`renderFatalError` DOM builder, `main.ts:162-167`; tests `fatal-error.test.ts:29-39`); WEB-11 fixed (`encodeURIComponent` at every id segment); WEB-12 fixed (`category-icons.ts:44`, test `:55`); WEB-13 fixed (see above); WEB-14 fixed (`example-link.ts:56-77` applied on both read paths; tests `example-link.test.ts:38-68`).
- `src/index.html` loads only `/main.ts`; fonts self-hosted; no third-party script/style/iframe; no service worker; no `postMessage`; `VITE_*` are endpoint overrides only (`vite-env.d.ts:6-19`); `define` injects version/build date/env only; no `.env`/`.dev.vars` tracked (root `.gitignore:11-13,28-30`); `public/` holds icons, fonts, two JSON tables, two OG PNGs, manifest/sitemap — no samples or test pages; `lit ^3.3.3`.
- Browser logger: `info/debug/warn` are `import.meta.env.DEV`-only (`shared/logger.ts:40-81`), so every dye-name / file-name / username `logger.info` line listed in `pii-sinks.txt` for this unit is a no-op in production and never leaves the device; `logger.error` (always on) is never handed the token (grep `auth-service.ts`).

---

## Rejected (checked and dropped)

| Candidate | Reason |
|---|---|
| `ver` full version string in the envelope | per-build constant identical for every visitor — zero fingerprint entropy; listed in `PRIVACY.md:75` and the spec |
| `d` (dwell) as a timing fingerprint | whole seconds, capped 1800, per tool view; policy lists it (`PRIVACY.md:66-67`) |
| `dye_pick` leaking `.chara`/extractor colours | only drawer-swatch and grid picks emit; glamour block and result cards emit no `dye-selected`; custom dyes have `stainID:null` |
| `logger.info` of `file.name` (`chara-import.ts:268`), usernames (`auth-service.ts:257,495,498`), dye names (many) | dev-only console (`logger.ts:65-81`); not a log sink in production |
| `?error=` param echoed to `logger.error` (`auth-service.ts:243`) | console only, string, not rendered |
| JWT `avatar` hash → `cdn.discordapp.com` URL (`auth-service.ts:807-811`) | host fixed; value from the signed token; Lit attribute binding |
| XIVAuth avatar host missing from `img-src` | `avatar_url` is always `null` for XIVAuth (`auth-service.ts:307-311`); nothing loads |
| `sessionStorage['pendingPresetId']` | preset id, not personal |
| `v5_saved_presets` carrying `author` | public preset metadata the user chose to save; local |
| `v3_matcher_extracted_colors` / `v3_matcher_color` | the user's own hexes; "saved work" in the on-device list |
| `window.Sentry` | unreachable (WEB-08 INFO) |
| `hybrid-preset-service.ts:359` `id.replace('community-','')` | encoded downstream (`community-preset-service.ts:321`) |
| `renderPlaceholder(container, toolId)` / `tInterpolate` args into `innerHTML` (`v4-layout.ts:566,737`) | `toolId` router-whitelisted; args are locale keys |
| `collapsible-panel.setContent(string)` | all ten callers pass `HTMLElement`s |
| `swatch-tool.ts:2294` `glyph.innerHTML = target.icon` / `welcome-modal.ts:220` / `harmony-tool.ts:1170` / `dye-action-dropdown.ts:193` / `preset-category-selector.ts:163` | code-owned icon constants / own-property lookup |
| Beta app writing to production preset data | by design; `PRIVACY.md:3` covers both hosts |
| core `chara-parser.ts:291` unbounded `JSON.parse` | web-app gates at 20 MB first; packages reviewer's scope |
| `functions/_middleware.ts` redirect | fixed hostname target, no user input |
| SPA-route HTML without explicit `Cache-Control` | Pages default; not a security property |
| `preconnect` to `auth`/`api`/`data.xivdyetools.app` | first-party |
| `deploy-web-app-beta.yml` `VITE_APP_ENV` | build-time env marker only; CI reviewer's unit |

---

## Files covered

**Read in full:** `apps/web-app/PRIVACY.md`, `package.json`, `vite.config.ts`, `vite-plugin-beta-branding.ts`, `public/_headers`, `public/_redirects`, `functions/_middleware.ts`, `src/index.html`, `src/main.ts`, `src/vite-env.d.ts`, `src/services/telemetry-service.ts`, `src/services/api-worker-origin.ts`, `src/services/theme-switch.ts`, `src/services/auth-service.ts`, `src/services/storage-service.ts`, `src/services/chara-resolve-service.ts`, `src/shared/logger.ts`, `src/shared/utils.ts`, `src/shared/example-link.ts`, `src/components/signin-modal.ts`, `src/__tests__/security-headers.test.ts`, `e2e/telemetry.spec.ts`; cross-refs `docs/superpowers/specs/2026-08-29-web-analytics-design.md`, `docs/audits/2026-08-21-security/evidence/review-web-app.md`, `docs/audits/2026-08-29-security/evidence/REVIEWER_BRIEF.md`.

**Read in targeted ranges:** `src/services/config-controller.ts` (150-200), `api-service-wrapper.ts` (1-120), `share-service.ts` (320-400), `collection-service.ts` (275-330, 930-1075), `hybrid-preset-service.ts` (340-370), `preset-submission-service.ts` (216-240), `index.ts` (95-150), `__tests__/telemetry-service.test.ts` (100-200); `src/shared/custom-dye.ts` (1-80), `constants.ts` (24-39, 82-127), `tool-config-types.ts` (265-272, 374-416), `beta-branding.ts` (41-52), `error-handler.ts` (95-115); `src/components/v4-layout.ts` (190-240, 440-560, 700-745), `dye-selector.ts` (255-295), `chara-import.ts` (195-275, 600-700, 735-770, 1470-1500, 1610-1671), `extractor-tool.ts` (301-312, 425-510, 1560-1680), `image-upload-display.ts` (295-360), `camera-preview-modal.ts` (225-270), `advanced-options-panel.ts` (200-300), `my-submissions-modal.ts` (90-200), `empty-state.ts` (225-250), `dye-grid.ts` (70-105, 155-190, 360-370), `swatch-tool.ts` (1535-1565, 2215-2243, 2270-2305), `preset-submission-form.ts` (600-640, 675-740), `preset-edit-form.ts` (540-560), `v4/preset-detail.ts` (841-861, 925-1000), `v4/config-sidebar.ts` (1590-1640), `harmony-tool.ts` (1160-1175), `welcome-modal.ts` (205-225), `preset-category-selector.ts` (155-170), `dye-action-dropdown.ts` (180-200), `collapsible-panel.ts` (160-172); `packages/core/src/services/chara/chara-models.ts` (24-32).

**Grepped only (tracked files):** all 123+ non-test `src/**/*.ts` for `innerHTML|unsafeHTML|unsafeSVG|insertAdjacentHTML|document.write|outerHTML|srcdoc|new Function|eval(`, `setItem|removeItem|localStorage.|sessionStorage.|StorageService.`, `TelemetryService.`, `postMessage|'message'|window.open|location.href|assign|replace|document.cookie|serviceWorker|caches.|import(`, `PRESET_API_URL|(window as|window.__`, `'dye-selected'`, `random: true`, `sanitizeExampleLink|sanitizePreviewImageUrl`, `onImageLoaded|image-loaded|showCameraPreviewModal`, `charaIconUrl|iconId`, `FormData|multipart|preview|exampleLink`, `universalis.app|VITE_UNIVERSALIS_PROXY_URL`, `primary_character`, `fetch(|encodeURIComponent`, `shotSlot`; `src/services/language-service.ts`, `theme-service.ts`, `router-service.ts`, `keyboard-service.ts`, `market-board-service.ts`, `camera-service.ts`, `indexeddb-service.ts`, `saved-presets-service.ts`, `community-preset-service.ts`, `tutorial-service.ts`; `src/components/v4/dye-palette-drawer.ts`, `v4/v4-layout-shell.ts`, `v4/theme-modal.ts`, `v4/result-card.ts`, `offline-banner.ts`, `shared/types.ts`, `shared/category-icons.ts`; `src/locales/en.json`; tests `__tests__/auth-service.test.ts`, `chara-import-palette-name.test.ts`, `chara-import-file-guard.test.ts`, `collection-service-branches.test.ts`, `category-icons.test.ts`, `example-link.test.ts`, `fatal-error.test.ts`; `scripts/smoke-test-pages.js`; `apps/api-worker/src/telemetry/schema.ts`; `apps/oauth/CHANGELOG.md`, `apps/oauth/src/handlers/xivauth.ts`, `refresh.ts`, `services/jwt-service.ts`; `packages/core/src/services/chara/chara-parser.ts`; `docs/architecture/security-trade-offs.md`; `.github/workflows/deploy-web-app*.yml`; root `.gitignore`; `docs/audits/2026-08-29-security/evidence/{delta-files-by-unit.txt, pii-sinks.txt, pii-sources.txt}` (web-app rows).

**Not reviewed:** `scripts/` beyond the smoke test, `eslint-rules/`, `knip.jsonc`, `e2e/` beyond `telemetry.spec.ts`, Lit shell CSS, `@xivdyetools/core` internals (packages reviewer), sibling workers beyond the grep context above.
