# Review: web-app-content (2026-10-03, commit 0ab33466)

Scope: apps/web-app content / storage half. Read-only. No probe scripts were written.

## 1. Entry points and authz matrix (client-side surfaces)

The SPA has no server handlers. The relevant entries are inputs a person or a remote host controls.

| Entry | Who can reach it | Guards before handler | Caps |
|---|---|---|---|
| `.chara` drop / picker (`chara-file-card.ts` -> `chara-file-loader.ts:44`) | any visitor | size check before `file.text()` (`chara-file-loader.ts:49`) | `MAX_USER_FILE_BYTES` 20 MB (`shared/constants.ts:127`) |
| `POST {api-worker}/v1/chara/resolve` (`chara-resolve-service.ts:135`) | any visitor with a file loaded | body built from numeric model keys only | 12 s timeout, session cache |
| Image drop/paste/pick (`extractor-tool.ts:1300-1330`) | any visitor | size cap | 20 MB; stays in a FileReader data URL, never fetched |
| Preview image upload (`preset-submission-service.ts:235`) | signed-in user, explicit action | bearer token | 5 MB client check |
| Telemetry beacon `POST /v1/telemetry` (`telemetry-service.ts:230`) | only when toggle on and no GPC | gate re-checked in `track()` and `flush()` | MAX_BATCH 20 |
| Settings import (`advanced-options-panel.ts:305-330`) | any visitor, local file | `type` check + `sanitizeConfigPartial` | none (see handoffs) |
| Collection import (`collection-service.ts:895`) | any visitor, local file | type check, per-record try/catch | none |
| Remote data rendered: preset name / description / tags / rejection reason / example link / preview URL from presets API | any signed-in author | `escapeHtml`, Lit text bindings, `sanitizeExampleLink`, `sanitizePreviewImageUrl` | n/a |

## 2. Positive controls

- Every `innerHTML` sink with a dynamic value is escaped or takes only code-controlled values: `my-submissions-modal.ts:103-117` (name and moderator reason via `escapeHtml`), `empty-state.ts:228-243` (title and description escaped, icon must start with `<svg`), `v4-layout.ts:754` (toolId is typed and validated by `router-service.ts:343,370`). The remaining sinks in `evidence/html-sinks.txt` assign static SVG constants (`*-icons.ts`) or locale strings. `unsafeHTML` is only fed icon constants (`preset-detail.ts:943-1083`, `v4-app-header.ts`).
- `.chara` strings render only through `textContent` (`chara-ui.ts:75-81`, `el()`), so Nickname, file name and TypeName cannot inject markup. Toasts use `textContent` (`toast-container.ts:133-146`), so the `{reason}` echo of core's parse error is safe.
- The glamour clipboard HTML escapes every label and value (`glamour-markdown.ts:111-128`). The .md filename is fixed with no character name (`glamour-markdown.ts:60`).
- `.chara` -> api-worker request: core builds gear entries as fresh `{slot,set?,base,variant}` number objects (`packages/core/src/services/chara/chara-parser.ts:455-470`); `chara-resolve-service.ts:119-121` adds the glasses id. No name, colours, Base64Image or file name is sent. This matches PRIVACY.md "Character files" bullet 3.
- `CharaSessionService` is memory-only (`chara-session-service.ts:27-72`). Telemetry only gets `ok` plus a bucketed producer (`telemetry-service.ts:177-184`, `chara-file-loader.ts:73,83`).
- Telemetry: opt-in default false (`tool-config-types.ts:417`); GPC checked in `isEnabled()` (`telemetry-service.ts:125`) which both `track()` and `flush()` call; queue dropped when the toggle goes off, and the cross-tab `storage` event reaches the subscriber (`config-controller.ts:192`); nothing is written to storage and no id exists (whole file read); the envelope is `v, ver, env, locale(6), theme, vp(m/t/d)`; event props come only from typed call sites (`dye-selector.ts:280`, `v4-layout.ts:223,518`, `theme-switch.ts:23`, `chara-file-loader.ts`).
- Production logger: `info`, `warn`, `debug` are dev-only; `error` goes through the package redaction (`shared/logger.ts:170-190`). It is console-only; no remote transport exists. `ErrorHandler.report` only calls a `window.Sentry` that is never loaded (`error-handler.ts:92-103`).
- Storage: IndexedDB v3 deletes `image_cache` (`indexeddb-service.ts:16,112-115`), matching PRIVACY. The extractor clears legacy keys (`extractor-tool.ts:430`). Glamour acquisition edits are keyed by a gear hash, never a name (`acquisition-edits.ts:6-14`). Only image/preview uploads leave the browser, and only on explicit action.
- Example links are checked against a host allowlist, https only, on write and read paths (`example-link.ts:27-79`); the anchor uses `rel="noopener noreferrer"` (`preset-detail.ts:991-994`). External "Open in" uses `window.open(..., 'noopener,noreferrer')` (`item-links-menu.ts:131`).
- `public/_headers`: CSP has no `unsafe-eval`, script-src 'self', frame-src/object-src 'none', form-action 'none', frame-ancestors 'none', connect-src first-party only; HSTS preload; nosniff; X-Frame-Options DENY. Only the `/*` block carries security headers; the other path blocks set Cache-Control or Content-Type only, so there is no pattern-merge trap. No service worker; `public/` holds only icons, fonts and static JSON.
- `download-file.ts` revokes the object URL; the palette export uses positional identifiers with no dye names (`palette-export.ts:63-69`); no CSV format exists, so no formula injection.
- Settings import is allowlist-sanitized (`config-controller.ts:96-108`); collection import is per-record guarded (`collection-service.ts:895-990`).

## 3. Rejected items

- `v4-layout.ts:754` `renderPlaceholder` interpolating `toolId` into innerHTML: toolId is validated by `RouterService.isValidToolId` first, not attacker-controlled.
- `my-submissions-modal.ts:187` `location.assign('/presets/community-'+id)`: same-origin path, id from the authenticated API response.
- `config-sidebar.ts:1688` avatar `<img src>`: built by `auth-service.ts:841-844` onto the fixed `cdn.discordapp.com` origin; CSP limits img hosts. Auth reviewer covers the rest.
- `logger.info` with fileName/nickname at `chara-file-loader.ts:90`, `chara-sheet.ts:174`, `glamour-block.ts:1747`: dev-only console, not a sink in production.
- `logger.error('[CharaFileLoader] Parse failed:', error)` carries core's field-and-value message: console only, local.
- `swatch-tool.ts:2341` `location.assign(target.url)`: internal tool routes from code.
- `sourcemap: true` (`vite.config.ts:26`): open-source repo, not a leak.
- JWT in localStorage (`auth-service.ts:478`): documented existing decision; auth reviewer's scope.
- Glamour .md values (item names, user-typed acquisition lines) not Markdown-escaped: the user's own text in the user's own file, no cross-user path.
- Collection name falls back to the `.chara` nickname or file name in localStorage (`chara-sheet.ts:163`, `glamour-block.ts:1719`): disclosed verbatim in PRIVACY.md "One exception"; never uploaded; community path does not read it (`glamour-block.ts:1706`).

## 4. Files covered

Read in full: `src/services/{chara-file-loader,chara-resolve-service,chara-session-service,telemetry-service}.ts`, `src/shared/{glamour-markdown,download-file}.ts`, `src/components/chara-ui.ts`, `public/_headers`, `PRIVACY.md` (lines 1-140).

Read in part (sink regions and relevant functions): `src/components/{chara-file-card,chara-sheet,glamour-block,my-submissions-modal,signin-modal,empty-state,toast-container,v4-layout,collapsible-panel,dye-grid,budget-tool,mixer-tool,gradient-tool,shortcuts-panel,modal-container,swatch-tool,advanced-options-panel,v4/preset-detail,item-links-menu,v4/result-card}.ts`, `src/services/{config-controller,collection-service,saved-presets-service,indexeddb-service,language-service,auth-service,router-service,preset-submission-service}.ts`, `src/shared/{logger,clipboard,palette-export,example-link,acquisition-edits,error-handler,utils,constants}.ts`, `src/locales/en.json` (chara/privacy strings), `packages/core/src/services/chara/{chara-models,chara-parser}.ts`.

Grep-covered only (all non-test `src`): every `localStorage` / `sessionStorage` / `StorageService` / `fetch` / `sendBeacon` / `postMessage` / `href` / `window.open` / `unsafeHTML` site.

Not read beyond grep: `glamour-sheet`, `glamour-list-actions`, `glamour-twin-picker`, `glamour-tool`, `storage-service`, `theme-service`, `image-zoom-controller`, most of `extractor-tool`. Coverage of these is partial.

## 5. Candidates

| cid | sev | exposure | path:line | claim |
|---|---|---|---|---|
| c1 | LOW | INTERNET-UNAUTH | apps/web-app/src/locales/en.json:1204 | The card hint says "Nothing is uploaded", but the Glamour Reader sends gear model numbers and the facewear id to api-worker (PRIVACY.md allows this). |
| c2 | LOW | INTERNET-UNAUTH | apps/web-app/src/components/advanced-options-panel.ts:315 | A settings JSON can set `advanced.analyticsEnabled=true` on import, switching on opt-in telemetry without a deliberate toggle. |
| c3 | LOW | INTERNET-UNAUTH | apps/web-app/src/services/saved-presets-service.ts:20 | The `v5_saved_presets` store (community preset snapshots including other users' author names) is not listed in PRIVACY "What is stored on your device". |
| c4 | INFO | LOCAL | apps/web-app/src/components/swatch-tool.ts:325 | The loaded `.chara` file's tribe and gender are persisted to localStorage, but `chara-session-service.ts:15-17` says nothing from the file touches localStorage and a reload clears it. |

Details:

- c1: `chara-file-card.ts:140-146` renders `swatch.charaHint` under the file card, next to the glamour block that triggers `resolveCharaEquipment` (`glamour-block.ts:361`). Evidence: `"charaHint": "Parsed on this device. Nothing is uploaded — the file holds a character name and sometimes a screenshot."` Fix the string in all six locale files; PRIVACY.md is correct. Suggested wording: the file and its name never leave your device; gear model numbers are sent to look up item names. policy = CORRECT, reconcile_case 3.
- c2: Trigger: a victim imports `{"type":"xivdyetools-settings","configs":{"advanced":{"analyticsEnabled":true}}}`. `sanitizeConfigPartial` keeps boolean fields matching the default's shape (`config-controller.ts:96-108`, `importConfigs:409-420`). A user-initiated import is a mitigating factor. Suggest dropping `analyticsEnabled` on import or asking for confirmation. policy NONE, reconcile_case 1.
- c3: Evidence: `saved-presets-service.ts:20-39` stores `name, description, tags, author`. PRIVACY.md lines 44-48 list favourites, palettes, collections, acquisition lines and the token, not saved presets. Also unlisted: tutorial progress and the OAuth sessionStorage values (PKCE verifier, state, return path; `auth-service.ts:656-665`, cleared on callback). Add one clause. policy = CORRECT, reconcile_case 3, policy_doc `apps/web-app/PRIVACY.md` section "What is stored on your device" (six-file edit).
- c4: Evidence: `swatch-tool.ts:321-327` calls `StorageService.setItem(STORAGE_KEYS.subrace/gender, file.tribe/gender)`. On-device only and within "per-tool settings"; nothing uploaded. Fix the comment and module doc rather than the code. policy NONE, reconcile_case 3.

Privacy reconciliation (pii-sinks x pii-sources, web-app paths): no analytics datapoint, remote log or third-party body carries IP, UA, ids, names, file names, guild ids or free text. Outbound calls in my half send numeric model keys (resolve), allowlisted buckets (beacon) and the explicit preview upload. No client-generated persistent or per-session identifier exists. The only dimensions are viewport bucket (3 values), locale (6), theme, and app version (full semver, which the policy lists as "app version").

## 6. Handoffs

- Settings import (`advanced-options-panel.ts:310`) and collection import (`collection-manager-modal.ts:581`) read the whole file with no size cap, unlike the image and `.chara` inputs (WEB-13 analogue). Plain bug, local DoS only.
- `indexeddb-service.ts:100-108` still creates empty PALETTES and SETTINGS object stores although PRIVACY says IndexedDB holds one thing; dead-code cleanup with a DB_VERSION bump.
- `ErrorHandler.report` (`error-handler.ts:92`) is a dead Sentry shim (nothing sets `window.Sentry`); dead-code candidate.
- Preview image upload sends the original bytes with no client-side re-encode (`preset-submission-service.ts:235-252`). Whether EXIF/GPS is stripped server-side belongs to the presets-api and image-worker reviewers.
- `v4-layout.ts:754` interpolates toolId into innerHTML; safe only because of upstream validation. Consider textContent for defence in depth.
