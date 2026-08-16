# Dye Comparison

**Compare up to 4 dyes side-by-side**

The Dye Comparison tool puts two dyes head to head and gives you a straight answer: are they the same colour, can one stand in for the other, or are they clearly different — and if they tie, which one is cheaper. Load up to four dyes; the tool pairs them off and you pick which pair to look at.

> **Note**: In the 5.0 tool rail this is the **Compare** chip; the tool menu lists it as **Dye Comparison**.

---

## How to Use

### 1. Load dyes

Open the **Color Palette** drawer (the palette button; on phones it starts closed) and click dyes. Up to **four** slots fill; a fifth pick pushes the oldest one out. **Custom Color** in the drawer adds an arbitrary hex, so you can measure a dye against a colour that isn't one. Other tools send dyes here through **Inspect Dye in… → Comparison**, the **SEND TO** rows, and a preset's **TAKE THIS PALETTE INTO** row.

With nothing loaded you see four dashed **Add Dye** slots and *"Select at least 2 dyes to compare"*. With one dye loaded, its card is shown on its own under **Selected Dyes**; the comparison starts at two.

### 2. Pick a pair

Above the workspace, a row of **pair chips** — one for every pair the loaded dyes make (one chip for two dyes, three for three, six for four), **closest first**. The heading reads **This pair** or **All 6 pairs**; each chip shows the two swatches, the two names and their distance in the current unit. Two chips that print the same value carry a **TIE** badge. The closest pair opens by default; click any chip to switch.

### 3. Read the duel

The chosen pair fills the workspace as a **split panel** — one dye per half, the distance and its unit in a badge across the middle — followed by:

**The verdict.** A badge, a headline and a line of explanation:

| Badge | Headline | When |
|-------|----------|------|
| **SAME COLOUR** | *"{A} and {B} are the same colour."* | Under the match line — *"Nobody will see the difference on a chest piece — so this is a price question, not a colour one."* |
| **SUBSTITUTABLE** | *"{A} can stand in for {B}."* | *"Side by side you can just about tell; at arm's length, on cloth, you cannot."* |
| **DIFFERENT** | *"{A} and {B} are clearly different."* | *"These read as two different dyes at any distance."* |

When both dyes have a vendor price the verdict adds a **cost line**: *"{cheaper} is the cheaper of the two by {saving}."*, or *"Both cost the same from the same source, so there is nothing to save here."* If only one is sold by a vendor: *"{A} is a vendor dye; {B} has no vendor price and has to be found."*

**What actually differs.** Five rows, both values and the gap between them:

- **LIGHTNESS** — Lab L*, with the sign showing which way B sits from A
- **SATURATION** — percent
- **HUE** — degrees around the wheel
- **VENDOR** — gil price where there is one; a market-only dye prints a dash rather than a fake number
- **SOURCE** — where each dye comes from, marked **same** or **differs**

**The same pair, 6 methods.** Seven readouts for the one pair. The first six are the matching methods, each with its value and a tier word — **SAME · CLOSE · NEAR · FAR**:

| Method | What it is |
|--------|------------|
| **ΔE2000** | Perceptual distance — the suite's standard |
| **ΔEOK · OKLab** | OKLab distance, printed raw |
| **ΔE76 · CIE 1976** | Straight-line Lab distance, the older formula |
| **Redmean · weighted RGB** | RGB with the channels weighted by how red the pair is |
| **RGB distance** | Straight-line distance in the RGB cube (0–441.67) |
| **Distinguishability %** | The same RGB distance as a percentage — the number the Accessibility Checker uses |

Tap a method row and it becomes the tool's method — the chips re-sort, the split badge and verdict switch to it, and every tier word is that method's own calibrated cut, never ΔE2000's number under another name. The seventh readout, **RATIO**, sits last after a rule: the WCAG contrast ratio of the pair. It is not a colour difference, so it carries no tier word.

The **ⓘ** beside **What actually differs** opens the method help: the current method's plain-language definition, its caveat, a **PERCEPTUAL / APPROXIMATE / NOT PERCEPTUAL** badge, a switcher for the six methods, and a link labelled **How colour difference is measured**.

**This pair — each measured against the other.** Two mirrored full-size result cards, one per dye, each showing the other dye's colour as its reference and their ΔE2000. The cards keep price and source visible — once the colours tie, that is the decision. **Remove** on a card takes that dye out.

**Also loaded.** When you have three or four dyes, the ones not in the duel wait on a bench of chips under the cards. Click one to swap it in as the second half of the pair.

### 4. Settings

In the settings column (the gear icon on phones):

- **Match line** (1–15, default 5) — the ΔE2000 value under which a pair is called **SAME COLOUR**; the verdict quotes it (*"the match line sits at ΔE 5"*). Other methods keep their fixed cut.
- **Display options** — which colour values and readouts the cards print
- **Market Board** — turn prices on and choose your data centre or world; the duel refreshes when prices arrive

---

## Export and Share

The header row over the loaded dye carries **Export** — the export sheet with the loaded dyes as CSS custom properties, SCSS, JSON, plain HEX or a Tailwind theme, each entry annotated with the dye's name and number — and **Share**, which copies a link that reopens the same dyes. Custom hex colours have no dye behind them and are left out of the link.

---

## Understanding the Tiers

The tier words are calibrated per method, so a **CLOSE** in ΔEOK means the same thing as a **CLOSE** in ΔE2000 even though the numbers differ. On the ΔE2000 scale:

| ΔE2000 | Tier | Meaning |
|--------|------|---------|
| under the match line (5 by default) | SAME | Reads as the same dye on armour |
| up to 10 | CLOSE | Tell them apart side by side, not at arm's length |
| up to 20 | NEAR | Two different dyes, in the same family |
| beyond 20 | FAR | Two different dyes at any distance |

---

## Use Cases

### Outfit Planning
1. Load your top candidates for one piece
2. Read the chips — anything **SAME COLOUR** collapses to a price question
3. Use the bench to cycle the fourth option in

### Similar Dye Investigation
1. Load both dyes
2. Read the verdict; check **What actually differs** to see whether it is lightness or hue that separates them
3. Tap the other methods to see how much of the gap is the formula rather than the colour

### Category Exploration
1. Load a few dyes from one family (all the greys, say)
2. The chips sort them closest-first for you
3. Pick the exact shade you want, then **Export** the set

---

## Tips

- **Closest first** - the default pair is always the two most alike; scan the chips for the biggest number to find the odd one out
- **TIE badges** are common under Distinguishability % — its whole numbers round together
- **RATIO is for readability**, not for colour — use it when the two dyes will sit as text on background
- **The cost line only knows vendor prices** - for market-only dyes, take the pair to [Budget Suggestions](budget-suggestions.md)

---

## Related Tools

- [Palette Extractor](palette-extractor.md) - Find dyes to compare
- [Budget Suggestions](budget-suggestions.md) - Price a substitute properly
- [Accessibility Checker](accessibility.md) - The same pair under every lens
- [Community Presets](community-presets.md) - **TAKE THIS PALETTE INTO → Dye Comparison** loads a preset's first four dyes
