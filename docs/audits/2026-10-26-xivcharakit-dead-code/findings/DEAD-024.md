# DEAD-024: Legacy parseCharaFile / resolveCharaColors pair, its legacy-only public types and the parity harness [host] half are reachable only from tests: deprecate in core 5.16, remove in core 6.0 — ~3,561 lines
**Confidence:** HIGH · **Blast radius:** HIGH · **Deploy unit:** core (6.0.0); bot-logic test-only edit (swatch.test.ts, semver NONE) · **Semver:** MAJOR · **Category:** Legacy
**Merged:** D02, D05 (same root cause, per the calibration pass)

## Location
- `packages/core/src/services/chara/chara-parser.ts:156-615 (parseCharaFile + private helpers)`
- `chara-resolver.ts:45-51,131-453 (resolveCharaColors, OFF_GRID_DELTA_E2000, EYE_LANDS, helpers)`
- `index.ts:184,198-201`

## Evidence
- At HEAD 88189ee8, `git grep -w parseCharaFile|resolveCharaColors|OFF_GRID_DELTA_E2000` outside the definitions turns up only index.ts:184,199-200 and tests (core parser, proto, resolver, parity:28-29 and library:45-46, plus bot-logic swatch.test). Apps, scripts and configs have no hits. Still live in the same files: MAX_CHARA_FILE_BYTES (chara-library.ts:24), CharaGearSlotId (chara-models.ts:21), CharaSlotId (web chara-sheet.ts:23, swatch-tool.ts:32, bot swatch.ts:30), StainIdLookup/ResolvedGearDye (chara-library.ts:26, library-resolve.ts:15), ResolvedCharaCharacter (library-types.ts:43, glamour.ts:41), which uses ParsedCharaFile['race'] (resolver:109). Grepping for @deprecated finds nothing, and DEPRECATIONS.…
- The reviewers' main claim holds. No production code in any app or package calls parseCharaFile, resolveCharaColors or OFF_GRID_DELTA_E2000. Web and bot read files through inspectCharaForTools -> resolveCharaForTools/resolveCharaWithProvider, and the only other references are the barrel and tests. The REMOVE WITH CAUTION recommendation as filed is not safe yet, for three reasons. (a) Both files still hold live exports, so they can only be cut back, not deleted. (b) The symbols are published API on npm core 5.15.0 with no @deprecated tag, and the 5.15.0 CHANGELOG promises the legacy contracts are unchanged, so rem… Refuter's narrowing: The core claim holds. The two functions and OFF_GRID_DELTA_E2000 have no production caller in any workspace, script, subpath or config, so they are test-only. The group's file-level scope ('~575 of 615', 1997 lines) is wrong, though. Both files also define types the live xivcharakit path depends on: ImportedCharaCharacter exten…
- Still live: No production consumer of the functions. Live co-located exports: chara-library.ts:24,26; chara-models.ts:21; chara-library-types.ts:8,43; chara-library-resolve.ts:15; bot-logic swatch.ts:30,33-34; glamour.ts:41; web-app chara-sheet.ts:23 and swatch-tool.ts:32 (types).

## Fix
- **REFACTOR FIRST** — 1) In a core MINOR: add @deprecated to parseCharaFile, resolveCharaColors, OFF_GRID_DELTA_E2000 and ParsedCharaFile, plus a DEPRECATIONS.md entry targeting 6.0.0. 2) In core 6.0.0, after web 5.16.0 and bot 5.9.0 are accepted in production: move MAX_CHARA_FILE_BYTES, CharaSlotId/CharaGearSlotId/CharaSlotInertReason and the Resolved*/StainIdLookup types into a types module; inline race as Race|null. 3) Delete parser:156-615 and resolver:45-51,131-453, then git rm the parser, proto and resolver tests. 4) Drop index.ts:184,198-201 and chara-library.test.ts:…
- Prerequisite: A MINOR @deprecated release, the type and constant relocation, and closed beta acceptance of the xivcharakit integration.
- Cascade: Before 6.0.0: relocate MAX_CHARA_FILE_BYTES, the slot ID types, ResolvedCharaCharacter/ResolvedCharaSlot/ResolvedGearDye/StainIdLookup and CharaSlotInertReason, and replace ParsedCharaFile['race'] inside ResolvedCharaCharacter. Remove in the same PR: the parity harness [host] half, the swatch.test.ts legacy expectations and the vi.fn mock at :33, and the chara-library.test.ts:45-46 barrel pin. Docs to update: core C…
- Published: @xivdyetools/core 5.15.0 (npm latest == local) exports parseCharaFile, resolveCharaColors and OFF_GRID_DELTA_E2000 (marked @public) and has since 5.1.0 (code from 3fe098c1). Removing them is MAJOR; adding @deprecated is MINOR. bot-logic 4.11.0 does not re-export them.
- **Maintainer decision:** Cut core 6.0.0 to remove the legacy parser and resolver. Gate it on a shipped @deprecated MINOR with a DEPRECATIONS.md entry and on closed beta acceptance (web-app 5.16.0 and discord-worker 5.9.0 confirmed in production).

## Status
OPEN
