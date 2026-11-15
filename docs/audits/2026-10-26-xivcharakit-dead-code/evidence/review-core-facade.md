# Review: core-facade (deploy unit: core)

HEAD 88189ee8. Read-only review. Nothing was removed.

## Module map

| File | Role | Runtime importers (non-test) |
|---|---|---|
| `packages/core/src/chara.ts` | `./chara` subpath: `inspectCharaForTools`, `resolveCharaWithProvider`, and 4 types | web-app `workers/chara-inspection.worker.ts:24` (only runtime importer of the subpath) |
| `services/chara/chara-library.ts` | bounded reader + projection (`inspectCharaForTools`, `resolveCharaWithProvider`) | `chara.ts:17`, `index.ts:273-276`, `chara-library-resolve.ts:17` |
| `services/chara/chara-library-resolve.ts` | `resolveCharaForTools` (service-or-provider convenience entry) | `index.ts:277`; consumer bot-logic `commands/chara-identity.ts:13,51` |
| `services/chara/chara-library-types.ts` | `ImportedCharaCharacter`, `ImportedCharaSlot`, `CharaImportIssue`, `CharaPaletteProvider` | type-only |
| `services/chara/chara-palette-provider.ts` | `createCharaPaletteProvider` (host palettes → library provider) | `chara-library-resolve.ts:16`; web-app `services/chara-inspection-service.ts:28,84` |
| `services/chara/chara-game-rules.ts` | wear mask, twin rule grouping, `charaTwinProblems` | `chara-twins.ts:26-31`; api-worker `src/chara/xivapi.ts`, `resolver.ts` |
| `services/chara/chara-twins.ts` | twin choice / tone / facts | web-app `glamour-block.ts`, `glamour-twin-picker.ts`; bot-logic `glamour.ts` |
| `services/chara/chara-gposers.ts` | GPOSERS form as data | web-app `shared/glamour-markdown.ts`, `glamour-list-actions.ts`; bot-logic `glamour.ts` |
| legacy `chara-parser.ts` / `chara-resolver.ts` | `parseCharaFile`, `resolveCharaColors` + types | **runtime functions: no non-test caller anywhere** (see C-01); their TYPES and `MAX_CHARA_FILE_BYTES` are live |

Classes in slice: `git grep -n -E "^\s*(export )?(abstract )?class " -- packages/core/src/chara.ts packages/core/src/services/chara/` → no output, exit 1. members.py not applicable.

Skipped/focused tests: `git grep -n -E "\b(it|describe|test)\.(skip|todo)|\bxit\(|\.only\(" -- packages/core/src/services/chara packages/core/src/__tests__/chara-entry.test.ts` → none.

npm: `npm view @xivdyetools/core version` → `5.15.0` (= local `packages/core/package.json`); `npm view @xivdyetools/core time` → 5.15.0 published 2026-10-26T21:15:41Z; `npm view @xivdyetools/core@5.15.0 exports` includes `./chara`. Every barrel/subpath symbol below is therefore published; removing one is **MAJOR** (core 6.0.0), not a fold into a pending entry (`CHANGELOG.md:8` Unreleased has no chara entry).

## Reference tables built

symrefs (evidence/symrefs-core-chara.txt) re-read for the slice; extra greps:

| Query | Result |
|---|---|
| `git grep -n -w -e parseCharaFile -e resolveCharaColors -- ':!docs' ':!**/CHANGELOG*'` minus tests | only `index.ts:184,199`, definitions `chara-parser.ts:442`, `chara-resolver.ts:316`, and `packages/core/CLAUDE.md:191` |
| same, test files | core `chara-parser.test.ts`, `chara-parser-proto.test.ts`, `chara-resolver.test.ts`, `chara-library-parity.test.ts:28-29,241-242`, `chara-library.test.ts:45-46`; bot-logic `swatch.test.ts:8-9,33,226,386,410,454` |
| `git grep -n "@xivdyetools/core/chara"` (code) | `apps/web-app/src/workers/chara-inspection.worker.ts:24` + its test `:27` |
| barrel `resolveCharaWithProvider` importers | `apps/web-app/src/services/__tests__/chara-inspection-service.test.ts:15-23` (test only) |
| barrel `inspectCharaForTools` importers | bot-logic `src/commands/chara-identity.ts:12` (prod) |
| `git grep -n -E "resolveCharaForTools\("` | prod: bot-logic `chara-identity.ts:51` (passes `getCharacterColors()`, a service); provider arm only `chara-library.test.ts:784,795` |
| `extendedValid` / `extendedDeclared` readers outside `chara-inspection-protocol.ts` | none in prod; mocks/tests only (`imported-chara.ts:102-103`, `swatch-library.test.ts:555-574`, core tests) |
| `indexGap` readers | web-app `chara-ui.ts:119`, bot-logic `swatch.ts:297` (live) |
| `matchHex` readers | web-app `chara-ui.ts:158,181`, protocol `:460-467` (live) |
| `eyesShareIndex` readers | bot-logic `swatch.ts:427,448` (live) |
| `ISSUES_TRUNCATED` | emitted `chara-library.ts:175`; mapped web-app `chara-ui.ts:332` (live) |
| first ship of symbols in `index.ts` (`git log -S`) | parseCharaFile/resolveCharaColors 3fe098c1 2026-08-07; CHARA_WEAPON_SLOTS 1d13e4c2 2026-08-20; CharaTwinFamily 71f88d7f 2026-09-27; CHARA_OFF_HAND_MAIN_CATEGORIES + GposersOmitContext 12759fd3 2026-10-11; facade symbols d9bccc36 2026-10-26 |

Library facts checked in `packages/core/node_modules/xivcharakit/dist` (0.1.0-beta.4):
- `palettes/types.d.ts:1-10`: `PaletteTable = 'creator'|'shader'`, `PaletteName` union of 9 names.
- `appearance.js:305-320`: shader requests use `lipsDark` for lip, skip shader for facePaint, else the slot palette.
- `appearance.js:332-353`: every `interpretation = "inactive"` also has `active === false` (set or already false).
- `chunks/chunk-TCBT3LBA.js:2-47`: `IssueCollector` max 64, `boundedPath` bounds a path to 256 chars.
- `field-spec.d.ts:1-5`: field names = the allow-list in `chara-library.ts:62-122` (no extra entries).

## Candidates

### core-facade-01 Legacy parser/resolver functions are test-only (REFACTOR FIRST, MAJOR)
- Files: `packages/core/src/index.ts:184,199-200`; `services/chara/chara-parser.ts:156-615` (parseCharaFile + private helpers); `services/chara/chara-resolver.ts:45-51,131-453` (OFF_GRID_DELTA_E2000, EYE_LANDS, resolveCharaColors + helpers).
- Proof: grep table rows 1-2. No app, package or script calls either function outside tests. Live production reads go through `inspectCharaForTools` → `resolveCharaForTools` (bot-logic `chara-identity.ts:51`) or `resolveCharaWithProvider` (web-app worker `:88`). Kept alive by: own tests (1,055 lines), the parity harness's `[host]` half (`chara-library-parity.test.ts:339-345`), bot-logic `swatch.test.ts` expectation helpers, the barrel presence pin `chara-library.test.ts:45-46`, and the main-barrel export.
- Not dead in the same files: `MAX_CHARA_FILE_BYTES` (`chara-library.ts:24,143`), `CharaSlotId`/`CharaGearSlotId` (chara-models.ts:21, web-app, bot-logic), `ResolvedCharaCharacter`/`ResolvedCharaSlot`/`ResolvedGearDye`/`StainIdLookup` (chara-library-types.ts:8, chara-library.ts:26, bot-logic `swatch.ts:33-34,102,270-272,333`, `glamour.ts:41,311,436-440`).
- Cascade: move the live constant + types first (to chara-library-types.ts / chara-models.ts), then delete the two functions, OFF_GRID_DELTA_E2000 (`@public`, only `chara-resolver.ts:407`), `CharaColorSlotRaw`, `CharaGearDye`, `ParsedCharaFile`, `CharaSlotErrorCode`, `CharaSlotVerdict`, `CharaSlotInertReason` barrel rows if no other reader; rewrite bot-logic `swatch.test.ts:386,410,454` expectations without the legacy resolver and drop its `resolveCharaColors` mock (`:33`); drop parity `[host]` half or freeze the harness as research; update `chara-library.test.ts:45-46`; docs `docs/projects/core/services.md:308-312`, `docs/projects/core/overview.md:113`, `packages/core/CLAUDE.md:191`. `charaShaderHex` stays live (palette provider).
- Lines: ~460 + ~330 + 3 (index) + 1,055 tests = ~1,850 (parity harness restructure extra).
- Deploy/semver: core MAJOR. Keep trigger: core 6.0.0 planning; the parity register's role as evidence for docs/research/2026-10-22-xivcharakit-integration.md is done.

### core-facade-02 Provider arm of `resolveCharaForTools` is test-only (KEEP)
- `chara-library-resolve.ts:20-24` (`isPaletteProvider`), `:35` union param, `:38` ternary. Only prod caller passes a service (bot-logic `chara-identity.ts:51`); provider arm only at `chara-library.test.ts:784,795`; `resolveCharaWithProvider` already serves provider callers (worker `:88`).
- MAJOR to narrow (published 5.15.0 today). Trigger: core 6.0.0. Cascade: tests `chara-library.test.ts:731-737,781-800` (~25 lines), type comment `chara-library-types.ts:30-33`. Lines ~32.

### core-facade-03 Barrel copy of `resolveCharaWithProvider` (Redundant Re-export, KEEP)
- `index.ts:275`. Only in-repo barrel importer is a test (`apps/web-app/src/services/__tests__/chara-inspection-service.test.ts:20`); the prod consumer uses the subpath (`chara-inspection.worker.ts:24`). Documented design (`chara.ts:6-7`, `packages/core/CLAUDE.md:191`). The barrel `inspectCharaForTools` is live (bot-logic `chara-identity.ts:12`), so it is not a candidate.
- MAJOR. Trigger: core 6.0.0, if the subpath is made the only provider-entry route. Cascade: `chara-library.test.ts:49-51`, the web-app test import. Lines 1.

### core-facade-04 `extendedValid` / `extendedDeclared` filled, never read (KEEP)
- Filled `chara-library.ts:270-271` (inherited via `Omit<ResolvedCharaCharacter,'slots'>`, `chara-library-types.ts:42`). No prod reader: web-app only validates them (`chara-inspection-protocol.ts:228-229,731-761`); bot-logic passes them through to the published `SwatchCharacter` (`swatch.ts:369-372`); no discord-worker or stoat reader.
- MAJOR in core and in bot-logic (`SwatchCharacter` is `@public`). Trigger: a coordinated core 6 / bot-logic 5. Cascade: protocol validator, web-app mocks, bot-logic `swatch-library.test.ts:555-574`, core tests. Lines ~12 prod + ~40 tests.

### core-facade-05 Stale comments (REMOVE = reword, semver NONE)
- `chara.ts:9-12`: "its first consumer ... lands in the web-app change stacked on this one" — it has landed (`apps/web-app/src/workers/chara-inspection.worker.ts:24`).
- `chara-library-types.ts:30-33`: the example "a worker that asks the page for each color" for `resolveCharaForTools` — the worker calls `resolveCharaWithProvider` (`chara-inspection.worker.ts:88`).
- `chara-library-parity.test.ts:11-13`: "the application bridge is Task 2" — it exists (`chara-palette-provider.ts:105`).
- `packages/core/CLAUDE.md:191`: "the parser does not [enforce 8 KiB]" omits that the facade reader does (`chara-library.ts:143`).
- Lines ~6 reworded.

### core-facade-06 `CHARA_WEAPON_SLOTS` exported, no consumer (KEEP)
- `index.ts:210`, `chara-models.ts:35`; only use `chara-models.ts:38`; symrefs tests=0 other=0. Shipped since 2026-08-20 (`@public`).
- MAJOR to unexport. Trigger: core 6.0.0. Lines 1 (drop `export`).

### core-facade-07 `matchHexFor` `'inactive'` arm unreachable today (KEEP)
- `chara-library.ts:195`: line 194 already returns for `active !== true`, and the library never sets `interpretation: 'inactive'` with `active === true` (`appearance.js:332-353`). Defensive against an undocumented beta invariant. Trigger: xivcharakit documents the invariant at 1.0. Lines 0-1. Semver NONE.

### core-facade-08 Palette provider guards the library never trips (KEEP)
- `chara-palette-provider.ts:109` (table), `:110` (palette type), `:133` (shader for lipsLight/facePaintDark/facePaintLight): impossible under `PaletteRequest` types and never requested (`appearance.js:312-320`). But `createCharaPaletteProvider` is public and web-app relays worker-originated requests through it (`chara-inspection-service.ts:84`); the header states it on purpose (`:5-6`). Not dead. Lines 0.

## KEEP / not candidates (with reason)
- `CharaTwinFamily` (`index.ts:236`), `GposersOmitContext` (`:258`): parameter types of exported functions (`chara-twins.ts:76`, `chara-gposers.ts:197`); credible `@public`.
- `CHARA_OFF_HAND_MAIN_CATEGORIES` (`index.ts:250`): live inside `gposersOmittedSlots` (`chara-gposers.ts:214`), documented purpose, api-worker comment `src/chara/types.ts:78`.
- `charaTwinProblems`, `CharaCheckCharacter`, `CharaTwinMember`: module-internal exports used by `chara-twins.ts`.
- `isKnownPathSegment` allow-list: same as library field spec.
- `MAX_ISSUES` truncation: reachable (two collectors, each up to 64, merged at `chara-library.ts:277`).
- `MAX_PATH_SEGMENTS` / `MAX_PATH_INDEX`: library bounds by characters, not depth; reachability not proven. Kept as defense.
- Duplicate `HOST_GENDER` (`chara-library.ts:136`, `chara-palette-provider.ts:58`): duplication, not dead code.
- All five `.chara` fixtures are referenced by web-app tests.

## FILES COVERED
packages/core/src/chara.ts; packages/core/src/index.ts (lines 183-284); packages/core/src/services/chara/{chara-library.ts, chara-library-resolve.ts, chara-library-types.ts, chara-palette-provider.ts, chara-game-rules.ts, chara-twins.ts, chara-gposers.ts}; outline only: chara-parser.ts, chara-resolver.ts, chara-models.ts, chara-shader-colors.ts; tests: chara-library.test.ts (public surface + signatures), chara-library-parity.test.ts (header + structure), bot-logic swatch.test.ts (legacy use); xivcharakit dist (palettes/types.d.ts, appearance.js, issues chunk, field-spec.d.ts).
