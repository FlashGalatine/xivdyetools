# Glamour Reader — the tenth tool

**Date:** 2026-09-27 · **Scope:** `web-app` (new tool), `core` (in-game check), `svg` (glyph + bot
card), `api-worker` (resolve rules + acquisition), `og-worker` (default card), `discord-worker` +
`bot-logic` (`/glamour`), Rich Presence art (exported files, uploaded by hand) ·
**Status:** implemented 2026-09-27 — web + api-worker #208, og-worker #209, bot #210 (stacked in that order on #206 → the prototype), Rich Presence art exported; final review's Important findings fixed · "Everything drawn", the designer's picks adopted, Native execution ·
**Design:** Claude Design project *XIV Dye Tools* — `Glamour Reader Directions.dc.html` (turn 1 web
1a/1b + bot 2a/2b, turn 2 export sheet 2c), `Glamour Reader Icon.dc.html` (glyph 1a),
`OG Default Cards - Export.dc.html` + `OG Card Directions.dc.html` (ten-tool root rail),
`Rich Presence Art.dc.html` (turn 2: 2a/2b/2c) ·
**Builds on:** PR #206 (`CharaSessionService`), branch `claude/glamour-check-prototype` (the in-game
check), [the acquisition spec](2026-09-27-glamour-acquisition-design.md)

## Problem

DYES ON THIS GLAMOUR lives inside the Swatch Matcher, whose sidebar, colour-match settings and
layout have nothing to do with reading gear. The block has grown into its own job — named pieces,
dyes, Open in…, the GPOSERS list and Make a palette — and the prototype adds a second question the
Swatch Matcher never asked: *can this look be worn in the game?* The designs move it into its own
tool, put that verdict first, let the player pick between items that look identical, and fill the
GPOSERS list's Acquisition line in an editable preview.

## What the user decided (design register, 2026-09-27)

- Identifier **`glamour`** everywhere: route `/glamour`, `ToolId`, `TOOL_ICONS`, telemetry allowlist,
  Rich Presence key `tool_glamour` (immutable once uploaded).
- OG root rail re-cut **22 px cells / 12 px gaps** — ten glyphs in 356 px.
- Rich Presence idle key **4 · 3 · 3**.
- **Since patch 7.4 job restrictions no longer apply to glamour.** The check keeps dye count,
  `IsGlamorous`, race, gender and Grand Company. A `.chara` records no Grand Company, so a GC-locked
  piece is flagged ("needs the right Grand Company"), never failed.
- Export sheet answers (turn 2): editable preview in a sheet · edits kept on device · a twin pick
  rewrites that piece and warns if it was edited · token gear lists encounters only · no source →
  blank · the picked twin's source only · written as found.
- **Adopted picks** (this session's answer "adopt all picks"): glyph **1a** (tunic + chest chip);
  screens **1a/1b** (verdict first); the default twin rule below; bot card **2a** (pieces); accent
  lime **`#BDEE63`** for `tool_glamour`; RP cover **2a** (72 px glyphs, 20 px gaps, 900 of 912 px).

## Decisions made for the build

| # | Decision | Why |
|---|---|---|
| G1 | **Keyboard shortcut `0`** for the tenth tool | 1–9 are taken; the proposal allows 0 or none, and 0 sits after 9 on the number row. |
| G2 | **Narrow-desktop header fix:** below 920 px the language button drops its globe (as mobile already does) | The icon doc's first-named fix moves a breakpoint that other layout depends on; dropping the globe is local to the button and saves the ~42 px the hover state needs. |
| G3 | **The twin set is the resolve answer's family:** the named item + `alternates` (still capped at `MAX_ALTERNATES`) + the family's rule groups. A twin past the cap can still be the default when its rule group passes, but it is only pickable by id when its name is in the answer | The cap exists for payload size. Rule groups already cover the whole family (prototype). |
| G4 | **Default twin** = the first twin, in the order *passes the check → not Dated → lowest row_id*, that passes; when none passes, the lowest row_id (today's rule). "Dated" = the English name starts with `Dated ` | Design 1a's rule. The EN name is the only Dated signal the data carries, and it arrives with every resolve. |
| G5 | **Row tone:** *fix* (green `+N`, tag FIXED BY A TWIN) when the default differs from the lowest row_id because the lowest fails; *block* (amber, NO FIX) when no twin passes; *choice* (grey `+N`) when the piece has twins and nothing is wrong; no chip for a unique piece. A manual pick that fails the check shows the block tone with the reason | The design's three tones; a manual pick has to be told the truth. |
| G6 | **Picks live in memory** keyed by slot and cleared when the session changes | Design: "A pick lives with the session, never in storage." |
| G7 | **The check runs on the picked twin** and reports per piece: fine, fixed by a twin, no fix (with the problem), or needs the right Grand Company (flag only). Counts drive the headline | Verdict first (1a). |
| G8 | **Acquisition edits** are stored in `localStorage` under one key, as `{ [gearHash]: { text, baseItemId } }` where `gearHash` = a short FNV-1a of `slot · family row_id (lowest) · stain ids`, and `baseItemId` is the twin whose generated line the edit replaced. Generated lines are never stored. **Reset all** deletes every entry for the current outfit's hashes | Design 2c: "keyed by a hash of the gear (slot, item row, dyes), never the file, its name or the character's name". Keying on the family, not the picked twin, is what lets a pick keep the edit and raise the warning. |
| G9 | **Twin warning:** when the picked twin changes and that piece has an edit whose `baseItemId` differs from the new pick, the row shows *Keep mine* / *Use new source*; without an edit the line is simply regenerated | Design 2c: "The twin warning never overwrites." |
| G10 | **Swatch Matcher loses the block** and its file strip gains a *Glamour Reader →* link; the reader's strip has *Swatch Matcher →*. The Swatch Matcher keeps its THIS CHARACTER sheet | Design 1a: "One file, two tools." |
| G11 | **No sidebar** on `/glamour`; the Advanced gear stays in the header bar | Design 1a. |
| G12 | **Bot resolves through the api-worker service binding** already bound as `UNIVERSALIS_PROXY` (`xivdyetools-api-worker`), calling `POST /v1/chara/resolve` | The binding exists; a second binding to the same worker adds config without adding capability. |
| G13 | **The bot card is a new row kind** in `@xivdyetools/svg` (`generateGlamourCard`), not a stretched `measuredRow` | Design 2a's own note. |
| G14 | **OG:** the `glamour` default card uses the 2a shape and the confirmed ×6 pattern; EN one-liner from the design, the other five languages translated in this PR and flagged for the string pass. The root PNG pair in `apps/web-app/public/og/` is re-exported from the design's export page at ×3 | The generator has no root rail; the root cards are static exports. |
| G15 | **Rich Presence art** is exported as PNG files for the Developer Portal; nothing in the repo changes | The repo holds no RP assets; the design project does. |
| G16 | **Strings:** every new UI string in all six languages in the same PR; EN from the design where drawn | The i18n parity gates require it. |

## Architecture

```
            .chara (browser only)                         Discord attachment
                    │                                            │
          CharaSessionService (PR #206)                discord-worker /glamour
             │                │                                  │ service binding
     Swatch Matcher     Glamour Reader ──POST /v1/chara/resolve──► api-worker
     (sheet only)      (verdict · rows ·      names · alternates · rules (dye, glamour,
                        twins · sheet 2c)     race/gender, GC) · acquisition (named + twins)
                             │                                   │
               core: checkCharaLook (no jobs, + GC flag)   bot-logic: executeGlamour
               core: pickDefaultTwin                        svg: generateGlamourCard (2a)
               shared: glamour-markdown (+ Acquisition)
               shared: acquisition-edits (localStorage)
```

### Units

| Unit | Change |
|---|---|
| `core` `chara-game-rules.ts` | Drop `jobs` (`CHARA_JOB_COLUMNS`, `charaJobsOf`, job spread); add `grandCompany: number` (0 = none) to the rules and a `gc` flag to the piece check; add `pickDefaultTwin(family, dyedChannel, character)` returning the default item id and why. Minor bump. |
| `api-worker` `chara/xivapi.ts` | Search fields: drop the 43 `ClassJobCategory.*` columns, add `GrandCompany.row_id`. Cache `SHAPE_VERSION` 2 → 3. |
| `api-worker` `resolver.ts` | Rules as above; `acquisition` on the named item and on each alternate (acquisition PR). |
| `svg` `icons/tool-icons.ts` | `glamour` compact + detail glyphs (design 1a geometry). Minor bump. |
| `svg` `glamour-card.ts` | `generateGlamourCard` — 400 × 350, header, ≤5 piece rows (slot lead, icon placeholder, name, dye chips + names, verdict column), footer count. |
| `web-app` `glamour-tool.ts` | The tool: header + actions, file strip (drop zone when empty), IN THE GAME panel, the glamour block (moved from Swatch), twin picker, export sheet. |
| `web-app` `glamour-block.ts` | Hosted by the reader, not Swatch; rows show the picked twin's name, the `+N` chip and the tone note; job spread removed. |
| `web-app` `glamour-twins.ts` | Pure: twins of a slot from a resolve answer, default pick, tone, facts. |
| `web-app` `glamour-sheet.ts` | Export sheet 2c (desktop sheet with preview pane, mobile full-height). |
| `web-app` `shared/acquisition-edits.ts` | Pure-ish store over `StorageService`: `gearHash`, get/set/reset. |
| `web-app` `shared/glamour-markdown.ts` | `acquisition` per piece. |
| `web-app` registration | `router-service`, `v4-layout`, `v4-app-header` (rail + mobile menu), `tool-icons`, `keyboard-service`, `config-controller` (if a tool needs a config slot — the reader does not), `share-service` (no share params: the file never leaves the device), locale files ×6. |
| `api-worker` `telemetry/schema.ts` | `glamour` in the tool allowlist. |
| `og-worker` | `glamour` in `DEFAULT_DECK`, `og-strings` ×6, route + `og-data-generator` case. |
| `bot-logic` | `executeGlamour` (resolve answer + parsed file → card data + embed text), i18n ×6. |
| `discord-worker` | `/glamour` handler (attachment rules of `/swatch`), registry, schemas, localize, `/about` parity, `/manual` pointer. |

## The screen (1a desktop, 1b mobile)

Top to bottom, one column, no sidebar:

1. **Title** "Glamour Reader", lead "Every piece this character wears, what it is dyed, and whether
   the game lets it be worn.", actions *Copy list* and *Export .md* (both open the sheet).
2. **File strip:** producer tag (ANAMNESIS…), file name, LOCAL ONLY, tribe + gender, *Swatch Matcher →*,
   SWAP. Empty session → the Swatch Matcher's drop zone.
3. **IN THE GAME:** a headline built from the counts ("Three pieces named from a twin, and one this
   tribe can't wear"), the fixed explanation ("Since 7.4 any job can wear any piece for glamour;
   what's left to check is dye channels, the glamour flag, race, gender and Grand Company. Swaps are
   already in the list below; change any of them from the piece's +N."), and count chips FIXED BY A
   TWIN · NO FIX · FINE AS IS (+ NEEDS A GRAND COMPANY when any).
4. **ON THIS GLAMOUR:** "N dyed pieces · M dyes", *Make a palette*, Pieces/Dyes, Show all, the rows.
   A row: slot, picked name, `+N` chip in its tone, a tag (FIXED BY A TWIN / NO FIX), a one-line note.
5. **Twin picker** (popover on desktop, bottom sheet on mobile): "SAME LOOK · N ITEMS", "The game
   draws these identically. Pick the one your list names.", one radio row per twin with facts —
   BEST FIT (the default), DYE ×n (warn when it can't take the file's dyes), ANY TRIBE / the tribe
   limit, DATED, the GC — and a why line for a twin that fails. Footer: "Copy list and Export .md
   write the one you pick."

## The export sheet (2c)

Header "Glamour list", "GPOSERS format · N pieces · edit anything before you copy it", chips
N FILLED · N EDITED · N BLANK. Left: one row per piece (slot, name, dye line, `Acquisition:` field,
state). Right (desktop): WHAT GETS COPIED, the plain-text rendering live. Footer: the privacy line
("Edits are kept on this device for this outfit. The character's name is never in the list, and the
file itself is never saved."), *Reset all*, *Save .md*, *Copy list*. Only the Acquisition field is
editable. The file card's privacy line gains "Your edited acquisition notes are kept on this device."

## The bot card (2a) and embed

`/glamour file:<.chara>`; 400 × 350; header "ANAMNESIS · MIDLANDER ♀" (producer + tribe + gender,
never the name) and "N dyed pieces · M dyes"; five rows in slot order (slot lead, name, dye chips +
names, verdict: TWIN / OK / the failing reason); footer "5 of N dyed pieces · k named from a twin ·
…"; `xivdyetools.app`. The embed's description carries every piece in the GPOSERS form (bold labels,
`Dye n:` lines), a "Named from a twin:" line, and a `/manual` pointer. No acquisition in the bot in
this version (the resolve answer carries it, but the embed's length budget goes to the pieces).

## Error handling

- Resolve failure → the reader shows the rows without names (as the block does today) and no verdict
  panel; the sheet still opens with blank acquisition lines.
- Rules missing for a family (`rules: []`) → the piece is left out of the check, as in the prototype.
- `localStorage` unavailable → edits live for the page only; nothing throws (`StorageService`).
- Bot: the `/swatch` attachment guards (size cap, host allow-list, parse errors) apply unchanged; a
  resolve failure answers with the error embed, not a partial card.

## Testing

- core: GC flag, jobs gone, `pickDefaultTwin` order (pass → non-Dated → lowest id), none-pass fallback.
- api-worker: fields list (no `ClassJobCategory`, has `GrandCompany`), parse of GC, cache version.
- svg: glyph present in compact + detail, one filled accent; glamour card snapshot-free structure tests
  (row cap, footer counts, no character name).
- web-app: twins (default, tone, facts), acquisition-edits (hash stability, reset, warn condition),
  markdown with acquisition, the tool's registration (route, header, menu, shortcut, telemetry),
  the sheet's copy/save text, Swatch no longer rendering the block; e2e: load a sample, see the
  verdict, pick a twin, open the sheet, edit, copy.
- og-worker: default card for `glamour` in both frames; strings ×6; font coverage for new strings.
- bot-logic/discord-worker: executeGlamour output, registry + schema + localize parity, /about, manual.

## Rollout

1. **PR A — api-worker 0.15.0**: acquisition (the acquisition plan, amended).
2. **PR B — Glamour Reader** (core, svg glyph, api-worker rules, web-app): stacked on
   `claude/glamour-check-prototype` → #206 until they merge; rebased onto PR A.
3. **PR C — og-worker**: `glamour` default card + the static root PNG pair.
4. **PR D — `/glamour`** (svg card, bot-logic, discord-worker). Register commands after deploy.
5. **RP art**: PNGs handed over for the Developer Portal.

## Open questions

1. The five non-English one-liners and short names are this PR's translations; the ×6 string pass
   should review them.
2. Whether the bot embed should carry acquisition lines later.
