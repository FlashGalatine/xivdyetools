# Review: webapp-glamour (Glamour Reader)

Branch preview/integration-2026-10-04 @80262a2f. Read-only review. All paths under `apps/web-app/src/` unless noted.

## Map
| Module | Role |
|---|---|
| services/chara-file-loader.ts | 20 MB cap, `file.text()`, core `parseCharaFile` + `resolveCharaColors`, generation-guarded publish |
| services/chara-session-service.ts | memory-only session + subscribers (fileName kept, never sent) |
| services/chara-resolve-service.ts | POST /v1/chara/resolve (gear model keys + glasses id only), 12 s timeout, session cache |
| components/chara-file-card.ts | drop zone / file card / privacy line (PR #223: `sendsGearIds` swaps LOCAL ONLY chip + hint) |
| components/glamour-tool.ts | tool shell, lazy chunk for the block (PR #223 passes `sendsGearIds`) |
| components/glamour-block.ts | rows, verdict, twin state, palette panel, list actions |
| components/glamour-twin-picker.ts | SAME LOOK popover/sheet |
| components/glamour-sheet.ts + glamour-list-actions.ts | export sheet, editable Acquisition lines, Copy/Save |
| shared/acquisition-edits.ts | device-kept edits keyed by FNV hash of slot/family/stains |
| shared/glamour-markdown.ts | MD/HTML/plain renderings over core `chara-gposers` |
| shared/item-links.ts + components/item-links-menu.ts | "Open in..." menu (no Eorzea Collection) |
| components/chara-sheet.ts / chara-ui.ts | THIS CHARACTER sheet, shared helpers |

Privacy trace: the request body is `{gear:[{slot,set?,base,variant}], glasses?}` (chara-resolve-service.ts:118-135). Nickname and fileName are used only for the card (chara-file-card.ts:295,303), the local collection name, and console logs. Telemetry carries `ok` + normalized producer only (chara-file-loader.ts:79-82). Exports carry no name (glamour-markdown.ts:56, glamour-list-actions.ts:82-103).

## Candidates

### webapp-glamour-01 (BUG, LOW) chara-resolve-service.ts:118 + packages/core/src/services/chara/chara-parser.ts (readModelLane, readGlassesId)
- Claim: the client sends model lanes / glasses id unbounded; api-worker rejects any lane > 0xffff or glasses > 0xffff for the WHOLE request (apps/api-worker/src/chara/router.ts:42,70-73,139-146), which the client treats as an outage.
- Failing input: a hand-edited or corrupt `.chara` with `Body.ModelBase: 70000` (or `Glasses.GlassesId: 99999`) -> resolve returns 400 -> CharaResolveUnavailableError (chara-resolve-service.ts:156-160) -> every piece loses its name, twin picker and verdict ("names unavailable"); Copy list exports blank names.
- Tests miss it: parser/resolve tests use in-range keys. Covered: no.
- Origin: MAIN.
- Excerpt: `return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;` (no upper bound)
- Fix: clamp or drop lanes > 0xffff in `readModelLane`/`readGlassesId` (treat as empty), or filter before `fetch`.

### webapp-glamour-02 (BUG, LOW) packages/core/src/services/chara/chara-parser.ts (gearDyes loop) -> glamour-list-actions.ts:96, glamour-block.ts (dyeLineText)
- Claim: `stainId` is any finite number > 0, not floored or range-checked (lanes ARE floored). Non-integers reach the UI and the export.
- Failing input: `"DyeId": 3.5` or `1e21` -> no dye found -> row says `#3.5` / `#1e+21`; the GPOSERS list writes `Dye 1: #3.5`; `gearHash` input includes it.
- Tests miss it: fixtures use integer stains. Covered: no. Origin: MAIN.
- Fix: `Number.isInteger(value) && value > 0 && value <= 255` (else treat as undyed or surface a slot warning).

### webapp-glamour-03 (BUG, LOW, privacy) glamour-block.ts:1716-1721, chara-sheet.ts:162-165
- Claim: the character `Nickname` (or the file name, which players often set to the character name) becomes the persisted collection name by default. A glamour palette is `kind: 'palette'`, so it surfaces in the Presets "Saved" shelf (components/v4/preset-tool.ts:427,715) and in the collection JSON export / download filename (components/collection-manager-modal.ts:527-535). The code comments say the community path never reads it, which is true, but screen-shares, exported JSON and filenames now carry the name.
- Failing input: Nickname "Real Name"; open Make a palette, leave the name blank, Save to this device -> collection "Real Name" listed in Presets and exportable. Also `logger.info('Saved glamour palette "Real Name"')` (glamour-block.ts:1741; chara-sheet.ts:174) and `Parsed <file>` (chara-file-loader.ts:90) put it in the console.
- Tests miss it: glamour-block-palette-name.test.ts pins the community path only. Covered: partly. Origin: MAIN.
- Fix: default to the localized `paletteDefaultName` (or ask) for kind 'palette'; drop the name from the log lines.

### webapp-glamour-04 (BUG, LOW) glamour-tool.ts:130-150 with glamour-block.ts:312-340
- Claim: a file loaded in the Swatch Matcher (card promise: "LOCAL ONLY / nothing uploaded", chara-file-card.ts:278-283) is POSTed to api-worker the instant the player opens the Glamour Reader (cross-link or key `0`); `syncBlock` -> `GlamourBlock.show` -> `startResolve` with no step in between.
- Failing flow: drop file in Swatch -> press `0` -> request with gear model keys leaves the device. The Reader's own card now says so (PR #223 copy), but the player had no moment to decline.
- Covered: no. Origin: PR-#223 made the Reader honest; the auto-send itself is MAIN.
- Fix: acceptable as is if the disclosure is deemed enough; otherwise gate the first resolve on a click for a session that came from the Swatch tool.

### webapp-glamour-05 (BUG, LOW) glamour-twin-picker.ts:226-242, item-links-menu.ts:176-181
- Claim: the twin picker and the "Open in..." menu take focus but never register with ModalService (the export sheet does, glamour-sheet.ts:428), so keyboard-service.ts:155 lets global shortcuts through.
- Failing input: picker open, focus on a radio, press `2` -> `handleToolNavigation` leaves the tool (the picker is torn down by GlamourBlock.destroy) instead of being ignored; Shift+T flips the theme under the open picker.
- Covered: no. Origin: MAIN. Fix: `ModalService.registerExternal()` while open, release in cleanup.

### webapp-glamour-06 (BUG, LOW) chara-file-loader.ts:43-49
- Claim: `++loadGeneration` runs before the size check, so an oversize drop supersedes an earlier valid file still being read/parsed.
- Failing input: drop valid A, immediately drop a 25 MB B -> A returns `superseded` silently (no session, no toast), B toasts "too large". Net: the player ends with no file and no explanation for A.
- Covered: no (tests cover supersede by two valid files, chara-file-loader.test.ts:186,200). Origin: MAIN. Fix: bump the generation only after the size check passes.

### webapp-glamour-07 (OPT, LOW) shared/acquisition-edits.ts:55-58,76-81; glamour-sheet.ts:74-82,276-300
- Claim: every `AcquisitionEdits.get` does a full `localStorage` read + `JSON.parse`; each keystroke triggers ~3 x piece-count of them (`acquisition()`, tally, `refresh`). The textarea has no `maxLength`.
- Failing input: paste a 1 MB note into one row -> ~30 MB parsed per keystroke. Fix: cache the parsed map per sheet open (write-through) and cap the note length.

### webapp-glamour-08 (REFACTOR, LOW) glamour-block.ts:110-118
- `DYEABLE_SLOTS` duplicates core's private `DYEABLE` (chara-gposers.ts); the comment says "change both". Export one from core. glamour-block.ts is 1750 lines but I found no correctness risk hidden by the size.

## POSITIVE
- Untrusted-file handling is solid: 20 MB cap before `file.text()` (chara-file-loader.ts:49), core uses `Object.hasOwn` lookups, strict field errors, no Base64Image read; all file-derived text goes through `textContent` (`el()` chara-ui.ts:77-82, ToastService renders `message` via textContent).
- Generation guard on loads and `this.resolved !== resolved` / abort guards on resolve prevent stale results winning (glamour-block.ts:324-336).
- Export is one-line-safe (`text()` in core collapses newlines) and HTML is escaped (glamour-markdown.ts:100-107); the .md filename carries no name.
- Edits are keyed by gear hash, never by file or name; storage refusal degrades to page-only (acquisition-edits.ts:52-67).
- Sheet/picker/menu all tear down with the block (`destroy`), use token guards for lazy chunks, and the sheet traps Tab and registers as a modal.
- Item links never use Eorzea Collection or an FFXIV id for facewear; URLs are `encodeURIComponent`-safe.

## REJECTED
- XSS via parse-error `{reason}` (echoes file values): rendered with `textContent` in toast-container.ts:131. Safe.
- `AbortSignal.any` missing on older browsers: the TypeError rejects into the same unavailable path (glamour-block.ts:331), degrades gracefully.
- `url("${charaIconUrl(iconId)}")` injection: iconId is a number from our own worker.
- Same hash for "channel 1 only" vs "channel 2 only" stain dyes (gearHash): the Acquisition line does not depend on dye channel; harmless.
- Facewear colour read from the EN name (glamour-block.ts:164-170) mis-tinting a base row: could not construct a wrong case from the 11 names.
- Rings written once: LeftRing's edit is hidden when rings match; same name implies same source. Not a defect.
- LOCAL ONLY chip/hint after PR #223: body contents verified to match the copy (gear keys + glasses id only).

## COVERED (15 files)
components/chara-file-card.ts, chara-sheet.ts (skim), chara-ui.ts, glamour-block.ts, glamour-list-actions.ts, glamour-sheet.ts, glamour-tool.ts, glamour-twin-picker.ts, item-links-menu.ts; services/chara-file-loader.ts, chara-resolve-service.ts, chara-session-service.ts; shared/acquisition-edits.ts, glamour-markdown.ts, item-links.ts. Also read: core chara-parser.ts, chara-twins.ts, chara-gposers.ts; api-worker chara/router.ts (validation); keyboard-service.ts; storage-service.ts; toast-service/container.
