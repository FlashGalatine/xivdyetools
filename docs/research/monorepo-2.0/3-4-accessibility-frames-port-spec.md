# 3.4 — /accessibility (13D/13E/13H) + the /a11y alias

Source: `Bot Graphics Directions 3.dc.html` (Turn 13). NOTE: the doc exceeds
DesignSync's 256 KiB read cap — its trailing data script (per-language label
tables) is unreachable, so the card labels are AUTHORED ×6 per the register's
precedent (short forms, never truncations). `lRatioShort` (RATIO/VERH./比率,
for the /contrast unit) is confirmed in prose.

## The router (CONFIRMED)

The `vision:` option chooses the frame — nothing picks it for the user:
- **named lens → 13D** (400×330): 6A Lens made static — the pair repainted
  through one lens (left as designed, right as perceived, a real number
  between), the other lenses as a summary strip with untranslated codes
  (NORM/PROT/DEUT/TRIT/ACHR — identifiers, never localized).
- **vision:all (or absent, for a pair) → 13E** (grows ≤350): the pair under
  every lens, one row each; the normal row on top is the control; the
  collapse is visible as a shape before any digit is read. The per-lens note
  sits under the table (DE overran the rows) and names only the worst lens.
- **single dye → 13H** (grows ≤340): 13E's rows with the pair removed. NO
  tier colours and NO verdict — the number is a shift, not a risk; the bar
  is relative to the largest shift in the set (neutral ink). The simulated
  hex replaces prose: dye-agnostic, always true, pasteable into a matcher.

Achromatopsia stops being a special case — it is one of the five `vision:`
choices, because on the classic red/green pair it is the only lens that
finds a problem (Dalamud↔Hunter: 18.2/26.6/31.9 workable, achromatopsia
2.3). Verified live: the 13E render reproduces exactly those figures.

**Separation bands run the other way from match bands**: larger is safer.
Core's separation cuts ([8, 15, 30] ascending) classify normally; the
generator maps `tone = tiers[3 − tier]` so ≥30 reads green.

**The verdict sentence lives in the embed**, not the frame — at 13 px over
two lines it costs a lens row (`card.a11yVerdict` ×6: "Weakest under {lens}
— the pair sits {de} apart there.").

## /a11y (RESOLVED)

An alias with identical options and output. Discord has no alias mechanism,
so it is a **second registration** (schemas.ts shares `ACCESSIBILITY_OPTIONS`
between both entries; registry gains `a11y`; the router cases share the
handler) — and **the chip prints the command the user actually typed**
(`commandLabel` flows handler → execute → generator), so a reposted PNG
matches their history.

## Schema changes

/accessibility is now pair-based: `dye` + `dye2` + `vision` (with "All
lenses" as a choice). The dye3–dye6 contrast inputs are gone — WCAG contrast
moves to the /contrast command (13A/13B/13C·1 router, next unit). Brettel
simulation via `ColorService.simulateColorblindnessHex` (the shipped path);
separation = ΔE2000 between the two SIMULATED colours.

## Strings (authored ×6, `card.*`)

designed/perceived (AS DESIGNED / AS PERCEIVED …) · separationCol / lensCol /
shiftCol · sepBandKey ("bands: ≥30 / ≥15 / ≥8 — larger is safer") · soloKey
("bar = relative shift · carries no verdict") · worstNote ("weakest: {lens}")
· a11yVerdict. Plus `accessibility.achromatopsia` ×6 (was missing — the lens
existed only as dead code) matching the existing clinical naming style
(ja 1色覚（全色盲）, ko 전색맹, zh 全色盲).

## Register notes

- `generateAccessibilityComparison` no longer exported from the svg index
  (module kept for its `VisionType` types; full deletion rides the /contrast
  unit with `generateContrastMatrix`'s replacement).
- Still in Turn 13, for later units: /contrast router (13A 2 dyes / 13B 3 /
  13C·1 4, cap in schema, ratio+position derive from one number, one decimal
  place, `lRatioShort`), /budget 13G (replace `getBudgetComparablePrice`,
  group-level prices, exclusions, gil-per-ΔE pinned to ΔE2000, DISTINGUISH
  ties amber + sort fallback), the ♿ manual topic ×6 with per-language
  learn-more links (ZH renders the absent state), and the harmony
  method-frames correction (11A verdict claim was wrong; heights ≤350 —
  already satisfied by the 3.1 port).
