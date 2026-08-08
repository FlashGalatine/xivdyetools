# 9C Ledger — Budget Suggestions port spec (distilled from the design project)

Source: `Budget Tool Directions.dc.html` + `BudgetScreen.dc.html` / `LedgerBody.dc.html` in
design project `993f0c5c-05b9-439b-8047-66a9c5ab1bd6` (fetched 2026-08-08). CONFIRMED:
**9C Ledger is the Budget Suggestions spec; 9A (Ladder) and 9B (Swap) stay as the record.**
Port into the existing v4 shell, inline styles only (shadow DOM).

## The idea

"Jet Black costs 178,400 gil. Soot Black costs 216 and is 5.2 away." — that sentence is the
whole tool. No cards in the list: one row per candidate, tier group headers carrying the
single price, and a column the old tool never had: **gil per ΔE point** — what each unit of
colour accuracy costs you to buy back.

## Patch 7.5 reality the tool is built on

105 of 125 dyes share three market items — Standard Spectrum (52254, 85 dyes, 216 gil
vendor), Wide Spectrum #1 (52255, 9 dyes, 100 Skybuilders' Scrips), Wide Spectrum #2
(52256, 11 dyes, 600 Cosmocredits). Within a tier every dye costs exactly the same, so
**price prints once per tier group**. Only the 20 Venture Coffer dyes keep their own item
IDs and volatile board prices; the target is nearly always a coffer dye and the answer is
nearly always a Spectrum dye.

## Layout (content region)

1. **Target** — existing picker; share URL keys on stainID (landed in Phase 1).
2. **Quick picks** — GENERATED from the board, not hardcoded (the shipped six are stale):
   label `PRICIEST ON <world> NOW`; offline → `MARKET-ONLY DYES · NO PRICES OFFLINE`
   (list coffer dyes unpriced). Jet Black / Pure White will nearly always lead.
3. **Verdict block** (tone accent):
   - online: badge `{n} IN RANGE` · money = best gil-per-point figure, label
     `PER ΔE POINT, BEST ROW` · headline "What {target}'s colour is worth, line by line."
     · sub "Every dye within {thr} of the target, grouped by what it costs and sorted by
     the gil each point of drift buys back. The vendor and scrip figures are local; the
     board column needs a connection."
   - offline: badge `MARKET DATA UNAVAILABLE` + off text (vendor/scrip still shown, board
     dashed, coffer tier unpriceable) · money label `CHEAPEST KNOWN · VENDOR`, unit
     "no target price to measure against".
   - **Upgrade mode** (target is a Standard Spectrum dye — nothing is cheaper than 216):
     the tool inverts. badge `ALREADY THE FLOOR` / "Nothing is cheaper than {t}." / upSub
     ("…the ladder runs the other way: here is what more money would buy instead") / money
     `216 gil`, label `THE FLOOR`; tier multiples read `×N more`.
4. **Tier groups**, order X (Coffer) → C (Wide #2) → B (Wide #1) → A (Standard) —
   descending price; upgrade mode ascends and drops the target's own tier. Each group:
   - rail + tag colour per tier (A #5bbd68 · B #8bc34a · C #ffc107 · X #f4645a),
     mono tier tag (STANDARD / WIDE #1 / WIDE #2 / COFFER), localized tier name,
     count `matches / pool`.
   - **price once**: A = vendor gil main + `board N` sub (+ green flag
     `VENDOR SAVES {diff} vs BOARD` — for Standard it always does); B/C = board gil main +
     `or {scrip/credit price}` sub online, scrip/credit main offline (**currencies are
     never added or converted — compared through the board only**); X = board min–max
     range, `no vendor · market only` sub, offline flag `MARKET DATA UNAVAILABLE`.
   - multiple vs target: `×N` + `CHEAPER` label (upgrade: `×N more`).
   - empty band: "Nothing in this tier is within the match line."
5. **Rows** (per candidate, within a group): swatch + name | ΔE (unit tag + value, tier
   colour) | BOARD (dash offline/unknown) | GIL/ΔE = (targetGil − rowGil)/rowΔE.
   - Register: **gil-per-ΔE blanks when method ≠ ΔE2000** (the ratio changes magnitude
     with the unit); cross-currency ratio cells are EMPTY and sort last; fallback sort =
     tier, then distance. Sortable: ΔE / name / board / per-point.
   - Row actions: existing result-card context path can wait; row click selects (pick).
6. **Match line** — the colour-distance slider (2–20, default = existing config) stays and
   moves under Advanced with the matching-method switch (same six-method set as 7C; only
   ΔE2000 is what the slider is calibrated against — other methods take their calibrated
   MATCH middle cut as the line). The Result Card (target header) keeps ΔE2000.

## Pricing rules (replaces getBudgetComparablePrice — the shipped defect class)

- Coffer dye: **no vendor gil at all** (the shipped code read `dye.cost` = 1 and made the
  game's most expensive dyes the cheapest thing in the tool; register: coffer = 1 venture,
  not 1 gil). Gil figure only from the board (its own itemID).
- Spectrum A: vendor 216 gil (local, always known) + board price of item 52254.
- Spectrum B/C: no gil vendor price; scrip/credit cost is local and shown, board price of
  52255/52256 is the only gil figure. Never convert scrips/credits to gil.
- `getMarketItemID()` from core maps legacy→consolidated for board lookups.

## Cut / kept

CUT: the value sort (0.7×distance+0.3×price, a number never shown), the 1–10 max-results
slider, the hardcoded quick picks. KEPT: the distance slider (the real control), the
existing target picker/share/market plumbing.

## Verdict strings

en/de/ja verbatim in the doc (LEDGER_L / LADDER_L up-mode); fr/ko/zh authored at port
time. Templates: badge `{n}`, head `{t}`, sub `{thr}`, upHead/upSub `{t}`,
upMultiple/multiple `{n}`, vendor-saves flag `{diff}`.
