# Review: web-app-tools cluster (2026-10-11)

Baseline: HEAD 42c35e87 == served 16a6123f for all apps. Source checked: apps/web-app (src/components, src/services, src/locales/en.json), packages/core chara twins, apps/api-worker chara resolver.

## Coverage

| Path | Tier | Units | Sections reviewed | Result |
|---|---|---|---|---|
| docs/user-guides/web-app/budget-suggestions.md | living | web-app budget-tool, en.json budget.*, core dye-vocabulary | all | reviewed |
| docs/user-guides/web-app/color-harmony.md | living | web-app harmony-tool, config-sidebar, en.json harmony/config | all | reviewed |
| docs/user-guides/web-app/dye-comparison.md | living | comparison-tool, core band-vocabulary, en.json comparison | all | reviewed |
| docs/user-guides/web-app/dye-mixer.md | living | mixer-tool, mixer-blending-engine, en.json mixer/config | all | reviewed |
| docs/user-guides/web-app/glamour-reader.md | living | glamour-tool/block/sheet/twin-picker, glamour-list-actions, chara-file-card, core chara-twins, api-worker chara resolver | all | reviewed |
| docs/user-guides/web-app/gradient-builder.md | living | gradient-tool, config-sidebar, en.json gradient | all | reviewed |
| docs/user-guides/web-app/palette-extractor.md | living | extractor-tool, share-service, constants | all | reviewed |
| docs/user-guides/web-app/swatch-matcher.md | living | swatch-tool, chara-file-card, en.json swatch | all | reviewed |

All anchors in the 8 files resolve (node script over `[..](..#anchor)`); none broken.

## Candidates

### cand-web-app-tools-01 (MEDIUM, inaccurate) Facewear Acquisition "always starts blank"
- Doc: glamour-reader.md:212 ("Facewear always starts blank"); also the BLANK row context at :210 and the example block's trailing `Acquisition:` for Facewear.
- Truth: since web-app 5.15.0 / api-worker facewear unlock sources, the resolver returns an acquisition line for facewear and the sheet uses it as the FILLED line.
- Evidence: apps/web-app/src/components/glamour-list-actions.ts:106-111 (`acquisition: glasses?.acquisition`) and :152-157 (`generated = glasses?.acquisition ?? null`); apps/web-app/CHANGELOG.md:14 and :18 ("facewear Acquisition fields now show where to obtain ... Known facewear sources now cover 54 of 61 styles"); commit 2428f144.
- Fix: replace the sentence with "Facewear is filled when the table knows the style's unlock source (most styles, all color variants share it); otherwise it starts blank."

### cand-web-app-tools-02 (MEDIUM, inaccurate) Retired gear is no longer a twin; Dated example and DATED chip are stale, new retired note undocumented
- Doc: glamour-reader.md:73 (lead twins example "Dated Hempen Coif and Hempen Coif"), :78 (rule 4), :103 (DATED chip "A retired version the game still draws"); the IN THE GAME / row notes never mention the retired note.
- Truth: api-worker drops Aetherial*, Deepmist* and any Dated* item with equip level <= 50 before naming or checks, so Dated Hempen Coif (level 1) is not a twin or picker entry; a family with nothing else is named from its own rows and the row note ends "A retired item, no longer obtainable" (`glamour.row.retired`).
- Evidence: apps/api-worker/src/chara/resolver.ts:86-101 (`selectableItem`, `namingRows`); apps/api-worker/src/chara/resolver.test.ts:102-103 (Dated Hempen Coif levelEquip 1 filtered); apps/web-app/src/components/glamour-block.ts:1307-1326; apps/web-app/src/locales/en.json:1342; apps/web-app/CHANGELOG.md:20 ("Retired items are also removed from the twin picker and wear checks").
- Fix: swap the lead example for a pair still served (Curtana Zenith / Replica is already there); say Aetherial, Deepmist and low-level Dated gear are never offered as twins; qualify DATED as a Dated item above level 50; add the "A retired item, no longer obtainable" note to the row-notes description.

### cand-web-app-tools-03 (MEDIUM, inaccurate) Mixer table: RYB "Blue + Yellow = Olive"
- Doc: dye-mixer.md:60.
- Truth: RYB blue + yellow is green; the Gossett-Chen cube that gave olive was retired in core 5.0.0.
- Evidence: apps/web-app/src/locales/en.json (config.mixingRybDesc "Blue + Yellow = Green."); apps/web-app/src/services/mixer-blending-engine.ts:51-58 ("RYB used to be the Gossett-Chen paint cube and used to give olive; core 5.0.0 retired that cube").
- Fix: change Olive to Green.

### cand-web-app-tools-04 (LOW, inaccurate) Mixer "Name" column does not match the app's plain names for OKLAB and LAB
- Doc: dye-mixer.md:62-63 (OKLAB "Perceptual", LAB "LAB"); intro at :56 says the cell hints use plain names.
- Truth: cell hints `mixer.modelOklab` = "Modern Perceptual", `mixer.modelLab` = "Perceptual"; the dropdown reads "OKLAB - Modern Perceptual", "LAB - Perceptual", "Spectral - Realistic Paint".
- Evidence: apps/web-app/src/locales/en.json:478-483 (mixer.model*), :186-190 (config.mixing*); apps/web-app/src/components/v4/config-sidebar.ts:1451-1458.
- Fix: OKLAB -> Modern Perceptual; LAB -> Perceptual; note Spectral is "Realistic Paint" in the dropdown, "Pigment" in the cell hints.

### cand-web-app-tools-05 (LOW, inaccurate) Two quoted UI strings do not match en.json
- Doc: budget-suggestions.md:35 (*"What {target}'s colour is worth, line by line."*); color-harmony.md:51 (*"Prices unavailable — the market board did not answer. Colour matching is unaffected — only the price lines are missing."*).
- Truth: budget.ledgerHead = "What {t}'s color is worth, line by line."; harmony strip is a title "Prices unavailable" plus body "The market board did not answer. Color matching is unaffected — only the price lines are missing." (capital T, "Color").
- Evidence: apps/web-app/src/locales/en.json:586, :296-297.
- Fix: quote the strings exactly (American spelling falls out of it).

### cand-web-app-tools-06 (LOW, missing) Dye Filters lists name 7 of the 9 filters
- Doc: color-harmony.md:70, dye-mixer.md:49, gradient-builder.md:59, palette-extractor.md:74, swatch-matcher.md:65 ("exclude metallic, pastel, dark, cosmic, coffer, vendor or crafted").
- Truth: the filter panel also offers Exclude Ishgardian Dyes and Exclude Expensive Dyes (nine toggles).
- Evidence: apps/web-app/src/locales/en.json:545-554; apps/web-app/src/components/v4/dye-filters-v4.ts:71,74,321.
- Fix: add "Ishgardian" and "expensive" to each list (or say "the Dye Filters toggles").

### cand-web-app-tools-07 (LOW, spelling, supersedes 2026-09-21-documentation/DOC-001) British spellings, 127 confirmed
- Top documents: palette-extractor.md (28), swatch-matcher.md (27), color-harmony.md (18). Per-document table below. glamour-reader.md has 0.
- Evidence: clusters/web-app-tools.spelling (127 default-sweep rows, 0 extras); independent grep over the 8 docs gives the same 127.

## Priors
- DOC-001 (spelling): STILL_PRESENT in this cluster, 127 hits in 7 of 8 files (was swatch 31, extractor 28 in the 2026-09-21 table; glamour-reader.md is new and clean).

## Seeds
- glamour-reader.md reviewed in full against glamour-tool/block/sheet/picker, markdown builder and core twin order: rules, chips, verdict text, 3-6 palette, 20 MB, storage keys (view/show-all), item link menu, filenames all match. Two stale claims found (01, 02).

## Positive controls
- Budget: match line 2-20 default 8 (budget-tool.ts:126-128), tiers STANDARD/WIDE #1/WIDE #2/COFFER (budget-tool.ts:140-145), six quick picks (:983), every quoted string except the headline matches en.json budget.*.
- Comparison: match line 1-15 default 5 (config-sidebar.ts:1317-1319), tier cuts 5/10/20 (core band-vocabulary.ts:94), seven readouts and all badge strings match en.json comparison.*.
- Gradient: 3-12 steps, HSV default, five spaces, Pin/Unpin/Clear pins/Endpoint strings exact. Mixer: 6x5 field, Max Results 3-8, save name "A x B" (mixer-tool.ts:1470).
- Extractor: 20 MB, picks max 6, share max 5 colors, sample areas 1/2/4/8/16, all labels exact. Swatch: seven palettes, Max Results 1-6, SEND TO targets, file card cross-links ("Swatch Matcher ->", "Glamour Reader ->"), key `0`, Evercold notice.
- Harmony: ten types, five wheels, companions 1-5 default 1 (constants.ts:114-117), Shift+S, default tool harmony.

## Rejected suspicions
- "Inspect Dye in..." vs "..." ellipsis character: typographic only, not a label mismatch.
- 5.14.12 custom-color result-card menu change (only Transform -> Gradient offered for a custom color): docs describe dye cards, which are unchanged.
- Budget "Market Board section" after Enable Market Board was hidden on Budget (a6fbd078): the section and server select remain, doc wording holds.
- Facewear context-menu claim (only Mirapri, GamerEscape, Lodestone) and lodestone five regions: consistent with item-links-menu.ts and en.json itemLinks.
- Grey/greys in dye-mixer.md:65, gradient-builder.md:74, budget:28, comparison:108: ordinary color words, not game terms, so counted as spelling.

## Spelling per document (confirmed, 0 rejected)
| Document | Count |
|---|---|
| palette-extractor.md | 28 |
| swatch-matcher.md | 27 |
| color-harmony.md | 18 |
| dye-mixer.md | 15 |
| budget-suggestions.md | 13 |
| dye-comparison.md | 13 |
| gradient-builder.md | 13 |
| glamour-reader.md | 0 |
| Total | 127 |
Words: colour/colours (105), centre/centred (9), labelled (5), grey/greys (4), neighbouring/neighbours (3), armour (1). The --all extras list is empty.
