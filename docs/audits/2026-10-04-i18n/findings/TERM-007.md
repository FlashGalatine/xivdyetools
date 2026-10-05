# TERM-007: The facewear color tag says "glasses" in de, fr and zh, beside a slot that says facewear
**Tier:** P2 · **Locale(s):** de fr zh · **Deploy unit:** apps/web-app · **Term source:** dictionary *Equipment Slots*: Facewear = Gesichtsaccessoires / Accessoires de visage / 面部配饰 · **Origin:** MAIN

## Location
- `swatch.facewearColorTag` / `facewearColorUnknown`: de "Brillenfarbe" (`de.json:1262-1263`), fr "couleur de lunettes" (`fr.json:1262-1263`), zh "眼镜颜色" (`zh.json:1262-1263`)
- `swatch.facewearSlot` (:1261): Gesichtsaccessoires / Accessoires de visage / 面部配饰

## Evidence
- en says "facewear color", and ja and ko transliterate "facewear". The slot was renamed on main (de was "Brille" at the last audit) and the two tag keys were not.

## Fix
- Use the slot's word in both keys, e.g. de "Farbe des Gesichtsaccessoires".

## Status
OPEN
