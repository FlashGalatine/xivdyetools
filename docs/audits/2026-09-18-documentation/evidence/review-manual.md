# /manual (Discord bot in-app help) — documentation audit, 2026-09-18

Cluster: the Discord bot's in-app help (`/manual`), NOT the `docs/` pages. Reviewed against
worktree HEAD `0fec18f4` (== production discord-worker).

## Coverage

| file | sections reviewed | result |
|---|---|---|
| `apps/discord-worker/src/commands/registry.ts` | full (COMMAND_REGISTRY, 17 entries + comments) | reviewed |
| `apps/discord-worker/src/commands/schemas.ts` | full (all 17 command schemas, all choice lists) | reviewed |
| `apps/discord-worker/src/handlers/commands/manual.ts` | full (buildEmbeds, buildMatchImageHelpEmbeds, buildTopicEmbed, handleManualCommand) | reviewed |
| `packages/core/src/config/learn-links.ts` | full (MANUAL_TOPICS, getLearnLink, getLodestoneLink) | reviewed |
| `packages/bot-logic/src/i18n/locales/en.json` | `manual.*` (44-108), `matchImageHelp.*` (437-464), `manual5.*` (573-597), `commands.*` (619-671, out of cluster but used as ground truth for /about parity) | reviewed |
| `packages/bot-logic/src/i18n/locales/{ja,de,fr,ko,zh}.json` | `manual.*`, `matchImageHelp.*`, `manual5.*` (same line ranges as en) | reviewed structurally (key parity + spot-translated content for harmony/gradient/swatch/about.commands.*); not every string retranslated word-for-word into English |
| `apps/discord-worker/src/handlers/commands/extractor.ts` | full | reviewed (ground truth for matchImageHelp topic) |
| `apps/discord-worker/src/handlers/commands/swatch.ts` | header + slot table (1-77) | reviewed (ground truth for manual.swatch) |
| `apps/image-worker/src/validators.ts` | MAX_FILE_SIZE_BYTES | reviewed (ground truth for matchImageHelp file-limit claim) |
| `packages/bot-logic/src/commands/mixer.ts` | sweep logic (43-171) | reviewed (ground truth for manual.mixer) |
| `packages/bot-logic/src/commands/contrast.ts`, `accessibility.ts` | band/lens logic | reviewed (ground truth for manual5.topics.contrast / colorVision) |
| `packages/core/src/config/consolidated-ids.ts` | consolidation table | reviewed (ground truth for manual5.topics.spectrumPrices) |
| `docs/user-guides/discord-bot/command-reference.md`, `docs/projects/discord-worker/commands.md` | harmony/swatch/extractor/contrast sections only, for cross-surface disagreement | partial — only read the sections that overlap /manual's claims; full fact-check of these two pages is another reviewer's cluster |

## Candidates

| cand-id | sev | kind | file:line | claim vs reality | evidence |
|---|---|---|---|---|---|
| C1 | HIGH | WRONG | `en.json:69-72` (+ same lines in ja/de/fr/ko/zh.json) `manual.swatch.name`/`.description` | Says `/swatch color <type> <index>` \| `/swatch grid <type> <row> <col>`, race/clan palettes for skin/hair | `apps/discord-worker/src/commands/schemas.ts:867-903` — `/swatch` takes a required `file` attachment + optional `order`/`slot`; `apps/discord-worker/src/handlers/commands/swatch.ts:1-9` states outright "The 4.x index/grid subcommands are replaced by a required `file:` attachment" |
| C2 | HIGH | PLANNED-VS-SHIPPED | `en.json:437-464` `matchImageHelp.*` (+ ja/de/fr/ko/zh, same lines); reached via `manual.ts:35-116,386` and topic choice `schemas.ts:555` | Entire topic documents `/match` and `/match_image`, deleted in 5.0 | `apps/discord-worker/src/handlers/commands/extractor.ts:1-13` — "Replaces: /match, /match_image (v2.x)"; `docs/projects/discord-worker/commands.md:33` — "`/match` and `/match_image` removed" |
| C2a | MED | WRONG | `en.json:441` `matchImageHelp.howItWorksContent` | "Colors are matched against 136 FFXIV dyes" / "Euclidean distance in RGB color space" | `packages/core` CLAUDE.md — 125 dyes, `DEFAULT_MATCHING_METHOD = 'ciede2000'` (ΔE2000, not Euclidean RGB) |
| C2b | LOW | WRONG | `en.json:447` `matchImageHelp.proTipsContent` | "Extract multiple colors with the `colors` option (1-5)" | `schemas.ts:344-350` — `colors` option is `min_value: 3, max_value: 10` |
| C2c | LOW | WRONG | `en.json:459-460` `matchImageHelp.fileLimitsContent` | "Maximum size: 8MB" | `apps/image-worker/src/validators.ts` — `MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024` (10MB); confirmed by `apps/image-worker/src/validators.test.ts:35` |
| C3 | MED | WRONG | `en.json:57-60` (+ 6 locales) `manual.harmony.description` | Lists 7 harmony types (Complementary…Monochromatic), no wheel/companions/matching options | `schemas.ts:28-39` `HARMONY_TYPE_LABELS` has 10 types (adds Inverted Tetradic, Compound, Shades) and options `wheel`/`companions`/`matching`/`strict_matching`/`prevent_duplicates` (`schemas.ts:174-214`); `docs/user-guides/discord-bot/command-reference.md:41` correctly lists all 10 |
| C4 | MED | WRONG | `en.json:65-67` (+6 locales) `manual.gradient.name`/`.description` | Syntax uses `<start> <end>`; "step count (2-10)" | `schemas.ts:382-402` — option names are `start_color`/`end_color`, `steps` range is `min_value:2, max_value:12` |
| C5 | LOW | WRONG | `en.json:73-76` (+6 locales) `manual.preferences.name` | Syntax `/preferences set <key> <value>`; `filters` subcommand-group not mentioned | `schemas.ts:624-758` — `set` has 15 distinct named options (language/blending/matching/count/clan/gender/world/market/show_*/theme), no generic key/value pair exists; `schemas.ts:791-862` — `/preferences filters set\|show\|reset` entirely absent from manual text |
| C6 | MED | WRONG | `en.json:592-594` (+6 locales) `manual5.topics.characterFile.body` | "colour slots (skin, hair, eyes, lip, paint)" — 5 named | `schemas.ts:888-900` / `swatch.ts:56-64` `SLOT_VALUES` — 7 slots: skin, hair, **highlights**, eyes, lip, facepaint (labelled "Face paint", body says "paint"), **limbal** ("Tattoo/Limbal ring") — 2 real slots omitted |
| C7 | MED | WRONG | `en.json:61-63` (+6 locales) `manual.mixer.description` | "Finds the closest FFXIV dye to the blended result" (singular blend/dye) | `packages/bot-logic/src/commands/mixer.ts:43-136` — /mixer runs a 5-ratio sweep (`MIXER_SWEEP_RATIOS`), each ratio blended and matched to its own nearest dye, the card shows all 5 rows |
| C8 | LOW | MISSING | `manual.ts:121-239` (buildEmbeds) | `/comparison` not named anywhere in the overview | `registry.ts:41` registers it; no comment anywhere (registry.ts, schemas.ts, manual.ts, CHANGELOG.md) records a deliberate omission |
| C9 | LOW | MISSING | `manual.ts:121-239` | `/contrast` not named (its *name* is reused as an unrelated topic id, `schemas.ts:557`, which documents WCAG generally, not the `/contrast` command's syntax) | `registry.ts:42-43` comment explains the 5.0 split from `/accessibility`, not why the overview omits it |
| C10 | LOW | MISSING | `manual.ts:121-239` | `/accessibility` not named | `registry.ts:44`; only `registry.ts:45-46` explains why **`/a11y`** needs no separate entry (shares the handler) — it says nothing about `/accessibility` itself being absent |
| C11 | LOW | MISSING | `manual.ts:121-239` | `/budget` not named | `registry.ts:48`; no decision record found |
| C12 | LOW | MISSING | `manual.ts:121-239` | `/preset` not named | `registry.ts:51`; no decision record found |
| C13 | LOW | MISSING | `manual.ts:121-239` | `/changelog` not named | `registry.ts:56`; no decision record found |
| C14 | LOW | MISSING | `manual.ts:121-239` | `/stats` not named | `registry.ts:58`; no decision record found |

## Positive controls (confirmed correct — don't re-chase)

- All 9 commands the overview *does* name (`about`, `extractor`, `harmony`, `mixer`, `gradient`, `swatch`, `dye` [x4 subcommands], `preferences`, `manual`) are genuinely registered in `registry.ts:29-59`, and the overview names nothing that isn't registered.
- `/a11y`'s absence from the overview is justified: `registry.ts:45-46` records it as "a second registration sharing the accessibility handler — Discord has no alias mechanism (Turn 13 RESOLVED)".
- `manual.dyeList.description` (en.json:87) category list — Reds/Browns/Yellows/Greens/Blues/Purples/Neutral/Special — matches `schemas.ts:260-269` choice names exactly.
- `manual.dyeRandom` (en.json:89-91) `unique_categories` option matches `schemas.ts:278-283`.
- `manual5.topics.contrast.body` (en.json:580-583) "3 / 4.5 / 7" bands and "no letter grades" — matches `card.ratioBand0-3` strings and `packages/bot-logic/src/commands/contrast.ts:101-106`; also matches `docs/projects/discord-worker/commands.md:326`.
- `manual5.topics.colorVision.body` (en.json:576-578) "four lenses… Brettel method… 30/15/8" — matches `packages/bot-logic/src/commands/accessibility.ts` VISION_TYPES + `card.sepBandKey`.
- `manual5.topics.matchingMethods.body` (en.json:584-586) six-method list (ΔE2000/ΔEOK2/ΔE76/REDMEAN/RGB DIST/DISTINGUISH%) matches `MatchingMethod` union in core and every `matching` choice list in `schemas.ts`.
- `manual5.topics.spectrumPrices.body` (en.json:588-590) "105 of 125 dyes", "216 gil", "Wide Spectrum #1 (Skybuilders' Scrips)" / "#2 (Cosmocredits)" — matches `packages/core/src/config/consolidated-ids.ts:36-38,57,72,86` exactly (85+9+11=105).
- The `commands.*` locale block (en.json:619-671, feeding `/about`, **not** `/manual`) is accurate and current for all 17 commands in every locale checked — confirms the staleness is specific to the `manual.*`/`matchImageHelp.*` text, not a repo-wide drift.
- Topic roster parity: schema `topic` choices (`schemas.ts:554-561`), `manual.ts` `TOPIC_KEYS`+`match_image` branch (`manual.ts:246-252,386-391`), and core's `MANUAL_TOPICS` (`learn-links.ts:36-42,110-196`) all list the same 6 topics (`match_image`, `color_vision`, `contrast`, `matching_methods`, `spectrum_prices`, `character_file`); all 6 locale files carry `manual5.topics.*` and `matchImageHelp.*` blocks at the same line numbers (structural key parity, per the prior automated pass).

## Rejected items (looked wrong, were right)

- `manual.extractor`/`manual.dyeSearch`/`manual.dyeInfo` syntax lines look "incomplete" (omit `matching`, several optional flags) — this is the house style used consistently across every entry (only required + one or two headline optional options shown), not an error; only flagged an entry (C4/C5) when the shown option **name** or a stated **range** was actually wrong, not merely incomplete.
- `manual.tips.facewearExcluded` ("Generic Facewear dyes… are excluded from results") — mechanism description is dated (Facewear moved out of the dye database entirely in schema v2, it isn't "excluded" from a shared pool anymore) but the **user-visible claim** (Facewear never appears in dye-matching results) is still true, so not flagged as WRONG.
- `/contrast` appearing as a `/manual` **topic** id is not the same bug as `/contrast` the **command** missing from the overview — kept as two different things (topic roster is correct per the positive control above; the command-listing omission is C9).

## Reference table for the fix — all 17 commands

| command | subcommands | what it does (handler, one-line) | exact syntax (house form, from schemas.ts) | named in overview? | buildEmbeds() location |
|---|---|---|---|---|---|
| `/about` | — | Bot info, registry-built roster | `/about` | YES | embed 4 "Bot Information", field `about` (inline) |
| `/harmony` | — | Generate harmonious dye combinations from a color | `/harmony <color> [type] [wheel] [companions] [matching] [strict_matching] [prevent_duplicates]` | YES | embed 2 "Color Matching Tools" |
| `/dye` | search, info, list, random | Search and explore FFXIV dyes | `/dye search <query>` \| `/dye info <name>` \| `/dye list [category]` \| `/dye random [unique_categories]` | YES (all 4) | embed 3 "Dye Information" |
| `/extractor` | color, image | Extract colors from inputs and find matching dyes | `/extractor color <color> [count] [matching]` \| `/extractor image <image> [colors] [matching] [prevent_duplicates]` | YES | embed 2 |
| `/gradient` | — | Generate a color gradient with intermediate dyes | `/gradient <start_color> <end_color> [steps] [color_space] [matching]` | YES | embed 2 |
| `/mixer` | — | Blend two dyes using various color mixing algorithms | `/mixer <dye1> <dye2> [mode] [matching]` | YES | embed 2 |
| `/swatch` | — | Match a character file's colours to the nearest dyes | `/swatch <file> [order] [slot]` | YES | embed 2 |
| `/preferences` | show, set, reset, filters(set/show/reset) | Manage personal bot preferences | `/preferences show` \| `/preferences set [15 named options]` \| `/preferences reset [key]` \| `/preferences filters set [8 bools]` \| `filters show` \| `filters reset` | YES | embed 4, field `preferences` |
| `/manual` | — | Show help and usage guide | `/manual [topic]` | YES | embed 4, field `manualCmd` (inline) |
| `/comparison` | — | Compare 2-4 dyes side-by-side | `/comparison <dye1> <dye2> [dye3] [dye4]` | NO | — |
| `/contrast` | — | WCAG non-text contrast between dye pairs (floor 3:1) | `/contrast <dye1> <dye2> [dye3] [dye4]` | NO | — |
| `/accessibility` | — | How dye(s) survive each kind of color vision | `/accessibility <dye> [dye2] [vision]` | NO | — |
| `/a11y` | — | (alias of accessibility, shared handler) | `/a11y <dye> [dye2] [vision]` | NO (deliberate — registry.ts:45-46) | — |
| `/budget` | find, set_world, quick | Find affordable dye alternatives via market prices | `/budget find <target_dye> [world] [matching] [max_distance] [exclude_coffers] [exclude_wide_spectrum]` \| `/budget set_world <world>` \| `/budget quick <preset> [world]` | NO | — |
| `/preset` | list, show, random, submit, vote, edit, favorite(add/remove/list) | Browse/submit/vote community presets | `/preset list [category] [sort]` \| `show <name>` \| `random [category]` \| `submit <preset_name> <description> <category> <dye1> <dye2> <dye3> [dye4] [dye5] [dye6] [tags]` \| `vote <preset>` \| `edit <preset> [name] [description] [tags] [dye1..dye6]` \| `favorite add\|remove <preset_name>` \| `favorite list` | NO | — |
| `/changelog` | — | The bot's own release notes | `/changelog [version]` | NO | — |
| `/stats` | summary, overview, commands, preferences, health | Usage statistics | `/stats summary\|overview\|commands\|preferences\|health` | NO | — |

## buildEmbeds() layout (`manual.ts:121-239`)

5 embeds, one colour (`BRAND_ACCENT`) throughout:
1. **Overview** — title + description only, no fields.
2. **🎨 Color Matching Tools** — 5 fields, all `inline:false`: extractor, harmony, mixer, gradient, swatch.
3. **🧪 Dye Information** — 4 fields, all `inline:false`: dyeSearch, dyeInfo, dyeList, dyeRandom.
4. **ℹ️ Bot Information** — 3 fields: preferences (`inline:false`), about (`inline:true`), manualCmd (`inline:true`).
5. **💡 Tips & Resources** — description only (autocomplete/hex/dye-name/facewear tips + 3 links), no fields.

Busiest embed has 5 of Discord's 25-field cap (20 fields of headroom). Adding any of the 8 missing commands (comparison/contrast/accessibility/budget/preset/changelog/stats, +a11y if ever un-aliased) as new fields in an existing embed, or as a 6th embed, is nowhere near the limit either way.
