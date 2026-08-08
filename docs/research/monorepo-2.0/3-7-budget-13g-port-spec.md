# 3.7 — /budget 13G Ledger (bot graphics 5.0)

Port spec distilled 2026-08-08 from `Bot Graphics Directions 3.dc.html` (§/BUDGET, the
13G drawing + the three method frames) and `Budget Chip Rework.dc.html` (header chip,
option **1a CONFIRMED 2026-08-07**). The web-side model was settled by 9C
(`9c-ledger-port-spec.md`, landed 2.6d) — 13G is its first bot drawing, marked
**MODEL CONFIRMED**.

## The model (all confirmed)

- **Tier groups carry the single price; rows underneath are priceless.** A
  consolidated dye has no listing of its own to print — a per-dye price inside a
  Spectrum group would be an invented number repeated N times. The price lives in the
  group header and nowhere else.
- **Group = one price source.** `A`/`B`/`C` groups key on their consolidated item
  (52254/52255/52256); a board-only dye (coffers etc.) keys on its own itemID, so a
  "group" of board-only dyes is per-dye by construction — every printed price is a
  real listing. Group labels: A/B/C use the **verbatim EN Spectrum item name** (the
  3.1 rule: `CONSOLIDATED_DYES[type].names.en`); board-only groups use the localized
  acquisition (`getLocalizedAcquisition`).
- **Pricing per group** (the web 9C rules, replacing the `getBudgetComparablePrice`
  defect class — the bot pipeline's own version was raw-RGB distance + a
  `(distance*2 + price/1000)` value score + per-dye prices for consolidated dyes):
  - `A`: vendor 216 gil (the only number in the tool that cannot move) vs the board
    price of 52254 — group price is the min; **vendor-undercuts flag** when
    216 < board. Offline, price stays 216 (vendor is local), no flag.
  - `B`/`C`: the consolidated item's board price is the **only gil figure** — the
    scrip/credit vendor cost is a different currency and is **never converted**
    (600 Cosmocredits is not 600 gil; that bare-int comparison was the root defect).
    Offline → group price null.
  - Board-only: own listing or null.
- **gil-per-ΔE = (targetPrice − rowPrice) / max(ΔE, 0.1)`, PINNED to ΔE2000**
  whatever the `matching` option says (the method frames' own finding: the ratio
  changes magnitude with the unit and is comparable across none — same pin as the
  Result Card). Default sort: gil/ΔE descending.
- **Blanks, never inventions.** No target price (coffer target offline, or coffers
  excluded with a coffer target) → no numerator → the ratio column prints `—` and
  the embed says so; rows fall back to tier-then-distance order (tier order
  A→B→C→board-only — Standard first, the 2.6d user decision). Group price unknown →
  `—` in the header, row kept.
- **Exclusions remove whole GROUPS (path, not price):** `exclude_coffers`
  (acquisition = Venture Coffers — gacha, no purchasable source) and
  `exclude_wide_spectrum` (types B + C — a different acquisition path whose single
  board listing stands in for 9/11 dyes). The excluded **target is allowed** —
  exclusion filters candidates only. The ledger may end with one group or none.
- **Already the floor:** when the target is priced and nothing undercuts it (e.g.
  target is type A at 216), the honest answer is a sentence, not an empty frame —
  the handler sends a text embed (`card.budgetFloor`) and no image.
- **Method switch** (`matching` option > user pref > ΔE2000): drives the ΔE column's
  values, its width (34px → 42px for 3-digit methods: RGB DIST/REDMEAN/DISTINGUISH),
  its tier tones (`classifyBandTier(de, method, 'match')`) and the **generated footer
  legend** — a second key line appears off-ΔE2000 saying the ΔE column's unit and
  that the ratio stays ΔE2000. Match line (`max_distance`, 2–20, default 8) only
  moves the candidate net under ΔE2000; other methods pin to their calibrated MATCH
  middle cut (`BAND_VOCABULARY.match[m].cuts[1]`) per the three standing band rules.
  DISTINGUISH's integer rounding creates ties: tied rows go **amber** and the sort
  falls back to ΔE2000 beneath the displayed value.

## 13G geometry (400 × 350 dark, drawn values)

- Header (pad 13 top / 15 sides): 30×30 target swatch r8 · `lTarget` 11px mono
  0.8 tracking over name 14px body 600 (flex, ellipsis) · **command chip inline,
  centre of the row** (1a: standard pill, `b.budget` glyph 13px, `/BUDGET`, zero
  height cost — takes the name column's slack) · right column: `targetPriceStr`
  13.5px mono over `lBoardOnly`/`lVendor` 11px mono.
- Column header: 40px spacer · `lCandidate` flex · `ΔE` 34px right · `GIL/ΔE` 68px
  right (all 11px mono labels).
- Group header (~24px): full-width wash rgba(255,255,255,0.045) + top hairline ·
  tier 11.5px mono value-ink ellipsis · optional green flag pill (11px on
  rgba(91,189,104,0.14)) · price 12px mono right.
- Row (40px): top hairline · 40×28 swatch r7 · name 13px body 600 (198px — sized
  against Johannisbeerenvioletter, 23ch DE, no truncation) · ΔE right in tier tone
  12.5px mono · perDe right 12.5px mono.
- Footer: generated key line(s) 11px mono left · markFooter right. Height rounds to
  an integer; rows are capped by pixel budget (group header 24 + row 40 must fit
  under 350 with header 43 + colhead 26 + footer), max `ROW_CAP` 5 rows; omitted
  rows are named in the embed (`card.nearestMore` pattern).

## Decisions recorded at port time

- The old `/budget find` options `max_price`, `sort_by`, `max_results` are **cut**:
  the ledger's sort *is* the ratio (a PNG can't re-sort), and the row cap is the
  frame's. `max_distance` survives as the match line (2–20, default 8, ΔE2000
  units — was 0–100 raw-RGB). New options: `matching` (suite list), `exclude_coffers`,
  `exclude_wide_spectrum`. Schema change → **user-run register-commands**.
- `findCheaperAlternatives` (raw-RGB + value score) is replaced by
  `findBudgetLedger` in `services/budget/budget-calculator.ts`; the dye-lookup
  utilities and the price cache/universalis client are untouched.
- svg `budget-comparison.ts` (+ its AA-era labels, quality ladder, formatGil) is
  deleted; `budget-ledger.ts` (generateBudgetLedger) replaces it on the frame
  system. Tier classification happens **upstream** (handler knows the method);
  the generator takes tier indices + pre-formatted strings.
- Header strings confirmed ×4 from the chip doc (EN/DE/FR/JA:
  TARGET/ZIEL/CIBLE/目標 · board only/nur Markt/marché seul/市場のみ); KO/ZH and the
  remaining keys authored at port time (doc-3's data script is beyond the 256 KiB
  get_file cap — same as 3.4).
- `/budget quick` keeps its subcommand and flows through the same ledger with
  defaults.
