# DEAD-038: Published SwatchInput/GlamourInput.fileText and the NO_INPUT guard: KEEP until bot-logic 5.0.0
**Confidence:** HIGH · **Blast radius:** MEDIUM · **Deploy unit:** bot-logic (+ discord-worker call sites in the same change) · **Semver:** MAJOR · **Category:** Legacy

## Location
- `packages/bot-logic/src/commands/swatch.ts:72-76`
- `packages/bot-logic/src/commands/glamour.ts:97-101`
- `packages/bot-logic/src/commands/chara-identity.ts:32-50`

## Evidence
- git grep -c -w fileText: bot-logic tests 9+23+8+29=69 lines (the reviewer's count holds). The claim "test-only in-repo" is wrong. discord-worker writes fileText at swatch.ts:74,110 and glamour.ts:146,157. It is a dead store, because fileBytes is set in the same branch (swatch.ts:111, glamour.ts:147) and wins at chara-identity.ts:47 (`fileBytes ?? fileText`). The NO_INPUT throw (:48-50) is the only guard for a published caller that passes neither field; the types allow that, since both fields are optional. readCharaForTools/CharaFileSource are not exported, but SwatchInput/GlamourInput are (index.ts:115,126). npm view → 4.11.0 = latest = local. The field has been published since ac701b32 (required in 3.8; made…
- Removing or narrowing a field on a published input type (SwatchInput/GlamourInput, bot-logic 4.11.0 on npm) is MAJOR. The 4.11.0 CHANGELOG explicitly promises that fileText stays accepted. While both fields are optional, the NO_INPUT guard is needed for type safety, and it is the PARSE_FAILED path for any npm caller that passes neither. Correction to the row: the field is not test-only in-repo. discord-worker writes it at 3 sites, but never reads it. Removing it therefore also touches discord-worker, so the cascade is larger than the tests alone. A MINOR step is possible now if wanted: add @deprecated to fileTex…
- Still live: Published npm API: SwatchInput and GlamourInput, exported at packages/bot-logic/src/index.ts:115,126. In this repo, discord-worker writes the field but never reaches its read path.

## Fix
- **KEEP** — revisit trigger: Make fileBytes required and drop fileText and NO_INPUT in bot-logic 5.0.0.
- Trigger as verified: When packages/bot-logic/package.json is bumped to 5.0.0, the first MAJOR after 4.11.0 (for example, the release that removes SwatchCharacter under bot-discord-01): make fileBytes required and drop fileText and NO_INPUT in that same release.
- Cascade: Narrowing the type breaks the discord-worker compile at swatch.ts:74,110 and glamour.ts:157 (plus locals at 137,146). The rewrite also covers 69 bot-logic test lines (swatch.test.ts 29, glamour.test.ts 23, glamour-library.test.ts 9, swatch-library.test.ts 8) and 2 discord-worker test lines. It also needs docs/versions.md:571 and the CHANGELOG.
- Published: @xivdyetools/bot-logic 4.11.0 is npm latest and equals the local version. fileText has been on the published input since 3.8 (ac701b32) and became optional in 4.11.0 (af2cec96). Per CHANGELOG.md:16-18, it stays accepted.

## Status
OPEN
