# DEAD-033: KEEP CharacterColorService, interface sheets, build-character-colors script, .chara fixtures, chara-models helpers
**Confidence:** HIGH · **Blast radius:** HIGH · **Deploy unit:** core · **Semver:** MAJOR · **Category:** Legacy
**Calibration:** Semver NONE->MAJOR: CharacterColorService is a core barrel export (index.ts:45), as are gearModelKey/weaponModelKey, so any removal under its triggers is MAJOR. This matches the convention used for D30-D33 that a KEEP row carries its removal's semver.

## Location
- `packages/core/src/services/CharacterColorService.ts`
- `packages/core/src/data/character_colors/{shared,race_specific,shader}/*.json + index.json`
- `packages/core/scripts/build-character-colors.ts + packages/core/package.json:32`

## Evidence
- git grep -w CharacterColorService (non-test): og-worker character-cells.ts:18,29 (getRaceSpecificColors :66, getSharedColors :68); web-app swatch-tool.ts:28,387, chara-inspection-service.ts:27,83; bot-logic chara-identity.ts:11,28; core chara-palette-provider.ts:89-91. members.py: all 14 methods extSrc>=1. CharacterColorService.ts:63-69 static-imports shared/*.json, :182,:209 dynamic-import race_specific. chara-models exports: isWornCharaModel/isCharaWeaponSlot api-worker router.ts:20,117,121; CHARA_SLOT_SEARCH_FIELD, charaModelKey, formatCharaModelLabel used in api-worker/web-app/bot-logic; gearModelKey/weaponModelKey/CHARA_WEAPON_SLOTS are /** @public */ (index.ts:205-210), called internally by charaModelKey…
- Every piece has a production consumer or a deliberate contract: CharacterColorService and its interface sheets feed og-worker, web-app Swatch, the inspection worker, bot-logic and core's palette provider; the script is the only sanctioned way to regenerate those sheets from human.cmp (never hand-edited); chara-models helpers are used by api-worker /v1/chara/resolve, web-app and bot-logic, and the three without external callers are @public published API of core 5.15.0 used internally by charaModelKey, so de-exporting would be MAJOR with zero lines saved. The fixtures are test data for core, web-app and parity tes…
- Still live: apps/og-worker/src/services/character-cells.ts:29,66,68; apps/web-app/src/components/swatch-tool.ts:387; apps/web-app/src/services/chara-inspection-service.ts:83; packages/bot-logic/src/commands/chara-identity.ts:28; apps/api-worker/src/chara/router.ts:20,117,121

## Fix
- **KEEP** — revisit trigger: Fixtures: revisit when the core 6.0.0 release that removes parseCharaFile/resolveCharaColors (core-legacy-03) lands AND `git ls-files | xargs grep -l 'fixtures/.*\.chara\|lalafell-dunesfolk'` returns no test in packages/core, packages/bot-logic, apps/web-app or apps/discord-worker. Script + sheets: revisit only if production switches to xivcharakit's createDefaultPaletteProvid…
- Cascade: None. Removing the legacy parser/resolver (core-legacy-03) leaves CharacterColorService, the sheets and the chara-models helpers live via the palette provider, og-worker, web-app and api-worker.
- Published: core 5.15.0 == npm latest; gearModelKey, weaponModelKey, CHARA_WEAPON_SLOTS, CharacterColorService and the other chara-models helpers are public exports, so any removal or de-export is MAJOR.

## Status
OPEN
