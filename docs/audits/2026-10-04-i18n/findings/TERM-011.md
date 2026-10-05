# TERM-011: og-worker's French deck still calls Community Presets "Palettes Communautaires"
**Tier:** P2 · **Locale(s):** fr · **Deploy unit:** apps/og-worker · **Term source:** web `fr.json:71` tool title · **Origin:** MAIN

## Location
- `apps/og-worker/src/services/og-strings.ts:75` vs `apps/web-app/src/locales/fr.json:71` "Préréglages communautaires"

## Evidence
- The web title was renamed on main (`7ce6830c`) and the deck was not; `OG_DECK` must quote the web titles.

## Fix
- Set the fr `OG_DECK` presets name. Latin only (no CJK re-cut); bump `CARD_VERSION` with the og-worker sprint.

## Status
OPEN
