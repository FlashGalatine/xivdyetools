# Review: ui-fr (French UI strings), 2026-10-04

Revisions: BASE 5c80fcba, MAIN 8ecb878f, HEAD preview branch. Reviewer: ui-fr worker.

## Coverage
- delta/web-app.tsv (122 rows) and delta/bot-logic.tsv (67 rows), fr column read in full against en.
- en-only changed rows (63): old en pulled from BASE, diffed against new en. All 63 are British to American spelling only
  (colour/behaviour/harbour/recognise/localised/armour). Meaning unchanged, so the fr values are not stale. No I18N filed.
- og-strings.ts and og-embed.ts main diffs + HEAD fr blocks (og-strings.ts:65 OG_DECK, :166 TOOL_TAG, og-embed.ts:166).
- Terminology: docs/reference/ffxiv-terminology.md (Equipment Slots, Glamour Terms, Facewear, Races) and core fr.json (races, clans, facewear).
- Length: measured every fr/en pair in both deltas (ratio > 1.5), every commands.* name/description (limit 100).

## Candidates

| id | file:line | detail |
|---|---|---|
| TERM-1 | web fr.json:1262-1263 | `{color} · couleur de lunettes` / `Couleur de lunettes inconnue`. Facewear in the same tool is `Accessoires de visage` (fr.json:1261, dictionary Equipment Slots row 16050; category `Accessoires faciaux`). `lunettes` (glasses) is narrower than facewear (also masks, eye patches). origin MAIN (present at BASE; en only respelled). Dictionary has no row for the facewear-colour label, so the suggested fix `couleur d'accessoire de visage` is unpinned. |
| TERM-2 | web fr.json:70-73,880,1077,1223,1053,1021,1109; bot fr.json:439,440,455; og-strings.ts:75,175 | One concept (a preset / community palette), five words: `Préréglages communautaires` (tools.presets.title, new in the diff; shortName `Préréglages`), `Palettes Communautaires` (OG_DECK fr presets, og-strings.ts:75, now disagrees with the web title), `PRÉRÉGLAGE` (TOOL_TAG, :175), `preset` (deleteTitle 880 "Supprimer le preset", editTitle 1077, paletteNameHint 1223 "noms et descriptions de presets", previewImageFailed 1053), `modèle` (bot 439/440/455 "Nouveau modèle en attente"), `palette` (1021, 1109). The tool-name part (web title vs og card name) is origin MAIN; the retitle itself landed with the Glamour work. |
| TERM-3 | web fr.json:85,1209,1212,1329,1391,1360; bot fr.json:355 | One concept (clan/subrace, en "tribe" or "clan"): `ethnie` (85, 1329), `tribu` (1209, 1212), `Clan` (bot 355, 1138), `race` (1391 `TOUTES RACES` for `ANY TRIBE`, and 1360 "la race"). Core fr.json calls them `clans` (Hyurois ... `Clan du Feu`). Dictionary has no fr row for the word "clan", so UNPINNED. `TOUTES RACES` also shifts meaning: race (Hyuran) is a different level from clan (Hyurois). origin MAIN. |
| TERM-4 | web fr.json:1360 | `la race, le sexe et la Grande Compagnie`: en says gender; every other fr surface says `genre` (1209, 1212, 1329, bot 355 `genre`). origin MAIN. P3. |
| TERM-5 | bot fr.json:614 vs web fr.json:1376,1378,1380,1383 | `+{n} ASPECT` (card) vs `apparence` / `MÊME APPARENCE` (web) for the same "look". Dictionary has no row, UNPINNED. origin MAIN. P3. |
| I18N-1 | web fr.json:1385 vs 1265 | picker.foot says `Exporter .md` but the button reads `Exporter en .md` (exportMarkdown 1265); sheet.save is a third label, `Enregistrer le .md` (1414). en has `Export .md` in both places. origin MAIN. P3. |
| I18N-2 | web fr.json:1399 | `glamour.sheet.title` en "Glamour list" but fr `Liste d'équipement` ("gear list"): the glamour (mirage) word dropped, so the sheet is no longer named for what it is. Suggest `Liste de mirage` / `Liste du mirage`. Dictionary row `mirage` supports the word. origin MAIN. P3. |
| I18N-3 | bot fr.json:618-619 | status chips: `TEINTES` for `DYES` (the piece cannot take the dyes). French `teintes` reads as "dyed/hues" (looks like a pass), the opposite signal; the web equivalent is `ne prend pas les teintures` (1383-1370 family). Also `NON MIRAGE` (619) vs web `PAS DE MIRAGE` (1396) for `NO GLAM(OUR)`. Card column fits (status max 72 px, fitText in glamour-card.ts:278), so this is wording only. origin MAIN. P3. |

## Positive controls
- All 12 web `swatch.gearSlot.*` + `facewearSlot` and all bot `card.glamourSlot.*` equal the Equipment Slots fr column
  (Main directrice, Main non directrice, Tête, Torse, Mains, Jambes, Pieds, Oreilles, Cou, Poignets, Bague droite/gauche, Accessoires de visage).
- Tool name `Lecteur de mirages` equal across web tools.glamour.title (fr.json:~104), og-strings.ts:73 OG_DECK; short name `Mirage` in web, bot card.glamourTitle (606) and TOOL_TAG; matches the dictionary Glamour Reader row. `mirage` is used masculine throughout.
- Placeholders ({n}, {name}, {other}, {list}, {key}, {s}, {id}, {t}, {a}, {b}) identical to en in every delta row.
- Plurals: every `_one/_other` pair in the glamour/card keys is present and grammatical for fr (fr treats 0 as singular).
- Register `vous` everywhere in the delta (Choisissez, Modifiez, Réessayez, Garder la mienne is impersonal).
- Length: commands.glamour.description 95 chars (limit 100), file option description OK, no other commands.* value above 90. Longest card
  labels (MAIN NON DIRECTRICE 19 chars) are already provided for by slotWidth/LEAD_MAX in packages/svg/src/glamour-card.ts (comment at :91-94 names the French off hand).
- `mirage` for glamour (not glamour/Mirage forms the dictionary bans) in every glamour key; og-embed fr glamour.descriptionDefault fine.
- OG card text: glamour deck/tag keys present for fr, correct grammar, CJK-irrelevant for fr.

## Rejected
- Spacing before : ; ? ! is a plain space in all fr (one NBSP in unitPctDesc); repo house style, not filed.
- Mixed ' and ’ in bot fr (115 vs 7 curly; the new glamourNamedLead / glamourResolve* use curly): cosmetic, already mixed at BASE, og-embed likewise.
- `Nommé à la place de {name}` gender agreement: subject is the row, ambiguous in en too.
- `classes` for jobs (verdict.explain): no dictionary row, not asserted.
- `HORS G.` abbreviation (web 1244, bot 594, manual body): not a slot; abbreviation is old (BASE).
- `Nuancier` vs TOOL_TAG `ÉCHANTILLON`, `Comparaison de teintures` casing between og and web: pre-existing, cosmetic.
- `mineSummaryPresetsOne/Many` naming oddity: key name, not text.
- `tableau des ventes`: matches dictionary (market-board-term.txt clean).
- 63 en-only spelling rows: not stale.
