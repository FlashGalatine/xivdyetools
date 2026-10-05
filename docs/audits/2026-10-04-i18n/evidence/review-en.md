# Review: en slice (English source text) - i18n audit 2026-10-04

Revisions: BASE 5c80fcba, MAIN 8ecb878f, HEAD preview/integration-2026-10-04.

## Candidates

### TERM-EN-1 (P2) tribe vs clan, one concept, three keys
`apps/web-app/src/locales/en.json:1209` swatch.dropBody "with the tribe and gender needed to look hair and skin up", `:1212` swatch.whoHead "TRIBE & GENDER", `:1391` glamour.fact.anyTribe "ANY TRIBE" (also `:1392` tribeOk, `:1393` tribeNo carry the key name only). Same file `:1329` swatch.slotError.noTribe says "the file's clan and gender", and bot-logic en.json:355/382/1139 plus core `clans` all say "clan". The dictionary section Clans/Subraces (docs/reference/ffxiv-terminology.md:159) names the concept "clan". "Tribe" in the same dictionary (line 75) is the Beast Tribe, a different thing, so a translator reading "tribe" may pick the beast-tribe word. Origin: dropBody changed on MAIN; whoHead and anyTribe MAIN (glamour.fact.* added MAIN).

### TERM-EN-2 (P2) one concept, several English names, Glamour tool
- Item that replaces another with the same model: "twin" (verdict.segFixed `:1349`, row.tagFixed `:1367` "FIXED BY A TWIN", verdict.countFixed, bot `card.glamourNamedLead` en.json:629 "Named from a twin:", card.glamourFootTwins, card.glamourStatusTwin "TWIN"), "same look" (row.twins `:1380`, row.choice, picker.head `:1383`, bot `glamourLooks` en.json:614 "+{n} LOOK"), "swap" (verdict.explain `:1360` "Swaps are already in the list below; change any of them from the piece's +N"). "Twin" is never defined in any string, and `+N` in `explain` points at a badge (glamour-block.ts:957) whose only text is `+2`; a translator cannot tell that "swap", "twin" and "same look" are one thing. The bot count label `+{n} LOOK` has no plural form ("+3 LOOK") and counts items, not looks.
- Bot status chips (en.json:618-620): `glamourStatusDye` "DYES" (means "can't take these dyes"; reads as "has dyes"), `glamourStatusWear` "LOCKED" (means "this character can't wear it"; also replaced by an uppercased race name, glamour.ts:232), `glamourStatusGlamour` "NO GLAM" (the web calls the same condition "NO GLAMOUR" `:1396` and "can't be a glamour"). No legend string explains them.
- Origin: MAIN (all added in the Glamour work, not by an open PR).

### TERM-EN-3 (P3) the exported list has three or four names, and one button has two
- Menu button `swatch.exportMarkdown` "Export .md" (en.json:1265; glamour-block.ts:720 opens the sheet in 'save' mode) vs the sheet's own button `glamour.sheet.save` "Save .md" (`:1414`; glamour-sheet.ts:375). Same action, two verbs; `glamour.picker.foot` (`:1385`) tells the user "Copy list and Export .md write the one you pick" while the sheet they are looking at says "Save .md".
- The list: "Glamour list" (`:1399`), "Equipment list" (toast `swatch.listCopied` `:1266`, listCopyFailed, listExportFailed), "the list" (picker/row strings), "GPOSERS format" (`sheet.sub`). The privacy policies quote "Glamour list".
- The per-piece text: "source" (`sheet.placeholder` `:1408`, `warn`, `useNew`), "acquisition notes" (`sheet.cardNote` `:1415`), "Acquisition lines" (web PRIVACY.md:50, quoting the exported `Acquisition:` line), "edited line" (`warn`).
- Origin: MAIN.

### TERM-EN-4 (P3) "outfit" once, "glamour" everywhere else
`apps/web-app/src/locales/en.json:1412` glamour.sheet.privacy "kept on this device for this outfit"; web PRIVACY.md:55 repeats it ("rewritten lines for that outfit"). Everything else in the tool says glamour (swatch.equipHead "DYES ON THIS GLAMOUR", noDyedPieces, paletteTitle). The dictionary pins one glamour (outfit) as a single concept per locale; translators will render "outfit" as a second word. Origin: MAIN.

### TERM-EN-5 (P3) tool names in the policy prose differ from the UI titles
`tools.*.title` (en.json:41-104) vs web TERMS_OF_SERVICE.md:15-17 ("Comparison", "Accessibility checker", "Budget finder", "community Presets browser") and PRIVACY.md:8-9. UI titles are "Dye Comparison", "Accessibility Checker", "Budget Suggestions", "Community Presets". "Budget finder" is a different noun from "Budget Suggestions"; the Discord TOS (TERMS_OF_SERVICE.md:29-31, added MAIN) uses a third, "Budget Alternatives" for `/budget`, and "Dye Comparison and Contrast". The Glamour Reader itself agrees everywhere (see Positive). Origin: web policy list MAIN (BASE text, Glamour Reader added by MAIN); Discord TOS lines MAIN.

### I18N-EN-6 (P2) "since the Last updated date" is a moving reference
web `PRIVACY.md:151` "Posts made since the *Last updated* date above do not show your Discord user ID; older posts may." and Discord `PRIVACY_POLICY.md:116` "Posts made since this policy's "Last Updated" date ...". The date moves with every future edit (it is now 2026-10-04 / October 4, 2026 in both, set by PR), so the sentence silently changes meaning each release, and each translation copies the same drift. The English should name the fixed date the change shipped. A translator can also parse "older posts may" two ways (may show it / may be kept). Origin: web PRIVACY.md line PR (the 10-04 edit extends the 09-28 text from MAIN); Discord row MAIN, date line PR.

### I18N-EN-7 (P3) quoted UI path no longer matches en.json
web `PRIVACY.md:22` "reached from **About → Privacy**". en.json label for the opener is `header.about` / `about.title` "About XIV Dye Tools" and the item `about.privacyPolicy` "Privacy" sits under the `POLICIES` row (`about.policiesLabel` line 29-30). Origin: BASE text, still wrong at HEAD.

### I18N-EN-8 (P3) sentences a translator could parse two ways
- web `PRIVACY.md` Community presets item 3 (lines ~89-96, PR): "the version from before the first such edit, kept until a moderator restores it or the preset is deleted": "it" can be the version or the preset. Same sentence in Discord `PRIVACY_POLICY.md` Preset Submissions row (PR).
- `glamour.row.noFix` (en.json ~1377) "Nothing with the same look fixes it": reads as "nothing that looks the same repairs it". `glamour.empty` "This file wears no gear." personifies the file (a ja/zh translator will need to restate the character as the wearer). `glamour.verdict.explain` "Since 7.4 any job can wear any piece for glamour": "7.4" is a bare patch number with no "Patch".
- Origin: MAIN except the two policy sentences (PR, 10-04 diffs).

## Out of scope (documentation-audit): British spellings in English policy documents
- apps/web-app/PRIVACY.md:8 colour, :16 colour, :42 colours, :50 favourite, :57 favourite, :74 centre, :102 colours, :201 colours
- apps/web-app/TERMS_OF_SERVICE.md:9 colour, :25 colour, :44 licence, :45 licence, :86 unauthorised, :114 colours, :138 colour, :139 colours, :161 licence
- apps/discord-worker/PRIVACY_POLICY.md and TERMS_OF_SERVICE.md: none found with the swept word list.
Not candidates; none is a quoted UI label ("Clear Favorites" in PRIVACY.md:57 is quoted correctly in American spelling).

## Positive
- American English in the en column of web-app.tsv (122 keys) and bot-logic.tsv (67 keys): 0 candidates; the only hits are the identifier keys `card.colours`, `card.colours_one`, `card.colours_other` (values "colors"). `american-spelling-locales.txt` 0 confirmed; a second sweep of both en.json files finds the same three identifiers only.
- Glamour Reader name agrees: web `tools.glamour.title` "Glamour Reader" (en.json:104), nav `shortName` "Glamour" (same pattern as Swatch Matcher / Swatch), og-worker OG_DECK `glamour.name` "Glamour Reader" (og-strings.ts:48), web TERMS_OF_SERVICE.md:16, Discord TERMS_OF_SERVICE.md:33, web PRIVACY.md:8,40,113; bot /manual names the command only (`/glamour <file>`).
- Equipment slot names (web `swatch.gearSlot.*`, bot `card.glamourSlot.*`) equal the dictionary Equipment Slots EN column row by row.
- Policy quoted labels equal current en.json: "Reset Settings" (`menu.resetSettings` :226), "Clear Favorites" (:230), "Clear Saved Palettes" (:232), "Manage Collections" (:763), "Delete Collection" (:746), "My Submissions" (:873), "Advanced Settings" (:225), "Open in…" (:1277), "Glamour list" (:1399), "Reset all" (:1413), "Images are read in your browser and never uploaded" (:307, quoted without the final period); Discord policy "My Submissions" same. "Item 3 under Network access" exists (PRIVACY.md:68, item 3 covers preview-image removal).
- Registered command names in the Discord TOS/policy (`/comparison`, `/contrast`, `/mixer`, `/gradient`, `/budget`, `/swatch`, `/glamour`) all appear in apps/discord-worker/src/commands/registry.ts:31-49.
- Tool count: web TOS "Ten tools" lists ten names. Retention numbers (30 days, 90 days, 12 months, 180 days) agree between web PRIVACY.md and Discord PRIVACY_POLICY.md. Both policies carry the same date (2026-10-04 / October 4, 2026).
- `preset.privacyNote` (the PR-changed key) agrees with web PRIVACY.md item 3 and TOS ("an ID and a name"; XIVAuth = verified character name).
- `swatch.charaHintGlamour` (PR) says what PRIVACY.md says is sent (model numbers and facewear ID; not name, colors).
- tool-name-consistency.txt: 0 same-EN groups diverge for tool names.

## Rejected
- "Market board" lower case in prose (harmony.marketFailBody, `marketBoard.apiFailed`) vs "Market Board" as a label: casing of a common-noun use, not two names.
- "Gil per ΔE", "ΔE2000" vs "CIEDE2000": notation, kept as is by the brief (codes/tags).
- `comparison.mRgbDesc` quoting the removed "Avg Distance" label: refers to the old panel by design.
- "Signing out" (policy prose) vs "Logout" (button label): a verb, not a quoted label.
- Plural-identical `glamourFootTwins_one`/`_other` and `card.colours`: en has the same form for both; other locales' rules are not this slice.
- `NO GLAM` vs `NO GLAMOUR`: kept as part of TERM-EN-2 (status chips) rather than its own row.
- Bot card title `card.glamourTitle` "Glamour" vs "Glamour Reader": a short card title, same pattern as other tools; not filed.

## Files covered
docs/audits/2026-10-04-i18n/evidence/: reviewer-brief.md, delta/web-app.tsv (122 keys, en column), delta/bot-logic.tsv (67 keys, en column), delta/SUMMARY.txt, american-spelling-locales.txt, tool-name-consistency.txt, delta/diffs/apps__web-app__PRIVACY.md.{main,pr}.diff, apps__web-app__TERMS_OF_SERVICE.md.{main,pr}.diff, apps__discord-worker__PRIVACY_POLICY.md.{main,pr}.diff, apps__discord-worker__TERMS_OF_SERVICE.md.main.diff. HEAD files: apps/web-app/src/locales/en.json (lines 1-110, 1195-1440), packages/bot-logic/src/i18n/locales/en.json (glamour/card blocks), apps/web-app/PRIVACY.md and TERMS_OF_SERVICE.md (headings and quoted labels), apps/discord-worker/PRIVACY_POLICY.md and TERMS_OF_SERVICE.md (grep), og-strings.ts glamour lines, docs/reference/ffxiv-terminology.md Equipment Slots, apps/discord-worker/src/commands/registry.ts, glamour-block.ts / glamour-sheet.ts label use sites.
