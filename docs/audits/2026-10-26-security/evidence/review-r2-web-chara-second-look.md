# Review r2-web-chara-second-look (deploy unit: web-app)

Independent second look at the web app's `.chara` surface, HEAD 13c386e5, written without
reading the first web-chara review. Read-only; no probes were needed beyond reading code.

## Module / message table

| Module | Trust boundary | What crosses | Validation |
|---|---|---|---|
| `src/services/chara-file-loader.ts` | user file -> page | `File` | name `*.chara` (l.72), `size > 8192` refused (l.75), capped read `slice(0, MAX+1)` re-checked (l.88,97), file name cut to 256 units (l.81) |
| `src/services/chara-inspection-service.ts` | page -> worker | `{type:'inspect', id, bytes}` transferred (l.307-309) | one pending call; supersede/cancel terminate the worker (l.169-186, 277, 317) |
| `src/workers/chara-inspection.worker.ts` | worker | bytes -> `inspectCharaForTools` (8 KiB `maxBytes`, core `chara-library.ts:143`) | input refusals -> `unreadable`, else `workerFailed`; no text crosses (l.81-92) |
| worker -> page `palette` | worker -> page | `{type,id,seq,request}` | `parsePaletteRequestMessage` allowlist (protocol l.887-906); page answers only the live call's own worker and active id (service l.237); cap 64 enforced both sides (worker l.128, service l.206) |
| page -> worker `palette-result/-error` | page -> worker | color or bare error | `parsePaletteReply` rebuilds the reply (protocol l.917-940); worker settles only open (id,seq) (worker l.166-173) |
| worker -> page `success/error` | worker -> page | `ImportedCharaCharacter` | `validateImportedCharacter`: exact own data props, dense arrays, vocab enums, canonical hex, 256-unit labels, 8 unique slots, <=12 models, <=24 dye channels, <=64 issues, 256 KiB bound; fresh DTO (protocol l.340-790) |
| `src/services/chara-session-service.ts` | page | session (memory only) | no storage (doc l.10-14); subscriber errors logged with fixed text (l.63) |
| `src/services/chara-resolve-service.ts` | page -> api-worker | `POST /v1/chara/resolve {gear:[{slot,set?,base,variant}], glasses?}` | uint16 lanes filtered (l.110-121, 171-176); response checked only for `success===true` and `data.items` being an object (l.216-224) |
| `src/components/item-links-menu.ts` + `src/shared/item-links.ts` | page -> new tab | fixed https hosts; names `encodeURIComponent`ed; `window.open(url,'_blank','noopener,noreferrer')` (menu l.130-131; links l.71-122) |
| `src/components/glamour-sheet.ts` + `src/shared/glamour-markdown.ts` + `src/shared/clipboard.ts` | page -> clipboard / download | GPOSERS text / HTML / `.md` | HTML flavour escapes every label and value (markdown l.112-136); fixed filename `glamour-equipment.md` (l.69) |
| `src/shared/acquisition-edits.ts` | page -> localStorage | user-typed Acquisition lines keyed by FNV hash of gear | per-entry type check on read (l.70-73) |

No routes in this unit (static SPA); authz matrix not applicable.

## Candidates (leads)

- r2-web-chara-second-look-01 (INFO, INTERNAL): `chara-resolve-service.ts:226-230` adopts `envelope.data.items` / `glasses` without a shape check; `iconId` reaches `style.backgroundImage = url("…/v1/chara/icon/${iconId}")` (glamour-block.ts:1001, 1178, 1328), `itemId` reaches unencoded URL paths (item-links.ts:72, 77), and non-string names would throw in `Intl.ListFormat` / `String.replace` (glamour-block.ts ~1065, item-links.ts:95). Precondition: api-worker (or its cache) must emit a non-number `iconId`/`itemId`; `apps/api-worker/src/chara/xivapi.ts:175-181` already admits only finite positive numbers, the property-level CSSOM assignment cannot add other declarations, and CSP `img-src` pins hosts. Hardening only: the page treats the worker's answer as untrusted but not the API's.
- r2-web-chara-second-look-02 (INFO, LOCAL): the page-side protocol accepts any `tribe` label <= 256 units (protocol l.739, 757: "the page treats an unknown tribe like any other local label") while every other identity field is vocabulary-checked; the value is then used unvalidated as `SubRace` (swatch-tool.ts:414-417 bypasses the `toSubRace` used at l.402; config-controller.ts:218-222 pins it into the persisted swatch config; chara-file-card.ts:317 indexes `SUBRACE_TO_CLAN_KEY[resolved.tribe]`). Reachable only through a defective first-party worker: xivcharakit enumerates the tribe (`dist/index.js:190`, `reader.enumeration("Tribe", TRIBES, …)`) and core projects only `state === 'valid'` (chara-library.ts:258).

## POSITIVE controls

- Worker is same-origin module worker (`new Worker(new URL(...), {type:'module'})`, service l.291); CSP `script-src 'self'` covers it on production, beta and both pages.dev hosts (evidence/live-headers.txt l.10, 27, 46, 63). No `blob:`/`data:` worker.
- Worker answers carry only fixed codes; no exception text crosses (worker l.81-92, 183-197); the service maps codes to fixed messages (service l.47-63).
- Protocol rejects (never strips) extras, accessors, symbols, holes and non-index array props; reads each value once and returns a fresh DTO; serialized bound measured on the copy (protocol l.344-388, 771-790).
- Every terminal path terminates the worker exactly once and frees the slot; late messages from a superseded call cannot publish (service l.169-191, 255, 260).
- Loader generation counter prevents an older file publishing over a newer one or after SWAP (loader l.49-60, 79-80, 96, 104, 120); SWAP cancels first (chara-file-card.ts:358-361).
- Core projects issue paths through `safePath` (known segments only) and bounds labels to 256 units (chara-library.ts:146-160); UI issue rows are fixed locale strings and look up keys with `Object.hasOwn` (chara-ui.ts:296-299, 369).
- Every file-derived string (nickname, producer, file name, item names, acquisition lines) is rendered through `textContent` (`el()` chara-ui.ts:211-215) or element properties (`title`, `value`); the only `innerHTML` in the scope is static SVG (glamour-block.ts:588, item-links-menu.ts:343-344).
- Hex values reaching `style` attributes are canonical-hex validated at the page boundary (protocol l.97, 423-429) or come from the bundled dye/facewear data.
- Resolve body carries only protocol-rebuilt `{slot,set?,base,variant}` models and the glasses row (resolve l.181-192), matching the `charaHintGlamour` promise; the Swatch Matcher never resolves (only `glamour-tool.ts:90` sets `sendsGearIds`), so its LOCAL ONLY chip is accurate.
- Community submission uses only the typed draft name, never nickname or file name (glamour-block.ts:1781-1806); download filename carries no character name (glamour-markdown.ts:69).
- Logs on every chara path are fixed strings or counts (loader l.92, 110, 113-117, 129; chara-sheet.ts:232; glamour-block.ts:404, 1857; glamour-sheet.ts:380, 398).
- Telemetry from this surface is `chara_parse {ok, producer}` with producer bucketed to anamnesis/ktisis/brio/other/none (loader l.109, 124-125; telemetry-service.ts:177-184).
- Palette provider re-checks the worker's tribe against `TRIBES` before any lookup (core chara-palette-provider.ts:114-118).
- External links: fixed https hosts, `encodeURIComponent` on names, Lodestone `%20`->`+` after encoding so names cannot add parameters, `noopener,noreferrer` (item-links.ts:71-122; item-links-menu.ts:130-131).

## REJECTED

- Nickname / file name become a local collection record name on an explicit save (chara-sheet.ts:209-214, glamour-block.ts:1818-1825): user-initiated, device-only, never logged (pinned by `chara-collection-privacy.test.ts`), never submitted to the community.
- File tribe/gender persisted into the swatch config (config-controller.ts:199-222): re-files the 2026-10-03 rejected "tribe-gender lock missing from the storage list".
- Acquisition edits (free text) in localStorage without a size cap (acquisition-edits.ts:28, 41-50): the player's own typed text on their own device, covered by "your own saved work"; quota failures fall back to page-only (l.56-66).
- Opening the Glamour Reader on a file loaded in the Swatch Matcher sends model numbers without a new drop (glamour-block.ts:297-298, 377-394): the reader's card states it (`charaHintGlamour`), the Swatch hint is true for the Swatch tool, and model numbers are not personal data.
- `item-links-menu.ts:188` logs the raw error object, unlike the fixed-text policy elsewhere: the error is `CharaResolveUnavailableError` with "api-worker answered N" or a browser network message; nothing from the file or the user.
- GPOSERS Markdown is unescaped (glamour-markdown.ts:103-105): the user's own document from XIVAPI names and their own typed lines; the HTML clipboard flavour, the only interpreted one, is escaped.
- Unbounded issue `code` length in the protocol (protocol l.716): only a first-party worker produces it, the 256 KiB bound still applies, and the code is never rendered (lookup only).
- Facewear colour regexes (glamour-block.ts:209-211) are built from bundled data, not file or API text.

## FILES COVERED (28)

apps/web-app/src/workers/ (1), apps/web-app/src/services/ (chara-inspection-protocol, chara-inspection-service, chara-session-service, chara-resolve-service, chara-file-loader, api-worker-origin; telemetry-service and config-controller in part), apps/web-app/src/components/ (chara-file-card, chara-sheet in part, chara-ui in part, glamour-block in part, glamour-twin-picker in part, glamour-list-actions, glamour-sheet in part, glamour-tool in part, swatch-tool chara sections, item-links-menu in part, collection-manager-modal in part), apps/web-app/src/shared/ (glamour-markdown, item-links, clipboard, acquisition-edits), apps/web-app/public/_headers, packages/core/src/services/chara/chara-library.ts (part), apps/api-worker/src/chara/xivapi.ts (part), xivcharakit@0.1.0-beta.4 dist/index.js + types.d.ts (tribe only).

Not fully read: glamour-block.ts l.480-985 and l.1250-1640 (dye lens, verdict panel; covered by sink grep only), swatch-tool.ts outside the chara sections, chara-sheet.ts l.240-598 (sink grep only).
