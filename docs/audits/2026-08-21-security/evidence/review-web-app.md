# Manual Security Code Review — `apps/web-app` (browser SPA)

| | |
|---|---|
| **Date** | 2026-08-21 |
| **Scope** | `apps/web-app` (Vite + Lit + Tailwind SPA deployed to Cloudflare Pages at `xivdyetools.app` / `beta.xivdyetools.app`). Read-only review; no source files were modified. |
| **Method** | Risk-prioritised manual review: full reads of every service that touches auth, remote data, storage or URLs; targeted reads of every markup sink found by ripgrep plus a custom template-literal interpolation scanner (`scan-innerhtml.mjs`, scratchpad) that walks every `innerHTML =` / `innerHTML:` / `insertAdjacentHTML` / `unsafeHTML(` / `getEmptyStateHTML(` template and lists the non-constant `${…}` expressions inside it. Sibling workers (`apps/oauth`, `apps/presets-api`) were grepped only where needed to confirm a data flow. |
| **Deployed CSP** (`public/_headers:17`) | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob: https://cdn.discordapp.com https://shots.xivdyetools.app https://data.xivdyetools.app; connect-src 'self' https://universalis.app https://*.workers.dev https://*.xivdyetools.app; base-uri 'self'; form-action 'none'; frame-ancestors 'none'; upgrade-insecure-requests;` |

**CSP impact on severities.** `script-src 'self'` with no `'unsafe-inline'`/`'unsafe-eval'` means a DOM-XSS markup injection cannot execute script (inline handlers, `<script>`, `javascript:` URLs are all blocked) and therefore cannot read the localStorage JWT. What a markup injection *can* still do: inject phishing UI / links / forms (`form-action 'none'` stops native submits, but a plain `<a href="https://evil">` works), inject CSS (`style-src 'unsafe-inline'`), clobber DOM globals, and trigger image/fetch beacons to the origins the CSP allows. Severities below are rated with that ceiling in mind.

---

## Summary table

| ID | Severity | Location | Title | Confidence |
|---|---|---|---|---|
| WEB-1 | MEDIUM | `src/components/my-submissions-modal.ts:104,138,146,154` | Remote strings (`preset.name`, `preset.rejection_reason`) interpolated raw into `innerHTML` — stored markup injection in the My Submissions modal | CONFIRMED (sink + source traced) |
| WEB-2 | LOW | `src/components/dye-grid.ts:76-91`, `src/components/empty-state.ts:234-243`, `src/components/dye-selector.ts:174-176` | Dye-search query interpolated unescaped into an HTML string (self-XSS pattern; the codebase has no `escapeHtml` helper at all) | CONFIRMED |
| WEB-3 | LOW | `src/services/auth-service.ts:206-211, 340, 608-642` | Unvalidated `?provider=` URL parameter is persisted to sessionStorage and never cleared by `login()` — a crafted link breaks/misroutes the victim's next Discord sign-in | PLAUSIBLE (logic traced, not executed) |
| WEB-4 | LOW | `src/services/community-preset-service.ts:142-148` | API base URL read from a clobberable `window.PRESET_API_URL` global; with `connect-src https://*.workers.dev` this is a latent token-redirection primitive for any markup injection | PLAUSIBLE (not exploitable in current module load order) |
| WEB-5 | LOW | `public/_headers:17` | `connect-src https://*.workers.dev` is not used by the production bundle and gives any injection an attacker-controllable beacon/exfil origin | CONFIRMED (bundle grep) |
| WEB-6 | INFO | `src/services/collection-service.ts:920-1008`, `src/services/config-controller.ts:268-276`, `src/services/collection-service.ts:257-315` | Import/persistence paths validate shape loosely (`kind` unvalidated, per-tool config objects merged raw, `loadCollections` assumes array fields) | CONFIRMED |
| WEB-7 | INFO | `public/_headers:24` vs `src/services/camera-service.ts:148,188` | `Permissions-Policy: camera=()` disables the webcam capture path the app ships | PLAUSIBLE |
| WEB-8 | INFO | `public/_headers:22` | `X-XSS-Protection: 1; mode=block` is deprecated; should be `0` or removed | CONFIRMED |
| WEB-9 | INFO | `src/main.ts:106-123` | Fatal-error fallback uses an inline `onclick` (blocked by CSP → dead Reload button) | CONFIRMED |
| WEB-10 | INFO | `vite.config.ts:26` | `sourcemap: true` ships 39 `.map` files to production (MIT project, no secrets — noted only) | CONFIRMED |
| WEB-11 | INFO | `src/services/community-preset-service.ts:312,368,426,478`; `src/services/preset-submission-service.ts:157,182,425,540`; `src/services/hybrid-preset-service.ts:354-358` | Path segments concatenated into API URLs without `encodeURIComponent` | CONFIRMED (harmless today) |
| WEB-12 | INFO | `src/shared/category-icons.ts:43-45` → `src/components/v4/preset-detail.ts:865,871` | `CATEGORY_ICONS[name]` prototype-chain lookup feeds `unsafeHTML()`; a non-own key throws inside Lit | PLAUSIBLE (API controls the value) |
| WEB-13 | INFO | `src/components/extractor-tool.ts:1540-1597,1604-1625`; `src/components/chara-import.ts:195-220` | Drop/paste image path and `.chara` loader have no size cap (`image-upload-display.ts:310` has 20 MB) — self-DoS only | CONFIRMED |
| WEB-14 | INFO | `src/components/v4/preset-detail.ts:904-917`, `src/components/v4/preset-card.ts:336,367` | `exampleLink` / `previewImageUrl` from the API are rendered as `href`/`src` trusting the server allowlist only (defense-in-depth) | CONFIRMED |
| WEB-15 | INFO | `src/services/auth-service.ts:55-100, 436-438` | JWT in localStorage — documented trade-off; mitigations verified, residual risk stated | CONFIRMED |

No CRITICAL or HIGH findings. No secret material, third-party script, iframe, `postMessage` handler, service worker, `eval`/`Function`, `document.cookie`, `srcdoc` or `structuredClone` usage was found in the web app.

---

## Findings

### WEB-1 — Remote strings interpolated raw into `innerHTML` in the My Submissions modal

| | |
|---|---|
| **Severity** | **MEDIUM** — stored, cross-user (moderator → author) markup injection. CSP stops script execution and token theft, so the realistic impact is phishing UI / arbitrary links / CSS defacement / DOM clobbering inside a trusted modal; hence MEDIUM rather than HIGH. |
| **CWE** | CWE-79 (Improper Neutralization of Input During Web Page Generation) |
| **Files** | `src/components/my-submissions-modal.ts:104` (source selection), `:138` (`${preset.name}`), `:146` (`${note}`), `:154` (`content.innerHTML = …`) |
| **Confidence** | CONFIRMED — sink and both sources read in full. |

**Code excerpt**

```ts
// my-submissions-modal.ts:100-105
const note =
  kind === 'live' ? ''
  : kind === 'rejected' ? preset.rejection_reason || t('preset.reviewNote')
  : t('preset.reviewNote');
…
// :138
<span style="…">${preset.name}</span>
…
// :146
? `<div style="…">${note}</div>`
…
// :154
content.innerHTML = `
  …
  ${rows || `<p …>${t('preset.noSubmissionsYet')}</p>`}
`;
```

**Data flow (source → sink)**

1. `presetSubmissionService.getMySubmissions()` (`preset-submission-service.ts:293-329`) → `GET https://api.xivdyetools.app/api/v1/presets/mine` → `result.presets` returned untouched.
2. `preset.rejection_reason` is, per the file's own comment (lines 98-99), "the actual moderation reason (joined by the API from moderation_log)" — text typed by a moderator in the moderation bot. `preset.name` is the author's own (server-validated for length, not for markup).
3. Both are concatenated into an HTML template string and assigned via `content.innerHTML` (line 154). No escaping helper exists anywhere in `src/` (ripgrep for `escapeHtml|sanitize|DOMPurify` returns only the auth-service `sanitizeReturnPath` function).

**Exploit scenario**

A moderator (or anyone who can write to `moderation_log` / the presets D1, e.g. via a bug in `moderation-worker` or `presets-api`) rejects a preset with the reason
`Policy violation. <a href="https://xivdyetools-appeals.example" style="color:var(--theme-primary)">Appeal here — sign in with Discord</a>` (or a full-modal overlay via `<div style="position:fixed;inset:0;…">`). The next time the author opens *My Submissions*, the link/overlay renders inside the app's own modal. CSP blocks `onclick=`/`<script>`, but the phishing link is fully clickable and styled as app UI. `${preset.name}` is self-only (author's own string) and is therefore a low-value self-XSS, but it is the same sink.

**Recommended fix**

- Build the rows with `document.createElement` + `textContent` (the pattern used everywhere else in the app, e.g. `collection-manager-modal.ts:131,138`, `toast-container.ts:130`), or add a tiny `escapeHtml()` to `src/shared/utils.ts` and apply it to *every* interpolated value in this file (`preset.name`, `note`, `statusLabel` is static, `tint()`/`tone` are code-controlled).
- Add an ESLint rule / test that fails when a template literal assigned to `innerHTML` contains a `${…}` whose expression is not `LanguageService.t(...)` or an `ICON_*` constant (the scanner used for this review is a starting point).

---

### WEB-2 — Dye-search query interpolated unescaped into an HTML string

| | |
|---|---|
| **Severity** | **LOW** — self-XSS only today (the query is what the user just typed; no URL/deep-link parameter seeds it — verified: `dye-selector.ts:174-176` sets `searchQuery` only from the `search-changed` DOM event, and no `params.get('q'|'search'|'query')` exists in `src/`). Rated LOW rather than INFO because it is an unescaped-interpolation pattern in a shared helper that any future deep-link parameter would turn into reflected XSS. |
| **CWE** | CWE-79 |
| **Files** | `src/components/dye-grid.ts:76-91`; `src/components/empty-state.ts:234-243` (`getEmptyStateHTML`) |
| **Confidence** | CONFIRMED |

**Code excerpt**

```ts
// dye-grid.ts:78-84
getEmptyStateHTML({
  icon: ICON_STATE_SEARCH,
  title: LanguageService.tInterpolate('dyeSelector.noResults', { query: this.emptyState.query || '' })
         || `No dyes match "${this.emptyState.query}"`,
  description: LanguageService.t('dyeSelector.noResultsHint'),
});
…
wrapper.innerHTML = emptyHtml;            // :91

// empty-state.ts:236-241
return `<div class="empty-state">
  <div class="empty-state-icon" aria-hidden="true">${iconContent}</div>
  <h3 class="empty-state-title">${options.title}</h3>
  ${options.description ? `<p class="empty-state-description">${options.description}</p>` : ''}
</div>`;
```

**Data flow**: dye-search-box input → `search-changed` event → `DyeSelector.searchQuery` (`dye-selector.ts:175`) → `DyeGrid.emptyState.query` (`dye-selector.ts:375`) → `tInterpolate` (plain string replace, `language-service.ts:196-204`) → `getEmptyStateHTML` → `wrapper.innerHTML`.

**Exploit scenario**: a user typing `<img src=x onerror=…>` into the dye search box injects markup into their own page (handler blocked by CSP). Becomes a real reflected vector the day a `?q=` deep-link parameter is added.

**Recommended fix**: make `getEmptyStateHTML` escape `title`/`description` (or have it return DOM built with `textContent`; the `EmptyState` class at `empty-state.ts:126-150` already does this correctly with `textContent` — route dye-grid through it). Note the `icon` parameter is already guarded (`startsWith('<svg')`, line 235).

---

### WEB-3 — `?provider=` URL parameter persisted unvalidated; `login()` never clears it

| | |
|---|---|
| **Severity** | **LOW** — sign-in denial / flow confusion via a crafted link; no credential impact (PKCE verifier + state still bind the flow). |
| **CWE** | CWE-20 (Improper Input Validation), CWE-693 (Protection Mechanism Failure) |
| **Files** | `src/services/auth-service.ts:206-211` (store), `:340` (consume), `:608-642` (`login()` does not remove `OAUTH_PROVIDER_KEY`), `:665` (`loginWithXIVAuth()` sets it) |
| **Confidence** | PLAUSIBLE — logic traced end-to-end in code; not executed against the live worker. |

**Code excerpt**

```ts
// auth-service.ts:206-211 — runs on EVERY page load, for ANY URL
const providerFromUrl = urlParams.get('provider') as AuthProvider | null;
if (providerFromUrl) {
  sessionStorage.setItem(OAUTH_PROVIDER_KEY, providerFromUrl);
}
// :340 — later, on the real callback
const provider = (sessionStorage.getItem(OAUTH_PROVIDER_KEY) as AuthProvider) || 'discord';
const callbackEndpoint = provider === 'xivauth' ? `${OAUTH_WORKER_URL}/auth/xivauth/callback` : `${OAUTH_WORKER_URL}/auth/callback`;
```

**Data flow**: attacker-crafted link `https://xivdyetools.app/presets?provider=xivauth` → sessionStorage (same tab) → victim clicks *Sign in with Discord* (`login()` at `:608` sets verifier/state/return_path but not the provider key) → Discord callback returns to `/auth/callback?code=…&csrf=…` → `handleCallbackCode` reads the stale `xivauth` → POSTs the Discord code to `/auth/xivauth/callback` → exchange fails → user is silently not logged in (only `logger.error`). The key is then removed (`:345`), so it is a one-shot per crafted visit, but every share link can carry it.

**Recommended fix**: (a) validate `providerFromUrl` against `['discord','xivauth']` and only honour it when a `code` is also present (i.e. on the actual callback); (b) have `login()` explicitly `sessionStorage.setItem(OAUTH_PROVIDER_KEY, 'discord')` (or remove the key) so each flow starts clean; (c) surface exchange failures to the user with a toast.

---

### WEB-4 — API base read from a clobberable `window.PRESET_API_URL` global

| | |
|---|---|
| **Severity** | **LOW** — latent primitive, not exploitable with today's module load order; escalates to token exfiltration only when combined with a markup injection that runs *before* the service module evaluates. |
| **CWE** | CWE-829 (Inclusion of Functionality from Untrusted Control Sphere) / DOM clobbering |
| **Files** | `src/services/community-preset-service.ts:142-148` |
| **Confidence** | PLAUSIBLE |

**Code excerpt**

```ts
this.apiUrl =
  (typeof window !== 'undefined' &&
    (window as unknown as { PRESET_API_URL?: string }).PRESET_API_URL) ||
  DEFAULT_API_URL;
```

Nothing in `src/` ever sets `window.PRESET_API_URL` (ripgrep: one hit, this read). A markup injection could define it by DOM clobbering (`<a id="PRESET_API_URL" href="https://evil.workers.dev/">` — an anchor stringifies to its `href`), after which `voteForPreset`/`removeVote`/`hasVoted` (`:368,426,478`) would send `Authorization: Bearer <JWT>` to that host, and `connect-src https://*.workers.dev` (WEB-5) would let the request through. The singleton is created at module evaluation (`:505`), which in practice precedes any remote-content render (WEB-1's modal lives inside the presets tool that already imported this module), so the chain does not currently close.

**Recommended fix**: delete the `window.PRESET_API_URL` hook (use `import.meta.env.VITE_PRESETS_API_URL` like `preset-submission-service.ts:59` does) and tighten `connect-src` (WEB-5).

---

### WEB-5 — `connect-src https://*.workers.dev` is unused by production and widens any injection

| | |
|---|---|
| **Severity** | **LOW** — hardening; no direct vulnerability, but it is the one CSP allowance that hands an attacker a self-controlled network origin (anyone can register `<name>.workers.dev`). |
| **CWE** | CWE-1021 / CWE-16 (Configuration) |
| **Files** | `public/_headers:17` |
| **Confidence** | CONFIRMED — grep of `dist/assets/*.js` finds only `*.xivdyetools.app`, `universalis.app` and `cdn.discordapp.com` absolute URLs; no `workers.dev` host. |

**Why it matters**: with `script-src 'self'` an attacker needs an allowed *fetch* origin to beacon anything out (e.g. the rendered DOM of an injected page, or in the WEB-4 chain the bearer token). `*.workers.dev` is exactly that. The beta build is the only plausible consumer (the `-dev` workers), and it already has its own `_headers` mutation step in `vite-plugin-beta-branding.ts`.

**Recommended fix**: remove `https://*.workers.dev` from the production `_headers`; if beta needs it, append the specific `xivdyetools-*-dev.<account>.workers.dev` hosts in the beta branding plugin. Consider also adding `object-src 'none'` and a `report-to` endpoint.

---

### WEB-6 — Import / persistence paths validate shape loosely (INFO)

| | |
|---|---|
| **Severity** | **INFO** — all paths are self-initiated (the user picks a file / edits their own localStorage); strings that reach the DOM from these stores are rendered via `textContent` or Lit text bindings (verified: `collection-manager-modal.ts:131,138`, `add-to-collection-menu.ts:203`, preset-tool Lit templates). |
| **CWE** | CWE-20 |
| **Files** | `src/services/collection-service.ts:920-1008` (import), `:257-315` (load), `src/services/config-controller.ts:268-276` + `:180-184` (settings import/merge), `src/components/advanced-options-panel.ts:316-338` |
| **Confidence** | CONFIRMED |

Details:
- `importData` accepts `collection.kind ?? 'palette'` without checking it is one of `palette|swap|character` (`:980`); an unknown kind persists and the record silently disappears from kind-filtered views while remaining in `getCollections()`. Everything else is re-validated through `createCollection`/`addDyeToCollection` (length caps, stainID resolution, tombstones) — good.
- `importConfigs` only whitelists the top-level tool keys; each tool's object is spread raw into state and persisted (`{...currentConfig, ...partial}`). Unknown/ill-typed fields survive. (JSON `__proto__` keys become own properties under spread, so there is no prototype pollution.)
- `loadCollections` trusts `collection.dyes` to be an array (`:271`); a hand-edited localStorage value makes `CollectionService.initialize()` throw on every call (no try/catch) — a self-inflicted crash loop until storage is cleared.

**Recommended fix**: a small runtime schema (hand-rolled or zod) for `CollectionExport`, `CollectionsData` and each `ToolConfig`; reject/skip invalid records instead of throwing.

---

### WEB-7 — `Permissions-Policy: camera=()` vs shipped webcam capture (INFO)

`public/_headers:24` sends `Permissions-Policy: geolocation=(), microphone=(), camera=()`. An empty allowlist disables the feature for the top-level document itself, so `navigator.mediaDevices.getUserMedia` in `camera-service.ts:148,188` (reached from `image-upload-display.ts:483` → `camera-preview-modal`) should reject in production. The mobile `<input capture="environment">` path (`extractor-tool.ts:922`, `image-upload-display.ts:93`) is unaffected (native picker, not governed by the policy). Security-wise the header is *stricter* than needed; flagged because a header that silently kills a feature tends to get "fixed" by removing it wholesale. Use `camera=(self)` if the webcam path is meant to work. PLAUSIBLE — not tested in a browser.

### WEB-8 — Deprecated `X-XSS-Protection: 1; mode=block` (INFO)

`public/_headers:22`. The auditor in legacy browsers can itself be abused for side-channel/blocking attacks; modern guidance is `X-XSS-Protection: 0` or omit. CSP is the real control here.

### WEB-9 — Inline `onclick` in the fatal-error fallback (INFO)

`src/main.ts:118` — `<button onclick="location.reload()">` inside an `innerHTML` template. CSP `script-src 'self'` blocks inline handlers, so the Reload button does nothing in production (and logs a CSP violation). The interpolated `${ErrorHandler.createUserMessage(appError)}` is a static `ERROR_MESSAGES` lookup (`error-handler.ts:71-87`), so no injection. Build the fallback with DOM APIs and `addEventListener`.

### WEB-10 — Source maps shipped to production (INFO)

`vite.config.ts:26` `sourcemap: true` → 39 `.map` files in `dist/assets`. The project is MIT-licensed and the bundle contains no secrets (verified: only `VITE_*` URL overrides exist — `vite-env.d.ts:6-17`; no keys/tokens found by grep), so this is a disclosure-surface note only. Consider `sourcemap: 'hidden'` if you want stack traces without public maps.

### WEB-11 — Unencoded path segments in API URLs (INFO)

`community-preset-service.ts:312` (`/api/v1/presets/${id}`), `:368/:426/:478` (`/api/v1/votes/${presetId}`), `preset-submission-service.ts:157,182,425,540`, plus `hybrid-preset-service.ts:355` (`id.replace('community-','')` from the URL sub-path, `preset-tool.ts:423,443`). IDs come from the API itself or from `location.pathname` (already dot-segment-normalised by the browser; percent-encoded slashes stay encoded). The generic `request()` path attaches no `Authorization` header, and the authenticated paths use `preset.id`/`apiPresetId` from API objects, so there is no SSRF/traversal impact today. Wrap with `encodeURIComponent()` as a matter of hygiene.

### WEB-12 — Prototype-chain lookup feeding `unsafeHTML()` (INFO)

`category-icons.ts:43-45` — `CATEGORY_ICONS[name] || ICON_CATEGORY_DEFAULT` on a plain `Record<string,string>`. `preset-detail.ts:865,871` passes `this.preset.category` / `secondaryCategories` (API `category_id`/`secondary_categories`) straight in. A value such as `constructor` or `toString` resolves to an inherited function, and Lit's `unsafeHTML` throws on non-string input → the detail view fails to render. Not attacker-reachable unless presets-api serves such a category slug. Use `Object.hasOwn(CATEGORY_ICONS, name)`.

### WEB-13 — No size cap on drop/paste images and `.chara` files (INFO)

`extractor-tool.ts:1585-1597` (`handleDroppedFile`) and `:1604-1625` (clipboard) only check the MIME prefix, while the upload-display path enforces 20 MB (`image-upload-display.ts:310`). `chara-import.ts:195-220` reads `file.text()` of any size. Decoding a huge image / parsing a huge JSON can hang the tab — self-DoS only (the user chose the file). Images are decoded via `<img src=data:…>`, so SVG payloads are inert (no DOM insertion of file content; verified `img.src = dataUrl` at `extractor-tool.ts:1594`, `image-upload-display.ts:351`). Add the same 20 MB guard to the drop/paste path.

### WEB-14 — `exampleLink` / `previewImageUrl` trust the server allowlist only (INFO)

`preset-detail.ts:908` binds `href=${this.preset.exampleLink}` and `preset-card.ts:367` binds `src=${previewImageUrl}`; both values originate from presets-api (`hybrid-preset-service.ts:183-184`) where an HTTPS host allowlist is enforced server-side (`apps/presets-api/src/services/validation-service.ts:379-428`, mirrored client-side in `src/shared/example-link.ts` but only used on the *submit/edit* forms). Lit escapes attribute values, CSP blocks `javascript:` navigation, `rel="noopener noreferrer"` + `target="_blank"` are present (`:909-910`), and `img-src` limits where `previewImageUrl` can load from. Defense-in-depth: run `exampleLinkError()` (or at least a `URL.protocol === 'https:'` check) on the read path too, so a server-side regression cannot render an arbitrary link in a trusted card. The saved-presets snapshot (`saved-presets-service.ts:90`) carries the link into localStorage with the same trust.

### WEB-15 — JWT in localStorage (INFO, documented trade-off)

`auth-service.ts:62-81` documents the decision. Verified mitigations: token only ever attached via `getAuthHeaders()` (`:592-597`) to the fixed `PRESETS_API_URL`/`OAUTH_WORKER_URL` origins (`auth-service.ts:490,697`; `community-preset-service.ts:368-482`; `preset-submission-service.ts:157-544`) — never to a user-supplied URL; expiry checked on every `isAuthenticated()` (`:563-573`) with server-side revoke on logout (`:697`); token never appears in a URL (exchange is `POST` JSON, `:370-380`); the `?code=&csrf=` callback URL is scrubbed with `history.replaceState` + reload (`:527-531`); `Referrer-Policy: strict-origin-when-cross-origin` limits referrer leakage of the callback URL to the origin. Residual risk: any future loosening of `script-src` (or a way to host a same-origin script) turns every markup-injection bug into token theft; an `httpOnly` cookie issued by the oauth worker would remove that class. The unverified JWT payload is used for display only (`username`, `global_name`, `avatar`, `auth_provider`, `primary_character` → Lit text/attribute bindings in `config-sidebar.ts:1613-1631`).

---

## Positive controls verified

- **OAuth / open redirect** — `sanitizeReturnPath()` (`auth-service.ts:113-152`) rejects non-`/`-prefixed values, `//`, any `://`, `javascript:`/`data:` substrings, then re-parses against `window.location.origin` and returns only `pathname+search+hash` (this also neutralises `/\evil.com`, which WHATWG parses as protocol-relative → origin mismatch → `/`). `navigateAfterAuth()` (`:511-532`) only ever builds `origin + path`. `returnTool` comes from sessionStorage set by app code with constants. The oauth worker validates `redirect_uri` against an origin allowlist (`apps/oauth/src/constants/oauth.ts:10-38`, `handlers/oauth-flow.ts:100-108,184-198`) and echoes `return_path` back as a query param that the SPA re-sanitises.
- **PKCE + state** — verifier (64 random bytes hex) and state (32 bytes) from `crypto.getRandomValues` (`:784-788`), stored in sessionStorage, verifier sent only in the `POST` body; `csrf`/state check is fail-closed (`:353-356`).
- **Deep-link parameters** — every tool resolves `dye`/`start`/`end`/`dyeA…`/`dyes` via `ShareService.resolveSharedDye()` (integer → dye DB lookup, `share-service.ts:331-351`) and `hex*` via `parseSharedHex()` (`/^[0-9a-f]{6}$/`, `:357-386`); `harmony-tool.ts:525`, `budget-tool.ts:424`, `mixer-tool.ts:643-652`, `gradient-tool.ts:311-353`, `swatch-tool.ts:3041`, `accessibility-tool.ts:2062`, `comparison-tool.ts:2494`. Router tool IDs are whitelisted against `ROUTES` (`router-service.ts:59-69,274-311`), so `v4-layout.ts:481/646` `${toolId}` is safe. Locale for the dynamic `import()` is validated (`language-service.ts:291-293,326`).
- **Remote preset content** — names, descriptions, authors, tags, vote counts are rendered through Lit `html` text bindings (`preset-detail.ts:892-958`, `preset-card.ts:348-380`, `preset-tool.ts`); `unsafeHTML()` is used only with compile-time icon constants (`dye-palette-drawer.ts`, `preset-card.ts`, `preset-detail.ts`, `preset-tool.ts`, `result-card.ts`, `v4-app-header.ts`). Toasts (`toast-container.ts:130,137`), modal titles/subtitles (`modal-container.ts:364-376`), tooltips (`tooltip-service.ts:330`), announcer (`announcer-service.ts:171`), tutorial (`tutorial-spotlight.ts:346,358`), collection names/descriptions (`collection-manager-modal.ts:131,138`), chara item names (`chara-import.ts:308-313,1177-1181`) and duplicate-preset names (`preset-edit-form.ts:711-714`, `preset-submission-form.ts:692-696`) all go through `textContent`.
- **`BaseComponent.createElement({ innerHTML })`** (`base-component.ts:488-505`) — every caller passes `ICON_*`/`LOGO_*`/`TOAST_ICONS`/`HARMONY_ICONS` constants or `LanguageService.t()` wrappers (grep of all `innerHTML:` option keys; `harmony-tool.ts:682`, `collapsible-panel.ts:69`, `toast-container.ts:119`, `image-zoom-controller.ts`, …). `CollapsiblePanel.setContent()` callers pass HTMLElements.
- **Links** — every `target="_blank"` carries `rel="noopener noreferrer"` (`about-modal.ts:218-220,257-259,335-337`, `metric-help.ts:231-233,350-352`, `image-upload-display.ts:181-182`, `preset-detail.ts:909-910`); the single `window.open` uses static URL builders with numeric item IDs and `'noopener,noreferrer'` (`result-card.ts:155-160,1415`); `location.assign` targets are app-built relative paths (`swatch-tool.ts:2215-2243`, `my-submissions-modal.ts:172`, `preset-detail.ts:965`).
- **Headers** — `frame-ancestors 'none'` + `X-Frame-Options: DENY` (clickjacking), `X-Content-Type-Options: nosniff`, HSTS with preload, `Referrer-Policy: strict-origin-when-cross-origin`, `form-action 'none'`, `base-uri 'self'`, `upgrade-insecure-requests`. `_redirects` is the standard SPA catch-all. `functions/_middleware.ts` only rewrites a fixed legacy hostname to `xivdyetools.app` (no user-controlled redirect target).
- **Third-party loading** — `src/index.html` loads no external script, style, font or iframe; only `dns-prefetch`/`preconnect` hints to own subdomains and `universalis.app`. Fonts self-hosted (`font-src 'self'`).
- **No service worker / cache** (`serviceWorker|workbox|caches.` → no hits; confirmed by `CLAUDE.md`). No `postMessage`/`message` listeners. No `document.cookie`, `eval`, `new Function`, `srcdoc`, `insertAdjacentHTML`, `outerHTML`, `structuredClone`.
- **Fetch layers** — `community-preset-service.getPresets()` builds the query with `URLSearchParams` (`:279-290`) so search/filter text is encoded; `Authorization` is only ever added by `getAuthHeaders()` to hard-coded origins; API error bodies are passed to `ToastService` (`textContent`) or `logger`, never to `innerHTML`. `chara-resolve-service` posts only model keys to `data.xivdyetools.app` and validates the envelope shape (`:164-172`). Universalis is reached only through the `data.xivdyetools.app/universalis` proxy in production (`api-service-wrapper.ts:49-53`).
- **Secrets** — no hard-coded keys/tokens in `src/` (grep `api[_-]?key|secret|password|client_secret|private[_-]?key`); `VITE_*` variables are only endpoint URL overrides; `define` injects only version/build date (`vite.config.ts:12-19`); dev-only `window.TutorialService/ShareService` exposure is gated by `import.meta.env.DEV` (`main.ts:91-94`).
- **File / device APIs** — file inputs restrict via `accept` and `file.type.startsWith('image/')` (`extractor-tool.ts:905,928,1549`, `image-upload-display.ts:304`); clipboard read happens only on an explicit button (`extractor-tool.ts:1069-1071,1604`); camera only on user action with errors handled (`camera-preview-modal.ts:207-220`); CSS custom properties are set from code-owned palettes (`theme-service.ts:274-329`), legacy theme names migrated through a fixed map (`:132,167`).

---

## Coverage

**Read in full**: `src/services/auth-service.ts`, `router-service.ts`, `community-preset-service.ts`, `preset-submission-service.ts`, `api-service-wrapper.ts`, `chara-resolve-service.ts`, `share-service.ts`, `collection-service.ts`, `storage-service.ts`, `hybrid-preset-service.ts`, `indexeddb-service.ts`, `saved-presets-service.ts`; `src/shared/error-handler.ts`, `utils.ts`, `example-link.ts`; `src/vite-env.d.ts`, `src/index.html`, `public/_headers`, `public/_redirects`, `functions/_middleware.ts`, `src/components/signin-modal.ts`, `src/components/my-submissions-modal.ts` (1-230 of 230).

**Read in targeted ranges** (every sink/lead plus surrounding logic): `config-controller.ts`, `language-service.ts`, `v4-layout.ts`, `v4/preset-detail.ts`, `v4/preset-card.ts`, `v4/preset-tool.ts`, `v4/config-sidebar.ts`, `v4/result-card.ts`, `collection-manager-modal.ts`, `advanced-options-panel.ts`, `chara-import.ts`, `extractor-tool.ts`, `image-upload-display.ts`, `camera-service.ts`, `camera-preview-modal.ts`, `budget-tool.ts`, `harmony-tool.ts`, `mixer-tool.ts`, `gradient-tool.ts`, `swatch-tool.ts`, `market-board.ts`, `dye-grid.ts`, `dye-selector.ts`, `empty-state.ts`, `base-component.ts`, `modal-container.ts`, `toast-container.ts`, `toast-service.ts`, `tool-panel-builders.ts`, `main.ts`, `shared/beta-branding.ts`, `shared/category-icons.ts`, `shared/preset-i18n.ts`, `shared/constants.ts`, `vite.config.ts`, `package.json`, plus `apps/oauth/src/constants/oauth.ts`, `apps/oauth/src/handlers/oauth-flow.ts` (grep context), `apps/presets-api/src/index.ts:90-125`, `apps/presets-api/src/services/validation-service.ts` (grep context).

**Grepped only** (all 123 non-test `src/**/*.ts` files): `innerHTML`, `insertAdjacentHTML`, `outerHTML`, `unsafeHTML/unsafeSVG/unsafeCSS`, `setAttribute('href'|'src'|'style')`, `.href =`, `window.open`, `location.(href|assign|replace|hash|search|pathname)`, `history.*State`, `new URL(`, `URLSearchParams`, `addEventListener('message')|postMessage`, `JSON.parse`, `Object.assign`, `structuredClone|__proto__`, dynamic `import(`, `createObjectURL`, `srcdoc|document.cookie|eval|new Function`, `.src =`, `style.cssText|setAttribute('style')`, `document.title =`, `escapeHtml|sanitize|DOMPurify`, `VITE_*|import.meta.env`, `serviceWorker|workbox|caches.`, `clipboard|paste`, `getUserMedia`, `FileReader|file.text()`, `file.type|file.size|accept`, `Authorization|Bearer|getAuthHeaders`, `fetch(`, `tInterpolate(`, `localStorage|sessionStorage`, `(window as …) =`, `alert|confirm|prompt|document.write`, `adoptedStyleSheets|<style|style.textContent`, secret-looking identifiers; `dist/assets/*.js` for absolute hosts and `.map` count. Custom scanner `scan-innerhtml.mjs` enumerated every non-constant interpolation inside HTML template literals (14 hits, all triaged above).

**Not reviewed**: unit/E2E tests, `scripts/`, `e2e/`, the Lit shell CSS, `@xivdyetools/core` internals (dye DB, `parseCharaFile`), and the sibling workers beyond the grep context noted above.
