# 3.8 — /swatch character-file frame (bot graphics 5.0)

Port spec distilled 2026-08-08 from `Swatch Bot Card & Banner Glyphs.dc.html`
(1a + 1b **both CONFIRMED 2026-08-07**, behind an `order:` option) and its data
script (en/de/fr/ja strings verbatim; ko/zh authored per precedent).

## The command (net-new on the bot)

The 4.x `/swatch color|grid` (index/grid → dye matching) is **replaced** by the
5.0 character-file command: registration with a **required `file:` attachment**.
Parse rules come from core as decided — `parseCharaFile` (key presence not
TypeName, gamma on the floats, flag gating, the Helions guard, never
`Base64Image`) + `resolveCharaColors` (index-vs-float with OFF GRID past ~6
ΔE2000, R·C addresses, merged eyes, lip compositing). OFFLINE: nothing to
degrade — the dye table is bundled, matching is local. A file that fails to
parse is embed text with the field and value named, never a frame.

## The frame (400 × 350, one card, two orders)

- Header: 66×30 strip of the live slot colours (equal stripes, file order) ·
  charSub 11px mono over charName 14px body 600 · `/SWATCH` chip right.
  **charSub is NOT localized** (the doc keeps `DUNESFOLK ♂ · ANAMNESIS`
  constant across all four locales): tribe EN + gender symbol + producer.
  charName = Ktisis nickname, else the attachment filename.
- Column header: `lSlot` 56px · `lNearest` flex · `ΔE` 36px right.
- Rows are **measuredRow consumer #5** — the abstraction holds with all five
  slots; the lead is a *shaped label* (slot short over grid address), still one
  lead value. `MeasuredRowOptions.lead` widens to `string | MeasuredLead`
  ({text, sub, subTone}) — an enriched value type, not a behavioural flag.
  Widths 56·54·158·26·36, rowH 46, name 13px. OFF GRID address prints amber
  (tiers[2]). Port note: the doc's hand-drawn 10.5px address line ships at
  11px — the type floor wins. The doc's 22+32px pair with a 4px seam is
  likewise normalized to the vocabulary's butted equal halves (the seam IS the
  drift made visible — a gap would contradict 14I's own thesis).
- **Rows are live slots only** — inert (`EnableHighlights: false`,
  `FacePaint: 0`, fur, α=0 lip) and error slots are not rows; the footer counts
  what parsed. Merged eyes (shared index) are ONE row, address suffixed `·LR`;
  heterochromia is two rows (`·L`/`·R`) and one more candidate for the cap.
- Source hex per row is the **winning** colour: float when OFF GRID/float-only,
  the composited blend for the lip, else the index hex. Matching = full-scan
  best ΔE2000 (Facewear excluded by construction).
- **Tail rule (uniform, /contrast's rule): past five live slots the SAFEST
  match drops** — whatever the order, both orders show the same five rows; the
  footer counts (`{s} of {n} slots`) and the embed names the drop with its ΔE.
- `order: slots` (default — file order, so two reposts of the same character
  agree) | `hardest` (worst-first, the off-grid lead rises). Chip stays
  `/SWATCH` for both — an option on the same frame, not a subcommand.
- Footer: generated `footKey` + the app-icon mark. **The 2026-08-07 mark
  decision ships here: the footer app icon goes 13 → 18 px** (frame.ts
  markFooter, all cards — "replaces the flat six-stripe band … all frames
  updated" per the chip-rework conventions).

## slot: routes to the other confirmed shape

`/swatch file: slot:hair` renders **14J·2** (generateNearestSheet) with the
slot's winning colour as target — five nearest, same row, chip prints
`/SWATCH`. No third frame. Eyes pick the left eye when they differ.

## What the PNG deliberately leaves to the embed

OFF-GRID detail (index hex → live hex — the card names the state, the embed
names both), the lip α raw-vs-blend pair, worn gear dyes (already stainIDs — a
localized text list, no matching), the dropped-slot note, and the `/manual`
topic pointer (👤 topic string lands with the 3.9 roster; the pointer line
mirrors the extractor's). **No privacy sentence on the card** — the local-parse
wording is web-only by decision; this worker does receive the file.

## Strings (card.* ×6; en/de/fr/ja verbatim from the doc, ko/zh + two authored)

slotShort skin/hair/hl/eyes/lip/paint + OFF GRID + lSlot/lNearest + footKey
(`nearest by ΔE2000 · {s} of {n} slots` shapes). `·LR`/`·L`/`·R` are
untranslated identifiers (code). The doc's slot set omits tattoo/limbal (its
sample had neither) — `TATT.`/`LIMBAL` shorts are **authored** for all six.
Embed keys (swatchOffGrid/swatchLip/swatchGear/swatchDropped/swatchParseError)
authored.

## Placement

`executeSwatch` lives in bot-logic (platform-agnostic, stoat gets it free);
the Discord handler downloads the attachment (size-capped 1 MiB), passes text.
The banner (detail) glyph set 1c is already home in tool-icons.ts from Phase
0.2 — no icon work in this unit.
