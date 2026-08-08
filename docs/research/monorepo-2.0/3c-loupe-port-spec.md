# 3C Loupe — Palette Extractor port spec (distilled from the design project)

Source: `Extractor Tool Directions.dc.html` (Turn 3, fetched 2026-08-08) +
`ExtractorScreen.dc.html` + `SampleImage.dc.html`. CONFIRMED: **3C Loupe is the
Extractor spec; 3A (Contact sheet) and 3B (Dominance bar) stay as the record.**
Everything confirmed on Harmony carries over unchanged (Console theme, Ticket cards,
2B title selector, Advanced accordion with scope badges).

## The position 3C takes

The algorithm's six dominant colours are usually not the six you want — glamour is
about the pauldron, not the sky behind it. So **sampling is the default**: drag the
loupe anywhere on the image and it reads the real pixels underneath, naming the nearest
dye as you go; the **+ tile commits** whatever the loupe currently holds and a new
Ticket appears. **Bulk extract survives as one button** (Auto-extract) that fills the
roll for you. Curated, not extracted. Highest ceiling of the three — the one direction
that needs a real tutorial.

## Layout (3C frames)

1. **Image hero**: the uploaded image, uncovered. Loupe interaction: click to sample ·
   drag for a region (mobile: tap to sample). While dragging, a floating chip shows
   `#HEX · nearest dye name` live.
2. **Palette roll**: the committed picks as a strip — each pick a small tile;
   auto-extracted picks carry their dominance percentage; the **+ tile** commits the
   loupe's current colour. Clear per-pick and Clear-all.
3. **Auto-extract** button: runs the existing K-means fill (colours-to-extract count +
   vibrancy boost remain the knobs: "Dominant colours pulled from the image." /
   "Favour saturated colours over greys").
4. **Tickets** below: one Result Card per pick (image colour → nearest dye, real ΔE),
   full confirmed field set.
5. **Drop zone / empty state**: PNG/JPG/WebP/GIF up to 20 MB; paste with Ctrl+V; mobile
   offers Take a photo / Choose from photos. Privacy line on the card: "Images are
   read in your browser and never uploaded."
6. Export CSS in the header (shared with Gradient).

## Deltas vs the shipped tool (work list)

- The loupe: pointer sampling on the image preview (read canvas pixels; drag = average
  the dragged region), live floating chip with hex + nearest dye, commit to roll via
  + / release. The shipped tool only bulk-extracts.
- The roll: today results are only the K-means set; the roll makes picks first-class
  (sampled and auto-extracted mixed), each backed by a Ticket.
- Auto-extract demoted from the only flow to one button.
- Strings: full UI block verbatim en/de/ja (drop copy incl. paste + camera, sampling
  hints, roll/addPick/autoExtract, privacy); fr/ko/zh authored. The privacy line
  wording is the model the 10A file card reused — keep them consistent.
- v4-shell reality: one main flow; inline styles for non-Lit content.

## Register notes

- Phase-1 already retitled the tool (Palette Extractor ×6, FR Nuancier collision
  resolved) — titles are NOT re-landed here.
- Camera capture exists (camera-service + 2.3's 88% full-bleed modal) — the mobile
  Take-a-photo path wires to it, not a new capture flow.
