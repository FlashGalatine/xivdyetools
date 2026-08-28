# Swatch Matcher

**Match character colors to FFXIV dyes**

The Swatch Matcher finds the FFXIV dyes closest to your character's customization colours — hair, eyes, skin, highlights, lips, tattoos and face paint. Pick a swatch from the same colour sheets the character creator uses, or drop in a `.chara` file and read every colour on your character at once.

> **Note**: This tool was called "Character Color Matcher" in v3.x. In the 5.0 tool rail it is the **Swatch** chip; the tool menu lists it as **Character Matcher**.

---

## Two Ways In

### Pick a swatch from the grid

The colour sheet on the left is the character creator's palette, eight swatches to a row. Click any cell and its closest dyes appear on the right. Nothing else is required — tribe and gender only matter for the two race-specific sheets (hair and skin).

### Drop a `.chara` file

Above the grid is a **Drop a .chara file** zone (or press **Choose file**). It accepts character files exported by **Anamnesis, Ktisis or Brio**. The file is read entirely on your device — nothing is uploaded, and the screenshot some tools embed in the file is never opened. When it loads:

- A **CHARACTER FILE** card shows which tool made it, your character's name, a **LOCAL ONLY** chip, and the tribe and gender it found. **SWAP** loads a different file.
- The **TRIBE & GENDER** selectors in the settings column become a read-only readout, so hair and skin are looked up on the right sheet automatically.
- Any problems reading the file are listed on an amber warnings card rather than hidden.

---

## The Colour Sheets

A row of chips above the grid switches between seven palettes:

**Eye · Hair · Highlights · Skin · Tattoo / Limbal · Lips · Face paint**

Lips and Face paint have a **Dark / Light** toggle beside the chips — the same one control the game gives you, with two ranges. The header above the grid names the sheet and how many swatches it holds.

| Palette | What it covers |
|---------|----------------|
| **Eye** | Iris colours |
| **Hair** | Hair colours for your tribe and gender |
| **Highlights** | Hair highlight colours |
| **Skin** | Skin tones for your tribe and gender |
| **Tattoo / Limbal** | Limbal rings and racial tattoos |
| **Lips** | Lip colours (Dark or Light range) |
| **Face paint** | Face paint colours (Dark or Light range) |

Every swatch has a grid address — **R3·C5** means row 3, column 5, counted the way the sheet is laid out in the creator — so you can find it again in-game.

**Available tribes** (for hair and skin): Hyur (Midlander, Highlander), Elezen (Wildwood, Duskwight), Lalafell (Plainsfolk, Dunesfolk), Miqo'te (Seeker of the Sun, Keeper of the Moon), Roegadyn (Sea Wolf, Hellsguard), Au Ra (Raen, Xaela), Hrothgar (Helions, The Lost), Viera (Rava, Veena).

### Evercold notice

The Eye, Hair and Skin sheets carry a note: *"Evercold (January 2027): preset palettes are being retired."* Those three are switching to a free colour picker in the Evercold expansion, and the preset swatches here will be replaced by a picker when it launches. The other four palettes are not affected.

---

## Reading the Results

### The selection card

Picking a swatch (or a character slot) writes one plain sentence — which palette and cell you chose, the closest dye, and how far away it sits — followed by **IN THE CREATOR**: a five-row excerpt of the sheet centred on your cell, with the row and column numbers highlighted so you can match it against the game.

### CLOSEST DYES

The best matches, one card each, ranked by colour distance. Each card shows the dye swatch beside your colour, the distance in the current unit (ΔE2000 by default — see below), the hue and stain readouts, and the dye's colour values, source and cost. The **⋮** menu on a card offers **Inspect Dye in…** (Harmony, Budget, Accessibility, Comparison), **Transform Dye in…** (Gradient, Mixer) and **Open in browser…** (Universalis, GarlandTools).

Settings for the list live in the settings column (the gear icon on phones): **Max Results** (1–6), **Matching Algorithm**, display options, and the dye filters (exclude metallic, pastel, dark, cosmic, coffer, vendor, crafted…).

### SEND TO

At the bottom of the flow a row of buttons sends the matched dyes on to **Color Harmony Explorer**, **Dye Comparison**, **Gradient Builder** or **Accessibility Checker**.

### Share

**Share** copies a link that reopens this exact cell — the link carries the sheet and the cell's position (plus tribe and gender for hair and skin), not just the colour, so it lands on the right swatch even when two cells share a shade.

---

## With a Character File Loaded

### THIS CHARACTER

One card per colour slot: **Left eye, Right eye, Hair, Highlights, Skin, Tattoo, Limbal ring, Lips, Face paint**. Each card shows the colour, its grid address (or an amber **OFF GRID** tag when the file holds an arbitrary colour that has no cell), and the closest dye with its distance. Slots the file doesn't set stay as dashed placeholders with the reason — for example *"Highlights are switched off in this file"* or *"On Hrothgar this field is a fur pattern, not a colour."*

Lips get special handling: the game draws the lip colour over the skin, so the card shows the **BLEND** you actually see and matches dyes to that, not to the raw cell.

Click a slot card to make it the selection: the sentence and excerpt follow it, and the grid switches to that slot's sheet with numbered **pins** marking where each of your character's colours sits (two colours on one cell share a pin, e.g. **1·2**).

**Save character colours** stores the closest dye for every slot as a set on this device (see [Favorites & Collections](favorites-collections.md)).

### DYES ON THIS GLAMOUR

Below the matches, the dyes your character's gear is wearing — both dye channels per piece — appear as chips, with a count of channels and distinct dyes. Undyed pieces are noted, not scored. Press **Make a palette** to turn them into a preset: toggle chips off to drop dyes, give it a name, and either **Save to this device** or **Submit to Community**. Both buttons stay disabled until you have between **3 and 6** dyes.

---

## Reverse Matching

Pick any dye in the **Color Palette** drawer (or enter a hex under **Custom Color**) while the Swatch Matcher is open and the grid lights up the three closest swatches on the current sheet, ranked by glow. A **Closest Swatches** panel lists them; clicking one runs the normal forward match. Other tools' **Inspect Dye in… → Swatch Matcher** lands here the same way.

---

## Why Match Character Colors?

### Coordinate with Your Character
Find dyes that match your character's:
- **Hair color** for seamless wig/hat coloring
- **Eye color** for accessories and accents
- **Skin tone** for natural-looking gear

### Create Themed Glamours
Build outfits that complement your character's features:
1. Match a dye to your hair color
2. Use it for chest piece accents
3. Create a cohesive look

### Planning Before Character Creation
If you're making a new character:
1. Browse available colors per tribe
2. See what dyes would match each option
3. Plan your glamour before committing

---

## Market Board Integration

Turn on **Market Board** in the settings column to see current prices on the matched dye cards for your data centre and world.

---

## Tips

- **Some colors have no exact match** - FFXIV dyes don't cover every possible shade
- **Check multiple alternatives** - The 2nd or 3rd match might work better in-game
- **Lighting matters** - Colors appear differently in various zones
- **Test in-game** - Use the dye preview before committing
- **Use the address** - R·C is the same position you scroll to in the creator

---

## Understanding Delta E

Distances are ΔE2000 by default — the industry-standard measure of how different two colours look. You can switch the **Matching Algorithm** to ΔEOK, ΔE76, Weighted RGB (redmean), RGB or a 0–100 percentage; the unit printed beside **CLOSEST DYES** follows your choice.

| ΔE2000 | Meaning |
|--------|---------|
| 0-1 | Virtually identical |
| 1-2 | Very close, minor difference |
| 2-10 | Noticeable but similar |
| 10+ | Visibly different |

Lower scores mean better matches!

---

## Related Tools

- [Palette Extractor](palette-extractor.md) - Find dyes from any color
- [Color Harmony Explorer](color-harmony.md) - Build on your matches
- [Dye Comparison](dye-comparison.md) - Compare matched dyes
- [Budget Suggestions](budget-suggestions.md) - Find affordable options
- [Favorites & Collections](favorites-collections.md) - Where saved character colours and palettes go
