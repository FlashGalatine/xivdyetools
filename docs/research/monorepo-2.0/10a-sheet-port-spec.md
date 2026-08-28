# 10A Sheet — Swatch Matcher port spec (distilled from the design project)

Source: `Swatch Tool Directions.dc.html` (fetched 2026-08-08) + `SwatchScreen.dc.html`.
CONFIRMED: **10A Sheet is the Swatch Matcher spec; 10B (Wardrobe) and 10C (Grid) are
rejected and stay as the record.** "Nobody finds their eye colour in a wall of 192
squares. They have the file." The front door turns from a picker into a reader; the
shipped 8×24 grid becomes the slow path, not the only one.

## The idea

Every colour on the character at once, one card each, with its best dye already on the
card — the sheet answers the whole question before you click anything. Selecting a slot
writes the verdict sentence and fills the Result Cards; the grid appears as a five-row
excerpt around that index. Absent slots stay as dashed placeholders **with the reason**,
so a sparse file reads as a fact about the character, not a loading failure.

The no-file state is the shipped tool plus an offer: the drop zone sits *above* the
workspace, and the palette rail, grid, hex field and Result Cards all still work.
Import is an accelerant, not a dependency.

## Format findings (measured across the 112-sample corpus — the register for the parser)

Core's Phase-0 `.chara` parser implements these; the tool consumes core. Re-verify each
against the parser before the rewrite; anything missing is a core fix first.

- **Eight colour slots, two of them eyes.** REyeColor/LEyeColor, HairTone, Highlights,
  Skintone, LimbalEyes, LipsToneFurPattern, FacePaintColor. Heterochromia is ordinary
  (18/112 = 16%); the shipped single eye slot cannot describe any of them.
- **The eye index fields are crossed against the extended fields**: `REyeColor`'s index
  pairs with `LeftEyeColor`'s float and vice versa. Trust the extended naming; label
  accordingly; never silently swap somebody's eyes.
- **Every colour arrives twice** — an index (a creator-grid address) and, sometimes, a
  linear-RGB float triplet. Where they agree the index wins (an address you can point
  at). `IsExtendedAppearanceValid` is not a reliable gate: 96/112 carry float keys, only
  16 declare the flag. Missing flag = index wins, said out loud. Where they diverge the
  character wears an arbitrary colour no cell can express → **OFF GRID** (the Evercold
  world arriving early; the layout needs no rework in January).
- **Floats are linear, not sRGB.** Gamma transform mandatory — untransformed values are
  wrong-but-plausible colours (0.744/0.532/0.179 is #E0C175 transformed, #BE882E not).
- **A slot can be off while its index is live data** — the most consequential gotcha:
  60/112 set `EnableHighlights: false` and 47 of those still carry a non-zero highlight
  index. Same shape for `FacePaint: 0` (22 files). Read the flag or paint 47 characters
  a colour they are not wearing.
- **Lip alpha is an opacity, not a switch**, and both ways of having no lips are common:
  alpha exactly 0 (28 files) vs no usable MouthColor at all (16: key omitted or null)
  while keeping a good lip index — distinct states, don't collapse them. Live alphas are
  continuous (0.25…0.71); the lip swatch blends over skin at that opacity. Whether the
  slot matches the swatch or the blend is open — ship matching the swatch, keep the
  question in the file.
- **Two fields are two things**: LimbalEyes is the limbal ring on Au Ra, the tattoo
  colour on everyone else (one palette, two UI names by tribe). LipsToneFurPattern is a
  lip tone on seven races and a **fur-pattern enum on Hrothgar** (1–43 — not a colour
  index; reading it as one paints a pattern number into the lip swatch). A Hrothgar can
  still carry a real MouthColor at alpha 0.6 → an index-less slot = the OFF GRID state.
- **Split ranges are one rule**: 0–95 dark palette, 128–223 light at v−128, in every
  palette with both variants. **96–127 is not a colour — fail loudly, never clamp.** No
  sample lands there, which is exactly why the branch must be written deliberately.
- **It is not one format.** TypeName is Anamnesis (79) / Ktisis (4) / combined (10) /
  absent (19); 27 of 65 keys appear in some files only. Parse by key presence, never by
  declared type; show which producer wrote the file so a missing slot is attributable.
- **Privacy is on the card**: parsed on this device, nothing uploaded — same promise and
  wording as the Extractor's note. `Base64Image` (present-but-null in 19/112) is never
  read, rendered or stored; a parsed character's thumbnail is its own colour strip.
- **Tribe, not Race.** Race strings drift (Lalafel/Miqote); Gender is
  Feminine/Masculine. Tribe determines both → race/gender selectors become a readout
  when a file is loaded, editable only without one. *Delta vs the doc*: Phase 1 already
  renamed our SubRace `Helion`→`Helions`, so Hrothgar files now match exactly — the
  doc's `Helions→Helion` alias is obsolete; keep the loud unrecognised-tribe failure.
- **Dyes ride along**: DyeId/DyeId2 per gear slot (12 slots incl. OffHand), as stain
  IDs. DyeId 0 = undyed, not black. 671 dyed channels across 110/112 files; 35% are the
  second channel. Never derive stain IDs from item-ID ranges (that broke Jet Black 102
  and the Metallic run); `dyes.json` carries stainID + legacyItemID for all 125.
  *Delta vs the doc*: presets.json is already stainID-keyed (v2.0.0, Phase 1) — the
  doc's "needs reconciling" warning is resolved; Make-a-palette submits stainIDs.

## Layout (10A frames)

1. **File card** (or drop zone when none): filename + producer + character meta, tribe ♀
   readout, LOCAL ONLY chip, the charaHint privacy line, Load-a-different-file. Drop
   zone copy: "Anamnesis, Ktisis or Brio…" + Choose file + OR PICK A SWATCH below.
2. **THIS CHARACTER** — the sheet: one card per slot (left/right eye, hair, highlights,
   skin, tattoo/limbal [tribe-dependent name], lips, face paint), swatch + index address
   or OFF GRID + best dye + ΔE. Absent slots dashed with the reason (flag off, alpha 0,
   fur pattern, not in file).
3. **Verdict + CLOSEST DYES**: selecting a slot writes the verdict sentence (which names
   the palette it is calibrated on) and fills compact Result Cards — the plain reading
   the card was designed for: left the character colour, right the buyable dye, a real
   ΔE. Count comes from the match line, not a hardcoded top-3.
4. **IN THE CREATOR** — five-row grid excerpt around the selected index, R·C address
   (R6·C3), range toggle for Dark/Light palettes. Co-located pins merge into one badge
   (1·2) — 84% of files have both eyes on one cell; both legend rows select the same
   cell. Arbitrary colours have no address and show OFF GRID, never a fake one.
5. **DYES ON THIS GLAMOUR** — one row per equipment slot, both channels, labelled by
   slot (slotShort ×6 from `String Pass - Extractor & Swatch.dc.html` §1c); hint "Two
   dye channels per piece since 7.0. DyeId 0 is undyed, not black." + **Make a palette**:
   dedupes into a preset draft; dyes individually droppable with a count warning (a
   glamour is usually too big to be a palette — curated run 3–4, Galatine's is 10);
   name field carries the not-localised warning; Save to this device (saved shelf) /
   Submit to Community (8S submit flow).
6. **Hex field**: `#RRGGBB or any colour` + native picker; OR START FROM A DYE search.
   SEND TO handoff row (harmony/comparison/gradient/accessibility/budget/save-as-preset).
7. **Match line** per the suite rules: six methods identical to 7C/9C, default flips
   this tool's oklab → ΔE2000; the drawn UNITS bands are pre-calibration placeholders —
   core `BAND_VOCABULARY` is the authority. **Per-palette calibration**: 192 skins are
   near-identical (a global line reads everything perfect); tattoos span the wheel (the
   same line reads everything far). Each palette carries its own calibration and the
   verdict names it.

## Cut in all directions

The always-on race/gender selectors (readout when file present; seven of nine palettes
are shared anyway) · the second highlight vocabulary (one ring, one address label, one
meaning) · the hardcoded TOP_N=3/matchCount:3 (the match line decides) · the nine-entry
category dropdown (seven palettes, two with a Dark/Light range toggle).

## Strings

UI block en/de/ja verbatim in the doc (charaFile/charaHint, orDye, hexInvalid,
matchLine, localOnly, replaceFile, whoHead/whoHint, dropTitle/dropBody/chooseFile/
orGrid, slotsHead/matchesHead/inGrid/sendTo, equipHead/gearHint, makePalette/
paletteTitle/paletteNamePlaceholder/paletteNameHint/saveLocal/submitCommunity, slot +
palette labels incl. the Au Ra limbal alias); fr/ko/zh authored at port time.
slotShort (gear-slot abbreviations) + OFF-GRID strings ×6 live in
`String Pass - Extractor & Swatch.dc.html` §1c — fetch during the string pass, land
verbatim.

## Staged implementation order

1. Spec (this file) + parser audit: verify core's `.chara` parser against every finding
   above (crossed eyes, gamma, flag gating, lip alpha states, Hrothgar fur enum, split
   ranges w/ loud 96–127, key-presence parsing, producer detection, tribe handling
   post-Helions-rename, DyeId stainIDs); fix core first where short.
2. Locale strings ×6 (UI block + §1c slotShort/OFF-GRID).
3. Tool rewrite: file card/drop zone + sheet + verdict/results + grid excerpt + glamour
   dyes + make-a-palette + hex/dye entry + per-palette match line. Note the v4 shell
   reality from 9C: leftPanel === rightPanel — render ONE main flow; no Tailwind-
   dependent shared components inside the shadow DOM.
4. Visual pass with the corpus samples (AuRaTest = drift + heterochromia + crossed eyes;
   Galatine/Althyk = no drift; SlotMachine = Hrothgar mouth-without-index; a
   Helions-writing Hrothgar for the tribe path).
