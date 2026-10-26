# review-web-app-sinks (deploy unit: web-app) - 2026-10-26

Scope: apps/web-app/src (295 tracked files; 156 non-test), public/, functions/, vite.config.ts. Read-only; no probes run.

## Sink / module table (what was opened and read)

| Area | Where | Data source | Verdict |
|---|---|---|---|
| innerHTML, static SVG/icon constants | ~90 sites (html-sinks.txt: about-modal, dye-grid 162/183, collection-manager-modal, extractor-tool, gradient-tool, harmony-tool 1302, swatch-tool 2231, welcome-modal 220, preset-category-selector 163, ...) | code constants; `getCategoryIcon(name)` is own-property-only (shared/category-icons.ts:47-49) | safe |
| innerHTML with `t()` strings | budget-tool 1218/1589, signin-modal 35, v4-layout 567/739/755, shortcuts-panel 126, gradient 870, mixer 1604, market-board 351 | locale JSON bundled at build; interpolated values are numbers or `toolDisplayName(ToolId)`; `renderPlaceholder(toolId)` (v4-layout.ts:754) only reachable with a typed ToolId (v4-layout.ts:713) | safe |
| innerHTML with remote text | my-submissions-modal.ts:132-198 (`name`, moderation `rejection_reason`) | presets-api | `escapeHtml` applied (shared/utils.ts:26); 2026-10-03 FINDING-011 holds |
| innerHTML with user query | dye-grid.ts:90-100 -> `getEmptyStateHTML` (empty-state.ts:171-181) | typed search query | title+description escaped, icon must start `<svg` |
| `CollapsiblePanel.setContent(string)` -> innerHTML | collapsible-panel.ts:163-170 | every caller passes an HTMLElement (comparison/harmony/mixer) | safe, no string caller |
| Lit `unsafeHTML` | v4/* (dye-palette-drawer, preset-card/detail/tool, result-card, v4-app-header) | all `ICON_*`/`TOOL_ICONS`/`getCategoryIcon` constants | safe |
| unsafeSVG, insertAdjacentHTML, document.write, eval, new Function, outerHTML, srcdoc, DOMParser, createContextualFragment | `git grep` over src, public, index.html | - | zero hits outside tests |
| Lit attribute bindings | preset-card.ts:370-375 (`style`, `src`), preset-detail.ts:998 (`href`) | style = dye-DB hex via `resolvePresetDye`; src = `sanitizePreviewImageUrl` (https only); href = `sanitizeExampleLink` (https + host allowlist, normalised href) | safe |
| window.open / location.assign | item-links-menu.ts:131, result-card.ts:1491 (fixed external hosts, noopener,noreferrer); my-submissions-modal.ts:216 (`/presets/community-${id}` fixed same-origin prefix); preset-detail.ts:1065 (numeric stainIDs only) | - | safe |
| OAuth return | auth-service.ts:138-176 `sanitizeReturnPath`, :250-262, :565-586 `navigateAfterAuth` (URL() same-origin re-check, replaceState + reload) | `return_path` query param | open redirect closed (`//`, `\`, tab tricks resolve to a foreign origin and fall back to `/`) |
| OAuth state / PKCE | auth-service.ts:655-700, :301-322 | sessionStorage verifier+state, CSRF compare fail-closed, `provider=` honoured only with `code` (FINDING-032 holds) | safe |
| Token storage / logout | auth-service.ts:84-102, :604-608, :775-808 | localStorage JWT, documented trade-off; logout clears token/expiry/provider, sessionStorage provider, price cache, best-effort revoke | as designed |
| URL param / hash parsing | budget-tool.ts:484-515, harmony-tool.ts:483-520, share-service.ts:440-534, router-service.ts:321-338/395-420, tool-handoff.ts | `dye`/`hex`/`maxDelta`/`harmony`/`v`/`dyes`; hex regexed `^#?[0-9a-fA-F]{6}$`, dye via `resolveSharedDye`, harmony via `isKnownHarmonyType`; preset id via `encodeURIComponent` (community-preset-service.ts:358) | safe |
| postMessage / BroadcastChannel / onmessage | only chara-inspection-service.ts:300 + workers/chara-inspection.worker.ts:212 | same-origin dedicated module worker; responses schema-validated, active-id-gated, palette-request cap, deadline | safe; no window `message` listener exists |
| .chara import | services/chara-file-loader.ts:62-131, chara-inspection-service.ts, workers/chara-inspection.worker.ts, chara-session-service.ts, chara-resolve-service.ts | dropped file | `.chara` name check, 8 KiB cap before read and after capped slice, worker-side parse, labels via textContent only, session memory-only, resolve body = integers only, logs fixed strings (2026-10-15 positive controls hold) |
| JSON.parse of imports | collection-service.ts:909-1010 (per-record guards, FINDING-004), advanced-options-panel.ts:310-325 -> `importConfigs` -> `sanitizeConfigPartial` (config-controller.ts:420-433, WEB-6), storage-service.ts:80/196 | user file / localStorage | shape-validated, no prototype merge |
| Clipboard | extractor-tool.ts:1341 (`clipboard.read` image -> same `handleDroppedFile` 20 MiB cap), glamour-sheet.ts (user-initiated copy of own list) | - | safe |
| Image import | extractor-tool.ts:1302-1331 | file | 20 MiB cap before FileReader (WEB-13) |
| Regex on user text | grep of parse-sinks: glamour-block.ts:210 (constant colour names), language-service.ts:207 (code-defined param keys), collection slug (collection-manager-modal.ts:544, linear classes) | - | no catastrophic pattern reachable from untrusted text |
| Changelog / What's New | changelog-modal.ts (textContent only), vite-plugin-changelog-parser.ts (build time) | build output | safe |
| Dev hooks | main.ts:151-152 | `import.meta.env.DEV` only | not in prod |

## _headers / Pages (PRODUCTION, BETA, pages.dev)

- public/_headers declares each pattern once (`/*`, `/*.html`, `/index.html`, `/assets/*`, `/og/*`, `/fonts/*`, `/json/*`, `/licenses/*`); the beta plugin edits the `/*` rule in place (beta-branding.ts) instead of appending a second one.
- Live probe (evidence/live-headers.txt, 2026-10-26T21:55Z): xivdyetools.app, beta.xivdyetools.app, xiv-colorexplorer.pages.dev and xivdyetools-beta.pages.dev all serve the full CSP (`script-src 'self'`, `frame-src/object-src 'none'`, `form-action 'none'`, `frame-ancestors 'none'`, first-party `connect-src`), HSTS preload, XFO DENY, nosniff, Referrer-Policy, Permissions-Policy; beta hosts add X-Robots-Tag. The 2026-10-03 FINDING-001 does not regress.
- No third-party script, font or style origin: index.html has one `<script type="module" src="/main.ts">`, only first-party dns-prefetch/preconnect; no service worker; the chara inspection worker is a same-origin module worker admitted by `script-src 'self'` (no `wasm-unsafe-eval` needed or granted).
- functions/_middleware.ts: legacy-domain 301 and `/assets/*` HTML-to-404 guard (FINDING-027 holds).
- public/ holds only icons, fonts, og cards, two JSON data files, manifest, sitemap, browserconfig and the generated licence text; no `.map`, `.env`, `.md` or backup files.

## POSITIVE controls

- Every remote string that reaches an innerHTML template is passed through `escapeHtml`; the rest of the app renders remote text with Lit text bindings or `textContent`.
- Example links: https-only + host allowlist on write (`exampleLinkError`) and on read (`sanitizeExampleLink`, returns the parsed `href`, which strips tabs/bidi/space); anchors carry `rel="noopener noreferrer"`.
- Preview images: https-only on read, further bounded by CSP `img-src` (cdn.discordapp.com, shots/data.xivdyetools.app).
- Imported files: `.chara` (8 KiB, named check, worker parse), images (20 MiB), settings and collection JSON (field-wise validation, tombstone and per-record try/catch).
- Return-path sanitiser re-validates with `new URL(...).origin`.
- No window message listener, no eval-class sinks, no dev globals in production.

## REJECTED

- Token in localStorage: documented design trade-off with listed mitigations (auth-service.ts:84-102); CSP verified live.
- preset-edit-form.ts:580 skips `sanitizePreviewImageUrl`: filed as INFO only (own-preset data, `img.src` cannot execute script, CSP img-src bounds it).
- Collection / settings import has no byte cap (`file.text()`, collection-manager-modal.ts:593, advanced-options-panel.ts:316): self-supplied file, only a local tab stall; not a boundary crossing.
- Extractor accepts up to 20 MiB with no pixel-dimension cap: self-supplied image, local stall only (WEB-13 scope).
- `chara` nickname / file name stored as a default collection name (chara-sheet.ts:210, glamour-block.ts:1815-1822): explicit "Save" click, stays in local storage, 50-unit cap, never read by the community path, pinned by chara-collection-privacy.test.ts; matches the documented LOCAL ONLY promise.
- `functions/_middleware.ts` 404 body carries no CSP (Pages `_headers` skip Function responses): plain `text/plain` "Not found", no active content.
- `vite.config.ts:26 sourcemap: true`: public open-source repo, nothing hidden.
- `getApiWorkerBase()`/`VITE_*` URL overrides: build-time only.
- `extractor-tool.ts:1309/1316` logs `file.name` to the console: console only, never telemetry or network.

## FILES COVERED

295 tracked files under apps/web-app/src enumerated by `git ls-files`; about 60 opened and read in full or by section (components, components/v4, services, shared, workers, main.ts), plus apps/web-app/public (all 5 top-level files read or listed), functions/_middleware.ts, vite.config.ts (sourcemap/worker minify lines), src/index.html (script/link grep). All 295 were swept with `git grep` for the sink classes above. Directories: src/components, src/components/v4, src/services, src/shared, src/workers, src/locales (names only), public/, functions/.
