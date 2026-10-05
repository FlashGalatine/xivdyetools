# Review: ui-de (German UI strings), 2026-10-04

Scope: delta/web-app.tsv (122 rows) and delta/bot-logic.tsv (67 rows), de vs en; og-strings/og-embed de blocks; measurements.

## Checks run
- Script over all keys, web-app (1197) and bot-logic (706): de key set == en key set; `{placeholder}` sets equal en/de on every key (0 faults); no de value over 100 chars for any `commands.*` string (longest `commands.glamour.description` = 92).
- All 67 `changed` rows: every en-only change is a colour->color / behaviour->behavior / localise->localize spelling change (BASE vs HEAD en compared), so no de value is stale. `preset.privacyNote` and `tools.presets.title` changed in all locales and de was rewritten with them.
- Slot names (web `swatch.gearSlot.*`, `swatch.facewearSlot`, bot `card.glamourSlot.*`): all 12 + Facewear equal the dictionary's Equipment Slots table (Haupthand, Nebenhand, Kopf, Rumpf, Hände, Beine, Füße, Ohren, Hals, Handgelenke, Finger (rechts/links), Gesichtsaccessoires).
- Glamour tool name: web title `Projektionsleser`, short `Projektion`, OG_DECK `Projektionsleser`, TOOL_TAG `PROJEKTION`, bot card title `Projektion`, dictionary row `Projektionsleser`: all agree. `Projektion` is used as feminine; `projizieren` for "can't be a glamour". No Mirage/Glamour/Sie in new strings.
- Plurals: every new `_one`/`_other` pair present; grammar checked per key (one fault, below).
- Card widths: glamour-card status column is capped at STATUS_MAX 72 px (packages/svg/src/glamour-card.ts:105); 11 px mono is about 6.6 px/char, so `KEINE PROJ` (10 chars, about 66 px) fits; lead column LEAD_MAX 132 holds `FINGER (RECHTS)`. Not rendered, estimated.

## Candidates (details)
- TERM-1 `swatch.facewearColorTag` / `facewearColorUnknown` (web de.json:1262-1263) still say `Brillenfarbe` ("glasses color"). MAIN changed `swatch.facewearSlot` from `Brille` to `Gesichtsaccessoires` (BASE de.json had Brille) but left these two. Slot, dye category (`Gesichtsschmuck`) and this label are now three words; Facewear colors are core `facewearColors` (Silber, Gold...). Dictionary Equipment Slots section lines 313, 325.
- TERM-2 `glamour.fact.dye` `FARBE ×{n}` (de.json:1390) and `card.glamourStatusDye` `FARBEN` (bot de.json:618): en says DYE/DYES; house register is `Farbstoff`, never `Farbe`. Same file uses `{n} Farbstoffe` for the same count (`card.glamourDyes_*`).
- TERM-3 Preset has four names in de: `Voreinstellung(en)` 24 web keys (e.g. de.json:875), `Preset` 7 web keys (`preset.editTitle`), `Vorlage(n)` in bot (60 keys) and in web `tools.presets.title` `Community-Vorlagen` (de.json:71, changed in MAIN, en "Community Presets") plus OG_DECK/TOOL_TAG. The Presets tool is titled Vorlagen while its own page says Voreinstellungen. No dictionary row: unpinned, name one word.
- TERM-4 `Volksgruppe` (web de.json:85 `selectSubrace`, :1329 `noTribe`) for the clan, versus core `clans` (Wiesländer...) and `Stamm` in `swatch.dropBody` and bot `preferences.keys.clan`; `Volk` is the race (`glamour.verdict.explain`). Unpinned (dictionary lists clan values, not the noun); pre-existing at BASE for the two web keys.
- TERM-5 Look/outfit words: web `glamour.picker.head` `GLEICHES AUSSEHEN` and `glamour.row.noFix` "Aussehen" vs bot `card.glamourLooks` `+{n} OPTIK` and `card.glamourOneLook` `EINZIG`; `glamour.sheet.privacy` "dieses Outfit" (dictionary: one outfit = `Projektion`); `glamour.sheet.title` `Ausrüstungsliste` for en "Glamour list". `explain` says `jede Klasse` for en "any job" while `preset.categories.jobs` = `Jobs`. All P3.
- TERM-6 Abbreviations in de where en spells out: `glamour.fact.grandCompany` `STAATL. GESELLSCHAFT`, `glamour.verdict.countCompany` `{n} BRAUCHT GESELLSCHAFT` (drops "Staatliche", reads like any company), bot `card.glamourStatusGlamour` `KEINE PROJ` (dictionary: "the game has no short forms"). P3, fits the widths.
- I18N-1 `card.glamourFootShown_one` `{s} von {n} gefärbten Teil` (bot de.json:621): dative singular needs `gefärbtem`. `_other` (`gefärbten Teilen`) is right.
- I18N-2 No plural split on counts that can be 1: `glamour.row.twins` (aria-label, n = familySize-1, de.json:1380, "1 weitere Gegenstände"), `glamour.sheet.sub` ("1 Teile", de.json:1400). en has the same fault ("1 other items", "1 pieces"), so fix both.
- I18N-3 Relative pronoun `das` after an item name: `glamour.row.fixedDye|fixedGlamour|fixedWear` and bot `card.glamourFixedDye|FixedGlamour|FixedWear` ("Statt {name}, das ...") is only right for neuter item names; masc/fem names (Gürtel, Hose) read wrong. Rephrase with a parenthesis or "(nimmt ... nicht an)". P3.
- I18N-4 og-embed de `glamour.descriptionDefault` (og-embed.ts:140) "mit Farbstoffen, ob das Spiel es tragen lässt, und Bezugsquelle" mixes a noun, a clause and a noun in one list; reword. P3. Origin MAIN.
- I18N-5 `preset.dyesHint` de (de.json:1055) drops en's clause "so every slot must be a real dye" and says `Platz` where the rest of the file says Slot. P3.

## Rejected
- `Staatliche Gesellschaft`, `Zwilling`, `Teil`, `Gegenstand`, `projizieren`: no dictionary row, consistent across web/bot/OG, no source to cite for an alternative.
- `ALT` for `DATED` (glamour.fact.dated): ambiguous but not wrong.
- web `Budget-Vorschläge` vs OG `Budget`, `Palette` vs `FARBPROBE` tag: not in this delta, older.
- OG de en dash vs web em dash: cosmetic, long-standing.
- `Neue Quelle nehmen`, `Meine behalten`, button lengths: fine.

## Covered
web-app.tsv, bot-logic.tsv in full; apps/web-app/src/locales/de.json and packages/bot-logic/src/i18n/locales/de.json (all keys, scripted); og-strings.ts and og-embed.ts de blocks and both diffs; docs/reference/ffxiv-terminology.md (Glamour Terms, Equipment Slots, Facewear, Market); core de.json races/clans/categories; glamour-card.ts width constants.
