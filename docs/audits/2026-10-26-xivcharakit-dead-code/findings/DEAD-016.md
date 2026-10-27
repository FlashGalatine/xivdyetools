# DEAD-016: Redundant export on module-internal getCharacterColors and CharaFileSource
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** bot-logic · **Semver:** NONE · **Category:** Legacy
**Calibration:** Blast NONE->LOW: it is a code edit in internal bot-logic. Neither symbol is in bot-logic's src/index.ts (grep), so dropping the export keyword is not a published-API change.

## Location
- `packages/bot-logic/src/commands/chara-identity.ts:27,33`

## Evidence
- git grep -w getCharacterColors|CharaFileSource: 4 hits, all in chara-identity.ts (decl :27/:33, uses :46/:51). symrefs.sh: both prod=0 tests=0 other=1 (self). Importers of chara-identity: glamour.ts:47 and swatch.ts:51 take only genderSymbol/producerToken/readCharaForTools/tribeDisplay; the tests take tribeDisplay; manual.test.ts reads PRODUCER_TOKENS as text. src/index.ts never names chara-identity. npm view @xivdyetools/bot-logic@4.11.0 exports = only . and ./i18n, so the module is not reachable from npm. knip.jsonc:43 sets ignoreExportsUsedInFile, which is why lint never flagged it. No isolatedDeclarations: a local interface in the exported readCharaForTools signature still emits.
- Both symbols are used only inside their own module. The barrel never re-exports them, and the published exports map (. and ./i18n) cannot reach commands/chara-identity, so npm consumers cannot import them. Dropping the export keywords changes no runtime or public API. readCharaForTools stays exported for glamour/swatch, and its .d.ts emits the now-local interface without error.
- Still live: None outside the file. In-file only: readCharaForTools at chara-identity.ts:46,51.

## Fix
- **REMOVE** — In packages/bot-logic/src/commands/chara-identity.ts, change line 27 `export function getCharacterColors()` to `function getCharacterColors()` and line 33 `export interface CharaFileSource` to `interface CharaFileSource`. No barrel, test or doc changes are needed. Gate: pnpm turbo run build type-check lint test --filter=...@xivdyetools/bot-logic && pnpm dead-code:check. Optional: ship it with the next bot-logic release; it needs no version bump of its own.
- Cascade: None. getCharacterColors keeps its in-file caller readCharaForTools (:51), and CharaFileSource keeps its in-file use as readCharaForTools' parameter type (:46).
- Published: bot-logic 4.11.0 is published, but its exports map exposes only . and ./i18n, and src/index.ts does not re-export chara-identity. The change is not part of the public API (semver NONE).

## Status
OPEN — source prepared; release pending. [A-BOT-LOGIC evidence](../../2026-10-26-security/evidence/remediation-bot-logic-2026-10-27.md).
