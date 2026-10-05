# Review: webapp-shared (src/shared, main.ts, functions/, vite plugins, scripts, package.json)

Branch preview/integration-2026-10-04 @80262a2f. Paths are relative to `apps/web-app/`.

## Map

| Module | Role |
|---|---|
| `src/main.ts` | Boot: services, language, v4 shell, lazy modals, fatal overlay |
| `functions/_middleware.ts` | Pages edge: old-domain 301, `/assets/*` HTML-fallback to 404 guard |
| `src/shared/beta-branding.ts` + `vite-plugin-beta-branding.ts` | Beta HTML/`_headers` transforms (pure, tested) |
| `vite-plugin-async-css.ts` | Hoists CSS links into a hashed loader script |
| `vite-plugin-changelog-parser.ts` | `virtual:changelog`, byte-bounded |
| `src/shared/clipboard.ts`, `download-file.ts`, `utils.ts` | Copy / save / escapeHtml / clearContainer |
| `src/shared/example-link.ts` | Client mirror of the presets-api link allowlist, plus read-path sanitizers |
| `src/shared/palette-export.ts` | CSS/SCSS/JSON/HEX/Tailwind generators |
| `src/shared/tool-config-types.ts`, `tool-handoff.ts`, `dye-filter-utils.ts`, `spectrum-filter-utils.ts` | Config defaults, hand-off grammar, filters |
| `src/shared/logger.ts`, `error-handler.ts`, `fatal-error.ts`, `constants.ts` | Logging, error mapping, fatal screen |
| `src/shared/custom-dye.ts`, `dye-name.ts`, `format.ts`, `preset-i18n.ts`, `region-name.ts`, `subrace-clan.ts`, `method-tags.ts` | Small lookups |
| icons (`*-icons.ts`, `app-logo.ts`, `glyph-accent.ts`) | SVG string constants |
| `scripts/check-bundle-size.js`, `check-beta-build.js`, `smoke-test-pages.js`, `i18n-parity.mjs`, `validate-i18n.js`, `analyze-unused-keys.js`, `reorder-locales.mjs`, `generate-*icons.mjs` | CI gates and tooling |

## Candidates

### webapp-shared-01 | OPT (user-visible startup) | MEDIUM | `src/main.ts:111`
**Claim:** Boot blocks on a network probe whose result is only used by a dev-only log call.

- `await getServicesStatus()` (main.ts:111) awaits `APIService.getAPIStatus()`.
- That calls `isAPIAvailable()` (`packages/core/src/services/APIService.ts:1020`): a real `GET {baseUrl}/data-centers` with a 5000 ms abort (`UNIVERSALIS_API_TIMEOUT`, `packages/core/src/constants/index.ts:127`).
- The result goes only to `logger.info(...)`, and `logger.info` is a no-op outside dev (`src/shared/logger.ts:136`).
- `initializeV4Layout` (main.ts:122) cannot start until the probe settles.

**Failure:** api-worker or Universalis slow or stalling, or the visitor offline or behind a flaky link. The shell renders about 5 s late, showing a blank `#app` (`src/index.html:95`).
- Every page load also spends one request on the data-centers endpoint for nothing.
- `isAPIAvailable` never rejects, so no error surfaces.

**Tests:** `main.ts` has no unit test, and e2e runs against a healthy API. Covered: no.
**Origin:** MAIN.
```ts
const status = await getServicesStatus();          // main.ts:111
logger.info({ 'API Service': status.api.available ? `Available (${status.api.latency}ms)` : 'Unavailable', ... });
...
await initializeV4Layout(appContainer);            // main.ts:122
```
**Fix:** Run the status gather only under `import.meta.env.DEV`, or fire it as `void getServicesStatus().then(log)` after the shell is up.

### webapp-shared-02 | BUG | MEDIUM | `src/main.ts:125-127,159-170`
**Claim:** A failure in a non-critical lazy import after the shell has rendered wipes the working app.

- `await import('@components/tutorial-spotlight')` (main.ts:126) sits inside the same try as the critical init.
- If the chunk 404s (a stale tab after a deploy rotated hashes, or a transient network error), the catch calls `renderFatalError` (main.ts:162).
- That does `container.replaceChildren(screen)` (`src/shared/fatal-error.ts:70`) on `#app`, which holds the fully initialised v4 shell.
- The `throw error` (main.ts:170) then leaves the shell's listeners orphaned.

**Failure:** A user mid-session on a stale tab reloads or lazy-loads, the tutorial chunk fails, and the whole app is replaced by "Application Error" although every tool works.
**Tests:** None for `main.ts`. `fatal-error.test` only covers the renderer. Covered: no.
**Origin:** MAIN.
**Fix:** Wrap the tutorial init in its own try/catch that logs and continues. Keep the fatal overlay only for `initializeServices`, `LanguageService.initialize` and `initializeV4Layout`.

### webapp-shared-03 | BUG | LOW | `src/main.ts:133-139`
**Claim:** The welcome/changelog lazy-load IIFE has no `.catch`.

- A failed `import('@components/welcome-modal')` or `import('@components/changelog-modal')` is an unhandled rejection.
- The app registers no global `unhandledrejection` handler, as `changelog-modal.ts:120` itself notes.
- Both modals are lost, including the first-visit welcome and its `markAsSeen` bookkeeping.
- The second import is awaited before `showWelcomeIfFirstVisit()`, so a changelog chunk failure also suppresses the welcome modal.

**Failure:** A first-time visitor on a flaky link never sees the welcome modal, and the console shows an unhandled rejection.
**Tests:** None. Covered: no.
**Origin:** MAIN.
**Fix:** Catch inside the IIFE with `logger.warn`. Import and show each modal independently.

### webapp-shared-04 | OPT/operational | MEDIUM | `functions/_middleware.ts:10` (no `public/_routes.json`)
**Claim:** The root `_middleware.ts` runs on every request, static assets included.

- `git ls-files | grep _routes` finds no `_routes.json`, so Pages generates `include: ["/*"]` for the functions dir.
- Every HTML, JS, CSS, font, icon and image hit therefore invokes a Function. This is metered as a Worker request, adds a hop to each asset, and counts toward the Pages Functions daily limit.
- The middleware only matters for the old-domain redirect (all paths) and `/assets/*` (the HTML-fallback guard).

**Failure:** Under traffic, or on the free-plan Functions quota, exhaustion breaks the whole site, because the middleware fronts static serving too. Even within quota, every asset pays an invocation.
**Tests:** `src/__tests__/pages-middleware.test.ts` tests the handler only, never what routes reach it. Covered: no (the routing config is absent).
**Origin:** MAIN.
**Fix:**
- Add `public/_routes.json` with `include: ["/assets/*"]` and move the old-domain 301 to a Cloudflare Redirect Rule or Bulk Redirect.
- Alternatively keep `/*` and accept the invocation cost deliberately, documented in `functions/README.md`.

### webapp-shared-05 | BUG | LOW | `src/shared/example-link.ts:44-50`
**Claim:** The client mirror omits two server rules, so "valid" on the client can still be rejected by the server.

- The server (`apps/presets-api/src/services/validation-service.ts:424`) enforces a 300-character maximum.
- The server (`validation-service.ts:436`) also enforces `hasOnlySupportedCharacters` on the raw string.
- `exampleLinkError` checks only scheme and host.
- The doc comment at `example-link.ts:1-10` claims the forms "cannot drift".

**Failure:** `eorzeacollection.com/glamour/1?x=` followed by 300 or more characters, or a link containing an interior space or tab (`new URL` strips or encodes it), passes `exampleLinkError`. The submit then fails server-side with only the generic submit error.
**Tests:** `example-link.test.ts` covers hosts and schemes only. Covered: no.
**Origin:** MAIN.
**Fix:** Mirror the length cap and character rule in `parseAllowedExampleLink`, or export the validator from a shared package. Add `maxlength=300` on the input.

### webapp-shared-06 | BUG | LOW | `src/shared/palette-export.ts:135-137`
**Claim:** `today()` uses `toISOString()`, which is the UTC date.

- It feeds the export header, the JSON `generated` field and the filename `xiv-<tool>-<date>.<ext>`.
- For users west of UTC in the evening, and east of UTC in the early morning, the stamped date is one day off from their local day.

**Failure:** At 20:00 on 2026-10-04 in UTC-5 the export reads `2026-10-05`.
**Tests:** `palette-export.test.ts` likely stubs a fixed instant, so there is no timezone case. Covered: no.
**Origin:** MAIN.
**Fix:** Build `yyyy-mm-dd` from local `getFullYear/getMonth/getDate`, or `toLocaleDateString('sv-SE')`.

### webapp-shared-07 | BUG (i18n) | LOW | `src/main.ts:162-166`
**Claim:** The fatal overlay is localised except for its detail line.

- `fatalStrings()` supplies the title, body and button in the browser language.
- The detail line comes from `ErrorHandler.createUserMessage`, which returns the English-only `ERROR_MESSAGES` (`src/shared/constants.ts:127+`).

**Failure:** A ja/ko/zh user sees a localised headline over an English detail sentence.
**Tests:** None. Covered: no.
**Origin:** MAIN.
**Fix:** Extend `FATAL_STRINGS` with a generic detail line, or drop the detail when the language service is not ready.

## POSITIVE

- `beta-branding.ts` `addBetaHeaders` and `findDuplicatePathPatterns` mirror wrangler's `_headers` parsing:
  - the robots directive goes inside the existing `/*` rule;
  - the CRLF EOL is preserved;
  - the build throws when there is no `/*` rule, and also on a duplicate pattern.
- `check-beta-build.js` re-parses `dist/_headers` independently, so it is not blind to a duplicated `/*` rule. `smoke-test-pages.js` checks both phases and the security headers end to end, with a thorough robots-directive regex.
- `logger.ts` routes everything through the package logger, so redaction runs. Errors are serialised explicitly, and the dev gating is deliberate.
- `clipboard.ts` builds the `ClipboardItem` inside the user activation with promise-valued flavours. The unhandled-rejection marking is correct, and the fallback textarea and listener are cleaned in `finally`.
- `tool-handoff.ts` always sends stainID and skips custom dyes.
- `sanitizeExampleLink` returns the parsed `href` (spoof-safe) and requires an explicit https scheme on the read path.
- `check-bundle-size.js` derives its locale pattern from the filesystem, so a new language cannot silently go ungated. Unlisted chunks fall back to a default budget.
- The changelog bound is in bytes with a contiguous newest-first cut. `custom-dye.ts` mints a monotonic synthetic id.

## REJECTED

- **`REGION_KEYS[region]` (`region-name.ts`) and `CATEGORY_LABEL_KEYS[category]` (`preset-i18n.ts`) plain-object prototype lookups.** `category-icons.ts` was hardened (FINDING-027), but these two are not.
  - The inputs are server-validated enums or Universalis constants.
  - A `constructor` value cannot occur on any real path.
  - There is no reproducible failure, so I did not file it.
- **`CATEGORY_LABEL_KEYS` and `allowlist[english]` in `i18n-parity.mjs` for the same reason.** Build-time data, not client input.
- **CSS/SCSS comment injection through dye names or `meta` in `palette-export`.** Names come from the dye DB or locale files, and `meta` is app-authored, so a `*/` cannot be introduced.
- **Middleware 404 body lacking `_headers` security headers.** Pages applies `_headers` to static responses only. The body is plain text and `no-store`, so the impact is nil.
- **`parseHeaderRules` treating a header value as a rule opener.** A header line must start with `/` or `scheme://` to open a rule, and no header name does.
- **`check-beta-build.js` duplicating the header parser.** The independence is the point of the gate.
- **`formatDate` timezone off-by-one.** The only caller passes a local `updatedAt` number, not a date-only string.
- **`changelog-parser` date regex and a hyphenated version suffix.** Release-note format is author-controlled, and a mismatch drops only that release.
- **`getDefaultConfig` returning the shared singleton.** `config-sidebar.ts:152` clones it, as its own comment says.

## COVERED

51 files read, all non-test source in the slice except the SVG-path-only icon constants, which I skimmed:

- Entry, middleware, plugins and package: `src/main.ts`, `functions/_middleware.ts`, `package.json`, `vite-plugin-async-css.ts`, `vite-plugin-beta-branding.ts`, `vite-plugin-changelog-parser.ts`.
- Shared modules: `src/shared/` (all 31 modules).
- Scripts read in full: `check-bundle-size.js`, `check-beta-build.js`, `smoke-test-pages.js`.
- Scripts read only for the diff since 79a69d1f: `i18n-parity.mjs`.
- Scripts not reviewed beyond a skim: `validate-i18n.js`, `analyze-unused-keys.js`, `reorder-locales.mjs`, `generate-*icons.mjs`.
- Cross-checked against: `packages/core/src/services/APIService.ts`, `apps/presets-api/src/services/validation-service.ts`, `apps/web-app/public/_headers`, `_redirects` and `src/__tests__/pages-middleware.test.ts`.
