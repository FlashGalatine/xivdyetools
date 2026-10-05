# TERM-005: German `glamour.fact.dye` "FARBE ×{n}" says color where it means dye
**Tier:** P2 · **Locale(s):** de · **Deploy unit:** apps/web-app · **Term source:** house register: German dye = Farbstoff, never Farbe · **Origin:** MAIN

## Location
- `apps/web-app/src/locales/de.json:1390` (en "DYE ×{n}")

## Evidence
- Sibling keys already say "Farbstoffe" (:1372).

## Fix
- "FARBSTOFF ×{n}".

## Status
OPEN
