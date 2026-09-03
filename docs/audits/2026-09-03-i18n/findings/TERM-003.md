# TERM-003: web-app's German "metallic" is `Metallisch`, core's and the bot's is `Metallic`
**Tier:** P3 · **Locale(s):** de · **Deploy unit:** web-app · **Generated?** no

## Location
- `apps/web-app/src/locales/de.json` — `colorPalette.metallic = 'Metallisch'`
- `packages/core/src/data/locales/de.json` — `labels.metallic = 'Metallic'` (the authority)
- `packages/bot-logic/src/i18n/locales/de.json` — `preferences.filters.labels.metallic = 'Metallic'` (agrees with core)

## Evidence
- `evidence/vocab-split.txt` — the only surviving row in the `labels.*` family once the false pairings are removed. Its sibling `colorPalette.pastel = 'Pastell'` already matches core exactly, which is what makes the metallic row look like drift rather than a deliberate register choice.
- The 2026-08-20 web-app audit moved harmony / vision / category labels onto core getters (TERM-003…005 there); the two dye-property labels `metallic` / `pastel` were not part of that sweep.

## Fix
- Either render this label through core (`LocalizationService.getLabel('metallic')`, matching how the harmony and vision labels were fixed) and drop the local key, or align the string to `Metallic`.
- Low stakes — both spellings are comprehensible German. Worth doing with the other vocabulary work, not on its own.

## Status
FIXED 2026-09-03 0e61574d — de `colorPalette.metallic` → `Metallic`, matching core and the bot; allow-listed with a reason
