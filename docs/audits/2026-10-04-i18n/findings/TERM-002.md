# TERM-002: The Glamour list privacy note says edits are kept "for this outfit"; they are kept per piece of gear
**Tier:** P2 · **Locale(s):** en de fr ko zh (ja is right) · **Deploy unit:** apps/web-app · **Term source:** the code: `shared/acquisition-edits.ts` keys edits per piece of gear · **Origin:** MAIN

## Location
- `apps/web-app/src/locales/en.json:1412` `glamour.sheet.privacy` — "Edits are kept on this device for this outfit."
- de "für dieses Outfit", fr "pour cette tenue", ko "이 복장별로", zh "按这套装扮"; ja "この装備ごとに" (per piece)

## Evidence
- `acquisition-edits.ts:5-9,30` keys each edit by `gearHash(slot, family row, stains)`, so an edit follows the piece into any outfit. "Reset all" deleting an outfit's edits (`PRIVACY.md:61`) is accurate and is not part of this.
- The four translations that followed "outfit" also used words the dictionary does not (de Outfit, ko 복장).

## Fix
- en "Edits are kept on this device for each piece of gear."; re-render de, fr, ko and zh; ja stays.

## Status
OPEN
