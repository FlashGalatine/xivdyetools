# Review gap2-web-app-grep-only-components (2026-10-03)

Scope: web-app components/services listed in the gap assignment. Read-only; no probe scripts.

## 1. Entry points and authz
All client-side, no server routes. Entry = user-supplied data into the files in scope.
| entry | source of untrusted data | guard before sink | cap |
|---|---|---|---|
| extractor drop/dialog/camera(`capture` file input)/Ctrl+V/Clipboard API | image file | `handleDroppedFile` size check extractor-tool.ts:1302 (MAX_USER_FILE_BYTES 20 MB, constants.ts:127); decode via Image | 20 MB |
| settings import (advanced-options-panel.ts:305-330) | user-chosen JSON | `type` check, `ConfigController.importConfigs` -> `sanitizeConfigPartial` (config-controller.ts:93-104) | none (known handoff) |
| collection import (collection-manager-modal.ts:570-600) | user-chosen JSON | `CollectionService.importData` collection-service.ts:895-1005 | none (known handoff) |
| /presets/:id deep link + popstate (preset-tool.ts:479-580) | URL sub-path | `encodeURIComponent` in community-preset-service.ts:347 | n/a |
| community preset fields (preset-tool.ts:660-680) | presets-api JSON | lit text bindings; `sanitizeExampleLink`/`sanitizePreviewImageUrl` (shared/example-link.ts:56,70) | n/a |
| glamour sheet textarea (glamour-sheet.ts:262-285) | user text | stored via AcquisitionEdits (localStorage), rendered via textarea.value | n/a |
| tool-handoff.ts `handoffTo` | internal Dye object | String(stainID), null stainID refused (:68-71) | n/a |

## 2. Positive controls
- extractor-tool.ts:1253-1262,2123-2145: image held in memory only (`currentImage`), pixels read from canvas into local arrays, no storage/fetch/IndexedDB/Cache call anywhere in the file (grep of indexedDB|caches|toDataURL|toBlob|fetch|sendBeacon: no hits). IndexedDB stores are only price_cache/palettes/settings (indexeddb-service.ts:21-25); FINDING-009 does not regress. extractor-tool.ts:431-433 deletes the legacy `v3_matcher_image` etc keys on mount.
- Camera is a plain `<input type=file capture=environment>` (extractor-tool.ts:577-583); no getUserMedia anywhere in src (git grep). Paste paths feed the same `handleDroppedFile`. The `image-loaded` event (extractor-tool.ts:1327) has no listener in src (git grep).
- config import: `Object.hasOwn(defaults, field)` + `hasShapeOf` (config-controller.ts:93-104) drops `__proto__`/`constructor`/unknown keys; nested merge uses object spread (`{...defaultValue,...storedValue}` :125-138), which defines own properties and cannot pollute prototypes.
- collection import builds fresh records via `createCollection` (name length cap, description cap, kind allowlist `isCollectionKind`, target via `toStainId`, dyes via `toStainId`) collection-service.ts:926-985; per-record try/catch.
- preset-tool.ts:660-680 and card/detail render with lit text bindings; only `unsafeHTML` use is a constant icon (preset-tool.ts:1145). example_link re-validated on read path for API and localStorage snapshots (:676,:698).
- collection-manager-modal.ts: every `innerHTML` is a constant SVG/glyph (:83,154,164,175,496); name/description via `textContent` (:133,140); download filename regex-sanitised (:535); swatch colour comes from the dye DB (:215,486).
- glamour-sheet/twin-picker/export-sheet/glamour-tool: `style.cssText` interpolations are constants/CSS vars only (glamour-sheet.ts:270); no innerHTML; export filename is `xiv-<tool>-<date>.<ext>` (palette-export.ts:316), export bodies use dye DB names, positional identifiers (palette-export.ts:58).
- theme-service.ts:161-169: stored theme validated against THEME_NAMES; migration returns only 'standard-light'/'standard-dark'; palette values come from a constant table.
- storage-service.ts: generic wrapper, JSON.parse of own-origin data, no sinks.

## 3. Rejected
- Prototype pollution in settings/collection import: no path (see positive controls).
- Nested config objects (displayOptions etc.) not field-sanitised: only same-origin consumers, equivalent to editing localStorage by hand; no sink.
- `market.server`-style string imported unvalidated: same as hand-edited localStorage; self-inflicted, not a boundary.
- `tInterpolate` uses `String.replace` with user `name` (language-service.ts:188): `$&` patterns only garble a toast; text node, no HTML.
- Preset `author_name` in `SavedPreset` snapshot in localStorage (`v5_saved_presets`): public data the user chose to save, on device.
- shared/subscription-manager.ts, image-zoom-controller.ts (constant SVG only), glamour-list-actions.ts: nothing security relevant.
- Storage keys: theme (`xivdyetools_theme`), config (`xivdyetools_v4_config_*`), collections/favorites, `xivdyetools_glamour_acquisition_edits` (keyed by gear hash, acquisition-edits.ts:28), `v5_saved_presets` all fall under PRIVACY.md:44-49 wording; extractor writes nothing.

## 4. Files covered
apps/web-app/src/: shared/tool-handoff.ts, shared/subscription-manager.ts, shared/example-link.ts, shared/download-file.ts, shared/palette-export.ts (grep+partial), shared/acquisition-edits.ts (grep), services/storage-service.ts, services/theme-service.ts, services/collection-service.ts (import/create), services/config-controller.ts (import/merge), services/indexeddb-service.ts (store list), components/advanced-options-panel.ts (270-394), components/extractor-tool.ts (grep-driven plus 415-440, 1250-1335, 2110-2200), components/v4/preset-tool.ts (grep-driven plus 476-730), components/collection-manager-modal.ts (grep + 549-638), components/export-sheet.ts, components/glamour-sheet.ts, glamour-twin-picker.ts, glamour-list-actions.ts, glamour-tool.ts, image-zoom-controller.ts (sink grep); apps/web-app/PRIVACY.md:42-56.

## 5. Candidates
| cid | sev | exposure | path:line | claim |
|---|---|---|---|---|
| c1 | LOW | INTERNET-UNAUTH | apps/web-app/src/components/advanced-options-panel.ts:314-321 + services/config-controller.ts:409-420 | A settings file from someone else can switch `advanced.analyticsEnabled` to true on import; opt-in then happens without the toggle. |

## 6. Handoffs
- PRIVACY.md:44-49 does not name `v5_saved_presets` (saved community presets snapshot incl. other authors' names) explicitly; consider wording under "saved palettes". Docs.
- Import size cap absent (already tracked).
