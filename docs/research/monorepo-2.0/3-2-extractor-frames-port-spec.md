# 3.2 — /extractor frames (14K Ramp + 14J·2 Colour sheet) + the measured row

Sources (fetched 2026-08-08): `Bot Graphics Directions 4.dc.html` (Turn 14 —
both subcommands CONFIRMED, R1 de-confirmed for the image subcommand) and
`Bot Graphics Directions 2.dc.html` (Turn 12 — R1 kept as the record).

## The measured row (14I — landed in frame.ts)

All four confirmed list cards (12H, 12F, 14K, 14J·2) draw the identical
five-slot row: **lead value · butted source→dye pair · name · tier bar ·
measure** — every argument required, no optional slots, no branches. Only
the lead's *meaning* varies (step, share, rank). Slot widths per card:
14K `38·52·180·26·34` (name 12.5), 14J·2 `40·54·176·26·34` (name 13 — the
binding case at 25 px spare on *Johannisbeerenvioletter*). The butted pair's
seam is the drift made visible; the tier bar is a fixed-width tier
indicator (the documented way back if it proves too coarse: widen the slot
to ~60 px and put a proportional bar there). One ramp — the old
non-monotonic `MATCH_QUALITIES` (green→blue→green) is deleted.

## /extractor image → 14K Ramp (400×350)

The five-row cap only binds the list. The **band carries ALL colours at
their real share** — the one thing an extractor should show and a row
cannot (a row gives 42% and 2% identical height). Slices are floored at
7 px with the remainder taken off the largest band, or the tenth colour
silently disappears. Rows are a top five by share, each with the butted
extracted→dye pair (band = *how much*, pair = *which became which*),
ΔE2000 per row. Nothing is deferred — the count in the embed is a
description, not an apology; no "+N more" tail exists for this command.
Chip: **/EXTRACTOR IMAGE** — the chip names the subcommand, a glyph cannot.
Embed: one line (`{n} colours` + the /manual 📸 pointer — confirmed to
live in the embed and never the PNG), accent bar = dominant extracted
colour.

## /extractor color → 14J·2 Colour sheet (400×350)

Target block (label + swatch + resolved name or hex), then the same
five-slot row: rank lead, the **target repeated down the pair column** (a
constant reference rail), name, tier bar, ΔE. Chip: **/EXTRACTOR COLOR**.
Ranking is **ΔE2000 over the whole non-Facewear pool** — the shipped
raw-RGB order could differ, so this changes the answer, not just the
picture. `count` still goes to 10; the card holds 5 and the tail — the
FURTHEST matches — is listed in the message. Copy buttons survive for the
single-match case. The proportional-magnitude bar (14J) is the accepted
loss, kept as the record.

## Handler changes (discord-worker extractor.ts)

- color: now defers and renders the card (was embed-text only); the raw-RGB
  `getColorDistance`, the emoji quality ladder and both old response
  builders are deleted.
- image: entries → band (all matches) + top-five rows with ΔE2000 recomputed
  from the extracted hex; the old per-dye embed dye-list (a second copy of
  the picture) is cut to the one-line + manual pointer.
- `/match` and `/match-image` remain dead code staged for removal (their
  deletion rode Phase 1); `matchImage.*` error keys still serve the image
  subcommand's validation copy.

## Strings ×6 (bot-logic `card.*`, verbatim from the doc's authored set)

share (SHARE/ANTEIL/割合/PART/비중/占比) · matched (MATCHED DYE/PASSENDER
FARBSTOFF/該当カララント/TEINTURE TROUVÉE/일치 염료/匹配染剂) · rank · target ·
rampTitle ("Palette from image" ×6) · matchTitle ("Nearest dyes" ×6) ·
colours ("{n} colours") · rampKey ("band width = share of image") ·
matchKey ("nearest by ΔE2000") · manualLead/manualTail (embed pointer copy;
JA/KO carry a non-empty tail).

## Register notes

- Turn 12's R1 Cap is de-confirmed for the image subcommand only (its five
  equal rows hid proportion); everything else R1 settled stands — five
  rows, the type floor, embed-only pointers — and R1 still governs 12H/12F.
- 12H·2/·3/·4 gradient + 12F mixer are the next unit (3.3) on this same
  measured row.
- `PaletteMatch.distance` from core remains the k-means matcher's own
  metric; the cards recompute ΔE2000 at the boundary rather than trusting
  it.
