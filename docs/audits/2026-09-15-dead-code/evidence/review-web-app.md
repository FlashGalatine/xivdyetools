# Web-app manual review

Scope: tracked `apps/web-app` source, tests, E2E, scripts, Pages function/config,
public assets, CSS mount paths, and dynamic i18n families. This was a read-only
manual review; the root collector owns Knip, `tsc`, and gates.

## Candidates

| cand-id | confidence | file:line | claim | evidence pointer |
|---|---|---|---|---|
| WEB-DC-01 | high | `apps/web-app/src/services/indexeddb-service.ts:183-217` | `IndexedDBService.getWithContext` is an unused public method; its `GetResult` return type at lines 32-32 becomes unused too. | Exact tracked-tree `git grep` for `getWithContext` returned only its declaration. Syntax survey: `prodFiles=0 testFiles=0`. Estimated 35 source lines plus 1 type line. |
| WEB-DC-02 | high | `apps/web-app/src/services/saved-presets-service.ts:121-124` | `SavedPresetsService.isSaved` has no caller in production or tests. | Exact tracked-tree `git grep` for `isSaved(` returned only this declaration; survey: `prodFiles=0 testFiles=0`. Estimated 4 lines. |
| WEB-DC-03 | high | `apps/web-app/src/services/share-service.ts:578-584` | `ShareService.getBaseUrl` is an unused static helper. | Exact tracked-tree `git grep` for `getBaseUrl(` returned only the declaration; survey: `prodFiles=0 testFiles=0`. Estimated 7 lines. |
| WEB-DC-04 | high | `apps/web-app/src/services/theme-service.ts:329-343` | `ThemeService.getRequiredColor` is an unused legacy palette accessor. | Exact tracked-tree `git grep` found only its declaration plus two comments that explicitly state it has no production caller; survey: `prodFiles=0 testFiles=0`. Estimated 15 lines. |
| WEB-DC-05 | high | `apps/web-app/src/components/base-component.ts:703-709` | `BaseComponent.setStyle` has no caller in production or tests. | Exact tracked-tree `git grep` for `.setStyle` / `setStyle(` returned only the declaration; survey: `prodFiles=0 testFiles=0`. Estimated 7 lines. |

Estimated removable source: 68 lines, plus the one type alias made unreachable by WEB-DC-01.

## Coverage and limits

- Reviewed all 282 tracked `apps/web-app` `src`/`public` files plus config, functions, scripts,
  and E2E names from `git ls-files`; searches used `git grep` only (no coverage/build output).
- `syntax-candidates.txt` was used for member and arrow-field triage, then each candidate was
  re-checked with exact symbol searches over the tracked tree. Its known same-name and decorator
  blind spots were handled manually.
- Rejected member-only candidates: test-isolation/readback hooks (`resetToDefault`,
  `__resetForTesting`, `__reloadForTesting`, `resetAvailabilityCache`) and other methods with
  actual test callers; these are deliberate test support, not source removals. `BaseComponent`
  `hasErrorState`, `getError`, and `isVisible` are likewise test-only but documented and covered.
- Rejected apparent orphan Lit modules: `@customElement` side effects make
  `v4-display-options`, `dye-palette-drawer`, `preset-card`, `preset-detail`, `preset-tool`,
  and `v4-app-header` live through custom-element tags. `v4-layout.ts` creates the preset tool;
  shell/config templates mount the other tags.
- CSS mount-path check: `main.ts` imports `themes.css`, `v4-layout.css`, and `tailwind.css`;
  `tailwind.css` imports `globals.css` and `tool-content.css`; `v4-layout.ts` imports the latter
  inline into the shell shadow root. Light-DOM modals and shadow-root tools therefore both have
  the required rule path. No CSS candidate filed.
- Assets: `vite.config.ts` sets `publicDir: '../public'`. Fonts, metadata, icons, JSON, and
  `/og/default*.png` have source/config/test references; beta icons are consumed by the beta
  plugin. The only generator input (`scripts/assets/bot-avatar-beta-1024.png`) is used by the
  documented manual beta-icon script. No asset candidate filed.
- Dynamic i18n: `scripts/analyze-unused-keys.js` explicitly resolves dotted template-prefix and
  suffix families; source review confirmed dynamic `preset`, `swatch`, `tools`, `comparison`, and
  `harmony` forms. The root collector's `web-app-i18n-unused.log` is the gate evidence; no locale
  candidate is claimed here.
- Framework/config positive controls retained: `functions/_middleware.ts` is Cloudflare Pages'
  convention entry, Vite plugins/config are Vite-loaded, scripts are package/workflow/manual
  operational entries, and `wrangler` remains a documented CI-pinned dev dependency.
