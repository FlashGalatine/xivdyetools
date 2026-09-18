# Verifier verdicts — the Discord bot's `/manual` (2026-09-18)

Served baseline: production discord-worker last deployed successfully from `0fec18f4` (= this
tree). bot-logic reaches the worker through `workspace:*`, so the checkout text is what users read.
Every `manual.*` defect sits at the **same line number in all six locale files**
(`packages/bot-logic/src/i18n/locales/{en,ja,de,fr,ko,zh}.json`).

| cand | verdict | sev | location | decisive evidence |
|---|---|---|---|---|
| MAN-01 | CONFIRMED | MEDIUM | `en.json:70-71` `manual.swatch` | `/swatch color <type> <index>` \| `/swatch grid …` and "race/clan specific palettes" describe the deleted 4.x command. 5.0 `/swatch` = required `file` + optional `order`/`slot` (`schemas.ts:870-901`, `handlers/commands/swatch.ts:4-9`). |
| MAN-02 | CONFIRMED | MEDIUM | `en.json:437-464` `matchImageHelp.*`; `manual.ts:35-116,386` | Whole topic documents `/match` + `/match_image`, deleted in 5.0 (`extractor.ts:10`). Also wrong: "136 FFXIV dyes" (125), "Euclidean distance in RGB" (default ΔE2000), "`colors` option (1-5)" (3-10, `schemas.ts:344-350`), "8MB" (10 MB, `apps/image-worker/src/validators.ts:38`). `/extractor image`'s own reply points users at this topic (`extractor.ts:581`). |
| MAN-03 | CONFIRMED | MEDIUM | `en.json:58-59` `manual.harmony` | 7 of the 10 registered types (`schemas.ts:28-39`); `wheel`, `companions`, `matching` never mentioned (`schemas.ts:174-214`). |
| MAN-04 | CONFIRMED | MEDIUM | `en.json:66-67` `manual.gradient` | `<start> <end>` and "(2-10)"; options are `start_color` / `end_color`, `steps` is 2-12, default 6 (`schemas.ts:382-402`). |
| MAN-05 | CONFIRMED | LOW | `en.json:74` `manual.preferences` | `set <key> <value>` does not exist — `set` takes 15 named options (`schemas.ts:628-757`); the `filters set\|show\|reset` group (`schemas.ts:791-862`) is unmentioned. |
| MAN-06 | CONFIRMED | MEDIUM | `en.json:594` `manual5.topics.characterFile.body` | Names 5 slots; `slot:` offers 7 (`schemas.ts:888-900`) — highlights and tattoo/limbal ring are missing. |
| MAN-07 | CONFIRMED | MEDIUM | `en.json:63` `manual.mixer` | "Finds the closest FFXIV dye to the blended result"; `/mixer` sweeps five ratios (25/40/50/65/80, `packages/bot-logic/src/commands/mixer.ts:56`) and matches a dye per ratio. |
| MAN-08 | CONFIRMED | MEDIUM | `manual.ts:121-239`; claim at `en.json:47` | "all available commands" names 9 of 17 registrations. Missing: `/comparison`, `/contrast`, `/accessibility`, `/budget`, `/preset`, `/changelog`, `/stats` (`registry.ts:41-58`). Only `/a11y` is justified in-tree (`registry.ts:45-46`). No capacity reason: the busiest embed uses 5 of 25 fields. |

Found while checking the facts below, outside the eight rows (both LOW):

- `manual.autocompleteNote` (`en.json:48`) "All commands support autocomplete for dye names" is false — dye-name autocomplete exists on 11 of 17 registrations and not on every subcommand of those.
- `manual.tips.facewearExcluded` (`en.json:105`) calls Facewear colours "dyes" that are "excluded from results". Since dye schema v2 they are not in the dye database at all; the outcome is unchanged but the described filter does not exist.

## Facts the rewrite is built on (each checked at `file:line`)

1. `/swatch <file> [order] [slot]` — `order`: `slots` (default) / `hardest`; `slot`: skin, hair, highlights, eyes, lip, facepaint, limbal (`schemas.ts:870-901`). Handler caps the file at 1 MiB (`handlers/commands/swatch.ts:39,100`); card shows at most five rows.
2. `/extractor image <image> [colors] [matching] [prevent_duplicates]` — `colors` 3-10, default 4 (`extractor.ts:74`); PNG, JPEG, GIF, WebP, BMP by magic bytes (`validators.ts:382-396`); 10 MB, ≤ 4096 px a side.
3. `/extractor color <color> [count] [matching]` — `count` 1-10, default 1.
4. `/harmony <color> [type] [wheel] [companions] …` — 10 types, 5 wheels (RGB default, RYB, Munsell, OKLCH hue, OKLCH lightness), `companions` 1-3 default 1.
5. `/gradient <start_color> <end_color> [steps] [color_space] [matching]` — `steps` 2-12 default 6; 9 colour spaces, default HSV.
6. `/mixer <dye1> <dye2> [mode] [matching]` — 6 modes; the effective default is **RYB** (`types/preferences.ts:127`), not the first dropdown entry.
7. `/comparison` and `/contrast` — `<dye1> <dye2> [dye3] [dye4]`, 2-4 dyes.
8. `/accessibility <dye> [dye2] [vision]` (`/a11y` identical) — one dye: every lens, no verdict, `vision` ignored; two dyes: separation per lens.
9. `/budget find <target_dye> [world] [matching] [max_distance] [exclude_coffers] [exclude_wide_spectrum]` · `set_world <world>` · `quick <preset> [world]`; `max_distance` 2-20 default 8.
10. `/preset list|show|random|submit|vote|edit` + `favorite add|remove|list`; `submit` needs name, description, category and 3-6 dyes. Moderation subcommands are not on this worker.
11. `/preferences show` · `set` (15 named options) · `reset [key]` · `filters set|show|reset` (8 booleans).
12. `/changelog [version]` — newest release expanded plus the next five as one-liners; always ephemeral.
13. `/stats summary` is public; `overview|commands|preferences|health` require `STATS_AUTHORIZED_USERS`.
14. `/dye random` shows up to 5; `/dye info` card carries HEX/RGB/HSV/LAB, stain ID, source and market item; `/dye search` is case-insensitive substring matching, not fuzzy.
