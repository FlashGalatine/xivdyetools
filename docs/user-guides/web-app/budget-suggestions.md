# Budget Suggestions

**Find affordable dye alternatives**

Budget Suggestions prices a dye's colour, line by line. Pick the dye you want, and it lists every dye that looks close enough, grouped by what each group costs, with live market prices from Universalis where they matter. The question it answers is "Jet Black costs 178,400 gil — what looks the same for 216?"

In 5.0 the tool is a **ledger**: there is no gil cap to set. You set how much colour drift you will accept and read down the list.

---

## How to Use

### 1. Pick a target dye

Any of these makes a dye the target:

- **Color Palette drawer** - open the palette button and click a dye (or enter a hex under **Custom Color** to price a colour that isn't a dye)
- **Quick Picks** - the grid at the top of the flow, under **TARGET DYE**, shows the six priciest market-only dyes on your world right now, labelled **PRICIEST ON {world} NOW**; tap one
- **A ledger row** - clicking any substitute makes it the new target, so you can walk down the price ladder
- **From other tools** - **Inspect Dye in… → Budget** on any result card

The target fills the small colour card under **TARGET DYE** (name, hex and price) and appears again below as a full result card with **CURRENTLY SELECTED** on it.

### 2. Set the match line

The **Match line** slider (2–20, default 8) sits above the ledger, and again in the settings column. It is the only threshold. It is ΔE2000 — how far a substitute may drift before it stops counting. Everything at or under the line makes the ledger; everything above it is left out. The description under the slider says exactly that: *"How far a substitute may drift before it stops counting."*

If you change **Matching Algorithm** in the settings column to something other than ΔE2000, the slider greys out and the line pins to that method's own calibrated cut instead.

### 3. Read the verdict

Above the ledger sits a verdict block:

- A badge — **{n} IN RANGE** when prices are loaded, **MARKET DATA UNAVAILABLE** when Universalis didn't answer, **ALREADY THE FLOOR** when the target is already the cheapest thing there is
- A headline: *"What {target}'s colour is worth, line by line."*
- A money figure on the right — **PER ΔE POINT, BEST ROW** (see below) or **CHEAPEST KNOWN · VENDOR**

### 4. Read the ledger

Substitutes are grouped into up to four price tiers, in this order:

| Tag | Group | What it costs |
|-----|-------|---------------|
| **STANDARD** | Standard Spectrum Dye | 216 gil from a vendor — always known, plus the market board price of the shared item |
| **WIDE #1** | Wide Spectrum #1 Dye | 100 Skybuilders' Scrips locally; the board price is the only gil figure |
| **WIDE #2** | Wide Spectrum #2 Dye | 600 Cosmocredits locally; the board price is the only gil figure |
| **COFFER** | Venture Coffers | No vendor at all — *"no vendor · market only"*; board price or nothing |

Each group prints its price **once**, in the header, with a count like **12 / 85** (matches in this tier / dyes in this tier), and:

- **×N CHEAPER** — how many times cheaper this tier is than your target
- **VENDOR SAVES {diff} vs BOARD** — on the Standard tier, when someone is listing the vendor item above 216 gil
- *"Nothing in this tier is within the match line."* — when a tier has no matches

Under each header the rows: **DYE | ΔE | BOARD | GIL / ΔE**. Click a column header to sort by it, click again to flip the direction. On narrow phones the BOARD column drops out.

**GIL / ΔE** is the tool's own value measure: the target's price minus the row's price, divided by the row's distance — what one point of colour accuracy is worth on this row. Bigger is better value. The note under the ledger spells it out: *"It is a ratio of this tool's own numbers, not a published measure."* It only appears when the algorithm is ΔE2000 and both prices are known.

Currencies are never converted. A scrip dye is compared to a gil dye through the market board price of its Wide Spectrum item, or not at all.

### 5. Send it on

Under the target card is a **SEND TO** row:

- **Harmony** / **Compare** — open the target in those tools
- **Copy item name** — copies the name you'd type into the market board search (for a Standard, Wide #1 or Wide #2 dye that is the shared item name, e.g. "Standard Spectrum Dye")
- **Save swap** — stores the target and its cheapest priced substitute on this device (*"Swap saved to this device."*); see [Favorites & Collections](favorites-collections.md)
- **Share** — a link that reopens this target and match line

---

## Upgrade Mode

Pick a Standard Spectrum dye — Soot Black, say — and the ledger flips. The badge reads **ALREADY THE FLOOR**, the headline *"Nothing is cheaper than {target}."*, and the money figure is 216 Gil labelled **THE FLOOR** — *nothing below this*. Instead of cheaper substitutes, the tiers below show what more money would buy: Wide #1, Wide #2 and Coffer dyes within the line, each with **×N more**.

---

## Server Selection

Board prices come from the **Market Board** section of the settings column (the gear icon on phones): choose your data centre or a single world. Vendor, scrip and credit figures are stored in the app and never need a connection.

---

## When the Market Is Down

If Universalis doesn't answer, the verdict turns amber with **MARKET DATA UNAVAILABLE**. Vendor and scrip costs are still shown; board prices are dashed; the Coffer tier cannot be priced at all, and Quick Picks reads **MARKET-ONLY DYES · NO PRICES OFFLINE**. Everything comes back on the next successful fetch.

---

## Understanding Delta E

The **ΔE** column is the colour distance between the substitute and the target. On the ΔE2000 scale used here:

| ΔE2000 | Meaning |
|--------|---------|
| 0-1 | Virtually identical |
| 1-2 | Very close, minor difference |
| 2-5 | Reads as the same dye on armour |
| 5-10 | Noticeable side by side |
| 10+ | Visibly different |

Row values are tinted on the same green-to-red ramp as the other tools' match tiers.

---

## Tips

- **Start at 8** - the default line is where most substitutes are still hard to tell apart on cloth
- **Sort by GIL / ΔE** - the top row is the best deal per point of accuracy, not just the cheapest
- **Click a row** - it becomes the target, so you can check what *its* cheaper neighbours are
- **Exclude Coffer Dyes** in **Dye Filters** if you only want things you can buy without a market board
- **Test in-game** - some differences matter more on metallic gear than matte

---

## Related Tools

- [Palette Extractor](palette-extractor.md) - Find dyes first
- [Dye Comparison](dye-comparison.md) - Put the target and a substitute head to head
- [Favorites & Collections](favorites-collections.md) - Where saved swaps go
- [Community Presets](community-presets.md) - Palettes with a cost note
