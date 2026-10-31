# DEAD-022: bot-logic swatch.test.ts uses the legacy parseCharaFile/resolveCharaColors as an oracle for facade output, and keeps a vi.fn wrapper on resolveCharaColors that nothing uses — ~4 lines
**Confidence:** HIGH · **Blast radius:** NONE · **Deploy unit:** bot-logic (test file only; tsconfig.build.json excludes **/*.test.ts, so nothing published changes) · **Semver:** NONE · **Category:** Legacy
**Calibration:** Blast LOW->NONE: the change is confined to bot-logic swatch.test.ts, which tsconfig.build excludes. It is a prerequisite of D01 (the only importer of the legacy pair outside core) and can land early.

## Location
- `packages/bot-logic/src/commands/swatch.test.ts:8-9,26-28,33,226,386,410,454`

## Evidence
- git grep -w parseCharaFile|resolveCharaColors (tracked, no md/audits): bot-logic has only swatch.test.ts (7 hits: imports :8-9, wrapper :33, oracle :226,:386,:410,:454); the rest are in core. swatch.ts reads via readCharaForTools (chara-identity.ts:46-52, inspectCharaForTools->resolveCharaForTools); swatch.ts has no legacy call. vi.mocked/mockImplementation hits only :483 (generateSwatchCard) and :524 (resolveCharaForTools), so the :33 wrapper is never inspected. After the bot imports go, core index exports stay referenced (chara-library.test.ts:45-46, core.parseCharaFile/resolveCharaColors), so knip is unaffected. I did not run the gate.
- The claim holds. executeSwatch never calls the legacy pair, so these tests compare facade output with the legacy pipeline. The comment at :377-380 notes they only agree on the lip because LIP_ON sets Mouth 130. The wrapper at :33 has no spy or mock use, so removing it is safe now (sub-rows core-legacy-07 and bot-discord-04: REMOVE). The oracle swap is the prerequisite (REFACTOR FIRST): it must land before core drops parseCharaFile/resolveCharaColors, because this is the only importer outside core. Removing them from core is MAJOR (core 5.15.0 is published, and its CHANGELOG says the legacy contracts are unchanged). The test edit itself is semver NONE.
- Still live: None in production. The only callers are test assertions in swatch.test.ts. Production swatch.ts goes through readCharaForTools (chara-identity.ts:46-52).

## Fix
- **REFACTOR FIRST** — 1) Delete swatch.test.ts:33 (resolveCharaColors: vi.fn(...)) and the clause at :27-28 ('the legacy resolver stays wrapped...'). 2) :226: assert inspectCharaForTools(WITH_NICKNAME).metadata.Nickname.value === 'Real Name'. 3) :386/:410/:454: use literal hexes and verdicts. resolveCharaForTools also works, but it is the code under test, so the check becomes circular. Core's chara-library-parity.test.ts already pins legacy/facade parity. 4) Drop parseCharaFile and resolveCharaColors from the :6-11 import. 5) pnpm turbo run build type-check lint test --filter=...@xivdyetools/bot-logic
- Prerequisite: Rewrite the four oracle sites (:226, :386, :410, :454) as inspectCharaForTools or literal expectations before the legacy imports at :8-9 can go.
- Cascade: This file is the only importer of the legacy parser/resolver outside core, and it blocks core-legacy-03 and supply-harness-01. Editing it does not unblock the core removal by itself. core's own tests (chara-parser, chara-resolver, chara-library-parity and the chara-library namespace check at :45-46) still use the legacy pair, and removing them from core is a MAJOR bump.
- Published: bot-logic 4.11.0 publishes dist only (tsconfig.build.json excludes **/*.test.ts), so the test edit is semver NONE. core's parseCharaFile/resolveCharaColors are untagged root exports of published core 5.15.0, so removing them later is MAJOR.

## Status
OPEN
