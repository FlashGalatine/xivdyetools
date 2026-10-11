# /manual review (served ref 16a6123f == HEAD source for bot-logic, core, discord-worker)

`git diff --stat 16a6123f HEAD -- packages/bot-logic packages/core apps/discord-worker` is empty, so HEAD is what is served.
Topics: schemas.ts choices (match_image, color_vision, contrast, matching_methods, spectrum_prices, character_file) == manual.ts (match_image branch + TOPIC_KEYS x5) == MANUAL_TOPICS ids (learn-links.ts:36-42, 112-193). Emoji identical in schemas and MANUAL_TOPICS.
Intentional omission: /a11y has no field of its own, documented in manual.ts ("second registration of the accessibility handler") and named in the accessibility line.

| Command | registry | schema vs /manual syntax | handler claim check | locales |
|---|---|---|---|---|
| harmony | registry.ts:34 | `<color> [type] [wheel] [companions]` ok; 10 types, 5 wheels match schemas.ts:28-62 (matching, strict_matching, prevent_duplicates not shown, abbreviated by design) | ok | consistent |
| mixer | :35 | `<dye1> <dye2> [mode]` ok; 6 modes ok | five ratios = MIXER_SWEEP_RATIOS 25/40/50/65/80 (bot-logic mixer.ts:57) ok | consistent |
| gradient | :36 | ok; 2-12, default 6, 9 spaces, default HSV ok | ok | consistent |
| extractor | :37 | color `<color> [count]` 1-10, image `<image> [colors]` 3-10 ok | ok | consistent |
| swatch | :38 | `<file> [order] [slot]` ok; 7 slots ok | five nearest for slot ok; gear dyes listed (swatch.ts:397) | consistent |
| glamour | :39 | `<file>` ok | list is every piece in GPOSERS form (bot-logic glamour.ts:14-16, 489); card is dyed pieces, 5 max. "Each dyed piece" overstates, see cand-01 | consistent (same wording) |
| dye | :43 | search/info/list/random ok; 8 categories ok | random = 5 (dye.ts:408) ok | consistent |
| comparison | :46 | `<dye1> <dye2> [dye3] [dye4]` ok | ok | consistent |
| contrast | :48 | same ok | 3/4.5/7 lines (svg contrast-card.ts:12,105-108) ok | de/fr manual5 body uses "4,5", description "4.5" (cand-04) |
| accessibility / a11y | :49-52 | `<dye> [dye2] [vision]` ok | 4 lenses + all ok | consistent |
| budget | :53 | find/quick/set_world ok; max_distance 2-20 ok | ok | consistent |
| preset | :56 | 9 subcommands over 3 fields ok; submit 3-6 dyes ok; 8 categories ok | favorites max 50 = MAX_PRESET_FAVORITES (preset-favorites.ts:34) ok; "submissions are moderated" ok (auto-check or held, preset.ts:556) | consistent |
| preferences | :59 | show/set/reset/filters ok | set options covered ("card values" = show_*) | consistent |
| manual | :60 | `[topic]` ok | ok | consistent |
| changelog | :61 | `[version]` ok | ok | consistent |
| about | :62 | ok | ok | consistent |
| stats | :63 | `summary` shown; other panels gated (stats.ts:105-107) ok | ok | consistent |

Topic bodies and match_image help verified: 4 lenses, 30/15/8 bands (core band-vocabulary.ts:81), 1:1-21:1, 105 of 125 dyes, 216 gil (core dye-vocabulary.ts:57), default 4 colors (extractor.ts:77), 3-10, PNG/JPEG/GIF/WebP/BMP + 10MB (image-worker validators.ts:31-38, 388), top-five card (extractor.ts handler). Locale status labels in manual5.characterFile match card.glamourStatus* in each locale. American English: en manual/manual5/matchImageHelp scan clean.

Other surfaces: /manual agrees with command-reference.md and commands.md on roster (18 registrations / 17 commands), topics, ranges. Doc-side errors: cand-02 (commands.md:489), cand-03 (command-reference.md:289). Spelling in those two docs (colour, favourite, authorised) is already in the spelling count.
