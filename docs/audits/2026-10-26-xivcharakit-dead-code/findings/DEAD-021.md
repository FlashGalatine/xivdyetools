# DEAD-021: Relocate live type contracts declared in chara-parser.ts / chara-resolver.ts
**Confidence:** HIGH · **Blast radius:** MEDIUM · **Deploy unit:** core · **Semver:** NONE · **Category:** Legacy

## Location
- `packages/core/src/services/chara/chara-parser.ts:84-102 (CharaSlotId, CharaGearSlotId, CharaSlotInertReason)`
- `chara-resolver.ts:53-129 (CharaSlotVerdict, CharaSlotErrorCode, ResolvedCharaSlot, ResolvedGearDye, ResolvedCharaCharacter, StainIdLookup)`
- `importers chara-models.ts:21, chara-library.ts:26, chara-library-resolve.ts:15, chara-library-types.ts:8, index.ts:185-197,260-271, __tests__/chara-library-parity.test.ts:28`

## Evidence
- Read chara-parser.ts:83-102 and chara-resolver.ts:53-129: the declarations match the claim. git grep -w per type over apps/packages/scripts (excluding tests and the two legacy files): CharaSlotId has hits in web-app chara-sheet.ts:23 and swatch-tool.ts:32, and bot-logic swatch.ts:30. CharaGearSlotId: chara-models.ts:21, api-worker resolver/router/types, web-app glamour-block, glamour-list-actions, chara-inspection-protocol, chara-resolve-service; bot-logic glamour.ts:33. ResolvedCharaSlot: swatch.ts:34,270-272,333,339. ResolvedGearDye: chara-library.ts:26,231; glamour-block.ts:35. ResolvedCharaCharacter: chara-library-types.ts:8,43; glamour.ts:41; swatch.ts:33,102. StainIdLookup: chara-library.ts:212; chara-li…
- Every claim checks out. Six types consumed in production (CharaSlotId, CharaGearSlotId, ResolvedCharaSlot, ResolvedGearDye, ResolvedCharaCharacter, StainIdLookup), plus three member types reached through ResolvedCharaSlot, are declared inside the legacy parser and resolver files. That makes the legacy removal (core-legacy-03) impossible until the types move. Moving them under the same barrel names and the same shapes is semver NONE. The race type is already `Race | null`. Exports outside the exports map (deep dist paths) are not public, and type-only imports are erased, so the /chara runtime closure stays the sa…
- Still live: web-app chara-sheet.ts:23, swatch-tool.ts:32, glamour-block.ts:35-36; bot-logic swatch.ts:30-34, glamour.ts:33,41; api-worker chara/types.ts:14; core chara-library.ts:26, chara-library-resolve.ts:15, chara-library-types.ts:8, chara-models.ts:21

## Fix
- **REFACTOR FIRST** — 1. Create services/chara/chara-types.ts, or extend chara-library-types.ts, holding the 9 types with race typed as `Race | null`. A type-only cycle with chara-models.ts is legal. 2. In chara-parser.ts and chara-resolver.ts, import the moved types back and delete the old declarations. 3. Repoint chara-models.ts:21, chara-library.ts:26, chara-library-resolve.ts:15, chara-library-types.ts:8, parity.test.ts:28, and index.ts:185-197,260-271. Keep the same names and @public tags. 4. Diff the export list in dist/index.d.ts before and after the change. 5. Run `p…
- Prerequisite: None. It is itself the prerequisite for 03. Before merging, capture the export list of dist/index.d.ts so it can be compared after the change.
- Cascade: Prerequisite for core-legacy-03 and core-legacy-04 (removing parseCharaFile/resolveCharaColors and the legacy-only public types). Nothing becomes dead by itself.
- Published: core 5.15.0 is published and these names are on its barrel. Relocating them with the same names and shapes is NONE. Dropping or renaming any of them would be MAJOR.

## Status
OPEN
