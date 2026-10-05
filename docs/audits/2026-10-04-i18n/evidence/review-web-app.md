# Review: web-app (code) - i18n audit 2026-10-04

Slice: `apps/web-app/src` BASE (5c80fcba) -> HEAD, 29 commits. Only one commit is not on MAIN: 3daa83fd (#223, privacy copy). Every other finding therefore has origin MAIN.

## Candidates

| id | prefix | tier | file:line | locales | origin | claim |
|---|---|---|---|---|---|---|
| W1 | HC | P3 | components/glamour-block.ts:1159 | ja de fr ko zh | MAIN (existed at BASE in chara-import.ts:1785) | Facewear chip `title` interpolates `colour.name`, the English colour name ("Silver"), into the localized `swatch.facewearColorTag`. The row line right above it correctly uses `LanguageService.getFacewearColorName(colour.id)`. Result in ja: "Silver・フェイスウェアカラー". |
| W2 | I18N | P3 | components/glamour-block.ts:518, :964, :1497-1501; components/glamour-sheet.ts:143 | en de fr | MAIN | Plural faults. `swatch.equipCount` is "{channels} channels / {dyes} dyes" with no singular form ("1 channels / 1 dyes"). `glamour.row.twins` is the +N chip aria-label, always `familySize-1`, so a pair gives "Same look as 1 other items" (de "1 weitere Gegenstände", fr "1 autres objets"). `glamour.sheet.sub` gives "1 pieces". The footnote picks One/Many with a hand-written `=== 1` rather than plural rules, so fr 0 reads "0 pièces portées sont non teintes" / "0 emplacements sont vides" (fr treats 0 as singular). The verdict segments do it right with `Intl.PluralRules` plus `_one`/`_other`. |
| W3 | TERM | P2 | locales/de.json:1390 | de | MAIN | `glamour.fact.dye` = "FARBE ×{n}". Brief: German dye is `Farbstoff`, never `Farbe`. Every other new de key says Farbstoff (`verdict.segDye`, `row.blockedDye`). |
| W4 | I18N | P3 | shared/example-link.ts:65 (shown at components/v4/preset-detail.ts:996, preset-card.ts:336) | ja (mainly) | PR#223 | `sanitizeExampleLink` now returns `URL.href`, so non-ASCII path or tag text is percent-encoded. The same string is the visible link text and the card caption, so a pixiv/mirapri/misskey link with Japanese text reads `%E3%83%9F...`. Deliberate anti-spoof change (FINDING-016); the display could decode while `href` stays encoded. Low confidence, cosmetic. |
| W5 | I18N | P3 | components/chara-file-card.ts:158 | ja zh ko | MAIN | The privacy line is `${privacyHint()} ${note}`, two sentences joined with an ASCII space. ja/zh/ko get a Latin space between full-width sentences (house style is no space). Cosmetic. |

## What I checked

- Every `t()` / `tInterpolate()` / `tSwatch()` literal in glamour-block, glamour-sheet, glamour-tool, glamour-twin-picker, chara-file-card, chara-sheet, chara-ui, glamour-list-actions, swatch-tool, v4-app-header, config-sidebar, v4-layout, v4-layout-shell, chara-file-loader, chara-resolve-service, chara-session-service against all six locale files (script in scratchpad). 0 missing. The only "missing" hits were `tools.<id>` prefixes in v4-app-header, which resolve to `.title`/`.shortName`/`.description`.
- Dynamic key families enumerated from code and checked in all six locales (0 missing):
  - `swatch.gearSlot.${slot}`: 12 CharaGearSlotId values (MainHand, OffHand, HeadGear, Body, Hands, Legs, Feet, Ears, Neck, Wrists, LeftRing, RightRing).
  - `glamour.fact.${key}`: best, dye, anyTribe, tribeOk, tribeNo, dated, grandCompany, noGlamour (core chara-twins.ts:60-68).
  - `glamour.sheet.state{Filled,Edited,Blank}`.
  - `glamour.row.*`: the four blocked, three fixed, tag, otherWorks, noFix, choice, company and twins keys.
  - `glamour.verdict.seg{Fixed,Wear,Dye,Glamour,NoItem,Company}_{one,other}` and the four `count*` keys.
  - `swatch.slot*` and `swatch.slotError.*` (the SLOT_ERROR_KEY map plus `unknown`).
  - `tools.glamour.{title,shortName,description,lead}` and `.title` via ROUTES for `document.title` and the load toast.
- Hardcoded English: grep for title/placeholder/aria-label/textContent/Toast literals in all new and changed components found none. Read all 13 innerHTML sites in webapp-innerhtml-sites.txt: every text node goes through `t()`. The only literals are the provider names Discord and XIVAuth, and the ✓/★/D/X glyphs.
- Language switch: GlamourTool subscribes (`onMount`) and rebuilds, moving the block via `moveTo`, whose `render()` closes the twin picker. CharaFileCard, CharaSheet and GlamourBlock re-read strings on each render. SwatchTool no longer caches the slot label: selection context stores `slotKey` and `pickedSlotLabel()` translates at draw time (swatch-tool.ts:2009). The cross-link and privacyNote strings are built inside `renderContent`/`mountChara`, so they are fresh per render. config-sidebar `charaLoaded` is state, not text.
- Locale-aware formatting: no `localeCompare`, `toLocale*` or `sort` on display text in the new files. The only `localeCompare` is chara-resolve-service.ts:99, an identifier cache key. Lists and "and" use `Intl.ListFormat(lang)` and plurals use `Intl.PluralRules(lang)` (glamour-block.ts:987, 1427-1446). Item names go through `itemNameFor(names, lang)` (falls back to EN per item). Dye names go through `localizedDyeName` / `dyeName`. Clan names come from `LanguageService.getClan`.
- #223: the About modal is unchanged since BASE; `policyDocFile()` (about-modal.ts:90) maps ja/de/fr/ko/zh to `<STEM>.<lc>.md` and everything else to the English file. `charaHintGlamour` is wired into all four privacy surfaces and the LOCAL ONLY chip is dropped when `sendsGearIds` is set (chara-file-card.ts:113, 286). The six `charaHintGlamour` values and `preset.privacyNote` honour the one-operator register (ja 運営者, de unsere, fr notre, ko 저희, zh 我们).

## Positive controls

- Dropping `glamour.verdict.segWear_one` from a locale would have been caught by the script as a missing literal. The script flagged `tools.glamour.name`, a key I invented, so it does detect absences.
- ko/ja/zh `_one` and `_other` verdict values are identical by design, because `Intl.PluralRules` returns `other` for those locales.

## Rejected

- Sheet row labels "Main Hand"/"Rings" and the "Acquisition:" label beside the textarea (glamour-sheet.ts, glamour-list-actions.ts:158) are English. These are the fixed GPOSERS template labels documented in glamour-markdown.ts. Not filed.
- Acquisition lines in the sheet are api-worker's English GPOSERS text. Same decision.
- The sheet and the twin picker are mounted on `document.body` and do not follow a language switch. A switch is unreachable while the sheet is open: the overlay covers the header and `ModalService.registerExternal` stands the Shift+L shortcut down. The picker is closed by the block re-render.
- `swatch.parseFailed` embeds core's English `reason`. Deliberate and documented (chara-file-loader.ts, chara-file-card.ts:122).
- `.toFixed(1/2)` for ΔE and alpha (chara-sheet.ts:369, 408; swatch-tool.ts:925). Pre-existing, matches the other tools' ΔE display, and not routed through format.ts anywhere in the app.
- share-service.ts English meta titles/descriptions and the index.html "ten ... tools" alt text. Crawler text, English by design (the colour -> color fixes there are American-spelling clean).
- de "Paletten" vs tool name "Vorlagen" in `preset.privacyNote`. The wording is pre-existing in the sign-in copy and "palette" is a separate concept from the preset tool, so I did not file it.
- `shortcuts.switchTool` "0-9": the key is literal and the label is generic. No "nine tools" claim remains in locales or code.

## Files covered

components: glamour-block, glamour-sheet, glamour-tool, glamour-twin-picker, glamour-list-actions, chara-file-card, chara-sheet, chara-ui, swatch-tool (diff), v4-layout, v4-layout-shell, v4-app-header, config-sidebar, shortcuts-panel, about-modal, preset-detail (link display). services: chara-file-loader, chara-resolve-service, chara-session-service, config-controller, modal-service, router-service, keyboard-service, share-service. shared: glamour-markdown, example-link, dye-name, tool-icons, tool-config-types. delta/web-app.tsv (123 rows, glamour.* and swatch.* read in all six locales).
