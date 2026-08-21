# Hardcoded-string scan — Group 2 (extractor / image / camera / picker / recent-colors)

Scope (read completely, read-only): `src/components/extractor-tool.ts`, `src/components/image-zoom-controller.ts`, `src/components/image-upload-display.ts`, `src/services/camera-service.ts`, `src/components/camera-preview-modal.ts`, `src/components/color-picker-display.ts`, `src/components/recent-colors-panel.ts`. All paths relative to `c:\dev\XIVProjects\xivdyetools\apps\web-app\`.

| File:Line | String (verbatim) | Context | Priority | Existing key? | Suggested key |
|---|---|---|---|---|---|
| src/components/extractor-tool.ts:310 | `'Failed to load image'` (fallback when `event.detail.message` is empty, fed to `ToastService.error`) | toast | High | similar: `errors.imageLoadFailed` = "Failed to load image. Please ensure it is a valid image file." | reuse `errors.imageLoadFailed` |
| src/components/extractor-tool.ts:1840 | `'Sampled Color'` (color-info card title bar) | text | High | none | `matcher.sampledColor` |
| src/components/extractor-tool.ts:1906 | `'Copy Color Info'` (button in color-info card) | text | High | none (`common.copied` / `success.copiedToClipboard` are result messages, not the action) | `matcher.copyColorInfo` |
| src/components/extractor-tool.ts:1938 | `'Color info copied to clipboard'` (`ToastService.success`) | toast | High | similar: `success.copiedToClipboard` = "Copied to clipboard!" (already used at L2864 in the same file) | reuse `success.copiedToClipboard` or add `matcher.colorInfoCopied` |
| src/components/extractor-tool.ts:2257 | `'Market'` (fallback `cardData.marketServer`, rendered on the v4-result-card price row) | text (fallback) | Medium | `common.market` = "Market" | reuse `common.market` |
| src/components/extractor-tool.ts:2776 | `'Market'` (same fallback in `renderPaletteResults`) | text (fallback) | Medium | `common.market` = "Market" | reuse `common.market` |
| src/components/extractor-tool.ts:712, 724 | `${this.sampleSize}px` (sample-size slider value readout) | text / unit | Low | none | `matcher.sampleSizePx` = "{size}px" via `tInterpolate` (px is a near-universal unit; borderline) |
| src/components/image-zoom-controller.ts:189 | `title: 'Zoom Out'` | title attr | Medium | none (`matcher.zoomFit` / `zoomWidth` / `zoomReset` exist as siblings; these three are the gaps) | `matcher.zoomOut` |
| src/components/image-zoom-controller.ts:200 | `title: 'Current Zoom'` | title attr | Medium | none | `matcher.zoomLevel` |
| src/components/image-zoom-controller.ts:219 | `title: 'Zoom In'` | title attr | Medium | none | `matcher.zoomIn` |
| src/components/image-upload-display.ts:167 | `${LanguageService.t('matcher.privacyTitle')}:` | concat (translated fragment + ":" punctuation) | Low | `matcher.privacyTitle` exists | move the colon into the locale value, or `tInterpolate('matcher.privacyLabel', {title})` (FR wants " :", JA/ZH want full-width "：") |
| src/components/image-upload-display.ts:166-185 | privacy line assembled as `<strong>{privacyTitle}:</strong> {privacyMessage} <a>{privacyLearnMore}</a>` | concat (three t() fragments joined into one line) | Low | all three keys exist | acceptable as separate sentences today; if re-flowed, give `privacyMessage` a `{learnMore}` placeholder |
| src/services/camera-service.ts:97 | `Camera ${this.availableCameras.length + 1}` (device-label fallback; surfaces as the camera-preview `<select>` option text when the browser withholds labels) | text (option label, via camera-preview-modal.ts:54) | Medium | none | `camera.deviceFallback` = "Camera {n}" via `tInterpolate` (side note: `this.availableCameras.length` is the OLD array inside the `.map`, so every unlabeled device gets the same number — a logic bug, not i18n) |
| src/components/camera-preview-modal.ts:54 | `camera.label \|\| `Camera ${index + 1}`` (option textContent) | text (option label) | Medium | none | `camera.deviceFallback` = "Camera {n}" via `tInterpolate` |
| src/components/recent-colors-panel.ts:153 | `title: `${color.hex} - Click to re-match`` | title attr | Low* | none | `matcher.recentColorTitle` = "{hex} – Click to re-match" |
| src/components/recent-colors-panel.ts:154 | `'aria-label': `Recent color ${color.hex}, click to match`` | aria-label | Low* | none | `matcher.recentColorAria` = "Recent color {hex}, click to match" |
| src/components/recent-colors-panel.ts:165 | `AnnouncerService.announce(`Re-matching color ${color.hex}`)` | announcer message | Low* | none | `matcher.rematchingColor` = "Re-matching color {hex}" |
| src/components/recent-colors-panel.ts:184 | `title: 'Clear recent colors history'` | title attr | Low* | similar: `matcher.clearHistory` = "Clear" (button text, too short for a title) | `matcher.clearHistoryTitle` |
| src/components/recent-colors-panel.ts:185 | `'aria-label': 'Clear recent colors history'` | aria-label | Low* | same as above | `matcher.clearHistoryTitle` |
| src/components/recent-colors-panel.ts:231 | `AnnouncerService.announce('Recent colors cleared')` | announcer message | Low* | none | `matcher.recentColorsCleared` |

\* `RecentColorsPanel` is **never instantiated** anywhere in `src/` (`grep "new RecentColorsPanel"` → no hits; `extractor-tool.ts:185` declares `private recentColors: RecentColorsPanel | null = null` and only ever calls `?.destroy()` / `if (this.recentColors) addRecentColor(...)`). The six strings would be High/Medium if the panel were live, but today they are unreachable — a dead-code candidate rather than a translation gap. Listed for completeness with priority downgraded to Low.

## Deliberately NOT flagged (verified)

- `extractor-tool.ts:1892-1898` `'HEX'`/`'RGB'`/`'HSV'`/`'LAB'` row labels and `:1932-1935` clipboard payload — technical identifiers (skip list).
- `extractor-tool.ts:2341-2377` `'NOFF'`/`'H429'`/`'TOUT'`/`'NCON'`/`'CANC'`/`'EUNK'` — intentional short display codes per the result-card convention, not prose.
- `extractor-tool.ts:2045` `'+'`, `:1975` hex `title`, `:2090` `"34%"` dominance labels — symbols/numbers.
- `image-zoom-controller.ts:206/358` `'100.00%'` / `${zoom}%` — numeric.
- `color-picker-display.ts:75` `placeholder: '#FF0000'` — hex; `:121/129/237/243` `RGB: rgb(...)` / `HSV: …° …% …%` — technical readouts; `:253` `new Error('EyeDropper API not supported')` — caught, `logger.info` only.
- `camera-service.ts:170/237/248/271` thrown `Error(...)` messages — every caller (`camera-preview-modal.ts` `startCamera` catch → `camera.permissionDenied`; `captureClickHandler` catch → `camera.captureFailed`) logs them and shows a translated string instead; never rendered.
- `camera-preview-modal.ts:201` `${w}×${h}` and `:213` `📷` — numbers/symbol/emoji.
- All `LanguageService.t(...)` / `tInterpolate(...)` usages in these files resolve to keys that exist in `en.json` (spot-checked `matcher.*`, `camera.*`, `common.*`, `errors.*`, `success.*`).
- No `dye.name` rendered directly in these seven files (the only `.name` access is `extractor-tool.ts:2405`, inside a `logger.info`). No English-pluralization ternaries found.

## Summary

20 rows: **High 4** (all `extractor-tool.ts` — the 'Failed to load image' toast fallback, 'Sampled Color' card title, 'Copy Color Info' button, 'Color info copied to clipboard' toast), **Medium 7** (2× 'Market' server-name fallback in `extractor-tool.ts`, 3 zoom-button `title`s in `image-zoom-controller.ts`, 2× `Camera {n}` device-label fallback in `camera-service.ts` / `camera-preview-modal.ts`), **Low 9** (the `px` unit readout, 2 concat notes in `image-upload-display.ts`, and 6 strings in the never-instantiated `recent-colors-panel.ts`). Per file: extractor-tool.ts 7 · image-zoom-controller.ts 3 · image-upload-display.ts 2 (concat only) · camera-service.ts 1 · camera-preview-modal.ts 1 · recent-colors-panel.ts 6 · color-picker-display.ts 0.

**Completely clean:** `src/components/color-picker-display.ts` (every visible label goes through `LanguageService.t`; the rest is hex/technical). `camera-preview-modal.ts` and `camera-service.ts` are clean except for the shared `Camera {n}` fallback label. `image-upload-display.ts` has no raw English at all — only the colon/fragment-assembly note.
